const express = require('express');
const router = express.Router();
const connectDB = require('../../config/db');
const verifyToken = require('../../middleware/verifyToken');
const Feedback = require('../../models/Feedback');
const Student = require('../../models/Student');
const User = require('../../models/User');
const Timetable = require('../../models/Timetable');
const Subject = require('../../models/Subject');
const Staff = require('../../models/Staff');

// 14 Standard Question Keys
const QUESTION_KEYS = [
  'subjectKnowledge',
  'clarityOfExplanation',
  'willingnessToHelp',
  'classRegularity',
  'clarityBeyondNotes',
  'lectureOrganization',
  'presentationSpeed',
  'encouragesQuestions',
  'teacherBehaviour',
  'blackboardUsage',
  'teacherSincerity',
  'fairnessOfEvaluation',
  'promptnessOfEvaluation',
  'overallTeachingEffectiveness',
];

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Helper: calculate grade label based on average rating (1-5)
function getGradeLabel(avg) {
  if (avg >= 4.5) return 'Excellent';
  if (avg >= 4.0) return 'Very Good';
  if (avg >= 3.5) return 'Good';
  if (avg >= 3.0) return 'Average';
  return 'Needs Improvement';
}

// Helper to resolve the authenticated student from token
async function getStudentFromReq(req) {
  if (!req.user || !req.user.id) return null;
  const user = await User.findById(req.user.id).lean();
  if (!user) return null;

  const trimmedUsername = (user.username || '').trim();
  const trimmedEmail = (user.email || '').trim();
  const usernameRegex = trimmedUsername ? new RegExp(`^${trimmedUsername}$`, 'i') : null;
  const emailRegex = trimmedEmail ? new RegExp(`^${trimmedEmail}$`, 'i') : null;

  const orClauses = [];
  if (usernameRegex) {
    orClauses.push({ register_no: usernameRegex });
    orClauses.push({ roll_no: usernameRegex });
    orClauses.push({ student_id: usernameRegex });
  }
  if (emailRegex) {
    orClauses.push({ email: emailRegex });
  }

  let student = orClauses.length > 0 ? await Student.findOne({ $or: orClauses }).lean() : null;

  if (!student && user.name) {
    const firstName = user.name.split(' ')[0];
    if (firstName) {
      student = await Student.findOne({
        first_name: new RegExp(`^${firstName}$`, 'i'),
      }).lean();
    }
  }

  return { user, student };
}

// ============================================================================
// STUDENT ENDPOINTS
// ============================================================================

/**
 * GET /api/feedback/student/eligible-subjects
 * Returns distinct subjects and assigned faculty for the student's class (Category: T, L, T/L only)
 */
