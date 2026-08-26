# 🎓 NICETech ERP — Enterprise Higher Education Management Platform

An enterprise-grade, full-stack College ERP (Enterprise Resource Planning) platform built for modern universities, engineering colleges, and higher education institutions. Designed to manage end-to-end institutional operations including student admissions, faculty lifecycle, timetable conflict detection, period-wise attendance, multi-category continuous internal assessments (CIA), exam hall allocation, circulars, and comprehensive Role-Based Access Control (RBAC).

---

## 📑 Table of Contents
1. [System Architecture](#1-system-architecture)
2. [How Secure Is This ERP? (Deep-Dive Security Architecture)](#2-how-secure-is-this-erp-deep-dive-security-architecture)
3. [Role-Based Access Control (RBAC) Matrix](#3-role-based-access-control-rbac-matrix)
4. [Technology Stack & Packages](#4-technology-stack--packages)
5. [Project Directory Structure](#5-project-directory-structure)
6. [Core Functional Modules](#6-core-functional-modules)
7. [Complete RESTful API Reference](#7-complete-restful-api-reference)
8. [Database Schemas & Indexing Design](#8-database-schemas--indexing-design)
9. [Setup & Installation Guide](#9-setup--installation-guide)
10. [Environment Variables](#10-environment-variables)

---

## 1. System Architecture

The application adopts a decoupled, modern multi-tier client-server architecture with reactive state synchronization and stateless API authentication:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND CLIENT (Next.js)                           │
│   • Next.js App Router (React 19)        • Scoped CSS Modules               │
│   • Dynamic Client State & Debouncing    • html2canvas & jsPDF Export       │
│   • 4 Dedicated Portals: Admin | HOD | Staff | Student                      │
│   • Responsive Mobile & Desktop Layout with Collapsible Sidebars            │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP / JSON (Axios withCredentials)
                                       │ httpOnly Encrypted Cookies
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BACKEND API SERVER (Express)                        │
│   • Helmet HTTP Security Headers         • express-rate-limit Protection    │
│   • Dual-Token Auth (JWT + Cookie)       • Context-Aware RBAC Middleware    │
│   • Multer File Storage & Sanitization   • Nodemailer Transactional Mailer  │
│   • Timetable Conflict Validation Engine • CIA Marks Bounds Validator      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Mongoose ODM (MongoDB Driver)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATABASE LAYER (MongoDB Atlas)                      │
│   • Users & Hashed Refresh Sessions      • Departments, Halls, Subjects     │
│   • Master Timetable Conflict Matrix     • Students & Faculty Records       │
│   • Period-Wise Attendance (P1-P7)       • InternalMarks (T, L, T/L, O)     │
│   • Exam Hall Allocation & Candidates    • College & Dept Announcements     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. How Secure Is This ERP? (Deep-Dive Security Architecture)

The system incorporates **defense-in-depth cybersecurity controls** designed around the **OWASP Top 10 Security Standards**, ensuring zero data leakage, tamper-proof academic records, and strict access isolation.

### 🛡️ 1. Cryptographic Dual-Token Authentication
- **Access Token (JWT)**: Short-lived token (**40 minutes**) signed with `HMAC-SHA256` containing user identity, role, and department metadata.
- **Refresh Token (Opaque 256-bit)**: Long-lived token (**8 hours**) generated via Node.js `crypto.randomBytes(32)`.
- **Database Hash Storage**: Refresh tokens are **NEVER stored in plaintext**. MongoDB stores exclusively the **`SHA-256` cryptographic hash** of the refresh token. Even in the event of a full database leak, refresh tokens cannot be reversed or used.
- **Automated Silent Refresh**: When the access token expires, the client transparently exchanges the hashed refresh token for a new access token without user interruption.

### 🔒 2. Total Immunity to Cross-Site Scripting (XSS)
- Authentication tokens are stored strictly in **`httpOnly`, `sameSite: "lax"`, and `secure` HTTP cookies**.
- **No LocalStorage / SessionStorage Exposure**: Client-side JavaScript has zero access to authentication tokens, making token theft via XSS completely impossible.

### 🛡️ 3. NoSQL Injection Immunity & Input Sanitization
- All authentication and query endpoints validate scalar types (`typeof email === 'string'`) to prevent MongoDB object injection attacks (e.g., `{"email": {"$ne": null}}`).
- Parameterized Mongoose queries with strict schema casting prevent arbitrary query operator execution.

### 🛑 4. Brute-Force & Denial of Service (DoS) Protection
- **`express-rate-limit`** guards sensitive endpoints:
  - **Login Attempts**: Capped at **7 requests per 15 minutes** per IP address.
  - **Password Reset**: Capped at **3 requests per 15 minutes** per IP address.
- Invalid requests trigger automatic HTTP `429 Too Many Requests` responses with cooldown windows.

### 👤 5. Least-Privilege Role-Based Access Control (RBAC)
- **Role Isolation**: Express middleware (`verifyToken.js` and `markPermissions.js`) validates user role, account active status (`isActive: true`), and departmental scope on every single request.
- **Context-Aware Timetable Write Verification**:
  - Faculty members (and even Administrators) can **only enter, edit, or delete marks and attendance for classes assigned to them in the Timetable**.
  - Administrators and HODs possess institutional read-only viewing rights for audits, but cannot modify academic records of classes they do not teach.
- **Co-Teaching Concurrency**: When multiple teachers are assigned to a shared class (e.g., `manu` and `msi` assigned to `OHS352`), all verified assigned teachers have write access without false lockouts.

### 🔐 6. Password Security & Global Session Invalidation
- **Bcrypt Hashing**: Passwords hashed with **10 salt rounds** before database storage.
- **Global Session Revocation**: When a user resets their password, the server executes an atomic database update `RefreshSession.updateMany({ userId }, { revokedAt: new Date() })`, instantly terminating all active sessions across all devices.

### 🪖 7. HTTP Hardening with Helmet
- Automatically injects 15+ security headers:
  - `Content-Security-Policy (CSP)`
  - `Strict-Transport-Security (HSTS)`
  - `X-Frame-Options: SAMEORIGIN` (Clickjacking prevention)
  - `X-Content-Type-Options: nosniff` (MIME-sniffing prevention)
  - `Referrer-Policy: strict-origin-when-cross-origin`

### 📊 8. Mathematical Bounds & Data Integrity Constraints
- **CIA Marks Bounds Enforcement**: 
  - Assignment marks strictly bounded: $0 \le \text{mark} \le 100$.
  - Written exam marks strictly bounded: $0 \le \text{mark} \le 100$.
  - Theory total strictly capped: $\text{Assignment} + \text{Written Exam} \le 100$.
  - Practical lab marks strictly bounded: $0 \le \text{mark} \le 100$.
- **Compound Unique Database Indexes**:
  - `(academicYear, department, year, semester, subject, student, internalExam)`: Prevents duplicate mark records.
  - `(date, department, year, semester, period)`: Prevents duplicate attendance submissions for the same class and period.

---

## 3. Role-Based Access Control (RBAC) Matrix

| Module & Capability | Admin | HOD | Staff (Faculty) | Student |
| :--- | :---: | :---: | :---: | :---: |
| **System Dashboard & Global Metrics** | ✅ Institutional | ✅ Departmental | ✅ Assigned Classes | ✅ Personal Analytics |
| **Department Management** (Add / Edit) | ✅ | ✅ (Own Dept) | ❌ | ❌ |
| **Department Management** (Delete) | ✅ | ❌ | ❌ | ❌ |
| **Subject Master Catalog** (Add / Edit) | ✅ | ✅ | ❌ | ❌ |
| **Subject Master Catalog** (Delete) | ✅ | ❌ | ❌ | ❌ |
| **Lecture Halls & Capacity** (Add / Edit) | ✅ | ✅ | ❌ | ❌ |
| **Lecture Halls** (Delete) | ✅ | ❌ | ❌ | ❌ |
| **Master Timetable Scheduling** | ✅ | ✅ (Own Dept) | ❌ | ❌ |
| **Timetable Conflict Verification** | ✅ Automatic | ✅ Automatic | ❌ | ❌ |
| **Attendance Entry (Periods 1–7)** | ✅ (If Assigned) | ✅ (If Assigned) | ✅ (If Assigned) | ❌ |
| **Attendance Viewing & Reports** | ✅ All Depts | ✅ Own Dept | ✅ Assigned | ✅ Personal Only |
| **CIA Marks Entry & Editing** | ✅ (If Assigned) | ✅ (If Assigned) | ✅ (If Assigned) | ❌ |
| **CIA Marks Viewing & PDF Generation** | ✅ All Depts (Read-Only) | ✅ Own Dept | ✅ Assigned | ✅ Personal Only |
| **Exam Hall Seating Allocation** | ✅ | ✅ (Own Dept) | ❌ | ❌ |
| **Student Admissions & Profiles** | ✅ | ✅ (Dept View) | ❌ | ✅ (Own Profile) |
| **Faculty Master & Payroll Records** | ✅ | ✅ (Dept Faculty) | ✅ (Own Profile) | ❌ |
| **College-Wide Circulars** (Post/Delete) | ✅ | ❌ (Read-Only) | ❌ (Read-Only) | ❌ (Read-Only) |
| **Department Announcements** (Post/Delete)| ✅ | ✅ (Own Dept) | ❌ (Read-Only) | ❌ (Read-Only) |

---

## 4. Technology Stack & Packages

### **Frontend (`/client`)**
| Technology / Package | Version | Purpose |
| :--- | :--- | :--- |
| **Next.js** | `^16.2.4` | Full-stack React framework with App Router, SSR, and dynamic route handlers |
| **React & React-DOM** | `^19.2.4` | Core UI rendering engine |
| **Axios** | `^1.16.0` | HTTP client with automatic cookie forwarding (`withCredentials: true`) |
| **@react-oauth/google** | `^0.13.5` | Google Identity Services OAuth 2.0 integration |
| **jsPDF & html2canvas** | `^4.2.1` / `^1.4.1` | Client-side dynamic PDF generation (Marks sheets, Attendance sheets) |
| **Lucide React** | `^1.21.0` | Comprehensive, lightweight SVG iconography |
| **Scoped CSS Modules** | Built-in | Scoped styling architecture eliminating global CSS collisions |

### **Backend (`/server`)**
| Technology / Package | Version | Purpose |
| :--- | :--- | :--- |
| **Express.js** | `^5.2.1` | High-throughput web API application framework |
| **Mongoose** | `^9.9.2` | MongoDB object modeling, schema validation, and compound indexes |
| **JSONWebToken** | `^9.0.3` | Cryptographic JWT signing and verification for session tokens |
| **Bcrypt** | `^6.0.0` | Salted password hashing algorithm (10 rounds) |
| **Cookie-Parser** | `^1.4.7` | Parses encrypted, httpOnly authentication cookies |
| **Helmet** | `^8.3.0` | Injects 15+ security-focused HTTP response headers |
| **Cors** | `^2.8.6` | Cross-Origin Resource Sharing with strict whitelist and credentials |
| **Express-Rate-Limit** | `^8.6.2` | IP-based request throttling against brute-force attacks |
| **Google Auth Library** | `^10.6.2` | Backend verification of Google OAuth2 ID tokens |
| **Nodemailer** | `^8.0.7` | SMTP transactional emailer for password recovery |
| **Multer** | `^2.2.0` | Multipart form-data handling with MIME-type file upload filtering |
| **Dotenv** | `^17.4.2` | Multi-environment configuration manager |

---

## 5. Project Directory Structure

```
Project/
├── client/                               # Next.js Frontend Application
│   ├── src/
│   │   └── app/
│   │       ├── layout.js                 # Root layout with Google OAuth Provider
│   │       ├── page.js                   # Landing & Authentication portal
│   │       ├── forgot-password/          # Password recovery request page
│   │       ├── reset-password/           # Password update portal with token validation
│   │       ├── components/               # Shared UI Components
│   │       │   ├── admin_sidebar.js      # Universal navigation sidebar
│   │       │   ├── admin_top.js          # Topbar with college logo & profile
│   │       │   └── student_sidebar.js    # Student navigation sidebar
│   │       ├── admin/                    # Administrator Portal (All Modules)
│   │       │   ├── attendance/           # Institutional attendance management
│   │       │   ├── department/           # Department management
│   │       │   ├── hall/                 # Hall management
│   │       │   ├── marks/                # Marks oversight, entry, & PDF reports
│   │       │   ├── staff/                # Staff directory & add staff
│   │       │   ├── students/             # Student records & admission
│   │       │   ├── subjects/             # Subject catalog management
│   │       │   └── timetable/            # Master, Class, Staff & Hall timetables
│   │       ├── hod/                      # Head of Department Portal
│   │       │   ├── attendance/           # Department attendance matrix
│   │       │   ├── marks/                # Department marks & CIA reports
│   │       │   ├── staff/                # Department faculty oversight
│   │       │   └── students/             # Department student roster
│   │       ├── staff/                    # Faculty Portal
│   │       │   ├── attendance/           # Period-wise attendance entry (P1-P7)
│   │       │   ├── marks/                # CIA marks entry & updating
│   │       │   └── profile/              # Comprehensive faculty profile
│   │       └── student/                  # Student Self-Service Portal
│   │           ├── attendance/           # Student personal attendance log
│   │           ├── classes/              # Enrolled subjects & assigned faculty
│   │           ├── marks/                # Student CIA marks transcript
│   │           └── profile/              # Student bio, admission & academic info
│   └── package.json
│
├── server/                               # Express.js Backend Application
│   ├── index.js                          # Server bootstrap, middleware & route mount
│   ├── config/
│   │   ├── db.js                         # MongoDB connection manager
│   │   ├── cookie.js                     # httpOnly cookie security configurations
│   │   └── mailer.js                     # SMTP transporter configuration
│   ├── middleware/
│   │   ├── verifyToken.js                # JWT verification & session auto-refresh
│   │   └── rateLimiter.js                # Rate limiter rules for auth endpoints
│   ├── models/                           # Mongoose Data Schemas
│   │   ├── User.js                       # Credentials, roles, & avatar
│   │   ├── RefreshSession.js             # SHA-256 hashed refresh tokens
│   │   ├── PasswordReset.js              # Cryptographic single-use reset tokens
│   │   ├── Department.js                 # Department codes & names
│   │   ├── Subject.js                    # Subjects with Category (L, T, T/L, O)
│   │   ├── Hall.js                       # Lecture halls & capacities
│   │   ├── Timetable.js                  # Master schedule & period allocations
│   │   ├── Attendance.js                 # Period-wise attendance records (P1-P7)
│   │   ├── Student.js                    # Full student master (36+ fields)
│   │   ├── Staff.js                      # Full faculty master (36+ fields)
│   │   ├── InternalMark.js               # CIA marks (Theory, Lab, Total)
│   │   └── Announcement.js               # College & department circulars
│   ├── services/
│   │   ├── markService.js                # Marks aggregation & upsert logic
│   │   └── markPermissions.js            # Context-aware timetable permission validator
│   └── routes/                           # Express Route Controllers
│       ├── auth/login.js                 # Auth, OAuth, Logout, /me, Reset
│       ├── admin/                        # Admin sub-routes
│       ├── hod/                          # HOD sub-routes
│       ├── staff/                        # Faculty attendance & profile routes
│       ├── mark/marks.js                 # CIA internal marks controller
│       ├── student/student.js            # Student portal controller
│       └── announcements/                # Circulars & noticeboard controller
└── README.md
```

---

## 6. Core Functional Modules

### **1. Intelligent Timetable & Conflict Engine**
- **Conflict Matrix Prevention**: Prevents scheduling collisions before database writes:
  - **Faculty Conflict Check**: Rejects allocation if the faculty member is already teaching another class in the same day and period.
  - **Hall Conflict Check**: Rejects allocation if the lecture hall is already occupied by another class.
- **Multi-View Timetable Generation**: Master timetable, Class timetable, Staff timetable, and Lecture Hall timetable.

### **2. Period-Wise Attendance Tracking (Periods 1 to 7)**
- **Granular Period Entry**: Faculty select their assigned class, day, and period (P1–P7) to mark Present/Absent.
- **Day-Boundary Normalization**: Date querying uses exact start-of-day to end-of-day ranges (`$gte: startOfDay, $lte: endOfDay`) preventing duplicate records across local timezones.
- **Attendance Matrix Grid**: Visual absentee counter displaying real-time period-by-period numbers for Admin and HOD oversight.

### **3. Continuous Internal Assessment (CIA) & Marks Engine**
- **Four Category Assessment Types**:
  - **`"T"` (Theory)**: Assignment mark ($0-100$) + Written Exam mark ($0-100$), capped at Total $\le 100$.
  - **`"L"` (Practical/Lab)**: Laboratory experiment and viva marks ($0-100$).
  - **`"T/L"` (Integrated Theory & Lab)**: Combined dual-component assessment.
  - **`"O"` (Open Elective)**: Elective theory assessment.
- **Atomic Upserting**: Handles concurrent student marks saves via `findOneAndUpdate` with `{ upsert: true }`.
- **Dynamic PDF Mark Sheet Export**: High-resolution print-ready institutional mark sheet with student registration numbers and totals.

### **4. Exam Hall & Seating Allocation Engine**
- Calculates room capacity, generates candidate allocations, and creates seating charts preventing adjacent department collisions during exams.

### **5. Student & Faculty Master Directory**
- Comprehensive 36+ field profiles including academic credentials, personal bio, emergency contacts, blood group, admission quota, category, residential address, and banking/payroll records.

### **6. Dual-Stream Announcements & Circulars**
- **College-Wide Circulars**: Published by Administration for all institutional members.
- **Department-Scoped Announcements**: Managed by HODs with priority tagging (`Normal`, `Important`, `Urgent`) and sticky pin-to-top capabilities.

---

## 7. Complete RESTful API Reference

### **Authentication & Session (`/auth`)**
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | Public | Authenticate email/username & password; sets httpOnly cookies |
| `POST` | `/auth/verify_google` | Public | Authenticate via Google OAuth2 ID token |
| `POST` | `/auth/forgot-password`| Public | Generates 15-min crypto reset token and emails recovery link |
| `POST` | `/auth/reset-password` | Public | Validates reset token, updates password, and revokes all sessions |
| `POST` | `/auth/logout` | Public | Revokes refresh session and clears authentication cookies |
| `GET` | `/auth/me` | Cookie/Bearer | Returns current authenticated user profile & permissions |
| `GET` | `/auth/verify-me` | Cookie/Bearer | Returns role string for route guards |
| `GET` | `/auth/verify-dep` | Cookie/Bearer | Returns department code for faculty and HOD |

### **Continuous Internal Assessment (`/api/mark`)**
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/mark/subjects` | Staff/Admin | Fetches assigned subjects (or all in view mode for Admin) |
| `GET` | `/api/mark/students` | Staff/Admin | Loads active student roster with existing marks for entry |
| `GET` | `/api/mark` | Auth | Retrieves marks report grid with dynamic `canEdit` permissions |
| `POST` | `/api/mark` | Staff/Admin | Saves or upserts student internal marks with bounds checking |
| `PUT` | `/api/mark/:id` | Staff/Admin | Edits an individual student's mark entry |
| `GET` | `/api/mark/available-students`| Staff/Admin | Finds students without mark records for subject + exam |
| `POST` | `/api/mark/add-students` | Staff/Admin | Adds unadded students with default 0 marks |
| `DELETE`| `/api/mark` | Staff/Admin | Deletes marks for a complete internal assessment entry |

### **Attendance System (`/api/staff/attendance`)**
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/staff/attendance/classes` | Staff/Admin | Fetches assigned timetable classes for attendance entry |
| `GET` | `/api/staff/attendance/check` | Staff/Admin | Checks if period attendance is already recorded |
| `GET` | `/api/staff/attendance/students`| Staff/Admin | Retrieves student roster for marking attendance |
| `POST` | `/api/staff/attendance` | Staff/Admin | Submits period attendance (`students: [{ student_id, status }]`) |
| `GET` | `/api/staff/attendance/today-summary`| Auth | Aggregates daily attendance & absentees matrix |
| `GET` | `/api/staff/attendance/:id` | Auth | Retrieves full attendance record with student details |
| `PUT` | `/api/staff/attendance/:id` | Owner/Admin | Updates an existing attendance submission |
| `DELETE`| `/api/staff/attendance/:id` | Owner/Admin | Deletes an attendance record |

### **Academic Catalog & Infrastructure (`/api/admin/`)**
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET`/`POST` | `/api/admin/department/all`, `/api/admin/department` | Admin/HOD | Manage academic departments |
| `PUT`/`DELETE` | `/api/admin/department/:id`, `/:code` | Admin Only | Update or delete departments |
| `GET`/`POST` | `/api/admin/subject/all`, `/api/admin/subject` | Admin/HOD | Manage subject catalog (`L`, `T`, `T/L`, `O`) |
| `PUT`/`DELETE` | `/api/admin/subject/:id` | Admin Only | Update or delete subjects |
| `GET`/`POST` | `/api/admin/hall/all`, `/api/admin/hall` | Admin/HOD | Manage lecture halls and seating capacity |
| `PUT`/`DELETE` | `/api/admin/hall/:id` | Admin Only | Update or delete lecture halls |
| `GET`/`POST` | `/api/admin/timetable/all`, `/api/admin/timetable` | Admin/HOD | Query and allocate timetable slots with conflict checks |
| `DELETE` | `/api/admin/timetable/cell`, `/row`, `/class` | Admin/HOD | Remove timetable slots |

---

## 8. Database Schemas & Indexing Design

### **Primary Collections & Indexes:**

- **`users`**:
  - `email`: `{ type: String, unique: true, lowercase: true }`
  - `username`: `{ type: String, unique: true }`
  - `password`: `{ type: String }` (Bcrypt 10 rounds)
  - `role`: `{ type: String, enum: ["Admin", "Hod", "Staff", "Student"] }`

- **`refreshsessions`**:
  - `userId`: `{ type: ObjectId, ref: 'User' }`
  - `tokenHash`: `{ type: String, index: true }` (SHA-256)
  - `expiresAt`: `{ type: Date, index: { expires: 0 } }` (MongoDB TTL auto-cleanup)

- **`timetables`**:
  - `academicYear`, `department`, `year`, `semester`, `day` (1-7), `period` (1-7), `subject`, `staff`, `hall`
  - Compound Index: `{ staff: 1, day: 1, period: 1 }` (Faculty collision check)
  - Compound Index: `{ hall: 1, day: 1, period: 1 }` (Hall collision check)

- **`attendances`**:
  - `date`, `academicYear`, `department`, `year`, `semester`, `period`, `subject`, `staff`, `students: [{ student_id, status }]`
  - Unique Compound Index: `{ date: 1, department: 1, year: 1, semester: 1, period: 1 }`

- **`internalmarks`**:
  - `academicYear`, `department`, `year`, `semester`, `subject`, `student`, `internalExam` (1 or 2), `category` ("T", "L", "T/L", "O")
  - `theory`: `{ assignment, writtenExam, total, enteredBy }`
  - `practical`: `{ mark, enteredBy }`
  - Unique Compound Index: `{ academicYear: 1, department: 1, year: 1, semester: 1, subject: 1, student: 1, internalExam: 1 }`

---

## 9. Setup & Installation Guide

### **Prerequisites**
- **Node.js** `v18.x` or `v20.x`+
- **MongoDB** `v6.x`+ or MongoDB Atlas Cluster
- **npm** or **yarn**

### **1. Clone the Repository**
```bash
git clone <repository_url>
cd Project
```

### **2. Setup Backend Server**
```bash
cd server
npm install
npm run dev
```
*Backend server will start on `http://localhost:5000` (or configured port).*

### **3. Setup Frontend Client**
```bash
cd ../client
npm install
npm run dev
```
*Frontend will be live at `http://localhost:3000`.*

---

## 10. Environment Variables

### **Backend (`server/.env`)**
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/NIC_ERP?retryWrites=true&w=majority
JWT_SECRET=your_super_secure_jwt_secret_key_256_bit
FRONTEND_URL=http://localhost:3000

# Google OAuth2 Credentials
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# SMTP Email Configuration (Nodemailer)
EMAIL_USER=your_institution_email@gmail.com
EMAIL_PASS=your_app_specific_password
```

### **Frontend (`client/.env.local`)**
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

---

## 📄 License & Institutional Rights
This software platform is proprietary and custom-engineered for **NIC College of Engineering & Technology (NICETech)**. All rights reserved.
