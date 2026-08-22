const express = require('express');
const router = express.Router();
const multer = require('multer');
const connectDB = require('../../config/db');

// ---- Reuse the SAME Google Drive service (staff functions) ----
const {
  uploadStaffPhoto,
  getStaffPhoto,
  deleteStaffPhoto,
} = require('../../services/googleDrive');

const Student = require('../../models/Student');
const User = require('../../models/User');

// ----- Multer (memory storage) -----
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only JPG, JPEG, PNG and WEBP files are allowed'));
    }
    cb(null, true);
  },
});

// ----- Helper: nullIfEmpty -----
const nullIfEmpty = (value) => (value && value.trim() !== '' ? value : null);

// ----- Helper: build a cache-busted photo URL -----
const buildPhotoUrl = (studentId, photoFileId, photoVersion) =>
  photoFileId ? `/api/admin/student/${studentId}/photo?v=${photoVersion || 0}` : null;

// ----- Validation constants -----
const nameRegex = /^[A-Za-z ]+$/;
const phoneRegex = /^\d{10}$/;
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/;
const validGender = ['Male', 'Female', 'Other'];
const validAdmissionStatus = ['Applied', 'Admitted', 'Cancelled', 'Rejected'];
const validStudentStatus = ['Active', 'Graduated', 'Discontinued', 'Transferred', 'Suspended'];
const validAdmissionType = ['Regular', 'Lateral'];
const validLocationType = ['Rural', 'Urban', 'Semi-Urban'];
const validBloodGroup = [
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-',
  'O+', 'O-', 'A1+', 'A1-', 'A2+', 'A2-',
  'A1B+', 'A1B-', 'A2B+', 'A2B-',
];


// ---- Helper: generate a unique random student ID ----
const generateUniqueStudentId = async () => {
  let attempts = 0;
  while (attempts < 10) {
    const randomId = Math.floor(10000000 + Math.random() * 90000000).toString(); // 8-digit
    const existingStudent = await Student.findOne({ student_id: randomId });
    if (!existingStudent) {
      const existingUser = await User.findOne({ username: randomId });
      if (!existingUser) {
        return randomId;
      }
    }
    attempts++;
  }
  // Fallback: timestamp-based ID
  return 'STU' + Date.now().toString().slice(-8);
};

