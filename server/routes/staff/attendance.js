const express = require('express');
const router = express.Router();
const connectDB = require('../../config/db');
const Staff = require('../../models/Staff');
const User = require('../../models/User');
const Timetable = require('../../models/Timetable');
const Subject = require('../../models/Subject');
const Student = require('../../models/Student');
const Attendance = require('../../models/Attendance');
const Department = require('../../models/Department');
const mongoose = require('mongoose');
const { notifyAttendanceAlert } = require('../../services/notificationService');

// ---------- Helper: asynchronous check for low attendance and alert students ----------
async function checkAndAlertLowAttendance(studentIds, deptCode, semester) {
  if (!Array.isArray(studentIds) || studentIds.length === 0) return;
  for (const sId of studentIds) {
    try {
      const records = await Attendance.find({
        department: String(deptCode).toUpperCase(),
        semester: Number(semester),
        'students.student_id': String(sId).trim(),
      }).lean();

      let total = 0;
      let present = 0;
      records.forEach((r) => {
        const entry = (r.students || []).find((s) => String(s.student_id).trim() === String(sId).trim());
        if (entry) {
          total++;
          if (String(entry.status || '').toLowerCase() === 'present') {
            present++;
          }
        }
      });

      if (total > 0) {
        const pct = parseFloat(((present / total) * 100).toFixed(1));
        if (pct < 80) {
          await notifyAttendanceAlert(sId, pct, semester);
        }
      }
    } catch (e) {
      console.warn(`[Attendance Alert] Error checking attendance for student ${sId}:`, e.message);
    }
  }
}

// ---------- Helper: format staff full name ----------
const getStaffFullName = (staff) => {
  if (!staff) return null;
  const { prefix = '', first_name = '', last_name = '' } = staff;
  return `${prefix} ${first_name} ${last_name}`.trim().replace(/\s+/g, ' ');
};

