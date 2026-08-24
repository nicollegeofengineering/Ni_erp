const mongoose = require('mongoose');

const ExamSessionSchema = new mongoose.Schema(
  {
    examName: {
      type: String,
      required: true,
      trim: true,
    },
    examDate: {
      type: Date,
      required: true,
    },
    session: {
      type: String,
      enum: ['FN', 'AN'],
      required: true,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'ALLOCATED'],
      default: 'DRAFT',
    },
    createdBy: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for quick lookup
ExamSessionSchema.index({ examDate: 1, session: 1 });

module.exports = mongoose.model('ExamSession', ExamSessionSchema);
