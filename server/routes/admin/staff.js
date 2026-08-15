const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const Staff = require('../../models/Staff');
const User = require('../../models/User');

// ----- Multer Configuration -----
const uploadDir = path.resolve(__dirname, "../../uploads/staff");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only JPG, JPEG and PNG files are allowed"));
    }
    cb(null, true);
  },
});

// ----- Helper Functions -----
const nullIfEmpty = (value) => {
  return (value && value.trim() !== '') ? value : null;
};

const deleteUploadedImage = (filename) => {
  if (!filename) return;
  const filePath = path.join(uploadDir, filename);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Deleted uploaded image: ${filename}`);
    }
  } catch (error) {
    console.error(`Error deleting image ${filename}:`, error);
  }
};

// ----- Validation Constants (shared) -----
const nameRegex = /^[A-Za-z ]+$/;
const phoneRegex = /^\d{10}$/;
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/;
const validGender = ["Male", "Female", "Other"];
const validEmploymentType = ["FullTime", "PartTime", "Contract", "Temporary"];
const validStaffStatus = ["Active", "Inactive", "Resigned", "Retired"];
const validRoleType = ["Admin", "Hod", "Staff", "Student", "Accountant"];
const validDesignation = [
  "Professor", "Assistant Professor", "Associate Professor",
  "Lecturer", "Lab Assistant", "Clerk", "Accountant",
  "Manager", "Director", "Principal", "HOD"
];
const validBloodGroup = [
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-',
  'O+', 'O-', 'A1+', 'A1-', 'A2+', 'A2-',
  'A1B+', 'A1B-', 'A2B+', 'A2B-'
];
const validMaritalStatus = ["Single", "Married", "Divorced", "Widowed"];

// ----- POST /add -----
router.post('/add', upload.single('photo'), async (req, res) => {
  let uploadedFileName = null;
  const role = req.user?.role;
    if (role !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        islogout: true
      });
    }
  
  try {
    const staffData = req.body;
    
    if (req.file) {
      uploadedFileName = req.file.filename;
    }

    const sendError = (message, statusCode = 400) => {
      if (uploadedFileName) {
        deleteUploadedImage(uploadedFileName);
      }
      return res.status(statusCode).json({ emessage: message });
    };

    if (!staffData || Object.keys(staffData).length === 0) {
      return sendError("Staff data is required");
    }

    const photo_url = req.file ? `/uploads/staff/${req.file.filename}` : null;

    const {
      staff_id, prefix, first_name, last_name,staff_code, gender, date_of_birth,
      phone_number, email, personal_email, address, city, state, pincode,
      emergency_contact_name, emergency_contact_number,
      department_code, designation, role_type, employment_type,
      joining_date, experience_years, staff_status,
      highest_qualification, specialization,
      university, passing_year,
      aadhar_number, pan_number, bank_name, account_number,
      ifsc_code, branch_name, salary, blood_group, marital_status
    } = staffData;

    // ----- Required Fields -----
    if (!staff_id?.trim()) return sendError("Staff ID is required");
    if (!prefix?.trim()) return sendError("Prefix is required");
    if (!req.file) return sendError("Photo is required");
    if (!first_name?.trim()) return sendError("First name is required");
    if (!last_name?.trim()) return sendError("Last name is required");
    if (!gender?.trim()) return sendError("Gender is required");
    if (!phone_number?.trim()) return sendError("Phone number is required");
    if (!email?.trim()) return sendError("Email is required");
    if (!department_code) return sendError("Department is required");
    if (!designation) return sendError("Designation is required");
    if (!role_type) return sendError("Role type is required");
    if (!joining_date) return sendError("Joining date is required");
    if (!staff_status) return sendError("Staff status is required");
    if (!staff_code) return sendError("Staff Code is required");

    // ----- Field-specific Validations -----
    if (!nameRegex.test(first_name)) return sendError("Invalid first name");
    if (!nameRegex.test(last_name)) return sendError("Invalid last name");
    if (!validGender.includes(gender)) return sendError("Invalid gender");
    if (!phoneRegex.test(phone_number)) return sendError("Invalid phone number (must be 10 digits)");
    if (emergency_contact_number && !phoneRegex.test(emergency_contact_number))
      return sendError("Invalid emergency contact number (must be 10 digits)");
    if (!emailRegex.test(email)) return sendError("Invalid email address");
    if (personal_email && !emailRegex.test(personal_email)) return sendError("Invalid personal email address");
    if (!validRoleType.includes(role_type)) return sendError("Invalid role type");
    if (!validDesignation.includes(designation)) return sendError("Invalid designation");
    if (employment_type && !validEmploymentType.includes(employment_type))
      return sendError("Invalid employment type");
    if (!validStaffStatus.includes(staff_status)) return sendError("Invalid staff status");
    if (address && address.trim().length < 5) return sendError("Address must be at least 5 characters");
    if (city && !nameRegex.test(city)) return sendError("Invalid city (letters and spaces only)");
    if (state && !nameRegex.test(state)) return sendError("Invalid state (letters and spaces only)");
    if (pincode && !/^\d{6}$/.test(pincode)) return sendError("Invalid pincode (must be 6 digits)");
    if (emergency_contact_name && !nameRegex.test(emergency_contact_name))
      return sendError("Invalid emergency contact name");
    if (date_of_birth && new Date(date_of_birth) > new Date())
      return sendError("Date of birth cannot be in future");
    if (date_of_birth && new Date(date_of_birth).getFullYear() < 1940)
      return sendError("Invalid date of birth");
    if (new Date(joining_date) > new Date())
      return sendError("Joining date cannot be in future");
    if (experience_years) {
      const expNum = Number(experience_years);
      if (isNaN(expNum) || expNum < 0 || expNum > 70) {
        return sendError("Experience years must be a number between 0 and 70");
      }
    }
    if (aadhar_number && !/^\d{12}$/.test(aadhar_number))
      return sendError("Aadhar must contain 12 digits");
    if (pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan_number))
      return sendError("Invalid PAN number format");
    if (bank_name && bank_name.trim().length < 2)
      return sendError("Bank name must be at least 2 characters");
    if (account_number && !/^\d{9,18}$/.test(account_number))
      return sendError("Invalid account number (9-18 digits)");
    if (branch_name && branch_name.trim().length < 2)
      return sendError("Branch name must be at least 2 characters");
    if (salary) {
      const salaryNum = Number(salary);
      if (isNaN(salaryNum) || salaryNum < 0 || salaryNum > 10000000) {
        return sendError("Salary must be between 0 and 10,000,000");
      }
    }
    if (highest_qualification && highest_qualification.trim().length < 2)
      return sendError("Qualification must be at least 2 characters");
    if (specialization && specialization.trim().length < 2)
      return sendError("Specialization must be at least 2 characters");
    if (blood_group && !validBloodGroup.includes(blood_group))
      return sendError("Invalid blood group");
    if (marital_status && !validMaritalStatus.includes(marital_status))
      return sendError("Invalid marital status");

    // ----- Build Staff Document -----
    const staffDoc = {
      staff_id: staff_id.trim(),
      prefix: prefix.trim(),
      photo_url,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      staff_code:staff_code.trim(),
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
      joining_date: joining_date,
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
      marital_status: nullIfEmpty(marital_status)
    };

    // ----- Check Duplicates in Staff -----
    const existingStaff = await Staff.findOne({
      $or: [
        { staff_id: staffDoc.staff_id },
        { email: staffDoc.email },
        { phone_number: staffDoc.phone_number }
      ]
    });
    if (existingStaff) {
      return sendError("Staff with the same ID, email, or phone already exists");
    }

    if (staffDoc.aadhar_number) {
      const existingAadhar = await Staff.findOne({ aadhar_number: staffDoc.aadhar_number });
      if (existingAadhar) {
        return sendError("Staff with the same Aadhar number already exists");
      }
    }
    if (staffDoc.pan_number) {
      const existingPan = await Staff.findOne({ pan_number: staffDoc.pan_number });
      if (existingPan) {
        return sendError("Staff with the same PAN number already exists");
      }
    }

    // ----- Check Duplicates in Users -----
    const existingUser = await User.findOne({
      $or: [
        { username: staffDoc.staff_id },
        { email: staffDoc.email }
      ]
    });
    if (existingUser) {
      return sendError("Username or email already in use");
    }

    // ----- Create Staff -----
    const newStaff = new Staff(staffDoc);
    await newStaff.save();

    // ----- Create User with default password -----
    const defaultPassword = "Staff@123";
    // Map incoming role to one of the User model's enum values (case-insensitive)
    const normalizedInput = (staffDoc.role_type || '').toString().trim().toLowerCase();
    const allowedUserRoles = (User.schema && User.schema.path('role') && User.schema.path('role').enumValues) || [];
    let userRole = allowedUserRoles.find(r => r.toLowerCase() === normalizedInput);
    if (!userRole) userRole = allowedUserRoles.length ? allowedUserRoles[0] : 'Staff';

    const newUser = new User({
      username: staffDoc.staff_id,
      email: staffDoc.email,
      password: defaultPassword,
      name: `${staffDoc.prefix} ${staffDoc.first_name} ${staffDoc.last_name}`.trim(),
      role: userRole,
      profile_image: staffDoc.photo_url
    });
    await newUser.save();

    res.status(201).json({
      success: true,
      message: "Staff added successfully",
      photo_url: photo_url
    });

  } catch (error) {
    console.error("Error adding staff:", error);
    if (uploadedFileName) {
      deleteUploadedImage(uploadedFileName);
    }
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
});

// ----- GET / (List) -----
router.get('/', async (req, res) => {
  const role = req.user?.role;
    if (role !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        islogout: true
      });
    }
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      department = '',
      designation = '',
      status = '',
      category = ''
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const filter = {};

    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { staff_id: searchRegex },
        { first_name: searchRegex },
        { last_name: searchRegex },
        { email: searchRegex }
      ];
    }

    if (department && department.trim() !== '') {
      filter.department_code = department.trim();
    }
    if (designation && designation.trim() !== '') {
      filter.designation = designation.trim();
    }
    if (status && status.trim() !== '') {
      filter.staff_status = status.trim();
    }
    if (category && category.trim() !== '') {
      filter.role_type = category.trim();
    }

    // Count total matching
    const totalItems = await Staff.countDocuments(filter);

    // Fetch staff with pagination
    const staffList = await Staff.find(filter)
      .select({
        staff_id: 1,
        first_name: 1,
        last_name: 1,
        prefix: 1,
        department_code: 1,
        designation: 1,
        staff_code:1,
        role_type: 1,
        email: 1,
        phone_number: 1,
        staff_status: 1,
        employment_type: 1,
        joining_date: 1,
        photo_url: 1,
        _id: 0
      })
      .sort({ staff_id: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Format staff list
    const formattedStaff = staffList.map(staff => ({
      id: staff.staff_id,
      image: staff.photo_url || null,
      name: `${staff.prefix || ''} ${staff.first_name || ''} ${staff.last_name || ''}`.trim(),
      staffCode: staff.staff_code,
      department: staff.department_code || '',
      designation: staff.designation || '',
      category: staff.role_type || '',
      email: staff.email || '',
      phone: staff.phone_number || '',
      status: staff.staff_status || 'Inactive',
      type: staff.employment_type || '',
      joiningDate: staff.joining_date || ''
    }));

    // ----- Stats Aggregation -----
    const statsResult = await Staff.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalStaff: { $sum: 1 },
          activeStaff: {
            $sum: { $cond: [{ $eq: ['$staff_status', 'Active'] }, 1, 0] }
          },
          teachingStaff: {
            $sum: {
              $cond: [
                { $in: ['$designation', ['Professor', 'Assistant Professor', 'Associate Professor', 'Lecturer', 'HOD']] },
                1,
                0
              ]
            }
          },
          nonTeachingStaff: {
            $sum: {
              $cond: [
                { $in: ['$designation', ['Lab Assistant', 'Clerk', 'Accountant', 'Manager', 'Director']] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const stats = statsResult[0] || {
      totalStaff: 0,
      activeStaff: 0,
      teachingStaff: 0,
      nonTeachingStaff: 0
    };

    // ----- Distinct departments and designations -----
    const departmentList = await Staff.distinct('department_code', {
      department_code: { $ne: null }
    });
    const designationList = await Staff.distinct('designation', {
      designation: { $ne: null }
    });

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
          endIndex
        },
        stats: {
          totalStaff: stats.totalStaff || 0,
          activeStaff: stats.activeStaff || 0,
          teachingStaff: stats.teachingStaff || 0,
          nonTeachingStaff: stats.nonTeachingStaff || 0
        },
        filters: {
          departments: departmentList.filter(d => d),
          designations: designationList.filter(d => d)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching staff list:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message
    });
  }
});
// ============================================================
// GET /all
// Get all staff members
// Used by timetable and other master-data pages
// ============================================================
router.get('/all', async (req, res) => {
  const role = req.user?.role;

  // Admin only
  if (role !== 'Admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied',
      islogout: true
    });
  }

  try {
    const staffList = await Staff.find({
      staff_status: { $ne: 'Inactive' }
    })
      .select({
        _id: 1,
        staff_id: 1,
        prefix: 1,
        first_name: 1,
        last_name: 1,
        staff_code: 1,
        department_code: 1,
        designation: 1,
        role_type: 1,
        staff_status: 1
      })
      .sort({
        department_code: 1,
        staff_code: 1
      })
      .lean();

    res.status(200).json({
      success: true,
      data: staffList
    });

  } catch (error) {
    console.error('Error fetching all staff:', error);

    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message
    });
  }
});


// ----- GET /:id -----
router.get('/:id', async (req, res) => {
  const role = req.user?.role;
    if (role !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        islogout: true
      });
    }
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Staff ID is required'
      });
    }

    const staff = await Staff.findOne({ staff_id: id }).lean();
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Format helpers
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
      if (num >= 10000000) {
        return `₹${(num / 10000000).toFixed(1)} Crore / Year`;
      } else if (num >= 100000) {
        return `₹${(num / 100000).toFixed(1)} Lakh / Year`;
      } else {
        return `₹${num.toLocaleString()} / Year`;
      }
    };

    const staffDetails = {
      staff_id: staff.staff_id,
      prefix: staff.prefix || '',
      first_name: staff.first_name || '',
      last_name: staff.last_name || '',
      gender: staff.gender || '',
      staff_code:staff.staff_code||'',
      date_of_birth: staff.date_of_birth ? formatDate(staff.date_of_birth) : '',
      phone_number: staff.phone_number || '',
      email: staff.email || '',
      personal_email:staff.personal_email||'',
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
      profile_image: staff.photo_url || '/user.png',
      full_name: `${staff.prefix || ''} ${staff.first_name || ''} ${staff.last_name || ''}`.trim()
    };

    res.status(200).json({
      success: true,
      data: staffDetails
    });

  } catch (error) {
    console.error('Error fetching staff details:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message
    });
  }
});

// ----- PUT /:id -----
router.put('/:id', upload.single('photo'), async (req, res) => {
  const role = req.user?.role;
    if (role !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        islogout: true
      });
    }
  let uploadedFileName = null;
  
  try {
    const { id } = req.params;
    const staffData = req.body;
    
    if (req.file) {
      uploadedFileName = req.file.filename;
    }

    const sendError = (message, statusCode = 400) => {
      if (uploadedFileName) {
        deleteUploadedImage(uploadedFileName);
      }
      return res.status(statusCode).json({ emessage: message });
    };

    // Find existing staff
    const existingStaff = await Staff.findOne({ staff_id: id });
    if (!existingStaff) {
      return sendError('Staff member not found', 404);
    }

    const photo_url = req.file ? `/uploads/staff/${req.file.filename}` : existingStaff.photo_url;

    const {
      prefix, first_name, last_name,staff_code, gender, date_of_birth,
      phone_number, email, personal_email, address, city, state, pincode,
      emergency_contact_name, emergency_contact_number,
      department_code, designation, role_type, employment_type,
      joining_date, experience_years, staff_status,
      highest_qualification, specialization, university, passing_year,
      aadhar_number, pan_number, bank_name, account_number,
      ifsc_code, branch_name, salary, blood_group, marital_status
    } = staffData;

    // ----- Validation (same as POST) -----
    if (!prefix?.trim()) return sendError("Prefix is required");
    if (!first_name?.trim()) return sendError("First name is required");
    if (!last_name?.trim()) return sendError("Last name is required");
    if (!staff_code.trim()) return sendError("Staff Code is required")
    if (!gender?.trim()) return sendError("Gender is required");
    if (!phone_number?.trim()) return sendError("Phone number is required");
    if (!email?.trim()) return sendError("Email is required");
    if (!department_code) return sendError("Department is required");
    if (!designation) return sendError("Designation is required");
    if (!role_type) return sendError("Role type is required");
    if (!joining_date) return sendError("Joining date is required");
    if (!staff_status) return sendError("Staff status is required");

    if (!nameRegex.test(first_name)) return sendError("Invalid first name");
    if (!nameRegex.test(last_name)) return sendError("Invalid last name");
    if (!validGender.includes(gender)) return sendError("Invalid gender");
    if (!phoneRegex.test(phone_number)) return sendError("Invalid phone number (must be 10 digits)");
    if (emergency_contact_number && !phoneRegex.test(emergency_contact_number))
      return sendError("Invalid emergency contact number (must be 10 digits)");
    if (!emailRegex.test(email)) return sendError("Invalid email address");
    if (personal_email && !emailRegex.test(personal_email)) return sendError("Invalid personal email address");
    if (!validRoleType.includes(role_type)) return sendError("Invalid role type");
    if (!validDesignation.includes(designation)) return sendError("Invalid designation");
    if (employment_type && !validEmploymentType.includes(employment_type))
      return sendError("Invalid employment type");
    if (!validStaffStatus.includes(staff_status)) return sendError("Invalid staff status");
    if (address && address.trim().length < 5) return sendError("Address must be at least 5 characters");
    if (city && !nameRegex.test(city)) return sendError("Invalid city (letters and spaces only)");
    if (state && !nameRegex.test(state)) return sendError("Invalid state (letters and spaces only)");
    if (pincode && !/^\d{6}$/.test(pincode)) return sendError("Invalid pincode (must be 6 digits)");
    if (emergency_contact_name && !nameRegex.test(emergency_contact_name))
      return sendError("Invalid emergency contact name");
    if (date_of_birth && new Date(date_of_birth) > new Date())
      return sendError("Date of birth cannot be in future");
    if (date_of_birth && new Date(date_of_birth).getFullYear() < 1940)
      return sendError("Invalid date of birth");
    if (new Date(joining_date) > new Date())
      return sendError("Joining date cannot be in future");
    if (experience_years) {
      const expNum = Number(experience_years);
      if (isNaN(expNum) || expNum < 0 || expNum > 70) {
        return sendError("Experience years must be a number between 0 and 70");
      }
    }
    if (aadhar_number && !/^\d{12}$/.test(aadhar_number))
      return sendError("Aadhar must contain 12 digits");
    if (pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan_number))
      return sendError("Invalid PAN number format");
    if (bank_name && bank_name.trim().length < 2)
      return sendError("Bank name must be at least 2 characters");
    if (account_number && !/^\d{9,18}$/.test(account_number))
      return sendError("Invalid account number (9-18 digits)");
    if (branch_name && branch_name.trim().length < 2)
      return sendError("Branch name must be at least 2 characters");
    if (salary) {
      const salaryNum = Number(salary);
      if (isNaN(salaryNum) || salaryNum < 0 || salaryNum > 10000000) {
        return sendError("Salary must be between 0 and 10,000,000");
      }
    }
    if (highest_qualification && highest_qualification.trim().length < 2)
      return sendError("Qualification must be at least 2 characters");
    if (specialization && specialization.trim().length < 2)
      return sendError("Specialization must be at least 2 characters");
    if (blood_group && !validBloodGroup.includes(blood_group))
      return sendError("Invalid blood group");
    if (marital_status && !validMaritalStatus.includes(marital_status))
      return sendError("Invalid marital status");

    // ----- Build update object -----
    const updateFields = {
      prefix: prefix.trim(),
      photo_url: photo_url,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      staff_code:staff_code.trim(),
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
      joining_date: joining_date,
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
      marital_status: nullIfEmpty(marital_status)
    };

    // ----- Check duplicates (excluding current) -----
    const duplicateStaff = await Staff.findOne({
      $and: [
        { staff_id: { $ne: id } },
        {
          $or: [
            { email: updateFields.email },
            { phone_number: updateFields.phone_number }
          ]
        }
      ]
    });
    if (duplicateStaff) {
      return sendError("Email or phone already in use by another staff member");
    }

    if (updateFields.aadhar_number) {
      const existingAadhar = await Staff.findOne({
        staff_id: { $ne: id },
        aadhar_number: updateFields.aadhar_number
      });
      if (existingAadhar) {
        return sendError("Aadhar number already in use by another staff member");
      }
    }
    if (updateFields.pan_number) {
      const existingPan = await Staff.findOne({
        staff_id: { $ne: id },
        pan_number: updateFields.pan_number
      });
      if (existingPan) {
        return sendError("PAN number already in use by another staff member");
      }
    }

    // ----- Update Staff -----
    await Staff.findOneAndUpdate(
      { staff_id: id },
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    // ----- Update User -----
    await User.findOneAndUpdate(
      { username: id },
      {
        $set: {
          email: updateFields.email,
          role: updateFields.role_type,
          name: `${updateFields.prefix} ${updateFields.first_name} ${updateFields.last_name}`.trim(),
          profile_image: updateFields.photo_url
        }
      },
      { runValidators: true }
    );

    // Delete old image if new uploaded
    if (req.file && existingStaff.photo_url) {
      const oldImage = path.basename(existingStaff.photo_url);
      deleteUploadedImage(oldImage);
    }

    res.status(200).json({
      success: true,
      message: "Staff updated successfully",
      photo_url: photo_url
    });

  } catch (error) {
    console.error("Error updating staff:", error);
    if (uploadedFileName) {
      deleteUploadedImage(uploadedFileName);
    }
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
});




module.exports = router;