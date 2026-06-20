const express = require("express");

const router = express.Router();

const db = require("../../config/db");

const trasporter =
    require("../../config/mailer");

const jwt = require("jsonwebtoken");

const crypto = require("crypto");

const activeSessions =
require("../../sessions/sessions");
const { error, profile } = require("console");

require("dotenv").config();

const otpstore = {};
const { OAuth2Client } =require("google-auth-library");
const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID
);


router.post("/request_otp", async (req, res) => {

    try {

        const { email } = req.body;

        // Validate email
        if (!email) {

            return res.status(400).json({
                error: "Email is required"
            });

        }

        // Check user exists
        const [records] = await db.query(
            "SELECT * FROM users WHERE email=?",
            [email]
        );

        if (records.length === 0) {

            return res.status(201).json({
                emessage:
                    "Email not registered. Please contact admin."
            });

        }

        // Existing OTP record
        const existingOtp = otpstore[email];

        // LIMIT OTP REQUESTS
        if (

            existingOtp &&

            existingOtp.attempts >= 5 &&

            Date.now() < existingOtp.blockUntil

        ) {

            return res.status(201).json({
                emessage:
                    "Too many OTP requests. Try again later."
            });

        }

        // Generate OTP
        const otp = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        // Store OTP
        otpstore[email] = {

            otp,

            expiresAt:
                Date.now() +
                (5 * 60 * 1000),

            attempts:
                existingOtp
                    ? existingOtp.attempts + 1
                    : 1,

            blockUntil:
                Date.now() +
                (10 * 60 * 1000)

        };

        // SEND EMAIL
        await trasporter.sendMail({

            from:
                `"Nicetech" <${process.env.EMAIL_USER}>`,

            to: email,

            subject:
                "Your Login OTP - Nicetech",

            html: `
<div style="
    font-family: Arial, sans-serif;
    background: #f4f6f9;
    padding: 40px 20px;
">

    <div style="
        max-width: 460px;
        margin: auto;
        background: #ffffff;
        border-radius: 14px;
        overflow: hidden;
        border: 1px solid #e5e7eb;
    ">

        <!-- Header -->
        <div style="
            background: linear-gradient(135deg, #2563eb, #4f46e5);
            padding: 28px 32px;
        ">

            <h1 style="
                margin: 0;
                color: white;
                font-size: 24px;
                font-weight: bold;
            ">
                Login Verification
            </h1>

            <p style="
                margin: 8px 0 0;
                color: rgba(255,255,255,0.85);
                font-size: 14px;
                line-height: 1.6;
            ">
                Use the one-time password below to securely access your account.
            </p>

        </div>

        <!-- Body -->
        <div style="padding: 32px;">

            <p style="
                margin-top: 0;
                color: #444;
                font-size: 14px;
                line-height: 1.8;
            ">
                A login request was received for your account. 
                Enter the following OTP on the verification page to continue.
            </p>

            <!-- OTP Box -->
            <div style="
                background: #f8fafc;
                border: 1px solid #dbeafe;
                border-radius: 12px;
                padding: 22px;
                text-align: center;
                margin: 28px 0;
            ">

                <div style="
                    font-size: 13px;
                    color: #64748b;
                    margin-bottom: 10px;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                ">
                    Your OTP
                </div>

                <div style="
                    font-size: 34px;
                    font-weight: bold;
                    letter-spacing: 10px;
                    color: #1e293b;
                ">
                    ${otp}
                </div>

            </div>

            <!-- Info -->
            <div style="
                background: #eff6ff;
                border-left: 4px solid #2563eb;
                padding: 14px 16px;
                border-radius: 6px;
                margin-bottom: 24px;
            ">

                <p style="
                    margin: 0;
                    font-size: 13px;
                    color: #1e3a8a;
                    line-height: 1.7;
                ">
                    This OTP is valid for 5 minutes and can only be used once.
                </p>

            </div>

            <div style="
                margin-bottom: 24px;
            ">

                <h3 style="
                    margin: 0 0 10px;
                    font-size: 15px;
                    color: #111827;
                ">
                    Security Tips
                </h3>

                <ul style="
                    padding-left: 18px;
                    margin: 0;
                    color: #555;
                    font-size: 13px;
                    line-height: 1.8;
                ">
                    <li>Never share your OTP with anyone</li>
                    <li>Our staff will never ask for your password or OTP</li>
                    <li>If you did not request this login, ignore this email</li>
                </ul>

            </div>

            <hr style="
                border: none;
                border-top: 1px solid #e5e7eb;
                margin: 28px 0 20px;
            ">

            <!-- Footer -->
            <p style="
                margin: 0;
                text-align: center;
                font-size: 12px;
                color: #94a3b8;
                line-height: 1.7;
            ">
                College Management System <br>
                This is an automated email. Please do not reply.
            </p>

        </div>

    </div>

</div>
`

        });

        

        return res.json({status: "success",});

    } catch (err) {

        console.log(err);

        return res.status(500).json({
            error: "Internal server error"
        });

    }

});

