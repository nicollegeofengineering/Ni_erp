const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const connectDB = require('../../config/db');

// ---- Google Drive service ----
const {
  uploadStaffPhoto,
  getStaffPhoto,
  deleteStaffPhoto,
} = require('../../services/googleDrive');

const Staff = require('../../models/Staff');
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
const buildPhotoUrl = (staffId, photoFileId, photoVersion) =>
  photoFileId ? `/api/admin/staff/${staffId}/photo?v=${photoVersion || 0}` : null;

// ----- Validation constants -----
const nameRegex = /^[a-zA-Z\s.\-']{1,50}$/;
const phoneRegex = /^\d{10}$/;
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/;
const validGender = ['Male', 'Female', 'Other'];
const validEmploymentType = ['FullTime', 'PartTime', 'Contract', 'Temporary'];
const validStaffStatus = ['Active', 'Inactive', 'Resigned', 'Retired'];
const validRoleType = ['Admin', 'Hod', 'Staff', 'Student', 'Accountant'];
const validDesignation = [
  'Professor', 'Assistant Professor', 'Associate Professor',
  'Lecturer', 'Lab Assistant', 'Clerk', 'Accountant',
  'Manager', 'Director', 'Principal', 'HOD',
];
const validBloodGroup = [
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-',
  'O+', 'O-', 'A1+', 'A1-', 'A2+', 'A2-',
  'A1B+', 'A1B-', 'A2B+', 'A2B-',
];
const validMaritalStatus = ['Single', 'Married', 'Divorced', 'Widowed'];

// ============================================================
// 1. POST /add
// ============================================================
router.post('/add', upload.single('photo'), async (req, res) => {
  const role = req.user?.role;
  if (role !== 'Admin') {
    return res.status(403).json({ success: false, message: 'Access denied', islogout: true });
  }

  try {
    await connectDB();
    const staffData = req.body;
    if (!req.file) {
      return res.status(400).json({ success: false, emessage: 'Photo is required' });
    }

    const {
      staff_id, prefix, first_name, last_name, staff_code, gender, date_of_birth,
      phone_number, email, personal_email, address, city, state, pincode,
      emergency_contact_name, emergency_contact_number, department_code,
      designation, role_type, employment_type, joining_date, experience_years,
      staff_status, highest_qualification, specialization, university, passing_year,
      aadhar_number, pan_number, bank_name, account_number, ifsc_code,
      branch_name, salary, blood_group, marital_status,
    } = staffData;

    // ---- Required fields ----
    if (!staff_id?.trim()) return res.status(400).json({ emessage: 'Staff ID is required' });
    if (!prefix?.trim()) return res.status(400).json({ emessage: 'Prefix is required' });
    if (!first_name?.trim()) return res.status(400).json({ emessage: 'First name is required' });
    if (!last_name?.trim()) return res.status(400).json({ emessage: 'Last name is required' });
    if (!staff_code?.trim()) return res.status(400).json({ emessage: 'Staff Code is required' });
    if (!gender?.trim()) return res.status(400).json({ emessage: 'Gender is required' });
    if (!phone_number?.trim()) return res.status(400).json({ emessage: 'Phone number is required' });
    if (!email?.trim()) return res.status(400).json({ emessage: 'Email is required' });
    if (!department_code?.trim()) return res.status(400).json({ emessage: 'Department is required' });
    if (!designation?.trim()) return res.status(400).json({ emessage: 'Designation is required' });
    if (!role_type?.trim()) return res.status(400).json({ emessage: 'Role type is required' });
    if (!joining_date) return res.status(400).json({ emessage: 'Joining date is required' });
    if (!staff_status?.trim()) return res.status(400).json({ emessage: 'Staff status is required' });

    // ---- Format validations ----
    if (!nameRegex.test(first_name)) return res.status(400).json({ emessage: 'Invalid first name' });
    if (!nameRegex.test(last_name)) return res.status(400).json({ emessage: 'Invalid last name' });
    if (!validGender.includes(gender)) return res.status(400).json({ emessage: 'Invalid gender' });
    if (!phoneRegex.test(phone_number)) return res.status(400).json({ emessage: 'Invalid phone number (must be 10 digits)' });
    if (emergency_contact_number && !phoneRegex.test(emergency_contact_number))
      return res.status(400).json({ emessage: 'Invalid emergency contact number (must be 10 digits)' });
    if (!emailRegex.test(email)) return res.status(400).json({ emessage: 'Invalid email address' });
    if (personal_email && !emailRegex.test(personal_email))
      return res.status(400).json({ emessage: 'Invalid personal email address' });
    if (!validRoleType.includes(role_type)) return res.status(400).json({ emessage: 'Invalid role type' });
    if (!validDesignation.includes(designation)) return res.status(400).json({ emessage: 'Invalid designation' });
    if (employment_type && !validEmploymentType.includes(employment_type))
      return res.status(400).json({ emessage: 'Invalid employment type' });
    if (!validStaffStatus.includes(staff_status)) return res.status(400).json({ emessage: 'Invalid staff status' });
    if (address && address.trim().length < 5) return res.status(400).json({ emessage: 'Address must be at least 5 characters' });
    if (city && !nameRegex.test(city)) return res.status(400).json({ emessage: 'Invalid city (letters and spaces only)' });
    if (state && !nameRegex.test(state)) return res.status(400).json({ emessage: 'Invalid state (letters and spaces only)' });
    if (pincode && !/^\d{6}$/.test(pincode)) return res.status(400).json({ emessage: 'Invalid pincode (must be 6 digits)' });
    if (emergency_contact_name && !nameRegex.test(emergency_contact_name))
      return res.status(400).json({ emessage: 'Invalid emergency contact name' });
    if (date_of_birth && new Date(date_of_birth) > new Date())
      return res.status(400).json({ emessage: 'Date of birth cannot be in future' });
    if (date_of_birth && new Date(date_of_birth).getFullYear() < 1940)
      return res.status(400).json({ emessage: 'Invalid date of birth' });
    if (new Date(joining_date) > new Date())
      return res.status(400).json({ emessage: 'Joining date cannot be in future' });
    if (experience_years) {
      const expNum = Number(experience_years);
      if (isNaN(expNum) || expNum < 0 || expNum > 70)
        return res.status(400).json({ emessage: 'Experience years must be a number between 0 and 70' });
    }
    if (aadhar_number && !/^\d{12}$/.test(aadhar_number))
      return res.status(400).json({ emessage: 'Aadhar must contain 12 digits' });
    if (pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan_number))
      return res.status(400).json({ emessage: 'Invalid PAN number format' });
    if (bank_name && bank_name.trim().length < 2)
      return res.status(400).json({ emessage: 'Bank name must be at least 2 characters' });
    if (account_number && !/^\d{9,18}$/.test(account_number))
      return res.status(400).json({ emessage: 'Invalid account number (9-18 digits)' });
    if (branch_name && branch_name.trim().length < 2)
      return res.status(400).json({ emessage: 'Branch name must be at least 2 characters' });
    if (salary) {
      const salaryNum = Number(salary);
      if (isNaN(salaryNum) || salaryNum < 0 || salaryNum > 10000000)
        return res.status(400).json({ emessage: 'Salary must be between 0 and 10,000,000' });
    }
    if (highest_qualification && highest_qualification.trim().length < 2)
      return res.status(400).json({ emessage: 'Qualification must be at least 2 characters' });
    if (specialization && specialization.trim().length < 2)
      return res.status(400).json({ emessage: 'Specialization must be at least 2 characters' });
    if (blood_group && !validBloodGroup.includes(blood_group))
      return res.status(400).json({ emessage: 'Invalid blood group' });
    if (marital_status && !validMaritalStatus.includes(marital_status))
      return res.status(400).json({ emessage: 'Invalid marital status' });

    // ---- Check duplicates in Staff ----
    const existingStaff = await Staff.findOne({
      $or: [
        { staff_id: staff_id.trim() },
        { email: email.trim().toLowerCase() },
        { phone_number: phone_number.trim() },
      ],
    });
    if (existingStaff) return res.status(400).json({ emessage: 'Staff with the same ID, email, or phone already exists' });

    if (aadhar_number) {
      const existingAadhar = await Staff.findOne({ aadhar_number: aadhar_number.trim() });
      if (existingAadhar) return res.status(400).json({ emessage: 'Staff with the same Aadhar number already exists' });
    }
    if (pan_number) {
      const existingPan = await Staff.findOne({ pan_number: pan_number.trim() });
      if (existingPan) return res.status(400).json({ emessage: 'Staff with the same PAN number already exists' });
    }

    // ---- Check duplicates in Users ----
    const existingUser = await User.findOne({
      $or: [{ username: staff_id.trim() }, { email: email.trim().toLowerCase() }],
    });
    if (existingUser) return res.status(400).json({ emessage: 'Username or email already in use' });

    // ---- Upload photo to Google Drive ----
    const photoFileId = await uploadStaffPhoto(req.file);
    const photoVersion = Date.now(); // ✅ cache-busting version, set alongside the file id

    // ---- Build staff document ----
    const staffDoc = {
      staff_id: staff_id.trim(),
      prefix: prefix.trim(),
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      staff_code: staff_code.trim(),
      gender,
      date_of_birth: date_of_birth || null,
      phone_number: phone_number.trim(),
      email: email.trim().toLowerCase(),
      personal_email: nullIfEmpty(personal_email)?.toLowerCase() || null,
      address: nullIfEmpty(address),
      city: nullIfEmpty(city),
      state: nullIfEmpty(state),
      pincode: nullIfEmpty(pincode),
      emergency_contact_name: nullIfEmpty(emergency_contact_name),
      emergency_contact_number: nullIfEmpty(emergency_contact_number),
      department_code: department_code.trim(),
      designation: designation.trim(),
      role_type,
      employment_type: nullIfEmpty(employment_type),
      joining_date,
      experience_years: experience_years ? Number(experience_years) : null,
      staff_status,
      highest_qualification: nullIfEmpty(highest_qualification),
      specialization: nullIfEmpty(specialization),
      university: nullIfEmpty(university),
      passing_year: nullIfEmpty(passing_year),
      aadhar_number: nullIfEmpty(aadhar_number),
      pan_number: nullIfEmpty(pan_number),
      bank_name: nullIfEmpty(bank_name),
      bank_account_number: nullIfEmpty(account_number),
      ifsc_code: nullIfEmpty(ifsc_code),
      branch_name: nullIfEmpty(branch_name),
      salary: salary ? Number(salary) : null,
      blood_group: nullIfEmpty(blood_group),
      marital_status: nullIfEmpty(marital_status),
      photo_file_id: photoFileId,          // ✅ only Drive file ID
      photo_version: photoVersion,          // ✅ cache-busting version
    };

    const newStaff = new Staff(staffDoc);
    await newStaff.save();

    // ---- Create User ----
    const defaultPassword = 'Staff@123';
    const normalizedInput = (staffDoc.role_type || '').toString().trim().toLowerCase();
    const allowedUserRoles = User.schema?.path('role')?.enumValues || [];
    let userRole = allowedUserRoles.find((r) => r.toLowerCase() === normalizedInput);
    if (!userRole) userRole = allowedUserRoles.length ? allowedUserRoles[0] : 'Staff';

    const newUser = new User({
      username: staffDoc.staff_id,
      email: staffDoc.email,
      password: defaultPassword,
      name: `${staffDoc.prefix || ''} ${staffDoc.first_name} ${staffDoc.last_name}`.trim(),
      role: userRole,
      profile_image: buildPhotoUrl(staffDoc.staff_id, staffDoc.photo_file_id, staffDoc.photo_version),
      isActive:true 
    });
    await newUser.save();

    return res.status(201).json({ success: true, message: 'Staff added successfully' });
  } catch (error) {
    console.error('Error adding staff:', error);
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
    const { page = 1, limit = 10, search = '', department = '', designation = '', status = '', category = '' } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { staff_id: searchRegex },
        { first_name: searchRegex },
        { last_name: searchRegex },
        { email: searchRegex },
      ];
    }
    if (department && department.trim() !== '') filter.department_code = department.trim();
    if (designation && designation.trim() !== '') filter.designation = designation.trim();
    if (status && status.trim() !== '') filter.staff_status = status.trim();
    if (category && category.trim() !== '') filter.role_type = category.trim();

    const totalItems = await Staff.countDocuments(filter);
    const staffList = await Staff.find(filter)
      .select({
        staff_id: 1, prefix: 1, first_name: 1, last_name: 1, staff_code: 1,
        department_code: 1, designation: 1, role_type: 1, email: 1,
        phone_number: 1, staff_status: 1, employment_type: 1, joining_date: 1,
        photo_file_id: 1, photo_version: 1,
      })
      .sort({ staff_id: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const formattedStaff = staffList.map((staff) => ({
      id: staff.staff_id,
      image: buildPhotoUrl(staff.staff_id, staff.photo_file_id, staff.photo_version), // ✅ versioned URL
      name: `${staff.prefix || ''} ${staff.first_name || ''} ${staff.last_name || ''}`.trim(),
      staffCode: staff.staff_code,
      department: staff.department_code || '',
      designation: staff.designation || '',
      category: staff.role_type || '',
      email: staff.email || '',
      phone: staff.phone_number || '',
      status: staff.staff_status || 'Inactive',
      type: staff.employment_type || '',
      joiningDate: staff.joining_date || '',
    }));

    // ---- Stats ----
    const statsResult = await Staff.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalStaff: { $sum: 1 },
          activeStaff: { $sum: { $cond: [{ $eq: ['$staff_status', 'Active'] }, 1, 0] } },
          teachingStaff: {
            $sum: {
              $cond: [
                { $in: ['$designation', ['Professor', 'Assistant Professor', 'Associate Professor', 'Lecturer', 'HOD']] },
                1,
                0,
              ],
            },
          },
          nonTeachingStaff: {
            $sum: {
              $cond: [
                { $in: ['$designation', ['Lab Assistant', 'Clerk', 'Accountant', 'Manager', 'Director']] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);
    const stats = statsResult[0] || { totalStaff: 0, activeStaff: 0, teachingStaff: 0, nonTeachingStaff: 0 };

    const departmentList = await Staff.distinct('department_code', { department_code: { $ne: null } });
    const designationList = await Staff.distinct('designation', { designation: { $ne: null } });

    const totalPages = Math.ceil(totalItems / limitNum);
    const startIndex = skip + 1;
    const endIndex = Math.min(skip + limitNum, totalItems);

    res.status(200).json({
      success: true,
      data: {
        staff: formattedStaff,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems,
          itemsPerPage: limitNum,
          startIndex,
          endIndex,
        },
        stats: {
          totalStaff: stats.totalStaff || 0,
          activeStaff: stats.activeStaff || 0,
          teachingStaff: stats.teachingStaff || 0,
          nonTeachingStaff: stats.nonTeachingStaff || 0,
        },
        filters: {
          departments: departmentList.filter((d) => d),
          designations: designationList.filter((d) => d),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching staff list:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
});

// ============================================================
// 3. GET /all  (for master data dropdowns)
// ============================================================
router.get('/all', async (req, res) => {
  const role = req.user?.role;
  if (role !== 'Admin' && role !== 'Hod') {
    return res.status(403).json({ success: false, message: 'Access denied', islogout: true });
  }

  try {
    await connectDB();
    const staffList = await Staff.find({ staff_status: { $ne: 'Inactive' } })
      .select({
        _id: 1, staff_id: 1, prefix: 1, first_name: 1, last_name: 1,
        staff_code: 1, department_code: 1, designation: 1, role_type: 1,
        staff_status: 1, photo_file_id: 1, photo_version: 1,
      })
      .sort({ department_code: 1, staff_code: 1 })
      .lean();

    const formatted = staffList.map((s) => ({
      ...s,
      photo_url: buildPhotoUrl(s.staff_id, s.photo_file_id, s.photo_version), // ✅ versioned URL
    }));

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error('Error fetching all staff:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
});

// ============================================================
// 4. GET /:id/photo  (secure photo endpoint) – NO CACHE
// ============================================================
router.get('/:id/photo', async (req, res) => {
  const role = req.user?.role;
  if (role !== 'Admin' && role !== 'Hod'&& role !=='Staff') {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  try {
    await connectDB();
    const { id } = req.params;
    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const staff = await Staff.findOne({
      $or: [
        { staff_id: id },
        { email: id },
        ...(isObjectId ? [{ _id: id }] : []),
      ],
    }).lean();
    if (!staff) return res.status(404).json({ success: false, message: 'Staff member not found' });
    if (!staff.photo_file_id) return res.status(404).json({ success: false, message: 'Staff photo not found' });

    const driveResponse = await getStaffPhoto(staff.photo_file_id);

    // ✅ Force no caching (secondary safeguard; the ?v= query param does the real work)
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Type', driveResponse.headers['content-type'] || 'image/jpeg');

    driveResponse.data.pipe(res);
  } catch (error) {
    console.error('Error serving staff photo:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Unable to load staff photo' });
    }
  }
});

// ============================================================
// 5. GET /:id  (single staff details)
// ============================================================
router.get('/:id', async (req, res) => {
  const role = req.user?.role;
  if (role !== 'Admin' && role !== 'Hod') {
    return res.status(403).json({ success: false, message: 'Access denied', islogout: true });
  }

  try {
    await connectDB();
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: 'Staff ID is required' });

    const staff = await Staff.findOne({ staff_id: id }).lean();
    if (!staff) return res.status(404).json({ success: false, message: 'Staff member not found' });

    const formatDate = (date) => {
      if (!date) return '';
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const formatSalary = (salary) => {
      if (!salary) return '';
      const num = parseFloat(salary);
      if (isNaN(num)) return '';
      if (num >= 10000000) return `₹${(num / 10000000).toFixed(1)} Crore / Year`;
      if (num >= 100000) return `₹${(num / 100000).toFixed(1)} Lakh / Year`;
      return `₹${num.toLocaleString()} / Year`;
    };

    const staffDetails = {
      staff_id: staff.staff_id,
      prefix: staff.prefix || '',
      first_name: staff.first_name || '',
      last_name: staff.last_name || '',
      staff_code: staff.staff_code || '',
      gender: staff.gender || '',
      date_of_birth: staff.date_of_birth ? formatDate(staff.date_of_birth) : '',
      phone_number: staff.phone_number || '',
      email: staff.email || '',
      personal_email: staff.personal_email || '',
      address: staff.address || '',
      city: staff.city || '',
      state: staff.state || '',
      pincode: staff.pincode || '',
      emergency_contact_name: staff.emergency_contact_name || '',
      emergency_contact_number: staff.emergency_contact_number || '',
      department_id: staff.department_code || '',
      designation_id: staff.designation || '',
      role_type: staff.role_type || '',
      employment_type: staff.employment_type || '',
      joining_date: staff.joining_date ? formatDate(staff.joining_date) : '',
      experience_years: staff.experience_years ? `${staff.experience_years} Years` : '',
      staff_status: staff.staff_status || 'Inactive',
      highest_qualification: staff.highest_qualification || '',
      specialization: staff.specialization || '',
      university: staff.university || '',
      passing_year: staff.passing_year || '',
      aadhar_number: staff.aadhar_number || '',
      pan_number: staff.pan_number || '',
      bank_name: staff.bank_name || '',
      account_number: staff.bank_account_number || '',
      ifsc_code: staff.ifsc_code || '',
      branch_name: staff.branch_name || '',
      salary: formatSalary(staff.salary),
      blood_group: staff.blood_group || '',
      marital_status: staff.marital_status || '',
      profile_image: buildPhotoUrl(staff.staff_id, staff.photo_file_id, staff.photo_version) || '/user.png', // ✅ versioned URL
      full_name: `${staff.prefix || ''} ${staff.first_name || ''} ${staff.last_name || ''}`.trim(),
    };

    res.status(200).json({ success: true, data: staffDetails });
  } catch (error) {
    console.error('Error fetching staff details:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
});

// Add this near the top of the file, with your other requires,
// if it isn't already there:
// const RefreshSession = require('../../models/RefreshSession');

// ============================================================
// 6. PUT /:id  (update staff – with optional photo)
// ============================================================
router.put('/:id', upload.single('photo'), async (req, res) => {
  const role = req.user?.role;
  if (role !== 'Admin') {
    return res.status(403).json({ success: false, message: 'Access denied', islogout: true });
  }

  let newPhotoFileId = null;
  let uploadedNewPhoto = false;

  try {
    await connectDB();
    const { id } = req.params;
    const staffData = req.body;

    // 1. Find existing staff
    const existingStaff = await Staff.findOne({ staff_id: id });
    if (!existingStaff) {
      return res.status(404).json({ success: false, emessage: 'Staff member not found' });
    }

    // 2. Extract and validate fields (same as POST)
    const {
      prefix, first_name, last_name, staff_code, gender, date_of_birth,
      phone_number, email, personal_email, address, city, state, pincode,
      emergency_contact_name, emergency_contact_number, department_code,
      designation, role_type, employment_type, joining_date, experience_years,
      staff_status, highest_qualification, specialization, university, passing_year,
      aadhar_number, pan_number, bank_name, account_number, ifsc_code,
      branch_name, salary, blood_group, marital_status,
    } = staffData;

    // ---- Required fields ----
    if (!prefix?.trim()) return res.status(400).json({ emessage: 'Prefix is required' });
    if (!first_name?.trim()) return res.status(400).json({ emessage: 'First name is required' });
    if (!last_name?.trim()) return res.status(400).json({ emessage: 'Last name is required' });
    if (!staff_code?.trim()) return res.status(400).json({ emessage: 'Staff Code is required' });
    if (!gender?.trim()) return res.status(400).json({ emessage: 'Gender is required' });
    if (!phone_number?.trim()) return res.status(400).json({ emessage: 'Phone number is required' });
    if (!email?.trim()) return res.status(400).json({ emessage: 'Email is required' });
    if (!department_code?.trim()) return res.status(400).json({ emessage: 'Department is required' });
    if (!designation?.trim()) return res.status(400).json({ emessage: 'Designation is required' });
    if (!role_type?.trim()) return res.status(400).json({ emessage: 'Role type is required' });
    if (!joining_date) return res.status(400).json({ emessage: 'Joining date is required' });
    if (!staff_status?.trim()) return res.status(400).json({ emessage: 'Staff status is required' });

    // ---- Format validations (same as POST) ----
    if (!nameRegex.test(first_name)) return res.status(400).json({ emessage: 'Invalid first name' });
    if (!nameRegex.test(last_name)) return res.status(400).json({ emessage: 'Invalid last name' });
    if (!validGender.includes(gender)) return res.status(400).json({ emessage: 'Invalid gender' });
    if (!phoneRegex.test(phone_number)) return res.status(400).json({ emessage: 'Invalid phone number' });
    if (emergency_contact_number && !phoneRegex.test(emergency_contact_number))
      return res.status(400).json({ emessage: 'Invalid emergency contact number' });
    if (!emailRegex.test(email)) return res.status(400).json({ emessage: 'Invalid email address' });
    if (personal_email && !emailRegex.test(personal_email))
      return res.status(400).json({ emessage: 'Invalid personal email address' });
    if (!validRoleType.includes(role_type)) return res.status(400).json({ emessage: 'Invalid role type' });
    if (!validDesignation.includes(designation)) return res.status(400).json({ emessage: 'Invalid designation' });
    if (employment_type && !validEmploymentType.includes(employment_type))
      return res.status(400).json({ emessage: 'Invalid employment type' });
    if (!validStaffStatus.includes(staff_status)) return res.status(400).json({ emessage: 'Invalid staff status' });
    if (address && address.trim().length < 5) return res.status(400).json({ emessage: 'Address must be at least 5 characters' });
    if (city && !nameRegex.test(city)) return res.status(400).json({ emessage: 'Invalid city' });
    if (state && !nameRegex.test(state)) return res.status(400).json({ emessage: 'Invalid state' });
    if (pincode && !/^\d{6}$/.test(pincode)) return res.status(400).json({ emessage: 'Invalid pincode' });
    if (emergency_contact_name && !nameRegex.test(emergency_contact_name))
      return res.status(400).json({ emessage: 'Invalid emergency contact name' });
    if (date_of_birth && new Date(date_of_birth) > new Date())
      return res.status(400).json({ emessage: 'Date of birth cannot be in future' });
    if (date_of_birth && new Date(date_of_birth).getFullYear() < 1940)
      return res.status(400).json({ emessage: 'Invalid date of birth' });
    if (new Date(joining_date) > new Date())
      return res.status(400).json({ emessage: 'Joining date cannot be in future' });
    if (experience_years) {
      const expNum = Number(experience_years);
      if (isNaN(expNum) || expNum < 0 || expNum > 70)
        return res.status(400).json({ emessage: 'Experience years must be between 0 and 70' });
    }
    if (aadhar_number && !/^\d{12}$/.test(aadhar_number))
      return res.status(400).json({ emessage: 'Aadhar must contain 12 digits' });
    if (pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan_number))
      return res.status(400).json({ emessage: 'Invalid PAN number format' });
    if (bank_name && bank_name.trim().length < 2)
      return res.status(400).json({ emessage: 'Bank name must be at least 2 characters' });
    if (account_number && !/^\d{9,18}$/.test(account_number))
      return res.status(400).json({ emessage: 'Invalid account number' });
    if (branch_name && branch_name.trim().length < 2)
      return res.status(400).json({ emessage: 'Branch name must be at least 2 characters' });
    if (salary) {
      const salaryNum = Number(salary);
      if (isNaN(salaryNum) || salaryNum < 0 || salaryNum > 10000000)
        return res.status(400).json({ emessage: 'Salary must be between 0 and 10,000,000' });
    }
    if (highest_qualification && highest_qualification.trim().length < 2)
      return res.status(400).json({ emessage: 'Qualification must be at least 2 characters' });
    if (specialization && specialization.trim().length < 2)
      return res.status(400).json({ emessage: 'Specialization must be at least 2 characters' });
    if (blood_group && !validBloodGroup.includes(blood_group))
      return res.status(400).json({ emessage: 'Invalid blood group' });
    if (marital_status && !validMaritalStatus.includes(marital_status))
      return res.status(400).json({ emessage: 'Invalid marital status' });

    // 3. Build update object (without photo)
    const updateFields = {
      prefix: prefix.trim(),
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      staff_code: staff_code.trim(),
      gender,
      date_of_birth: date_of_birth || null,
      phone_number: phone_number.trim(),
      email: email.trim().toLowerCase(),
      personal_email: nullIfEmpty(personal_email)?.toLowerCase() || null,
      address: nullIfEmpty(address),
      city: nullIfEmpty(city),
      state: nullIfEmpty(state),
      pincode: nullIfEmpty(pincode),
      emergency_contact_name: nullIfEmpty(emergency_contact_name),
      emergency_contact_number: nullIfEmpty(emergency_contact_number),
      department_code: department_code.trim(),
      designation: designation.trim(),
      role_type,
      employment_type: nullIfEmpty(employment_type),
      joining_date,
      experience_years: experience_years ? Number(experience_years) : null,
      staff_status,
      highest_qualification: nullIfEmpty(highest_qualification),
      specialization: nullIfEmpty(specialization),
      university: nullIfEmpty(university),
      passing_year: nullIfEmpty(passing_year),
      aadhar_number: nullIfEmpty(aadhar_number),
      pan_number: nullIfEmpty(pan_number),
      bank_name: nullIfEmpty(bank_name),
      bank_account_number: nullIfEmpty(account_number),
      ifsc_code: nullIfEmpty(ifsc_code),
      branch_name: nullIfEmpty(branch_name),
      salary: salary ? Number(salary) : null,
      blood_group: nullIfEmpty(blood_group),
      marital_status: nullIfEmpty(marital_status),
    };

    // 4. Check duplicates (excluding current)
    const duplicateStaff = await Staff.findOne({
      $and: [
        { staff_id: { $ne: id } },
        {
          $or: [
            { email: updateFields.email },
            { phone_number: updateFields.phone_number },
          ],
        },
      ],
    });
    if (duplicateStaff) {
      return res.status(400).json({ emessage: 'Email or phone already in use by another staff member' });
    }
    if (updateFields.aadhar_number) {
      const existingAadhar = await Staff.findOne({
        staff_id: { $ne: id },
        aadhar_number: updateFields.aadhar_number,
      });
      if (existingAadhar) return res.status(400).json({ emessage: 'Aadhar number already in use by another staff member' });
    }
    if (updateFields.pan_number) {
      const existingPan = await Staff.findOne({
        staff_id: { $ne: id },
        pan_number: updateFields.pan_number,
      });
      if (existingPan) return res.status(400).json({ emessage: 'PAN number already in use by another staff member' });
    }

    // 5. Upload new photo ONLY after validation passes
    if (req.file) {
      console.log('Uploading new staff photo...');
      newPhotoFileId = await uploadStaffPhoto(req.file);
      uploadedNewPhoto = true;
      console.log('New Google Drive photo ID:', newPhotoFileId);
      updateFields.photo_file_id = newPhotoFileId;
      updateFields.photo_version = Date.now(); // ✅ bump version so the URL changes and caches bust
    }

    // 6. Update Staff – using returnDocument: 'after' to avoid deprecation
    const updatedStaff = await Staff.findOneAndUpdate(
      { staff_id: id },
      { $set: updateFields },
      {
        returnDocument: 'after',   // ✅ instead of new: true
        runValidators: true,
      }
    ).lean();

    if (!updatedStaff) {
      if (uploadedNewPhoto && newPhotoFileId) {
        try {
          await deleteStaffPhoto(newPhotoFileId);
          console.log('Cleaned up new photo after update failure');
        } catch (cleanupError) {
          console.error('Failed to clean up new photo:', cleanupError);
        }
      }
      return res.status(500).json({ success: false, message: 'Staff update failed' });
    }

    console.log('Staff updated successfully:', updatedStaff.staff_id);
    console.log('MongoDB photo_file_id:', updatedStaff.photo_file_id, 'version:', updatedStaff.photo_version);

    // 7. Update User (deactivate if staff has resigned/retired)
    const deactivatingStatuses = ['Resigned', 'Retired'];
    const shouldDeactivate = deactivatingStatuses.includes(updateFields.staff_status);

    const updatedUser = await User.findOneAndUpdate(
      { username: id },
      {
        $set: {
          email: updateFields.email,
          role: updateFields.role_type,
          name: `${updateFields.prefix} ${updateFields.first_name} ${updateFields.last_name}`.trim(),
          profile_image: buildPhotoUrl(id, updatedStaff.photo_file_id, updatedStaff.photo_version), // ✅ versioned URL
          isActive: !shouldDeactivate,
        },
      },
      { runValidators: true, returnDocument: 'after' }
    );

    // 7b. If staff was just deactivated, revoke their active sessions so
    // they can't keep using the ERP with a still-valid refresh token.
    if (shouldDeactivate && updatedUser) {
      try {
        await RefreshSession.updateMany(
          { userId: updatedUser._id, revokedAt: null },
          { $set: { revokedAt: new Date() } }
        );
        console.log('Revoked active sessions for deactivated user:', updatedUser.username);
      } catch (revokeError) {
        // Don't fail the staff update if session revocation has an issue —
        // log it so it can be investigated separately.
        console.error('Failed to revoke sessions for deactivated user:', revokeError);
      }
    }

    // 8. Delete old photo from Drive after DB update succeeds
    if (uploadedNewPhoto && existingStaff.photo_file_id && existingStaff.photo_file_id !== newPhotoFileId) {
      try {
        await deleteStaffPhoto(existingStaff.photo_file_id);
        console.log('Old staff photo deleted:', existingStaff.photo_file_id);
      } catch (error) {
        console.error('Failed to delete old staff photo:', error);
        // don't fail the update
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Staff updated successfully',
      data: {
        staff_id: updatedStaff.staff_id,
        photo_file_id: updatedStaff.photo_file_id || null,
        photo_version: updatedStaff.photo_version || 0,
        profile_image: buildPhotoUrl(id, updatedStaff.photo_file_id, updatedStaff.photo_version) || '/user.png', // ✅ versioned URL
        isActive: updatedUser?.isActive ?? null,
      },
    });
  } catch (error) {
    console.error('Error updating staff:', error);
    if (uploadedNewPhoto && newPhotoFileId) {
      try {
        await deleteStaffPhoto(newPhotoFileId);
        console.log('Cleaned up newly uploaded Google Drive photo');
      } catch (cleanupError) {
        console.error('Failed to clean up new Google Drive photo:', cleanupError);
      }
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
    const staff = await Staff.findOne({ staff_id: id });
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found' });

    if (staff.photo_file_id) {
      try {
        await deleteStaffPhoto(staff.photo_file_id);
      } catch (error) {
        console.error('Failed to delete photo from Drive:', error);
      }
    }

    await Staff.findOneAndDelete({ staff_id: id });
    await User.findOneAndDelete({ username: id });

    res.status(200).json({ success: true, message: 'Staff deleted successfully' });
  } catch (error) {
    console.error('Error deleting staff:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
  }
});

module.exports = router;