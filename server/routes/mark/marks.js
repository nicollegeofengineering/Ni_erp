const express = require("express");
const Subject = require("../../models/Subject");
const InternalMark = require("../../models/InternalMark");
const Student = require("../../models/Student");
const markService = require("../../services/markService");
const permissions = require("../../services/markPermissions");

const router = express.Router();

function sendError(res, status, message) {
  return res.status(status).json({
    success: false,
    message,
  });
}

// -------------------------------------------------------------
// GET /api/mark/subjects
// Returns assigned subjects for the logged-in staff member.
// -------------------------------------------------------------
// GET /api/mark/subjects
// Returns assigned subjects for the logged-in staff member.
// If viewAll=true or role is Admin/HOD viewing, returns all distinct subjects in the Timetable.
// -------------------------------------------------------------
router.get("/subjects", async (req, res) => {
  try {
    const staff = await permissions.getStaffFromReq(req);
    if (!staff || staff.staff_status !== "Active") {
      return sendError(res, 403, "Active staff account required.");
    }

    const { department, year, semester, academicYear, viewAll, mode } = req.query;

    if (!department || !year || !semester || !academicYear) {
      return sendError(
        res,
        400,
        "Department, year, semester and academic year are required."
      );
    }

    const role = (staff.role || staff.userRole || req.user?.role || "Staff").toLowerCase();
    const isViewMode = mode === "view" || viewAll === "true";

    // In VIEW mode:
    // - Admin: can view all subjects in ANY department
    // - HOD: can view all subjects if selected department is HOD's own department
    // - Staff: only assigned subjects
    // In ENTRY mode:
    // - All users (Admin, HOD, Staff): ONLY their assigned subjects
    let allowViewAll = false;
    if (isViewMode) {
      if (role === "admin") {
        allowViewAll = true;
      } else if (role === "hod") {
        const normalizedDept = String(department).trim().toUpperCase();
        const normalizedStaffDept = String(staff.department_code || "").trim().toUpperCase();
        if (normalizedDept === normalizedStaffDept) {
          allowViewAll = true;
        }
      }
    }

    const subjects = await markService.getStaffAssignedSubjects(staff._id, {
      department,
      year,
      semester,
      academicYear,
      viewAll: allowViewAll,
      role: staff.role || staff.userRole || req.user?.role || "Staff",
      staffDept: staff.department_code || "",
    });

    return res.json({
      success: true,
      message: "Subjects fetched successfully",
      data: subjects,
    });
  } catch (error) {
    console.error("Error in GET /api/mark/subjects:", error);
    return sendError(res, 500, error.message || "Server error");
  }
});

