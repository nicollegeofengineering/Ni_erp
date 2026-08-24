const express = require('express');
const router = express.Router();
const connectDB = require('../../config/db');
const Student = require('../../models/Student');
const User = require('../../models/User');
const Subject = require('../../models/Subject');
const InternalMark = require('../../models/InternalMark');
const Attendance = require('../../models/Attendance');
const Timetable = require('../../models/Timetable');
const Staff = require('../../models/Staff');

// Helper to resolve the authenticated student
async function getStudentFromReq(req) {
  if (!req.user || !req.user.id) return null;
  const user = await User.findById(req.user.id).lean();
  if (!user) return null;

  const trimmedUsername = (user.username || '').trim();
  const trimmedEmail = (user.email || '').trim();
  const usernameRegex = trimmedUsername ? new RegExp(`^${trimmedUsername}$`, 'i') : null;
  const emailRegex = trimmedEmail ? new RegExp(`^${trimmedEmail}$`, 'i') : null;

  const orClauses = [];
  if (usernameRegex) {
    orClauses.push({ register_no: usernameRegex });
    orClauses.push({ roll_no: usernameRegex });
    orClauses.push({ student_id: usernameRegex });
  }
  if (emailRegex) {
    orClauses.push({ email: emailRegex });
  }

  let student = orClauses.length > 0 ? await Student.findOne({ $or: orClauses }).lean() : null;

  if (!student && user.name) {
    const firstName = user.name.split(' ')[0];
    if (firstName) {
      student = await Student.findOne({
        first_name: new RegExp(`^${firstName}$`, 'i'),
      }).lean();
    }
  }

  return { user, student };
}

// Helper to get all identifier strings for a student
function getStudentIdentifiers(student) {
  if (!student) return [];
  const ids = [
    student._id ? student._id.toString() : null,
    student.student_id,
    student.register_no,
    student.roll_no,
  ].filter(Boolean);

  // Return unique trimmed strings
  return [...new Set(ids.map(id => String(id).trim()))];
}

