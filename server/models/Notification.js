const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    role: {
      type: String,
      enum: ['All', 'Student', 'Staff', 'Hod', 'Admin'],
      default: 'All',
      index: true,
    },
    department: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'ALL',
      index: true,
    },
    year: {
      type: Number,
      default: null,
    },
    semester: {
      type: Number,
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['MARK_PUBLISHED', 'FEEDBACK_REMINDER', 'ANNOUNCEMENT', 'EXAM_HALL', 'GENERAL'],
      default: 'GENERAL',
    },
    link: {
      type: String,
      default: '',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    clearedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    senderName: {
      type: String,
      default: 'NICETECH Admin',
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ department: 1, role: 1, createdAt: -1 });
notificationSchema.index({ clearedBy: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
