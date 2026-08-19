const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const express = require('express');
const router = express.Router();

const OTP = require('../../models/OTP');
const User = require('../../models/User');
const Staff = require('../../models/Staff');          // 👈 added
const PasswordReset = require("../../models/PasswordReset");
const transporter = require("../../config/mailer");

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const authMiddleware = require("../../middleware/verifyToken");

const { loginLimiter, forgotPasswordLimiter, resetPasswordLimiter } = require('../../middleware/rateLimiter');



// Determine secure flag for cookies: enable only in production (HTTPS)
const isProd = process.env.NODE_ENV === 'production';


// ---------- Helper: get profile image from Staff or User ----------
const getProfileImage = async (user) => {
    const normalizedRole = (user.role || '').toString();
    // If user role is Staff or HOD, try to fetch from Staff model
    if (normalizedRole === 'Staff' || normalizedRole === 'Hod' || normalizedRole === 'HOD') {
        const staff = await Staff.findOne({ staff_id: user.username }); // username = staff_id
        if (staff && staff.photo_file_id) {
            // ✅ Return the secure Google Drive photo endpoint
            return `/api/admin/staff/${staff.staff_id}/photo`;
        }
    }
    // Fallback: user's own profile_image (could be old URL or null)
    return user.profile_image || null;
};
// ---------- Login ----------
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

        // Get profile image from Staff if applicable
        const profileImage = await getProfileImage(user);

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
            sameSite: isProd ? "none" : "lax",
            maxAge: 20 * 60 * 1000,
            path: "/"
        });
        // Diagnostic: log cookie attributes when issuing token (helpful in production)
        console.log("Set ni_erp_token cookie on login; secure=", isProd, "sameSite=", isProd ? "none" : "lax");

        return res.status(200).json({
            status: "success",
            role: user.role,
            name: user.name,
            profile_image: profileImage   // 👈 from Staff (or fallback)
        });

    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
});

// ---------- Forgot Password ----------
router.post("/forgot-password", forgotPasswordLimiter, async (req, res) => {
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

// ---------- Reset Password ----------
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

// ---------- Google Login ----------
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
        const googleImage = payload.picture;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(201).json({
                message: "Email not registered. Contact admin."
            });
        }

        // Get profile image from Staff if applicable
        const profileImage = await getProfileImage(user);

        // If no Staff image, use the Google picture as fallback
        const finalImage = profileImage || googleImage;

        const jwtToken = jwt.sign(
            {
                id: user._id.toString(),
                email: user.email,
                name: user.name,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: "20m" }
        );

        res.cookie("ni_erp_token", jwtToken, {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? "none" : "lax",
            maxAge: 20 * 60 * 1000,
            path: "/"
        });
        // Diagnostic: log cookie attributes when issuing token (Google login)
        console.log("Set ni_erp_token cookie on google login; secure=", isProd, "sameSite=", isProd ? "none" : "lax");

        return res.json({
            status: "success",
            message: "Login success",
            role: user.role,
            name: user.name,
            profile_image: finalImage   // 👈 Staff image if exists, otherwise Google image
        });
    } catch (err) {
        console.error(err);
        return res.status(401).json({ error: "Invalid Google token" });
    }
});

// ---------- Logout ----------
router.post("/logout", (req, res) => {
    try {
        const token = req.cookies.ni_erp_token;
        if (!token) {
            res.clearCookie("ni_erp_token", {
                httpOnly: true,
                secure: isProd,
                sameSite: isProd ? "none" : "lax",
                path: "/"
            });
            return res.status(200).json({
                message: "No active session found",
                status: "success",
                islogout: true
            });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        res.clearCookie("ni_erp_token", {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? "none" : "lax",
            path: "/"
        });

        return res.json({ message: "Logged out successfully", status: "success" });
    } catch (err) {
        console.error("Logout error:", err.message);
        res.clearCookie("ni_erp_token", {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? "none" : "lax",
            path: "/"
        });
        return res.status(200).json({
            error: err.message || "Invalid token",
            status: "success",
            islogout: true
        });
    }
});

// ---------- Auto Login (/me) ----------
router.get("/me", async (req, res) => {
    try {
        const token = req.cookies.ni_erp_token;
        if (!token) {
            return res.status(401).json({ message: "Not authenticated" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user details from DB
        const user = await User.findById(decoded.id).select('email name role profile_image username');
        if (!user) {
            // Clear invalid cookie
            res.clearCookie("ni_erp_token", {
                httpOnly: true,
                secure: isProd,
               sameSite: isProd ? "none" : "lax",
                path: "/"
            });
            return res.status(401).json({ message: "User not found" });
        }

        // Get profile image from Staff if applicable
        const profileImage = await getProfileImage(user);

        return res.status(200).json({
            status: "success",
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                role: user.role,
                profile_image: profileImage || user.profile_image
            }
        });
    } catch (error) {
        console.error("Auth check error:", error);
        // Token invalid - clear cookie
        res.clearCookie("ni_erp_token", {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? "none" : "lax",
            path: "/"
        });
        return res.status(401).json({ message: "Invalid token" });
    }
});

// ---------- Token Refresh ----------
router.post("/refresh-token", async (req, res) => {
    try {
        const token = req.cookies.ni_erp_token;
        if (!token) {
            return res.status(401).json({ message: "No token" });
        }

        // Verify existing token (ignoring expiration)
        const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });

        // Issue new token with fresh 20‑min expiry
        const newToken = jwt.sign(
            {
                id: decoded.id,
                email: decoded.email,
                role: decoded.role
            },
            process.env.JWT_SECRET,
            { expiresIn: "20m" }
        );

        // Set new cookie
        res.cookie("ni_erp_token", newToken, {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? "none" : "lax",
            maxAge: 20 * 60 * 1000,
            path: "/"
        });
        // Diagnostic: log when refresh endpoint sets a new cookie
        console.log("Set ni_erp_token cookie on refresh; secure=", isProd, "sameSite=", isProd ? "none" : "lax");

        return res.status(200).json({
            status: "success",
            message: "Token refreshed"
        });
    } catch (error) {
        console.error("Refresh token error:", error);
        // Clear cookie on any error
        res.clearCookie("ni_erp_token", {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? "none" : "lax",
            path: "/"
        });
        return res.status(401).json({ message: "Invalid token" });
    }
});

router.get("/verify-me",authMiddleware ,async(req,res)=>{
    
    if(!req.user.role){
        return res.status(401).json({message:"No user role found",isLogout:true})
    }
    const Urole=req.user.role

    return res.status(200).json({role:Urole})
})

module.exports = router;