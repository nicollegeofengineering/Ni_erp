const jwt = require("jsonwebtoken");



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