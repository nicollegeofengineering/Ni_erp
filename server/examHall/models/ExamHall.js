const mongoose = require('mongoose');

const ExamHallSchema = new mongoose.Schema(
  {
    hallNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    layoutType: {
      type: String,
      enum: ['FIVE_BY_FIVE', 'FOUR_BY_SIX_PLUS_ONE'],
      required: true,
      default: 'FIVE_BY_FIVE',
    },
    capacity: {
      type: Number,
      default: 25,
      validate: {
        validator: function (v) {
          return v === 25;
        },
        message: 'ExamHall capacity must strictly be 25 seats based on supported layouts.',
      },
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

module.exports = mongoose.model('ExamHall', ExamHallSchema);
