const mongoose = require("mongoose");

const admissionApplicationSchema = new mongoose.Schema(
  {
    academicYear: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    fatherName: {
      type: String,
      required: true,
      trim: true,
    },
    hallTicketNo: {
      type: String,
      required: true,
      trim: true,
    },
    dob: {
      type: Date,
      required: true,
    },
    gender: {
      type: String,
      enum: ["MALE", "FEMALE", "OTHER"],
      required: true,
    },
    religion: {
      type: String,
      required: true,
      trim: true,
    },
    community: {
      type: String,
      required: true,
      trim: true,
    },
    residenceAddress: {
      type: String,
      required: true,
      trim: true,
    },
    permanentAddress: {
      type: String,
      required: true,
      trim: true,
    },
    sameAsResidence: {
      type: Boolean,
      default: false,
    },
    district: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    pincode: {
      type: String,
      required: true,
      trim: true,
    },
    mobile: {
      type: String,
      required: true,
      trim: true,
    },
    parentMobile: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    admissionFor: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
    },
    branchPreferred: {
      type: String,
      required: true,
      trim: true,
    },
    cutoffMark: {
      type: Number,
      default: null,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
      index: true,
    },
    adminComment: {
      type: String,
      default: "",
      trim: true,
    },
    ip: {
      type: String,
      default: "127.0.0.1",
    },
    submittedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique constraint: one hall ticket per academic year
admissionApplicationSchema.index({ hallTicketNo: 1, academicYear: 1 }, { unique: true });

module.exports = mongoose.model("AdmissionApplication", admissionApplicationSchema);
