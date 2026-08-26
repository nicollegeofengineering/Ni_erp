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
      userId: user._id,
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
    userId: user._id,
    role: role,
    userRole: role,
  };
}

async function verifySubjectAssignment(
  staffOrId,
  subjectId,
  { academicYear, department, year, semester } = {}
) {
  const normalizedDept = normalizeDepartment(department);
  const staffId = staffOrId?._id || staffOrId;
  const userId = staffOrId?.userId;

  const staffIds = [staffId];
  if (userId && String(userId) !== String(staffId)) {
    staffIds.push(userId);
  }

  const assignmentExists = await Timetable.exists({
    staff: { $in: staffIds },
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
  staffOrId,
  subject,
  { academicYear, department, year, semester, internalExam, role } = {}
) {
  const category = normalizeCategory(subject?.Category);

  if (category === "T" || category === "O") return ["theory"];
  if (category === "L") return ["practical"];
  if (category === "T/L") return ["theory", "practical"];

  return ["theory"];
}

async function canDeleteCompleteEntry(
  staffOrId,
  subject,
  { academicYear, department, year, semester, internalExam, role } = {}
) {
  const userRole = String(role || staffOrId?.role || staffOrId?.userRole || "").trim().toLowerCase();
  if (userRole === "admin") return true;

  const staffId = staffOrId?._id || staffOrId;
  const isAssigned = await verifySubjectAssignment(staffId, subject?._id, {
    academicYear,
    department,
    year,
    semester,
    role: userRole,
  });

  return Boolean(isAssigned);
}

module.exports = {
  normalizeDepartment,
  normalizeCategory,
  getStaffFromReq,
  verifySubjectAssignment,
  getAllowedComponentsForEntry,
  canDeleteCompleteEntry,
};