const mongoose = require('mongoose');

const ExamSeatingSchema = new mongoose.Schema(
  {
    examSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExamSession',
      required: true,
      index: true,
    },
    hall: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExamHall',
      required: true,
      index: true,
    },
    hallNumber: {
      type: String,
      required: true,
      trim: true,
    },
    seatNo: {
      type: Number,
      required: true,
      min: 1,
      max: 25,
    },
    row: {
      type: Number,
      required: true,
    },
    column: {
      type: Number,
      required: true,
    },
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExamCandidate',
      required: true,
    },
    registerNo: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
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
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// 1. Prevent duplicate seats in the same exam session and hall
ExamSeatingSchema.index({ examSession: 1, hall: 1, seatNo: 1 }, { unique: true });

// 2. Prevent a candidate from being assigned to more than one seat in the same exam session
ExamSeatingSchema.index({ examSession: 1, candidate: 1 }, { unique: true });

// 3. Prevent duplicate register numbers in the same exam session
ExamSeatingSchema.index({ examSession: 1, registerNo: 1 }, { unique: true });

module.exports = mongoose.model('ExamSeating', ExamSeatingSchema);
