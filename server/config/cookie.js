const isProd = process.env.NODE_ENV === "production";

const accessCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
  path: "/",
  domain: isProd ? ".manushn.in" : undefined,
  maxAge: 40 * 60 * 1000, // 40 minutes on login
};

const refreshCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
  path: "/",
  domain: isProd ? ".manushn.in" : undefined,
  maxAge: 8 * 60 * 60 * 1000, // 8 hours from first login
};

const ACCESS_COOKIE = "ni_erp_token";
const REFRESH_COOKIE = "ni_erp_refresh";

module.exports = {
  isProd,
  accessCookieOptions,
  refreshCookieOptions,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
};