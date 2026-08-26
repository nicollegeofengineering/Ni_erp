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
  Calendar,
  CalendarDays,
  Calculator,
  TrendingDown,
  Info,
  Sparkles,
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
    lastTwoDaysLeave: [],
    nextDaySchedule: null,
    weeklyTimetable: {},
  });

  // Simulator State
  const [simDay, setSimDay] = useState(null);

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
        if (res.data.data.nextDaySchedule?.dayNumber) {
          setSimDay(res.data.data.nextDaySchedule.dayNumber);
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
  const overallPct = attendanceData.overallPercentage || 0;
  const isCritical = overallPct < 70;
  const isWarning = overallPct >= 70 && overallPct < 80;

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
            <div
              className={styles.statIcon}
              style={{
                background: isCritical ? "#fee2e2" : isWarning ? "#fef3c7" : "#e0f2fe",
                color: isCritical ? "#b91c1c" : isWarning ? "#b45309" : "#0369a1",
              }}
            >
              <CalendarCheck size={18} />
            </div>
            <h3>Overall Percentage</h3>
          </div>
          <p style={{ color: isCritical ? "#b91c1c" : isWarning ? "#b45309" : "#1e3a8a" }}>
            {attendanceData.overallPercentage}%
          </p>
          <div className={styles.progressTrack}>
            <div
              className={`${styles.progressFill} ${
                isCritical
                  ? styles.progressFillDanger
                  : isWarning
                  ? styles.progressFillWarning
                  : ""
              }`}
              style={{ width: `${Math.min(100, attendanceData.overallPercentage)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Critical Warning Notice if Attendance < 70% */}
      {isCritical && attendanceData.totalPeriods > 0 && (
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
            <strong style={{ fontSize: "14px" }}>🚨 Critical Attendance Alert (Exam Ineligible):</strong>
            <p style={{ margin: "2px 0 0 0", fontSize: "13px" }}>
              Your current attendance is {attendanceData.overallPercentage}%, which is below the mandatory 70% minimum threshold to appear for University / Internal examinations.
            </p>
          </div>
        </div>
      )}

      {/* Warning Notice if Attendance >= 70% and < 80% */}
      {isWarning && attendanceData.totalPeriods > 0 && (
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "12px",
            padding: "14px 18px",
            marginBottom: "22px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            color: "#92400e",
          }}
        >
          <AlertTriangle size={24} color="#d97706" />
          <div>
            <strong style={{ fontSize: "14px" }}>⚠️ Attendance Warning (Below 80%):</strong>
            <p style={{ margin: "2px 0 0 0", fontSize: "13px" }}>
              Your current attendance is {attendanceData.overallPercentage}%. Maintain regular attendance to stay safely above the 70% minimum exam eligibility threshold.
            </p>
          </div>
        </div>
      )}

      {/* ===== 1. Recent Leaves (Last 2 Days Leave Record) ===== */}
      <div className={styles.cardSection}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "14px" }}>
          <div className={styles.sectionTitle} style={{ margin: 0 }}>
            <CalendarDays size={20} color="#ef4444" />
            Recent Leaves (Last 2 Days Leave Record)
          </div>
          <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
            Semester {selectedSemester} Absences
          </span>
        </div>

        {loading ? (
          <p style={{ textAlign: "center", color: "#64748b", padding: "20px 0" }}>Loading leave history...</p>
        ) : !attendanceData.lastTwoDaysLeave || attendanceData.lastTwoDaysLeave.length === 0 ? (
          <div style={{ padding: "18px 20px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "12px", display: "flex", alignItems: "center", gap: "12px", color: "#166534" }}>
            <CheckCircle2 size={24} color="#16a34a" />
            <div>
              <strong style={{ fontSize: "14px" }}>No Recent Leaves Taken!</strong>
              <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: "#15803d" }}>
                You have 0 recorded absences in recent days for Semester {selectedSemester}.
              </p>
            </div>
          </div>
        ) : (
          <div className={styles.recentLeavesGrid}>
            {attendanceData.lastTwoDaysLeave.map((leave, lIdx) => {
              const isFullDay = leave.missedPeriodsCount >= 6;
              return (
                <div key={lIdx} className={styles.leaveDayCard}>
                  <div className={styles.leaveDayHeader}>
                    <div className={styles.leaveDateTitle}>
                      <Calendar size={16} />
                      {formatDate(leave.date)} ({leave.dayName})
                    </div>
                    <span className={`${styles.badge} ${styles.badgeDanger}`} style={{ fontSize: "11px", padding: "3px 8px" }}>
                      {isFullDay ? "Full Day Leave" : `${leave.missedPeriodsCount} Periods Missed`}
                    </span>
                  </div>

                  <div className={styles.leavePeriodsList}>
                    {leave.periods.map((p, pIdx) => (
                      <div key={pIdx} className={styles.leavePeriodItem}>
                        <div>
                          <strong style={{ color: "#991b1b" }}>Period {p.period}:</strong>{" "}
                          <span style={{ fontWeight: 600, color: "#1e293b" }}>{p.subjectCode}</span> - {p.subjectName}
                        </div>
                        <span style={{ color: "#64748b", fontSize: "11.5px" }}>{p.facultyName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== 2. Next Day Leave & Missed Classes Planner (Simulator) ===== */}
      {attendanceData.weeklyTimetable && Object.keys(attendanceData.weeklyTimetable).length > 0 && (
        <div className={styles.cardSection}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "10px" }}>
            <div className={styles.sectionTitle} style={{ margin: 0 }}>
              <Calculator size={20} color="#2563eb" />
              Leave Impact Planner (Next Day / Missed Class Simulator)
            </div>
            <span style={{ fontSize: "12px", color: "#2563eb", background: "#eff6ff", padding: "4px 10px", borderRadius: "12px", fontWeight: 700 }}>
              Live Projection
            </span>
          </div>
          <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#64748b" }}>
            Simulate the exact impact on your attendance percentage before taking leave on upcoming days.
          </p>

          {/* Weekday Selector */}
          <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "8px", marginBottom: "14px" }}>
            {[
              { id: 1, name: "Monday" },
              { id: 2, name: "Tuesday" },
              { id: 3, name: "Wednesday" },
              { id: 4, name: "Thursday" },
              { id: 5, name: "Friday" },
              { id: 6, name: "Saturday" },
            ].map((d) => {
              const isNext = attendanceData.nextDaySchedule?.dayNumber === d.id;
              const active = simDay === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSimDay(d.id)}
                  style={{
                    padding: "7px 14px",
                    borderRadius: "8px",
                    fontSize: "12.5px",
                    fontWeight: 700,
                    cursor: "pointer",
                    border: active ? "1px solid #2563eb" : "1px solid #cbd5e1",
                    background: active ? "#2563eb" : isNext ? "#eff6ff" : "#ffffff",
                    color: active ? "#ffffff" : isNext ? "#1d4ed8" : "#334155",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {d.name} {isNext && <span style={{ fontSize: "10px", background: active ? "rgba(255,255,255,0.25)" : "#dbeafe", padding: "1px 6px", borderRadius: "8px" }}>Next Day</span>}
                </button>
              );
            })}
          </div>

          {/* Simulator Calculations */}
          {(() => {
            const dayPeriods = (attendanceData.weeklyTimetable && attendanceData.weeklyTimetable[simDay]) || [];
            const missedCount = dayPeriods.length;
            const currentTotal = attendanceData.totalPeriods || 0;
            const currentPresent = attendanceData.totalPresent || 0;
            const currentPct = attendanceData.overallPercentage || 0;

            const simTotal = currentTotal + missedCount;
            const simPresent = currentPresent;
            const simPct = simTotal > 0 ? parseFloat(((simPresent / simTotal) * 100).toFixed(1)) : 0;
            const dropDiff = parseFloat((currentPct - simPct).toFixed(1));

            const isSimCritical = simPct < 70;
            const isSimWarning = simPct >= 70 && simPct < 80;

            const neededToRecover = Math.max(0, Math.ceil((0.8 * simTotal - simPresent) / 0.2));

            return (
              <div className={styles.simulatorGrid}>
                {/* Left: Metric Comparison Box */}
                <div className={styles.simulatorMetricBox} style={{ borderTop: `4px solid ${isSimCritical ? "#ef4444" : isSimWarning ? "#f59e0b" : "#10b981"}` }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>Attendance Impact</span>
                      <span className={`${styles.badge} ${isSimCritical ? styles.badgeDanger : isSimWarning ? styles.badgeWarning : styles.badgeSuccess}`} style={{ fontSize: "11.5px", padding: "3px 8px" }}>
                        {isSimCritical ? "Critical (<70%)" : isSimWarning ? "Warning (<80%)" : "Eligible (≥80%)"}
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                      <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", textAlign: "center" }}>
                        <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Current</div>
                        <div style={{ fontSize: "22px", fontWeight: 800, color: "#1e293b", marginTop: "2px" }}>{currentPct}%</div>
                        <div style={{ fontSize: "11px", color: "#64748b" }}>{currentPresent}/{currentTotal} Periods</div>
                      </div>

                      <div style={{ background: isSimCritical ? "#fff1f2" : isSimWarning ? "#fffbeb" : "#f0fdf4", padding: "12px", borderRadius: "8px", textAlign: "center", border: `1px solid ${isSimCritical ? "#fecaca" : isSimWarning ? "#fde68a" : "#bbf7d0"}` }}>
                        <div style={{ fontSize: "11px", fontWeight: 600, color: isSimCritical ? "#991b1b" : isSimWarning ? "#92400e" : "#166534", textTransform: "uppercase" }}>If Leave Taken</div>
                        <div style={{ fontSize: "22px", fontWeight: 800, color: isSimCritical ? "#dc2626" : isSimWarning ? "#d97706" : "#16a34a", marginTop: "2px" }}>
                          {simPct}%
                        </div>
                        <div style={{ fontSize: "11px", color: isSimCritical ? "#b91c1c" : isSimWarning ? "#b45309" : "#15803d", fontWeight: 700 }}>
                          <TrendingDown size={11} style={{ display: "inline", verticalAlign: "middle" }} /> -{dropDiff}% Drop
                        </div>
                      </div>
                    </div>

                    {isSimCritical && (
                      <div style={{ fontSize: "12px", color: "#b91c1c", background: "#fef2f2", padding: "8px 12px", borderRadius: "8px", border: "1px solid #fee2e2", marginBottom: "10px" }}>
                        ⚠️ <strong>Warning:</strong> Taking leave will drop you below the <strong>70% minimum exam eligibility</strong> threshold.
                      </div>
                    )}

                    {isSimWarning && (
                      <div style={{ fontSize: "12px", color: "#92400e", background: "#fffbeb", padding: "8px 12px", borderRadius: "8px", border: "1px solid #fef3c7", marginBottom: "10px" }}>
                        ⚠️ <strong>Notice:</strong> Taking leave will push your attendance below <strong>80%</strong>.
                      </div>
                    )}

                    {neededToRecover > 0 && (
                      <div style={{ fontSize: "12px", color: "#1e40af", background: "#eff6ff", padding: "8px 12px", borderRadius: "8px", border: "1px solid #dbeafe" }}>
                        🎯 <strong>Recovery Target:</strong> You must attend the next <strong>{neededToRecover} consecutive classes</strong> to bring your attendance back to 80%.
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Classes Scheduled on That Day */}
                <div className={styles.simulatorControlCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>
                      Classes Missed ({missedCount} Periods Scheduled)
                    </span>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>Timetable Schedule</span>
                  </div>

                  {missedCount === 0 ? (
                    <div style={{ textAlign: "center", padding: "30px 10px", color: "#64748b", fontSize: "13px" }}>
                      No classes scheduled for this day in Timetable.
                    </div>
                  ) : (
                    <div className={styles.forecastScheduleList}>
                      {dayPeriods.map((slot, sIdx) => (
                        <div key={sIdx} className={styles.forecastPeriodRow}>
                          <div>
                            <strong style={{ color: "#2563eb" }}>Period {slot.period}:</strong>{" "}
                            <span style={{ fontWeight: 600, color: "#1e293b" }}>{slot.subjectCode}</span> - {slot.subjectName}
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: "11.5px", color: "#475569" }}>{slot.facultyName}</div>
                            {slot.hall && <div style={{ fontSize: "10.5px", color: "#94a3b8" }}>{slot.hall}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
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
                  const isSubCritical = sub.percentage < 70;
                  const isSubWarning = sub.percentage >= 70 && sub.percentage < 80;
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
                      <td
                        style={{
                          fontWeight: 700,
                          color: isSubCritical ? "#b91c1c" : isSubWarning ? "#b45309" : "#15803d",
                        }}
                      >
                        {sub.percentage}%
                      </td>
                      <td>
                        <span
                          className={`${styles.badge} ${
                            isSubCritical
                              ? styles.badgeDanger
                              : isSubWarning
                              ? styles.badgeWarning
                              : styles.badgeSuccess
                          }`}
                        >
                          {isSubCritical ? "Ineligible (<70%)" : isSubWarning ? "Warning (<80%)" : "Eligible"}
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
