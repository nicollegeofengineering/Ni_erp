const express = require('express');
const router = express.Router();
const connectDB = require('../../config/db');
const Staff = require('../../models/Staff');
const User = require('../../models/User');
const Timetable = require('../../models/Timetable');
const Subject = require('../../models/Subject');
const Student = require('../../models/Student');
const Attendance = require('../../models/Attendance');
const mongoose = require('mongoose');

// ---------- Helper: format staff full name ----------
const getStaffFullName = (staff) => {
  if (!staff) return null;
  const { prefix = '', first_name = '', last_name = '' } = staff;
  return `${prefix} ${first_name} ${last_name}`.trim().replace(/\s+/g, ' ');
};

// ---------- Helper: resolve timetable and authorize (owner only) ----------
//const resolveTimetableAndAuthorize = async (department, year, subjectId, period, staffId) => {
  //const timetable = await Timetable.findOne({
    //department: department.toUpperCase(),
    //year: parseInt(year),
    //subject: subjectId,
    //period: parseInt(period)
  //}).populate('staff').lean();

  //if (!timetable) throw new Error('Timetable entry not found');

  //const isOwner = timetable.staff && timetable.staff._id.toString() === staffId.toString();
  //if (!isOwner) throw new Error('Staff not authorized for this class');

  //return timetable;
//};

