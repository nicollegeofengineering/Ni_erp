const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const isProd = process.env.NODE_ENV === "production";
const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.PHP_URL,
    "http://localhost:3000",
    "http://localhost:8000"
].filter(Boolean);

const db = require("./config/db");

// ---------------- Routes
const loginRoute = require("./routes/auth/login");
const adminVerifyRoute = require("./routes/admin/admin_verify");
const adminStaffRoute = require("./routes/admin/staff");
const adminHallRoute = require("./routes/admin/hall");
const adminSubjectRoute = require("./routes/admin/subject");
const timetableRoute = require("./routes/admin/timetable");
const DepartmentRoute = require("./routes/admin/department");
const StudentRoute = require("./routes/admin/student");
const AttendanceRoute = require("./routes/staff/attendance");


const hodstaff = require("./routes/hod/hodstaff");
const markmanagement = require("./routes/mark/marks");
const announcementRoute = require("./routes/announcement/announcements");
const studentRoute = require("./routes/student/student");
const userProfileRoute = require("./routes/user/profile");

const authMiddleware = require("./middleware/verifyToken");

// ---------------- App
const app = express();
app.set("trust proxy", 1);
console.log("Express trust proxy set to 1. NODE_ENV=", process.env.NODE_ENV);

// ---------------- Middleware
app.use(express.json());

app.use(cookieParser());

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }

        callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(
    helmet({
        crossOriginResourcePolicy: {
            policy: "cross-origin"
        }
    })
);

// ---------------- Public Routes (No Auth Needed)
app.use("/auth", loginRoute);
app.use("/api/announcements/public", (req, res, next) => {
    // Route handles public announcement access
    announcementRoute(req, res, next);
});

// ---------------- Public News Ticker (for College Website niphp)
const newsRoute = require("./routes/news/news");
app.use("/api/news", newsRoute);

// ---------------- Online Admission Application Module (Public student application & protected admin routes)
const admissionRoute = require("./routes/admission/admission");
app.use("/api/admission", admissionRoute);

// ---------------- Protected Routes
app.use("/api", authMiddleware, adminVerifyRoute);
app.use("/api/admin/staff", authMiddleware, adminStaffRoute);
app.use("/api/admin/hall", authMiddleware, adminHallRoute);
app.use("/api/admin/subject", authMiddleware, adminSubjectRoute);
app.use("/api/admin/timetable", authMiddleware, timetableRoute);
app.use("/api/admin/department", authMiddleware, DepartmentRoute);
app.use("/api/admin/student", authMiddleware, StudentRoute);

app.use("/api/mark/", authMiddleware, markmanagement)
app.use("/api/staff/attendance/", authMiddleware, AttendanceRoute)
app.use("/api/announcements", authMiddleware, announcementRoute);
app.use("/api/student", authMiddleware, studentRoute);

app.use("/api/hod/staff", authMiddleware, hodstaff)
app.use("/api/user", authMiddleware, userProfileRoute);

// ---------------- Feedback Module Route
const feedbackRoute = require("./routes/feedback/feedback");
app.use("/api/feedback", feedbackRoute);

// ---------------- Push & In-App Notifications Route
const notificationsRoute = require("./routes/notifications/notifications");
app.use("/api/notifications", notificationsRoute);

// ---------------- Isolated Exam Hall Allocation Module Route
const examHallRoute = require("./examHall/routes/examHall");
app.use("/api/exam-hall", authMiddleware, examHallRoute);

// ---------------- Internal Exam Timetable Module Route
const examTimetableRoute = require("./routes/admin/examTimetable");
app.use("/api/exam-timetable", authMiddleware, examTimetableRoute);

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