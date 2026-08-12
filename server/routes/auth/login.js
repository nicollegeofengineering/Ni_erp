const express = require('express');
const router = express.Router();

const OTP = require('../../models/OTP');
const User = require('../../models/User');
const PasswordReset = require("../../models/PasswordReset");
const transporter = require("../../config/mailer");

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const { loginLimiter,forgotPasswordLimiter,resetPasswordLimiter } = require('../../middleware/rateLimiter');

require('dotenv').config();

// Determine secure flag for cookies: enable only in production (HTTPS)
const isProd = process.env.NODE_ENV === 'production';

//Login route login is dont with users username and password and token genarated and set as cookies with 20min expairy
//and if user uses the system continueously the token refresh automatically before 5 minutes of expairy 
// and if user is inactive for 20 minutes the token will expire and user need to login again and
router.post("/login", loginLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        // Basic validation
        if (
            typeof email !== "string" ||
            typeof password !== "string" ||
            !email.trim() ||
            !password
        ) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const user = await User.findOne({
            email: normalizedEmail
        });

      
        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const token = jwt.sign(
            {
                id: user._id.toString(),
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "20m"
            }
        );

        res.cookie("ni_erp_token", token, {
            httpOnly: true,
            secure: isProd,
            sameSite: "lax",
            maxAge: 20 * 60 * 1000,
            path: "/"
        });

        return res.status(200).json({
            status: "success",
            role: user.role,
            name: user.name
        });

    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
});
/*
router.post("/create-user",loginLimiter, async (req, res) => {
    try {
        const {
            email,
            username,
            password,
            name,
            role,
            profile_image
        } = req.body;

        // Validate required fields
        if (!email || !username || !password || !name || !role) {
            return res.status(400).json({
                message: "Email, username, password, name and role are required"
            });
        }

        // Validate role
        const allowedRoles = ["admin", "staff", "student", "hod"];

        if (!allowedRoles.includes(role)) {
            return res.status(400).json({
                message: "Invalid role"
            });
        }

        // Normalize values
        const normalizedEmail = email.trim().toLowerCase();
        const normalizedUsername = username.trim();

        // Check existing email
        const existingEmail = await User.findOne({
            email: normalizedEmail
        });

        if (existingEmail) {
            return res.status(409).json({
                message: "Email already exists"
            });
        }

        // Check existing username
        const existingUsername = await User.findOne({
            username: normalizedUsername
        });

        if (existingUsername) {
            return res.status(409).json({
                message: "Username already exists"
            });
        }

        // Create user
        const user = new User({
            email: normalizedEmail,
            username: normalizedUsername,
            password: password,
            name: name.trim(),
            role: role,
            profile_image: profile_image || null
        });

        // IMPORTANT:
        // UserSchema.pre('save') automatically hashes password
        await user.save();

        return res.status(201).json({
            status: "success",
            message: "User created successfully",
            user: {
                id: user._id,
                email: user.email,
                username: user.username,
                name: user.name,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Create user error:", error);

        // Handle MongoDB duplicate key error
        if (error.code === 11000) {
            return res.status(409).json({
                message: "Email or username already exists"
            });
        }

        return res.status(500).json({
            message: "Internal server error"
        });
    }
});
*/

