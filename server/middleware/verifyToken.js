const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const jwt = require("jsonwebtoken");

const isProd = process.env.NODE_ENV === "production";

const verifyToken = (req, res, next) => {
    try {
        const cookieToken = req.cookies?.ni_erp_token;
        const authHeader = req.headers.authorization || "";
        const bearerToken = authHeader.startsWith("Bearer ")
            ? authHeader.slice(7)
            : null;

        const token = cookieToken || bearerToken;

        if (!token) {
            return res.status(401).json({
                error: "Token missing",
                islogout: true
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const remainingTime = decoded.exp - Math.floor(Date.now() / 1000);

        if (remainingTime < 300) {
            const newToken = jwt.sign(
                {
                    email: decoded.email,
                    id: decoded.id,
                    role: decoded.role
                },
                process.env.JWT_SECRET,
                { expiresIn: "20m" }
            );

            res.cookie("ni_erp_token", newToken, {
                httpOnly: true,
                secure: isProd,
                sameSite: isProd ? "none" : "lax",
                maxAge: 20 * 60 * 1000,
                path: "/"
            });
        }

        req.user = decoded;
        return next();
    } catch (err) {
        if (err.name === "TokenExpiredError") {
            return res.status(401).json({
                error: "Session expired",
                islogout: true
            });
        }

        console.error("Token verification failed:", err.message);

        return res.status(401).json({
            error: "Invalid token",
            details: err.message
        });
    }
};

module.exports = verifyToken;