// ---------- Helper: get robust start/end of day range ----------
const getNormalizedDateRange = (dateInput) => {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${day}`;

  const startUtc = new Date(`${dateStr}T00:00:00.000Z`);
  const endUtc = new Date(`${dateStr}T23:59:59.999Z`);
  const startLocal = new Date(y, d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const endLocal = new Date(y, d.getMonth(), d.getDate(), 23, 59, 59, 999);

  return {
    start: new Date(Math.min(startUtc.getTime(), startLocal.getTime())),
    end: new Date(Math.max(endUtc.getTime(), endLocal.getTime())),
    exactDate: new Date(`${dateStr}T00:00:00.000Z`),
  };
};

// ---------- Helper: resolve staff and role from request ----------
async function getStaffInfo(req) {
  if (!req.user || !req.user.id) return null;
  const user = await User.findById(req.user.id).lean();
  if (!user) return null;

  let staff = await Staff.findOne({ staff_id: user.username }).lean();
  if (!staff) {
    staff = await Staff.findOne({ email: user.email }).lean();
  }

  const role = user.role || (staff ? staff.role_type : 'Staff');

  if (!staff && role === 'Admin') {
    return {
      _id: user._id,
      staff_id: user.username,
      first_name: user.name,
      last_name: '',
      department_code: 'ALL',
      role: 'Admin',
      userRole: 'Admin',
    };
  }

  if (!staff) return null;

  return {
    ...staff,
    department_code: staff.department_code || staff.department || '',
    role: role,
    userRole: role,
  };
}

// ---------- GET /api/staff/attendance/classes ----------
router.get('/classes', async (req, res) => {
  try {
    await connectDB();
    const staff = await getStaffInfo(req);
    if (!staff) return res.status(401).json({ success: false, message: 'User/Staff not found' });

    const role = (staff.role || staff.userRole || req.user.role || 'Staff').toLowerCase();
    const isViewMode = req.query.mode === 'view' || req.query.viewAll === 'true';
    const matchFilter = {};

    if (isViewMode) {
      if (role === 'admin') {
        // Admin viewing sees all classes
      } else if (role === 'hod') {
        // HOD viewing sees all classes in HOD's department, plus assigned classes in other departments
        matchFilter.$or = [
          { department: staff.department_code },
          { staff: staff._id },
        ];
      } else {
        // Staff viewing sees only assigned classes
        matchFilter.staff = staff._id;
      }
    } else {
      // Entry / Mark Attendance mode: only assigned classes
      matchFilter.staff = staff._id;
    }

    const classes = await Timetable.aggregate([
      { $match: matchFilter },
      { $group: { _id: { department: '$department', year: '$year' } } },
      { $project: { _id: 0, department: '$_id.department', year: '$_id.year' } },
    ]).sort({ department: 1, year: 1 });

    return res.status(200).json({ success: true, data: classes });
  } catch (error) {
    console.error('Error fetching classes:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ---------- GET /api/staff/attendance/subjects-all ----------
router.get('/subjects-all', async (req, res) => {
  try {
    await connectDB();
    const staff = await getStaffInfo(req);
    if (!staff) return res.status(401).json({ success: false, message: 'User/Staff not found' });

    const { department, year } = req.query;
    const filter = {};
    if (department) filter.department = department.toUpperCase();
    if (year) filter.year = parseInt(year);

    const subjectIds = await Timetable.distinct('subject', filter);
    const subjects = await Subject.find({ _id: { $in: subjectIds } })
      .select('_id subjectCode subjectName Category')
      .lean();

    const formatted = subjects.map((s) => {
      const subjectId = s._id ? s._id.toString() : '';
      return {
        _id: subjectId,
        id: subjectId,
        subjectCode: s.subjectCode,
        code: s.subjectCode,
        subjectName: s.subjectName,
        name: s.subjectName,
        Category: s.Category,
      };
    });
    return res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ---------- GET /api/staff/attendance/subjects ----------
router.get('/subjects', async (req, res) => {
  try {
    await connectDB();
    const staff = await getStaffInfo(req);
    if (!staff) return res.status(401).json({ success: false, message: 'User/Staff not found' });

    const role = (staff.role || staff.userRole || req.user.role || 'Staff').toLowerCase();
    const { department, year, mode } = req.query;
    const isViewMode = mode === 'view' || req.query.viewAll === 'true';

    const filter = {};
    if (department) filter.department = department.toUpperCase();
    if (year) filter.year = parseInt(year);

    if (isViewMode) {
      if (role === 'admin') {
        // Admin viewing sees all subjects in department & year
      } else if (role === 'hod') {
        // HOD viewing sees all subjects in their own department, but only assigned subjects if another department is selected
        const normalizedDept = String(department || '').toUpperCase();
        if (normalizedDept !== staff.department_code) {
          filter.staff = staff._id;
        }
      } else {
        // Staff viewing sees only assigned subjects
        filter.staff = staff._id;
      }
    } else {
      // Entry / Mark Attendance mode: only assigned subjects
      filter.staff = staff._id;
    }

    const subjectIds = await Timetable.distinct('subject', filter);
    const subjects = await Subject.find({ _id: { $in: subjectIds } })
      .select('_id subjectCode subjectName Category')
      .lean();

    const formatted = subjects.map((s) => {
      const subjectId = s._id ? s._id.toString() : '';
      return {
        _id: subjectId,
        id: subjectId,
        subjectCode: s.subjectCode,
        code: s.subjectCode,
        subjectName: s.subjectName,
        name: s.subjectName,
        Category: s.Category,
      };
    });
    return res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ---------- GET /api/staff/attendance/check ----------
router.get('/check', async (req, res) => {
  try {
    await connectDB();
    const staff = await getStaffInfo(req);
    if (!staff) return res.status(401).json({ success: false, message: 'User/Staff not found' });

    const { date, department, year, subjectId, period } = req.query;
    if (!date || !department || !year || !period) {
      return res.status(400).json({ success: false, message: 'Missing required query params' });
    }

    const dateRange = getNormalizedDateRange(date);
    if (!dateRange) {
      return res.status(400).json({ success: false, message: 'Invalid date' });
    }

    const attendance = await Attendance.findOne({
      date: { $gte: dateRange.start, $lte: dateRange.end },
      department: department.toUpperCase(),
      year: parseInt(year),
      period: parseInt(period),
    })
      .populate('staff', 'staff_id first_name last_name prefix')
      .populate('subject', 'subjectName subjectCode Category')
      .lean();

    if (attendance) {
      const studentIds = (attendance.students || []).map(s => s.student_id).filter(Boolean);
      const studentDocs = await Student.find({
        $or: [
          { student_id: { $in: studentIds } },
          { register_no: { $in: studentIds } },
          { roll_no: { $in: studentIds } },
        ],
      })
        .select('student_id register_no roll_no first_name middle_name last_name name')
        .lean();

      const studentMap = {};
      studentDocs.forEach(s => {
        const fullName = `${s.first_name || ''} ${s.middle_name || ''} ${s.last_name || ''}`.trim() || s.name || 'Student';
        if (s.student_id) studentMap[String(s.student_id)] = { ...s, fullName };
        if (s.register_no) studentMap[String(s.register_no)] = { ...s, fullName };
        if (s.roll_no) studentMap[String(s.roll_no)] = { ...s, fullName };
      });

      const enrichedStudents = (attendance.students || []).map(s => {
        const doc = studentMap[String(s.student_id)] || {};
        return {
          student_id: s.student_id,
          register_no: doc.register_no || s.student_id,
          roll_no: doc.roll_no || '',
          name: doc.fullName || doc.name || `Student ${s.student_id}`,
          status: s.status || 'Present',
        };
      });

      const isOwner = String(attendance.staff?._id || attendance.staff) === String(staff._id);
      return res.status(200).json({
        success: true,
        attendanceExists: true,
        attendance: {
          ...attendance,
          students: enrichedStudents,
          isOwner,
          canEdit: isOwner,
          canDelete: isOwner,
        },
      });
    } else {
      return res.status(200).json({
        success: true,
        attendanceExists: false,
      });
    }
  } catch (error) {
    console.error('Error checking attendance:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ---------- GET /api/staff/attendance/students ----------
router.get('/students', async (req, res) => {
  try {
    await connectDB();
    const staff = await getStaffInfo(req);
    if (!staff) return res.status(401).json({ success: false, message: 'User/Staff not found' });

    let { timetableId, date, department, year, subjectId, period } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }
    if (!department || !year || !period) {
      return res.status(400).json({ success: false, message: 'Missing department, year, or period' });
    }

    const selectedPeriodNum = parseInt(period);
    const selectedDate = new Date(`${date}T00:00:00`);
    const selectedDay = selectedDate.getDay() === 0 ? 7 : selectedDate.getDay();

    let timetable = null;
    if (timetableId) {
      timetable = await Timetable.findById(timetableId).populate('subject staff').lean();
    } else if (subjectId) {
      timetable = await Timetable.findOne({
        department: department.toUpperCase(),
        year: parseInt(year),
        subject: subjectId,
        period: selectedPeriodNum,
        day: selectedDay,
      }).populate('subject staff').lean();

      if (!timetable) {
        timetable = await Timetable.findOne({
          department: department.toUpperCase(),
          year: parseInt(year),
          subject: subjectId,
        }).populate('subject staff').lean();
      }
    }

    const role = (staff.role || staff.userRole || req.user.role || 'Staff').toLowerCase();
    if (role !== 'admin' && role !== 'hod') {
      const isAssigned = await Timetable.exists({
        department: department.toUpperCase(),
        year: parseInt(year),
        ...(subjectId ? { subject: subjectId } : {}),
        staff: staff._id,
      });

      if (!isAssigned) {
        return res.status(403).json({ success: false, message: 'You are only authorized to mark attendance for your assigned subjects.' });
      }
    }

    const targetDept = (timetable?.department || department).toUpperCase();
    const targetYear = parseInt(timetable?.year || year);

    const studentSemesterQuery = {
      department_code: targetDept,
      year: targetYear,
      student_status: 'Active',
      admission_status: 'Admitted',
    };

    const studentSemesters = await Student.distinct('semester', studentSemesterQuery);
    const validSemesters = studentSemesters.filter((value) => value !== null && value !== undefined && value !== '');
    const semesterFilter = validSemesters.length > 0 ? { $in: validSemesters } : { $in: [timetable?.semester || 1].filter(Boolean) };

    const students = await Student.find({
      ...studentSemesterQuery,
      semester: semesterFilter,
    })
      .select({
        student_id: 1,
        register_no: 1,
        roll_no: 1,
        first_name: 1,
        middle_name: 1,
        last_name: 1,
        department_code: 1,
        year: 1,
        semester: 1,
        section: 1,
      })
      .sort({ roll_no: 1, student_id: 1 })
      .lean();

    const dateRange = getNormalizedDateRange(date);
    const existing = await Attendance.findOne({
      date: dateRange ? { $gte: dateRange.start, $lte: dateRange.end } : selectedDate,
      department: targetDept,
      year: targetYear,
      period: selectedPeriodNum,
    }).lean();

    const attendanceMap = new Map();
    if (existing) {
      for (const item of existing.students) {
        attendanceMap.set(item.student_id, item.status);
      }
    }

    const formattedStudents = students.map((s) => ({
      student_id: s.student_id,
      register_no: s.register_no || '',
      roll_no: s.roll_no || '',
      name: `${s.first_name || ''} ${s.middle_name || ''} ${s.last_name || ''}`.trim(),
      year: s.year,
      section: s.section || '',
      status: attendanceMap.get(s.student_id) || 'Present',
    }));

    return res.status(200).json({
      success: true,
      data: {
        timetable: {
          timetableId: timetable?._id || null,
          academicYear: timetable?.academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
          department: targetDept,
          year: targetYear,
          sem: students[0]?.semester || timetable?.semester || 1,
          period: selectedPeriodNum,
          subject: timetable?.subject || null,
        },
        attendanceSubmitted: !!existing,
        existingAttendanceId: existing?._id || null,
        students: formattedStudents,
      },
    });
  } catch (error) {
    console.error('Error getting students:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ---------- POST /api/staff/attendance ----------
router.post('/', async (req, res) => {
  try {
    await connectDB();
    const staff = await getStaffInfo(req);
    if (!staff) return res.status(401).json({ success: false, message: 'User/Staff not found' });

    const { date, department, year, subjectId, period, students } = req.body;

    if (!date || !department || !year || !subjectId || !period || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const selectedPeriodNum = parseInt(period);
    const dateRange = getNormalizedDateRange(date);
    if (!dateRange) {
      return res.status(400).json({ success: false, message: 'Invalid date' });
    }

    const attendanceDate = dateRange.exactDate;
    const jsDay = new Date(date).getDay();
    const selectedDay = jsDay === 0 ? 7 : jsDay;

    let timetable = await Timetable.findOne({
      department: department.toUpperCase(),
      year: parseInt(year),
      subject: subjectId,
      period: selectedPeriodNum,
      day: selectedDay,
    }).populate('subject staff').lean();

    if (!timetable) {
      timetable = await Timetable.findOne({
        department: department.toUpperCase(),
        year: parseInt(year),
        subject: subjectId,
      }).populate('subject staff').lean();
    }

    const role = (staff.role || staff.userRole || req.user.role || 'Staff').toLowerCase();
    if (role !== 'admin' && role !== 'hod') {
      const isAssigned = await Timetable.exists({
        department: department.toUpperCase(),
        year: parseInt(year),
        subject: subjectId,
        staff: staff._id,
      });

      if (!isAssigned) {
        return res.status(403).json({ success: false, message: 'You are only authorized to mark attendance for your assigned subjects.' });
      }
    }

    const timetableDay = selectedDay;

    const studentSemesterQuery = {
      department_code: department.toUpperCase(),
      year: parseInt(year),
      student_status: 'Active',
      admission_status: 'Admitted',
    };

    const studentSemesters = await Student.distinct('semester', studentSemesterQuery);
    const validSemesters = studentSemesters.filter((value) => value !== null && value !== undefined && value !== '');
    const semesterFilter = validSemesters.length > 0 ? { $in: validSemesters } : { $in: [timetable?.semester || 1].filter(Boolean) };

    const validStudents = await Student.find({
      ...studentSemesterQuery,
      semester: semesterFilter,
    })
      .select('student_id semester')
      .lean();

    if (validStudents.length === 0) {
      return res.status(404).json({ success: false, message: 'No active students found for this class.' });
    }

    const validIds = new Set(validStudents.map(s => s.student_id));

    const semesterCount = {};
    for (const s of validStudents) {
      const sem = Number(s.semester);
      semesterCount[sem] = (semesterCount[sem] || 0) + 1;
    }
    const majoritySemester = Number(Object.entries(semesterCount).sort((a,b) => b[1]-a[1])[0][0]);

    const attendanceStudents = [];
    const submittedIds = new Set();
    for (const item of students) {
      if (!item.student_id || !validIds.has(item.student_id)) {
        return res.status(400).json({ success: false, message: `Invalid student ${item.student_id}` });
      }
      if (submittedIds.has(item.student_id)) {
        return res.status(400).json({ success: false, message: `Duplicate student ${item.student_id}` });
      }
      submittedIds.add(item.student_id);
      if (!['Present', 'Absent'].includes(item.status)) {
        return res.status(400).json({ success: false, message: `Invalid status for ${item.student_id}` });
      }
      attendanceStudents.push({ student_id: item.student_id, status: item.status });
    }

    // Check duplicate attendance for the selected period
    const existing = await Attendance.findOne({
      date: { $gte: dateRange.start, $lte: dateRange.end },
      department: department.toUpperCase(),
      year: parseInt(year),
      period: selectedPeriodNum,
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Attendance already submitted for Period ${selectedPeriodNum}.`,
      });
    }

    const attendance = await Attendance.create({
      date: attendanceDate,
      day: timetableDay,
      academicYear: timetable?.academicYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      department: department.toUpperCase(),
      year: parseInt(year),
      semester: majoritySemester || timetable?.semester || 1,
      period: selectedPeriodNum,
      timetable: timetable?._id || new mongoose.Types.ObjectId(),
      staff: staff._id,
      subject: subjectId || timetable?.subject?._id || null,
      students: attendanceStudents,
      submittedAt: new Date(),
    });

    const presentCount = attendanceStudents.filter(s => s.status === 'Present').length;
    const absentCount = attendanceStudents.filter(s => s.status === 'Absent').length;

    // Trigger low attendance alert in background for absent students
    const absentStudentIds = attendanceStudents
      .filter((s) => s.status === 'Absent')
      .map((s) => s.student_id);
    if (absentStudentIds.length > 0) {
      checkAndAlertLowAttendance(absentStudentIds, attendance.department, attendance.semester).catch((err) => {
        console.warn('[Attendance Alert] Background check error:', err.message);
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Attendance submitted successfully.',
      data: {
        attendanceId: attendance._id,
        date,
        day: timetableDay,
        academicYear: attendance.academicYear,
        department: attendance.department,
        year: attendance.year,
        semester: majoritySemester,
        period: selectedPeriodNum,
        timetableId: attendance.timetable,
        subjectId: attendance.subject,
        totalStudents: attendanceStudents.length,
        present: presentCount,
        absent: absentCount,
      }
    });
  } catch (error) {
    console.error('Error submitting attendance:', error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Attendance already submitted for this period.'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to submit attendance.',
      error: error.message,
    });
  }
});

