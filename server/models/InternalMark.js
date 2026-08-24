const mongoose = require("mongoose");

const internalMarkSchema = new mongoose.Schema(
  {
    academicYear: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    year: {
      type: Number,
      required: true,
      min: 1,
      max: 6,
    },
    semester: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    internalExam: {
      type: Number,
      required: true,
      enum: [1, 2],
    },
    category: {
      type: String,
      uppercase: true,
      enum: ["T", "L", "T/L", "O"],
    },
    theory: {
      assignment: {
        type: Number,
        default: null,
        min: 0,
        max: 100,
      },
      writtenExam: {
        type: Number,
        default: null,
        min: 0,
        max: 100,
      },
      total: {
        type: Number,
        default: null,
        min: 0,
        max: 100,
      },
      enteredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Staff",
        default: null,
      },
    },
    practical: {
      mark: {
        type: Number,
        default: null,
        min: 0,
        max: 100,
      },
      enteredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Staff",
        default: null,
      },
    },
  },
  { timestamps: true }
);

// Critical unique index to prevent duplicate mark entries
internalMarkSchema.index(
  {
    academicYear: 1,
    department: 1,
    year: 1,
    semester: 1,
    subject: 1,
    student: 1,
    internalExam: 1,
  },
  { unique: true }
);

// Useful lookup indexes
internalMarkSchema.index({ subject: 1, academicYear: 1, internalExam: 1 });
internalMarkSchema.index({ "theory.enteredBy": 1 });
internalMarkSchema.index({ "practical.enteredBy": 1 });
internalMarkSchema.index({ student: 1, academicYear: 1 });

module.exports = mongoose.model("InternalMark", internalMarkSchema);