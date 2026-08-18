// routes/staff/attendance.js (or similar)
const express = require('express');
const router = express.Router();
const connectDB = require('../../config/db');
const Staff = require('../../models/Staff');
const User = require("../../models/User");
const Timetable = require('../../models/Timetable');
const Subject = require('../../models/Subject');
const Student = require('../../models/Student');
const Attendance = require('../../models/Attendance');
const mongoose = require('mongoose');

// GET /api/staff/attendance/periods?date=2026-08-17
router.get('/periods', async (req, res) => {
  try {
    await connectDB();
    const { role } = req.user;
    if (!['Staff', 'Hod','Admin'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'Date is required' });
    }

    const selectedDate = new Date(`${date}T00:00:00`);
    if (isNaN(selectedDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date' });
    }

    // Convert JS day (0=Sunday) to timetable day (1=Monday..7=Sunday)
    const jsDay = selectedDate.getDay();
    const timetableDay = jsDay === 0 ? 7 : jsDay;

    // Get logged-in staff
    
    const user = await User.findOne({ _id:req.user.id }).lean();
    console.log(user)
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const staff=await Staff.findOne({staff_id:user.username}).lean();

    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }


    // Fetch timetable periods for this staff on that day
    const periods = await Timetable.find({
      staff: staff._id,
      day: timetableDay,
    })
      .populate('subject', 'subjectName subjectCode')
      .populate('hall', 'hallNo')
      .sort({ period: 1 })
      .lean();

    const formatted = periods.map((item) => ({
      timetableId: item._id,
      academicYear: item.academicYear,
      department: item.department,
      year: item.year,
      semester: item.semester,
      day: item.day,
      period: item.period,
      subject: item.subject
        ? { id: item.subject._id, name: item.subject.subjectName, code: item.subject.subjectCode }
        : null,
      hall: item.hall ? { id: item.hall._id, hallNo: item.hall.hallNo } : null,
    }));

    return res.status(200).json({
      success: true,
      data: { date, day: timetableDay, periods: formatted },
    });
  } catch (error) {
    console.error('Error getting periods:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
});

// GET /api/staff/attendance/students?timetableId=...&date=2026-08-17
router.get('/students', async (req, res) => {
  try {
    await connectDB();
    const { role } = req.user;
    if (!['Staff', 'Hod','Admin'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { timetableId, date } = req.query;
    if (!timetableId || !date) {
      return res.status(400).json({ success: false, message: 'Timetable ID and date are required' });
    }

    const timetable = await Timetable.findById(timetableId)
      .populate('subject', 'subjectName subjectCode')
      .lean();
    if (!timetable) {
      return res.status(404).json({ success: false, message: 'Timetable period not found' });
    }

    // Verify staff owns this period
    const user = await User.findOne({ _id:req.user.id }).lean();
    console.log(user)
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const staff=await Staff.findOne({staff_id:user.username}).lean();

    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    if (timetable.staff && timetable.staff.toString() !== staff._id.toString()) {
      return res.status(403).json({ success: false, message: 'This period is not assigned to you' });
    }

    // Map timetable semester (1/2) to absolute student semester
    const studentSemester = timetable.semester === 1 ? timetable.year * 2 - 1 : timetable.year * 2;

    // Fetch active students
    const students = await Student.find({
      department_code: timetable.department,
      year: timetable.year,
      student_status: 'Active',
      admission_status: 'Admitted',
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
        photo_file_id: 1,
        photo_version: 1,
      })
      .sort({ roll_no: 1, student_id: 1 })
      .lean();

    // Check if attendance already exists for this period/date
    const selectedDate = new Date(`${date}T00:00:00`);
    const existing = await Attendance.findOne({
      date: selectedDate,
      department: timetable.department,
      year: timetable.year,
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
      status: attendanceMap.get(s.student_id) || 'Present', // default Present
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
    return res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
});

// POST /api/staff/attendance
router.post('/', async (req, res) => {
  try {
    await connectDB();

    // --------------------------------------------------
    // 1. CHECK USER ROLE
    // --------------------------------------------------
    const { role } = req.user;

    if (!['Staff', 'Hod', 'Admin'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // --------------------------------------------------
    // 2. GET REQUEST DATA
    // --------------------------------------------------
    const { timetableId, date, students } = req.body;

    if (
      !timetableId ||
      !date ||
      !Array.isArray(students) ||
      students.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    // --------------------------------------------------
    // 3. FETCH TIMETABLE
    // --------------------------------------------------
    const timetable = await Timetable.findById(timetableId)
      .populate('subject')
      .lean();

    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: 'Timetable not found',
      });
    }

    // --------------------------------------------------
    // 4. FETCH LOGGED-IN USER
    // --------------------------------------------------
    const user = await User.findById(req.user.id).lean();

    console.log('Logged-in user:', user);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // --------------------------------------------------
    // 5. FETCH STAFF
    // --------------------------------------------------
    const staff = await Staff.findOne({
      staff_id: user.username,
    }).lean();

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found',
      });
    }

    // --------------------------------------------------
    // 6. SECURITY:
    //    STAFF MUST OWN THIS TIMETABLE PERIOD
    // --------------------------------------------------
    if (
      !timetable.staff ||
      timetable.staff.toString() !== staff._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this timetable period',
      });
    }

    // --------------------------------------------------
    // 7. VALIDATE ATTENDANCE DATE
    // --------------------------------------------------
    const attendanceDate = new Date(`${date}T00:00:00`);

    if (isNaN(attendanceDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid attendance date',
      });
    }

    // JavaScript:
    // Sunday = 0
    // Monday = 1
    // ...
    // Saturday = 6

    const jsDay = attendanceDate.getDay();

    const timetableDay = jsDay === 0 ? 7 : jsDay;

    if (timetable.day !== timetableDay) {
      return res.status(400).json({
        success: false,
        message:
          'Selected date does not match this timetable period.',
      });
    }

    // --------------------------------------------------
    // 8. CALCULATE EXPECTED SEMESTER
    // --------------------------------------------------
    const expectedSemester =
      timetable.semester === 1
        ? timetable.year * 2 - 1
        : timetable.year * 2;

    // Example:
    //
    // Year 1 + ODD  = Semester 1
    // Year 1 + EVEN = Semester 2
    // Year 2 + ODD  = Semester 3
    // Year 2 + EVEN = Semester 4
    // Year 3 + ODD  = Semester 5
    // Year 3 + EVEN = Semester 6
    // Year 4 + ODD  = Semester 7
    // Year 4 + EVEN = Semester 8

    // --------------------------------------------------
    // 9. GET VALID ACTIVE STUDENTS
    // --------------------------------------------------
    const validStudents = await Student.find({
      department_code: timetable.department,
      year: timetable.year,
      semester: expectedSemester,
      student_status: 'Active',
      admission_status: 'Admitted',
    })
      .select('student_id semester')
      .lean();

    if (validStudents.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active students found for this class.',
      });
    }

    // --------------------------------------------------
    // 10. CREATE VALID STUDENT ID SET
    // --------------------------------------------------
    const validIds = new Set(
      validStudents.map((student) => student.student_id)
    );

    // --------------------------------------------------
    // 11. FIND MAJORITY SEMESTER
    // --------------------------------------------------
    const semesterCount = {};

    for (const student of validStudents) {
      const semester = Number(student.semester);

      if (!semesterCount[semester]) {
        semesterCount[semester] = 0;
      }

      semesterCount[semester]++;
    }

    const semesterEntries = Object.entries(semesterCount);

    if (semesterEntries.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Unable to determine student semester.',
      });
    }

    const majoritySemester = Number(
      semesterEntries.sort((a, b) => b[1] - a[1])[0][0]
    );

    console.log('Semester distribution:', semesterCount);
    console.log('Majority semester:', majoritySemester);

    // --------------------------------------------------
    // 12. VALIDATE SUBMITTED STUDENTS
    // --------------------------------------------------
    const attendanceStudents = [];

    // Used to detect duplicate students
    const submittedIds = new Set();

    for (const item of students) {
      // -----------------------------------------------
      // Student ID required
      // -----------------------------------------------
      if (!item.student_id) {
        return res.status(400).json({
          success: false,
          message: 'Student ID is required.',
        });
      }

      // -----------------------------------------------
      // Check student belongs to this class
      // -----------------------------------------------
      if (!validIds.has(item.student_id)) {
        return res.status(400).json({
          success: false,
          message: `Invalid student ${item.student_id} for this class.`,
        });
      }

      // -----------------------------------------------
      // Check duplicate student
      // -----------------------------------------------
      if (submittedIds.has(item.student_id)) {
        return res.status(400).json({
          success: false,
          message: `Duplicate student ${item.student_id}.`,
        });
      }

      submittedIds.add(item.student_id);

      // -----------------------------------------------
      // Validate attendance status
      // -----------------------------------------------
      if (!['Present', 'Absent'].includes(item.status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid attendance status for ${item.student_id}`,
        });
      }

      // -----------------------------------------------
      // Add attendance
      // -----------------------------------------------
      attendanceStudents.push({
        student_id: item.student_id,
        status: item.status,
      });
    }

   

    // 
    // --------------------------------------------------
    // 15. CHECK EXISTING ATTENDANCE
    // --------------------------------------------------
    const existing = await Attendance.findOne({
      date: attendanceDate,
      academicYear: timetable.academicYear,
      timetable: timetable._id,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          'Attendance has already been submitted for this period.',
      });
    }

    // --------------------------------------------------
    // 16. CREATE ATTENDANCE DOCUMENT
    // --------------------------------------------------
    const attendance = await Attendance.create({
      date: attendanceDate,

      day: timetableDay,

      academicYear: timetable.academicYear,

      department: timetable.department,

      year: timetable.year,

      // IMPORTANT:
      // Save semester of majority of students
      semester: majoritySemester,

      period: timetable.period,

      timetable: timetable._id,

      staff: staff._id,

      subject: timetable.subject?._id || null,

      students: attendanceStudents,

      submittedAt: new Date(),
    });

    // --------------------------------------------------
    // 17. RESPONSE
    // --------------------------------------------------
    const presentCount = attendanceStudents.filter(
      (student) => student.status === 'Present'
    ).length;

    const absentCount = attendanceStudents.filter(
      (student) => student.status === 'Absent'
    ).length;

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
      },
    });
  } catch (error) {
    console.error('Error submitting attendance:', error);

    // --------------------------------------------------
    // HANDLE MONGODB DUPLICATE KEY
    // --------------------------------------------------
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          'Attendance has already been submitted for this period.',
      });
    }

    // --------------------------------------------------
    // SERVER ERROR
    // --------------------------------------------------
    return res.status(500).json({
      success: false,
      message: 'Failed to submit attendance.',
      error: error.message,
    });
  }
});

// GET /api/staff/attendance?page=1&limit=10&dateFrom=2026-08-01&dateTo=2026-08-31&department=AI&DS&year=2&semester=1
router.get('/', async (req, res) => {
  try {
    await connectDB();
    const { role } = req.user;
    if (!['Staff', 'Hod', 'Admin'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Get logged-in staff
    const user = await User.findOne({ _id: req.user.id }).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const staff = await Staff.findOne({ staff_id: user.username }).lean();
    if (!staff && role !== 'Admin') {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    // Build query filters
    const { dateFrom, dateTo, department, year, semester, period, subject, studentName, page = 1, limit = 20 } = req.query;

    const filter = {};

    // If staff (not HOD/Admin), restrict to their own records
    if (role === 'Staff') {
      filter.staff = staff._id;
    } else if (role === 'Hod') {
      // HOD can see only their department – assume HOD's staff document has a department field
      if (staff && staff.department) {
        filter.department = staff.department;
      }
    }

    // Apply filters if provided
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

    // If studentName is provided, we need to search inside students array
    // This requires aggregation; we'll handle separately for simplicity.
    // We can implement a more complex search if needed, but for now we'll skip.

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch attendance records
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

    // For each record, we may want to compute present/absent counts
    const recordsWithStats = attendanceRecords.map(rec => {
      const present = rec.students.filter(s => s.status === 'Present').length;
      const absent = rec.students.filter(s => s.status === 'Absent').length;
      return {
        ...rec,
        presentCount: present,
        absentCount: absent,
        totalStudents: rec.students.length
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
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching attendance list:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
});

// GET /api/staff/attendance/:id
// ----------------------------------------------------------
// GET /api/staff/attendance/report
// – index of available attendance reports (help)
// ----------------------------------------------------------
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
    return res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
});


// GET /api/staff/attendance/:id
router.get('/:id', async (req, res, next) => {
  try {
    await connectDB();
    const { role } = req.user;
    if (!['Staff', 'Hod', 'Admin'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const attendanceId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(attendanceId)) {
      return next();
    }

    const attendance = await Attendance.findById(attendanceId)
      .populate('staff', 'staff_id first_name last_name')
      .populate('subject', 'subjectName subjectCode')
      .populate('timetable', 'department year semester period day')
      .lean();

    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    // Authorization: if staff, ensure it's their own
    const user = await User.findOne({ _id: req.user.id }).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const staff = await Staff.findOne({ staff_id: user.username }).lean();
    if (!staff && role !== 'Admin') {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    if (role === 'Staff' && attendance.staff._id.toString() !== staff._id.toString()) {
      return res.status(403).json({ success: false, message: 'You are not authorized to view this attendance' });
    }

    // If HOD, optionally restrict to their department
    if (role === 'Hod' && staff.department && attendance.department !== staff.department) {
      return res.status(403).json({ success: false, message: 'You can only view your department\'s attendance' });
    }

    return res.status(200).json({
      success: true,
      data: attendance
    });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
});

// PUT /api/staff/attendance/:id
router.put('/:id', async (req, res, next) => {
  try {
    await connectDB();
    const { role } = req.user;
    if (!['Staff', 'Hod', 'Admin'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const attendanceId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(attendanceId)) {
      return next();
    }
    const { students } = req.body; // array of { student_id, status }

    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ success: false, message: 'Student list is required' });
    }

    // Find existing attendance
    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    // Authorization
    const user = await User.findOne({ _id: req.user.id }).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
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

    // Validate students: all submitted student_ids must exist in the current attendance students list
    const currentStudentIds = new Set(attendance.students.map(s => s.student_id));
    const updatedStudents = [];
    for (const item of students) {
      if (!currentStudentIds.has(item.student_id)) {
        return res.status(400).json({
          success: false,
          message: `Student ${item.student_id} is not part of this attendance record`
        });
      }
      if (!['Present', 'Absent'].includes(item.status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status for ${item.student_id}`
        });
      }
      updatedStudents.push({ student_id: item.student_id, status: item.status });
    }

    // Ensure all students are included
    if (updatedStudents.length !== attendance.students.length) {
      return res.status(400).json({
        success: false,
        message: 'You must provide status for all students'
      });
    }

    // Update the students array
    attendance.students = updatedStudents;
    await attendance.save();

    // Return updated record
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
    return res.status(500).json({ success: false, message: 'Failed to update attendance', error: error.message });
  }
});