// ---------- GET /api/staff/attendance (list, with pagination & role filtering) ----------
router.get('/', async (req, res) => {
  try {
    await connectDB();
    const staff = await getStaffInfo(req);
    if (!staff) return res.status(401).json({ success: false, message: 'User/Staff not found' });

    const role = (staff.role || staff.userRole || req.user.role || 'Staff').toLowerCase();
    let { dateFrom, dateTo, department, year, semester, period, subject, page = 1, limit = 20 } = req.query;
    const filter = {};

    // By default, only get today's attendance if no date is specified
    if (!dateFrom && !dateTo) {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      dateFrom = `${y}-${m}-${d}`;
      dateTo = `${y}-${m}-${d}`;
    }

    if (role === 'admin') {
      // Admin can view all attendance across all departments
      if (department) filter.department = department.toUpperCase();
    } else if (role === 'hod') {
      // HOD can view all attendance in HOD's department, or attendance submitted by HOD
      if (department) {
        const normalizedDept = department.toUpperCase();
        if (normalizedDept === staff.department_code) {
          filter.department = normalizedDept;
        } else {
          // If HOD filters by another department, only show records taken by this HOD
          filter.department = normalizedDept;
          filter.staff = staff._id;
        }
      } else {
        filter.$or = [
          { department: staff.department_code },
          { staff: staff._id },
        ];
      }
    } else {
      // Staff can ONLY view their own attendance records
      filter.staff = staff._id;
      if (department) filter.department = department.toUpperCase();
    }

    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) {
        const fromRange = getNormalizedDateRange(dateFrom);
        filter.date.$gte = fromRange ? fromRange.start : new Date(`${dateFrom}T00:00:00.000Z`);
      }
      if (dateTo) {
        const toRange = getNormalizedDateRange(dateTo);
        filter.date.$lte = toRange ? toRange.end : new Date(`${dateTo}T23:59:59.999Z`);
      }
    }
    if (year) filter.year = parseInt(year);
    if (semester) filter.semester = parseInt(semester);
    if (period) filter.period = parseInt(period);
    if (subject) filter.subject = subject;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [attendanceRecords, total] = await Promise.all([
      Attendance.find(filter)
        .populate('staff', 'staff_id first_name last_name prefix')
        .populate('subject', 'subjectName subjectCode Category')
        .sort({ date: -1, period: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Attendance.countDocuments(filter),
    ]);

    const recordsWithStats = attendanceRecords.map(rec => {
      const present = rec.students.filter(s => s.status === 'Present').length;
      const absent = rec.students.filter(s => s.status === 'Absent').length;
      const isOwner = String(rec.staff?._id || rec.staff) === String(staff._id);
      return {
        ...rec,
        isOwner,
        canEdit: isOwner,
        canDelete: isOwner,
        presentCount: present,
        absentCount: absent,
        totalStudents: rec.students.length,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        attendance: recordsWithStats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching attendance list:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ---------- GET /api/staff/attendance/today-summary (For Admin & HOD Dashboards) ----------
router.get('/today-summary', async (req, res) => {
  try {
    await connectDB();
    const staff = await getStaffInfo(req);
    if (!staff) return res.status(401).json({ success: false, message: 'User/Staff not found' });

    const queryDateStr = req.query.date;

    let targetDate = new Date();
    if (queryDateStr) {
      const parsed = new Date(`${queryDateStr}T00:00:00`);
      if (!isNaN(parsed.getTime())) {
        targetDate = parsed;
      }
    }

    const yr = targetDate.getFullYear();
    const mo = targetDate.getMonth();
    const dt = targetDate.getDate();

    const startOfDay = new Date(yr, mo, dt, 0, 0, 0, 0);
    const endOfDay = new Date(yr, mo, dt, 23, 59, 59, 999);

    const formattedDate = `${yr}-${String(mo + 1).padStart(2, '0')}-${String(dt).padStart(2, '0')}`;

    // Query all attendance records for target day
    const records = await Attendance.find({
      date: { $gte: startOfDay, $lte: endOfDay },
    }).lean();

    // Query active departments
    const departments = await Department.find().sort({ code: 1 }).lean();

    // Global active counts for dashboard
    const [totalStudents, totalStaff] = await Promise.all([
      Student.countDocuments({ student_status: 'Active' }),
      Staff.countDocuments(),
    ]);

    let totalPresentOverall = 0;
    let totalAbsentOverall = 0;

    records.forEach(r => {
      (r.students || []).forEach(s => {
        if (s.status === 'Present') totalPresentOverall++;
        else if (s.status === 'Absent') totalAbsentOverall++;
      });
    });

    const totalMarkedOverall = totalPresentOverall + totalAbsentOverall;
    const overallPercentage = totalMarkedOverall > 0 ? parseFloat(((totalPresentOverall / totalMarkedOverall) * 100).toFixed(1)) : 0;

    // 1. Build Admin Matrix: Dept rows (AI&DS, CSE, IT, EEE, ECE, MECH...), P1..P7 cols
    const adminMatrix = departments.map(dept => {
      const deptCode = dept.code.toUpperCase();
      const periods = {};

      for (let p = 1; p <= 7; p++) {
        const matchingRecords = records.filter(r => r.department === deptCode && r.period === p);
        if (matchingRecords.length === 0) {
          periods[p] = { taken: false, absent: '-', present: 0, total: 0 };
        } else {
          let pAbsent = 0;
          let pPresent = 0;
          matchingRecords.forEach(r => {
            (r.students || []).forEach(s => {
              if (s.status === 'Absent') pAbsent++;
              else if (s.status === 'Present') pPresent++;
            });
          });
          periods[p] = {
            taken: true,
            absent: pAbsent,
            present: pPresent,
            total: pPresent + pAbsent,
          };
        }
      }

      return {
        departmentCode: deptCode,
        departmentName: dept.name,
        periods,
      };
    });

    // 2. Build HOD Matrix: For HOD's department, Year 1..4 rows, P1..P7 cols
    const hodDeptCode = (staff.department_code || '').toUpperCase();
    const hodMatrix = [1, 2, 3, 4].map(y => {
      const periods = {};

      for (let p = 1; p <= 7; p++) {
        const matchingRecords = records.filter(
          r => r.department === hodDeptCode && r.year === y && r.period === p
        );

        if (matchingRecords.length === 0) {
          periods[p] = { taken: false, absent: '-', present: 0, total: 0 };
        } else {
          let pAbsent = 0;
          let pPresent = 0;
          matchingRecords.forEach(r => {
            (r.students || []).forEach(s => {
              if (s.status === 'Absent') pAbsent++;
              else if (s.status === 'Present') pPresent++;
            });
          });
          periods[p] = {
            taken: true,
            absent: pAbsent,
            present: pPresent,
            total: pPresent + pAbsent,
          };
        }
      }

      return {
        year: y,
        yearLabel: `Year ${y}`,
        periods,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        date: formattedDate,
        totalStudents,
        totalStaff,
        overallPercentage,
        totalRecordsToday: records.length,
        adminMatrix,
        hodMatrix,
        department: hodDeptCode,
      },
    });
  } catch (error) {
    console.error('Error fetching today summary:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ---------- GET /api/staff/attendance/:id ----------
router.get('/:id', async (req, res) => {
  try {
    await connectDB();
    const staff = await getStaffInfo(req);
    if (!staff) return res.status(401).json({ success: false, message: 'User/Staff not found' });

    const role = (staff.role || staff.userRole || req.user.role || 'Staff').toLowerCase();
    const attendanceId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(attendanceId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }

    const attendance = await Attendance.findById(attendanceId)
      .populate('staff', 'staff_id first_name last_name prefix')
      .populate('subject', 'subjectName subjectCode Category')
      .populate('timetable', 'department year semester period day')
      .lean();

    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    const isOwner = String(attendance.staff?._id || attendance.staff) === String(staff._id);

    // Permission check to view:
    // Admin: can view any
    // HOD: can view in HOD's department or if owner
    // Staff: can view ONLY if owner
    let canView = false;
    if (role === 'admin') {
      canView = true;
    } else if (role === 'hod') {
      if (attendance.department === staff.department_code || isOwner) {
        canView = true;
      }
    } else if (isOwner) {
      canView = true;
    }

    if (!canView) {
      return res.status(403).json({ success: false, message: 'You are not authorized to view this attendance record.' });
    }

    // Enrich students array with student details from database
    const studentIds = (attendance.students || []).map(s => s.student_id).filter(Boolean);
    const studentDocs = await Student.find({
      $or: [
        { student_id: { $in: studentIds } },
        { register_no: { $in: studentIds } },
        { roll_no: { $in: studentIds } },
      ],
    })
      .select('student_id register_no roll_no first_name middle_name last_name name')
      .lean();

    const studentMap = {};
    studentDocs.forEach(s => {
      const fullName = `${s.first_name || ''} ${s.middle_name || ''} ${s.last_name || ''}`.trim() || s.name || 'Student';
      if (s.student_id) studentMap[String(s.student_id)] = { ...s, fullName };
      if (s.register_no) studentMap[String(s.register_no)] = { ...s, fullName };
      if (s.roll_no) studentMap[String(s.roll_no)] = { ...s, fullName };
    });

    const enrichedStudents = (attendance.students || []).map(s => {
      const doc = studentMap[String(s.student_id)] || {};
      return {
        student_id: s.student_id,
        register_no: doc.register_no || s.student_id,
        roll_no: doc.roll_no || '',
        name: doc.fullName || doc.name || s.name || s.student_id,
        status: s.status || 'Present',
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        ...attendance,
        students: enrichedStudents,
        isOwner,
        canEdit: isOwner,
        canDelete: isOwner,
      },
    });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ---------- PUT /api/staff/attendance/:id ----------
router.put('/:id', async (req, res) => {
  try {
    await connectDB();
    const staff = await getStaffInfo(req);
    if (!staff) return res.status(401).json({ success: false, message: 'User/Staff not found' });

    const attendanceId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(attendanceId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }

    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    const isOwner = String(attendance.staff) === String(staff._id);

    // ONLY the faculty who submitted this attendance can edit it
    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'You can only edit attendance records submitted by you.' });
    }

    const { students } = req.body;
    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ success: false, message: 'Student list is required' });
    }

    const currentStudentIds = new Set(attendance.students.map(s => s.student_id));
    const updatedStudents = [];
    for (const item of students) {
      if (!currentStudentIds.has(item.student_id)) {
        return res.status(400).json({ success: false, message: `Student ${item.student_id} is not part of this attendance` });
      }
      if (!['Present', 'Absent'].includes(item.status)) {
        return res.status(400).json({ success: false, message: `Invalid status for ${item.student_id}` });
      }
      updatedStudents.push({ student_id: item.student_id, status: item.status });
    }

    if (updatedStudents.length !== attendance.students.length) {
      return res.status(400).json({ success: false, message: 'You must provide status for all students' });
    }

    attendance.students = updatedStudents;
    await attendance.save();

    // Trigger low attendance alert in background for absent students
    const absentStudentIds = updatedStudents
      .filter((s) => s.status === 'Absent')
      .map((s) => s.student_id);
    if (absentStudentIds.length > 0) {
      checkAndAlertLowAttendance(absentStudentIds, attendance.department, attendance.semester).catch((err) => {
        console.warn('[Attendance Alert] Background check error on edit:', err.message);
      });
    }

    const updated = await Attendance.findById(attendanceId)
      .populate('staff', 'staff_id first_name last_name prefix')
      .populate('subject', 'subjectName subjectCode Category')
      .lean();

    return res.status(200).json({
      success: true,
      message: 'Attendance updated successfully',
      data: {
        ...updated,
        isOwner: true,
        canEdit: true,
        canDelete: true,
      },
    });
  } catch (error) {
    console.error('Error updating attendance:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ---------- DELETE /api/staff/attendance/:id ----------
router.delete('/:id', async (req, res) => {
  try {
    await connectDB();
    const staff = await getStaffInfo(req);
    if (!staff) return res.status(401).json({ success: false, message: 'User/Staff not found' });

    const attendanceId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(attendanceId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }

    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    const isOwner = String(attendance.staff) === String(staff._id);

    // ONLY the faculty who submitted this attendance can delete it
    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'You can only delete attendance records submitted by you.' });
    }

    await Attendance.deleteOne({ _id: attendanceId });
    return res.status(200).json({ success: true, message: 'Attendance record deleted successfully' });
  } catch (error) {
    console.error('Error deleting attendance:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ---------- Report endpoints ----------
router.get('/report', async (req, res) => {
  try {
    await connectDB();
    return res.status(200).json({
      success: true,
      data: {
        message: 'Available attendance report endpoints',
        reports: [
          {
            path: '/api/staff/attendance/report/subject',
            method: 'GET',
            description: 'Subject-wise attendance report. Query params: subjectId (required), department, dateFrom (YYYY-MM-DD), dateTo (YYYY-MM-DD)',
          },
        ],
      },
    });
  } catch (error) {
    console.error('Error fetching report index:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/report/subject', async (req, res) => {
  try {
    await connectDB();
    const staff = await getStaffInfo(req);
    if (!staff) return res.status(401).json({ success: false, message: 'User/Staff not found' });

    const role = (staff.role || staff.userRole || req.user.role || 'Staff').toLowerCase();
    const { subjectId, department, dateFrom, dateTo } = req.query;
    if (!subjectId) {
      return res.status(400).json({ success: false, message: 'Subject ID is required' });
    }

    const filter = { subject: subjectId };
    if (department) {
      filter.department = department.toUpperCase();
    }

    // Role-based filtering for report:
    // Admin: can view report across any department
    // HOD: can view report for subjects in HOD's department, or subjects taught by HOD
    // Staff: can ONLY view report for subjects taught by Staff
    if (role === 'admin') {
      // No staff restriction
    } else if (role === 'hod') {
      const isAssigned = await Timetable.exists({ staff: staff._id, subject: subjectId });
      const inDept = department ? department.toUpperCase() === staff.department_code : true;
      if (!isAssigned && !inDept) {
        filter.staff = staff._id;
      }
    } else {
      filter.staff = staff._id;
    }

    if (dateFrom) {
      filter.date = { $gte: new Date(`${dateFrom}T00:00:00`) };
    }
    if (dateTo) {
      if (!filter.date) filter.date = {};
      filter.date.$lte = new Date(`${dateTo}T23:59:59`);
    }

    const records = await Attendance.find(filter)
      .populate('subject', 'subjectCode subjectName Category')
      .populate('timetable', 'department year semester')
      .lean();

    if (records.length === 0) {
      const subjectDoc = await Subject.findById(subjectId).select('subjectCode subjectName Category').lean();
      return res.status(200).json({
        success: true,
        data: {
          subject: subjectDoc || null,
          records: [],
          totalStudents: 0,
          totalPeriods: 0,
        },
      });
    }

    const studentMap = new Map();
    records.forEach((record) => {
      record.students.forEach((student) => {
        const id = student.student_id;
        if (!studentMap.has(id)) {
          studentMap.set(id, { present: 0, absent: 0 });
        }
        const data = studentMap.get(id);
        if (student.status === 'Present') data.present++;
        else if (student.status === 'Absent') data.absent++;
      });
    });

    const studentIds = Array.from(studentMap.keys());
    const studentDetails = await Student.find({ student_id: { $in: studentIds } })
      .select('student_id register_no roll_no first_name last_name department_code semester')
      .lean();

    const detailsMap = new Map();
    studentDetails.forEach((s) => {
      const name = `${s.first_name || ''} ${s.last_name || ''}`.trim();
      detailsMap.set(s.student_id, {
        register_no: s.register_no || '',
        roll_no: s.roll_no || '',
        name: name,
        department_code: s.department_code || '',
        semester: s.semester || '',
      });
    });

    const result = Array.from(studentMap.entries()).map(([id, data]) => {
      const detail = detailsMap.get(id) || {};
      const total = data.present + data.absent;
      const percentage = total > 0 ? (data.present / total) * 100 : 0;
      return {
        student_id: id,
        register_no: detail.register_no || '',
        roll_no: detail.roll_no || '',
        name: detail.name || '',
        department_code: detail.department_code || '',
        semester: detail.semester || '',
        total_periods: total,
        present: data.present,
        absent: data.absent,
        percentage: parseFloat(percentage.toFixed(2)),
      };
    });

    result.sort((a, b) => {
      const aNum = parseInt(a.roll_no) || parseInt(a.register_no) || 0;
      const bNum = parseInt(b.roll_no) || parseInt(b.register_no) || 0;
      return aNum - bNum;
    });

    return res.status(200).json({
      success: true,
      data: {
        subject: records[0].subject,
        records: result,
        totalStudents: result.length,
        totalPeriods: records.length,
      },
    });
  } catch (error) {
    console.error('Error generating subject report:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error.message,
    });
  }
});

module.exports = router;