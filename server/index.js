const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
require("dotenv").config();

const db = require("./config/db");

// ---------------- Routes
const loginRoute = require("./routes/auth/login");
const adminVerifyRoute = require("./routes/admin/admin_verify");
const adminStaffRoute = require("./routes/admin/staff");
const adminHallRoute = require("./routes/admin/hall");

// ---------------- App
const app = express();

// ---------------- Middleware
app.use(express.json());

app.use(cookieParser());

app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true
}));

app.use(
    helmet({
        crossOriginResourcePolicy: {
            policy: "cross-origin"
        }
    })
);

// ---------------- Routes
app.use("/auth", loginRoute);
app.use("/api", adminVerifyRoute);
app.use("/api/admin/staff", adminStaffRoute);
app.use("/api/admin/hall",adminHallRoute);

app.use(
    "/uploads",
    express.static(path.join(__dirname, "uploads"))
);

// ---------------- Test route
app.get("/", (req, res) => {
    res.send("Server is running....");
});

// ---------------- Start server
const port = process.env.PORT || 5000;

async function startServer() {
    try {
        await db();

        app.listen(port, () => {
            console.log(`Server is running on port ${port} and db connected`);
        });

    } catch (error) {
        console.error("Failed to start server:", error.message);
        process.exit(1);
    }
}

startServer();