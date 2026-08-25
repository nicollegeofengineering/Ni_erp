const mongoose = require("mongoose");

const rateLimitSchema = new mongoose.Schema(
  {
    ip: {
      type: String,
      required: true,
      trim: true,
    },
    action: {
      type: String,
      enum: ["send-otp", "submit"],
      default: "send-otp",
    },
    count: {
      type: Number,
      default: 1,
    },
    resetAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

rateLimitSchema.index({ resetAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("AdmissionRateLimit", rateLimitSchema);
