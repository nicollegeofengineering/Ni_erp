const Mark = require("../models/Mark");
const Student = require("../models/Student");
const Timetable = require("../models/Timetable");
const InternalMark = require("../models/InternalMark");
const Subject = require("../models/Subject");

function normalizeCategory(value) {
  const raw = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (raw === "TL" || raw === "T/L" || raw === "T / L") return "T/L";
  return raw;
}

// ═══════════════════════════════════════════════════════════════
// InternalMark-based services used by /api/mark routes
// ═══════════════════════════════════════════════════════════════

/**
 * Get subjects assigned to a staff member via timetable (or all subjects if viewAll=true).
 * Returns unique subjects with populated details and isAssigned flag.
 */
async function getStaffAssignedSubjects(
  staffId,
  { department, year, semester, academicYear, viewAll = false, role = "Staff", staffDept = "" }
) {
  const normalizedDept = String(department || "").trim().toUpperCase();
  const normalizedStaffDept = String(staffDept || "").trim().toUpperCase();
  const normalizedRole = String(role || "").trim().toLowerCase();

  const timetableFilter = {
    department: normalizedDept,
    year: Number(year),
    semester: Number(semester),
    academicYear: String(academicYear || "").trim(),
  };

  // If viewAll is true or user is Admin viewing, do not restrict timetable to staffId
  // If HOD viewing their own department subjects, viewAll allows seeing all department subjects
  if (!viewAll && normalizedRole !== "admin") {
    timetableFilter.staff = staffId;
  } else if (normalizedRole === "hod" && !viewAll) {
    timetableFilter.staff = staffId;
  } else if (normalizedRole === "hod" && viewAll && normalizedDept !== normalizedStaffDept) {
    // HOD selecting another department in view mode only sees their own assigned subjects in that department
    timetableFilter.staff = staffId;
  }

  const timetables = await Timetable.find(timetableFilter)
    .populate("subject", "subjectName subjectCode Category")
    .lean();

  const subjectMap = new Map();
  timetables.forEach((entry) => {
    if (entry.subject) {
      const sub = entry.subject;
      const key = sub._id.toString();
      const isAssigned = String(entry.staff) === String(staffId);

      if (!subjectMap.has(key)) {
        subjectMap.set(key, {
          _id: sub._id,
          subjectName: sub.subjectName,
          subjectCode: sub.subjectCode,
          Category: normalizeCategory(sub.Category),
          isAssigned,
        });
      } else if (isAssigned) {
        subjectMap.get(key).isAssigned = true;
      }
    }
  });

  return Array.from(subjectMap.values());
}

/**
 * Get all internal marks for given filters, with student populated.
 */
async function getMarksByFilters({
  academicYear,
  department,
  year,
  semester,
  subjectId,
}) {
  const query = {
    academicYear: String(academicYear || "").trim(),
    department: String(department || "").trim().toUpperCase(),
    year: Number(year),
    semester: Number(semester),
    subject: subjectId,
  };

  const marks = await InternalMark.find(query)
    .populate("student", "student_id register_no first_name last_name")
    .lean();

  return marks;
}

/**
 * Save (upsert) marks for a list of students.
 * - Blank/empty values default to 0
 * - Theory total = assignment + writtenExam (validated <= 100)
 * - Only allowed components are written; others are preserved
 */
async function saveMarks({
  staffId,
  academicYear,
  department,
  year,
  semester,
  subjectId,
  internalExam,
  category,
  students,
  allowedComponents,
}) {
  const normalizedDept = String(department || "").trim().toUpperCase();
  const normalizedCategory = normalizeCategory(category);
  let savedCount = 0;

  for (const studentEntry of students) {
    const studentId = studentEntry.studentId;

    const filter = {
      academicYear: String(academicYear || "").trim(),
      department: normalizedDept,
      year: Number(year),
      semester: Number(semester),
      subject: subjectId,
      student: studentId,
      internalExam: Number(internalExam),
    };

    // Build the update object
    const update = {
      $set: {
        category: normalizedCategory,
      },
    };

    if (allowedComponents.includes("theory")) {
      const assignment =
        studentEntry.assignment === "" ||
        studentEntry.assignment === null ||
        studentEntry.assignment === undefined
          ? 0
          : Number(studentEntry.assignment);

      const writtenExam =
        studentEntry.writtenExam === "" ||
        studentEntry.writtenExam === null ||
        studentEntry.writtenExam === undefined
          ? 0
          : Number(studentEntry.writtenExam);

      if (isNaN(assignment) || assignment < 0 || assignment > 100) {
        throw new Error("Assignment marks must be between 0 and 100.");
      }
      if (isNaN(writtenExam) || writtenExam < 0 || writtenExam > 100) {
        throw new Error("Written Exam marks must be between 0 and 100.");
      }

      const total = assignment + writtenExam;
      if (total > 100) {
        throw new Error(
          `Internal theory mark cannot exceed 100. Student total is ${total}.`
        );
      }

      update.$set["theory.assignment"] = assignment;
      update.$set["theory.writtenExam"] = writtenExam;
      update.$set["theory.total"] = total;
      update.$set["theory.enteredBy"] = staffId;
    }

    if (allowedComponents.includes("practical")) {
      const practical =
        studentEntry.practical === "" ||
        studentEntry.practical === null ||
        studentEntry.practical === undefined
          ? 0
          : Number(studentEntry.practical);

      if (isNaN(practical) || practical < 0 || practical > 100) {
        throw new Error("Practical mark must be between 0 and 100.");
      }

      update.$set["practical.mark"] = practical;
      update.$set["practical.enteredBy"] = staffId;
    }

    await InternalMark.findOneAndUpdate(filter, update, {
      upsert: true,
      returnDocument: 'after',
      setDefaultsOnInsert: true,
    });

    savedCount++;
  }

  return savedCount;
}

