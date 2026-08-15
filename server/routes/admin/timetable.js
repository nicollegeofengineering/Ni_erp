const express = require("express");
const connectDB  = require("../../config/db.js");
const router = express.Router();

const Timetable = require("../../models/Timetable.js");
const Subject = require("../../models/Subject.js");
const Staff = require("../../models/Staff.js");
const Hall = require("../../models/Hall.js");

// ---------- Helper: format staff full name ----------
const getStaffFullName = (staff) => {
  if (!staff) return null;
  const { prefix = "", first_name = "", last_name = "" } = staff;
  return `${prefix} ${first_name} ${last_name}`.trim().replace(/\s+/g, " ");
};

// ---------- Helper: fetch with population (fields aligned with models) ----------
const fetchTimetableWithPopulate = async (filter) => {
  const entries = await Timetable.find(filter)
    .populate("subject", "subjectName subjectCode Category")
    .populate("staff", "staff_id prefix first_name last_name staff_code")
    .populate("hall", "hallName capacity")
    .lean();

  // Add computed staffName to each entry
  return entries.map((entry) => ({
    ...entry,
    staffName: entry.staff ? getStaffFullName(entry.staff) : null,
  }));
};

// ---------- GET /api/timetable/all ----------
router.get("/all", async (req, res) => {
  try {
    const role = req.user?.role;
    if (role !== 'Admin'&&role !=='Hod') {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        islogout: true
      });
    }
    await connectDB();

    const { academicYear, department, year } = req.query;

    if (!academicYear) {
      return res.status(400).json({
        success: false,
        message: "academicYear is required",
      });
    }

    const filter = { academicYear };
    if (department) filter.department = department.toUpperCase();
    if (year) filter.year = parseInt(year);

    const data = await fetchTimetableWithPopulate(filter);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    console.error("Error fetching timetable:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// ---------- PUT /api/timetable/upsert ----------
router.put("/upsert", async (req, res) => {
  try {
    const role = req.user?.role;
    if (role !== 'Admin'&&role !=='Hod') {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        islogout: true
      });
    }
    await connectDB();

    const {
      academicYear,
      department,
      year,
      semester,
      day,
      period,
      subject,
      staff,
      hall,
    } = req.body;

    if (!academicYear || !department || !year || !semester || !day || !period) {
      return res.status(400).json({
        success: false,
        message: "academicYear, department, year, semester, day, and period are required",
      });
    }

    const deptUpper = department.toUpperCase();
    const yearNum = parseInt(year);
    const semesterNum = parseInt(semester);
    const dayNum = parseInt(day);
    const periodNum = parseInt(period);

    if (![1, 2].includes(semesterNum)) {
      return res.status(400).json({ success: false, message: "semester must be 1 or 2" });
    }
    if (dayNum < 1 || dayNum > 7) {
      return res.status(400).json({ success: false, message: "day must be 1-7" });
    }
    if (periodNum < 1 || periodNum > 7) {
      return res.status(400).json({ success: false, message: "period must be 1-7" });
    }

    // Validate references if provided
    if (subject) {
      const subExists = await Subject.findById(subject);
      if (!subExists) {
        return res.status(404).json({ success: false, message: "Subject not found" });
      }
    }
    if (staff) {
      const staffExists = await Staff.findById(staff);
      if (!staffExists) {
        return res.status(404).json({ success: false, message: "Staff not found" });
      }
    }
    if (hall) {
      const hallExists = await Hall.findById(hall);
      if (!hallExists) {
        return res.status(404).json({ success: false, message: "Hall not found" });
      }
    }

    const filter = {
      academicYear,
      department: deptUpper,
      year: yearNum,
      semester: semesterNum,
      day: dayNum,
      period: periodNum,
    };

    const existing = await Timetable.findOne(filter);

    // ---------- Conflict Validation ----------

    // 1. Staff conflict — skip if same subject (common class)
    if (staff) {
      const staffConflictQuery = {
        academicYear,
        staff,
        day: dayNum,
        period: periodNum,
        _id: { $ne: existing?._id },
      };
      if (subject) {
        staffConflictQuery.subject = { $ne: subject };
      }

      const staffConflict = await Timetable.findOne(staffConflictQuery);
      if (staffConflict) {
        const staffDoc = await Staff.findById(staff);
        const staffName = staffDoc ? getStaffFullName(staffDoc) : staff;
        return res.status(409).json({
          success: false,
          conflict: "staff",
          message: `Staff "${staffName}" is already assigned to ${staffConflict.department} ${staffConflict.year} (Sem ${staffConflict.semester}) on day ${dayNum}, period ${periodNum}`,
        });
      }
    }

    // 2. Hall conflict — skip if same subject
    if (hall) {
      const hallConflictQuery = {
        academicYear,
        hall,
        day: dayNum,
        period: periodNum,
        _id: { $ne: existing?._id },
      };
      if (subject) {
        hallConflictQuery.subject = { $ne: subject };
      }

      const hallConflict = await Timetable.findOne(hallConflictQuery);
      if (hallConflict) {
        const hallDoc = await Hall.findById(hall);
        const hallName = hallDoc ? hallDoc.hallName : hall;
        return res.status(409).json({
          success: false,
          conflict: "hall",
          message: `Hall "${hallName}" is already booked for ${hallConflict.department} ${hallConflict.year} (Sem ${hallConflict.semester}) on day ${dayNum}, period ${periodNum}`,
        });
      }
    }

    // 3. Class conflict (same class already has a subject in that slot)
    if (subject) {
      const classConflict = await Timetable.findOne({
        academicYear,
        department: deptUpper,
        year: yearNum,
        semester: semesterNum,
        day: dayNum,
        period: periodNum,
        _id: { $ne: existing?._id },
      });
      if (classConflict) {
        return res.status(409).json({
          success: false,
          conflict: "class",
          message: `This class (${deptUpper} ${yearNum}, Sem ${semesterNum}) already has a subject in day ${dayNum}, period ${periodNum}`,
        });
      }
    }

    // ---------- Upsert ----------
    const updateData = {};
    if (subject !== undefined) updateData.subject = subject || null;
    if (staff !== undefined) updateData.staff = staff || null;
    if (hall !== undefined) updateData.hall = hall || null;

    const options = {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    };

    const updated = await Timetable.findOneAndUpdate(filter, updateData, options)
      .populate("subject", "subjectName subjectCode Category")
      .populate("staff", "staff_id prefix first_name last_name staff_code")
      .populate("hall", "hallName capacity");

    // Add computed staffName
    const updatedObj = updated.toObject();
    updatedObj.staffName = updatedObj.staff ? getStaffFullName(updatedObj.staff) : null;

    res.status(200).json({
      success: true,
      data: updatedObj,
      message: "Timetable entry saved successfully",
    });
  } catch (err) {
    console.error("Error upserting timetable:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// ---------- DELETE /api/timetable/cell ----------
router.delete("/cell", async (req, res) => {
  try {
    const role = req.user?.role;
    if (role !== 'Admin'&&role !=='Hod') {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        islogout: true
      });
    }
    await connectDB();

    const { academicYear, department, year, semester, day, period } = req.query;

    if (!academicYear || !department || !year || !semester || !day || !period) {
      return res.status(400).json({
        success: false,
        message: "academicYear, department, year, semester, day, and period are all required",
      });
    }

    const filter = {
      academicYear,
      department: department.toUpperCase(),
      year: parseInt(year),
      semester: parseInt(semester),
      day: parseInt(day),
      period: parseInt(period),
    };

    const result = await Timetable.deleteOne(filter);

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "No entry found for that cell" });
    }

    res.status(200).json({
      success: true,
      message: "Cell cleared",
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error("Error deleting cell:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------- DELETE /api/timetable/row ----------
router.delete("/row", async (req, res) => {
  try {
    const role = req.user?.role;
    if (role !== 'Admin'&&role !=='Hod') {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        islogout: true
      });
    }
    await connectDB();

    const { academicYear, department, year, semester, day } = req.query;

    if (!academicYear || !department || !year || !semester || !day) {
      return res.status(400).json({
        success: false,
        message: "academicYear, department, year, semester, and day are all required",
      });
    }

    const filter = {
      academicYear,
      department: department.toUpperCase(),
      year: parseInt(year),
      semester: parseInt(semester),
      day: parseInt(day),
    };

    const result = await Timetable.deleteMany(filter);

    res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} entries for that day`,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error("Error deleting row:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------- DELETE /api/timetable/class ----------
router.delete("/class", async (req, res) => {
  try {
    const role = req.user?.role;
    if (role !== 'Admin'&&role !=='Hod') {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        islogout: true
      });
    }
    await connectDB();

    const { academicYear, department, year, semester } = req.query;

    if (!academicYear || !department || !year || !semester) {
      return res.status(400).json({
        success: false,
        message: "academicYear, department, year, and semester are all required",
      });
    }

    const filter = {
      academicYear,
      department: department.toUpperCase(),
      year: parseInt(year),
      semester: parseInt(semester),
    };

    const result = await Timetable.deleteMany(filter);

    res.status(200).json({
      success: true,
      message: `Deleted ${result.deletedCount} entries for this class`,
      deletedCount: result.deletedCount,
    });
  } catch (err) {
    console.error("Error deleting class timetable:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------- GET /api/timetable/subject-reference ----------
router.get("/subject-reference", async (req, res) => {
  try {
    const role = req.user?.role;
    if (role !== 'Admin'&&role !=='Hod') {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        islogout: true
      });
    }
    await connectDB();

    const { academicYear, department, year } = req.query;
    if (!academicYear || !department || !year) {
      return res.status(400).json({
        success: false,
        message: "academicYear, department, and year are required",
      });
    }

    const deptUpper = department.toUpperCase();
    const yearNum = parseInt(year);

    const entries = await Timetable.find({
      academicYear,
      department: deptUpper,
      year: yearNum,
    })
      .populate("subject", "subjectName subjectCode Category")
      .populate("staff", "staff_id prefix first_name last_name staff_code")
      .lean();

    const pairMap = new Map();
    entries.forEach((entry) => {
      if (!entry.subject || !entry.staff) return;
      const key = `${entry.subject._id}|${entry.staff._id}`;
      if (!pairMap.has(key)) {
        // Add staffName to the staff object
        const staffWithName = {
          ...entry.staff,
          staffName: getStaffFullName(entry.staff),
        };
        pairMap.set(key, {
          subject: entry.subject,
          staff: staffWithName,
        });
      }
    });

    const data = Array.from(pairMap.values());

    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    console.error("Error fetching subject reference:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------- GET /api/timetable/staffview ----------
router.get("/staffview", async (req, res) => {
  try {
    const role = req.user?.role;
    if (role !== 'Admin'&&role !=='Hod') {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        islogout: true
      });
    }
    await connectDB();

    const { academicYear, staffId, search } = req.query;

    if (!academicYear) {
      return res.status(400).json({
        success: false,
        message: "academicYear is required",
      });
    }

    const filter = { academicYear };

    if (staffId) {
      filter.staff = staffId;
    }

    let entries = await Timetable.find(filter)
      .populate("subject", "subjectName subjectCode Category")
      .populate("staff", "staff_id prefix first_name last_name staff_code")
      .populate("hall", "hallName")
      .lean();

    // Add staffName to each entry
    entries = entries.map((entry) => ({
      ...entry,
      staffName: entry.staff ? getStaffFullName(entry.staff) : null,
    }));

    // If search query is provided, filter by staff name or staff_code
    if (search) {
      const q = search.toUpperCase();
      entries = entries.filter((entry) => {
        if (!entry.staff) return false;
        const fullName = getStaffFullName(entry.staff)?.toUpperCase() || "";
        const code = entry.staff.staff_code?.toUpperCase() || "";
        return fullName.includes(q) || code.includes(q);
      });
    }

    res.status(200).json({
      success: true,
      data: entries,
    });
  } catch (err) {
    console.error("Error fetching staff view:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------- GET /api/timetable/hallview ----------
router.get("/hallview", async (req, res) => {
  try {
    const role = req.user?.role;
    if (role !== 'Admin'&&role !=='Hod') {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        islogout: true
      });
    }
    await connectDB();

    const { academicYear, hallId, search } = req.query;

    if (!academicYear) {
      return res.status(400).json({
        success: false,
        message: "academicYear is required",
      });
    }

    const filter = { academicYear };

    if (hallId) {
      filter.hall = hallId;
    }

    let entries = await Timetable.find(filter)
      .populate("subject", "subjectName subjectCode Category")
      .populate("staff", "staff_id prefix first_name last_name staff_code")
      .populate("hall", "hallName hallCode")
      .lean();

    // Add staffName to each entry for convenience
    entries = entries.map((entry) => ({
      ...entry,
      staffName: entry.staff ? getStaffFullName(entry.staff) : null,
    }));

    // If search query is provided, filter by hall name or code
    if (search) {
      const q = search.toUpperCase();
      entries = entries.filter((entry) => {
        if (!entry.hall) return false;
        return (
          entry.hall.hallName?.toUpperCase().includes(q) ||
          entry.hall.hallCode?.toUpperCase().includes(q)
        );
      });
    }

    res.status(200).json({
      success: true,
      data: entries,
    });
  } catch (err) {
    console.error("Error fetching hall view:", err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

module.exports = router;