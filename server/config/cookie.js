const isProd = process.env.NODE_ENV === "production";

console.log("Cookie environment:", isProd ? "PRODUCTION" : "DEVELOPMENT");

// Access token cookie options
const accessCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "strict" : "lax",
  path: "/",
  maxAge: 20 * 60 * 1000,
};

// Refresh token cookie options
const refreshCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "strict" : "lax",
  path: "/",
  maxAge: 8 * 60 * 60 * 1000,
};

// Use __Host- cookies ONLY in production.
// __Host- cookies require Secure + HTTPS and cannot have Domain.
const ACCESS_COOKIE = "ni_erp_token"

const REFRESH_COOKIE = "ni_erp_refresh"

module.exports = {
  isProd,
  accessCookieOptions,
  refreshCookieOptions,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
};