router.get('/student/eligible-subjects', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'Student') {
      return res.status(403).json({ success: false, message: 'Access denied. Student role required.' });
    }

    await connectDB();
    const result = await getStudentFromReq(req);
    if (!result || !result.student) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    const { student } = result;
    const currentSem = student.semester || 1;
    const currentYear = student.year || 1;
    const deptCode = (student.department_code || '').trim().toUpperCase();

    // Query Timetable for student's class
    const slots = await Timetable.find({
      department: deptCode,
      year: currentYear,
      semester: currentSem,
    })
      .populate('subject')
      .populate('staff')
      .lean();

    const eligibleMap = new Map();

    slots.forEach((slot) => {
      if (!slot.subject) return;
      const sub = slot.subject;
      const cat = (sub.Category || 'T').toUpperCase();

      // Only allow Theory (T), Practical/Lab (L), and Theory/Lab (T/L)
      if (!['T', 'L', 'T/L'].includes(cat)) {
        return;
      }

      const staff = slot.staff;
      const facultyName = staff
        ? `${staff.prefix ? staff.prefix + ' ' : ''}${staff.first_name || ''} ${staff.last_name || ''}`.trim()
        : 'Faculty';

      const key = `${sub.subjectCode}||${facultyName}`;
      if (!eligibleMap.has(key)) {
        eligibleMap.set(key, {
          subjectId: sub._id.toString(),
          subjectCode: sub.subjectCode,
          subjectName: sub.subjectName,
          category: cat,
          staffId: staff ? staff._id.toString() : null,
          facultyName,
        });
      }
    });

    // Fallback: If timetable is not yet populated, fetch eligible subjects directly from Subject model
    let subjectList = Array.from(eligibleMap.values());
    if (subjectList.length === 0) {
      const fallbackSubjects = await Subject.find({
        Category: { $in: ['T', 'L', 'T/L', 't', 'l', 't/l'] },
      }).lean();

      subjectList = fallbackSubjects.map((s) => ({
        subjectId: s._id.toString(),
        subjectCode: s.subjectCode,
        subjectName: s.subjectName,
        category: (s.Category || 'T').toUpperCase(),
        staffId: null,
        facultyName: 'Course Instructor',
      }));
    }

    return res.status(200).json({
      success: true,
      data: {
        student: {
          student_id: student.student_id,
          register_no: student.register_no,
          name: `${student.first_name || ''} ${student.last_name || ''}`.trim(),
          department: deptCode,
          year: currentYear,
          semester: currentSem,
        },
        subjects: subjectList,
      },
    });
  } catch (error) {
    console.error('Error fetching eligible subjects for feedback:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/feedback/student/status
 * Checks if the student has already submitted feedback for the current semester
 */
router.get('/student/status', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'Student') {
      return res.status(403).json({ success: false, message: 'Access denied. Student role required.' });
    }

    await connectDB();
    const result = await getStudentFromReq(req);
    if (!result || !result.student) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    const { student } = result;
    const regNo = (student.register_no || student.student_id || '').trim();
    const currentSem = student.semester || 1;

    const existingCount = await Feedback.countDocuments({
      studentRegno: regNo,
      semester: currentSem,
    });

    const latestFeedback = existingCount > 0
      ? await Feedback.findOne({ studentRegno: regNo, semester: currentSem }).sort({ submittedAt: -1 }).lean()
      : null;

    return res.status(200).json({
      success: true,
      hasSubmitted: existingCount > 0,
      count: existingCount,
      submittedAt: latestFeedback?.submittedAt || null,
    });
  } catch (error) {
    console.error('Error checking feedback status:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/feedback/student/submit
 * Submits feedback for all eligible course teachers in a single submission
 */
router.post('/student/submit', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'Student') {
      return res.status(403).json({ success: false, message: 'Access denied. Student role required.' });
    }

    await connectDB();
    const result = await getStudentFromReq(req);
    if (!result || !result.student) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    const { student } = result;
    const regNo = (student.register_no || student.student_id || '').trim();
    const currentSem = student.semester || 1;
    const currentYear = student.year || 1;
    const deptCode = (student.department_code || '').trim().toUpperCase();

    const feedbacks = req.body;
    if (!Array.isArray(feedbacks) || feedbacks.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Feedback submission data must be a non-empty array of course evaluations.',
      });
    }

    // Check if student already submitted feedback for this semester
    const alreadySubmitted = await Feedback.exists({
      studentRegno: regNo,
      semester: currentSem,
    });

    if (alreadySubmitted) {
      return res.status(409).json({
        success: false,
        message: 'You have already submitted your feedback for this semester.',
      });
    }

    // Validate each feedback item
    const feedbackDocs = [];
    const validationErrors = [];

    for (let i = 0; i < feedbacks.length; i++) {
      const item = feedbacks[i];
      if (!item.subjectCode || !item.subjectName || !item.facultyName || !item.ratings) {
        validationErrors.push(`Subject #${i + 1}: Missing required subject/faculty or ratings payload.`);
        continue;
      }

      // Check all 14 questions
      const ratingsObj = {};
      let hasInvalidRating = false;

      QUESTION_KEYS.forEach((key) => {
        const val = Number(item.ratings[key]);
        if (isNaN(val) || val < 1 || val > 5) {
          hasInvalidRating = true;
        } else {
          ratingsObj[key] = val;
        }
      });

      if (hasInvalidRating) {
        validationErrors.push(`Subject ${item.subjectCode} (${item.facultyName}): All 14 rating questions must be evaluated between 1 and 5.`);
        continue;
      }

      feedbackDocs.push({
        department: deptCode,
        year: currentYear,
        semester: currentSem,
        academicYear: student.academic_year || '',
        subject: item.subjectId || null,
        subjectCode: String(item.subjectCode).trim().toUpperCase(),
        subjectName: String(item.subjectName).trim(),
        category: ['T', 'L', 'T/L'].includes((item.category || '').toUpperCase())
          ? item.category.toUpperCase()
          : 'T',
        staff: item.staffId || null,
        facultyName: String(item.facultyName).trim(),
        studentRegno: regNo,
        student: student._id,
        ratings: ratingsObj,
        comment: String(item.comment || '').trim().slice(0, 500),
        submittedAt: new Date(),
      });
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors found in feedback submission.',
        errors: validationErrors,
      });
    }

    const inserted = await Feedback.insertMany(feedbackDocs);

    return res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully! Thank you for your valuable evaluation.',
      count: inserted.length,
    });
  } catch (error) {
    console.error('Feedback submission error:', error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'You have already submitted feedback for one or more of these subjects.',
      });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// ADMIN / HOD ENDPOINTS (ANONYMOUS AGGREGATED REPORTS & SUBMISSION TRACKING)
