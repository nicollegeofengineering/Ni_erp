const mongoose = require('mongoose');

const markSchema = new mongoose.Schema(
  {
    exam_name: {
      type: String,
      required: true,
      enum: ['Internal 1', 'Internal 2', 'Internal 3', 'Model'],
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
      index: true,
    },
    component: {
      type: String,
      required: true,
      enum: ['Theory', 'Practical'],
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    marks_obtained: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    max_marks: {
      type: Number,
      default: 100,
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
    academic_year: {
      type: String,
      required: true,
    },
    department_code: {
      type: String,
      required: true,
      index: true,
    },
    year: {
      type: Number,
      required: true,
      min: 1,
      max: 6,
    },
    semester: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    section: {
      type: String,
      trim: true,
      default: '',
    },
    batch: {
      type: String,
      trim: true,
      default: '',
    },
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      required: true,
      index: true,
    },
    entered_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    last_edited_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

// Composite unique index
markSchema.index(
  {
    exam_name: 1,
    subject: 1,
    component: 1,
    student: 1,
    academic_year: 1,
    year: 1,
    semester: 1,
    section: 1,
  },
  { unique: true }
);

// Indexes for common queries
markSchema.index({ exam_name: 1, subject: 1, component: 1, department_code: 1, year: 1, semester: 1 });
markSchema.index({ student: 1, exam_name: 1, subject: 1 });

module.exports = mongoose.model('Mark', markSchema);