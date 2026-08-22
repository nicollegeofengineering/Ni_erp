const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const User = require('../../models/User');
const Staff = require('../../models/Staff');
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

// ---------- Helper: get profile image from Staff or User ----------
const getProfileImage = async (user) => {
  const normalizedRole = (user.role || '').toString();
  if (normalizedRole === 'Staff' || normalizedRole === 'Hod' || normalizedRole === 'HOD') {
    const staff = await Staff.findOne({ staff_id: user.username });
    if (staff && staff.photo_file_id) {
      return `/api/admin/staff/${staff.staff_id}/photo`;
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

    // 1. Create access token (20 min)
    const accessToken = jwt.sign(
      {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: '20m' }
    );

    // 2. Create refresh token (cryptographically random)
    const refreshToken = generateRefreshToken();
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

    // 3. Store refresh session in DB
    await RefreshSession.create({
      userId: user._id,
      tokenHash,
      expiresAt,
      createdAt: new Date(),
    });

    // 4. Set cookies (both __Host- prefixed)
    res.cookie(ACCESS_COOKIE, accessToken, accessCookieOptions);
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
      return res.status(201).json({
        message: 'Email not registered. Contact admin.',
      });
    }

    // Create access token
    const accessToken = jwt.sign(
      {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: '20m' }
    );

    // Create refresh session
    const refreshToken = generateRefreshToken();
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    await RefreshSession.create({
      userId: user._id,
      tokenHash,
      expiresAt,
      createdAt: new Date(),
    });

    res.cookie(ACCESS_COOKIE, accessToken, accessCookieOptions);
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
router.get('/me', authMiddleware,async (req, res) => {
  try {
    const token = req.cookies[ACCESS_COOKIE];
    if (!token) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select(
      'email name role profile_image username'
    );
    if (!user) {
      res.clearCookie(ACCESS_COOKIE, accessCookieOptions);
      return res.status(401).json({ message: 'User not found' });
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
    return res.status(401).json({ message: 'Invalid token' });
  }
});

// ---------- Verify Role (for frontend route guards) ----------
router.get('/verify-me', authMiddleware, async (req, res) => {
  if (!req.user.role) {
    return res.status(401).json({ message: 'No user role found', isLogout: true });
  }
  return res.status(200).json({ role: req.user.role });
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
      from: `"NIC ERP" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Reset your NIC ERP password',
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Password Reset</h2>
          <p>Hello ${user.name},</p>
          <p>We received a request to reset your NIC ERP password.</p>
          <p>Click the button below to create a new password.</p>
          <a href="${resetLink}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;">
            Reset Password
          </a>
          <p>This link will expire in 15 minutes.</p>
          <p>If you did not request this, you can safely ignore this email.</p>
        </div>
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