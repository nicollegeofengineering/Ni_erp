"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  CalendarRange,
  Clock,
  Building,
  User,
  RotateCw,
  Calendar,
  ArrowLeft,
} from "lucide-react";
import styles from "../css/student.module.css";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const api = axios.create({ baseURL: BASE_URL, withCredentials: true });

const PERIOD_TIMINGS = {
  1: "09:45 - 10:30",
  2: "10:30 - 11:15",
  3: "11:30 - 12:15",
  4: "12:15 - 13:00",
  5: "13:35 - 14:20",
  6: "14:20 - 15:05",
  7: "15:05 - 16:00",
};

export default function StudentTimetablePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [timetableData, setTimetableData] = useState({
    semester: 1,
    year: 1,
    department: "",
    days: [],
  });

  // Mobile selected day (1=Monday..6=Saturday)
  const [activeMobileDay, setActiveMobileDay] = useState(1);

  // Set today's day number initially (Monday=1..Saturday=6)
  useEffect(() => {
    const today = new Date().getDay(); // 0=Sunday, 1=Monday..6=Saturday
    if (today >= 1 && today <= 6) {
      setActiveMobileDay(today);
    }
  }, []);

  const fetchTimetable = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/student/timetable");
      if (res.data.success) {
        setTimetableData(res.data.data);
      }
    } catch (err) {
      if (err.response?.data?.islogout === true || err.response?.status === 401) {
        router.push("/");
        return;
      }
      console.error("Failed to fetch student timetable:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimetable();
  }, []);

  const selectedDayObj =
    timetableData.days.find((d) => d.dayNumber === activeMobileDay) ||
    timetableData.days[0];

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <div>
          <h1 className={styles.title}>Class Timetable</h1>
          <p className={styles.subtitle}>
            Weekly class schedule for {timetableData.department || "Dept"} — Year {timetableData.year}, Semester {timetableData.semester}
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
            onClick={fetchTimetable}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <RotateCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Mobile Day Selector Tabs */}
      <div className={styles.dayTabsContainer}>
        {[1, 2, 3, 4, 5, 6].map((dayNum) => {
          const dayName = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dayNum - 1];
          return (
            <button
              key={dayNum}
              className={`${styles.tabBtn} ${activeMobileDay === dayNum ? styles.tabBtnActive : ""
                }`}
              onClick={() => setActiveMobileDay(dayNum)}
            >
              {dayName}
            </button>
          );
        })}
      </div>

      {/* Main Timetable Card */}
      <div className={styles.cardSection}>
        <div className={styles.sectionTitle}>
          <CalendarRange size={20} color="#0381ff" />
          Weekly Class Schedule (Period 1 – 7)
        </div>

        {loading ? (
          <p style={{ textAlign: "center", color: "#64748b", padding: "30px 0" }}>
            Loading timetable...
          </p>
        ) : timetableData.days.length === 0 ? (
          <div style={{ textAlign: "center", color: "#64748b", padding: "40px 0" }}>
            <CalendarRange size={36} color="#cbd5e1" style={{ margin: "0 auto 10px" }} />
            <p>No timetable schedule published yet for this semester.</p>
          </div>
        ) : (
          <>
            {/* Desktop Full Matrix View */}
            <div className={styles.tableWrapper} style={{ display: "block" }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th style={{ width: "110px" }}>Day / Period</th>
                    {[1, 2, 3, 4, 5, 6, 7].map((p) => (
                      <th key={p}>
                        <div>P{p}</div>
                        <div style={{ fontSize: "10px", fontWeight: 500, color: "#64748b" }}>
                          {PERIOD_TIMINGS[p]}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timetableData.days.map((day) => (
                    <tr key={day.dayNumber}>
                      <td style={{ fontWeight: 700, color: "#0b1d3a", background: "#f8fafc" }}>
                        {day.dayName}
                      </td>
                      {[1, 2, 3, 4, 5, 6, 7].map((p) => {
                        const slot = day.periods[p];
                        if (!slot || !slot.subjectCode) {
                          return (
                            <td key={p} className={styles.freeSlot}>
                              Free
                            </td>
                          );
                        }
                        return (
                          <td key={p}>
                            <div className={styles.timetableSlot}>
                              <span className={styles.slotSubCode}>
                                {slot.subjectCode}
                              </span>
                              <span className={styles.slotSubName}>
                                {slot.subjectName}
                              </span>
                              {slot.facultyName && (
                                <span className={styles.slotFaculty}>
                                  {slot.facultyName}
                                </span>
                              )}
                              {slot.hallNumber && (
                                <span className={styles.slotHall}>
                                  Hall {slot.hallNumber}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Single Day Card Breakdown */}
            {selectedDayObj && (
              <div style={{ marginTop: "18px" }}>
                <h4 style={{ margin: "0 0 12px 0", color: "#0b1d3a" }}>
                  {selectedDayObj.dayName}&apos;s Class Schedule:
                </h4>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {[1, 2, 3, 4, 5, 6, 7].map((p) => {
                    const slot = selectedDayObj.periods[p];
                    return (
                      <div
                        key={p}
                        style={{
                          background: slot && slot.subjectCode ? "#f8fafc" : "#fafafa",
                          border: "1px solid #e2e8f0",
                          borderRadius: "10px",
                          padding: "12px 14px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "12px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: "13px",
                              color: "#0381ff",
                              background: "#e8edf6",
                              padding: "4px 8px",
                              borderRadius: "6px",
                            }}
                          >
                            P{p}
                          </span>
                          <div>
                            <div style={{ fontSize: "11px", color: "#64748b" }}>
                              {PERIOD_TIMINGS[p]}
                            </div>
                            <div style={{ fontWeight: 700, fontSize: "14px", color: "#0b1d3a" }}>
                              {slot && slot.subjectCode
                                ? `${slot.subjectCode} — ${slot.subjectName}`
                                : "Free Period"}
                            </div>
                          </div>
                        </div>

                        {slot && slot.subjectCode && (
                          <div style={{ textAlign: "right", fontSize: "12px", color: "#475569" }}>
                            {slot.facultyName && <div>{slot.facultyName}</div>}
                            {slot.hallNumber && (
                              <span className={styles.slotHall}>
                                Hall {slot.hallNumber}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
