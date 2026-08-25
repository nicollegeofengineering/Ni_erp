const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
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
      max: 6,
    },
    semester: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    academicYear: {
      type: String,
      trim: true,
      default: '',
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: false,
    },
    subjectCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    subjectName: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['T', 'L', 'T/L'],
      default: 'T',
    },
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
      required: false,
    },
    facultyName: {
      type: String,
      required: true,
      trim: true,
    },
    studentRegno: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: false,
    },
    ratings: {
      subjectKnowledge: { type: Number, required: true, min: 1, max: 5 },
      clarityOfExplanation: { type: Number, required: true, min: 1, max: 5 },
      willingnessToHelp: { type: Number, required: true, min: 1, max: 5 },
      classRegularity: { type: Number, required: true, min: 1, max: 5 },
      clarityBeyondNotes: { type: Number, required: true, min: 1, max: 5 },
      lectureOrganization: { type: Number, required: true, min: 1, max: 5 },
      presentationSpeed: { type: Number, required: true, min: 1, max: 5 },
      encouragesQuestions: { type: Number, required: true, min: 1, max: 5 },
      teacherBehaviour: { type: Number, required: true, min: 1, max: 5 },
      blackboardUsage: { type: Number, required: true, min: 1, max: 5 },
      teacherSincerity: { type: Number, required: true, min: 1, max: 5 },
      fairnessOfEvaluation: { type: Number, required: true, min: 1, max: 5 },
      promptnessOfEvaluation: { type: Number, required: true, min: 1, max: 5 },
      overallTeachingEffectiveness: { type: Number, required: true, min: 1, max: 5 },
    },
    comment: {
      type: String,
      default: '',
      maxlength: 500,
      trim: true,
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

// Prevent duplicate feedback for the same student, subject, faculty and semester
feedbackSchema.index(
  {
    studentRegno: 1,
    subjectCode: 1,
    facultyName: 1,
    semester: 1,
  },
  { unique: true }
);

// Performance indexes for report aggregations
feedbackSchema.index({ department: 1, year: 1, semester: 1 });
feedbackSchema.index({ facultyName: 1, submittedAt: -1 });
feedbackSchema.index({ subjectCode: 1, submittedAt: -1 });

module.exports = mongoose.model('Feedback', feedbackSchema);
