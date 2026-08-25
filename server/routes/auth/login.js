const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const User = require('../../models/User');
const Staff = require('../../models/Staff');
const Student = require('../../models/Student');
const PasswordReset = require('../../models/PasswordReset');
const RefreshSession = require('../../models/RefreshSession');
const transporter = require('../../config/mailer');
const authMiddleware = require('../../middleware/verifyToken');
const {
  loginLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
} = require('../../middleware/rateLimiter');

const {
  isProd,
  accessCookieOptions,
  refreshCookieOptions,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
} = require('../../config/cookie');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ---------- Helper: get profile image from Staff, Student or User ----------
const getProfileImage = async (user) => {
  const normalizedRole = (user.role || '').toString().toLowerCase();
  if (normalizedRole === 'staff' || normalizedRole === 'hod') {
    const staff = await Staff.findOne({ staff_id: user.username });
    if (staff && staff.photo_file_id) {
      return `/api/admin/staff/${staff.staff_id}/photo`;
    }
  } else if (normalizedRole === 'student') {
    const student = await Student.findOne({
      $or: [
        { register_no: user.username },
        { roll_no: user.username },
        { student_id: user.username },
        { email: user.email },
      ],
    });
    if (student) {
      if (student.photo_file_id) {
        return `/api/admin/student/${student.student_id}/photo?v=${student.photo_version || 0}`;
      }
      if (student.profile_image) {
        return student.profile_image;
      }
    }
  }
  return user.profile_image || null;
};

// ---------- Helper: generate secure random refresh token ----------
const generateRefreshToken = () => crypto.randomBytes(32).toString('hex');

// ---------- Helper: hash a token ----------
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// ==================== AUTH ENDPOINTS ====================

// ---------- Login ----------
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if(user.isActive===false){
      return res.status(401).json({message:"Login access is Revoked for this account"})
    }
    // 1. Create access token (40 min on login)
    const accessToken = jwt.sign(
      {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: '40m' }
    );

    // 2. Create refresh token (valid for 8 hours from first login)
    const refreshToken = generateRefreshToken();
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

    // 3. Store refresh session in DB
    await RefreshSession.create({
      userId: user._id,
      tokenHash,
      expiresAt,
      createdAt: new Date(),
      lastUsedAt: new Date(),
    });

    // 4. Set cookies
    res.cookie(ACCESS_COOKIE, accessToken, {
      ...accessCookieOptions,
      maxAge: 40 * 60 * 1000,
    });
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);

    // 5. Get profile image (if any)
    const profileImage = await getProfileImage(user);

    return res.status(200).json({
      status: 'success',
      role: user.role,
      name: user.name,
      profile_image: profileImage,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ---------- Google Login ----------
router.post('/verify_google', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Google token required' });
    }

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload.email;
    const googleImage = payload.picture;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        message: 'Email not registered. Contact admin.',
      });
    }

    if(user.isActive===false){
      return res.status(403).json({message:"Login access is Revoked for this account"})
    }

    // Create access token (40 min on login)
    const accessToken = jwt.sign(
      {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: '40m' }
    );

    // Create refresh session (8 hours from first login)
    const refreshToken = generateRefreshToken();
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await RefreshSession.create({
      userId: user._id,
      tokenHash,
      expiresAt,
      createdAt: new Date(),
      lastUsedAt: new Date(),
    });

    res.cookie(ACCESS_COOKIE, accessToken, {
      ...accessCookieOptions,
      maxAge: 40 * 60 * 1000,
    });
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);

    const profileImage = await getProfileImage(user);
    const finalImage = profileImage || googleImage;

    return res.json({
      status: 'success',
      message: 'Login success',
      role: user.role,
      name: user.name,
      profile_image: finalImage,
    });
  } catch (err) {
    console.error('Google login error:', err);
    return res.status(401).json({ error: 'Invalid Google token' });
  }
});

// ---------- Logout ----------
router.post('/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies[REFRESH_COOKIE];
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      const session = await RefreshSession.findOne({ tokenHash });
      if (session && !session.revokedAt) {
        session.revokedAt = new Date();
        await session.save();
      }
    }

    // Clear both cookies using the same options
    res.clearCookie(ACCESS_COOKIE, accessCookieOptions);
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);

    return res.status(200).json({
      message: 'Logged out successfully',
      status: 'success',
      islogout: true,
    });
  } catch (error) {
    console.error('Logout error:', error);
    // Still clear cookies
    res.clearCookie(ACCESS_COOKIE, accessCookieOptions);
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
    return res.status(500).json({ message: 'Internal server error' });
  }
});


