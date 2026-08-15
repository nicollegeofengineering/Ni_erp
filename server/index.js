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
const adminSubjectRoute = require("./routes/admin/subject");
const timetableRoute=require("./routes/admin/timetable");
const DepartmentRoute=require("./routes/admin/department");


const hodstaff=require("./routes/hod/hodstaff")

const authMiddleware = require("./middleware/verifyToken");

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
app.use("/api", authMiddleware, adminVerifyRoute);
app.use("/api/admin/staff", authMiddleware, adminStaffRoute);
app.use("/api/admin/hall", authMiddleware, adminHallRoute);
app.use("/api/admin/subject", authMiddleware, adminSubjectRoute);
app.use("/api/admin/timetable",authMiddleware,timetableRoute)
app.use("/api/admin/department",authMiddleware,DepartmentRoute)

app.use("/api/hod/staff",authMiddleware,hodstaff)

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