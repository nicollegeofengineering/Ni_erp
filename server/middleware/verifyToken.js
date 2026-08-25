const jwt = require('jsonwebtoken');
const { ACCESS_COOKIE, REFRESH_COOKIE, accessCookieOptions, refreshCookieOptions } = require('../config/cookie');
const RefreshSession = require('../models/RefreshSession');
const User = require('../models/User');
const crypto = require('crypto');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * Helper to refresh the access token using a valid refresh token session.
 * Strictly maintains 8 hours session validity from first login and sets 20m access token.
 */
async function tryRefreshSession(req, res) {
  const refreshToken = req.cookies?.[REFRESH_COOKIE];
  if (!refreshToken) return null;

  try {
    const tokenHash = hashToken(refreshToken);
    const session = await RefreshSession.findOne({ tokenHash });

    // Validate session: must exist, not revoked, and expiresAt must be in the future (within 8 hours from first login)
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      return null;
    }

    const user = await User.findById(session.userId);
    if (!user || user.isActive === false) {
      return null;
    }

    // Generate new access token with 20m expiry
    const newAccessToken = jwt.sign(
      {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: '20m' }
    );

    // Update last used timestamp without moving the original 8-hour expiresAt
    session.lastUsedAt = new Date();
    await session.save();

    // Set refreshed access token cookie (20 minutes)
    res.cookie(ACCESS_COOKIE, newAccessToken, {
      ...accessCookieOptions,
      maxAge: 20 * 60 * 1000,
    });

    return {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
    };
  } catch (error) {
    console.error('Auto-refresh error in verifyToken:', error);
    return null;
  }
}

const verifyToken = async (req, res, next) => {
  const token =
    req.cookies?.[ACCESS_COOKIE] ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null);

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const now = Math.floor(Date.now() / 1000);
      const remainingTime = decoded.exp - now;

      // If token is about to expire (within 5 minutes), proactively refresh
      if (remainingTime < 300 && remainingTime > 0) {
        const refreshedUser = await tryRefreshSession(req, res);
        if (refreshedUser) {
          req.user = refreshedUser;
          return next();
        }
      }

      // Token is still valid
      req.user = decoded;
      return next();

    } catch (err) {
      // Token is expired or invalid - fallback to refresh token below
      console.warn('Access token verification failed, attempting auto-refresh:', err.message);
    }
  }

  // If access token was missing or expired, attempt auto-refresh using refresh token
  const refreshedUser = await tryRefreshSession(req, res);
  if (refreshedUser) {
    req.user = refreshedUser;
    return next();
  }

  // Both access token and refresh token failed/expired
  res.clearCookie(ACCESS_COOKIE, accessCookieOptions);
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
  return res.status(401).json({
    error: 'Session expired. Please log in again.',
    islogout: true,
  });
};

module.exports = verifyToken;