// ---------- Get Current User (/me) ----------
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      'email name role profile_image username isActive'
    );
    if (!user || user.isActive === false) {
      res.clearCookie(ACCESS_COOKIE, accessCookieOptions);
      res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
      return res.status(401).json({ message: 'User not found or inactive', islogout: true });
    }

    const profileImage = await getProfileImage(user);
    return res.status(200).json({
      status: 'success',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        profile_image: profileImage || user.profile_image,
      },
    });
  } catch (error) {
    console.error('Auth check error:', error);
    res.clearCookie(ACCESS_COOKIE, accessCookieOptions);
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
    return res.status(401).json({ message: 'Invalid token', islogout: true });
  }
});

// ---------- Verify Role (for frontend route guards) ----------
router.get('/verify-me', authMiddleware, async (req, res) => {
  if (!req.user.role) {
    return res.status(401).json({ message: 'No user role found', isLogout: true });
  }
  return res.status(200).json({ role: req.user.role });
});

// ---------- Verify User Department ----------
router.get("/verify-dep", authMiddleware, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        message: "User ID not found in authentication token",
        isLogout: true,
      });
    }

    // Get authenticated user
    const user = await User.findById(req.user.id).select(
      "username role"
    );

    if (!user) {
      return res.status(401).json({
        message: "User not found",
        isLogout: true,
      });
    }

    const role = String(user.role || "").trim().toLowerCase();

    // Department lookup is required only for Staff and HOD
    if (role !== "staff" && role !== "hod") {
      return res.status(200).json({
        dep: null,
      });
    }

    if (!user.username) {
      return res.status(404).json({
        message: "Staff username not found",
        dep: null,
      });
    }

    // User.username corresponds to Staff.staff_id
    const staff = await Staff.findOne({
      staff_id: user.username,
    }).select("department_code staff_id staff_status");

    if (!staff) {
      return res.status(404).json({
        message: "Staff record not found",
        dep: null,
      });
    }

    // Optional: don't allow inactive/resigned/retired staff
    if (staff.staff_status !== "Active") {
      return res.status(403).json({
        message: "Staff account is not active",
        dep: null,
      });
    }

    return res.status(200).json({
      dep: staff.department_code || null,
    });

  } catch (error) {
    console.error("Verify department error:", error);

    return res.status(500).json({
      message: "Failed to verify department",
      dep: null,
    });
  }

});
// ---------- Forgot Password ----------
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(200).json({
        message: 'If an account exists with this email, a reset link has been sent.',
      });
    }

    // Delete previous reset tokens
    await PasswordReset.deleteMany({ userId: user._id });

    // Generate random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await PasswordReset.create({
      userId: user._id,
      tokenHash,
      expiresAt,
    });

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    await transporter.sendMail({
      from: `"NICETech ERP" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Reset Your NICETech ERP Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#1e293b;background-color:#f8fafc;margin:0;padding:24px 12px;">
          <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;border:1px solid #e2e8f0;box-shadow:0 4px 20px rgba(0,0,0,0.04);overflow:hidden;">
            <div style="padding:24px 28px 20px;background:#ffffff;border-bottom:1px solid #f1f5f9;">
              <div style="font-size:20px;font-weight:800;color:#1d4ed8;letter-spacing:-0.3px;">NICETech ERP</div>
              <div style="font-size:13px;font-weight:600;color:#64748b;margin-top:3px;">Noorul Islam College of Engineering and Technology</div>
              <div style="display:inline-block;background:#eff6ff;color:#2563eb;font-size:11px;font-weight:700;text-transform:uppercase;padding:3px 8px;border-radius:6px;margin-top:8px;">Security &amp; Authentication</div>
            </div>
            <div style="padding:28px;">
              <h2 style="font-size:18px;font-weight:700;color:#0f172a;margin:0 0 14px 0;">Reset Your Password</h2>
              <p style="font-size:14px;color:#334155;margin:0 0 14px 0;">Hello <strong>${user.name}</strong>,</p>
              <p style="font-size:14px;color:#334155;margin:0 0 14px 0;">We received a request to reset your password for your <strong>NICETech ERP</strong> account. Click the button below to choose a new password:</p>
              
              <div style="text-align:center;margin:26px 0;">
                <a href="${resetLink}" style="display:inline-block;padding:12px 28px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">
                  Reset Password
                </a>
              </div>

              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;margin:18px 0;font-size:13px;color:#64748b;">
                ⏱️ This password reset link will expire in <strong>15 minutes</strong> for security reasons.<br>
                If you did not request a password reset, you can safely ignore this email.
              </div>

              <p style="font-size:12px;color:#94a3b8;word-break:break-all;margin-top:16px;">
                Link: <a href="${resetLink}" style="color:#2563eb;">${resetLink}</a>
              </p>
            </div>
            <div style="background:#f8fafc;padding:18px 28px;text-align:center;font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-weight:700;color:#334155;">NICETech ERP • Noorul Islam College of Engineering and Technology</p>
              <p style="margin:4px 0 0 0;font-size:11px;color:#94a3b8;">This is an automated security notification. Please do not reply directly to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    return res.status(200).json({
      message: 'If an account exists with this email, a reset link has been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ---------- Reset Password ----------
router.post('/reset-password', resetPasswordLimiter, async (req, res) => {
  try {
    const { token, password } = req.body || {};

    if (typeof token !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Token and password are required' });
    }

    // Password validation (same as original)
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }
    if (password.length > 128) {
      return res.status(400).json({ message: 'Password must not exceed 128 characters' });
    }
    if (password.trim() !== password) {
      return res.status(400).json({ message: 'Password must not start or end with spaces' });
    }
    const commonPasswords = [
      'password',
      'password123',
      '12345678',
      '123456789',
      '1234567890',
      'qwerty123',
      'qwertyui',
      'admin123',
      'admin1234',
      'welcome123',
      'letmein123',
      'college123',
      'student123',
      'manush123',
    ];
    if (commonPasswords.includes(password.toLowerCase())) {
      return res.status(400).json({
        message: 'This password is too common. Please choose a stronger password',
      });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const resetRequest = await PasswordReset.findOne({
      tokenHash,
      expiresAt: { $gt: new Date() },
    });

    if (!resetRequest) {
      return res.status(400).json({ message: 'Invalid or expired reset link' });
    }

    const user = await User.findById(resetRequest.userId);
    if (!user) {
      return res.status(400).json({ message: 'Invalid reset request' });
    }

    // Update password
    user.password = password;
    await user.save();

    // Delete used token
    await PasswordReset.deleteOne({ _id: resetRequest._id });

    // Revoke all refresh sessions for this user (force re-login)
    await RefreshSession.updateMany(
      { userId: user._id },
      { revokedAt: new Date() }
    );

    // Clear any existing authentication cookies
    res.clearCookie(ACCESS_COOKIE, accessCookieOptions);
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);

    return res.status(200).json({
      status: 'success',
      message: 'Password reset successfully. Please log in again.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ---------- Change Password (authenticated) ----------
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Validate new password (same rules as reset)
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }
    if (newPassword.length > 128) {
      return res.status(400).json({ message: 'Password must not exceed 128 characters' });
    }
    if (newPassword.trim() !== newPassword) {
      return res.status(400).json({ message: 'Password must not start or end with spaces' });
    }
    const commonPasswords = ['password', 'password123', '12345678', 'qwerty123', 'admin123', 'welcome123', 'letmein123', 'college123', 'student123'];
    if (commonPasswords.includes(newPassword.toLowerCase())) {
      return res.status(400).json({ message: 'This password is too common. Please choose a stronger password' });
    }

    user.password = newPassword;
    await user.save();

    // Revoke all refresh sessions
    await RefreshSession.updateMany(
      { userId: user._id },
      { revokedAt: new Date() }
    );

    // Clear cookies so user must re‑login with new password
    res.clearCookie(ACCESS_COOKIE, accessCookieOptions);
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);

    return res.status(200).json({
      message: 'Password changed successfully. Please log in again.',
    });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;