// ============================================================
// 1. POST /add (with auto-generation of student_id)
// ============================================================
router.post('/add', upload.single('photo'), async (req, res) => {
  const role = req.user?.role;
  if (role !== 'Admin' && role !== 'Hod') {
    return res.status(403).json({ success: false, message: 'Access denied', islogout: true });
  }

  try {
    await connectDB();

    if (!req.file) {
      return res.status(400).json({ success: false, emessage: 'Photo is required' });
    }

    const studentData = req.body;

    // ----- Destructure all fields -----
    const {
      application_no, admission_no, register_no, roll_no,
      academic_year, admission_date, admission_type, admission_mode,
      programme, department_code, batch, regulation, medium, year, semester, section,
      first_name, middle_name, last_name, date_of_birth, gender, blood_group,
      nationality, mother_tongue, religion, community, caste, aadhar_number,
      mobile_number, email, address, panchayat_name, location_type,
      taluk, district, state, pincode,
      father_name, father_mobile, father_occupation,
      mother_name, mother_mobile, mother_occupation,
      annual_family_income, first_graduate, seven_point_five,
      guardian_name, guardian_relationship, guardian_mobile, guardian_occupation,
      qualification,
      special_quota, quota_category, differently_abled, disability_category,
      admission_status, student_status,
    } = studentData;

    // ----- Helper functions (should already exist, but defined here for completeness) -----
    const nullIfEmpty = (val) => (val && val.trim() !== '' ? val.trim() : null);

    // ----- Validation constants (same as your existing ones) -----
    const nameRegex = /^[a-zA-Z\s\-']{2,50}$/;
    const phoneRegex = /^[6-9]\d{9}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validGender = ['Male', 'Female', 'Other'];
    const validBloodGroup = [
      'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-',
      'O+', 'O-', 'A1+', 'A1-', 'A2+', 'A2-',
      'A1B+', 'A1B-', 'A2B+', 'A2B-',
    ];
    const validAdmissionStatus = ['Applied', 'Admitted', 'Cancelled', 'Rejected'];
    const validStudentStatus = ['Active', 'Graduated', 'Discontinued', 'Transferred', 'Suspended'];
    const validAdmissionType = ['Regular', 'Lateral'];
    const validLocationType = ['Rural', 'Urban', 'Semi-Urban'];

    // ---- Required fields ----
    if (!first_name?.trim()) return res.status(400).json({ emessage: 'First name is required' });
    if (!last_name?.trim()) return res.status(400).json({ emessage: 'Last name is required' });
    if (!gender?.trim()) return res.status(400).json({ emessage: 'Gender is required' });
    if (!mobile_number?.trim()) return res.status(400).json({ emessage: 'Mobile number is required' });
    if (!email?.trim()) return res.status(400).json({ emessage: 'Email is required' });
    if (!department_code?.trim()) return res.status(400).json({ emessage: 'Department is required' });
    if (!admission_type?.trim()) return res.status(400).json({ emessage: 'Admission type is required' });

    // ---- Format validations ----
    if (!nameRegex.test(first_name)) return res.status(400).json({ emessage: 'Invalid first name' });
    if (middle_name && !nameRegex.test(middle_name)) return res.status(400).json({ emessage: 'Invalid middle name' });
    if (!nameRegex.test(last_name)) return res.status(400).json({ emessage: 'Invalid last name' });
    if (!validGender.includes(gender)) return res.status(400).json({ emessage: 'Invalid gender' });
    if (!phoneRegex.test(mobile_number)) return res.status(400).json({ emessage: 'Invalid mobile number (must be 10 digits)' });
    if (!emailRegex.test(email)) return res.status(400).json({ emessage: 'Invalid email address' });
    if (aadhar_number && !/^\d{12}$/.test(aadhar_number))
      return res.status(400).json({ emessage: 'Aadhar must contain 12 digits' });
    if (father_mobile && !phoneRegex.test(father_mobile))
      return res.status(400).json({ emessage: 'Invalid father mobile number' });
    if (mother_mobile && !phoneRegex.test(mother_mobile))
      return res.status(400).json({ emessage: 'Invalid mother mobile number' });
    if (guardian_mobile && !phoneRegex.test(guardian_mobile))
      return res.status(400).json({ emessage: 'Invalid guardian mobile number' });
    if (!validAdmissionType.includes(admission_type))
      return res.status(400).json({ emessage: 'Invalid admission type' });
    if (admission_status && !validAdmissionStatus.includes(admission_status))
      return res.status(400).json({ emessage: 'Invalid admission status' });
    if (student_status && !validStudentStatus.includes(student_status))
      return res.status(400).json({ emessage: 'Invalid student status' });
    if (location_type && !validLocationType.includes(location_type))
      return res.status(400).json({ emessage: 'Invalid location type' });
    if (blood_group && !validBloodGroup.includes(blood_group))
      return res.status(400).json({ emessage: 'Invalid blood group' });
    if (pincode && !/^\d{6}$/.test(pincode))
      return res.status(400).json({ emessage: 'Invalid pincode (must be 6 digits)' });
    if (date_of_birth && new Date(date_of_birth) > new Date())
      return res.status(400).json({ emessage: 'Date of birth cannot be in future' });
    if (date_of_birth && new Date(date_of_birth).getFullYear() < 1940)
      return res.status(400).json({ emessage: 'Invalid date of birth' });
    if (admission_date && new Date(admission_date) > new Date())
      return res.status(400).json({ emessage: 'Admission date cannot be in future' });
    if (year && (Number(year) < 1 || Number(year) > 6))
      return res.status(400).json({ emessage: 'Year must be between 1 and 6' });
    if (semester && (Number(semester) < 1 || Number(semester) > 12))
      return res.status(400).json({ emessage: 'Semester must be between 1 and 12' });
    if (annual_family_income && Number(annual_family_income) < 0)
      return res.status(400).json({ emessage: 'Annual family income cannot be negative' });

    // ---- Qualification validation ----
    if (qualification) {
      const q = typeof qualification === 'string' ? JSON.parse(qualification) : qualification;
      if (admission_type === 'Regular') {
        if (!q.emis_number) return res.status(400).json({ emessage: 'EMIS Number is required for Regular admission' });
        if (!q.institution) return res.status(400).json({ emessage: 'Institution is required for Regular admission' });
        if (!q.qualifying_exam) return res.status(400).json({ emessage: 'Qualifying Exam is required for Regular admission' });
        if (!q.passing_year) return res.status(400).json({ emessage: 'Passing Year is required for Regular admission' });
        if (!q.register_number) return res.status(400).json({ emessage: 'Register Number is required for Regular admission' });
        if (!q.total_marks && q.total_marks !== 0) return res.status(400).json({ emessage: 'Total Marks is required for Regular admission' });
        ['total_marks', 'mathematics_marks', 'physics_marks', 'chemistry_marks', 'aggregate'].forEach(f => {
          if (q[f] !== undefined && q[f] !== null && (isNaN(q[f]) || q[f] < 0))
            return res.status(400).json({ emessage: `${f} must be a non-negative number` });
        });
      } else if (admission_type === 'Lateral') {
        if (!q.umis_number) return res.status(400).json({ emessage: 'UMIS Number is required for Lateral entry' });
        if (!q.institution) return res.status(400).json({ emessage: 'Institution is required for Lateral entry' });
        if (!q.qualifying_exam) return res.status(400).json({ emessage: 'Qualifying Exam is required for Lateral entry' });
        if (!q.passing_year) return res.status(400).json({ emessage: 'Passing Year is required for Lateral entry' });
        if (!q.register_number) return res.status(400).json({ emessage: 'Register Number is required for Lateral entry' });
        if (!q.diploma_branch) return res.status(400).json({ emessage: 'Diploma Branch is required for Lateral entry' });
        if (!q.total_marks && q.total_marks !== 0) return res.status(400).json({ emessage: 'Total Marks is required for Lateral entry' });
        if (q.percentage !== undefined && q.percentage !== null && (isNaN(q.percentage) || q.percentage < 0 || q.percentage > 100))
          return res.status(400).json({ emessage: 'Percentage must be between 0 and 100' });
      }
    }

    // ---- Duplicate checks ----
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedMobile = mobile_number.trim();

    // Check Student collection
    const existingStudentEmail = await Student.findOne({ email: normalizedEmail });
    if (existingStudentEmail) return res.status(400).json({ emessage: 'Email already exists in student records' });

    const existingStudentMobile = await Student.findOne({ mobile_number: normalizedMobile });
    if (existingStudentMobile) return res.status(400).json({ emessage: 'Mobile number already exists in student records' });

    // Check User collection as well (email must be unique across both)
    const existingUserEmail = await User.findOne({ email: normalizedEmail });
    if (existingUserEmail) return res.status(400).json({ emessage: 'Email already registered as a user' });

    if (application_no) {
      const dup = await Student.findOne({ application_no: application_no.trim() });
      if (dup) return res.status(400).json({ emessage: 'Application Number already exists' });
    }
    if (admission_no) {
      const dup = await Student.findOne({ admission_no: admission_no.trim() });
      if (dup) return res.status(400).json({ emessage: 'Admission Number already exists' });
    }
    if (register_no) {
      const dup = await Student.findOne({ register_no: register_no.trim() });
      if (dup) return res.status(400).json({ emessage: 'Register Number already exists' });
    }

    // ---- Aadhar: only check if provided and non-empty ----
    const cleanAadhar = nullIfEmpty(aadhar_number);
    if (cleanAadhar) {
      const dup = await Student.findOne({ aadhar_number: cleanAadhar });
      if (dup) return res.status(400).json({ emessage: 'Aadhar number already exists' });
    }

    // ---- Generate or validate student_id (register_no) ----
    let finalStudentId = register_no ? register_no.trim() : '';
    if (!finalStudentId) {
      finalStudentId = await generateUniqueStudentId();
    } else {
      // Check if provided ID already exists in Student or User
      const existingStudent = await Student.findOne({ student_id: finalStudentId });
      const existingUser = await User.findOne({ username: finalStudentId });
      if (existingStudent || existingUser) {
        finalStudentId = await generateUniqueStudentId();
      }
    }

    // ---- Ensure register_no is also unique ----
    let finalRegisterNo = register_no ? register_no.trim() : finalStudentId;
    // If auto-generated, verify register_no uniqueness as well
    if (!register_no) {
      const existingRegNo = await Student.findOne({ register_no: finalStudentId });
      if (existingRegNo) {
        // Regenerate a new ID
        finalStudentId = await generateUniqueStudentId();
        finalRegisterNo = finalStudentId;
      }
    }

    // ---- Upload photo ----
    const photoFileId = await uploadStaffPhoto(req.file);
    const photoVersion = Date.now();

    // ---- Build student document ----
    const studentDoc = {
      student_id: finalStudentId,
      application_no: nullIfEmpty(application_no),
      admission_no: nullIfEmpty(admission_no),
      register_no: finalRegisterNo,
      roll_no: nullIfEmpty(roll_no),
      academic_year: nullIfEmpty(academic_year),
      admission_date: admission_date || null,
      admission_type,
      admission_mode: nullIfEmpty(admission_mode),
      programme: nullIfEmpty(programme),
      department_code: department_code.trim(),
      batch: nullIfEmpty(batch),
      regulation: nullIfEmpty(regulation),
      medium: nullIfEmpty(medium),
      year: year ? Number(year) : null,
      semester: semester ? Number(semester) : null,
      section: nullIfEmpty(section),
      first_name: first_name.trim(),
      middle_name: nullIfEmpty(middle_name),
      last_name: last_name.trim(),
      date_of_birth: date_of_birth || null,
      gender,
      blood_group: nullIfEmpty(blood_group),
      nationality: nullIfEmpty(nationality),
      mother_tongue: nullIfEmpty(mother_tongue),
      religion: nullIfEmpty(religion),
      community: nullIfEmpty(community),
      caste: nullIfEmpty(caste),
      mobile_number: normalizedMobile,
      email: normalizedEmail,
      address: nullIfEmpty(address),
      panchayat_name: nullIfEmpty(panchayat_name),
      location_type: nullIfEmpty(location_type),
      taluk: nullIfEmpty(taluk),
      district: nullIfEmpty(district),
      state: nullIfEmpty(state),
      pincode: nullIfEmpty(pincode),
      father_name: nullIfEmpty(father_name),
      father_mobile: nullIfEmpty(father_mobile),
      father_occupation: nullIfEmpty(father_occupation),
      mother_name: nullIfEmpty(mother_name),
      mother_mobile: nullIfEmpty(mother_mobile),
      mother_occupation: nullIfEmpty(mother_occupation),
      annual_family_income: annual_family_income ? Number(annual_family_income) : null,
      first_graduate: first_graduate === 'true' || first_graduate === true,
      seven_point_five: seven_point_five === 'true' || seven_point_five === true,
      guardian_name: nullIfEmpty(guardian_name),
      guardian_relationship: nullIfEmpty(guardian_relationship),
      guardian_mobile: nullIfEmpty(guardian_mobile),
      guardian_occupation: nullIfEmpty(guardian_occupation),
      qualification: qualification ? (typeof qualification === 'string' ? JSON.parse(qualification) : qualification) : {},
      special_quota: special_quota === 'true' || special_quota === true,
      quota_category: nullIfEmpty(quota_category),
      differently_abled: differently_abled === 'true' || differently_abled === true,
      disability_category: nullIfEmpty(disability_category),
      admission_status: admission_status || 'Applied',
      student_status: student_status || 'Active',
      photo_file_id: photoFileId,
      photo_version: photoVersion,
    };

    // ---- Handle Aadhar: omit if empty to avoid duplicate null errors (requires sparse index) ----
    if (!cleanAadhar) {
      delete studentDoc.aadhar_number;
    } else {
      studentDoc.aadhar_number = cleanAadhar;
    }

    const newStudent = new Student(studentDoc);
    await newStudent.save();

    // ---- Create User ----
    const defaultPassword = 'Student@123';
    const fullName = `${studentDoc.first_name} ${studentDoc.middle_name || ''} ${studentDoc.last_name}`.trim();
    const newUser = new User({
      username: finalStudentId,
      email: normalizedEmail,
      password: defaultPassword,
      name: fullName,
      role: 'Student',
      profile_image: buildPhotoUrl(finalStudentId, studentDoc.photo_file_id, studentDoc.photo_version),
    });
    await newUser.save();

    return res.status(201).json({
      success: true,
      message: 'Student added successfully',
      student_id: finalStudentId,
    });

  } catch (error) {
    console.error('Error adding student:', error);

    // Handle duplicate key errors gracefully
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const value = error.keyValue[field];
      return res.status(400).json({
        success: false,
        emessage: `Duplicate value for ${field}: ${value}. Please ensure it is unique.`,
      });
    }

    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// ============================================================
// 2. GET / (List with pagination & filters)
// ============================================================
router.get('/', async (req, res) => {
  const role = req.user?.role;
  if (role !== 'Admin' && role !== 'Hod') {
    return res.status(403).json({ success: false, message: 'Access denied', islogout: true });
  }

  try {
    await connectDB();
    const {
      page = 1,
      limit = 10,
      search = '',
      department = '',
      admissionType = '',
      admissionStatus = '',
      studentStatus = '',
      year = '',
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const filter = {};
    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { student_id: searchRegex },
        { register_no: searchRegex },
        { admission_no: searchRegex },
        { roll_no: searchRegex },
        { first_name: searchRegex },
        { last_name: searchRegex },
        { email: searchRegex },
        { mobile_number: searchRegex },
      ];
    }
    if (department && department.trim() !== '') filter.department_code = department.trim();
    if (admissionType && admissionType.trim() !== '') filter.admission_type = admissionType.trim();
    if (admissionStatus && admissionStatus.trim() !== '') filter.admission_status = admissionStatus.trim();
    if (studentStatus && studentStatus.trim() !== '') filter.student_status = studentStatus.trim();
    if (year && !isNaN(year)) filter.year = Number(year);

    // Count total
    const totalItems = await Student.countDocuments(filter);

    // Fetch students
    const studentList = await Student.find(filter)
      .select({
        student_id: 1,
        application_no: 1,
        admission_no: 1,
        register_no: 1,
        roll_no: 1,
        first_name: 1,
        middle_name: 1,
        last_name: 1,
        department_code: 1,
        programme: 1,
        admission_type: 1,
        email: 1,
        mobile_number: 1,
        admission_status: 1,
        student_status: 1,
        year: 1,
        semester: 1,
        section: 1,
        photo_file_id: 1,
        photo_version: 1,
        seven_point_five: 1, // include for display if needed
      })
      .sort({ student_id: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Format response
    const formattedStudents = studentList.map((student) => ({
      id: student.student_id,
      image: buildPhotoUrl(student.student_id, student.photo_file_id, student.photo_version),
      name: `${student.first_name || ''} ${student.middle_name || ''} ${student.last_name || ''}`.trim(),
      admissionNo: student.admission_no || '',
      rollNo: student.roll_no || '',
      registerNo: student.register_no || '',
      department: student.department_code || '',
      programme: student.programme || '',
      admissionType: student.admission_type || '',
      email: student.email || '',
      phone: student.mobile_number || '',
      admissionStatus: student.admission_status || 'Applied',
      studentStatus: student.student_status || 'Active',
      year: student.year || '',
      semester: student.semester || '',
      section: student.section || '',
      sevenPointFive: student.seven_point_five || false,
    }));

    // Stats
    const statsResult = await Student.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalStudents: { $sum: 1 },
          activeStudents: { $sum: { $cond: [{ $eq: ['$student_status', 'Active'] }, 1, 0] } },
          admitted: { $sum: { $cond: [{ $eq: ['$admission_status', 'Admitted'] }, 1, 0] } },
          applied: { $sum: { $cond: [{ $eq: ['$admission_status', 'Applied'] }, 1, 0] } },
        },
      },
    ]);
    const stats = statsResult[0] || { totalStudents: 0, activeStudents: 0, admitted: 0, applied: 0 };

    // Filter options for dropdowns
    const departmentList = await Student.distinct('department_code', { department_code: { $ne: null } });
    const admissionTypeList = await Student.distinct('admission_type', { admission_type: { $ne: null } });
    const admissionStatusList = ['Applied', 'Admitted', 'Cancelled', 'Rejected'];
    const studentStatusList = ['Active', 'Graduated', 'Discontinued', 'Transferred', 'Suspended'];

    const totalPages = Math.ceil(totalItems / limitNum);
    const startIndex = skip + 1;
    const endIndex = Math.min(skip + limitNum, totalItems);

    res.status(200).json({
      success: true,
      data: {
        students: formattedStudents,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems,
          itemsPerPage: limitNum,
          startIndex,
          endIndex,
        },
        stats: {
          totalStudents: stats.totalStudents || 0,
          activeStudents: stats.activeStudents || 0,
          admitted: stats.admitted || 0,
          applied: stats.applied || 0,
        },
        filters: {
          departments: departmentList.filter((d) => d),
          admissionTypes: admissionTypeList.filter((d) => d),
          admissionStatuses: admissionStatusList,
          studentStatuses: studentStatusList,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
});

// ============================================================
// 3. GET /all (master data)
// ============================================================
router.get('/all', async (req, res) => {
  const role = req.user?.role;
  if (role !== 'Admin' && role !== 'Hod') {
    return res.status(403).json({ success: false, message: 'Access denied', islogout: true });
  }

  try {
    await connectDB();
    const students = await Student.find({ student_status: { $ne: 'Suspended' } })
      .select({
        _id: 1,
        student_id: 1,
        register_no: 1,
        admission_no: 1,
        roll_no: 1,
        first_name: 1,
        middle_name: 1,
        last_name: 1,
        department_code: 1,
        programme: 1,
        admission_type: 1,
        student_status: 1,
        photo_file_id: 1,
        photo_version: 1,
      })
      .sort({ department_code: 1, roll_no: 1 })
      .lean();

    const formatted = students.map((s) => ({
      _id: s._id,
      student_id: s.student_id,
      register_no: s.register_no,
      admission_no: s.admission_no,
      roll_no: s.roll_no,
      full_name: `${s.first_name || ''} ${s.middle_name || ''} ${s.last_name || ''}`.trim(),
      department_code: s.department_code,
      programme: s.programme,
      admission_type: s.admission_type,
      student_status: s.student_status,
      photo_url: buildPhotoUrl(s.student_id, s.photo_file_id, s.photo_version),
    }));

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error('Error fetching all students:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
});

// ============================================================
// 4. GET /:id/photo (serve student photo)
// ============================================================
router.get('/:id/photo', async (req, res) => {
  const role = req.user?.role;
  if (role !== 'Admin' && role !== 'Hod') {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  try {
    await connectDB();
    const { id } = req.params;
    const student = await Student.findOne({ student_id: id }).lean();
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    if (!student.photo_file_id) {
      return res.status(404).json({ success: false, message: 'Student photo not found' });
    }

    const driveResponse = await getStaffPhoto(student.photo_file_id); // reuse staff function

    // Force no cache
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Type', driveResponse.headers['content-type'] || 'image/jpeg');

    driveResponse.data.pipe(res);
  } catch (error) {
    console.error('Error serving student photo:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Unable to load student photo' });
    }
  }
});

// ============================================================
// 5. GET /:id (single student details)
// ============================================================
router.get('/:id', async (req, res) => {
  const role = req.user?.role;
  if (role !== 'Admin' && role !== 'Hod') {
    return res.status(403).json({ success: false, message: 'Access denied', islogout: true });
  }

  try {
    await connectDB();
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Student ID is required' });
    }

    const student = await Student.findOne({ student_id: id }).lean();
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Helper to format date
    const formatDate = (date) => {
      if (!date) return '';
      const d = new Date(date);
      if (isNaN(d)) return '';
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Build response object – includes all fields
    const studentDetails = {
      student_id: student.student_id,
      application_no: student.application_no || '',
      admission_no: student.admission_no || '',
      register_no: student.register_no || '',
      roll_no: student.roll_no || '',
      academic_year: student.academic_year || '',
      admission_date: student.admission_date ? formatDate(student.admission_date) : '',
      admission_type: student.admission_type || '',
      admission_mode: student.admission_mode || '',
      programme: student.programme || '',
      department_code: student.department_code || '',
      batch: student.batch || '',
      regulation: student.regulation || '',
      medium: student.medium || '',
      year: student.year || '',
      semester: student.semester || '',
      section: student.section || '',
      first_name: student.first_name || '',
      middle_name: student.middle_name || '',
      last_name: student.last_name || '',
      full_name: `${student.first_name || ''} ${student.middle_name || ''} ${student.last_name || ''}`.trim(),
      date_of_birth: student.date_of_birth ? formatDate(student.date_of_birth) : '',
      gender: student.gender || '',
      blood_group: student.blood_group || '',
      nationality: student.nationality || '',
      mother_tongue: student.mother_tongue || '',
      religion: student.religion || '',
      community: student.community || '',
      caste: student.caste || '',
      aadhar_number: student.aadhar_number || '',
      mobile_number: student.mobile_number || '',
      email: student.email || '',
      address: student.address || '',
      panchayat_name: student.panchayat_name || '',
      location_type: student.location_type || '',
      taluk: student.taluk || '',
      district: student.district || '',
      state: student.state || '',
      pincode: student.pincode || '',
      father_name: student.father_name || '',
      father_mobile: student.father_mobile || '',
      father_occupation: student.father_occupation || '',
      mother_name: student.mother_name || '',
      mother_mobile: student.mother_mobile || '',
      mother_occupation: student.mother_occupation || '',
      annual_family_income: student.annual_family_income || '',
      first_graduate: student.first_graduate || false,
      seven_point_five: student.seven_point_five || false,
      guardian_name: student.guardian_name || '',
      guardian_relationship: student.guardian_relationship || '',
      guardian_mobile: student.guardian_mobile || '',
      guardian_occupation: student.guardian_occupation || '',
      qualification: student.qualification || {},
      special_quota: student.special_quota || false,
      quota_category: student.quota_category || '',
      differently_abled: student.differently_abled || false,
      disability_category: student.disability_category || '',
      admission_status: student.admission_status || 'Applied',
      student_status: student.student_status || 'Active',
      profile_image: buildPhotoUrl(student.student_id, student.photo_file_id, student.photo_version) || '/user.png',
    };

    res.status(200).json({ success: true, data: studentDetails });
  } catch (error) {
    console.error('Error fetching student details:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
});

// ============================================================
// 6. PUT /:id (update)
// ============================================================
router.put('/:id', upload.single('photo'), async (req, res) => {
  const role = req.user?.role;
  if (role !== 'Admin'&&role!=='Hod') {
    return res.status(403).json({ success: false, message: 'Access denied', islogout: true });
  }

  let newPhotoFileId = null;
  let uploadedNewPhoto = false;

  try {
    await connectDB();
    const { id } = req.params;
    const studentData = req.body;

    // 1. Find existing student
    const existingStudent = await Student.findOne({ student_id: id });
    if (!existingStudent) {
      return res.status(404).json({ success: false, emessage: 'Student not found' });
    }

    // 2. Extract fields (same as POST, but note: student_id is NOT updated)
    const {
      application_no, admission_no, register_no, roll_no,
      academic_year, admission_date, admission_type, admission_mode,
      programme, department_code, batch, regulation, medium, year, semester, section,
      first_name, middle_name, last_name, date_of_birth, gender, blood_group,
      nationality, mother_tongue, religion, community, caste, aadhar_number,
      mobile_number, email, address, panchayat_name, location_type,
      taluk, district, state, pincode,
      father_name, father_mobile, father_occupation,
      mother_name, mother_mobile, mother_occupation,
      annual_family_income, first_graduate, seven_point_five,
      guardian_name, guardian_relationship, guardian_mobile, guardian_occupation,
      qualification,
      special_quota, quota_category, differently_abled, disability_category,
      admission_status, student_status,
    } = studentData;

    // ---- Required fields ----
    if (!first_name?.trim()) return res.status(400).json({ emessage: 'First name is required' });
    if (!last_name?.trim()) return res.status(400).json({ emessage: 'Last name is required' });
    if (!gender?.trim()) return res.status(400).json({ emessage: 'Gender is required' });
    if (!mobile_number?.trim()) return res.status(400).json({ emessage: 'Mobile number is required' });
    if (!email?.trim()) return res.status(400).json({ emessage: 'Email is required' });
    if (!department_code?.trim()) return res.status(400).json({ emessage: 'Department is required' });
    if (!admission_type?.trim()) return res.status(400).json({ emessage: 'Admission type is required' });

    // ---- Format validations (same as POST) ----
    if (!nameRegex.test(first_name)) return res.status(400).json({ emessage: 'Invalid first name' });
    if (middle_name && !nameRegex.test(middle_name)) return res.status(400).json({ emessage: 'Invalid middle name' });
    if (!nameRegex.test(last_name)) return res.status(400).json({ emessage: 'Invalid last name' });
    if (!validGender.includes(gender)) return res.status(400).json({ emessage: 'Invalid gender' });
    if (!phoneRegex.test(mobile_number)) return res.status(400).json({ emessage: 'Invalid mobile number' });
    if (!emailRegex.test(email)) return res.status(400).json({ emessage: 'Invalid email address' });
    if (aadhar_number && !/^\d{12}$/.test(aadhar_number))
      return res.status(400).json({ emessage: 'Aadhar must contain 12 digits' });
    if (father_mobile && !phoneRegex.test(father_mobile))
      return res.status(400).json({ emessage: 'Invalid father mobile number' });
    if (mother_mobile && !phoneRegex.test(mother_mobile))
      return res.status(400).json({ emessage: 'Invalid mother mobile number' });
    if (guardian_mobile && !phoneRegex.test(guardian_mobile))
      return res.status(400).json({ emessage: 'Invalid guardian mobile number' });
    if (!validAdmissionType.includes(admission_type))
      return res.status(400).json({ emessage: 'Invalid admission type' });
    if (admission_status && !validAdmissionStatus.includes(admission_status))
      return res.status(400).json({ emessage: 'Invalid admission status' });
    if (student_status && !validStudentStatus.includes(student_status))
      return res.status(400).json({ emessage: 'Invalid student status' });
    if (location_type && !validLocationType.includes(location_type))
      return res.status(400).json({ emessage: 'Invalid location type' });
    if (blood_group && !validBloodGroup.includes(blood_group))
      return res.status(400).json({ emessage: 'Invalid blood group' });
    if (pincode && !/^\d{6}$/.test(pincode))
      return res.status(400).json({ emessage: 'Invalid pincode' });
    if (date_of_birth && new Date(date_of_birth) > new Date())
      return res.status(400).json({ emessage: 'Date of birth cannot be in future' });
    if (date_of_birth && new Date(date_of_birth).getFullYear() < 1940)
      return res.status(400).json({ emessage: 'Invalid date of birth' });
    if (admission_date && new Date(admission_date) > new Date())
      return res.status(400).json({ emessage: 'Admission date cannot be in future' });
    if (year && (Number(year) < 1 || Number(year) > 6))
      return res.status(400).json({ emessage: 'Year must be between 1 and 6' });
    if (semester && (Number(semester) < 1 || Number(semester) > 12))
      return res.status(400).json({ emessage: 'Semester must be between 1 and 12' });
    if (annual_family_income && Number(annual_family_income) < 0)
      return res.status(400).json({ emessage: 'Annual family income cannot be negative' });

    // ---- Qualification validation (same as POST) ----
    if (qualification) {
      const q = typeof qualification === 'string' ? JSON.parse(qualification) : qualification;
      if (admission_type === 'Regular') {
        if (!q.emis_number) return res.status(400).json({ emessage: 'EMIS Number is required for Regular admission' });
        if (!q.institution) return res.status(400).json({ emessage: 'Institution is required for Regular admission' });
        if (!q.qualifying_exam) return res.status(400).json({ emessage: 'Qualifying Exam is required for Regular admission' });
        if (!q.passing_year) return res.status(400).json({ emessage: 'Passing Year is required for Regular admission' });
        if (!q.register_number) return res.status(400).json({ emessage: 'Register Number is required for Regular admission' });
        if (!q.total_marks && q.total_marks !== 0) return res.status(400).json({ emessage: 'Total Marks is required for Regular admission' });
        ['total_marks', 'mathematics_marks', 'physics_marks', 'chemistry_marks', 'aggregate'].forEach(f => {
          if (q[f] !== undefined && q[f] !== null && (isNaN(q[f]) || q[f] < 0))
            return res.status(400).json({ emessage: `${f} must be a non-negative number` });
        });
      } else if (admission_type === 'Lateral') {
        if (!q.umis_number) return res.status(400).json({ emessage: 'UMIS Number is required for Lateral entry' });
        if (!q.institution) return res.status(400).json({ emessage: 'Institution is required for Lateral entry' });
        if (!q.qualifying_exam) return res.status(400).json({ emessage: 'Qualifying Exam is required for Lateral entry' });
        if (!q.passing_year) return res.status(400).json({ emessage: 'Passing Year is required for Lateral entry' });
        if (!q.register_number) return res.status(400).json({ emessage: 'Register Number is required for Lateral entry' });
        if (!q.diploma_branch) return res.status(400).json({ emessage: 'Diploma Branch is required for Lateral entry' });
        if (!q.total_marks && q.total_marks !== 0) return res.status(400).json({ emessage: 'Total Marks is required for Lateral entry' });
        if (q.percentage !== undefined && q.percentage !== null && (isNaN(q.percentage) || q.percentage < 0 || q.percentage > 100))
          return res.status(400).json({ emessage: 'Percentage must be between 0 and 100' });
      }
    }

    // 3. Build update object – DO NOT update student_id; keep it as is.
    const updateFields = {
      // student_id is NOT included – it remains the primary key
      application_no: nullIfEmpty(application_no),
      admission_no: nullIfEmpty(admission_no),
      register_no: nullIfEmpty(register_no),
      roll_no: nullIfEmpty(roll_no),
      academic_year: nullIfEmpty(academic_year),
      admission_date: admission_date || null,
      admission_type,
      admission_mode: nullIfEmpty(admission_mode),
      programme: nullIfEmpty(programme),
      department_code: department_code.trim(),
      batch: nullIfEmpty(batch),
      regulation: nullIfEmpty(regulation),
      medium: nullIfEmpty(medium),
      year: year ? Number(year) : null,
      semester: semester ? Number(semester) : null,
      section: nullIfEmpty(section),
      first_name: first_name.trim(),
      middle_name: nullIfEmpty(middle_name),
      last_name: last_name.trim(),
      date_of_birth: date_of_birth || null,
      gender,
      blood_group: nullIfEmpty(blood_group),
      nationality: nullIfEmpty(nationality),
      mother_tongue: nullIfEmpty(mother_tongue),
      religion: nullIfEmpty(religion),
      community: nullIfEmpty(community),
      caste: nullIfEmpty(caste),
      aadhar_number: nullIfEmpty(aadhar_number),
      mobile_number: mobile_number.trim(),
      email: email.trim().toLowerCase(),
      address: nullIfEmpty(address),
      panchayat_name: nullIfEmpty(panchayat_name),
      location_type: nullIfEmpty(location_type),
      taluk: nullIfEmpty(taluk),
      district: nullIfEmpty(district),
      state: nullIfEmpty(state),
      pincode: nullIfEmpty(pincode),
      father_name: nullIfEmpty(father_name),
      father_mobile: nullIfEmpty(father_mobile),
      father_occupation: nullIfEmpty(father_occupation),
      mother_name: nullIfEmpty(mother_name),
      mother_mobile: nullIfEmpty(mother_mobile),
      mother_occupation: nullIfEmpty(mother_occupation),
      annual_family_income: annual_family_income ? Number(annual_family_income) : null,
      first_graduate: first_graduate === 'true' || first_graduate === true,
      seven_point_five: seven_point_five === 'true' || seven_point_five === true,
      guardian_name: nullIfEmpty(guardian_name),
      guardian_relationship: nullIfEmpty(guardian_relationship),
      guardian_mobile: nullIfEmpty(guardian_mobile),
      guardian_occupation: nullIfEmpty(guardian_occupation),
      qualification: qualification ? (typeof qualification === 'string' ? JSON.parse(qualification) : qualification) : {},
      special_quota: special_quota === 'true' || special_quota === true,
      quota_category: nullIfEmpty(quota_category),
      differently_abled: differently_abled === 'true' || differently_abled === true,
      disability_category: nullIfEmpty(disability_category),
      admission_status: admission_status || 'Applied',
      student_status: student_status || 'Active',
    };

    // 4. Duplicate checks – exclude current student by student_id
    const duplicateStudent = await Student.findOne({
      $and: [
        { student_id: { $ne: id } },
        {
          $or: [
            { email: updateFields.email },
            { mobile_number: updateFields.mobile_number },
          ],
        },
      ],
    });
    if (duplicateStudent) {
      return res.status(400).json({ emessage: 'Email or mobile already in use by another student' });
    }
    if (updateFields.application_no) {
      const dup = await Student.findOne({ student_id: { $ne: id }, application_no: updateFields.application_no });
      if (dup) return res.status(400).json({ emessage: 'Application Number already exists' });
    }
    if (updateFields.admission_no) {
      const dup = await Student.findOne({ student_id: { $ne: id }, admission_no: updateFields.admission_no });
      if (dup) return res.status(400).json({ emessage: 'Admission Number already exists' });
    }
    if (updateFields.register_no) {
      const dup = await Student.findOne({ student_id: { $ne: id }, register_no: updateFields.register_no });
      if (dup) return res.status(400).json({ emessage: 'Register Number already exists' });
    }
    if (updateFields.roll_no) {
      const dup = await Student.findOne({ student_id: { $ne: id }, roll_no: updateFields.roll_no });
      if (dup) return res.status(400).json({ emessage: 'Roll Number already exists' });
    }
    if (updateFields.aadhar_number) {
      const dup = await Student.findOne({ student_id: { $ne: id }, aadhar_number: updateFields.aadhar_number });
      if (dup) return res.status(400).json({ emessage: 'Aadhar number already exists' });
    }

    // 5. Upload new photo if provided
    if (req.file) {
      newPhotoFileId = await uploadStaffPhoto(req.file);
      uploadedNewPhoto = true;
      updateFields.photo_file_id = newPhotoFileId;
      updateFields.photo_version = Date.now();
    }

    // 6. Update Student
    const updatedStudent = await Student.findOneAndUpdate(
      { student_id: id },
      { $set: updateFields },
      { returnDocument: 'after', runValidators: true }
    ).lean();

    if (!updatedStudent) {
      if (uploadedNewPhoto && newPhotoFileId) {
        try { await deleteStaffPhoto(newPhotoFileId); } catch (e) {}
      }
      return res.status(500).json({ success: false, message: 'Student update failed' });
    }

    // 7. Update User
    await User.findOneAndUpdate(
      { username: id },
      {
        $set: {
          email: updateFields.email,
          name: `${updateFields.first_name} ${updateFields.middle_name || ''} ${updateFields.last_name}`.trim(),
          profile_image: buildPhotoUrl(id, updatedStudent.photo_file_id, updatedStudent.photo_version),
        },
      },
      { runValidators: true }
    );

    // 8. Delete old photo if new uploaded
    if (uploadedNewPhoto && existingStudent.photo_file_id && existingStudent.photo_file_id !== newPhotoFileId) {
      try {
        await deleteStaffPhoto(existingStudent.photo_file_id);
        console.log('Old student photo deleted:', existingStudent.photo_file_id);
      } catch (e) {
        console.error('Failed to delete old student photo:', e);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Student updated successfully',
      data: {
        student_id: updatedStudent.student_id,
        photo_file_id: updatedStudent.photo_file_id || null,
        photo_version: updatedStudent.photo_version || 0,
        profile_image: buildPhotoUrl(id, updatedStudent.photo_file_id, updatedStudent.photo_version) || '/user.png',
      },
    });
  } catch (error) {
    console.error('Error updating student:', error);
    if (uploadedNewPhoto && newPhotoFileId) {
      try { await deleteStaffPhoto(newPhotoFileId); } catch (e) {}
    }
    return res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
});

// ============================================================
// 7. DELETE /:id
// ============================================================
router.delete('/:id', async (req, res) => {
  const role = req.user?.role;
  if (role !== 'Admin') {
    return res.status(403).json({ success: false, message: 'Access denied', islogout: true });
  }

  try {
    await connectDB();
    const { id } = req.params;
    const student = await Student.findOne({ student_id: id });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    if (student.photo_file_id) {
      try {
        await deleteStaffPhoto(student.photo_file_id);
      } catch (e) {
        console.error('Failed to delete photo from Drive:', e);
      }
    }

    await Student.findOneAndDelete({ student_id: id });
    await User.findOneAndDelete({ username: id });

    res.status(200).json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
});

// ============================================================
// 5. POST /promote-all
// Promote ALL students to the next semester
// ADMIN ONLY
// ============================================================

router.post('/promote-all', async (req, res) => {
  const role = req.user?.role;

  // Admin only
  if (role !== 'Admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin only.',
      islogout: true,
    });
  }

  try {
    await connectDB();

    /*
    |--------------------------------------------------------------------------
    | Confirmation
    |--------------------------------------------------------------------------
    | Frontend must send:
    |
    | {
    |   "confirmation": "PROMOTE ALL STUDENTS"
    | }
    |--------------------------------------------------------------------------
    */

    const { confirmation } = req.body;

    if (confirmation !== 'PROMOTE ALL STUDENTS') {
      return res.status(400).json({
        success: false,
        message: 'Confirmation required.',
      });
    }

    // Only students who are currently Active will be promoted.
    const students = await Student.find({
      student_status: 'Active',
      semester: { $gte: 1, $lte: 8 },
    })
      .select({
        student_id: 1,
        year: 1,
        semester: 1,
      })
      .lean();

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active students found for promotion.',
      });
    }

    const bulkOperations = [];

    let semester1To2 = 0;
    let semester2To3 = 0;
    let semester3To4 = 0;
    let semester4To5 = 0;
    let semester5To6 = 0;
    let semester6To7 = 0;
    let semester7To8 = 0;
    let semester8Graduated = 0;

    for (const student of students) {
      const semester = Number(student.semester);
      const year = Number(student.year);

      let newSemester = semester;
      let newYear = year;
      let newStatus = 'Active';

      switch (semester) {
        // ----------------------------------------
        // Semester 1 -> Semester 2
        // ----------------------------------------
        case 1:
          newSemester = 2;

          semester1To2++;
          break;

        // ----------------------------------------
        // Semester 2 -> Semester 3
        // Year 1 -> Year 2
        // ----------------------------------------
        case 2:
          newSemester = 3;
          newYear = 2;

          semester2To3++;
          break;

        // ----------------------------------------
        // Semester 3 -> Semester 4
        // ----------------------------------------
        case 3:
          newSemester = 4;

          semester3To4++;
          break;

        // ----------------------------------------
        // Semester 4 -> Semester 5
        // Year 2 -> Year 3
        // ----------------------------------------
        case 4:
          newSemester = 5;
          newYear = 3;

          semester4To5++;
          break;

        // ----------------------------------------
        // Semester 5 -> Semester 6
        // ----------------------------------------
        case 5:
          newSemester = 6;

          semester5To6++;
          break;

        // ----------------------------------------
        // Semester 6 -> Semester 7
        // Year 3 -> Year 4
        // ----------------------------------------
        case 6:
          newSemester = 7;
          newYear = 4;

          semester6To7++;
          break;

        // ----------------------------------------
        // Semester 7 -> Semester 8
        // ----------------------------------------
        case 7:
          newSemester = 8;

          semester7To8++;
          break;

        // ----------------------------------------
        // Semester 8 -> Graduated
        // ----------------------------------------
        case 8:
          newSemester = 8;
          newYear = 4;
          newStatus = 'Graduated';

          semester8Graduated++;
          break;

        default:
          continue;
      }

      bulkOperations.push({
        updateOne: {
          filter: {
            student_id: student.student_id,
          },
          update: {
            $set: {
              year: newYear,
              semester: newSemester,
              student_status: newStatus,
            },
          },
        },
      });
    }

    if (bulkOperations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid students found for promotion.',
      });
    }

    // Execute all updates efficiently
    const result = await Student.bulkWrite(bulkOperations);

    return res.status(200).json({
      success: true,
      message: 'All students promoted successfully.',
      data: {
        totalStudents: students.length,
        modifiedStudents: result.modifiedCount,

        promotion: {
          semester1To2,
          semester2To3,
          semester3To4,
          semester4To5,
          semester5To6,
          semester6To7,
          semester7To8,
          semester8Graduated,
        },
      },
    });
  } catch (error) {
    console.error('Error promoting all students:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to promote students.',
      error: error.message,
    });
  }
});


// ============================================================
// 6. POST /depromote-all
// Move ALL students to the previous semester
// ADMIN ONLY
// ============================================================

router.post('/depromote-all', async (req, res) => {
  const role = req.user?.role;

  // Admin only
  if (role !== 'Admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin only.',
      islogout: true,
    });
  }

  try {
    await connectDB();

    /*
    |--------------------------------------------------------------------------
    | Confirmation
    |--------------------------------------------------------------------------
    |
    | Frontend must send:
    |
    | {
    |   "confirmation": "DEPROMOTE ALL STUDENTS"
    | }
    |--------------------------------------------------------------------------
    */

    const { confirmation } = req.body;

    if (confirmation !== 'DEPROMOTE ALL STUDENTS') {
      return res.status(400).json({
        success: false,
        message: 'Confirmation required.',
      });
    }

    // Get active + graduated students
    const students = await Student.find({
      student_status: {
        $in: ['Active', 'Graduated'],
      },
      semester: {
        $gte: 1,
        $lte: 8,
      },
    })
      .select({
        student_id: 1,
        year: 1,
        semester: 1,
        student_status: 1,
      })
      .lean();

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No students found for depromotion.',
      });
    }

    const bulkOperations = [];

    let semester2To1 = 0;
    let semester3To2 = 0;
    let semester4To3 = 0;
    let semester5To4 = 0;
    let semester6To5 = 0;
    let semester7To6 = 0;
    let semester8To7 = 0;
    let graduatedTo8 = 0;

    for (const student of students) {
      const semester = Number(student.semester);
      const year = Number(student.year);

      let newSemester = semester;
      let newYear = year;
      let newStatus = 'Active';

      switch (semester) {
        // ----------------------------------------
        // Semester 1
        // Cannot go below semester 1
        // ----------------------------------------
        case 1:
          newSemester = 1;
          newYear = 1;
          newStatus = 'Active';

          break;

        // ----------------------------------------
        // Semester 2 -> Semester 1
        // ----------------------------------------
        case 2:
          newSemester = 1;
          newYear = 1;

          semester2To1++;
          break;

        // ----------------------------------------
        // Semester 3 -> Semester 2
        // Year 2 -> Year 1
        // ----------------------------------------
        case 3:
          newSemester = 2;
          newYear = 1;

          semester3To2++;
          break;

        // ----------------------------------------
        // Semester 4 -> Semester 3
        // ----------------------------------------
        case 4:
          newSemester = 3;
          newYear = 2;

          semester4To3++;
          break;

        // ----------------------------------------
        // Semester 5 -> Semester 4
        // Year 3 -> Year 2
        // ----------------------------------------
        case 5:
          newSemester = 4;
          newYear = 2;

          semester5To4++;
          break;

        // ----------------------------------------
        // Semester 6 -> Semester 5
        // ----------------------------------------
        case 6:
          newSemester = 5;
          newYear = 3;

          semester6To5++;
          break;

        // ----------------------------------------
        // Semester 7 -> Semester 6
        // Year 4 -> Year 3
        // ----------------------------------------
        case 7:
          newSemester = 6;
          newYear = 3;

          semester7To6++;
          break;

        // ----------------------------------------
        // Semester 8 -> Semester 7
        // ----------------------------------------
        case 8:
          newSemester = 7;
          newYear = 4;

          // If this student was graduated,
          // make them active again.
          newStatus = 'Active';

          if (student.student_status === 'Graduated') {
            graduatedTo8++;
          } else {
            semester8To7++;
          }

          break;

        default:
          continue;
      }

      bulkOperations.push({
        updateOne: {
          filter: {
            student_id: student.student_id,
          },
          update: {
            $set: {
              year: newYear,
              semester: newSemester,
              student_status: newStatus,
            },
          },
        },
      });
    }

    if (bulkOperations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid students found for depromotion.',
      });
    }

    const result = await Student.bulkWrite(bulkOperations);

    return res.status(200).json({
      success: true,
      message: 'All students depromoted successfully.',
      data: {
        totalStudents: students.length,
        modifiedStudents: result.modifiedCount,

        depromotion: {
          semester2To1,
          semester3To2,
          semester4To3,
          semester5To4,
          semester6To5,
          semester7To6,
          semester8To7,
          graduatedTo8,
        },
      },
    });
  } catch (error) {
    console.error('Error depromoting all students:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to depromote students.',
      error: error.message,
    });
  }
});

module.exports = router;