const mongoose = require('mongoose');

const StaffSchema = new mongoose.Schema({
  staff_id: { type: String, required: true, unique: true, trim: true },
  prefix: { type: String, trim: true },
  photo_url: { type: String, default: null },          // legacy, keep for now
  photo_file_id: { type: String, default: null },      // ✅ Google Drive file ID
  first_name: { type: String, required: true, trim: true },
  last_name: { type: String, required: true, trim: true },
  staff_code: { type: String, required: true, trim: true },
  gender: { type: String, required: true, enum: ['Male', 'Female', 'Other'] },
  date_of_birth: { type: Date, default: null },
  phone_number: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  personal_email: { type: String, default: null, trim: true, lowercase: true },
  address: { type: String, default: null },
  city: { type: String, default: null },
  state: { type: String, default: null },
  pincode: { type: String, default: null },
  emergency_contact_name: { type: String, default: null },
  emergency_contact_number: { type: String, default: null },
  department_code: { type: String, required: true, trim: true },
  designation: { type: String, required: true, trim: true },
  role_type: { type: String, required: true, enum: ["Staff","Admin","Hod","Student","Accountant"] },
  employment_type: { type: String, enum: ['FullTime', 'PartTime', 'Contract', 'Temporary'], default: null },
  joining_date: { type: Date, required: true },
  experience_years: { type: Number, default: null, min: 0, max: 70 },
  staff_status: { type: String, required: true, enum: ['Active', 'Inactive', 'Resigned', 'Retired'] },
  highest_qualification: { type: String, default: null },
  specialization: { type: String, default: null },
  university: { type: String, default: null },
  passing_year: { type: String, default: null },
  aadhar_number: { type: String, default: null, unique: true, sparse: true },
  pan_number: { type: String, default: null, unique: true, sparse: true },
  bank_name: { type: String, default: null },
  bank_account_number: { type: String, default: null },
  ifsc_code: { type: String, default: null },
  branch_name: { type: String, default: null },
  salary: { type: Number, default: null, min: 0, max: 10000000 },
  blood_group: {
    type: String,
    enum: ['A+','A-','B+','B-','AB+','AB-','O+','O-','A1+','A1-','A2+','A2-','A1B+','A1B-','A2B+','A2B-'],
    default: null
  },
  marital_status: { type: String, enum: ['Single', 'Married', 'Divorced', 'Widowed'], default: null }
}, { timestamps: true });

module.exports = mongoose.model('Staff', StaffSchema);