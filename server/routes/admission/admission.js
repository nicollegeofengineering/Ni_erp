const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const crypto = require("crypto");

const AdmissionApplication = require("../../models/AdmissionApplication");
const AdmissionOtp = require("../../models/AdmissionOtp");
const AdmissionRateLimit = require("../../models/AdmissionRateLimit");
const {
  sendAdmissionOtp,
  sendApplicationReceived,
  sendApplicationStatusUpdate,
} = require("../../services/admissionEmailService");
const { notifyAdmissionApplication } = require("../../services/notificationService");
const authMiddleware = require("../../middleware/verifyToken");

const JWT_SECRET = process.env.JWT_SECRET || "admission_secret_key_nicetech_2026";

// Rate limit helper: max 5 OTP requests per hour per IP
async function checkRateLimit(ip, action = "send-otp", maxCount = 5) {
  const now = new Date();
  let record = await AdmissionRateLimit.findOne({ ip, action });
  if (!record) {
    const resetAt = new Date(now.getTime() + 60 * 60 * 1000);
    await AdmissionRateLimit.create({ ip, action, count: 1, resetAt });
    return true;
  }
  if (record.resetAt <= now) {
    record.count = 1;
    record.resetAt = new Date(now.getTime() + 60 * 60 * 1000);
    await record.save();
    return true;
  }
  if (record.count >= maxCount) {
    return false;
  }
  record.count += 1;
  await record.save();
  return true;
}

// ---------------------------------------------------------------------------
// 1. PUBLIC: Check Duplicate Hall Ticket
// ---------------------------------------------------------------------------
router.get("/check-hall-ticket", async (req, res) => {
  try {
    const { hallTicketNo, academicYear } = req.query;
    if (!hallTicketNo || !academicYear) {
      return res.status(400).json({ success: false, message: "hallTicketNo and academicYear are required" });
    }

    const existing = await AdmissionApplication.findOne({
      hallTicketNo: hallTicketNo.trim(),
      academicYear: academicYear.trim(),
    });

    res.status(200).json({ exists: !!existing });
  } catch (err) {
    console.error("[Admission API] Check hall ticket error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------------------------------------------------------------------
// 2. PUBLIC: Send OTP to Candidate Email
// ---------------------------------------------------------------------------
router.post("/send-otp", async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress || "127.0.0.1";
    const allowed = await checkRateLimit(ip, "send-otp", 6);
    if (!allowed) {
      return res.status(429).json({
        success: false,
        message: "Too many OTP requests. Please try again after some time.",
      });
    }

    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Check if email is already registered
    const existing = await AdmissionApplication.findOne({ email: trimmedEmail });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "This email address is already used for an existing application.",
      });
    }

    // Generate 6-digit cryptographically secure numeric OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

    await AdmissionOtp.create({
      email: trimmedEmail,
      otp,
      expiresAt,
    });

    await sendAdmissionOtp(trimmedEmail, otp);

    res.status(200).json({ success: true, message: "OTP sent to your email address." });
  } catch (err) {
    console.error("[Admission API] Send OTP error:", err);
    res.status(500).json({ success: false, message: err.message || "Failed to send OTP email" });
  }
});