/**
 * Update a single mark record by ID.
 * Only updates allowed components; preserves the other component.
 */
async function updateMarkById(markId, body, allowedComponents) {
  const mark = await InternalMark.findById(markId);
  if (!mark) throw new Error("Mark record not found");

  if (allowedComponents.includes("theory")) {
    if (body.assignment !== undefined || body.writtenExam !== undefined) {
      const assignment =
        body.assignment === "" || body.assignment === null || body.assignment === undefined
          ? 0
          : Number(body.assignment);

      const writtenExam =
        body.writtenExam === "" || body.writtenExam === null || body.writtenExam === undefined
          ? 0
          : Number(body.writtenExam);

      if (isNaN(assignment) || assignment < 0 || assignment > 100) {
        throw new Error("Assignment marks must be between 0 and 100.");
      }
      if (isNaN(writtenExam) || writtenExam < 0 || writtenExam > 100) {
        throw new Error("Written Exam marks must be between 0 and 100.");
      }

      const total = assignment + writtenExam;
      if (total > 100) {
        throw new Error("Internal theory mark cannot exceed 100.");
      }

      mark.theory.assignment = assignment;
      mark.theory.writtenExam = writtenExam;
      mark.theory.total = total;
    }
  }

  if (allowedComponents.includes("practical")) {
    if (body.practical !== undefined) {
      const practical =
        body.practical === "" || body.practical === null || body.practical === undefined
          ? 0
          : Number(body.practical);

      if (isNaN(practical) || practical < 0 || practical > 100) {
        throw new Error("Practical mark must be between 0 and 100.");
      }

      mark.practical.mark = practical;
    }
  }

  await mark.save();
  return mark;
}

/**
 * Get students who do NOT yet have a mark record for this subject+exam.
 */
async function getAvailableStudents({
  department,
  year,
  semester,
  academicYear,
  subjectId,
  internalExam,
}) {
  const normalizedDept = String(department || "").trim().toUpperCase();

  // Get all active students in this department/year/semester
  const allStudents = await Student.find({
    department_code: normalizedDept,
    year: Number(year),
    semester: Number(semester),
    student_status: { $ne: "Suspended" },
  })
    .select("_id student_id register_no first_name last_name")
    .sort({ register_no: 1, student_id: 1 })
    .lean();

  // Get student IDs that already have marks for this subject + exam
  const existingMarks = await InternalMark.find({
    academicYear: String(academicYear || "").trim(),
    department: normalizedDept,
    year: Number(year),
    semester: Number(semester),
    subject: subjectId,
    internalExam: Number(internalExam),
  })
    .select("student")
    .lean();

  const existingStudentIds = new Set(existingMarks.map((m) => String(m.student)));

  // Return students NOT in the existing set
  return allStudents.filter((s) => !existingStudentIds.has(String(s._id)));
}

/**
 * Add new students with default 0 marks.
 */
async function addStudents({
  staffId,
  academicYear,
  department,
  year,
  semester,
  subjectId,
  internalExam,
  category,
  studentIds,
  allowedComponents,
}) {
  const normalizedDept = String(department || "").trim().toUpperCase();
  const normalizedCategory = normalizeCategory(category);
  let addedCount = 0;

  for (const studentId of studentIds) {
    const doc = {
      academicYear: String(academicYear || "").trim(),
      department: normalizedDept,
      year: Number(year),
      semester: Number(semester),
      subject: subjectId,
      student: studentId,
      internalExam: Number(internalExam),
      category: normalizedCategory,
    };

    if (allowedComponents.includes("theory")) {
      doc.theory = {
        assignment: 0,
        writtenExam: 0,
        total: 0,
        enteredBy: staffId,
      };
    }

    if (allowedComponents.includes("practical")) {
      doc.practical = {
        mark: 0,
        enteredBy: staffId,
      };
    }

    try {
      await InternalMark.create(doc);
      addedCount++;
    } catch (err) {
      // Skip duplicate key error if student already has a record
      if (err.code !== 11000) throw err;
    }
  }

  return addedCount;
}

