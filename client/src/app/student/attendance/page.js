"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCw,
  AlertTriangle,
  FileSpreadsheet,
  ArrowLeft,
} from "lucide-react";
import styles from "../css/student.module.css";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const api = axios.create({ baseURL: BASE_URL, withCredentials: true });

export default function StudentAttendancePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [selectedSemester, setSelectedSemester] = useState(null);
  const [currentSemester, setCurrentSemester] = useState(null);
  const [attendanceData, setAttendanceData] = useState({
    totalPeriods: 0,
    totalPresent: 0,
    totalAbsent: 0,
    overallPercentage: 0,
    subjects: [],
    recentLog: [],
  });

  const fetchAttendance = async (sem) => {
    setLoading(true);
    try {
      const res = await api.get("/api/student/attendance", {
        params: sem ? { semester: sem } : {},
      });
      if (res.data.success) {
        setAttendanceData(res.data.data);
        const curSem = res.data.data.currentSemester || res.data.data.semester || 1;
        setCurrentSemester(curSem);
        if (!selectedSemester) {
          setSelectedSemester(res.data.data.semester || curSem);
        }
      }
    } catch (err) {
      if (err.response?.data?.islogout === true || err.response?.status === 401) {
        router.push("/");
        return;
      }
      console.error("Failed to fetch attendance:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initFetch = async () => {
      try {
        const profRes = await api.get("/api/student/profile");
        if (profRes.data.success) {
          const sem = profRes.data.data.semester || 1;
          setSelectedSemester(sem);
          setCurrentSemester(sem);
          fetchAttendance(sem);
        } else {
          fetchAttendance();
        }
      } catch (e) {
        fetchAttendance();
      }
    };
    initFetch();
  }, []);

  const handleSemesterChange = (sem) => {
    setSelectedSemester(sem);
    fetchAttendance(sem);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Derive list of all absences
  const absentList =
    Array.isArray(attendanceData.absentLog) && attendanceData.absentLog.length > 0
      ? attendanceData.absentLog
      : (attendanceData.recentLog || []).filter(
          (l) => String(l.status || "").trim().toLowerCase() === "absent"
        );

  const totalAbsences = attendanceData.totalAbsent || absentList.length;
  const isLowAttendance = (attendanceData.overallPercentage || 0) < 75;

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <div>
          <h1 className={styles.title}>My Attendance Record</h1>
          <p className={styles.subtitle}>
            Semester {selectedSemester} subject-wise &amp; period-by-period tracking
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            className={styles.tabBtn}
            onClick={() => router.push("/student")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              color: "#334155",
            }}
          >
            <ArrowLeft size={15} /> Back to Dashboard
          </button>

          <button
            className={`${styles.tabBtn} ${styles.tabBtnActive}`}
            onClick={() => fetchAttendance(selectedSemester)}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <RotateCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Semester Selector Tabs */}
      <div className={styles.filterBar}>
        <div className={styles.tabsGroup}>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b", marginRight: "6px" }}>
            Semester:
          </span>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
            <button
              key={sem}
              className={`${styles.tabBtn} ${
                selectedSemester === sem ? styles.tabBtnActive : ""
              }`}
              onClick={() => handleSemesterChange(sem)}
            >
              Sem {sem} {sem === currentSemester ? "(Current)" : ""}
            </button>
          ))}
        </div>
      </div>

      {/* Attendance Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statCardTop}>
            <div className={styles.statIcon}>
              <Clock size={18} />
            </div>
            <h3>Total Periods</h3>
          </div>
          <p>{attendanceData.totalPeriods}</p>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statCardTop}>
            <div className={styles.statIcon} style={{ background: "#dcfce7", color: "#15803d" }}>
              <CheckCircle2 size={18} />
            </div>
            <h3>Attended (Present)</h3>
          </div>
          <p style={{ color: "#15803d" }}>{attendanceData.totalPresent}</p>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statCardTop}>
            <div className={styles.statIcon} style={{ background: "#fee2e2", color: "#b91c1c" }}>
              <XCircle size={18} />
            </div>
            <h3>Missed (Absent)</h3>
          </div>
          <p style={{ color: "#b91c1c" }}>{attendanceData.totalAbsent}</p>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statCardTop}>
            <div className={styles.statIcon} style={{ background: isLowAttendance ? "#fee2e2" : "#e0f2fe", color: isLowAttendance ? "#b91c1c" : "#0369a1" }}>
              <CalendarCheck size={18} />
            </div>
            <h3>Overall Percentage</h3>
          </div>
          <p style={{ color: isLowAttendance ? "#b91c1c" : "#1e3a8a" }}>
            {attendanceData.overallPercentage}%
          </p>
          <div className={styles.progressTrack}>
            <div
              className={`${styles.progressFill} ${
                isLowAttendance ? styles.progressFillDanger : ""
              }`}
              style={{ width: `${Math.min(100, attendanceData.overallPercentage)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Warning Notice if Attendance < 75% */}
      {isLowAttendance && attendanceData.totalPeriods > 0 && (
        <div
          style={{
            background: "#fff1f2",
            border: "1px solid #fecdd3",
            borderRadius: "12px",
            padding: "14px 18px",
            marginBottom: "22px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            color: "#9f1239",
          }}
        >
          <AlertTriangle size={24} color="#e11d48" />
          <div>
            <strong style={{ fontSize: "14px" }}>Attendance Shortage Warning:</strong>
            <p style={{ margin: "2px 0 0 0", fontSize: "13px" }}>
              Your current attendance is {attendanceData.overallPercentage}%, which is below the mandatory 75% threshold required to appear for University / Internal examinations.
            </p>
          </div>
        </div>
      )}

      {/* Subject-wise Attendance Breakdown */}
      <div className={styles.cardSection}>
        <div className={styles.sectionTitle}>
          <FileSpreadsheet size={20} color="#0381ff" />
          Subject-wise Attendance Breakdown
        </div>

        {loading ? (
          <p style={{ textAlign: "center", color: "#64748b", padding: "30px 0" }}>
            Loading attendance records...
          </p>
        ) : attendanceData.subjects.length === 0 ? (
          <p style={{ textAlign: "center", color: "#64748b", padding: "30px 0" }}>
            No subject attendance records found for Semester {selectedSemester}.
          </p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Subject Details</th>
                  <th>Faculty</th>
                  <th>Total Periods</th>
                  <th>Present</th>
                  <th>Absent</th>
                  <th>Attendance %</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {attendanceData.subjects.map((sub) => {
                  const isShortage = sub.percentage < 75;
                  return (
                    <tr key={sub.subjectId}>
                      <td>
                        <div className={styles.subCode}>{sub.subjectCode}</div>
                        <div className={styles.subName}>{sub.subjectName}</div>
                      </td>
                      <td>{sub.facultyName}</td>
                      <td>{sub.total}</td>
                      <td style={{ fontWeight: 700, color: "#15803d" }}>{sub.present}</td>
                      <td style={{ fontWeight: 700, color: "#b91c1c" }}>{sub.absent}</td>
                      <td style={{ fontWeight: 700 }}>{sub.percentage}%</td>
                      <td>
                        <span
                          className={`${styles.badge} ${
                            isShortage ? styles.badgeDanger : styles.badgeSuccess
                          }`}
                        >
                          {isShortage ? "Shortage" : "Eligible"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== Absent Days & Periods Record ===== */}
      <div className={styles.cardSection}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <div className={styles.sectionTitle} style={{ margin: 0 }}>
            <XCircle size={20} color="#b91c1c" />
            Absent Days &amp; Periods Log (Semester {selectedSemester})
          </div>

          <span
            className={`${styles.badge} ${
              totalAbsences > 0 ? styles.badgeDanger : styles.badgeSuccess
            }`}
            style={{ fontSize: "13px", padding: "4px 10px" }}
          >
            {totalAbsences} Periods Absent
          </span>
        </div>

        {loading ? (
          <p style={{ textAlign: "center", color: "#64748b", padding: "30px 0" }}>
            Loading absence records...
          </p>
        ) : absentList.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "36px 20px",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "12px",
              color: "#166534",
            }}
          >
            <CheckCircle2
              size={40}
              color="#16a34a"
              style={{ margin: "0 auto 10px" }}
            />
            <h4 style={{ margin: "0 0 6px 0", fontSize: "16px" }}>
              🎉 Perfect Attendance Record!
            </h4>
            <p style={{ margin: 0, fontSize: "13.5px", color: "#15803d" }}>
              You have not missed any classes in Semester {selectedSemester}. Keep up the great work!
            </p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Day</th>
                  <th>Period &amp; Time</th>
                  <th>Subject Details</th>
                  <th>Faculty</th>
                  <th>Attendance Status</th>
                </tr>
              </thead>
              <tbody>
                {absentList.map((log, idx) => {
                  const dayNames = [
                    "Sunday",
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                  ];
                  let dayName = "";
                  if (log.date) {
                    const d = new Date(log.date);
                    dayName = dayNames[d.getDay()] || "";
                  } else if (log.day && dayNames[log.day]) {
                    dayName = dayNames[log.day];
                  }

                  const periodTimings = {
                    1: "09:45 - 10:30",
                    2: "10:30 - 11:15",
                    3: "11:30 - 12:15",
                    4: "12:15 - 13:00",
                    5: "13:35 - 14:20",
                    6: "14:20 - 15:05",
                    7: "15:05 - 16:00",
                  };

                  return (
                    <tr key={idx} style={{ background: "#fff5f5" }}>
                      <td style={{ fontWeight: 700, color: "#b91c1c" }}>
                        {formatDate(log.date)}
                      </td>
                      <td style={{ fontWeight: 600, color: "#475569" }}>
                        {dayName || "—"}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: "#0b1d3a" }}>
                          Period {log.period}
                        </div>
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#64748b",
                            marginTop: "2px",
                          }}
                        >
                          {periodTimings[log.period] || ""}
                        </div>
                      </td>
                      <td>
                        <div className={styles.subCode}>{log.subjectCode}</div>
                        <div className={styles.subName}>{log.subjectName}</div>
                      </td>
                      <td>{log.facultyName}</td>
                      <td>
                        <span
                          className={`${styles.badge} ${styles.badgeDanger}`}
                          style={{ padding: "4px 10px", fontSize: "12.5px" }}
                        >
                          ABSENT
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