// ---------------------------------------------------------------------------
// 3. PUBLIC: Verify OTP and Issue Submission Token
// ---------------------------------------------------------------------------
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: "Email and OTP are required" });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedOtp = otp.trim();

    const record = await AdmissionOtp.findOne({
      email: trimmedEmail,
      otp: trimmedOtp,
      used: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!record) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP. Please try again." });
    }

    record.used = true;
    await record.save();

    // Issue signed verification token (valid for 15 minutes)
    const token = jwt.sign({ email: trimmedEmail }, JWT_SECRET, { expiresIn: "15m" });

    res.status(200).json({ success: true, token, message: "Email verified successfully." });
  } catch (err) {
    console.error("[Admission API] Verify OTP error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------------------------------------------------------------------
// 4. PUBLIC: Submit Online Admission Application
// ---------------------------------------------------------------------------
router.post("/submit", async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress || "127.0.0.1";

    const {
      token,
      academicYear,
      name,
      fatherName,
      hallTicketNo,
      dob,
      gender,
      religion,
      community,
      residenceAddress,
      permanentAddress,
      sameAsResidence,
      district,
      state,
      pincode,
      mobile,
      parentMobile,
      email,
      admissionFor,
      branchPreferred,
      department,
      cutoffMark,
    } = req.body;

    // 1. Verify token
    if (!token) {
      return res.status(401).json({ success: false, message: "Verification token missing. Please verify your email." });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: "Verification session expired. Please verify email again." });
    }

    const cleanEmail = email ? email.trim().toLowerCase() : "";
    if (decoded.email !== cleanEmail) {
      return res.status(400).json({ success: false, message: "Verified email does not match form email." });
    }

    // 2. Duplicate Checks
    const existingEmail = await AdmissionApplication.findOne({ email: cleanEmail });
    if (existingEmail) {
      return res.status(409).json({ success: false, message: "An application has already been submitted with this email." });
    }

    const cleanHallTicket = hallTicketNo ? hallTicketNo.trim() : "";
    const cleanYear = academicYear ? academicYear.trim() : `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;

    const existingHall = await AdmissionApplication.findOne({
      hallTicketNo: cleanHallTicket,
      academicYear: cleanYear,
    });
    if (existingHall) {
      return res.status(409).json({
        success: false,
        message: "This hall ticket number is already registered for this academic year.",
      });
    }

    // 3. Validation
    if (
      !name ||
      !fatherName ||
      !cleanHallTicket ||
      !dob ||
      !gender ||
      !religion ||
      !community ||
      !residenceAddress ||
      !district ||
      !state ||
      !pincode ||
      !mobile ||
      !parentMobile ||
      !cleanEmail ||
      !admissionFor ||
      !branchPreferred ||
      !department
    ) {
      return res.status(400).json({ success: false, message: "Please fill all required application fields." });
    }

    let cutoff = null;
    if (cutoffMark !== undefined && cutoffMark !== null && cutoffMark !== "") {
      const parsed = parseFloat(cutoffMark);
      if (!isNaN(parsed) && parsed >= 0) {
        cutoff = parsed;
      }
    }

    // 4. Create Application Document
    const application = new AdmissionApplication({
      academicYear: cleanYear,
      name: name.trim(),
      fatherName: fatherName.trim(),
      hallTicketNo: cleanHallTicket,
      dob: new Date(dob),
      gender,
      religion: religion.trim(),
      community: community.trim(),
      residenceAddress: residenceAddress.trim(),
      permanentAddress: sameAsResidence ? residenceAddress.trim() : (permanentAddress || residenceAddress).trim(),
      sameAsResidence: !!sameAsResidence,
      district: district.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      mobile: mobile.trim(),
      parentMobile: parentMobile.trim(),
      email: cleanEmail,
      admissionFor: admissionFor.trim(),
      department: department.trim(),
      branchPreferred: branchPreferred.trim(),
      cutoffMark: cutoff,
      emailVerified: true,
      status: "pending",
      ip,
      submittedAt: new Date(),
    });

    await application.save();

    // 5. Asynchronous Communications
    // A. Send confirmation email to the student with tracking link
    sendApplicationReceived(cleanEmail, application.name, application._id.toString()).catch((e) =>
      console.warn("[Admission Submit] Error sending receipt email:", e.message)
    );

    // B. Send In-App & Web Push Notification to Admin and HODs
    notifyAdmissionApplication(application).catch((e) =>
      console.warn("[Admission Submit] Error notifying admin/HODs:", e.message)
    );

    res.status(201).json({
      success: true,
      message: "Admission application submitted successfully!",
      applicationId: application._id,
    });
  } catch (err) {
    console.error("[Admission API] Submit application error:", err);
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Duplicate application: This hall ticket number or email already exists.",
      });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------------------------------------------------------------------
// 5. PUBLIC: Application Status Tracking View (Consumed by admission-status.php)
// ---------------------------------------------------------------------------
router.get("/admin/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid application ID format" });
    }

    const application = await AdmissionApplication.findById(id).lean();
    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found. Please verify your link." });
    }

    res.status(200).json({ success: true, data: application });
  } catch (err) {
    console.error("[Admission API] Fetch single application error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------------------------------------------------------------------
// 6. PROTECTED ADMIN: Get Applications List with Stats & Filters
// ---------------------------------------------------------------------------
router.get("/admin/applications/list", authMiddleware, async (req, res) => {
  try {
    const userRole = req.user?.role;
    if (!["Admin", "HOD", "staff"].includes(userRole)) {
      return res.status(403).json({ success: false, message: "Access denied. Admin or HOD only." });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;

    const filter = {};

    // Filter by status
    if (req.query.status && ["pending", "accepted", "rejected"].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    // Filter by department
    if (req.query.department && req.query.department !== "ALL") {
      filter.department = req.query.department.trim();
    }

    // Filter by academic year
    if (req.query.academicYear && req.query.academicYear !== "ALL") {
      filter.academicYear = req.query.academicYear.trim();
    }

    // Search query
    if (req.query.search && req.query.search.trim()) {
      const q = req.query.search.trim();
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { hallTicketNo: { $regex: q, $options: "i" } },
        { mobile: { $regex: q, $options: "i" } },
        { branchPreferred: { $regex: q, $options: "i" } },
      ];
    }

    const [applications, total, totalPending, totalAccepted, totalRejected, totalAll] = await Promise.all([
      AdmissionApplication.find(filter).sort({ submittedAt: -1 }).skip(skip).limit(limit).lean(),
      AdmissionApplication.countDocuments(filter),
      AdmissionApplication.countDocuments({ status: "pending" }),
      AdmissionApplication.countDocuments({ status: "accepted" }),
      AdmissionApplication.countDocuments({ status: "rejected" }),
      AdmissionApplication.countDocuments({}),
    ]);

    res.status(200).json({
      success: true,
      data: applications,
      stats: {
        totalAll,
        pending: totalPending,
        accepted: totalAccepted,
        rejected: totalRejected,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    console.error("[Admission API] Admin list applications error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------------------------------------------------------------------------
// 7. PROTECTED ADMIN: Update Application Status (Approve / Reject) with Remarks
// ---------------------------------------------------------------------------
router.put("/admin/:id/status", authMiddleware, async (req, res) => {
  try {
    const userRole = req.user?.role;
    if (!["Admin", "HOD"].includes(userRole)) {
      return res.status(403).json({ success: false, message: "Access denied. Admin or HOD only." });
    }

    const { id } = req.params;
    const { status, adminComment } = req.body;

    if (!status || !["pending", "accepted", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "Status must be 'pending', 'accepted', or 'rejected'" });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid application ID format" });
    }

    const application = await AdmissionApplication.findById(id);
    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    application.status = status;
    if (adminComment !== undefined) {
      application.adminComment = adminComment.trim();
    }

    await application.save();

    // Send formal status update email to the student
    sendApplicationStatusUpdate(
      application.email,
      application.name,
      status,
      application.adminComment,
      application.submittedAt,
      application._id.toString()
    ).catch((e) => console.warn("[Admission Status] Email notification error:", e.message));

    res.status(200).json({
      success: true,
      message: `Application marked as ${status.toUpperCase()} and intimation email sent to candidate.`,
      data: application,
    });
  } catch (err) {
    console.error("[Admission API] Update status error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