//---------------------------- Forgot Password and Reset Password Routes -----------------
router.post("/forgot-password",forgotPasswordLimiter, async (req, res) => {
    try {
        const { email } = req.body;

        if (typeof email !== "string" || !email.trim()) {
            return res.status(400).json({
                message: "Email is required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const user = await User.findOne({
            email: normalizedEmail
        });

        
        if (!user) {
            return res.status(200).json({
                message:
                    "If an account exists with this email, a reset link has been sent."
            });
        }

        // Delete previous reset tokens
        await PasswordReset.deleteMany({
            userId: user._id
        });

        // Generate random token
        const resetToken = crypto.randomBytes(32).toString("hex");

        // Hash token before storing it
        const tokenHash = crypto
            .createHash("sha256")
            .update(resetToken)
            .digest("hex");

        // 15 minute expiry
        const expiresAt = new Date(
            Date.now() + 15 * 60 * 1000
        );

        await PasswordReset.create({
            userId: user._id,
            tokenHash,
            expiresAt
        });

        // Frontend reset page
        const resetLink =
            `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

        await transporter.sendMail({
            from: `"NIC ERP" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: "Reset your NIC ERP password",

            html: `
                <div style="font-family: Arial, sans-serif;">
                    <h2>Password Reset</h2>

                    <p>Hello ${user.name},</p>

                    <p>
                        We received a request to reset your NIC ERP password.
                    </p>

                    <p>
                        Click the button below to create a new password.
                    </p>

                    <a
                        href="${resetLink}"
                        style="
                            display:inline-block;
                            padding:12px 20px;
                            background:#2563eb;
                            color:white;
                            text-decoration:none;
                            border-radius:6px;
                        "
                    >
                        Reset Password
                    </a>

                    <p>
                        This link will expire in 15 minutes.
                    </p>

                    <p>
                        If you did not request this, you can safely ignore
                        this email.
                    </p>
                </div>
            `
        });

        return res.status(200).json({
            message:
                "If an account exists with this email, a reset link has been sent."
        });

    } catch (error) {
        console.error("Forgot password error:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
});

//---------------------------- Reset Password Route -----------------


router.post("/reset-password", resetPasswordLimiter, async (req, res) => {
    try {
        const {
            token,
            password
        } = req.body || {};

        if (
            typeof token !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                message: "Token and password are required"
            });
        }

        // Basic password validation
        // Password validation
        if (password.length < 8) {
            return res.status(400).json({
                message: "Password must be at least 8 characters"
            });
        }

        if (password.length > 128) {
            return res.status(400).json({
                message: "Password must not exceed 128 characters"
            });
        }

        if (password.trim() !== password) {
            return res.status(400).json({
                message: "Password must not start or end with spaces"
            });
    }

    // Reject commonly used weak passwords
    const commonPasswords = [
        "password",
        "password123",
        "12345678",
        "123456789",
        "1234567890",
        "qwerty123",
        "qwertyui",
        "admin123",
        "admin1234",
        "welcome123",
        "letmein123",
        "college123",
        "student123",
        "manush123"
    ];

    if (commonPasswords.includes(password.toLowerCase())) {
        return res.status(400).json({
            message: "This password is too common. Please choose a stronger password"
        });
    }

        // Hash token received from frontend
        const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        // Find valid reset token
        const resetRequest = await PasswordReset.findOne({
            tokenHash,
            expiresAt: {
                $gt: new Date()
            }
        });

        if (!resetRequest) {
            return res.status(400).json({
                message: "Invalid or expired reset link"
            });
        }

        // Find user
        const user = await User.findById(
            resetRequest.userId
        );

        if (!user) {
            return res.status(400).json({
                message: "Invalid reset request"
            });
        }

        // Change password
        user.password = password;

        // IMPORTANT:
        // This triggers UserSchema.pre("save")
        // which hashes the password with bcrypt.
        await user.save();

        // Delete token so it cannot be reused
        await PasswordReset.deleteOne({
            _id: resetRequest._id
        });

        return res.status(200).json({
            status: "success",
            message: "Password reset successfully"
        });

    } catch (error) {
        console.error("Reset password error:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
});


// ---------- /verify_google  ----------
router.post("/verify_google", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: "Google token required" });
    }

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const email = payload.email;
    const image = payload.picture;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(201).json({
        message: "Email not registered. Contact admin."
      });
    }

    const jwtToken = jwt.sign(
      { email,name: user.name,role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "20m" }
    );

        res.cookie("ni_erp_token", jwtToken, {
            httpOnly: true,
            secure: isProd,
            sameSite: "lax",
            maxAge: 20 * 60 * 1000,
            path: "/"
        });

    return res.json({
      status: "success",
      message: "Login success",
      role: user.role,
      profile_image: image
    });
  } catch (err) {
    console.error(err);
    return res.status(401).json({ error: "Invalid Google token" });
  }
});


// ---------- /logout (unchanged) ----------
router.post("/logout", (req, res) => {
  try {
    const token = req.cookies.ni_erp_token;
    if (!token) {
      return res.status(401).json({ error: "No token found", status: "failed" });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

        res.clearCookie("ni_erp_token", {
            httpOnly: true,
            secure: isProd,
            sameSite: "lax",
            path: "/"
        });

    return res.json({ message: "Logged out successfully", status: "success" });
  } catch (err) {
    console.error("Logout error:", err.message);
        res.clearCookie("ni_erp_token", {
            httpOnly: true,
            secure: isProd,
            sameSite: "lax",
            path: "/"
        });
    return res.status(401).json({
      error: err.message || "Invalid token",
      status: "failed"
    });
  }
});

module.exports = router;



