const mongoose = require('mongoose');

// Validation constants (reused from staff)
const nameRegex = /^[A-Za-z ]+$/;
const phoneRegex = /^\d{10}$/;
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}$/;
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

const StudentSchema = new mongoose.Schema(
  {
    // ----- Identification -----
    student_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    
    application_no: { type: String, trim: true, unique: true, required: true },
    admission_no: { type: String, trim: true, unique: true, required: true },
    register_no: { type: String, trim: true, unique: true, required: true },
    roll_no: { type: String, trim: true, unique: true, required: true },

    // ----- Photo (Google Drive) -----
    photo_file_id: { type: String, default: null },
    photo_version: { type: Number, default: 0 },

    // ----- Admission & Academic -----
    academic_year: { type: String, trim: true },
    admission_date: { type: Date },
    admission_type: {
      type: String,
      enum: validAdmissionType,
      required: true,
    },
    admission_mode: { type: String, trim: true },
    programme: { type: String, trim: true },
    department_code: { type: String, trim: true, required: true },
    batch: { type: String, trim: true },
    regulation: { type: String, trim: true },
    medium: { type: String, trim: true },
    year: { type: Number, min: 1, max: 6 },
    semester: { type: Number, min: 1, max: 12 },
    section: { type: String, trim: true, uppercase: true },

    // ----- Personal Information -----
    first_name: { type: String, required: true, trim: true },
    last_name: { type: String, required: true, trim: true },
    date_of_birth: { type: Date },
    gender: { type: String, enum: validGender, required: true },
    blood_group: { type: String, enum: validBloodGroup },
    nationality: { type: String, trim: true },
    mother_tongue: { type: String, trim: true },
    religion: { type: String, trim: true },
    community: { type: String, trim: true },
    caste: { type: String, trim: true },
    aadhar_number: { type: String, trim: true, unique: true, required: true },

    // ----- Contact & Address -----
    mobile_number: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    address: { type: String, trim: true },
    panchayat_name: { type: String, trim: true },
    location_type: { type: String, enum: validLocationType },
    taluk: { type: String, trim: true },
    district: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },

    // ----- Parent / Guardian -----
    father_name: { type: String, trim: true },
    father_mobile: { type: String, trim: true },
    father_occupation: { type: String, trim: true },
    mother_name: { type: String, trim: true },
    mother_mobile: { type: String, trim: true },
    mother_occupation: { type: String, trim: true },
    annual_family_income: { type: Number, min: 0 },
    first_graduate: { type: Boolean, default: false },
    seven_point_five: { type: Boolean, default: false },
    guardian_name: { type: String, trim: true },
    guardian_relationship: { type: String, trim: true },
    guardian_mobile: { type: String, trim: true },
    guardian_occupation: { type: String, trim: true },

    // ----- Qualification (based on admission_type) -----
    qualification: {
      type: {
        // Common fields
        institution: { type: String, trim: true },
        qualifying_exam: { type: String, trim: true },
        passing_year: { type: Number, min: 1900, max: new Date().getFullYear() + 5 },
        register_number: { type: String, trim: true },
        eligibility: { type: String, trim: true },

        // Regular specific
        emis_number: { type: String, trim: true },
        total_marks: { type: Number, min: 0 },
        mathematics_marks: { type: Number, min: 0 },
        physics_marks: { type: Number, min: 0 },
        chemistry_marks: { type: Number, min: 0 },
        aggregate: { type: Number, min: 0 },

        // Lateral specific
        umis_number: { type: String, trim: true },
        diploma_branch: { type: String, trim: true },
        percentage: { type: Number, min: 0, max: 100 },
      },
      default: {},
    },

    // ----- Category & Special Information -----
    special_quota: { type: Boolean, default: false },
    quota_category: { type: String, trim: true },
    differently_abled: { type: Boolean, default: false },
    disability_category: { type: String, trim: true },
    // eligibility also exists in qualification, but can be repeated here if needed

    // ----- Student Status -----
    admission_status: {
      type: String,
      enum: validAdmissionStatus,
      default: 'Applied',
    },
    student_status: {
      type: String,
      enum: validStudentStatus,
      default: 'Active',
    },

    // ----- Timestamps -----
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for full name
StudentSchema.virtual('full_name').get(function () {
  return [this.first_name, this.middle_name, this.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
});

// Indexes for search/filter
StudentSchema.index({ first_name: 'text', last_name: 'text', email: 'text', student_id: 'text' });

module.exports = mongoose.model('Student', StudentSchema);