const mongoose = require('mongoose');

const ExamCandidateSchema = new mongoose.Schema(
  {
    examSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExamSession',
      required: true,
      index: true,
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
