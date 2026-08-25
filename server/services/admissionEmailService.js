const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const nodemailer = require("nodemailer");

const COLLEGE_NAME = "Noorul Islam College of Engineering and Technology";
const ERP_BRAND = "NICETech ERP";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER || "nicetonline@gmail.com",
    pass: process.env.EMAIL_PASS || "gzge vept vheh duog",
  },
});

/**
 * Clean, Modern Light Theme Email Container & Header
 */
function emailHeader(subTitle = "Notification") {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        line-height: 1.6;
        color: #1e293b;
        background-color: #f8fafc;
        margin: 0;
        padding: 24px 12px;
      }
      .email-wrapper {
        max-width: 580px;
        margin: 0 auto;
        background: #ffffff;
        border-radius: 14px;
        border: 1px solid #e2e8f0;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
        overflow: hidden;
      }
      .email-header {
        padding: 24px 28px 20px;
        background: #ffffff;
        border-bottom: 1px solid #f1f5f9;
        text-align: left;
      }
      .brand-title {
        font-size: 20px;
        font-weight: 800;
        color: #1d4ed8;
        letter-spacing: -0.3px;
        margin: 0;
        display: inline-block;
      }
      .college-subtitle {
        font-size: 13px;
        font-weight: 600;
        color: #64748b;
        margin: 3px 0 0 0;
      }
      .category-tag {
        display: inline-block;
        background: #eff6ff;
        color: #2563eb;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        padding: 3px 8px;
        border-radius: 6px;
        margin-top: 8px;
        letter-spacing: 0.4px;
      }
      .email-content {
        padding: 28px;
        background: #ffffff;
      }
      .email-content h2 {
        font-size: 18px;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 14px 0;
      }
      .email-content p {
        font-size: 14px;
        color: #334155;
        margin: 0 0 14px 0;
      }
      .card-box {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 16px 20px;
        margin: 18px 0;
      }
      .card-box p {
        margin: 6px 0;
        font-size: 13.5px;
      }
      .btn {
        display: inline-block;
        background: #2563eb;
        color: #ffffff !important;
        padding: 12px 26px;
        text-decoration: none;
        border-radius: 8px;
        font-weight: 700;
        font-size: 14px;
        text-align: center;
      }
      .btn:hover {
        background: #1d4ed8;
      }
      .otp-container {
        background: #f0fdf4;
        border: 1.5px dashed #16a34a;
        border-radius: 10px;
        padding: 18px;
        text-align: center;
        margin: 20px 0;
      }
      .otp-number {
        font-size: 36px;
        font-weight: 800;
        letter-spacing: 8px;
        color: #15803d;
        font-family: Consolas, Monaco, monospace;
      }
      .email-footer {
        background: #f8fafc;
        padding: 20px 28px;
        text-align: center;
        font-size: 12px;
        color: #64748b;
        border-top: 1px solid #e2e8f0;
      }
      .email-footer p {
        margin: 4px 0;
      }
    </style>
  </head>
  <body>
    <div class="email-wrapper">
      <div class="email-header">
        <div class="brand-title">${ERP_BRAND}</div>
        <div class="college-subtitle">${COLLEGE_NAME}</div>
        ${subTitle ? `<div class="category-tag">${subTitle}</div>` : ""}
      </div>
      <div class="email-content">
  `;
}

function emailFooter() {
  return `
      </div>
      <div class="email-footer">
        <p style="font-weight: 700; color: #334155;">${ERP_BRAND} • ${COLLEGE_NAME}</p>
        <p>Kumaracoil, Thuckalay, Kanyakumari District, Tamil Nadu – 629 180</p>
        <p>Helpline: <strong>+91 94888 85995</strong> | Email: <a href="mailto:nicetau2023@gmail.com" style="color: #2563eb; text-decoration: none;">nicetau2023@gmail.com</a></p>
        <p style="margin-top: 12px; font-size: 11px; color: #94a3b8;">This is an automated institutional communication generated via ${ERP_BRAND}.</p>
      </div>
    </div>
  </body>
  </html>
  `;
}

/**
 * 1. Send OTP for Admission Application (Light Theme)
 */
async function sendAdmissionOtp(email, otp) {
  try {
    const html =
      emailHeader("Admission Verification") +
      `
      <h2>Verification One-Time Password (OTP)</h2>
      <p>Dear Applicant,</p>
      <p>Thank you for initiating your online admission application to <strong>${COLLEGE_NAME}</strong>.</p>
      <p>Please use the following OTP to verify your email address and continue with your application submission:</p>
      
      <div class="otp-container" style="background: #eff6ff; border-color: #3b82f6;">
        <div style="font-size: 11.5px; font-weight: 700; color: #1d4ed8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
          Your 6-Digit Verification Code
        </div>
        <div class="otp-number" style="color: #1d4ed8;">${otp}</div>
      </div>

      <p style="font-size: 13px; color: #64748b; margin-top: 16px;">
        ⏱️ This code will expire in <strong>5 minutes</strong>. For security reasons, please do not share this OTP with anyone.
      </p>
      <p style="font-size: 13px; color: #64748b;">
        If you did not initiate this request, you can safely ignore this email.
      </p>
    ` +
      emailFooter();

    await transporter.sendMail({
      from: `"${ERP_BRAND} Admissions" <${process.env.EMAIL_USER || "nicetonline@gmail.com"}>`,
      to: email,
      subject: `Your OTP for Admission Application - ${otp}`,
      html,
    });
    return true;
  } catch (err) {
    console.error("[Admission Mailer] Failed to send OTP:", err.message);
    throw err;
  }
}

/**
 * 2. Send Application Received Acknowledgement with Status Tracking Link (Light Theme)
 */
async function sendApplicationReceived(email, name, applicationId) {
  try {
    const websiteBase = (process.env.PHP_URL || "https://www.niceindia.com").replace(/\/+$/, "");
    const statusLink = `${websiteBase}/admission-status.php?id=${applicationId}`;

    const html =
      emailHeader("Online Admissions") +
      `
      <h2>Application Received Successfully</h2>
      <p>Dear <strong>${name}</strong>,</p>
      <p>We are pleased to inform you that your online admission application has been received for the academic year <strong>${new Date().getFullYear()}-${new Date().getFullYear() + 1}</strong>.</p>
      
      <div class="card-box">
        <p><strong>Application Reference ID:</strong> <span style="font-family: Consolas, Monaco, monospace; font-size: 14px; font-weight: 800; color: #2563eb;">${applicationId}</span></p>
        <p><strong>Submission Date:</strong> ${new Date().toLocaleString("en-IN", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
        <p><strong>Application Status:</strong> <span style="background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 12px; border: 1px solid #fde68a;">PENDING REVIEW</span></p>
      </div>

      <p>You can check your application review status and view admin remarks anytime by clicking below:</p>
      
      <div style="text-align: center; margin: 24px 0;">
        <a href="${statusLink}" class="btn" target="_blank">View Application Status</a>
      </div>

      <p style="font-size: 12.5px; color: #64748b;">
        If the button above does not work, copy and paste this link into your browser:<br>
        <a href="${statusLink}" style="color: #2563eb; word-break: break-all;">${statusLink}</a>
      </p>

      <p>Our admissions committee will review your cutoff marks and preferences and notify you via email shortly.</p>
      <p>Thank you for choosing ${COLLEGE_NAME}.</p>
    ` +
      emailFooter();

    await transporter.sendMail({
      from: `"${ERP_BRAND} Admissions" <${process.env.EMAIL_USER || "nicetonline@gmail.com"}>`,
      to: email,
      subject: `Application Received – ${COLLEGE_NAME}`,
      html,
    });
    return true;
  } catch (err) {
    console.error("[Admission Mailer] Failed to send Application Received email:", err.message);
    return false;
  }
}

/**
 * 3. Send Application Status Update (Approved / Rejected) in Light Theme
 */
async function sendApplicationStatusUpdate(email, name, status, comment, submittedAt, applicationId) {
  try {
    const isAccepted = status === "accepted";
    const statusText = isAccepted ? "PROVISIONALLY ACCEPTED" : "APPLICATION REJECTED";
    const statusColor = isAccepted ? "#15803d" : "#b91c1c";
    const statusBg = isAccepted ? "#f0fdf4" : "#fef2f2";
    const statusBorder = isAccepted ? "#bbf7d0" : "#fecaca";

    const websiteBase = (process.env.PHP_URL || "https://www.niceindia.com").replace(/\/+$/, "");
    const statusLink = applicationId ? `${websiteBase}/admission-status.php?id=${applicationId}` : "";

    // Calculate deadline (3 working days)
    const addWorkingDays = (dateObj, days) => {
      const date = new Date(dateObj || Date.now());
      let added = 0;
      while (added < days) {
        date.setDate(date.getDate() + 1);
        const day = date.getDay();
        if (day !== 0 && day !== 6) added++;
      }
      return date;
    };

    const deadlineDate = addWorkingDays(submittedAt, 3).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    let statusDetails = "";
    if (isAccepted) {
      statusDetails = `
        <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; padding: 16px 20px; margin: 18px 0;">
          <p style="margin: 0; font-weight: 700; color: #166534; font-size: 15px;">
            🎉 Congratulations! Your admission request has been <strong>Provisionally Accepted</strong>.
          </p>
          <p style="margin: 8px 0 0; color: #166534; font-size: 13.5px;">
            To confirm your seat allocation, please bring your original certificates to the college office on or before <strong>${deadlineDate}</strong> (within 3 working days).
          </p>
          <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #86efac; font-size: 12.5px; color: #166534;">
            <strong>Checklist of Documents to Bring:</strong>
            <ul style="margin: 6px 0 0 0; padding-left: 18px;">
              <li>10th &amp; 12th Original Mark sheets</li>
              <li>Transfer Certificate (TC) &amp; Conduct Certificate</li>
              <li>Community Certificate</li>
              <li>Aadhar Card Copy</li>
              <li>4 Recent Passport Size Photographs</li>
            </ul>
          </div>
        </div>
      `;
    } else {
      statusDetails = `
        <div style="background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 8px; padding: 16px 20px; margin: 18px 0;">
          <p style="margin: 0; font-weight: 700; color: #991b1b; font-size: 15px;">
            Application Status: <strong>Not Selected</strong>
          </p>
          <p style="margin: 8px 0 0; color: #991b1b; font-size: 13.5px;">
            We regret to inform you that your application could not be accommodated for the selected branch based on the current cutoff and seat availability.
          </p>
          <p style="margin: 6px 0 0; color: #991b1b; font-size: 12.5px;">
            We appreciate your interest in ${COLLEGE_NAME} and wish you the best in your academic endeavors.
          </p>
        </div>
      `;
    }

    const html =
      emailHeader("Admission Decision") +
      `
      <h2>Admission Application Decision</h2>
      <p>Dear <strong>${name}</strong>,</p>
      <p>We are writing to update you on the status of your admission application to <strong>${COLLEGE_NAME}</strong>.</p>
      
      <div style="background: ${statusBg}; border: 1.5px solid ${statusBorder}; border-radius: 8px; padding: 14px 18px; margin: 16px 0; text-align: center;">
        <span style="font-size: 18px; font-weight: 800; color: ${statusColor}; letter-spacing: 0.5px;">
          ${statusText}
        </span>
      </div>

      ${statusDetails}

      ${
        comment && comment.trim()
          ? `
        <div class="card-box" style="border-left: 4px solid #2563eb;">
          <strong style="color: #1e293b; font-size: 13px;">Official Remarks from Admissions Office:</strong>
          <p style="color: #334155; font-style: italic; margin-top: 4px;">"${comment}"</p>
        </div>
      `
          : ""
      }

      ${
        statusLink
          ? `
        <div style="text-align: center; margin: 24px 0;">
          <a href="${statusLink}" class="btn" target="_blank">View Status Details Online</a>
        </div>
      `
          : ""
      }

      <p style="font-size: 13px; color: #64748b; margin-top: 20px;">
        If you have any questions or require clarification, please contact our admissions office at <strong>+91 94888 85995</strong> or email <strong>nicetau2023@gmail.com</strong>.
      </p>
      <p style="margin-top: 14px;">
        Best regards,<br>
        <strong>Director of Admissions</strong><br>
        ${COLLEGE_NAME}
      </p>
    ` +
      emailFooter();

    await transporter.sendMail({
      from: `"${ERP_BRAND} Admissions" <${process.env.EMAIL_USER || "nicetonline@gmail.com"}>`,
      to: email,
      subject: `Admission Application Decision: ${isAccepted ? "ACCEPTED" : "NOT SELECTED"} – ${COLLEGE_NAME}`,
      html,
    });
    return true;
  } catch (err) {
    console.error("[Admission Mailer] Failed to send status update email:", err.message);
    return false;
  }
}

module.exports = {
  sendAdmissionOtp,
  sendApplicationReceived,
  sendApplicationStatusUpdate,
};