// ---------- GET /api/staff/attendance/classes ----------
router.get('/classes', async (req, res) => {
  try {
    await connectDB();
    const { role } = req.user;
    if (!['Staff', 'Hod', 'Admin'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const staff = await Staff.findOne({ staff_id: user.username }).lean();
    if (!staff && role !== 'Admin') {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    const matchFilter = {};
    if (role === 'Staff') {
      // Only owner timetables
      const ownerTimetableIds = await Timetable.find({ staff: staff._id }).distinct('_id');
      if (ownerTimetableIds.length > 0) {
        matchFilter._id = { $in: ownerTimetableIds };
      } else {
        return res.status(200).json({ success: true, data: [] });
      }
    } else if (role === 'Hod' && staff?.department) {
      matchFilter.department = staff.department;
    }

    const classes = await Timetable.aggregate([
      { $match: matchFilter },
      { $group: { _id: { department: '$department', year: '$year' } } },
      { $project: { _id: 0, department: '$_id.department', year: '$_id.year' } }
    ]).sort({ department: 1, year: 1 });

    return res.status(200).json({ success: true, data: classes });
  } catch (error) {
    console.error('Error fetching classes:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ---------- GET /api/staff/attendance/subjects (merged) ----------
router.get('/subjects', async (req, res) => {
  try {
    await connectDB();
    const { role } = req.user;
    if (!['Staff', 'Hod', 'Admin'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { department, year } = req.query;
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const staff = await Staff.findOne({ staff_id: user.username }).lean();
    if (!staff && role !== 'Admin') {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    const filter = {};
    if (role === 'Staff') {
      const ownerTimetableIds = await Timetable.find({ staff: staff._id }).distinct('_id');
      if (ownerTimetableIds.length > 0) {
        filter._id = { $in: ownerTimetableIds };
      } else {
        return res.status(200).json({ success: true, data: [] });
      }
    } else if (role === 'Hod' && staff?.department) {
      filter.department = staff.department;
    }
    if (department) filter.department = department.toUpperCase();
    if (year) filter.year = parseInt(year);

    const subjectIds = await Timetable.distinct('subject', filter);
    const subjects = await Subject.find({ _id: { $in: subjectIds } })
      .select('_id subjectCode subjectName')
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
    const { role } = req.user;
    if (!['Staff', 'Hod', 'Admin'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { date, department, year, subjectId, period } = req.query;
    if (!date || !department || !year || !subjectId || !period) {
      return res.status(400).json({ success: false, message: 'Missing required query params' });
    }

    const attendanceDate = new Date(`${date}T00:00:00`);
    if (isNaN(attendanceDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date' });
    }

    const timetableDay = attendanceDate.getDay() === 0 ? 7 : attendanceDate.getDay();
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const staff = await Staff.findOne({ staff_id: user.username }).lean();
    if (!staff && role !== 'Admin') {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

   

    const attendance = await Attendance.findOne({
      date: attendanceDate,
      department: department.toUpperCase(),
      year: parseInt(year),
      period: parseInt(period),
      day: timetableDay,
    })
      .populate('students.student_id', 'roll_no first_name last_name')
      .lean();

    if (attendance) {
      return res.status(200).json({
        success: true,
        attendanceExists: true,
        attendance
      });
    } else {
      return res.status(200).json({
        success: true,
        attendanceExists: false
      });
    }
  } catch (error) {
    console.error('Error checking attendance:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ---------- GET /api/staff/attendance/students (modified to accept dept/year/subject/period) ----------
router.get('/students', async (req, res) => {
  try {
    await connectDB();
    const { role } = req.user;
    if (!['Staff', 'Hod', 'Admin'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    let { timetableId, date, department, year, subjectId, period } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }

    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const staff = await Staff.findOne({ staff_id: user.username }).lean();
    if (!staff && role !== 'Admin') {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    let timetable;
    const selectedDate = new Date(`${date}T00:00:00`);
    const selectedDay = selectedDate.getDay() === 0 ? 7 : selectedDate.getDay();

    if (timetableId) {
      // Legacy support
      timetable = await Timetable.findById(timetableId).populate('subject staff').lean();
      if (!timetable) {
        return res.status(404).json({ success: false, message: 'Timetable not found' });
      }

      if (timetable.day && timetable.day !== selectedDay) {
        return res.status(400).json({ success: false, message: 'Selected date does not match this timetable period.' });
      }

      const timetableStaffId = timetable.staff && typeof timetable.staff === 'object'
        ? timetable.staff._id
        : timetable.staff;

      if (timetableStaffId && timetableStaffId.toString() !== staff._id.toString() && role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'You are not authorized for this period' });
      }
    } else {
      if (!department || !year || !subjectId || !period) {
        return res.status(400).json({ success: false, message: 'Missing department, year, subjectId, or period' });
      }

      timetable = await Timetable.findOne({
        department: department.toUpperCase(),
        year: parseInt(year),
        subject: subjectId
      }).populate('subject staff').lean();

      if (!timetable) {
        return res.status(404).json({ success: false, message: 'Timetable entry not found for the selected day' });
      }

      const timetableStaffId = timetable.staff && typeof timetable.staff === 'object'
        ? timetable.staff._id
        : timetable.staff;

      if (timetableStaffId && timetableStaffId.toString() !== staff._id.toString() && role !== 'Admin') {
        return res.status(403).json({ success: false, message: 'Staff not authorized for this class' });
      }
    }

    const studentSemesterQuery = {
      department_code: timetable.department,
      year: timetable.year,
      student_status: 'Active',
      admission_status: 'Admitted',
    };

    const studentSemesters = await Student.distinct('semester', studentSemesterQuery);
    const validSemesters = studentSemesters.filter((value) => value !== null && value !== undefined && value !== '');
    const semesterFilter = validSemesters.length > 0 ? { $in: validSemesters } : { $in: [timetable.semester].filter(Boolean) };

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

    const existing = await Attendance.findOne({
      date: selectedDate,
      department: timetable.department,
      year: timetable.year,
      subject: timetable.subject?._id || null,
      period: timetable.period,
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
          timetableId: timetable._id,
          academicYear: timetable.academicYear,
          department: timetable.department,
          year: timetable.year,
          sem: students[0]?.semester,
          period: timetable.period,
          subject: timetable.subject,
        },
        attendanceSubmitted: !!existing,
        students: formattedStudents,
      },
    });
  } catch (error) {
    console.error('Error getting students:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ---------- POST /api/staff/attendance (updated to accept dept/year/subject/period) ----------
router.post('/', async (req, res) => {
  try {
    await connectDB();
    const { role } = req.user;
    if (!['Staff', 'Hod', 'Admin'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { date, department, year, subjectId, period, students } = req.body;

    if (!date || !department || !year || !subjectId || !period || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const staff = await Staff.findOne({ staff_id: user.username }).lean();
    if (!staff && role !== 'Admin') {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    const attendanceDate = new Date(`${date}T00:00:00`);
    if (isNaN(attendanceDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date' });
    }

    const jsDay = attendanceDate.getDay();
    const selectedDay = jsDay === 0 ? 7 : jsDay;

    const timetable = await Timetable.findOne({
      department: department.toUpperCase(),
      year: parseInt(year),
      subject: subjectId
    }).populate('subject staff').lean();

    if (!timetable) {
      return res.status(404).json({ success: false, message: 'Timetable entry not found for the selected date and period' });
    }

    const timetableStaffId = timetable.staff && typeof timetable.staff === 'object'
      ? timetable.staff._id
      : timetable.staff;

    if (timetableStaffId && timetableStaffId.toString() !== staff._id.toString() && role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Staff not authorized for this class' });
    }

    const timetableDay = selectedDay;
    

    const studentSemesterQuery = {
      department_code: timetable.department,
      year: timetable.year,
      student_status: 'Active',
      admission_status: 'Admitted',
    };

    const studentSemesters = await Student.distinct('semester', studentSemesterQuery);
    const validSemesters = studentSemesters.filter((value) => value !== null && value !== undefined && value !== '');
    const semesterFilter = validSemesters.length > 0 ? { $in: validSemesters } : { $in: [timetable.semester].filter(Boolean) };

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

    // Check duplicate attendance
    const existing = await Attendance.findOne({
      date: attendanceDate,
      academicYear: timetable.academicYear,
      department: timetable.department,
      year: timetable.year,
      period: timetable.period,
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Attendance already submitted for this period.'
      });
    }

    const attendance = await Attendance.create({
      date: attendanceDate,
      day: timetableDay,
      academicYear: timetable.academicYear,
      department: timetable.department,
      year: timetable.year,
      semester: majoritySemester,
      period: timetable.period,
      timetable: timetable._id,
      staff: staff._id,
      subject: timetable.subject?._id || null,
      students: attendanceStudents,
      submittedAt: new Date(),
    });

    const presentCount = attendanceStudents.filter(s => s.status === 'Present').length;
    const absentCount = attendanceStudents.filter(s => s.status === 'Absent').length;

    return res.status(201).json({
      success: true,
      message: 'Attendance submitted successfully.',
      data: {
        attendanceId: attendance._id,
        date,
        day: timetableDay,
        academicYear: timetable.academicYear,
        department: timetable.department,
        year: timetable.year,
        semester: majoritySemester,
        period: timetable.period,
        timetableId: timetable._id,
        subjectId: timetable.subject?._id || null,
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

// ---------- GET /api/staff/attendance (list, with pagination) ----------
router.get('/', async (req, res) => {
  try {
    await connectDB();
    const { role } = req.user;
    if (!['Staff', 'Hod', 'Admin'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const staff = await Staff.findOne({ staff_id: user.username }).lean();
    if (!staff && role !== 'Admin') {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    const { dateFrom, dateTo, department, year, semester, period, subject, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (role === 'Staff') {
      filter.staff = staff._id;
    } else if (role === 'Hod' && staff?.department) {
      filter.department = staff.department;
    }

    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(`${dateFrom}T00:00:00`);
      if (dateTo) filter.date.$lte = new Date(`${dateTo}T23:59:59`);
    }
    if (department) filter.department = department.toUpperCase();
    if (year) filter.year = parseInt(year);
    if (semester) filter.semester = parseInt(semester);
    if (period) filter.period = parseInt(period);
    if (subject) filter.subject = subject;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [attendanceRecords, total] = await Promise.all([
      Attendance.find(filter)
        .populate('staff', 'staff_id first_name last_name')
        .populate('subject', 'subjectName subjectCode')
        .sort({ date: -1, period: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Attendance.countDocuments(filter)
    ]);

    const recordsWithStats = attendanceRecords.map(rec => {
      const present = rec.students.filter(s => s.status === 'Present').length;
      const absent = rec.students.filter(s => s.status === 'Absent').length;
      return { ...rec, presentCount: present, absentCount: absent, totalStudents: rec.students.length };
    });

    return res.status(200).json({
      success: true,
      data: {
        attendance: recordsWithStats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching attendance list:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ---------- GET /api/staff/attendance/:id ----------
router.get('/:id', async (req, res) => {
  try {
    await connectDB();
    const { role } = req.user;
    if (!['Staff', 'Hod', 'Admin'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const attendanceId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(attendanceId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }

    const attendance = await Attendance.findById(attendanceId)
      .populate('staff', 'staff_id first_name last_name')
      .populate('subject', 'subjectName subjectCode')
      .populate('timetable', 'department year semester period day')
      .lean();

    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const staff = await Staff.findOne({ staff_id: user.username }).lean();
    if (!staff && role !== 'Admin') {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    if (role === 'Staff' && attendance.staff._id.toString() !== staff._id.toString()) {
      return res.status(403).json({ success: false, message: 'You are not authorized to view this attendance' });
    }
    if (role === 'Hod' && staff.department && attendance.department !== staff.department) {
      return res.status(403).json({ success: false, message: 'You can only view your department\'s attendance' });
    }

    return res.status(200).json({ success: true, data: attendance });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ---------- PUT /api/staff/attendance/:id ----------
router.put('/:id', async (req, res) => {
  try {
    await connectDB();
    const { role } = req.user;
    if (!['Staff', 'Hod', 'Admin'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const attendanceId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(attendanceId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }

    const { students } = req.body;
    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ success: false, message: 'Student list is required' });
    }

    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const staff = await Staff.findOne({ staff_id: user.username }).lean();
    if (!staff && role !== 'Admin') {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    let isAuthorized = false;
    if (role === 'Admin') isAuthorized = true;
    else if (role === 'Hod' && staff.department && attendance.department === staff.department) isAuthorized = true;
    else if (role === 'Staff' && attendance.staff.toString() === staff._id.toString()) isAuthorized = true;

    if (!isAuthorized) {
      return res.status(403).json({ success: false, message: 'You are not authorized to edit this attendance' });
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

    const updated = await Attendance.findById(attendanceId)
      .populate('staff', 'staff_id first_name last_name')
      .populate('subject', 'subjectName subjectCode')
      .lean();

    return res.status(200).json({
      success: true,
      message: 'Attendance updated successfully',
      data: updated
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
    const { role } = req.user;
    if (!['Hod', 'Admin'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const attendanceId = req.params.id;
    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const staff = await Staff.findOne({ staff_id: user.username }).lean();
    if (!staff && role !== 'Admin') {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    let isAuthorized = false;
    if (role === 'Admin') isAuthorized = true;
    else if (role === 'Hod' && staff.department && attendance.department === staff.department) isAuthorized = true;
    else if (role === 'Staff' && attendance.staff.toString() === staff._id.toString()) isAuthorized = true;

    if (!isAuthorized) {
      return res.status(403).json({ success: false, message: 'You are not authorized to delete this attendance' });
    }

    await Attendance.deleteOne({ _id: attendanceId });
    return res.status(200).json({ success: true, message: 'Attendance record deleted successfully' });
  } catch (error) {
    console.error('Error deleting attendance:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ---------- Report endpoints (kept from original) ----------
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
            description: 'Subject-wise attendance report. Query params: subjectId (required), dateFrom (YYYY-MM-DD), dateTo (YYYY-MM-DD)'
          }
        ]
      }
    });
  } catch (error) {
    console.error('Error fetching report index:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/report/subject', async (req, res) => {
  try {
    await connectDB();
    const { role } = req.user;
    if (!['Staff', 'Hod', 'Admin'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { subjectId, dateFrom, dateTo } = req.query;
    if (!subjectId) {
      return res.status(400).json({ success: false, message: 'Subject ID is required' });
    }

    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const staff = await Staff.findOne({ staff_id: user.username }).lean();
    if (!staff && role !== 'Admin') {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    const filter = { subject: subjectId };
    if (role === 'Staff') {
      filter.staff = staff._id;
    } else if (role === 'Hod' && staff?.department) {
      filter.department = staff.department;
    }

    if (dateFrom) {
      filter.date = { $gte: new Date(`${dateFrom}T00:00:00`) };
    }
    if (dateTo) {
      if (!filter.date) filter.date = {};
      filter.date.$lte = new Date(`${dateTo}T23:59:59`);
    }

    const records = await Attendance.find(filter)
      .populate('subject', 'subjectCode subjectName')
      .populate('timetable', 'department year semester')
      .lean();

    if (records.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          subject: null,
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