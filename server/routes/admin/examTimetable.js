const express = require("express");
const connectDB = require("../../config/db.js");
const verifyToken = require("../../middleware/verifyToken.js");
const ExamTimetable = require("../../models/ExamTimetable.js");
const Timetable = require("../../models/Timetable.js");
const Subject = require("../../models/Subject.js");
const Department = require("../../models/Department.js");
const Student = require("../../models/Student.js");
const Staff = require("../../models/Staff.js");
const User = require("../../models/User.js");

const router = express.Router();

// ============================================================================
// 1. GET /api/exam-timetable/list
// List all saved exam timetables (with filters for academicYear, semesterType)
// ============================================================================
router.get("/list", verifyToken, async (req, res) => {
  try {
    await connectDB();
    const { academicYear, semesterType } = req.query;

    const filter = {};
    if (academicYear) filter.academicYear = academicYear;
    if (semesterType) filter.semesterType = semesterType.toUpperCase();

    const list = await ExamTimetable.find(filter)
      .select("examName academicYear semesterType dates createdAt updatedAt")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: list,
    });
  } catch (error) {
    console.error("Error listing exam timetables:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 2. GET /api/exam-timetable/get
// Fetch a specific exam timetable by examName, academicYear, semesterType
// ============================================================================
router.get("/get", verifyToken, async (req, res) => {
  try {
    await connectDB();
    const { examName, academicYear, semesterType, id } = req.query;

    let filter = {};
    if (id) {
      filter._id = id;
    } else {
      if (!examName || !academicYear || !semesterType) {
        return res.status(400).json({
          success: false,
          message: "examName, academicYear, and semesterType are required.",
        });
      }
      filter = {
        examName: examName.trim(),
        academicYear: academicYear.trim(),
        semesterType: semesterType.trim().toUpperCase(),
      };
    }

    const timetable = await ExamTimetable.findOne(filter).lean();

    return res.status(200).json({
      success: true,
      data: timetable || null,
    });
  } catch (error) {
    console.error("Error fetching exam timetable:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 3. GET /api/exam-timetable/class
// Fetch Class-Wise exam timetable for given department, year/sem, academicYear, examName
// Accessible by Admin, HOD, Staff, Student
// ============================================================================
router.get("/class", verifyToken, async (req, res) => {
  try {
    await connectDB();
    const { department, year, semester, academicYear, examName } = req.query;

    if (!department || !academicYear) {
      return res.status(400).json({
        success: false,
        message: "department and academicYear are required.",
      });
    }

    const deptUpper = String(department).trim().toUpperCase();
    const filter = { academicYear: academicYear.trim() };
    if (examName && examName.trim()) filter.examName = examName.trim();

    // Fetch matching exam timetables
    const examTimetables = await ExamTimetable.find(filter).sort({ createdAt: -1 }).lean();

    // Extract entries matching department and year/sem
    const results = [];

    for (const tt of examTimetables) {
      if (semester) {
        const expectedSemType = Number(semester) % 2 === 1 ? "ODD" : "EVEN";
        if (tt.semesterType && tt.semesterType !== expectedSemType) continue;
      }

      const filteredEntries = (tt.entries || []).filter((entry) => {
        if (entry.department.toUpperCase() !== deptUpper) return false;
        if (year && Number(entry.year) !== Number(year)) return false;
        if (semester && Number(entry.semester) !== Number(semester)) return false;
        return true;
      });

      if (filteredEntries.length > 0 || (examName && tt.examName === examName.trim())) {
        results.push({
          _id: tt._id,
          examName: tt.examName,
          academicYear: tt.academicYear,
          semesterType: tt.semesterType,
          dates: tt.dates || [],
          entries: filteredEntries,
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Error fetching class-wise exam timetable:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 4. POST /api/exam-timetable/save
// Create or update Master Exam Timetable (Admin & HOD)
// ============================================================================
router.post("/save", verifyToken, async (req, res) => {
  try {
    const role = (req.user?.role || "").toLowerCase();
    if (role !== "admin" && role !== "hod" && role !== "hods") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin or HOD privileges required.",
      });
    }

    await connectDB();
    const { examName, academicYear, semesterType, dates, entries } = req.body;

    if (!examName || !academicYear || !semesterType) {
      return res.status(400).json({
        success: false,
        message: "examName, academicYear, and semesterType are required.",
      });
    }

    const normSemType = semesterType.toUpperCase() === "EVEN" ? "EVEN" : "ODD";
    const filter = {
      examName: examName.trim(),
      academicYear: academicYear.trim(),
      semesterType: normSemType,
    };

    // Calculate semester for each entry based on year & semesterType
    const formattedEntries = (entries || []).map((entry) => {
      const yr = Number(entry.year) || 1;
      const calculatedSem = normSemType === "ODD" ? yr * 2 - 1 : yr * 2;
      return {
        department: String(entry.department).trim().toUpperCase(),
        year: yr,
        semester: entry.semester ? Number(entry.semester) : calculatedSem,
        date: String(entry.date).trim(),
        session: entry.session === "AN" ? "AN" : "FN",
        subject: entry.subject || null,
        subjectCode: entry.subjectCode ? String(entry.subjectCode).trim().toUpperCase() : "",
        subjectName: entry.subjectName ? String(entry.subjectName).trim() : "",
      };
    });

    const formattedDates = (dates || []).map((d) => ({
      date: typeof d === "string" ? d.trim() : String(d.date || "").trim(),
    })).filter((d) => d.date);

    const updateDoc = {
      examName: examName.trim(),
      academicYear: academicYear.trim(),
      regulation: req.body.regulation ? String(req.body.regulation).trim() : "",
      semesterType: normSemType,
      dates: formattedDates,
      entries: formattedEntries,
      updatedBy: req.user.id,
    };

    const result = await ExamTimetable.findOneAndUpdate(
      filter,
      {
        $set: updateDoc,
        $setOnInsert: { createdBy: req.user.id },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      success: true,
      message: "Exam timetable saved successfully.",
      data: result,
    });
  } catch (error) {
    console.error("Error saving exam timetable:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 5. DELETE /api/exam-timetable/:id
// ============================================================================
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const role = (req.user?.role || "").toLowerCase();
    if (role !== "admin" && role !== "hod" && role !== "hods") {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    await connectDB();
    const { id } = req.params;
    await ExamTimetable.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Exam timetable deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting exam timetable:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 6. GET /api/exam-timetable/subjects
// Get subjects available for given department, semester, academicYear
// ============================================================================
router.get("/subjects", verifyToken, async (req, res) => {
  try {
    await connectDB();
    const { department, semester, academicYear } = req.query;

    const deptCode = department ? String(department).trim().toUpperCase() : null;
    const semNum = semester ? Number(semester) : null;

    let subjectsList = [];
    const seen = new Set();

    if (deptCode && semNum) {
      // 1. Check Timetable with academicYear first, or all academicYears for this dept & sem
      const ttFilter = {
        department: new RegExp(`^${deptCode}$`, "i"),
        semester: semNum,
      };
      if (academicYear) {
        ttFilter.academicYear = academicYear.trim();
      }

      let ttEntries = await Timetable.find(ttFilter)
        .populate("subject", "subjectName subjectCode Category")
        .lean();

      // If no entries with specific academicYear, fallback to any academicYear for this dept & sem
      if (ttEntries.length === 0 && academicYear) {
        ttEntries = await Timetable.find({
          department: new RegExp(`^${deptCode}$`, "i"),
          semester: semNum,
        })
          .populate("subject", "subjectName subjectCode Category")
          .lean();
      }

      ttEntries.forEach((entry) => {
        if (entry.subject && !seen.has(String(entry.subject._id))) {
          seen.add(String(entry.subject._id));
          subjectsList.push(entry.subject);
        }
      });

      // 2. Also check InternalMark records for this dept & sem
      try {
        const InternalMark = require("../../models/InternalMark");
        const markRecords = await InternalMark.find({
          department_code: new RegExp(`^${deptCode}$`, "i"),
          semester: semNum,
        })
          .populate("subject_id", "subjectName subjectCode Category")
          .lean();

        markRecords.forEach((m) => {
          if (m.subject_id && !seen.has(String(m.subject_id._id))) {
            seen.add(String(m.subject_id._id));
            subjectsList.push(m.subject_id);
          }
        });
      } catch (err) {
        // Continue if InternalMark query fails
      }
    }

    // Sort by subjectCode
    subjectsList.sort((a, b) => (a.subjectCode || "").localeCompare(b.subjectCode || ""));

    return res.status(200).json({
      success: true,
      subjects: subjectsList,
      timetableSubjects: subjectsList,
    });
  } catch (error) {
    console.error("Error fetching subjects for exam timetable:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