/**
 * Delete all marks for a specific subject + internal exam combination.
 */
async function deleteMarks({
  academicYear,
  department,
  year,
  semester,
  subjectId,
  internalExam,
}) {
  const result = await InternalMark.deleteMany({
    academicYear: String(academicYear || "").trim(),
    department: String(department || "").trim().toUpperCase(),
    year: Number(year),
    semester: Number(semester),
    subject: subjectId,
    internalExam: Number(internalExam),
  });

  return result.deletedCount;
}

// ═══════════════════════════════════════════════════════════════
// Legacy functions for backward compatibility
// ═══════════════════════════════════════════════════════════════

async function getSubjectsForStaff({ staffId, exam_name, academic_year, year, semester, batch }) {
  const timetableFilter = {
    staff: staffId,
    academic_year,
    year: Number(year),
    semester: Number(semester),
  };
  if (batch) timetableFilter.batch = batch;

  const timetables = await Timetable.find(timetableFilter)
    .populate("subject", "subjectName subjectCode Category")
    .lean();

  const subjectMap = new Map();
  timetables.forEach((entry) => {
    if (entry.subject) {
      const sub = entry.subject;
      const key = sub._id.toString();
      if (!subjectMap.has(key)) {
        subjectMap.set(key, {
          _id: sub._id,
          subjectName: sub.subjectName,
          subjectCode: sub.subjectCode,
          Category: sub.Category,
          department_code: entry.department_code,
        });
      }
    }
  });
  return Array.from(subjectMap.values());
}

async function getRoster({ department_code, year, semester, section, batch }) {
  const filter = {
    department_code,
    year: Number(year),
    semester: Number(semester),
    student_status: { $ne: "Suspended" },
  };
  if (section) filter.section = section;
  if (batch) filter.batch = batch;

  const students = await Student.find(filter)
    .select("student_id register_no first_name last_name")
    .lean();

  return students.map((s) => ({
    _id: s._id,
    register_no: s.register_no || s.student_id,
    full_name: `${s.first_name} ${s.last_name}`.trim(),
  }));
}

async function getMarks(filters) {
  const query = {};
  if (filters.exam_name) query.exam_name = filters.exam_name;
  if (filters.subject) query.subject = filters.subject;
  if (filters.component) query.component = filters.component;
  if (filters.student) query.student = filters.student;
  if (filters.academic_year) query.academic_year = filters.academic_year;
  if (filters.department_code) query.department_code = filters.department_code;
  if (filters.year) query.year = Number(filters.year);
  if (filters.semester) query.semester = Number(filters.semester);
  if (filters.section) query.section = filters.section;
  if (filters.batch) query.batch = filters.batch;
  if (filters._id) query._id = filters._id;

  const marks = await Mark.find(query)
    .populate("student", "student_id register_no first_name last_name")
    .populate("subject", "subjectName subjectCode Category")
    .populate("staff", "staff_id first_name last_name")
    .lean();
  return marks;
}

async function createMark(data, user) {
  const mark = new Mark({
    ...data,
    staff: data.staff || user._id,
    entered_by: user._id,
    last_edited_by: null,
  });
  await mark.save();
  return mark;
}

async function updateMark(markId, updates, user) {
  const mark = await Mark.findById(markId);
  if (!mark) throw new Error("Mark not found");
  if (updates.marks_obtained !== undefined) mark.marks_obtained = updates.marks_obtained;
  if (updates.remarks !== undefined) mark.remarks = updates.remarks;
  mark.last_edited_by = user._id;
  await mark.save();
  return mark;
}

async function deleteMark(markId) {
  const mark = await Mark.findByIdAndDelete(markId);
  if (!mark) throw new Error("Mark not found");
  return mark;
}

async function getStudentMarks(register_no) {
  const student = await Student.findOne({ register_no });
  if (!student) throw new Error("Student not found");

  const marks = await Mark.find({ student: student._id })
    .populate("subject", "subjectName subjectCode Category")
    .lean();

  const grouped = {};
  marks.forEach((mark) => {
    const sem = mark.semester;
    const exam = mark.exam_name;
    if (!grouped[sem]) grouped[sem] = {};
    if (!grouped[sem][exam]) grouped[sem][exam] = [];
    grouped[sem][exam].push({
      _id: mark.subject._id,
      code: mark.subject.subjectCode,
      name: mark.subject.subjectName,
      theory_marks: mark.component === "Theory" ? mark.marks_obtained : null,
      practical_marks: mark.component === "Practical" ? mark.marks_obtained : null,
    });
  });
  return grouped;
}

module.exports = {
  // New InternalMark functions
  getStaffAssignedSubjects,
  getMarksByFilters,
  saveMarks,
  updateMarkById,
  getAvailableStudents,
  addStudents,
  deleteMarks,
  // Legacy Mark functions
  getSubjectsForStaff,
  getRoster,
  getMarks,
  createMark,
  updateMark,
  deleteMark,
  getStudentMarks,
};