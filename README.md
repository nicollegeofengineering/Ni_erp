# 🎓 NIC ERP — Enterprise College Management System

A full-stack, enterprise-grade College ERP (Enterprise Resource Planning) platform engineered for modern higher education institutions. Designed to manage academic workflows, student/staff lifecycles, timetable scheduling with conflict matrices, period-wise attendance, multi-category continuous internal assessments, and administrative governance with Role-Based Access Control (RBAC).

---

## 📑 Table of Contents
- [1. System Architecture](#1-system-architecture)
- [2. Technology Stack & Packages](#2-technology-stack--packages)
- [3. Project Directory Structure](#3-project-directory-structure)
- [4. Security & Authentication Architecture](#4-security--authentication-architecture)
- [5. Role-Based Access Control (RBAC) Matrix](#5-role-based-access-control-rbac-matrix)
- [6. Complete API Endpoints Reference](#6-complete-api-endpoints-reference)
- [7. Core Academic & Functional Modules](#7-core-academic--functional-modules)
- [8. Database Models & Schema Design](#8-database-models--schema-design)
- [9. Setup & Installation Guide](#9-setup--installation-guide)
- [10. Environment Variables](#10-environment-variables)

---

## 1. System Architecture

The application adopts a decoupled, modern multi-tier client-server architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND CLIENT (Next.js)                   │
│   • App Router (React 19)          • Scoped CSS Modules         │
│   • Client-side State & Debouncing • HTML5 Canvas / PDF Export  │
│   • Role-specific Portals: Admin | HOD | Staff | Student        │
└────────────────────────────────┬────────────────────────────────┘
                                 │ HTTP / JSON (Axios, Cookies)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND API SERVER (Express)                │
│   • Helmet Security Headers        • express-rate-limit         │
│   • Dual-Token Auth (JWT + Cookie) • Role Verification (RBAC)   │
│   • Multer File Storage            • Nodemailer SMTP Mailer     │
└────────────────────────────────┬────────────────────────────────┘
                                 │ Mongoose ODM (MongoDB Driver)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   DATABASE LAYER (MongoDB Atlas)                │
│   • Users & RefreshSessions        • Departments, Halls, Subjects│
│   • Timetable Schedule Conflict DB • Students & Staff Master     │
│   • Attendance (Period 1-7)        • InternalMarks (T, L, T/L, O│
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack & Packages

### **Frontend (`/client`)**
| Package | Version | Purpose |
| :--- | :--- | :--- |
| **`next`** | `^16.2.4` | Full-stack React framework with App Router, SSR, and optimized routing |
| **`react`** & **`react-dom`** | `^19.2.4` | UI component rendering engine |
| **`axios`** | `^1.16.0` | HTTP client with automatic cookie transmission (`withCredentials: true`) |
| **`@react-oauth/google`** | `^0.13.5` | Google Identity Services OAuth 2.0 integration |
| **`react-datepicker`** | `^9.1.0` | Interactive calendar date selector for timetable and attendance |
| **`jspdf`** & **`html2canvas`**| `^4.2.1` / `^1.4.1` | Client-side dynamic PDF report and mark sheet generation |
| **`lucide-react`** | `^1.21.0` | Modern, lightweight icon suite |
| **`Vanilla CSS (Modules)`** | Built-in | Scoped, zero-runtime-overhead styling without bloated utility frameworks |

### **Backend (`/server`)**
| Package | Version | Purpose |
| :--- | :--- | :--- |
| **`express`** | `^5.2.1` | High-performance HTTP web application framework |
| **`mongoose`** | `^9.9.2` | Elegant MongoDB object modeling, validations, and compound indexes |
| **`jsonwebtoken`** | `^9.0.3` | Cryptographic JWT signing and verification for session access tokens |
| **`bcrypt`** | `^6.0.0` | Secure password hashing with automated 10-round salt generation |
| **`cookie-parser`** | `^1.4.7` | Parses encrypted, `httpOnly` authentication cookies |
| **`helmet`** | `^8.3.0` | Injects 15+ security-focused HTTP response headers |
| **`cors`** | `^2.8.6` | Configurable Cross-Origin Resource Sharing with credentials support |
| **`express-rate-limit`** | `^8.6.2` | Throttles brute-force login and password-reset attempts |
| **`google-auth-library`**| `^10.6.2` | Cryptographic verification of Google OAuth2 ID tokens |
| **`nodemailer`** | `^8.0.7` | Transactional email delivery for password recovery links |
| **`multer`** | `^2.2.0` | Multi-part form data handling for student and staff photo uploads |
| **`dotenv`** | `^17.4.2` | Environment configuration loading |

---

## 3. Project Directory Structure

```
Project/
├── client/                           # Next.js Frontend Application
│   ├── src/
│   │   └── app/
│   │       ├── layout.js             # Root layout with Google OAuth provider
│   │       ├── page.js               # Main Landing / Login page
│   │       ├── forgot-password/      # Password reset request portal
│   │       ├── reset-password/       # New password submission page
│   │       ├── admin/                # Administrator Dashboard & Modules
│   │       │   ├── attendance/       # Add & View Attendance across all depts
│   │       │   ├── department/       # Add, Edit & Delete Departments
│   │       │   ├── hall/             # Lecture Hall management
│   │       │   ├── marks/            # Marks oversight & reporting
│   │       │   ├── staff/            # Staff master list & profile management
│   │       │   ├── students/         # Student admission & records
│   │       │   ├── subjects/         # Subject catalog (L, T, T/L, O)
│   │       │   └── timetable/        # Class, Staff & Hall timetable matrix
│   │       ├── hod/                  # Head of Department Portal
│   │       │   ├── department/       # Department View & Edit (No Delete)
│   │       │   ├── hall/             # Hall View & Edit (No Delete)
│   │       │   ├── subjects/         # Subject View & Edit (No Delete)
│   │       │   ├── staff/            # Department faculty oversight
│   │       │   └── timetable/        # Department timetable scheduler
│   │       ├── staff/                # Faculty Portal
│   │       │   ├── attendance/       # Period attendance entry & roster
│   │       │   ├── marks/            # Continuous internal assessment entry
│   │       │   └── subjects/         # Assigned subject list
│   │       └── student/              # Student Portal
│   │           ├── profile/          # Student academic & personal info
│   │           └── timetable/        # Weekly class schedule
│   └── package.json
│
├── server/                           # Express.js Backend Application
│   ├── index.js                      # Application entrypoint & middleware setup
│   ├── config/
│   │   ├── db.js                     # MongoDB connection manager
│   │   ├── cookie.js                 # httpOnly cookie security definitions
│   │   └── mailer.js                 # SMTP transporter configuration
│   ├── middleware/
│   │   ├── verifyToken.js            # JWT verification & session auto-refresh
│   │   └── rateLimiter.js            # Rate limiter rules for auth endpoints
│   ├── models/                       # Mongoose Data Schemas
│   │   ├── User.js                   # Login credentials & role flags
│   │   ├── RefreshSession.js         # Hashed active refresh tokens
│   │   ├── PasswordReset.js          # Single-use reset tokens
│   │   ├── Department.js             # Department codes & names
│   │   ├── Subject.js                # Subject codes, names, categories (L/T/T/L/O)
│   │   ├── Hall.js                   # Lecture halls & capacities
│   │   ├── Timetable.js              # Scheduled class-period slots
│   │   ├── Attendance.js             # Date-period attendance records
│   │   ├── Student.js                # Complete student record (36+ fields)
│   │   ├── Staff.js                  # Complete staff record (36+ fields)
│   │   ├── InternalMark.js           # Theory, Lab & Assignment assessments
│   │   └── Announcement.js           # Circulars & noticeboard posts
│   └── routes/                       # Express Modular Route Controllers
│       ├── auth/login.js             # Auth, OAuth, Logout, /me, Reset
│       ├── admin/                    # Admin controller endpoints
│       ├── hod/                      # HOD controller endpoints
│       ├── staff/                    # Attendance & Marks controllers
│       ├── student/                  # Student portal endpoints
│       └── user/profile.js           # Universal comprehensive user profile
└── README.md
```

---

## 4. Security & Authentication Architecture

```
User Login -> [bcrypt Verification] -> Generate Access Token (40m) & Refresh Token (8h)
                                      |
                                      +-> Store SHA-256 Hashed Refresh Token in DB
                                      +-> Set httpOnly, sameSite, secure Cookies
```

1. **Dual-Token System**:
   - **Access Token (JWT)**: Valid for 40 minutes, signed with `HS256`. Encodes `userId`, `email`, and `role`.
   - **Refresh Token**: 256-bit cryptographically secure random hex string. Stored in MongoDB exclusively as a **`SHA-256` hash**. Active for 8 hours.
2. **XSS Immunity**:
   - Authentication cookies (`ni_erp_token` and `ni_erp_refresh`) use `httpOnly: true`. Client-side JavaScript cannot read or extract tokens.
3. **NoSQL Injection Immunity**:
   - Authentication controllers enforce strict scalar type validation (`typeof email !== 'string'`) to reject object injection attacks.
4. **Brute-Force Protection**:
   - Login attempts throttled to **7 requests / 15 minutes**.
   - Forgot-password requests throttled to **3 requests / 15 minutes**.
5. **Session Revocation**:
   - Password reset automatically executes `RefreshSession.updateMany({ userId }, { revokedAt: new Date() })`, immediately terminating active sessions across all devices.

---

## 5. Role-Based Access Control (RBAC) Matrix

| Module / Operation | Admin | HOD | Staff | Student |
| :--- | :---: | :---: | :---: | :---: |
| **Departments** (Create / Edit) | ✅ | ✅ | ❌ | ❌ |
| **Departments** (Delete) | ✅ | ❌ | ❌ | ❌ |
| **Subjects & Categories** (Add / Edit) | ✅ | ✅ | ❌ | ❌ |
| **Subjects** (Delete) | ✅ | ❌ | ❌ | ❌ |
| **Lecture Halls** (Add / Edit) | ✅ | ✅ | ❌ | ❌ |
| **Lecture Halls** (Delete) | ✅ | ❌ | ❌ | ❌ |
| **Timetable Scheduling** | ✅ | ✅ (Own Dept) | ❌ | ❌ |
| **Mark Attendance** | ✅ | ✅ | ✅ (Assigned Subj) | ❌ |
| **Edit/Delete Attendance** | ✅ | ✅ (Own/Dept) | ✅ (Owner Only) | ❌ |
| **Internal Assessment Entry** | ✅ | ✅ (Dept) | ✅ (Assigned Subj) | ❌ |
| **Student Admission / Master Edit** | ✅ | ✅ (Dept View) | ❌ | ❌ |
| **My Profile View** | ✅ | ✅ | ✅ | ✅ |

---

## 6. Complete API Endpoints Reference

### **Authentication & Session (`/auth`)**
| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | Public | Authenticate with email & password; sets secure cookies |
| `POST` | `/auth/verify_google` | Public | Authenticate via Google OAuth2 ID Token |
| `POST` | `/auth/forgot-password` | Public | Generates 15-min crypto reset token and emails recovery link |
| `POST` | `/auth/reset-password` | Public | Validates reset token, updates password, and revokes all sessions |
| `POST` | `/auth/logout` | Public | Revokes refresh session and clears auth cookies |
| `GET` | `/auth/me` | Bearer/Cookie | Returns current authenticated user and profile photo |
| `GET` | `/auth/verify-me` | Bearer/Cookie | Returns role string for route guards |
| `GET` | `/auth/verify-dep` | Bearer/Cookie | Returns department code for faculty/HOD |

### **Department Management (`/api/admin/department`)**
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/department/all` | Auth | Returns list of all departments |
| `POST` | `/api/admin/department` | Admin, HOD | Creates a new department (`{ name, code }`) |
| `PUT` | `/api/admin/department/:id` | Admin, HOD | Updates department name or code |
| `DELETE`| `/api/admin/department/:code` | **Admin Only** | Deletes a department |

### **Subject Catalog (`/api/admin/subject`)**
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/subject/all` | Auth | Paginated & filterable list (`page`, `limit`, `category`, `search`) |
| `POST` | `/api/admin/subject` | Admin, HOD | Adds subject (`{ subjectName, subjectCode, Category: "L"\|"T"\|"T/L"\|"O" }`) |
| `PUT` | `/api/admin/subject/:id` | Admin, HOD | Updates subject details and category |
| `DELETE`| `/api/admin/subject/:id` | **Admin Only** | Deletes subject |

### **Lecture Halls (`/api/admin/hall`)**
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/hall/all` | Auth | Paginated list of halls |
| `POST` | `/api/admin/hall` | Admin, HOD | Creates hall (`{ hallName, hallCode, capacity }`) |
| `PUT` | `/api/admin/hall/:id` | Admin, HOD | Updates hall details |
| `DELETE`| `/api/admin/hall/:id` | **Admin Only** | Deletes hall |

### **Timetable & Scheduling (`/api/admin/timetable`)**
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/timetable/all` | Auth | Queries timetable entries by `academicYear`, `department`, `year` |
| `POST` | `/api/admin/timetable` | Admin, HOD | Allocates slot with dual-booking conflict verification (Faculty & Hall) |
| `DELETE`| `/api/admin/timetable/cell`| Admin, HOD | Removes a single schedule cell slot |
| `DELETE`| `/api/admin/timetable/row` | Admin, HOD | Clears timetable for an entire day |
| `DELETE`| `/api/admin/timetable/class`| Admin, HOD | Clears entire timetable for a class |

### **Attendance System (`/api/staff/attendance`)**
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/staff/attendance/check` | Auth | Checks if period attendance is already posted for a date |
| `GET` | `/api/staff/attendance/students`| Auth | Retrieves active student roster with previous attendance status |
| `POST` | `/api/staff/attendance` | Faculty | Submits period attendance (`students: [{ student_id, status }]`) |
| `GET` | `/api/staff/attendance/today-summary`| Auth | Aggregates campus-wide present/absent stats |
| `GET` | `/api/staff/attendance/:id` | Auth | Fetches full attendance record with student register numbers & names |
| `PUT` | `/api/staff/attendance/:id` | Owner/Admin | Updates student present/absent statuses |
| `DELETE`| `/api/staff/attendance/:id` | Owner/Admin | Deletes an attendance submission |

### **Internal Marks Assessment (`/api/mark`)**
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/mark/classes` | Auth | Fetches classes assigned to staff |
| `GET` | `/api/mark/students` | Auth | Retrieves student list for internal mark entry |
| `POST` | `/api/mark/save` | Faculty/Admin| Saves internal marks (Theory, Lab, Assignment, Seminar) |
| `GET` | `/api/mark/report` | Auth | Generates consolidated internal marks summary sheet |

---

## 7. Core Academic & Functional Modules

### **1. Timetable Conflict Engine**
When allocating a slot:
- Checks if the **Staff** is already teaching another class in the same day and period.
- Checks if the **Lecture Hall** is already occupied by another class.
- Rejects conflicting requests with exact conflict details.

### **2. Attendance Engine**
- **Period Flexibility**: Faculty can submit attendance for any period (Period 1 to Period 7) for their assigned subjects.
- **Day-Boundary Normalization**: Date querying uses UTC + Local day ranges (`startOfDay` to `endOfDay`) to prevent duplicate entry errors across timezones.
- **Enriched Student Roster**: Renders Register Number, Roll Number, Student Name, and Present/Absent toggles.

### **3. Continuous Internal Assessment (CIA)**
Supports flexible subject categories:
- **`T` (Theory)**: Assignment (10), Test 1 (50), Test 2 (50), Attendance score.
- **`L` (Laboratory)**: Lab Experiment marks, Model exam, Viva-voce.
- **`T/L` (Integrated Theory & Practical)**: Combined theory and practical split.
- **`O` (Others / Electives)**: Custom assessment matrix.

---

## 8. Database Models & Schema Design

### Key Collections in MongoDB:
- **`users`**: `{ email, username, password (bcrypt), role, isActive, profile_image }`
- **`refreshsessions`**: `{ userId, tokenHash (SHA-256), expiresAt, revokedAt }`
- **`departments`**: `{ name, code (unique, uppercase) }`
- **`subjects`**: `{ subjectName, subjectCode (unique), Category: ["L", "T", "T/L", "O"] }`
- **`halls`**: `{ hallName, hallCode (unique), capacity }`
- **`timetables`**: `{ academicYear, department, year, semester, day (1-7), period (1-7), subject, staff, hall }`
- **`attendances`**: `{ date, day, academicYear, department, year, semester, period, subject, staff, students: [{ student_id, status }] }` (Unique compound index on `{ date, department, year, semester, period }`).
- **`students`**: Complete student master (Register No, Roll No, Bio, Contact, Academic background, Quota, Address).
- **`staffs`**: Complete staff master (Staff ID, Designation, Qualification, Contact, Address, Banking & Payroll).

---

## 9. Setup & Installation Guide

### **Prerequisites**
- **Node.js** `v18.x` or higher
- **MongoDB** `v6.x` or MongoDB Atlas URI
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
*The server will start on port `4000` (or `PORT` specified in `.env`).*

### **3. Setup Frontend Client**
```bash
cd ../client
npm install
npm run dev
```
*The web app will be accessible at `http://localhost:3000`.*

---

## 10. Environment Variables

### **Server Environment (`server/.env`)**
```env
PORT=4000
NODE_ENV=development
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/NIC_ERP?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key_256_bit
FRONTEND_URL=http://localhost:3000

# Google OAuth2 Credentials
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# SMTP Email Configuration (Nodemailer)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_specific_password
```

### **Client Environment (`client/.env.local`)**
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
```

---

## 📄 License
This project is proprietary and intended for institutional administration at **NIC College of Engineering & Technology**.
