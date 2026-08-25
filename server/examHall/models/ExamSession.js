const mongoose = require('mongoose');

const ExamSessionSchema = new mongoose.Schema(
  {
    examMaster: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExamMaster',
      default: null,
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
      default: '9460',
    },
    centreName: {
      type: String,
      trim: true,
      default: 'Nagercoil Islam College of Engineering and Technology',
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
