const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      enum: ['announcement', 'event'],
      required: true,
    },
    author: {
      type: String,
      trim: true,
      default: 'Admin',
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'published',
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster sorting and filtering
newsSchema.index({ date: -1 });
newsSchema.index({ category: 1, status: 1 });

module.exports = mongoose.model('News', newsSchema);