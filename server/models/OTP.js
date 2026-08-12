const mongoose = require('mongoose');

const OTPSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  otp: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }, // TTL index: automatically remove when expired
  },
  attempts: {
    type: Number,
    default: 1,
  },
  blockUntil: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index for email and expiresAt (optional)
OTPSchema.index({ email: 1, expiresAt: 1 });

module.exports = mongoose.model('OTP', OTPSchema);