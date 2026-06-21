CREATE TABLE staff (

    id INT AUTO_INCREMENT PRIMARY KEY,

    -- Basic Information
    staff_id VARCHAR(20) NOT NULL UNIQUE,

    prefix VARCHAR(10),

    first_name VARCHAR(100) NOT NULL,

    last_name VARCHAR(100),

    gender ENUM('Male','Female','Other'),

    date_of_birth DATE,

    photo_url VARCHAR(255),

    -- Contact Information
    phone_number VARCHAR(13),

    email VARCHAR(150) UNIQUE,

    personal_email VARCHAR(150),

    address TEXT,

    city VARCHAR(100),

    state VARCHAR(100),

    pincode VARCHAR(10),

    -- Emergency Contact
    emergency_contact_name VARCHAR(100),

    emergency_contact_number VARCHAR(20),

    -- Academic / Employment Information
    department_id INT,

    designation_id INT,

    role_type ENUM(
        'Teaching',
        'Non-Teaching',
        'Administrative',
        'Management'
    ),

    employment_type ENUM(
        'Full Time',
        'Part Time',
        'Contract',
        'Temporary'
    ),

    joining_date DATE,

    experience_years DECIMAL(4,1),

    staff_status ENUM(
        'Active',
        'Inactive',
        'Resigned',
        'Retired'
    ) DEFAULT 'Active',

    -- Education Details
    highest_qualification VARCHAR(100),

    specialization VARCHAR(100),

    university VARCHAR(200),

    passing_year YEAR,

    -- Government Documents
    aadhar_number VARCHAR(20),

    pan_number VARCHAR(20),

    -- Bank Details
    bank_name VARCHAR(150),

    account_number VARCHAR(50),

    ifsc_code VARCHAR(20),

    branch_name VARCHAR(100),

    -- Salary Details
    salary DECIMAL(12,2),

    -- Additional Information
    blood_group VARCHAR(10),

    marital_status ENUM(
        'Single',
        'Married',
        'Divorced',
        'Widowed'
    ),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

    -- Search Indexes
    INDEX idx_staff_id (staff_id),

    INDEX idx_name (first_name, last_name),

    INDEX idx_department (department_id),

    INDEX idx_designation (designation_id),

    INDEX idx_status (staff_status),

    INDEX idx_phone (phone_number),

    INDEX idx_email (email)

);