router.post("/verify_google", async (req, res) => {

    try {

        const { token } = req.body;

        if (!token) {

            return res.status(400).json({
                error: "Google token required"
            });

        }

        // VERIFY GOOGLE TOKEN
        const ticket =
            await client.verifyIdToken({
                idToken: token,
                audience:process.env.GOOGLE_CLIENT_ID
            });

        const payload =ticket.getPayload();
        const email =payload.email;
        const image =payload.picture;

        // CHECK USER EXISTS
        const [records] =
            await db.query("SELECT * FROM users WHERE email=?",[email]);

        if (records.length === 0) {
            return res.status(201).json({
                emessage:
                    "Email not registered. Contact admin."
            });

        }

        const user = records[0];
        const user_role = user.role;
        // SINGLE LOGIN SYSTEM
        activeSessions.delete(email);

        const sessionId =
            crypto.randomUUID();

        const fingerprint =
            req.headers["user-agent"];

        activeSessions.set(email, {
            sessionId,
            fingerprint,
            expiresAt:
                Date.now() +
                (20 * 60 * 1000)
        });

        // JWT TOKEN
        const jwtToken = jwt.sign(
            {
                email,
                sessionId,
                user_role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "20m"
            }
        );

        res.cookie("app_token",jwtToken,{
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: 20 * 60 * 1000
        });
        
        return res.json({
            status: "success",
            message: "Login success",
            role: user_role,
            profile_image: image

        });

    } catch (err) {
        console.log(err);
        return res.status(401).json({
            error: "Invalid Google token",
            
        });

    }
});

// VERIFY OTP
router.post("/verify_otp", async (req, res) => {

    try {

        const { email, otp } = req.body;

        const storedOtp =
            otpstore[email];

        if (!storedOtp) {

            return res.status(404).json({
                error: "No OTP found"
            });

        }

        if (
            storedOtp.expiresAt <
            Date.now()
        ) {

            delete otpstore[email];

            return res.status(201).json({
                emessage: "OTP expired"
            });

        }

        if (storedOtp.otp !== otp) {

            return res.status(201).json({
                emessage: "Invalid OTP"
            });

        }

        delete otpstore[email];

        const [records] = await db.query(
            "SELECT * FROM users WHERE email=?",
            [email]
        );

        if (records.length === 0) {

            return res.status(201).json({
                emessage: "User not found"
            });

        }
            const user = records[0];
            const user_role = user.role;
        // SINGLE LOGIN SYSTEM
        activeSessions.delete(email);

        const sessionId =
            crypto.randomUUID();

        const fingerprint =
            req.headers["user-agent"];

        activeSessions.set(email, {
            sessionId,
            fingerprint,
            expiresAt:
                Date.now() +
                (20 * 60 * 1000)
        });

        const token = jwt.sign(

            {
                email,
                sessionId,
                user_role 
            },

            process.env.JWT_SECRET,

            {
                expiresIn: "20m"
            }

        );
        res.cookie("app_token",token,{
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: 20 * 60 * 1000
        });

        return res.json({
            status: "success",
            message: "Login success",
            role: user_role,
            profile_image: user.profile_image || null
        });

    } catch (err) {

        console.log(err);

        return res.status(500).json({
            error: "Internal server error"
        });

    }

});


// LOGOUT
router.post("/logout", (req, res) => {

    try {

        const token = req.cookies.app_token;

        if (!token) {
            return res.status(401).json({
                error: "No token found",
                status: "failed"
            });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        activeSessions.delete(decoded.email);

        // Remove cookie with matching options
        res.clearCookie("app_token", {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            path: "/"
        });

        return res.json({
            message: "Logged out successfully",
            status: "success"
        });

    } catch (err) {

        console.error("Logout error:", err.message);
        
        // Clear cookie anyway for security
        res.clearCookie("app_token", {
            httpOnly: true,
            secure: false,
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