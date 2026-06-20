const jwt = require("jsonwebtoken");

const activeSessions = require("../sessions/sessions");

const verifyToken = (req, res, next) => {

    try {

        const token = req.cookies.app_token;

        if (!token) {

            return res.status(401).json({
                error: "Token missing"
            });

        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        const session =
            activeSessions.get(decoded.email);

        if (!session) {

            return res.status(201).json({
                islogin: false,
                error: "Session not found"
            });

        }

        // Session validation
        if (
            session.sessionId !== decoded.sessionId
        ) {

            return res.status(201).json({
                islogin: false,
                error: "Logged in from another device"
            });

        }

        // Expiry validation
        if (session.expiresAt < Date.now()) {

            activeSessions.delete(decoded.email);

            return res.status(201).json({
                islogin: false,
                error: "Session expired"
            });

        }

        // Fingerprint check
        const fingerprint =
            req.headers["user-agent"];

        if (
            session.fingerprint !== fingerprint
        ) {

            return res.status(201).json({
                islogin: false,
                error: "Device mismatch"
            });

        }

        // TOKEN ROTATION
        const remainingTime =
            decoded.exp -
            Math.floor(Date.now() / 1000);

        // Less than 5 mins
        if (remainingTime < 300) {

            const crypto = require("crypto");

            const newSessionId =
                crypto.randomUUID();

            activeSessions.set(decoded.email, {
                sessionId: newSessionId,
                fingerprint,
                expiresAt:
                    Date.now() +
                    (20 * 60 * 1000)
            });

            const newToken = jwt.sign(
                {
                    email: decoded.email,
                    sessionId: newSessionId,
                    role: decoded.role
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: "20m"
                }
            );

            res.cookie("app_token", newToken, {
                httpOnly: false,
                secure: false,
                sameSite: "lax",
                maxAge: 20 * 60 * 1000
            });
        }

        req.user = decoded;

        next();

    } catch (err) {

        console.log(err);

        return res.status(401).json({
            error: "Invalid token",
            details: err.message
        });

    }

};

module.exports = verifyToken;