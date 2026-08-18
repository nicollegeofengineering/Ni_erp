// models/Attendance.js
const mongoose = require('mongoose');

const attendanceStudentSchema = new mongoose.Schema(
  {
    student_id: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['Present', 'Absent'],
      required: true,
      default: 'Present',
    },
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    day: { type: Number, required: true, min: 1, max: 7 }, // 1=Monday ... 7=Sunday

    academicYear: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true, uppercase: true },
    year: { type: Number, required: true, min: 1, max: 4 },
    semester: { type: Number, required: true, enum: [1, 2,3,4,5,6,7,8] }, // 1=odd, 2=even

    period: { type: Number, required: true, min: 1, max: 7 },

    timetable: { type: mongoose.Schema.Types.ObjectId, ref: 'Timetable', required: true },
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },

    students: { type: [attendanceStudentSchema], required: true, default: [] },

    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Ensure only one attendance per class period per day
attendanceSchema.index(
  {
    date: 1,
    department: 1,
    year: 1,
    semester: 1,
    period: 1,
  },
  { unique: true }
);

// Indexes for fast queries
attendanceSchema.index({ staff: 1, date: 1 });
attendanceSchema.index({ 'students.student_id': 1, date: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);