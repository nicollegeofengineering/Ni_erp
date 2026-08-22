const jwt = require('jsonwebtoken');
const { ACCESS_COOKIE, REFRESH_COOKIE, accessCookieOptions, refreshCookieOptions } = require('../config/cookie');
const RefreshSession = require('../models/RefreshSession');
const User = require('../models/User');
const crypto = require('crypto');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const generateRefreshToken = () => crypto.randomBytes(32).toString('hex');

const REFRESH_SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.[ACCESS_COOKIE];

  if (!token) {
    console.warn('Authentication attempt without access token');
    return res.status(401).json({ error: 'Access token missing', islogout: false });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const now = Math.floor(Date.now() / 1000);
    const remainingTime = decoded.exp - now;

    // If token is about to expire (within 5 minutes), attempt to refresh
    if (remainingTime < 300 && remainingTime > 0) {
      const refreshToken = req.cookies?.[REFRESH_COOKIE];
      if (refreshToken) {
        try {
          const tokenHash = hashToken(refreshToken);
          const session = await RefreshSession.findOne({ tokenHash });

          // Validate session
          if (session && !session.revokedAt && session.expiresAt > new Date()) {
            const user = await User.findById(session.userId);
            if (user) {
              // Atomically revoke the current session. If another concurrent
              // request already revoked it, revokedSession will be null and
              // we must NOT create a second replacement token.
              const revokedSession = await RefreshSession.findOneAndUpdate(
                { _id: session._id, revokedAt: null },
                { $set: { revokedAt: new Date(), lastUsedAt: new Date() } },
                { new: true }
              );

              if (revokedSession) {
                // We won the race — this request performs the rotation.
                const newAccessToken = jwt.sign(
                  { id: user._id.toString(), email: user.email, role: user.role },
                  process.env.JWT_SECRET,
                  { expiresIn: '20m' }
                );

                const newRefreshToken = generateRefreshToken();
                const newHash = hashToken(newRefreshToken);
                const newExpiresAt = new Date(Date.now() + REFRESH_SESSION_TTL_MS); // sliding window

                await RefreshSession.create({
                  userId: user._id,
                  tokenHash: newHash,
                  expiresAt: newExpiresAt,
                  createdAt: new Date(),
                  lastUsedAt: new Date(),
                });

                res.cookie(ACCESS_COOKIE, newAccessToken, accessCookieOptions);
                res.cookie(REFRESH_COOKIE, newRefreshToken, refreshCookieOptions);

                req.user = jwt.verify(newAccessToken, process.env.JWT_SECRET);
                return next();
              }
              // else: lost the race — another concurrent request already
              // rotated this session. Fall through and continue using the
              // still-valid access token for this request; the client
              // already has (or will receive) the new refresh cookie from
              // whichever request won.
            }
          }
        } catch (refreshError) {
          // Refresh failed, but we still have a valid access token, so continue
          console.warn('Auto-refresh failed, but access token is still valid');
        }
      }
    }

    // Token is still valid (or refresh not possible/needed), continue
    req.user = decoded;
    return next();

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      console.warn('Expired access token used');
      return res.status(401).json({ error: 'Access token expired', islogout: false });
    }
    console.error('Token verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid token', islogout: false });
  }
};

module.exports = verifyToken;