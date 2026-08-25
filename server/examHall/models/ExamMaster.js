const mongoose = require('mongoose');

const ExamMasterSchema = new mongoose.Schema(
  {
    examCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    examName: {
      type: String,
      required: true,
      trim: true,
    },
    centreCode: {
      type: String,
      required: true,
      trim: true,
      default: '9460',
    },
    centreName: {
      type: String,
      required: true,
      trim: true,
      default: 'Nagercoil Islam College of Engineering and Technology',
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

module.exports = mongoose.model('ExamMaster', ExamMasterSchema);
