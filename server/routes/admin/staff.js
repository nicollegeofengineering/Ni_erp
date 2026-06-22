const express = require('express')
const router = express.Router()
const db = require('../../config/db');

router.post('/add', async (req, res) => {
    const connection = await db.getConnection();
    try {
        const staffData = req.body;

        if (!staffData || Object.keys(staffData).length === 0) {
            return res.status(201).json({
                message: "Staff data is required"
            });
        }

        const {
            staff_id,
            prefix,
            photo_url,
            first_name,
            last_name,
            gender,
            date_of_birth,
            phone_number,
            email,
            personal_email,
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
            university,
            passing_year,
            aadhar_number,
            pan_number,
            bank_name,
            account_number,
            ifsc_code,
            branch_name,
            salary,
            blood_group,
            marital_status
        } = staffData;

        // Regex patterns
        const nameRegex = /^[A-Za-z ]+$/;
        const phoneRegex = /^\d{10}$/;
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/;
        const validGender = ["Male", "Female", "Other"];
        const validEmploymentType = ["Full-time", "Part-time", "Contract", "Temporary"];
        const validStaffStatus = ["Active", "Inactive", "On Leave", "Terminated"];
        const validRoleType = ["Admin", "Professor","Head","Cashier"];
        const validBloodGroup = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
        const validMaritalStatus = ["Single", "Married", "Divorced", "Widowed"];

        // Required Fields Validation
        if (!staff_id?.trim())
            return res.status(201).json({ emessage: "Staff ID is required" });
        if (!prefix?.trim())
            return res.status(201).json({ emessage: "Prefix is required" });
        if(!photo_url?.trim())
            return res.status(201).json({ emessage: "Photo URL is required" });
        if (!first_name?.trim())
            return res.status(201).json({ emessage: "First name is required" });
        if (!last_name?.trim())
            return res.status(201).json({ emessage: "Last name is required" });
        if (!gender?.trim())
            return res.status(201).json({ emessage: "Gender is required" });
        if (!phone_number?.trim())
            return res.status(201).json({ emessage: "Phone number is required" });
        if (!email?.trim())
            return res.status(201).json({ emessage: "Email is required" });
        if (!department_code)
            return res.status(201).json({ emessage: "Department is required" });
        if (!designation)
            return res.status(201).json({ emessage: "Designation is required" });
        if (!role_type)
            return res.status(201).json({ emessage: "Role type is required" });
        if (!joining_date)
            return res.status(201).json({ emessage: "Joining date is required" });
        if (!staff_status)
            return res.status(201).json({ emessage: "Staff status is required" });

        // Name Validation
        if (!nameRegex.test(first_name))
            return res.status(201).json({ emessage: "Invalid first name" });
        if (!nameRegex.test(last_name))
            return res.status(201).json({ emessage: "Invalid last name" });

        // Gender Validation
        if (!validGender.includes(gender))
            return res.status(201).json({ emessage: "Invalid gender" });

        // Phone Validation
        if (!phoneRegex.test(phone_number))
            return res.status(201).json({ emessage: "Invalid phone number (must be 10 digits)" });
        if (emergency_contact_number && !phoneRegex.test(emergency_contact_number))
            return res.status(201).json({ emessage: "Invalid emergency contact number (must be 10 digits)" });

        // Email Validation
        if (!emailRegex.test(email))
            return res.status(201).json({ emessage: "Invalid email address" });

        // Role Type Validation
        if (!validRoleType.includes(role_type))
            return res.status(201).json({ emessage: "Invalid role type" });

        // Employment Type Validation
        if (employment_type && !validEmploymentType.includes(employment_type))
            return res.status(201).json({ emessage: "Invalid employment type" });

        // Staff Status Validation
        if (!validStaffStatus.includes(staff_status))
            return res.status(201).json({ emessage: "Invalid staff status" });

        // Address Fields Validation
        if (address && address.trim().length < 5)
            return res.status(201).json({ emessage: "Address must be at least 5 characters" });
        if (city && !nameRegex.test(city))
            return res.status(201).json({ emessage: "Invalid city (letters and spaces only)" });
        if (state && !nameRegex.test(state))
            return res.status(201).json({ emessage: "Invalid state (letters and spaces only)" });

        // Pincode Validation
        if (pincode && !/^\d{6}$/.test(pincode))
            return res.status(201).json({ emessage: "Invalid pincode (must be 6 digits)" });

        // Emergency Contact Name Validation
        if (emergency_contact_name && !nameRegex.test(emergency_contact_name))
            return res.status(201).json({ emessage: "Invalid emergency contact name" });

        // Date of Birth Validation
        if (date_of_birth && new Date(date_of_birth) > new Date())
            return res.status(201).json({ emessage: "Date of birth cannot be in future" });
        if (date_of_birth && new Date(date_of_birth).getFullYear() < 1940)
            return res.status(201).json({ emessage: "Invalid date of birth" });

        // Joining Date Validation
        if (new Date(joining_date) > new Date())
            return res.status(201).json({ emessage: "Joining date cannot be in future" });

        // Experience Years Validation
        if (experience_years && (Number(experience_years) < 0 || Number(experience_years) > 70))
            return res.status(201).json({ emessage: "Experience years must be between 0 and 70" });

        // Aadhar Validation
        if (aadhar_number && !/^\d{12}$/.test(aadhar_number))
            return res.status(201).json({ emessage: "Aadhar must contain 12 digits" });

        // PAN Validation
        if (pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan_number.toUpperCase()))
            return res.status(201).json({ emessage: "Invalid PAN number format" });

        // Bank Fields Validation
        if (bank_name && bank_name.trim().length < 2)
            return res.status(201).json({ emessage: "Bank name must be at least 2 characters" });
        if (account_number && !/^\d{9,18}$/.test(account_number))
            return res.status(201).json({ emessage: "Invalid account number (9-18 digits)" });
        if (ifsc_code && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc_code.toUpperCase()))
            return res.status(201).json({ emessage: "Invalid IFSC code format" });
        if (branch_name && branch_name.trim().length < 2)
            return res.status(201).json({ emessage: "Branch name must be at least 2 characters" });

        // Salary Validation
        if (salary && Number(salary) < 0)
            return res.status(201).json({ emessage: "Salary cannot be negative" });
        if (salary && Number(salary) > 10000000)
            return res.status(201).json({ emessage: "Salary exceeds maximum limit" });

        // Education Fields Validation
        if (highest_qualification && highest_qualification.trim().length < 2)
            return res.status(201).json({ emessage: "Qualification must be at least 2 characters" });
        if (specialization && specialization.trim().length < 2)
            return res.status(201).json({ emessage: "Specialization must be at least 2 characters" });
        if (university && university.trim().length < 2)
            return res.status(201).json({ emessage: "University name must be at least 2 characters" });
        if (passing_year && (!/^\d{4}$/.test(passing_year) || Number(passing_year) < 1940 || Number(passing_year) > new Date().getFullYear()))
            return res.status(201).json({ emessage: "Invalid passing year" });

        // Blood Group Validation
        if (blood_group && !validBloodGroup.includes(blood_group))
            return res.status(201).json({ emessage: "Invalid blood group" });

        // Marital Status Validation
        if (marital_status && !validMaritalStatus.includes(marital_status))
            return res.status(201).json({ emessage: "Invalid marital status" });

        const stafffields = `
        INSERT INTO staff (
            staff_id,
            prefix,
            photo_url,
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
            university,
            passing_year,
            aadhar_number,
            pan_number,
            bank_name,
            account_number,
            ifsc_code,
            branch_name,
            salary,
            blood_group,
            marital_status
        )
        VALUES (
            ?,?,?,?,?,?,?,?,?,?,
            ?,?,?,?,?,?,?,?,?,?,
            ?,?,?,?,?,?,?,?,?,?,
            ?,?,?,?,?
        )
        `;

        const userfields=`
            INSERT INTO users (
                username,
                email,
                role
            ) VALUES(?,?,?)
        `;

        const [existingUser] = await connection.query('SELECT * FROM users WHERE username = ? OR email = ? OR aadhar_number =? OR pan_number=? OR phone_number=?', [staff_id, email, aadhar_number, pan_number, phone_number]);
        
        if (existingUser.length > 0) {
            return res.status(201).json({
                emessage: "Staff with the same ID, email, phone number, Aadhar number or PAN number already exists"
            })
        }

        await connection.beginTransaction();

        await connection.query(stafffields, [
            staff_id,
            prefix,
            photo_url,
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
            university,
            passing_year,
            aadhar_number,
            pan_number,
            bank_name,
            account_number,
            ifsc_code,
            branch_name,
            salary,
            blood_group,
            marital_status
        ]);

        

        await connection.query(userfields, [
            staff_id,
            email,
            role_type
        ]);

        await connection.commit();


        res.status(201).json({
            success: true,
            message: "Staff added successfully",
        });

    } catch (error) {
        console.error(error);

        await connection.rollback();
       

        res.status(500).json({
            message: "Internal Server Error"
        });
    }finally{
        connection.release();
    }
});