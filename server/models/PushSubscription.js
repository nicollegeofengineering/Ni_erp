const mongoose = require('mongoose');

const pushSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['Admin', 'Hod', 'Staff', 'Student', 'Accountant'],
      required: true,
      index: true,
    },
    department: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
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
    subscription: {
      endpoint: { type: String, required: true, unique: true },
      expirationTime: { type: Number, default: null },
      keys: {
        p256dh: { type: String, required: true },
        auth: { type: String, required: true },
      },
    },
    userAgent: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

pushSubscriptionSchema.index({ role: 1, department: 1 });

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
