const Staff = require("../models/Staff");
const User = require("../models/User");
const Subject = require("../models/Subject");
const Timetable = require("../models/Timetable");
const InternalMark = require("../models/InternalMark");

function normalizeDepartment(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeCategory(value) {
  const raw = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (raw === "TL" || raw === "T/L" || raw === "T / L") return "T/L";
  return raw;
}

async function getStaffFromReq(req) {
  if (!req.user || !req.user.id) return null;

  const user = await User.findById(req.user.id).lean();
  if (!user) return null;

  let staff = await Staff.findOne({ staff_id: user.username }).lean();
  if (!staff) {
    staff = await Staff.findOne({ email: user.email }).lean();
  }

  const role = user.role || (staff ? staff.role_type : "Staff");

  if (!staff && role === "Admin") {
    return {
      _id: user._id,
      staff_id: user.username,
      first_name: user.name,
      last_name: "",
      department_code: "ALL",
      staff_status: user.isActive ? "Active" : "Inactive",
      role: "Admin",
      userRole: "Admin",
    };
  }

  if (!staff) return null;

  return {
    ...staff,
    role: role,
    userRole: role,
  };
}

async function verifySubjectAssignment(
  staffId,
  subjectId,
  { academicYear, department, year, semester }
) {
  const normalizedDept = normalizeDepartment(department);

  const assignmentExists = await Timetable.exists({
    staff: staffId,
    subject: subjectId,
    academicYear: String(academicYear || "").trim(),
    department: normalizedDept,
    year: Number(year),
    semester: Number(semester),
  });

  if (!assignmentExists) return null;

  return Subject.findById(subjectId).lean();
}

async function getAllowedComponentsForEntry(
  staffId,
  subject,
  { academicYear, department, year, semester, internalExam }
) {
  const category = normalizeCategory(subject.Category);

  if (category === "T") return ["theory"];
  if (category === "L") return ["practical"];

  if (category === "T/L") {
    const filters = {
      academicYear: String(academicYear || "").trim(),
      department: normalizeDepartment(department),
      year: Number(year),
      semester: Number(semester),
      subject: subject._id,
      internalExam: Number(internalExam),
    };

    const theoryClaimedByOther = await InternalMark.exists({
      ...filters,
      "theory.enteredBy": { $ne: null, $ne: staffId },
    });

    const practicalClaimedByOther = await InternalMark.exists({
      ...filters,
      "practical.enteredBy": { $ne: null, $ne: staffId },
    });

    const allowed = [];

    if (!theoryClaimedByOther) allowed.push("theory");
    if (!practicalClaimedByOther) allowed.push("practical");

    return allowed;
  }

  return [];
}

async function canDeleteCompleteEntry(
  staffId,
  subject,
  { academicYear, department, year, semester, internalExam }
) {
  const allowed = await getAllowedComponentsForEntry(staffId, subject, {
    academicYear,
    department,
    year,
    semester,
    internalExam,
  });

  if (!allowed.length) return false;

  const category = normalizeCategory(subject.Category);

  if (category === "T" || category === "L") {
    return true;
  }

  if (category === "T/L") {
    const filters = {
      academicYear: String(academicYear || "").trim(),
      department: normalizeDepartment(department),
      year: Number(year),
      semester: Number(semester),
      subject: subject._id,
      internalExam: Number(internalExam),
    };

    const theoryOwners = await InternalMark.distinct("theory.enteredBy", {
      ...filters,
      "theory.enteredBy": { $ne: null },
    });

    const practicalOwners = await InternalMark.distinct("practical.enteredBy", {
      ...filters,
      "practical.enteredBy": { $ne: null },
    });

    for (const owner of theoryOwners) {
      if (String(owner) !== String(staffId)) return false;
    }

    for (const owner of practicalOwners) {
      if (String(owner) !== String(staffId)) return false;
    }

    return true;
  }

  return false;
}

module.exports = {
  normalizeDepartment,
  normalizeCategory,
  getStaffFromReq,
  verifySubjectAssignment,
  getAllowedComponentsForEntry,
  canDeleteCompleteEntry,
};