//This is used to limit the number of login attempts from a single IP address to prevent brute-force attacks.

const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes

  max: 7, // maximum 7 login attempts per IP

  standardHeaders: true,
  legacyHeaders: false,

  message: {
    status: "error",
    message: "Too many login attempts. Please try again after 15 minutes."
  }
});

const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
    status: "error",
    message: "Too many login attempts. Please try again after 15 minutes."
  }
});

const resetPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 7,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
    status: "error",
    message: "Too many login attempts. Please try again after 15 minutes."
  }
});



module.exports = {
  loginLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter
};