const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

// Helper function to convert empty strings to null
const nullIfEmpty = (value) => {
  return (value && value.trim() !== '') ? value : null;
};

// Helper function to delete uploaded image
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

router.post('/add', upload.single('photo'), async (req, res) => {
  const connection = await db.getConnection();
  let uploadedFileName = null;
  
  try {
    const staffData = req.body;
    
    // Store the uploaded filename for cleanup if needed
    if (req.file) {
      uploadedFileName = req.file.filename;
    }

    // ✅ Create a reusable error handler that deletes the image
    const sendError = (message, statusCode = 400) => {
      // Delete uploaded image before sending error
      if (uploadedFileName) {
        deleteUploadedImage(uploadedFileName);
      }
      return res.status(statusCode).json({ emessage: message });
    };

    // Check if staff data exists
    if (!staffData || Object.keys(staffData).length === 0) {
      return sendError("Staff data is required");
    }

    const photo_url = req.file ? `/uploads/staff/${req.file.filename}` : null;

    const {
      staff_id, prefix, first_name, last_name, gender, date_of_birth,
      phone_number, email, address, city, state, pincode,
      emergency_contact_name, emergency_contact_number,
      department_code, designation, role_type, employment_type,
      joining_date, experience_years, staff_status,
      highest_qualification, specialization,
      aadhar_number, pan_number, bank_name, account_number,
      ifsc_code, branch_name, salary, blood_group, marital_status
    } = staffData;

    // ----- Validation Regex Patterns -----
    const nameRegex = /^[A-Za-z ]+$/;
    const phoneRegex = /^\d{10}$/;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/;
    const validGender = ["Male", "Female", "Other"];
    const validEmploymentType = ["FullTime", "PartTime", "Contract", "Temporary"];
    const validStaffStatus = ["Active", "Inactive", "On Leave", "Terminated"];
    const validRoleType = ["Teaching", "Non-Teaching", "Administrative", "Management"];
    const validBloodGroup = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
    const validMaritalStatus = ["Single", "Married", "Divorced", "Widowed"];

    // ----- Required Fields Validation -----
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

    // ----- Name Validation -----
    if (!nameRegex.test(first_name)) return sendError("Invalid first name");
    if (!nameRegex.test(last_name)) return sendError("Invalid last name");

    // ----- Gender Validation -----
    if (!validGender.includes(gender)) return sendError("Invalid gender");

    // ----- Phone Validation -----
    if (!phoneRegex.test(phone_number)) return sendError("Invalid phone number (must be 10 digits)");
    if (emergency_contact_number && !phoneRegex.test(emergency_contact_number))
      return sendError("Invalid emergency contact number (must be 10 digits)");

    // ----- Email Validation -----
    if (!emailRegex.test(email)) return sendError("Invalid email address");

    // ----- Role Type Validation -----
    if (!validRoleType.includes(role_type)) return sendError("Invalid role type");

    // ----- Employment Type Validation -----
    if (employment_type && !validEmploymentType.includes(employment_type))
      return sendError("Invalid employment type");

    // ----- Staff Status Validation -----
    if (!validStaffStatus.includes(staff_status)) return sendError("Invalid staff status");

    // ----- Address Fields Validation -----
    if (address && address.trim().length < 5) return sendError("Address must be at least 5 characters");
    if (city && !nameRegex.test(city)) return sendError("Invalid city (letters and spaces only)");
    if (state && !nameRegex.test(state)) return sendError("Invalid state (letters and spaces only)");
    if (pincode && !/^\d{6}$/.test(pincode)) return sendError("Invalid pincode (must be 6 digits)");
    if (emergency_contact_name && !nameRegex.test(emergency_contact_name))
      return sendError("Invalid emergency contact name");

    // ----- Date of Birth Validation -----
    if (date_of_birth && new Date(date_of_birth) > new Date())
      return sendError("Date of birth cannot be in future");
    if (date_of_birth && new Date(date_of_birth).getFullYear() < 1940)
      return sendError("Invalid date of birth");

    // ----- Joining Date Validation -----
    if (new Date(joining_date) > new Date())
      return sendError("Joining date cannot be in future");

    // ----- Experience Years Validation -----
    if (experience_years) {
      const expNum = Number(experience_years);
      if (isNaN(expNum) || expNum < 0 || expNum > 70) {
        return sendError("Experience years must be a number between 0 and 70");
      }
    }

    // ----- Aadhar Validation -----
    if (aadhar_number && !/^\d{12}$/.test(aadhar_number))
      return sendError("Aadhar must contain 12 digits");

    // ----- PAN Validation -----
    if (pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan_number))
      return sendError("Invalid PAN number format");

    // ----- Bank Fields Validation -----
    if (bank_name && bank_name.trim().length < 2)
      return sendError("Bank name must be at least 2 characters");
    if (account_number && !/^\d{9,18}$/.test(account_number))
      return sendError("Invalid account number (9-18 digits)");
    if (branch_name && branch_name.trim().length < 2)
      return sendError("Branch name must be at least 2 characters");

    // ----- Salary Validation -----
    if (salary) {
      const salaryNum = Number(salary);
      if (isNaN(salaryNum) || salaryNum < 0 || salaryNum > 10000000) {
        return sendError("Salary must be between 0 and 10,000,000");
      }
    }

    // ----- Education Fields Validation -----
    if (highest_qualification && highest_qualification.trim().length < 2)
      return sendError("Qualification must be at least 2 characters");
    if (specialization && specialization.trim().length < 2)
      return sendError("Specialization must be at least 2 characters");

    // ----- Blood Group Validation -----
    if (blood_group && !validBloodGroup.includes(blood_group))
      return sendError("Invalid blood group");

    // ----- Marital Status Validation -----
    if (marital_status && !validMaritalStatus.includes(marital_status))
      return sendError("Invalid marital status");

    // ----- Clean Data (Convert empty strings to NULL) -----
    const cleanData = {
      staff_id: nullIfEmpty(staff_id),
      prefix: nullIfEmpty(prefix),
      photo_url: photo_url,
      first_name: nullIfEmpty(first_name),
      last_name: nullIfEmpty(last_name),
      gender: nullIfEmpty(gender),
      date_of_birth: nullIfEmpty(date_of_birth),
      phone_number: nullIfEmpty(phone_number),
      email: nullIfEmpty(email),
      address: nullIfEmpty(address),
      city: nullIfEmpty(city),
      state: nullIfEmpty(state),
      pincode: nullIfEmpty(pincode),
      emergency_contact_name: nullIfEmpty(emergency_contact_name),
      emergency_contact_number: nullIfEmpty(emergency_contact_number),
      department_code: nullIfEmpty(department_code),
      designation: nullIfEmpty(designation),
      role_type: nullIfEmpty(role_type),
      employment_type: nullIfEmpty(employment_type),
      joining_date: nullIfEmpty(joining_date),
      experience_years: experience_years ? Number(experience_years) : null,
      staff_status: nullIfEmpty(staff_status),
      highest_qualification: nullIfEmpty(highest_qualification),
      specialization: nullIfEmpty(specialization),
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

    // ----- Check for Duplicates in Staff Table -----
    const [existingStaff] = await connection.query(
      `SELECT * FROM staff WHERE staff_id = ? OR email = ? OR phone_number = ?`,
      [cleanData.staff_id, cleanData.email, cleanData.phone_number]
    );
    if (existingStaff.length > 0) {
      return sendError("Staff with the same ID, email, or phone already exists");
    }

    // Check Aadhar if provided
    if (cleanData.aadhar_number) {
      const [existingAadhar] = await connection.query(
        `SELECT * FROM staff WHERE aadhar_number = ?`,
        [cleanData.aadhar_number]
      );
      if (existingAadhar.length > 0) {
        return sendError("Staff with the same Aadhar number already exists");
      }
    }

    // Check PAN if provided
    if (cleanData.pan_number) {
      const [existingPan] = await connection.query(
        `SELECT * FROM staff WHERE pan_number = ?`,
        [cleanData.pan_number]
      );
      if (existingPan.length > 0) {
        return sendError("Staff with the same PAN number already exists");
      }
    }

    // ----- Check for Duplicates in Users Table -----
    const [existingUser] = await connection.query(
      `SELECT * FROM users WHERE username = ? OR email = ?`,
      [cleanData.staff_id, cleanData.email]
    );
    if (existingUser.length > 0) {
      return sendError("Username or email already in use");
    }

    // ----- Insert into Staff Table -----
    const staffQuery = `
      INSERT INTO staff (
        staff_id, prefix, photo_url, first_name, last_name, gender,
        date_of_birth, phone_number, email, address, city, state,
        pincode, emergency_contact_name, emergency_contact_number,
        department_code, designation, role_type, employment_type,
        joining_date, experience_years, staff_status,
        highest_qualification, specialization, aadhar_number, pan_number,
        bank_name, bank_account_number, ifsc_code, branch_name,
        salary, blood_group, marital_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // ----- Start Transaction -----
    await connection.beginTransaction();

    // Insert into staff
    await connection.query(staffQuery, [
      cleanData.staff_id,
      cleanData.prefix,
      cleanData.photo_url,
      cleanData.first_name,
      cleanData.last_name,
      cleanData.gender,
      cleanData.date_of_birth,
      cleanData.phone_number,
      cleanData.email,
      cleanData.address,
      cleanData.city,
      cleanData.state,
      cleanData.pincode,
      cleanData.emergency_contact_name,
      cleanData.emergency_contact_number,
      cleanData.department_code,
      cleanData.designation,
      cleanData.role_type,
      cleanData.employment_type,
      cleanData.joining_date,
      cleanData.experience_years,
      cleanData.staff_status,
      cleanData.highest_qualification,
      cleanData.specialization,
      cleanData.aadhar_number,
      cleanData.pan_number,
      cleanData.bank_name,
      cleanData.bank_account_number,
      cleanData.ifsc_code,
      cleanData.branch_name,
      cleanData.salary,
      cleanData.blood_group,
      cleanData.marital_status
    ]);

    // Insert into users
    await connection.query(
      `INSERT INTO users (username, email, role) VALUES (?, ?, ?)`,
      [cleanData.staff_id, cleanData.email, cleanData.role_type]
    );

    // ----- Commit Transaction -----
    await connection.commit();

    // Success - return response
    res.status(201).json({ 
      success: true, 
      message: "Staff added successfully",
      photo_url: photo_url 
    });

  } catch (error) {
    console.error("Error adding staff:", error);
    
    // Rollback transaction
    await connection.rollback();
    
    // Delete uploaded image if any error occurs
    if (uploadedFileName) {
      deleteUploadedImage(uploadedFileName);
    }
    
    res.status(500).json({ 
      message: "Internal Server Error",
      error: error.message 
    });
  } finally {
    connection.release();
  }
});

router.get('/', async (req, res) => {
  const connection = await db.getConnection();
  
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

    // Parse pagination parameters
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    // Base query
    let baseQuery = `
      SELECT 
        staff_id,
        CONCAT(prefix, ' ', first_name, ' ', last_name) AS name,
        staff_id AS staff_code,
        department_code AS department,
        designation,
        role_type AS category,
        email,
        phone_number AS phone,
        staff_status AS status,
        employment_type AS type,
        joining_date,
        photo_url
      FROM staff
      WHERE 1=1
    `;

    // Build filter conditions
    const conditions = [];
    const params = [];

    // Search filter (staff_id, name, or email)
    if (search && search.trim() !== '') {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(`
        (staff_id LIKE ? OR 
         CONCAT(first_name, ' ', last_name) LIKE ? OR 
         email LIKE ?)
      `);
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Department filter
    if (department && department.trim() !== '') {
      conditions.push(`department_code = ?`);
      params.push(department.trim());
    }

    // Designation filter
    if (designation && designation.trim() !== '') {
      conditions.push(`designation = ?`);
      params.push(designation.trim());
    }

    // Status filter
    if (status && status.trim() !== '') {
      conditions.push(`staff_status = ?`);
      params.push(status.trim());
    }

    // Category/Role Type filter
    if (category && category.trim() !== '') {
      conditions.push(`role_type = ?`);
      params.push(category.trim());
    }

    // Add conditions to query
    if (conditions.length > 0) {
      baseQuery += ` AND ${conditions.join(' AND ')}`;
    }

    // Count query for pagination
    const countQuery = `SELECT COUNT(*) AS total FROM (${baseQuery}) AS filtered`;
    const [countResult] = await connection.query(countQuery, params);
    const totalItems = countResult[0]?.total || 0;

    // Main query with pagination
    const finalQuery = `
      ${baseQuery}
      ORDER BY staff_id ASC
      LIMIT ? OFFSET ?
    `;

    // Add pagination parameters
    const queryParams = [...params, limitNum, offset];
    const [staffList] = await connection.query(finalQuery, queryParams);

    // Get statistics (based on filtered data)
    const statsQuery = `
      SELECT 
        COUNT(*) AS totalStaff,
        SUM(CASE WHEN staff_status = 'Active' THEN 1 ELSE 0 END) AS activeStaff,
        SUM(CASE WHEN role_type = 'Teaching' THEN 1 ELSE 0 END) AS teachingStaff,
        SUM(CASE WHEN role_type = 'Non-Teaching' THEN 1 ELSE 0 END) AS nonTeachingStaff
      FROM staff
      WHERE 1=1 ${conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : ''}
    `;

    const [statsResult] = await connection.query(statsQuery, params);
    const stats = statsResult[0] || {
      totalStaff: 0,
      activeStaff: 0,
      teachingStaff: 0,
      nonTeachingStaff: 0
    };

    // Get unique departments for filter dropdown
    const [departments] = await connection.query(`
      SELECT DISTINCT department_code 
      FROM staff 
      WHERE department_code IS NOT NULL AND department_code != ''
      ORDER BY department_code ASC
    `);
    const departmentList = departments.map(d => d.department_code);

    // Get unique designations for filter dropdown
    const [designations] = await connection.query(`
      SELECT DISTINCT designation 
      FROM staff 
      WHERE designation IS NOT NULL AND designation != ''
      ORDER BY designation ASC
    `);
    const designationList = designations.map(d => d.designation);

    // Calculate pagination info
    const totalPages = Math.ceil(totalItems / limitNum);
    const startIndex = offset + 1;
    const endIndex = Math.min(offset + limitNum, totalItems);

    // Format response
    const formattedStaffList = staffList.map(staff => ({
      id: staff.staff_id,
      image: staff.photo_url || null,
      name: staff.name || '',
      staffCode: staff.staff_code || '',
      department: staff.department || '',
      designation: staff.designation || '',
      category: staff.category || '',
      email: staff.email || '',
      phone: staff.phone || '',
      status: staff.status || 'Inactive',
      type: staff.type || '',
      joiningDate: staff.joining_date || ''
    }));

    res.status(200).json({
      success: true,
      data: {
        staff: formattedStaffList,
        pagination: {
          currentPage: pageNum,
          totalPages: totalPages,
          totalItems: totalItems,
          itemsPerPage: limitNum,
          startIndex: startIndex,
          endIndex: endIndex
        },
        stats: {
          totalStaff: stats.totalStaff || 0,
          activeStaff: stats.activeStaff || 0,
          teachingStaff: stats.teachingStaff || 0,
          nonTeachingStaff: stats.nonTeachingStaff || 0
        },
        filters: {
          departments: departmentList,
          designations: designationList
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
  } finally {
    connection.release();
  }
});


router.get('/:id', async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Staff ID is required'
      });
    }

    // Query to fetch complete staff details
    const query = `
      SELECT 
        staff_id,
        prefix,
        first_name,
        last_name,
        gender,
        date_of_birth,
        phone_number,
        email,
        address,
        city,
        state,
        pincode,
        emergency_contact_name,
        emergency_contact_number,
        department_code,
        designation,
        role_type,
        employment_type,
        joining_date,
        experience_years,
        staff_status,
        highest_qualification,
        specialization,
        aadhar_number,
        pan_number,
        bank_name,
        bank_account_number,
        ifsc_code,
        branch_name,
        salary,
        blood_group,
        marital_status,
        photo_url,
        created_at,
        updated_at
      FROM staff
      WHERE staff_id = ?
    `;

    const [staffResult] = await connection.query(query, [id]);

    // Check if staff exists
    if (staffResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    const staff = staffResult[0];

    // Format the response
    const staffDetails = {
      staff_id: staff.staff_id,
      prefix: staff.prefix || '',
      first_name: staff.first_name || '',
      last_name: staff.last_name || '',
      gender: staff.gender || '',
      date_of_birth: staff.date_of_birth ? formatDate(staff.date_of_birth) : '',
      phone_number: staff.phone_number || '',
      email: staff.email || '',
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
      aadhar_number: staff.aadhar_number ? maskAadhar(staff.aadhar_number) : '',
      pan_number: staff.pan_number || '',
      bank_name: staff.bank_name || '',
      account_number: staff.bank_account_number ? maskAccountNumber(staff.bank_account_number) : '',
      ifsc_code: staff.ifsc_code || '',
      branch_name: staff.branch_name || '',
      salary: staff.salary ? formatSalary(staff.salary) : '',
      blood_group: staff.blood_group || '',
      marital_status: staff.marital_status || '',
      profile_image: staff.photo_url || '/user.png',
      // Additional fields for education (if you have a separate education table)
      university: '',
      passing_year: '',
      // Full name for display
      full_name: `${staff.prefix || ''} ${staff.first_name || ''} ${staff.last_name || ''}`.trim()
    };

    // If you have a separate education table, fetch it here
    // const [educationResult] = await connection.query(
    //   `SELECT university, passing_year, qualification FROM staff_education WHERE staff_id = ?`,
    //   [id]
    // );
    // if (educationResult.length > 0) {
    //   staffDetails.university = educationResult[0].university || '';
    //   staffDetails.passing_year = educationResult[0].passing_year || '';
    // }

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
  } finally {
    connection.release();
  }
});

// Helper function to format date
const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper function to mask Aadhar number (show only last 4 digits)
const maskAadhar = (aadhar) => {
  if (!aadhar) return '';
  const str = aadhar.toString();
  if (str.length <= 4) return str;
  return 'XXXX-XXXX-' + str.slice(-4);
};

// Helper function to mask bank account number (show only last 4 digits)
const maskAccountNumber = (account) => {
  if (!account) return '';
  const str = account.toString();
  if (str.length <= 4) return str;
  return 'XXXXXXXX' + str.slice(-4);
};

// Helper function to format salary
const formatSalary = (salary) => {
  if (!salary) return '';
  const num = parseFloat(salary);
  if (isNaN(num)) return '';
  
  // Format as currency (USD, INR, etc.)
  if (num >= 10000000) {
    return `₹${(num / 10000000).toFixed(1)} Crore / Year`;
  } else if (num >= 100000) {
    return `₹${(num / 100000).toFixed(1)} Lakh / Year`;
  } else {
    return `₹${num.toLocaleString()} / Year`;
  }
};

router.put('/:id', upload.single('photo'), async (req, res) => {
  const connection = await db.getConnection();
  let uploadedFileName = null;
  
  try {
    const { id } = req.params;
    const staffData = req.body;
    
    // Store the uploaded filename for cleanup if needed
    if (req.file) {
      uploadedFileName = req.file.filename;
    }

    // ✅ Create a reusable error handler that deletes the image
    const sendError = (message, statusCode = 400) => {
      if (uploadedFileName) {
        deleteUploadedImage(uploadedFileName);
      }
      return res.status(statusCode).json({ emessage: message });
    };

    // Check if staff exists
    const [existingStaff] = await connection.query(
      'SELECT * FROM staff WHERE staff_id = ?',
      [id]
    );
    
    if (existingStaff.length === 0) {
      return sendError('Staff member not found', 404);
    }

    const photo_url = req.file ? `/uploads/staff/${req.file.filename}` : existingStaff[0].photo_url;

    const {
      prefix, first_name, last_name, gender, date_of_birth,
      phone_number, email, address, city, state, pincode,
      emergency_contact_name, emergency_contact_number,
      department_code, designation, role_type, employment_type,
      joining_date, experience_years, staff_status,
      highest_qualification, specialization,
      aadhar_number, pan_number, bank_name, account_number,
      ifsc_code, branch_name, salary, blood_group, marital_status
    } = staffData;

    // ----- Validation Regex Patterns -----
    const nameRegex = /^[A-Za-z ]+$/;
    const phoneRegex = /^\d{10}$/;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/;
    const validGender = ["Male", "Female", "Other"];
    const validEmploymentType = ["FullTime", "PartTime", "Contract", "Temporary"];
    const validStaffStatus = ["Active", "Inactive", "On Leave", "Terminated"];
    const validRoleType = ["Teaching", "Non-Teaching", "Administrative", "Management"];
    const validBloodGroup = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
    const validMaritalStatus = ["Single", "Married", "Divorced", "Widowed"];

    // ----- Required Fields Validation -----
    if (!prefix?.trim()) return sendError("Prefix is required");
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

    // ----- Name Validation -----
    if (!nameRegex.test(first_name)) return sendError("Invalid first name");
    if (!nameRegex.test(last_name)) return sendError("Invalid last name");

    // ----- Gender Validation -----
    if (!validGender.includes(gender)) return sendError("Invalid gender");

    // ----- Phone Validation -----
    if (!phoneRegex.test(phone_number)) return sendError("Invalid phone number (must be 10 digits)");
    if (emergency_contact_number && !phoneRegex.test(emergency_contact_number))
      return sendError("Invalid emergency contact number (must be 10 digits)");

    // ----- Email Validation -----
    if (!emailRegex.test(email)) return sendError("Invalid email address");

    // ----- Role Type Validation -----
    if (!validRoleType.includes(role_type)) return sendError("Invalid role type");

    // ----- Employment Type Validation -----
    if (employment_type && !validEmploymentType.includes(employment_type))
      return sendError("Invalid employment type");

    // ----- Staff Status Validation -----
    if (!validStaffStatus.includes(staff_status)) return sendError("Invalid staff status");

    // ----- Address Fields Validation -----
    if (address && address.trim().length < 5) return sendError("Address must be at least 5 characters");
    if (city && !nameRegex.test(city)) return sendError("Invalid city (letters and spaces only)");
    if (state && !nameRegex.test(state)) return sendError("Invalid state (letters and spaces only)");
    if (pincode && !/^\d{6}$/.test(pincode)) return sendError("Invalid pincode (must be 6 digits)");
    if (emergency_contact_name && !nameRegex.test(emergency_contact_name))
      return sendError("Invalid emergency contact name");

    // ----- Date of Birth Validation -----
    if (date_of_birth && new Date(date_of_birth) > new Date())
      return sendError("Date of birth cannot be in future");
    if (date_of_birth && new Date(date_of_birth).getFullYear() < 1940)
      return sendError("Invalid date of birth");

    // ----- Joining Date Validation -----
    if (new Date(joining_date) > new Date())
      return sendError("Joining date cannot be in future");

    // ----- Experience Years Validation -----
    if (experience_years) {
      const expNum = Number(experience_years);
      if (isNaN(expNum) || expNum < 0 || expNum > 70) {
        return sendError("Experience years must be a number between 0 and 70");
      }
    }

    // ----- Aadhar Validation -----
    if (aadhar_number && !/^\d{12}$/.test(aadhar_number))
      return sendError("Aadhar must contain 12 digits");

    // ----- PAN Validation -----
    if (pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan_number))
      return sendError("Invalid PAN number format");

    // ----- Bank Fields Validation -----
    if (bank_name && bank_name.trim().length < 2)
      return sendError("Bank name must be at least 2 characters");
    if (account_number && !/^\d{9,18}$/.test(account_number))
      return sendError("Invalid account number (9-18 digits)");
    if (branch_name && branch_name.trim().length < 2)
      return sendError("Branch name must be at least 2 characters");

    // ----- Salary Validation -----
    if (salary) {
      const salaryNum = Number(salary);
      if (isNaN(salaryNum) || salaryNum < 0 || salaryNum > 10000000) {
        return sendError("Salary must be between 0 and 10,000,000");
      }
    }

    // ----- Education Fields Validation -----
    if (highest_qualification && highest_qualification.trim().length < 2)
      return sendError("Qualification must be at least 2 characters");
    if (specialization && specialization.trim().length < 2)
      return sendError("Specialization must be at least 2 characters");

    // ----- Blood Group Validation -----
    if (blood_group && !validBloodGroup.includes(blood_group))
      return sendError("Invalid blood group");

    // ----- Marital Status Validation -----
    if (marital_status && !validMaritalStatus.includes(marital_status))
      return sendError("Invalid marital status");

    // ----- Clean Data (Convert empty strings to NULL) -----
    const cleanData = {
      prefix: nullIfEmpty(prefix),
      photo_url: photo_url,
      first_name: nullIfEmpty(first_name),
      last_name: nullIfEmpty(last_name),
      gender: nullIfEmpty(gender),
      date_of_birth: nullIfEmpty(date_of_birth),
      phone_number: nullIfEmpty(phone_number),
      email: nullIfEmpty(email),
      address: nullIfEmpty(address),
      city: nullIfEmpty(city),
      state: nullIfEmpty(state),
      pincode: nullIfEmpty(pincode),
      emergency_contact_name: nullIfEmpty(emergency_contact_name),
      emergency_contact_number: nullIfEmpty(emergency_contact_number),
      department_code: nullIfEmpty(department_code),
      designation: nullIfEmpty(designation),
      role_type: nullIfEmpty(role_type),
      employment_type: nullIfEmpty(employment_type),
      joining_date: nullIfEmpty(joining_date),
      experience_years: experience_years ? Number(experience_years) : null,
      staff_status: nullIfEmpty(staff_status),
      highest_qualification: nullIfEmpty(highest_qualification),
      specialization: nullIfEmpty(specialization),
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

    // ----- Check for Duplicates (excluding current staff) -----
    const [duplicateCheck] = await connection.query(
      `SELECT * FROM staff WHERE (staff_id = ? OR email = ? OR phone_number = ?) AND staff_id != ?`,
      [id, cleanData.email, cleanData.phone_number, id]
    );
    if (duplicateCheck.length > 0) {
      return sendError("Email or phone already in use by another staff member");
    }

    // Check Aadhar if provided
    if (cleanData.aadhar_number) {
      const [existingAadhar] = await connection.query(
        `SELECT * FROM staff WHERE aadhar_number = ? AND staff_id != ?`,
        [cleanData.aadhar_number, id]
      );
      if (existingAadhar.length > 0) {
        return sendError("Aadhar number already in use by another staff member");
      }
    }

    // Check PAN if provided
    if (cleanData.pan_number) {
      const [existingPan] = await connection.query(
        `SELECT * FROM staff WHERE pan_number = ? AND staff_id != ?`,
        [cleanData.pan_number, id]
      );
      if (existingPan.length > 0) {
        return sendError("PAN number already in use by another staff member");
      }
    }

    // ----- Update Staff Table -----
    const updateQuery = `
      UPDATE staff SET
        prefix = ?,
        photo_url = ?,
        first_name = ?,
        last_name = ?,
        gender = ?,
        date_of_birth = ?,
        phone_number = ?,
        email = ?,
        address = ?,
        city = ?,
        state = ?,
        pincode = ?,
        emergency_contact_name = ?,
        emergency_contact_number = ?,
        department_code = ?,
        designation = ?,
        role_type = ?,
        employment_type = ?,
        joining_date = ?,
        experience_years = ?,
        staff_status = ?,
        highest_qualification = ?,
        specialization = ?,
        aadhar_number = ?,
        pan_number = ?,
        bank_name = ?,
        bank_account_number = ?,
        ifsc_code = ?,
        branch_name = ?,
        salary = ?,
        blood_group = ?,
        marital_status = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE staff_id = ?
    `;

    await connection.beginTransaction();

    await connection.query(updateQuery, [
      cleanData.prefix,
      cleanData.photo_url,
      cleanData.first_name,
      cleanData.last_name,
      cleanData.gender,
      cleanData.date_of_birth,
      cleanData.phone_number,
      cleanData.email,
      cleanData.address,
      cleanData.city,
      cleanData.state,
      cleanData.pincode,
      cleanData.emergency_contact_name,
      cleanData.emergency_contact_number,
      cleanData.department_code,
      cleanData.designation,
      cleanData.role_type,
      cleanData.employment_type,
      cleanData.joining_date,
      cleanData.experience_years,
      cleanData.staff_status,
      cleanData.highest_qualification,
      cleanData.specialization,
      cleanData.aadhar_number,
      cleanData.pan_number,
      cleanData.bank_name,
      cleanData.bank_account_number,
      cleanData.ifsc_code,
      cleanData.branch_name,
      cleanData.salary,
      cleanData.blood_group,
      cleanData.marital_status,
      id
    ]);

    // Update users table if email or role changed
    await connection.query(
      `UPDATE users SET email = ?, role = ? WHERE username = ?`,
      [cleanData.email, cleanData.role_type, id]
    );

    await connection.commit();

    // If new image uploaded, delete old image
    if (req.file && existingStaff[0].photo_url) {
      const oldImage = path.basename(existingStaff[0].photo_url);
      deleteUploadedImage(oldImage);
    }

    res.status(200).json({
      success: true,
      message: "Staff updated successfully",
      photo_url: photo_url
    });

  } catch (error) {
    console.error("Error updating staff:", error);
    await connection.rollback();
    
    if (uploadedFileName) {
      deleteUploadedImage(uploadedFileName);
    }
    
    res.status(500).json({
      message: "Internal Server Error",
      error: error.message
    });
  } finally {
    connection.release();
  }
});

module.exports = router;