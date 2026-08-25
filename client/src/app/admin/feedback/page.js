"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  BarChart3,
  Users,
  Award,
  BookOpen,
  Trash2,
  Download,
  Printer,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  Eye,
  Layers,
  MessageSquare,
  AlertTriangle,
} from "lucide-react";
import {
  QUESTION_DISPLAY,
  QUESTION_KEYS,
  RATING_LABELS,
} from "../../constants/feedbackQuestions";
import styles from "./adminFeedback.module.css";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const api = axios.create({ baseURL: BASE_URL, withCredentials: true });

const DEFAULT_DEPARTMENTS = ["ALL", "CSE", "AI&DS", "ECE", "IT", "MECH", "EEE", "CIVIL", "MBA", "MCA"];
const YEARS = ["ALL", "1", "2", "3", "4"];
const SEMESTERS = ["ALL", "1", "2", "3", "4", "5", "6", "7", "8"];

export default function AdminFeedbackPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState("REPORTS"); // "REPORTS" | "STUDENTS"
  const [reportSubView, setReportSubView] = useState("STAFF"); // "STAFF" | "SUBJECT" | "DEPT" | "CRITERIA" | "GRADES"

  // Dynamic Departments
  const [departments, setDepartments] = useState(DEFAULT_DEPARTMENTS);

  // Filter States
  const [selectedDept, setSelectedDept] = useState("ALL");
  const [selectedYear, setSelectedYear] = useState("ALL");
  const [selectedSem, setSelectedSem] = useState("ALL");
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState("ALL");
  const [studentSearch, setStudentSearch] = useState("");

  // Data States
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [studentTrackingData, setStudentTrackingData] = useState({
    stats: { totalStudents: 0, submittedCount: 0, pendingCount: 0, submissionRate: 0 },
    students: [],
  });

  // Modal States
  const [selectedStaffDetail, setSelectedStaffDetail] = useState(null);
  const [selectedSubjectDetail, setSelectedSubjectDetail] = useState(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearConfirmationText, setClearConfirmationText] = useState("");
  const [clearing, setClearing] = useState(false);

  // Fetch departments from department route
  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const res = await api.get("/api/admin/department/all");
      if (res.data?.success && Array.isArray(res.data?.data)) {
        const deptCodes = res.data.data.map((d) => d.code?.toUpperCase()).filter(Boolean);
        const unique = ["ALL", ...new Set(deptCodes)];
        setDepartments(unique);
      }
    } catch (err) {
      console.warn("Failed to load departments from API, using fallback list:", err.message);
    }
  };

  // Load Dashboard Data
  useEffect(() => {
    fetchDashboardReport();
  }, [selectedDept, selectedYear, selectedSem]);

  // Load Student Tracking Data when on STUDENTS tab or filter change
  useEffect(() => {
    if (activeTab === "STUDENTS") {
      fetchStudentTracking();
    }
  }, [activeTab, selectedDept, selectedYear, selectedSem, submissionStatusFilter, studentSearch]);

  const fetchDashboardReport = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedDept !== "ALL") params.append("department", selectedDept);
      if (selectedYear !== "ALL") params.append("year", selectedYear);
      if (selectedSem !== "ALL") params.append("semester", selectedSem);

      const res = await api.get(`/api/feedback/admin/dashboard?${params.toString()}`);
      setDashboardData(res.data?.data || null);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      if (err.response?.status === 401 || err.response?.data?.islogout) {
        router.push("/");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentTracking = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedDept !== "ALL") params.append("department", selectedDept);
      if (selectedYear !== "ALL") params.append("year", selectedYear);
      if (selectedSem !== "ALL") params.append("semester", selectedSem);
      if (submissionStatusFilter !== "ALL") params.append("status", submissionStatusFilter);
      if (studentSearch.trim()) params.append("search", studentSearch.trim());

      const res = await api.get(`/api/feedback/admin/students?${params.toString()}`);
      setStudentTrackingData(res.data);
    } catch (err) {
      console.error("Student tracking fetch error:", err);
    }
  };

  // Handle Clear Feedback Responses
  const handleClearFeedback = async () => {
    if (clearConfirmationText !== "CLEAR ALL RESPONSES") {
      alert('Confirmation text must match "CLEAR ALL RESPONSES" exactly.');
      return;
    }

    try {
      setClearing(true);
      const res = await api.delete("/api/feedback/admin/clear", {
        data: {
          confirmation: "CLEAR ALL RESPONSES",
          department: selectedDept !== "ALL" ? selectedDept : undefined,
          year: selectedYear !== "ALL" ? selectedYear : undefined,
          semester: selectedSem !== "ALL" ? selectedSem : undefined,
        },
      });

      alert(res.data?.message || "Feedback responses successfully cleared.");
      setShowClearModal(false);
      setClearConfirmationText("");
      fetchDashboardReport();
      if (activeTab === "STUDENTS") fetchStudentTracking();
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Error clearing feedback");
    } finally {
      setClearing(false);
    }
  };

  // Export Student Submission Status as CSV
  const handleExportCsv = () => {
    const students = studentTrackingData.students || [];
    if (students.length === 0) {
      alert("No student records to export.");
      return;
    }

    const headers = ["Register No", "Roll No", "Student Name", "Department", "Year", "Semester", "Section", "Submission Status", "Submission Date"];
    const rows = students.map((s) => [
      s.register_no || "",
      s.roll_no || "",
      `"${s.name || ""}"`,
      s.department || "",
      s.year || "",
      s.semester || "",
      s.section || "",
      s.hasSubmitted ? "SUBMITTED" : "PENDING",
      s.submittedAt ? new Date(s.submittedAt).toLocaleString("en-GB") : "N/A",
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `student_feedback_submission_status_${selectedDept}_Y${selectedYear}_S${selectedSem}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getGradeClass = (grade) => {
    switch (grade) {
      case "Excellent":
        return styles.gradeExcellent;
      case "Very Good":
        return styles.gradeVeryGood;
      case "Good":
        return styles.gradeGood;
      case "Average":
        return styles.gradeAverage;
      default:
        return styles.gradeNeedsImprovement;
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.pageTitle}>
            <Award size={28} color="#2563eb" /> Faculty Feedback Management & Analytics
          </h1>
          <p className={styles.pageSubtitle}>
            Comprehensive evaluation reports, staff-wise & subject-wise analytics, and student submission tracking.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            className={styles.btnDanger}
            onClick={() => {
              setClearConfirmationText("");
              setShowClearModal(true);
            }}
          >
            <Trash2 size={16} /> Reset / Clear Responses
          </button>
        </div>
      </div>

      {/* Main Tabs */}
      <div className={styles.tabsContainer}>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === "REPORTS" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("REPORTS")}
        >
          <BarChart3 size={18} /> Analytics & Reports
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === "STUDENTS" ? styles.tabBtnActive : ""}`}
          onClick={() => {
            setActiveTab("STUDENTS");
            fetchStudentTracking();
          }}
        >
          <Users size={18} /> Student Submission Status
        </button>
      </div>

      {/* Global Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Department:</span>
          <select
            className={styles.selectInput}
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
          >
            {departments.map((d) => (
              <option key={d} value={d}>
                {d === "ALL" ? "All Departments" : d}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Year:</span>
          <select
            className={styles.selectInput}
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y === "ALL" ? "All Years" : `Year ${y}`}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Semester:</span>
          <select
            className={styles.selectInput}
            value={selectedSem}
            onChange={(e) => setSelectedSem(e.target.value)}
          >
            {SEMESTERS.map((s) => (
              <option key={s} value={s}>
                {s === "ALL" ? "All Semesters" : `Semester ${s}`}
              </option>
            ))}
          </select>
        </div>

        {activeTab === "STUDENTS" && (
          <>
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Status:</span>
              <select
                className={styles.selectInput}
                value={submissionStatusFilter}
                onChange={(e) => setSubmissionStatusFilter(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="SUBMITTED">Submitted Only</option>
                <option value="PENDING">Pending Only</option>
              </select>
            </div>

            <div className={styles.filterGroup} style={{ marginLeft: "auto" }}>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search Reg No / Name..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
            </div>
          </>
        )}
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIconBox} style={{ background: "#eff6ff", color: "#2563eb" }}>
            <Users size={24} />
          </div>
          <div>
            <div className={styles.kpiValue}>
              {dashboardData?.totalResponses || 0}
            </div>
            <div className={styles.kpiLabel}>Total Submissions</div>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIconBox} style={{ background: "#f0fdf4", color: "#16a34a" }}>
            <Award size={24} />
          </div>
          <div>
            <div className={styles.kpiValue}>
              {dashboardData?.overallAverageRating || "0.00"} <span style={{ fontSize: "14px", color: "#64748b" }}>/ 5.0</span>
            </div>
            <div className={styles.kpiLabel}>
              Overall Average ({dashboardData?.overallAverageRating ? ((dashboardData.overallAverageRating / 5) * 100).toFixed(1) : 0}%)
            </div>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIconBox} style={{ background: "#fef3c7", color: "#b45309" }}>
            <Sparkles size={24} />
          </div>
          <div>
            <div className={styles.kpiValue} style={{ fontSize: "17px" }}>
              {dashboardData?.highestFaculty?.facultyName || "N/A"}
            </div>
            <div className={styles.kpiLabel}>
              Top Faculty {dashboardData?.highestFaculty?.overallAvg ? `(${dashboardData.highestFaculty.overallAvg}/5)` : ""}
            </div>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIconBox} style={{ background: "#f5f3ff", color: "#7c3aed" }}>
            <BookOpen size={24} />
          </div>
          <div>
            <div className={styles.kpiValue} style={{ fontSize: "17px" }}>
              {dashboardData?.highestSubject?.subjectCode || "N/A"}
            </div>
            <div className={styles.kpiLabel}>
              Top Course {dashboardData?.highestSubject?.overallAvg ? `(${dashboardData.highestSubject.overallAvg}/5)` : ""}
            </div>
          </div>
        </div>
      </div>

      {/* TAB 1: REPORTS & ANALYTICS */}
      {activeTab === "REPORTS" && (
        <>
          {/* Sub-view switcher */}
          <div className={styles.subTabsRow}>
            <button
              type="button"
              className={`${styles.subTabBtn} ${reportSubView === "STAFF" ? styles.subTabBtnActive : ""}`}
              onClick={() => setReportSubView("STAFF")}
            >
              👨‍🏫 Staff-Wise Report
            </button>
            <button
              type="button"
              className={`${styles.subTabBtn} ${reportSubView === "SUBJECT" ? styles.subTabBtnActive : ""}`}
              onClick={() => setReportSubView("SUBJECT")}
            >
              📚 Subject-Wise Report
            </button>
            <button
              type="button"
              className={`${styles.subTabBtn} ${reportSubView === "DEPT" ? styles.subTabBtnActive : ""}`}
              onClick={() => setReportSubView("DEPT")}
            >
              🏢 Department & Year Summary
            </button>
            <button
              type="button"
              className={`${styles.subTabBtn} ${reportSubView === "CRITERIA" ? styles.subTabBtnActive : ""}`}
              onClick={() => setReportSubView("CRITERIA")}
            >
              📊 14 Criteria Performance
            </button>
            <button
              type="button"
              className={`${styles.subTabBtn} ${reportSubView === "GRADES" ? styles.subTabBtnActive : ""}`}
              onClick={() => setReportSubView("GRADES")}
            >
              🎯 Grade Distribution
            </button>
          </div>

          {/* VIEW: STAFF-WISE REPORT */}
          {reportSubView === "STAFF" && (
            <div className={styles.dataCard}>
              <div className={styles.dataCardTitle}>
                <span>Staff-Wise Feedback Analysis</span>
                <span style={{ fontSize: "13px", fontWeight: 500, color: "#64748b" }}>
                  {dashboardData?.staffWise?.length || 0} Faculty Members Evaluated
                </span>
              </div>

              {dashboardData?.staffWise?.length === 0 ? (
                <p style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                  No feedback responses found for the selected department / semester filters.
                </p>
              ) : (
                <table className={styles.customTable}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Faculty Name</th>
                      <th>Dept</th>
                      <th>Assigned Subjects</th>
                      <th>Responses</th>
                      <th>Overall Score</th>
                      <th>Percentage</th>
                      <th>Grade Tier</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData?.staffWise?.map((st, idx) => (
                      <tr key={st.facultyName}>
                        <td style={{ fontWeight: 700, color: "#64748b" }}>{idx + 1}</td>
                        <td style={{ fontWeight: 700, color: "#0f172a" }}>{st.facultyName}</td>
                        <td>
                          <span style={{ fontWeight: 600, color: "#2563eb" }}>{st.department || "-"}</span>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", maxWidth: "320px" }}>
                            {st.subjectCodes?.map((code, cIdx) => (
                              <span
                                key={cIdx}
                                style={{
                                  background: "#f1f5f9",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  fontSize: "11.5px",
                                  fontWeight: 600,
                                }}
                              >
                                {code}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ fontWeight: 600 }}>{st.responses}</td>
                        <td style={{ fontWeight: 800, color: "#0f172a", fontSize: "14px" }}>
                          {st.overallAvg.toFixed(2)} / 5.0
                        </td>
                        <td style={{ fontWeight: 600, color: "#059669" }}>{st.percentage}%</td>
                        <td>
                          <span className={`${styles.gradeBadge} ${getGradeClass(st.grade)}`}>
                            {st.grade}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={styles.btnSecondary}
                            style={{ padding: "5px 10px", fontSize: "12px" }}
                            onClick={() => setSelectedStaffDetail(st)}
                          >
                            <Eye size={14} /> View Breakdown
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* VIEW: SUBJECT-WISE REPORT */}
          {reportSubView === "SUBJECT" && (
            <div className={styles.dataCard}>
              <div className={styles.dataCardTitle}>
                <span>Subject-Wise Feedback Analysis</span>
                <span style={{ fontSize: "13px", fontWeight: 500, color: "#64748b" }}>
                  {dashboardData?.subjectWise?.length || 0} Courses Evaluated
                </span>
              </div>

              {dashboardData?.subjectWise?.length === 0 ? (
                <p style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                  No feedback responses found for the selected filters.
                </p>
              ) : (
                <table className={styles.customTable}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Subject Code</th>
                      <th>Subject Name</th>
                      <th>Dept</th>
                      <th>Year</th>
                      <th>Sem</th>
                      <th>Category</th>
                      <th>Faculty</th>
                      <th>Responses</th>
                      <th>Avg Rating</th>
                      <th>Grade Tier</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData?.subjectWise?.map((sub, idx) => (
                      <tr key={`${sub.subjectCode}-${sub.facultyName}`}>
                        <td style={{ fontWeight: 700, color: "#64748b" }}>{idx + 1}</td>
                        <td style={{ fontWeight: 800, color: "#2563eb" }}>{sub.subjectCode}</td>
                        <td style={{ fontWeight: 600 }}>{sub.subjectName}</td>
                        <td>
                          <span style={{ fontWeight: 700, color: "#1e40af" }}>{sub.department || "-"}</span>
                        </td>
                        <td>{sub.year ? `Year ${sub.year}` : "-"}</td>
                        <td>Sem {sub.semester}</td>
                        <td>
                          <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 6px", background: "#eff6ff", borderRadius: "4px", color: "#1d4ed8" }}>
                            {sub.category || "T"}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: "#334155" }}>{sub.facultyName}</td>
                        <td style={{ fontWeight: 600 }}>{sub.responses}</td>
                        <td style={{ fontWeight: 800, color: "#0f172a" }}>
                          {sub.overallAvg.toFixed(2)} / 5.0
                        </td>
                        <td>
                          <span className={`${styles.gradeBadge} ${getGradeClass(sub.grade)}`}>
                            {sub.grade}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={styles.btnSecondary}
                            style={{ padding: "5px 10px", fontSize: "12px" }}
                            onClick={() => setSelectedSubjectDetail(sub)}
                          >
                            <Eye size={14} /> View Breakdown
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* VIEW: DEPARTMENT & YEAR BREAKDOWN */}
          {reportSubView === "DEPT" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div className={styles.dataCard}>
                <div className={styles.dataCardTitle}>Department-Wise Rating Breakdown</div>
                <table className={styles.customTable}>
                  <thead>
                    <tr>
                      <th>Department</th>
                      <th>Responses</th>
                      <th>Avg Score</th>
                      <th>Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData?.departmentWise?.map((d) => (
                      <tr key={d.department}>
                        <td style={{ fontWeight: 700, color: "#1e40af" }}>{d.department}</td>
                        <td>{d.responses}</td>
                        <td style={{ fontWeight: 800 }}>{d.overallAvg.toFixed(2)} / 5.0 ({d.percentage}%)</td>
                        <td>
                          <span className={`${styles.gradeBadge} ${getGradeClass(d.grade)}`}>
                            {d.grade}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={styles.dataCard}>
                <div className={styles.dataCardTitle}>Year-Wise Rating Breakdown</div>
                <table className={styles.customTable}>
                  <thead>
                    <tr>
                      <th>Year</th>
                      <th>Responses</th>
                      <th>Avg Score</th>
                      <th>Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData?.yearWise?.map((y) => (
                      <tr key={y.year}>
                        <td style={{ fontWeight: 700 }}>Year {y.year}</td>
                        <td>{y.responses}</td>
                        <td style={{ fontWeight: 800 }}>{y.overallAvg.toFixed(2)} / 5.0 ({y.percentage}%)</td>
                        <td>
                          <span className={`${styles.gradeBadge} ${getGradeClass(y.grade)}`}>
                            {y.grade}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW: 14 CRITERIA BREAKDOWN */}
          {reportSubView === "CRITERIA" && (
            <div className={styles.dataCard}>
              <div className={styles.dataCardTitle}>14 Evaluation Criteria Global Performance</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "16px" }}>
                {QUESTION_KEYS.map((key, idx) => {
                  const score = dashboardData?.questionWise?.[key] || 0;
                  const percent = Math.min(100, (score / 5) * 100);

                  return (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <div style={{ width: "380px", fontSize: "13px", fontWeight: 600, color: "#334155" }}>
                        <span style={{ color: "#64748b", marginRight: "6px" }}>{idx + 1}.</span>
                        {QUESTION_DISPLAY[key]}
                      </div>
                      <div style={{ flex: 1, height: "10px", background: "#f1f5f9", borderRadius: "999px", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${percent}%`,
                            background: percent >= 80 ? "#10b981" : percent >= 60 ? "#3b82f6" : "#f59e0b",
                            borderRadius: "999px",
                          }}
                        />
                      </div>
                      <div style={{ width: "80px", textAlign: "right", fontWeight: 800, fontSize: "14px", color: "#0f172a" }}>
                        {score.toFixed(2)} / 5.0
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW: GRADE DISTRIBUTION */}
          {reportSubView === "GRADES" && (
            <div className={styles.dataCard}>
              <div className={styles.dataCardTitle}>Overall Grade Tier Distribution</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginTop: "18px" }}>
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "18px", borderRadius: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: "28px", fontWeight: 800, color: "#15803d" }}>
                    {dashboardData?.gradeDistribution?.excellent || 0}
                  </div>
                  <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#166534", marginTop: "4px" }}>Excellent (4.5 - 5.0)</div>
                </div>

                <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", padding: "18px", borderRadius: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: "28px", fontWeight: 800, color: "#1d4ed8" }}>
                    {dashboardData?.gradeDistribution?.veryGood || 0}
                  </div>
                  <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#1e40af", marginTop: "4px" }}>Very Good (4.0 - 4.49)</div>
                </div>

                <div style={{ background: "#fefce8", border: "1px solid #fef08a", padding: "18px", borderRadius: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: "28px", fontWeight: 800, color: "#854d0e" }}>
                    {dashboardData?.gradeDistribution?.good || 0}
                  </div>
                  <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#713f12", marginTop: "4px" }}>Good (3.5 - 3.99)</div>
                </div>

                <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", padding: "18px", borderRadius: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: "28px", fontWeight: 800, color: "#c2410c" }}>
                    {dashboardData?.gradeDistribution?.average || 0}
                  </div>
                  <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#9a3412", marginTop: "4px" }}>Average (3.0 - 3.49)</div>
                </div>

                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: "18px", borderRadius: "12px", textAlign: "center" }}>
                  <div style={{ fontSize: "28px", fontWeight: 800, color: "#b91c1c" }}>
                    {dashboardData?.gradeDistribution?.needsImprovement || 0}
                  </div>
                  <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#991b1b", marginTop: "4px" }}>Needs Improvement (&lt; 3.0)</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 2: STUDENT SUBMISSION TRACKING */}
      {activeTab === "STUDENTS" && (
        <div className={styles.dataCard}>
          <div className={styles.dataCardTitle}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span>Student Feedback Turnout & Submission Status</span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#16a34a", background: "#dcfce7", padding: "3px 10px", borderRadius: "12px" }}>
                ✓ {studentTrackingData?.stats?.submittedCount || 0} Submitted ({studentTrackingData?.stats?.submissionRate || 0}%)
              </span>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#b45309", background: "#fef3c7", padding: "3px 10px", borderRadius: "12px" }}>
                ⏳ {studentTrackingData?.stats?.pendingCount || 0} Pending
              </span>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button type="button" className={styles.btnSecondary} onClick={handleExportCsv}>
                <Download size={15} /> Export CSV
              </button>
              <button type="button" className={styles.btnSecondary} onClick={() => window.print()}>
                <Printer size={15} /> Print
              </button>
            </div>
          </div>

          <div style={{ fontSize: "12.5px", color: "#64748b", marginBottom: "16px" }}>
            🔒 <strong>Anonymity Guarantee:</strong> This table displays individual student submission status for tracking purposes. The specific ratings and responses given by each student remain strictly anonymous and cannot be viewed.
          </div>

          {studentTrackingData?.students?.length === 0 ? (
            <p style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
              No students found for the current search and filter criteria.
            </p>
          ) : (
            <table className={styles.customTable}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Register No</th>
                  <th>Student Name</th>
                  <th>Dept</th>
                  <th>Year</th>
                  <th>Sem</th>
                  <th>Sec</th>
                  <th>Status</th>
                  <th>Submitted Date</th>
                </tr>
              </thead>
              <tbody>
                {studentTrackingData?.students?.map((s, idx) => (
                  <tr key={s._id || s.student_id || idx}>
                    <td style={{ fontWeight: 700, color: "#64748b" }}>{idx + 1}</td>
                    <td style={{ fontWeight: 800, color: "#0f172a" }}>{s.register_no || s.student_id}</td>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td>{s.department}</td>
                    <td>Year {s.year}</td>
                    <td>Sem {s.semester}</td>
                    <td>{s.section || "-"}</td>
                    <td>
                      {s.hasSubmitted ? (
                        <span className={styles.statusSubmitted}>
                          <CheckCircle2 size={13} /> Submitted
                        </span>
                      ) : (
                        <span className={styles.statusPending}>
                          <Clock size={13} /> Pending
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: "12.5px", color: s.submittedAt ? "#334155" : "#94a3b8" }}>
                      {s.submittedAt ? new Date(s.submittedAt).toLocaleString("en-GB") : "Not yet submitted"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* STAFF DETAIL MODAL */}
      {selectedStaffDetail && (
        <div className={styles.modalBackdrop} onClick={() => setSelectedStaffDetail(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>{selectedStaffDetail.facultyName}</h3>
                <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
                  Dept: <strong>{selectedStaffDetail.department}</strong> | Total Responses: <strong>{selectedStaffDetail.responses}</strong> | Overall: <strong>{selectedStaffDetail.overallAvg.toFixed(2)}/5.0</strong> ({selectedStaffDetail.percentage}%)
                </div>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setSelectedStaffDetail(null)}
              >
                ×
              </button>
            </div>

            {/* 14 Criteria Scores */}
            <h4 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 14px 0", color: "#0f172a" }}>
              14 Evaluation Criteria Breakdown
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
              {QUESTION_KEYS.map((k, idx) => {
                const score = selectedStaffDetail.criteriaScores?.[k] || 0;
                const pct = Math.min(100, (score / 5) * 100);

                return (
                  <div key={k} className={styles.criteriaBarRow}>
                    <div className={styles.criteriaBarLabel}>
                      {idx + 1}. {QUESTION_DISPLAY[k]}
                    </div>
                    <div className={styles.criteriaBarTrack}>
                      <div className={styles.criteriaBarFill} style={{ width: `${pct}%` }} />
                    </div>
                    <div className={styles.criteriaBarScore}>{score.toFixed(2)}</div>
                  </div>
                );
              })}
            </div>

            {/* Anonymized Student Suggestions */}
            <h4 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 8px 0", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
              <MessageSquare size={16} /> Anonymous Student Suggestions & Comments ({selectedStaffDetail.comments?.length || 0})
            </h4>

            {selectedStaffDetail.comments?.length === 0 ? (
              <p style={{ fontSize: "13px", color: "#64748b", fontStyle: "italic" }}>
                No written comments submitted for this faculty.
              </p>
            ) : (
              <div className={styles.commentsList}>
                {selectedStaffDetail.comments?.map((c, cIdx) => (
                  <div key={cIdx} className={styles.commentBubble}>
                    &ldquo;{c}&rdquo;
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBJECT DETAIL MODAL */}
      {selectedSubjectDetail && (
        <div className={styles.modalBackdrop} onClick={() => setSelectedSubjectDetail(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>
                  {selectedSubjectDetail.subjectCode} - {selectedSubjectDetail.subjectName}
                </h3>
                <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>
                  Faculty: <strong>{selectedSubjectDetail.facultyName}</strong> | Dept: <strong>{selectedSubjectDetail.department}</strong> {selectedSubjectDetail.year ? `| Year ${selectedSubjectDetail.year}` : ""} | Sem {selectedSubjectDetail.semester} | Total Responses: <strong>{selectedSubjectDetail.responses}</strong> | Overall: <strong>{selectedSubjectDetail.overallAvg.toFixed(2)}/5.0</strong> ({selectedSubjectDetail.percentage}%)
                </div>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setSelectedSubjectDetail(null)}
              >
                ×
              </button>
            </div>

            {/* 14 Criteria Scores */}
            <h4 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 14px 0", color: "#0f172a" }}>
              14 Evaluation Criteria Breakdown
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
              {QUESTION_KEYS.map((k, idx) => {
                const score = selectedSubjectDetail.criteriaScores?.[k] || 0;
                const pct = Math.min(100, (score / 5) * 100);

                return (
                  <div key={k} className={styles.criteriaBarRow}>
                    <div className={styles.criteriaBarLabel}>
                      {idx + 1}. {QUESTION_DISPLAY[k]}
                    </div>
                    <div className={styles.criteriaBarTrack}>
                      <div className={styles.criteriaBarFill} style={{ width: `${pct}%` }} />
                    </div>
                    <div className={styles.criteriaBarScore}>{score.toFixed(2)}</div>
                  </div>
                );
              })}
            </div>

            {/* Anonymized Student Suggestions for this subject */}
            <h4 style={{ fontSize: "15px", fontWeight: 700, margin: "0 0 8px 0", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
              <MessageSquare size={16} /> Anonymous Student Suggestions for this Course ({selectedSubjectDetail.comments?.length || 0})
            </h4>

            {selectedSubjectDetail.comments?.length === 0 ? (
              <p style={{ fontSize: "13px", color: "#64748b", fontStyle: "italic" }}>
                No written comments submitted for this course.
              </p>
            ) : (
              <div className={styles.commentsList}>
                {selectedSubjectDetail.comments?.map((c, cIdx) => (
                  <div key={cIdx} className={styles.commentBubble}>
                    &ldquo;{c}&rdquo;
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CLEAR ALL RESPONSES MODAL */}
      {showClearModal && (
        <div className={styles.modalBackdrop} onClick={() => !clearing && setShowClearModal(false)}>
          <div className={styles.modalContent} style={{ maxWidth: "520px" }} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle} style={{ color: "#dc2626", display: "flex", alignItems: "center", gap: "8px" }}>
                <AlertTriangle size={22} /> Clear Feedback Responses
              </h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => !clearing && setShowClearModal(false)}
              >
                ×
              </button>
            </div>

            <p style={{ fontSize: "14px", color: "#334155", lineHeight: 1.6 }}>
              This action will delete feedback responses for the selected scope:
              <br />
              <strong>Department:</strong> {selectedDept} | <strong>Year:</strong> {selectedYear} | <strong>Semester:</strong> {selectedSem}
            </p>

            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "12px", fontSize: "13px", color: "#b91c1c", margin: "14px 0" }}>
              ⚠️ Once cleared, all affected students will be reset to <strong>Pending</strong> status and can submit fresh evaluations again.
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
                Type <span style={{ color: "#dc2626" }}>CLEAR ALL RESPONSES</span> to confirm:
              </label>
              <input
                type="text"
                className={styles.searchInput}
                style={{ width: "100%", boxSizing: "border-box" }}
                value={clearConfirmationText}
                onChange={(e) => setClearConfirmationText(e.target.value)}
                placeholder="CLEAR ALL RESPONSES"
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setShowClearModal(false)}
                disabled={clearing}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.btnDanger}
                onClick={handleClearFeedback}
                disabled={clearing || clearConfirmationText !== "CLEAR ALL RESPONSES"}
              >
                {clearing ? "Clearing..." : "Confirm & Clear"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
