const mongoose = require('mongoose');

const ExamSessionSchema = new mongoose.Schema(
  {
    examMaster: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExamMaster',
      default: null,
      index: true,
    },
    examType: {
      type: String,
      enum: ['INTERNAL', 'ANNA_UNIVERSITY'],
      default: 'ANNA_UNIVERSITY',
      index: true,
    },
    examCode: {
      type: String,
      trim: true,
      default: '',
    },
    examName: {
      type: String,
      required: true,
      trim: true,
    },
    centreCode: {
      type: String,
      trim: true,
      default: '9640',
    },
    centreName: {
      type: String,
      trim: true,
      default: 'Noorul Islam College of Engineering and Technology',
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
ExamSessionSchema.index({ examMaster: 1, examDate: 1, session: 1 });

module.exports = mongoose.model('ExamSession', ExamSessionSchema);