// ============================================================================
// 1. GET /api/student/profile
// ============================================================================
router.get('/profile', async (req, res) => {
  try {
    await connectDB();
    const result = await getStudentFromReq(req);
    if (!result || !result.student) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found for this account',
      });
    }

    const { student, user } = result;

    const photoUrl = student.photo_file_id
      ? `/api/admin/student/${student.student_id}/photo?v=${student.photo_version || 0}`
      : student.profile_image || user.profile_image || '/user.png';

    const fullName = student.first_name
      ? `${student.first_name} ${student.last_name || ''}`.trim()
      : student.name || user.name || user.username;

    return res.status(200).json({
      success: true,
      data: {
        ...student,
        email: student.email || user.email,
        name: fullName,
        profile_image: photoUrl,
      },
    });
  } catch (error) {
    console.error('Error fetching student profile:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 2. GET /api/student/marks
// Semester-wise internal marks for the student
// ============================================================================
router.get('/marks', async (req, res) => {
  try {
    await connectDB();
    const result = await getStudentFromReq(req);
    if (!result || !result.student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const { student } = result;
    const requestedSemester = req.query.semester
      ? parseInt(req.query.semester)
      : student.semester || 1;

    const possibleIds = getStudentIdentifiers(student);

    // Resolve all possible MongoDB ObjectIds for this student
    const studentObjectIds = [student._id];
    const matchingDocs = await Student.find({
      $or: [
        { student_id: { $in: possibleIds } },
        { register_no: { $in: possibleIds } },
        { roll_no: { $in: possibleIds } },
      ],
    })
      .select('_id')
      .lean();

    matchingDocs.forEach((d) => {
      if (d._id && !studentObjectIds.some((id) => String(id) === String(d._id))) {
        studentObjectIds.push(d._id);
      }
    });

    // Query InternalMark records for this student and semester using valid ObjectIds
    const markRecords = await InternalMark.find({
      student: { $in: studentObjectIds },
      semester: { $in: [requestedSemester, String(requestedSemester), Number(requestedSemester)].filter(v => !isNaN(Number(v))) },
    })
      .populate('subject', 'subjectName subjectCode Category credits')
      .populate({
        path: 'theory.enteredBy',
        select: 'prefix first_name last_name',
      })
      .populate({
        path: 'practical.enteredBy',
        select: 'prefix first_name last_name',
      })
      .lean();

    // Group marks by Subject
    const subjectMap = {};

    markRecords.forEach((rec) => {
      if (!rec.subject) return;
      const subId = rec.subject._id.toString();

      if (!subjectMap[subId]) {
        subjectMap[subId] = {
          subjectId: subId,
          subjectCode: rec.subject.subjectCode,
          subjectName: rec.subject.subjectName,
          category: rec.category || rec.subject.Category || 'T',
          credits: rec.subject.credits || 3,
          iat1: null,
          iat2: null,
        };
      }

      const faculty = rec.theory?.enteredBy || rec.practical?.enteredBy;
      const facultyName = faculty
        ? `${faculty.prefix || ''} ${faculty.first_name || ''} ${faculty.last_name || ''}`.trim()
        : null;

      const markData = {
        internalExam: rec.internalExam,
        category: rec.category,
        theory: rec.theory
          ? {
              assignment: rec.theory.assignment,
              writtenExam: rec.theory.writtenExam,
              total: rec.theory.total,
            }
          : null,
        practical: rec.practical
          ? {
              mark: rec.practical.mark,
            }
          : null,
        facultyName,
        updatedAt: rec.updatedAt,
      };

      if (rec.internalExam === 1) {
        subjectMap[subId].iat1 = markData;
      } else if (rec.internalExam === 2) {
        subjectMap[subId].iat2 = markData;
      }
    });

    const marksList = Object.values(subjectMap);

    return res.status(200).json({
      success: true,
      data: {
        semester: requestedSemester,
        currentSemester: student.semester || 1,
        totalSubjects: marksList.length,
        marks: marksList,
      },
    });
  } catch (error) {
    console.error('Error fetching student marks:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 3. GET /api/student/attendance
// Current semester attendance stats & breakdown for the student
// ============================================================================
router.get('/attendance', async (req, res) => {
  try {
    await connectDB();
    const result = await getStudentFromReq(req);
    if (!result || !result.student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const { student } = result;
    const requestedSemester = req.query.semester
      ? parseInt(req.query.semester)
      : student.semester || 1;

    const possibleIds = getStudentIdentifiers(student);
    const deptRegex = new RegExp(`^${(student.department_code || '').trim()}$`, 'i');
    const semFilter = [requestedSemester, String(requestedSemester), Number(requestedSemester)].filter(v => !isNaN(Number(v)));

    // Find all attendance records for student's department & semester
    const attendanceRecords = await Attendance.find({
      department: deptRegex,
      semester: { $in: semFilter },
      'students.student_id': { $in: possibleIds },
    })
      .populate('subject', 'subjectName subjectCode Category')
      .populate('staff', 'prefix first_name last_name')
      .sort({ date: -1, period: 1 })
      .lean();

    let totalPeriods = 0;
    let totalPresent = 0;
    let totalAbsent = 0;

    const subjectStats = {};
    const log = [];
    const absentLog = [];

    attendanceRecords.forEach((record) => {
      const studentEntry = (record.students || []).find(
        (s) => s.student_id && (possibleIds.includes(String(s.student_id).trim()) || String(s.student_id) === String(student._id))
      );

      if (!studentEntry) return;

      const rawStatus = String(studentEntry.status || '').trim();
      const isPresent = rawStatus.toLowerCase() === 'present';
      totalPeriods++;
      if (isPresent) totalPresent++;
      else totalAbsent++;

      const subId = record.subject ? record.subject._id.toString() : 'UNKNOWN';
      const subCode = record.subject?.subjectCode || 'N/A';
      const subName = record.subject?.subjectName || 'Unknown Subject';

      const staffName = record.staff
        ? `${record.staff.prefix || ''} ${record.staff.first_name || ''} ${record.staff.last_name || ''}`.trim()
        : 'Faculty';

      if (!subjectStats[subId]) {
        subjectStats[subId] = {
          subjectId: subId,
          subjectCode: subCode,
          subjectName: subName,
          facultyName: staffName,
          total: 0,
          present: 0,
          absent: 0,
          percentage: 0,
        };
      }

      subjectStats[subId].total++;
      if (isPresent) subjectStats[subId].present++;
      else subjectStats[subId].absent++;

      const logItem = {
        attendanceId: record._id,
        date: record.date,
        day: record.day,
        period: record.period,
        subjectCode: subCode,
        subjectName: subName,
        facultyName: staffName,
        status: isPresent ? 'Present' : 'Absent',
      };

      log.push(logItem);

      if (!isPresent) {
        absentLog.push(logItem);
      }
    });

    // Calculate percentage per subject
    Object.values(subjectStats).forEach((sub) => {
      sub.percentage = sub.total > 0 ? parseFloat(((sub.present / sub.total) * 100).toFixed(1)) : 0;
    });

    const overallPercentage =
      totalPeriods > 0 ? parseFloat(((totalPresent / totalPeriods) * 100).toFixed(1)) : 0;

    return res.status(200).json({
      success: true,
      data: {
        semester: requestedSemester,
        currentSemester: student.semester || 1,
        totalPeriods,
        totalPresent,
        totalAbsent,
        overallPercentage,
        subjects: Object.values(subjectStats),
        absentLog, // All absent records with date, day, period, subject
        recentLog: log.slice(0, 30),
      },
    });
  } catch (error) {
    console.error('Error fetching student attendance:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 4. GET /api/student/classes (Courses for current semester from Timetable)
// ============================================================================
router.get('/classes', async (req, res) => {
  try {
    await connectDB();
    const result = await getStudentFromReq(req);
    if (!result || !result.student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const { student } = result;
    const currentSem = student.semester || 1;
    const currentYear = student.year || 1;
    const deptCode = (student.department_code || '').toUpperCase();

    // Query distinct slots in Timetable for this student's class
    const timetableSlots = await Timetable.find({
      department: deptCode,
      year: currentYear,
      semester: currentSem,
    })
      .populate('subject')
      .populate('staff', 'prefix first_name last_name email staff_id')
      .populate('hall', 'hall_number block floor')
      .lean();

    const classMap = {};

    timetableSlots.forEach((slot) => {
      if (!slot.subject) return;
      const subId = slot.subject._id.toString();

      if (!classMap[subId]) {
        const staff = slot.staff;
        const facultyName = staff
          ? `${staff.prefix || ''} ${staff.first_name || ''} ${staff.last_name || ''}`.trim()
          : 'To be assigned';

        classMap[subId] = {
          subjectId: subId,
          subjectCode: slot.subject.subjectCode,
          subjectName: slot.subject.subjectName,
          category: slot.subject.Category || 'Theory',
          credits: slot.subject.credits || 3,
          regulation: slot.subject.regulation || student.regulation || '2021',
          facultyName,
          facultyEmail: staff?.email || null,
          hallNumber: slot.hall ? slot.hall.hall_number : null,
          weeklyPeriods: 0,
        };
      }

      classMap[subId].weeklyPeriods++;
    });

    // If no timetable slots, fallback to fetching subjects directly for this semester & department
    let classList = Object.values(classMap);
    if (classList.length === 0) {
      const allSubjects = await Subject.find({
        department: deptCode,
        semester: currentSem,
      }).lean();

      classList = allSubjects.map((s) => ({
        subjectId: s._id.toString(),
        subjectCode: s.subjectCode,
        subjectName: s.subjectName,
        category: s.Category || 'Theory',
        credits: s.credits || 3,
        regulation: s.regulation || student.regulation || '2021',
        facultyName: 'Faculty assigned via Timetable',
        facultyEmail: null,
        hallNumber: null,
        weeklyPeriods: 0,
      }));
    }

    return res.status(200).json({
      success: true,
      data: {
        semester: currentSem,
        year: currentYear,
        department: deptCode,
        totalClasses: classList.length,
        classes: classList,
      },
    });
  } catch (error) {
    console.error('Error fetching student classes:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 5. GET /api/student/timetable (Weekly schedule for current semester)
// ============================================================================
router.get('/timetable', async (req, res) => {
  try {
    await connectDB();
    const result = await getStudentFromReq(req);
    if (!result || !result.student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const { student } = result;
    const currentSem = student.semester || 1;
    const currentYear = student.year || 1;
    const deptCode = (student.department_code || '').toUpperCase();

    const slots = await Timetable.find({
      department: deptCode,
      year: currentYear,
      semester: currentSem,
    })
      .populate('subject', 'subjectName subjectCode Category')
      .populate('staff', 'prefix first_name last_name')
      .populate('hall', 'hall_number')
      .lean();

    // Days representation: 1=Monday..6=Saturday
    const dayNames = {
      1: 'Monday',
      2: 'Tuesday',
      3: 'Wednesday',
      4: 'Thursday',
      5: 'Friday',
      6: 'Saturday',
    };

    // Grid: Day x Period (1..7)
    const grid = {};
    for (let d = 1; d <= 6; d++) {
      grid[d] = {
        dayNumber: d,
        dayName: dayNames[d],
        periods: {},
      };
      for (let p = 1; p <= 7; p++) {
        grid[d].periods[p] = null;
      }
    }

    slots.forEach((slot) => {
      if (slot.day >= 1 && slot.day <= 6 && slot.period >= 1 && slot.period <= 7) {
        const staff = slot.staff;
        grid[slot.day].periods[slot.period] = {
          subjectCode: slot.subject?.subjectCode || null,
          subjectName: slot.subject?.subjectName || 'Free Period',
          category: slot.subject?.Category || null,
          facultyName: staff
            ? `${staff.prefix || ''} ${staff.first_name || ''} ${staff.last_name || ''}`.trim()
            : null,
          hallNumber: slot.hall?.hall_number || null,
        };
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        semester: currentSem,
        year: currentYear,
        department: deptCode,
        days: Object.values(grid),
      },
    });
  } catch (error) {
    console.error('Error fetching student timetable:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
