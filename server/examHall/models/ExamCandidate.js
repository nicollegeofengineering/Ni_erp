const mongoose = require('mongoose');

const ExamCandidateSchema = new mongoose.Schema(
  {
    examSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExamSession',
      required: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    registerNo: {
      type: String,
      required: true,
      trim: true,
    },
    programme: {
      type: String,
      trim: true,
      default: 'B.Tech',
    },
    department: {
      type: String,
      trim: true,
      default: '',
    },
    departmentCode: {
      type: String,
      trim: true,
      default: '',
      uppercase: true,
    },
    subjectCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    subjectName: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate candidates within the same ExamSession
ExamCandidateSchema.index({ examSession: 1, registerNo: 1 }, { unique: true });

module.exports = mongoose.model('ExamCandidate', ExamCandidateSchema);