// ----------------------------------------------------------
// GET /api/staff/attendance/subjects
// – fetch subjects taught by the logged‑in staff (or dept)
// ----------------------------------------------------------
router.get('/subjects', async (req, res) => {
  try {
    await connectDB();
    const { role } = req.user;
    if (!['Staff', 'Hod', 'Admin'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Get logged‑in user & staff
    const user = await User.findById(req.user.id).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const staff = await Staff.findOne({ staff_id: user.username }).lean();
    if (!staff && role !== 'Admin') {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    // Build filter for timetable
    const filter = {};
    if (role === 'Staff') {
      filter.staff = staff._id;
    } else if (role === 'Hod' && staff?.department) {
      filter.department = staff.department;
    }

    // Get distinct subject IDs from Timetable
    const subjectIds = await Timetable.distinct('subject', filter);
    // Populate subject details
    const subjects = await Subject.find({ _id: { $in: subjectIds } })
      .select('subjectCode subjectName')
      .lean();

    return res.status(200).json({
      success: true,
      data: subjects,
    });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch subjects',
      error: error.message,
    });
  }
});

//----
// GET /api/staff/attendance/subjects
// – returns distinct subjects taught by the staff (or department for HOD/Admin)
router.get('/subjects', async (req, res) => {
  try {
    await connectDB();
    const { role } = req.user;
    if (!['Staff', 'Hod', 'Admin'].includes(role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Get logged‑in user and staff
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const staff = await Staff.findOne({ staff_id: user.username }).lean();
    if (!staff && role !== 'Admin') {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    // Build filter for timetable
    const filter = {};
    if (role === 'Staff') {
      filter.staff = staff._id;
    } else if (role === 'Hod' && staff?.department) {
      filter.department = staff.department;
    }
    // Admin sees all subjects

    // Get distinct subject IDs from Timetable
    const subjectIds = await Timetable.distinct('subject', filter);
    // Fetch subject details
    const subjects = await Subject.find({ _id: { $in: subjectIds } })
      .select('subjectCode subjectName')
      .lean();

    return res.status(200).json({
      success: true,
      data: subjects,
    });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch subjects', error: error.message });
  }
});

// GET /api/staff/attendance/report/subject
// – generates per‑student attendance report for a given subject and date range
// Query: subjectId (required), dateFrom, dateTo (optional)
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

    // Get logged‑in user & staff
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const staff = await Staff.findOne({ staff_id: user.username }).lean();
    if (!staff && role !== 'Admin') {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    // Build filter for attendance records
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

    // Fetch all attendance records for this subject
    const records = await Attendance.find(filter)
      .populate('subject', 'subjectCode subjectName')
      .populate('timetable', 'department year semester') // for department info if needed
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

    // Aggregate per student
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

    // Fetch student details for these IDs
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

    // Build result array
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

    // Sort by roll_no (or register_no)
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

// DELETE /api/staff/attendance/:id
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

    // Authorization: if staff, ensure it's their own
    const user = await User.findById(req.user.id).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
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

    return res.status(200).json({
      success: true,
      message: 'Attendance record deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting attendance:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete attendance', error: error.message });
  }
});



module.exports = router;