// ============================================================================

/**
 * GET /api/feedback/admin/dashboard
 * Aggregated reports: Staff-wise, Subject-wise, Department-wise, Year-wise, Criteria breakdown, Grade distribution
 */
router.get('/admin/dashboard', verifyToken, async (req, res) => {
  try {
    if (!['Admin', 'Hod'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Admin or HOD role required.' });
    }

    await connectDB();
    const { department, year, semester } = req.query;

    const match = {};
    if (department && department !== 'ALL') {
      match.department = String(department).trim().toUpperCase();
    }
    if (year && year !== 'ALL') {
      match.year = Number(year);
    }
    if (semester && semester !== 'ALL') {
      match.semester = Number(semester);
    }

    const baseMatchStage = Object.keys(match).length > 0 ? [{ $match: match }] : [];

    // 1. Total Distinct Responded Students
    const respondedStudents = await Feedback.distinct('studentRegno', match);
    const totalResponses = respondedStudents.length;

    // 2. Global Overall Average Rating
    const avgGroupFields = { _id: null };
    QUESTION_KEYS.forEach((key) => {
      avgGroupFields[`avg_${key}`] = { $avg: `$ratings.${key}` };
    });

    const globalAvgResult = await Feedback.aggregate([
      ...baseMatchStage,
      { $group: avgGroupFields },
      { $project: { _id: 0 } },
    ]);

    let overallAverageRating = 0;
    if (globalAvgResult.length > 0) {
      const vals = Object.values(globalAvgResult[0]).filter((v) => v !== null && !isNaN(v));
      if (vals.length > 0) {
        overallAverageRating = parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
      }
    }

    // 3. Question-Wise Global Breakdown (14 criteria)
    const questionWise = {};
    if (globalAvgResult.length > 0) {
      QUESTION_KEYS.forEach((key) => {
        questionWise[key] = parseFloat((globalAvgResult[0][`avg_${key}`] || 0).toFixed(2));
      });
    } else {
      QUESTION_KEYS.forEach((key) => {
        questionWise[key] = 0;
      });
    }

    // 4. Staff-Wise Report
    const staffGroup = {
      _id: '$facultyName',
      department: { $first: '$department' },
      subjects: { $addToSet: '$subjectName' },
      subjectCodes: { $addToSet: '$subjectCode' },
      responses: { $sum: 1 },
      comments: {
        $push: {
          $cond: [{ $ne: ['$comment', ''] }, '$comment', '$$REMOVE'],
        },
      },
    };
    QUESTION_KEYS.forEach((key) => {
      staffGroup[`avg_${key}`] = { $avg: `$ratings.${key}` };
    });

    const staffWiseRaw = await Feedback.aggregate([
      ...baseMatchStage,
      { $group: staffGroup },
    ]);

    const staffWise = staffWiseRaw.map((st) => {
      const criteriaScores = {};
      let totalSum = 0;
      QUESTION_KEYS.forEach((key) => {
        const score = parseFloat((st[`avg_${key}`] || 0).toFixed(2));
        criteriaScores[key] = score;
        totalSum += score;
      });

      const overallAvg = parseFloat((totalSum / QUESTION_KEYS.length).toFixed(2));
      const percentage = parseFloat(((overallAvg / 5) * 100).toFixed(1));

      return {
        facultyName: st._id,
        department: st.department,
        subjects: st.subjects || [],
        subjectCodes: st.subjectCodes || [],
        responses: st.responses,
        criteriaScores,
        overallAvg,
        percentage,
        grade: getGradeLabel(overallAvg),
        comments: (st.comments || []).slice(0, 20), // Anonymized comments (max 20)
      };
    }).sort((a, b) => b.overallAvg - a.overallAvg);

    // 5. Subject-Wise Report
    const subjectGroup = {
      _id: {
        subjectCode: '$subjectCode',
        subjectName: '$subjectName',
        facultyName: '$facultyName',
      },
      department: { $first: '$department' },
      year: { $first: '$year' },
      semester: { $first: '$semester' },
      category: { $first: '$category' },
      responses: { $sum: 1 },
      comments: {
        $push: {
          $cond: [{ $ne: ['$comment', ''] }, '$comment', '$$REMOVE'],
        },
      },
    };
    QUESTION_KEYS.forEach((key) => {
      subjectGroup[`avg_${key}`] = { $avg: `$ratings.${key}` };
    });

    const subjectWiseRaw = await Feedback.aggregate([
      ...baseMatchStage,
      { $group: subjectGroup },
    ]);

    const subjectWise = subjectWiseRaw.map((sub) => {
      const criteriaScores = {};
      let totalSum = 0;
      QUESTION_KEYS.forEach((key) => {
        const score = parseFloat((sub[`avg_${key}`] || 0).toFixed(2));
        criteriaScores[key] = score;
        totalSum += score;
      });

      const overallAvg = parseFloat((totalSum / QUESTION_KEYS.length).toFixed(2));
      const percentage = parseFloat(((overallAvg / 5) * 100).toFixed(1));

      return {
        subjectCode: sub._id.subjectCode,
        subjectName: sub._id.subjectName,
        facultyName: sub._id.facultyName,
        department: sub.department,
        year: sub.year,
        semester: sub.semester,
        category: sub.category,
        responses: sub.responses,
        criteriaScores,
        overallAvg,
        percentage,
        grade: getGradeLabel(overallAvg),
        comments: (sub.comments || []).slice(0, 20),
      };
    }).sort((a, b) => b.overallAvg - a.overallAvg);

    // 6. Department-Wise Comparison
    const deptGroup = {
      _id: '$department',
      responses: { $sum: 1 },
    };
    QUESTION_KEYS.forEach((key) => {
      deptGroup[`avg_${key}`] = { $avg: `$ratings.${key}` };
    });

    const deptWiseRaw = await Feedback.aggregate([
      ...baseMatchStage,
      { $group: deptGroup },
    ]);

    const departmentWise = deptWiseRaw.map((d) => {
      let totalSum = 0;
      QUESTION_KEYS.forEach((key) => {
        totalSum += d[`avg_${key}`] || 0;
      });
      const overallAvg = parseFloat((totalSum / QUESTION_KEYS.length).toFixed(2));
      return {
        department: d._id,
        responses: d.responses,
        overallAvg,
        percentage: parseFloat(((overallAvg / 5) * 100).toFixed(1)),
        grade: getGradeLabel(overallAvg),
      };
    }).sort((a, b) => b.overallAvg - a.overallAvg);

    // 7. Year-Wise Comparison
    const yearGroup = {
      _id: '$year',
      responses: { $sum: 1 },
    };
    QUESTION_KEYS.forEach((key) => {
      yearGroup[`avg_${key}`] = { $avg: `$ratings.${key}` };
    });

    const yearWiseRaw = await Feedback.aggregate([
      ...baseMatchStage,
      { $group: yearGroup },
      { $sort: { _id: 1 } },
    ]);

    const yearWise = yearWiseRaw.map((y) => {
      let totalSum = 0;
      QUESTION_KEYS.forEach((key) => {
        totalSum += y[`avg_${key}`] || 0;
      });
      const overallAvg = parseFloat((totalSum / QUESTION_KEYS.length).toFixed(2));
      return {
        year: y._id,
        responses: y.responses,
        overallAvg,
        percentage: parseFloat(((overallAvg / 5) * 100).toFixed(1)),
        grade: getGradeLabel(overallAvg),
      };
    });

    // 8. Grade Distribution
    const gradeDistResult = await Feedback.aggregate([
      ...baseMatchStage,
      {
        $addFields: {
          overallRating: {
            $avg: QUESTION_KEYS.map((key) => `$ratings.${key}`),
          },
        },
      },
      {
        $group: {
          _id: null,
          excellent: { $sum: { $cond: [{ $gte: ['$overallRating', 4.5] }, 1, 0] } },
          veryGood: {
            $sum: {
              $cond: [
                { $and: [{ $gte: ['$overallRating', 4.0] }, { $lt: ['$overallRating', 4.5] }] },
                1,
                0,
              ],
            },
          },
          good: {
            $sum: {
              $cond: [
                { $and: [{ $gte: ['$overallRating', 3.5] }, { $lt: ['$overallRating', 4.0] }] },
                1,
                0,
              ],
            },
          },
          average: {
            $sum: {
              $cond: [
                { $and: [{ $gte: ['$overallRating', 3.0] }, { $lt: ['$overallRating', 3.5] }] },
                1,
                0,
              ],
            },
          },
          needsImprovement: { $sum: { $cond: [{ $lt: ['$overallRating', 3.0] }, 1, 0] } },
        },
      },
      { $project: { _id: 0 } },
    ]);

    const gradeDistribution = gradeDistResult[0] || {
      excellent: 0,
      veryGood: 0,
      good: 0,
      average: 0,
      needsImprovement: 0,
    };

    // 9. Highlights
    const highestFaculty = staffWise.length > 0 ? {
      facultyName: staffWise[0].facultyName,
      department: staffWise[0].department,
      overallAvg: staffWise[0].overallAvg,
      grade: staffWise[0].grade,
    } : null;

    const highestSubject = subjectWise.length > 0 ? {
      subjectCode: subjectWise[0].subjectCode,
      subjectName: subjectWise[0].subjectName,
      facultyName: subjectWise[0].facultyName,
      overallAvg: subjectWise[0].overallAvg,
      grade: subjectWise[0].grade,
    } : null;

    return res.status(200).json({
      success: true,
      data: {
        totalResponses,
        overallAverageRating,
        highestFaculty,
        highestSubject,
        staffWise,
        subjectWise,
        departmentWise,
        yearWise,
        questionWise,
        gradeDistribution,
      },
    });
  } catch (error) {
    console.error('Error fetching admin feedback dashboard:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/feedback/admin/students
 * Student Submission Tracking (Anonymized Status Table: Shows who submitted, NOT what they submitted)
 */
router.get('/admin/students', verifyToken, async (req, res) => {
  try {
    if (!['Admin', 'Hod'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Admin or HOD role required.' });
    }

    await connectDB();
    const { department, year, semester, status, search } = req.query;

    const studentFilter = { student_status: 'Active' };
    if (department && department !== 'ALL') {
      studentFilter.department_code = new RegExp(`^${department.trim()}$`, 'i');
    }
    if (year && year !== 'ALL') {
      studentFilter.year = Number(year);
    }
    if (semester && semester !== 'ALL') {
      studentFilter.semester = Number(semester);
    }

    if (search && search.trim()) {
      const q = search.trim();
      studentFilter.$or = [
        { register_no: new RegExp(q, 'i') },
        { student_id: new RegExp(q, 'i') },
        { first_name: new RegExp(q, 'i') },
        { last_name: new RegExp(q, 'i') },
        { email: new RegExp(q, 'i') },
      ];
    }

    const students = await Student.find(studentFilter)
      .select('student_id register_no roll_no first_name last_name department_code year semester section email')
      .sort({ register_no: 1 })
      .lean();

    // Fetch all feedback submissions in this scope to compute submission status without exposing ratings
    const submittedRegNos = await Feedback.aggregate([
      {
        $group: {
          _id: '$studentRegno',
          count: { $sum: 1 },
          lastSubmittedAt: { $max: '$submittedAt' },
        },
      },
    ]);

    const submissionMap = new Map();
    submittedRegNos.forEach((item) => {
      submissionMap.set(String(item._id).trim().toUpperCase(), {
        count: item.count,
        submittedAt: item.lastSubmittedAt,
      });
    });

    let studentData = students.map((st) => {
      const reg = (st.register_no || st.student_id || '').trim().toUpperCase();
      const subInfo = submissionMap.get(reg);
      const hasSubmitted = !!subInfo;

      return {
        _id: st._id,
        student_id: st.student_id,
        register_no: st.register_no,
        roll_no: st.roll_no,
        name: `${st.first_name || ''} ${st.last_name || ''}`.trim(),
        department: st.department_code,
        year: st.year,
        semester: st.semester,
        section: st.section || '-',
        email: st.email,
        hasSubmitted,
        submittedAt: subInfo ? subInfo.submittedAt : null,
        feedbackCount: subInfo ? subInfo.count : 0,
      };
    });

    // Apply submitted status filter if requested
    if (status === 'SUBMITTED') {
      studentData = studentData.filter((s) => s.hasSubmitted);
    } else if (status === 'PENDING') {
      studentData = studentData.filter((s) => !s.hasSubmitted);
    }

    const totalStudents = students.length;
    const submittedCount = studentData.filter((s) => s.hasSubmitted).length;
    const pendingCount = totalStudents - submittedCount;
    const submissionRate = totalStudents > 0 ? parseFloat(((submittedCount / totalStudents) * 100).toFixed(1)) : 0;

    return res.status(200).json({
      success: true,
      stats: {
        totalStudents,
        submittedCount,
        pendingCount,
        submissionRate,
      },
      students: studentData,
    });
  } catch (error) {
    console.error('Error fetching student feedback submissions:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/feedback/admin/clear
 * Clears feedback responses to allow fresh re-submission for a term (Protected with confirmation text)
 */
router.delete('/admin/clear', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin role required.' });
    }

    const { confirmation, department, year, semester } = req.body;
    if (confirmation !== 'CLEAR ALL RESPONSES') {
      return res.status(400).json({
        success: false,
        message: 'Confirmation mismatch. Please type "CLEAR ALL RESPONSES" to proceed.',
      });
    }

    await connectDB();
    const filter = {};
    if (department && department !== 'ALL') {
      filter.department = String(department).trim().toUpperCase();
    }
    if (year && year !== 'ALL') {
      filter.year = Number(year);
    }
    if (semester && semester !== 'ALL') {
      filter.semester = Number(semester);
    }

    const result = await Feedback.deleteMany(filter);

    return res.status(200).json({
      success: true,
      message: `Successfully cleared ${result.deletedCount} feedback response records. Students are now unlocked to submit fresh feedback.`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error('Error clearing feedback responses:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
