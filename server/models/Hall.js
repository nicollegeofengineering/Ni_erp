const mongoose = require('mongoose');

const hallSchema = new mongoose.Schema(
  {
    hallName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    hallCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    capacity: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Hall', hallSchema);