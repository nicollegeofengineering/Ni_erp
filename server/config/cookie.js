const isProd = process.env.NODE_ENV === "production";

console.log("Cookie environment:", isProd ? "PRODUCTION" : "DEVELOPMENT");

const accessCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  path: "/",
  maxAge: 20 * 60 * 1000,
};

const refreshCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  path: "/",
  maxAge: 8 * 60 * 60 * 1000,
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