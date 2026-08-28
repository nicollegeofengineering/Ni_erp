const mongoose = require('mongoose');

const ExamMasterSchema = new mongoose.Schema(
  {
    examType: {
      type: String,
      enum: ['INTERNAL', 'ANNA_UNIVERSITY'],
      default: 'ANNA_UNIVERSITY',
      required: true,
      index: true,
    },
    examCode: {
      type: String,
      trim: true,
      uppercase: true,
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
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for unique exam names per type
ExamMasterSchema.index({ examType: 1, examName: 1 }, { unique: true });

const ExamMaster = mongoose.model('ExamMaster', ExamMasterSchema);

// Safely drop obsolete legacy single unique index on examCode if it exists in MongoDB
ExamMaster.collection.dropIndex('examCode_1').catch(() => {});

module.exports = ExamMaster;
