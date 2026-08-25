const mongoose = require("mongoose");

const examTimetableSchema = new mongoose.Schema(
  {
    examName: {
      type: String,
      required: true,
      trim: true,
    },
    academicYear: {
      type: String,
      required: true,
      trim: true,
    },
    regulation: {
      type: String,
      required: false,
      trim: true,
      default: "",
    },
    semesterType: {
      type: String,
      enum: ["ODD", "EVEN"],
      required: true,
    },
    dates: [
      {
        date: {
          type: String,
          required: true,
          trim: true,
        },
      },
    ],
    entries: [
      {
        department: {
          type: String,
          required: true,
          trim: true,
          uppercase: true,
        },
        year: {
          type: Number,
          required: true,
          min: 1,
          max: 4,
        },
        semester: {
          type: Number,
          required: true,
          min: 1,
          max: 8,
        },
        date: {
          type: String,
          required: true,
          trim: true,
        },
        session: {
          type: String,
          enum: ["FN", "AN"],
          required: true,
        },
        subject: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Subject",
          required: false,
        },
        subjectCode: {
          type: String,
          trim: true,
          uppercase: true,
        },
        subjectName: {
          type: String,
          trim: true,
        },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

examTimetableSchema.index({ examName: 1, academicYear: 1, semesterType: 1 }, { unique: true });
examTimetableSchema.index({ academicYear: 1, semesterType: 1 });

module.exports = mongoose.model("ExamTimetable", examTimetableSchema);
