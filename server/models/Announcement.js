const mongoose = require('mongoose');

const AnnouncementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['college', 'department'],
      default: 'college',
      required: true,
      index: true,
    },
    department: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: true,
    },
    priority: {
      type: String,
      enum: ['normal', 'important', 'urgent'],
      default: 'normal',
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    authorName: {
      type: String,
      default: 'Administration',
    },
    authorRole: {
      type: String,
      default: 'Admin',
    },
    pinned: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient listing
AnnouncementSchema.index({ type: 1, department: 1, createdAt: -1 });

module.exports = mongoose.model('Announcement', AnnouncementSchema);