// -------------------------------------------------------------
// GET /api/mark/students
// Loads active department students for mark entry.
// -------------------------------------------------------------
router.get("/students", async (req, res) => {
  try {
    const staff = await permissions.getStaffFromReq(req);
    if (!staff || staff.staff_status !== "Active") {
      return sendError(res, 403, "Active staff account required.");
    }

    const {
      academicYear,
      department,
      year,
      semester,
      subjectId,
      internalExam,
    } = req.query;

    if (
      !academicYear ||
      !department ||
      !year ||
      !semester ||
      !subjectId ||
      !internalExam
    ) {
      return sendError(res, 400, "Missing required filter fields.");
    }

    if (![1, 2].includes(Number(internalExam))) {
      return sendError(res, 400, "Internal exam must be 1 or 2.");
    }

    const role = (staff.role || staff.userRole || req.user?.role || "Staff").toLowerCase();

    const subject = await permissions.verifySubjectAssignment(
      staff._id,
      subjectId,
      { academicYear, department, year, semester, role }
    );

    if (!subject) {
      return sendError(
        res,
        403,
        "You are not assigned to this subject for the selected filters."
      );
    }

    const allowedComponents =
      await permissions.getAllowedComponentsForEntry(staff._id, subject, {
        academicYear,
        department,
        year,
        semester,
        internalExam: Number(internalExam),
        role,
      });

    if (!allowedComponents.length) {
      return sendError(
        res,
        403,
        "You are not authorized to enter marks for this exam."
      );
    }

    const students = await Student.find({
      department_code: department.toUpperCase(),
      year: Number(year),
      semester: Number(semester),
      student_status: { $ne: "Suspended" },
    })
      .select("_id student_id register_no first_name last_name")
      .sort({ register_no: 1, student_id: 1 })
      .lean();

    const existingMarks = await InternalMark.find({
      subject: subjectId,
      academicYear: String(academicYear || "").trim(),
      department: department.toUpperCase(),
      year: Number(year),
      semester: Number(semester),
      internalExam: Number(internalExam),
    }).lean();

    const existingMarksMap = {};
    existingMarks.forEach((m) => {
      const sid = (m.student?._id || m.student).toString();
      existingMarksMap[sid] = {
        assignment: m.theory?.assignment ?? "",
        writtenExam: m.theory?.writtenExam ?? "",
        total: m.theory?.total ?? "",
        practical: m.practical?.mark ?? "",
      };
    });

    return res.json({
      success: true,
      message: "Students fetched successfully",
      data: {
        students,
        existingMarks: existingMarksMap,
        category: permissions.normalizeCategory(subject.Category),
        allowedComponents,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/mark/students:", error);
    return sendError(res, 500, error.message || "Server error");
  }
});

// -------------------------------------------------------------
// GET /api/mark
// Retrieves all marks for viewing for a specific subject & filters.
// -------------------------------------------------------------
router.get("/", async (req, res) => {
  try {
    const staff = await permissions.getStaffFromReq(req);
    if (!staff || staff.staff_status !== "Active") {
      return sendError(res, 403, "Active staff account required.");
    }

    const { academicYear, department, year, semester, subjectId } = req.query;

    if (!academicYear || !department || !year || !semester || !subjectId) {
      return sendError(res, 400, "Missing required filter fields.");
    }

    const subject = await Subject.findById(subjectId).lean();
    if (!subject) {
      return sendError(res, 404, "Subject not found.");
    }

    const role = (staff.role || staff.userRole || req.user?.role || "Staff").toLowerCase();
    const normalizedDept = String(department).trim().toUpperCase();
    const normalizedStaffDept = String(staff.department_code || "").trim().toUpperCase();

    // Check if current user is directly assigned to this subject
    const isAssigned = !!(await permissions.verifySubjectAssignment(
      staff._id,
      subjectId,
      { academicYear, department, year, semester }
    ));

    // Permission check for viewing report:
    // Admin: can view any subject across any department
    // HOD: can view subjects in HOD's department OR assigned to HOD
    // Staff: can ONLY view subjects assigned to this staff
    let canView = false;
    if (role === "admin") {
      canView = true;
    } else if (role === "hod") {
      if (normalizedDept === normalizedStaffDept || isAssigned) {
        canView = true;
      }
    } else if (isAssigned) {
      canView = true;
    }

    if (!canView) {
      return sendError(
        res,
        403,
        "You are not authorized to view marks for this subject."
      );
    }

    const marks = await markService.getMarksByFilters({
      academicYear,
      department,
      year,
      semester,
      subjectId,
    });

    const exams = [...new Set(marks.map((mark) => mark.internalExam))].sort();
    const allowedByExam = {};
    const isPublishedByExam = { 1: false, 2: false };
    const publishedDetailsByExam = {};

    // Determine publication status per exam
    marks.forEach((m) => {
      if (m.isPublished) {
        isPublishedByExam[m.internalExam] = true;
        if (!publishedDetailsByExam[m.internalExam]) {
          publishedDetailsByExam[m.internalExam] = {
            publishedAt: m.publishedAt,
            publishedBy: m.publishedBy,
          };
        }
      }
    });

    // Extract latest lastEditedBy audit info
    let latestEdited = null;
    marks.forEach((m) => {
      if (m.lastEditedAt && m.lastEditedBy) {
        if (!latestEdited || new Date(m.lastEditedAt) > new Date(latestEdited.lastEditedAt)) {
          latestEdited = {
            lastEditedBy: m.lastEditedBy,
            lastEditedAt: m.lastEditedAt,
          };
        }
      } else if (m.updatedAt) {
        if (!latestEdited || new Date(m.updatedAt) > new Date(latestEdited.lastEditedAt)) {
          latestEdited = {
            lastEditedBy: m.lastEditedBy || m.theory?.enteredBy || m.practical?.enteredBy,
            lastEditedAt: m.updatedAt,
          };
        }
      }
    });

    // User can edit only if assigned and exam is NOT published
    if (isAssigned) {
      for (const exam of [1, 2]) {
        if (isPublishedByExam[exam]) {
          allowedByExam[exam] = [];
        } else {
          allowedByExam[exam] =
            await permissions.getAllowedComponentsForEntry(staff, subject, {
              academicYear,
              department,
              year,
              semester,
              internalExam: exam,
            });
        }
      }
    } else {
      allowedByExam[1] = [];
      allowedByExam[2] = [];
    }

    const canEdit =
      isAssigned &&
      ((allowedByExam[1] && allowedByExam[1].length > 0) ||
        (allowedByExam[2] && allowedByExam[2].length > 0));

    // Admin can always delete; non-admin can only delete if not published
    let canDelete = false;
    if (role === "admin") {
      canDelete = true;
    } else if (isAssigned) {
      const hasAnyPublished = isPublishedByExam[1] || isPublishedByExam[2];
      canDelete = !hasAnyPublished;
    }

    return res.json({
      success: true,
      message: "Marks fetched successfully",
      data: {
        marks,
        category: permissions.normalizeCategory(subject.Category),
        exams,
        allowedByExam,
        isPublishedByExam,
        publishedDetailsByExam,
        lastEditedInfo: latestEdited,
        isAssigned,
        canEdit,
        canDelete,
        isAdmin: role === "admin",
      },
    });
  } catch (error) {
    console.error("Error in GET /api/mark:", error);
    return sendError(res, 500, error.message || "Server error");
  }
});

// -------------------------------------------------------------
// POST /api/mark
// Saves or upserts student internal marks.
// -------------------------------------------------------------
router.post("/", async (req, res) => {
  try {
    const staff = await permissions.getStaffFromReq(req);
    if (!staff || staff.staff_status !== "Active") {
      return sendError(res, 403, "Active staff account required.");
    }

    const {
      academicYear,
      department,
      year,
      semester,
      subjectId,
      internalExam,
    } = req.body;

    if (
      !academicYear ||
      !department ||
      !year ||
      !semester ||
      !subjectId ||
      !internalExam
    ) {
      return sendError(res, 400, "Missing required mark entry fields.");
    }

    if (![1, 2].includes(Number(internalExam))) {
      return sendError(res, 400, "Internal exam must be 1 or 2.");
    }

    if (!Array.isArray(req.body.students) || req.body.students.length === 0) {
      return sendError(res, 400, "Students array is required.");
    }

    const role = (staff.role || staff.userRole || req.user?.role || "Staff").toLowerCase();

    const subject = await permissions.verifySubjectAssignment(
      staff._id,
      subjectId,
      { academicYear, department, year, semester, role }
    );

    if (!subject) {
      return sendError(
        res,
        403,
        "You are not assigned to this subject for the selected filters."
      );
    }

    const allowedComponents =
      await permissions.getAllowedComponentsForEntry(staff._id, subject, {
        academicYear,
        department,
        year,
        semester,
        internalExam: Number(internalExam),
        role,
      });

    if (!allowedComponents.length) {
      return sendError(
        res,
        403,
        "You are not authorized to enter marks for this exam."
      );
    }

    const savedCount = await markService.saveMarks({
      staffId: staff._id,
      academicYear,
      department,
      year,
      semester,
      subjectId,
      internalExam: Number(internalExam),
      category: permissions.normalizeCategory(subject.Category),
      students: req.body.students,
      allowedComponents,
    });

    return res.json({
      success: true,
      message: "Marks saved successfully",
      data: { savedCount },
    });
  } catch (error) {
    console.error("Error in POST /api/mark:", error);
    const status = error.message ? 400 : 500;
    return sendError(res, status, error.message || "Server error");
  }
});

// -------------------------------------------------------------
// PUT /api/mark/:id
// Edits a single student's mark entry.
// -------------------------------------------------------------
router.put("/:id", async (req, res) => {
  try {
    const staff = await permissions.getStaffFromReq(req);
    if (!staff || staff.staff_status !== "Active") {
      return sendError(res, 403, "Active staff account required.");
    }

    const markId = req.params.id;
    const existing = await InternalMark.findById(markId).lean();

    if (!existing) {
      return sendError(res, 404, "Mark record not found.");
    }

    if (existing.isPublished) {
      return sendError(
        res,
        403,
        "Internal marks for this exam have been published by Admin and cannot be edited."
      );
    }

    const subject = await Subject.findById(existing.subject).lean();
    if (!subject) {
      return sendError(res, 404, "Subject not found.");
    }

    const role = (staff.role || staff.userRole || req.user?.role || "Staff").toLowerCase();

    const assignedSubject = await permissions.verifySubjectAssignment(
      staff._id,
      subject._id,
      {
        academicYear: existing.academicYear,
        department: existing.department,
        year: existing.year,
        semester: existing.semester,
        role,
      }
    );

    if (!assignedSubject) {
      return sendError(
        res,
        403,
        "You are not assigned to this subject for this mark record."
      );
    }

    const allowedComponents =
      await permissions.getAllowedComponentsForEntry(staff._id, subject, {
        academicYear: existing.academicYear,
        department: existing.department,
        year: existing.year,
        semester: existing.semester,
        internalExam: existing.internalExam,
        role,
      });

    if (!allowedComponents.length) {
      return sendError(res, 403, "You cannot edit this mark record.");
    }

    const isEditingTheory =
      req.body.assignment !== undefined ||
      req.body.writtenExam !== undefined;

    const isEditingPractical = req.body.practical !== undefined;

    if (isEditingTheory && !allowedComponents.includes("theory")) {
      return sendError(res, 403, "You cannot edit theory marks for this exam.");
    }

    if (isEditingPractical && !allowedComponents.includes("practical")) {
      return sendError(
        res,
        403,
        "You cannot edit practical marks for this exam."
      );
    }

    const updated = await markService.updateMarkById(
      markId,
      req.body,
      allowedComponents,
      staff._id
    );

    return res.json({
      success: true,
      message: "Marks updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("Error in PUT /api/mark/:id:", error);
    const status = error.message ? 400 : 500;
    return sendError(res, status, error.message || "Server error");
  }
});

// -------------------------------------------------------------
// GET /api/mark/available-students
// Returns students without mark records for a subject + exam.
// -------------------------------------------------------------
router.get("/available-students", async (req, res) => {
  try {
    const staff = await permissions.getStaffFromReq(req);
    if (!staff || staff.staff_status !== "Active") {
      return sendError(res, 403, "Active staff account required.");
    }

    const {
      academicYear,
      department,
      year,
      semester,
      subjectId,
      internalExam,
    } = req.query;

    if (
      !academicYear ||
      !department ||
      !year ||
      !semester ||
      !subjectId ||
      !internalExam
    ) {
      return sendError(res, 400, "Missing required filter fields.");
    }

    if (![1, 2].includes(Number(internalExam))) {
      return sendError(res, 400, "Internal exam must be 1 or 2.");
    }

    const role = (staff.role || staff.userRole || req.user?.role || "Staff").toLowerCase();

    const subject = await permissions.verifySubjectAssignment(
      staff._id,
      subjectId,
      { academicYear, department, year, semester, role }
    );

    if (!subject) {
      return sendError(
        res,
        403,
        "You are not assigned to this subject for the selected filters."
      );
    }

    const allowedComponents =
      await permissions.getAllowedComponentsForEntry(staff._id, subject, {
        academicYear,
        department,
        year,
        semester,
        internalExam: Number(internalExam),
        role,
      });

    if (!allowedComponents.length) {
      return sendError(
        res,
        403,
        "You are not authorized to add students for this exam."
      );
    }

    const students = await markService.getAvailableStudents({
      department,
      year,
      semester,
      academicYear,
      subjectId,
      internalExam: Number(internalExam),
    });

    return res.json({
      success: true,
      message: "Available students fetched successfully",
      data: students,
    });
  } catch (error) {
    console.error("Error in GET /api/mark/available-students:", error);
    return sendError(res, 500, error.message || "Server error");
  }
});

// -------------------------------------------------------------
// POST /api/mark/add-students
// Adds unadded students with 0 default marks.
// -------------------------------------------------------------
router.post("/add-students", async (req, res) => {
  try {
    const staff = await permissions.getStaffFromReq(req);
    if (!staff || staff.staff_status !== "Active") {
      return sendError(res, 403, "Active staff account required.");
    }

    const {
      academicYear,
      department,
      year,
      semester,
      subjectId,
      internalExam,
      studentIds,
    } = req.body;

    if (
      !academicYear ||
      !department ||
      !year ||
      !semester ||
      !subjectId ||
      !internalExam
    ) {
      return sendError(res, 400, "Missing required fields.");
    }

    if (![1, 2].includes(Number(internalExam))) {
      return sendError(res, 400, "Internal exam must be 1 or 2.");
    }

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return sendError(res, 400, "studentIds array is required.");
    }

    const role = (staff.role || staff.userRole || req.user?.role || "Staff").toLowerCase();

    const subject = await permissions.verifySubjectAssignment(
      staff._id,
      subjectId,
      { academicYear, department, year, semester, role }
    );

    if (!subject) {
      return sendError(
        res,
        403,
        "You are not assigned to this subject for the selected filters."
      );
    }

    const allowedComponents =
      await permissions.getAllowedComponentsForEntry(staff._id, subject, {
        academicYear,
        department,
        year,
        semester,
        internalExam: Number(internalExam),
        role,
      });

    if (!allowedComponents.length) {
      return sendError(
        res,
        403,
        "You are not authorized to add students for this exam."
      );
    }

    const addedCount = await markService.addStudents({
      staffId: staff._id,
      academicYear,
      department,
      year,
      semester,
      subjectId,
      internalExam: Number(internalExam),
      category: permissions.normalizeCategory(subject.Category),
      studentIds,
      allowedComponents,
    });

    return res.json({
      success: true,
      message: "Students added successfully",
      data: { addedCount },
    });
  } catch (error) {
    console.error("Error in POST /api/mark/add-students:", error);
    const status = error.message ? 400 : 500;
    return sendError(res, status, error.message || "Server error");
  }
});

// -------------------------------------------------------------
// DELETE /api/mark
// Deletes ALL marks for a complete internal exam entry.
// -------------------------------------------------------------
router.delete("/", async (req, res) => {
  try {
    const staff = await permissions.getStaffFromReq(req);
    if (!staff || staff.staff_status !== "Active") {
      return sendError(res, 403, "Active staff account required.");
    }

    const {
      academicYear,
      department,
      year,
      semester,
      subjectId,
      internalExam,
    } = req.query;

    if (
      !academicYear ||
      !department ||
      !year ||
      !semester ||
      !subjectId ||
      !internalExam
    ) {
      return sendError(res, 400, "Missing required filter fields.");
    }

    if (![1, 2].includes(Number(internalExam))) {
      return sendError(res, 400, "Internal exam must be 1 or 2.");
    }

    const role = (staff.role || staff.userRole || req.user?.role || "Staff").toLowerCase();

    // Check if marks are published
    const publishedCheck = await InternalMark.findOne({
      academicYear: String(academicYear || "").trim(),
      department: String(department || "").trim().toUpperCase(),
      year: Number(year),
      semester: Number(semester),
      subject: subjectId,
      internalExam: Number(internalExam),
      isPublished: true,
    });

    // If published, ONLY Admin can delete!
    if (publishedCheck && role !== "admin") {
      return sendError(
        res,
        403,
        "Internal marks for this exam are published. Published marks can only be deleted by an Administrator."
      );
    }

    const subject = await permissions.verifySubjectAssignment(
      staff._id,
      subjectId,
      { academicYear, department, year, semester, role }
    );

    if (!subject && role !== "admin") {
      return sendError(
        res,
        403,
        "You are not assigned to this subject for the selected filters."
      );
    }

    if (!publishedCheck && role !== "admin") {
      const canDelete = await permissions.canDeleteCompleteEntry(
        staff._id,
        subject,
        {
          academicYear,
          department,
          year,
          semester,
          internalExam: Number(internalExam),
          role,
        }
      );

      if (!canDelete) {
        return sendError(
          res,
          403,
          "You are not authorized to delete this complete mark entry."
        );
      }
    }

    const deletedCount = await markService.deleteMarks({
      academicYear,
      department,
      year,
      semester,
      subjectId,
      internalExam: Number(internalExam),
    });

    return res.json({
      success: true,
      message: "Marks deleted successfully",
      data: { deletedCount },
    });
  } catch (error) {
    console.error("Error in DELETE /api/mark:", error);
    return sendError(res, 500, error.message || "Server error");
  }
});

// -------------------------------------------------------------
// POST /api/mark/publish
// Admin-only: Publishes internal marks for a subject/exam
// -------------------------------------------------------------
router.post("/publish", async (req, res) => {
  try {
    const staff = await permissions.getStaffFromReq(req);
    if (!staff || staff.staff_status !== "Active") {
      return sendError(res, 403, "Active staff account required.");
    }

    const role = (staff.role || staff.userRole || req.user?.role || "Staff").toLowerCase();
    if (role !== "admin") {
      return sendError(res, 403, "Only Administrators can publish internal marks.");
    }

    const {
      academicYear,
      department,
      year,
      semester,
      subjectId,
      internalExam,
    } = req.body;

    if (!academicYear || !department || !year || !semester || !subjectId) {
      return sendError(res, 400, "Missing required fields to publish marks.");
    }

    const publishedCount = await markService.publishMarks({
      academicYear,
      department,
      year,
      semester,
      subjectId,
      internalExam: internalExam ? Number(internalExam) : null,
      staffId: staff._id,
    });

    return res.json({
      success: true,
      message: `Internal marks published successfully (${publishedCount} records updated).`,
      data: { publishedCount },
    });
  } catch (error) {
    console.error("Error in POST /api/mark/publish:", error);
    return sendError(res, 500, error.message || "Server error");
  }
});

// -------------------------------------------------------------
// POST /api/mark/unpublish
// Admin-only: Unpublishes internal marks for a subject/exam
// -------------------------------------------------------------
router.post("/unpublish", async (req, res) => {
  try {
    const staff = await permissions.getStaffFromReq(req);
    if (!staff || staff.staff_status !== "Active") {
      return sendError(res, 403, "Active staff account required.");
    }

    const role = (staff.role || staff.userRole || req.user?.role || "Staff").toLowerCase();
    if (role !== "admin") {
      return sendError(res, 403, "Only Administrators can unpublish internal marks.");
    }

    const {
      academicYear,
      department,
      year,
      semester,
      subjectId,
      internalExam,
    } = req.body;

    if (!academicYear || !department || !year || !semester || !subjectId) {
      return sendError(res, 400, "Missing required fields to unpublish marks.");
    }

    const unpublishedCount = await markService.unpublishMarks({
      academicYear,
      department,
      year,
      semester,
      subjectId,
      internalExam: internalExam ? Number(internalExam) : null,
      staffId: staff._id,
    });

    return res.json({
      success: true,
      message: `Internal marks unpublished successfully (${unpublishedCount} records updated).`,
      data: { unpublishedCount },
    });
  } catch (error) {
    console.error("Error in POST /api/mark/unpublish:", error);
    return sendError(res, 500, error.message || "Server error");
  }
});

module.exports = router;