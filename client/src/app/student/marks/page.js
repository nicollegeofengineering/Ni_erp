"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  ClipboardList,
  BookOpen,
  RotateCw,
  ArrowLeft,
} from "lucide-react";
import styles from "../css/student.module.css";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const api = axios.create({ baseURL: BASE_URL, withCredentials: true });

function getSubjectCategoryLabel(cat) {
  if (cat === "L") return "Practical (L)";
  if (cat === "T/L" || cat === "TL") return "Theory + Practical (T/L)";
  return "Theory (T)";
}

export default function StudentMarksPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [selectedSemester, setSelectedSemester] = useState(null);
  const [currentSemester, setCurrentSemester] = useState(null);
  const [marks, setMarks] = useState([]);
  const [totalSubjects, setTotalSubjects] = useState(0);

  const fetchMarks = async (sem) => {
    setLoading(true);
    try {
      const res = await api.get("/api/student/marks", {
        params: sem ? { semester: sem } : {},
      });
      if (res.data.success) {
        const data = res.data.data;
        const marksList = data.marks || [];
        setMarks(marksList);
        setTotalSubjects(marksList.length);
        const curSem = data.currentSemester || data.semester || 1;
        setCurrentSemester(curSem);
        if (!selectedSemester) {
          setSelectedSemester(data.semester || curSem);
        }
      }
    } catch (err) {
      if (err.response?.data?.islogout === true || err.response?.status === 401) {
        router.push("/");
        return;
      }
      console.error("Failed to fetch marks:", err);
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
          fetchMarks(sem);
        } else {
          fetchMarks();
        }
      } catch (e) {
        fetchMarks();
      }
    };
    initFetch();
  }, []);

  const handleSemesterChange = (sem) => {
    setSelectedSemester(sem);
    fetchMarks(sem);
  };

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <div>
          <h1 className={styles.title}>My Internal Marks</h1>
          <p className={styles.subtitle}>
            Semester-wise performance & assessment records
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
            onClick={() => fetchMarks(selectedSemester)}
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

      {/* Summary Stat Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statCardTop}>
            <div className={styles.statIcon}>
              <BookOpen size={18} />
            </div>
            <h3>Enrolled Subjects</h3>
          </div>
          <p>{totalSubjects}</p>
        </div>
      </div>

      {/* Marks Table */}
      <div className={styles.cardSection}>
        <div className={styles.sectionTitle}>
          <ClipboardList size={20} color="#0381ff" />
          Internal Assessment Mark Sheet (Semester {selectedSemester})
        </div>

        {loading ? (
          <p style={{ textAlign: "center", color: "#64748b", padding: "30px 0" }}>
            Loading marks record...
          </p>
        ) : marks.length === 0 ? (
          <div style={{ textAlign: "center", color: "#64748b", padding: "40px 0" }}>
            <ClipboardList size={36} color="#cbd5e1" style={{ margin: "0 auto 10px" }} />
            <p>No marks entered for Semester {selectedSemester} yet.</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th rowSpan="2" style={{ verticalAlign: "middle" }}>Subject Details</th>
                  <th rowSpan="2" style={{ verticalAlign: "middle" }}>Category</th>
                  <th rowSpan="2" style={{ verticalAlign: "middle" }}>Credits</th>
                  <th colSpan="4" style={{ textAlign: "center", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    Internal Exam 1 (IAT 1)
                  </th>
                  <th colSpan="4" style={{ textAlign: "center", background: "#f1f5f9", borderBottom: "1px solid #e2e8f0" }}>
                    Internal Exam 2 (IAT 2)
                  </th>
                </tr>
                <tr>
                  <th>Assignment</th>
                  <th>Written</th>
                  <th style={{ fontWeight: 800 }}>Total</th>
                  <th style={{ color: "#2563eb", fontWeight: 700 }}>Practical</th>

                  <th>Assignment</th>
                  <th>Written</th>
                  <th style={{ fontWeight: 800 }}>Total</th>
                  <th style={{ color: "#2563eb", fontWeight: 700 }}>Practical</th>
                </tr>
              </thead>
              <tbody>
                {marks.map((m) => {
                  const cat = (m.category || "T").toUpperCase();
                  const isPracticalOnly = cat === "L";
                  const isTheoryOnly = cat === "T";

                  // IAT 1
                  const iat1Assign = isPracticalOnly ? "—" : (m.iat1?.theory?.assignment ?? "—");
                  const iat1Exam = isPracticalOnly ? "—" : (m.iat1?.theory?.writtenExam ?? "—");
                  const iat1TotalVal = isPracticalOnly
                    ? "—"
                    : m.iat1?.theory?.total ?? (m.iat1?.theory?.assignment != null && m.iat1?.theory?.writtenExam != null ? Number(m.iat1.theory.assignment) + Number(m.iat1.theory.writtenExam) : null);
                  const iat1Total = iat1TotalVal !== null && iat1TotalVal !== undefined ? iat1TotalVal : "—";
                  const iat1Practical = isTheoryOnly ? "—" : (m.iat1?.practical?.mark ?? "—");

                  // IAT 2
                  const iat2Assign = isPracticalOnly ? "—" : (m.iat2?.theory?.assignment ?? "—");
                  const iat2Exam = isPracticalOnly ? "—" : (m.iat2?.theory?.writtenExam ?? "—");
                  const iat2TotalVal = isPracticalOnly
                    ? "—"
                    : m.iat2?.theory?.total ?? (m.iat2?.theory?.assignment != null && m.iat2?.theory?.writtenExam != null ? Number(m.iat2.theory.assignment) + Number(m.iat2.theory.writtenExam) : null);
                  const iat2Total = iat2TotalVal !== null && iat2TotalVal !== undefined ? iat2TotalVal : "—";
                  const iat2Practical = isTheoryOnly ? "—" : (m.iat2?.practical?.mark ?? "—");

                  return (
                    <tr key={m.subjectId}>
                      <td>
                        <div className={styles.subCode}>{m.subjectCode}</div>
                        <div className={styles.subName}>{m.subjectName}</div>
                      </td>
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: 700,
                            background: cat === "T" ? "#eff6ff" : cat === "L" ? "#f0fdf4" : "#fef3c7",
                            color: cat === "T" ? "#1d4ed8" : cat === "L" ? "#15803d" : "#b45309",
                          }}
                        >
                          {getSubjectCategoryLabel(cat)}
                        </span>
                      </td>
                      <td>{m.credits || 3}</td>

                      {/* IAT 1: Assignment, Written, Total, Practical */}
                      <td>{iat1Assign}</td>
                      <td>{iat1Exam}</td>
                      <td style={{ fontWeight: 800, color: "#0f172a" }}>{iat1Total}</td>
                      <td style={{ color: isTheoryOnly ? "#94a3b8" : "#2563eb", fontWeight: isTheoryOnly ? 400 : 700 }}>
                        {iat1Practical}
                      </td>

                      {/* IAT 2: Assignment, Written, Total, Practical */}
                      <td>{iat2Assign}</td>
                      <td>{iat2Exam}</td>
                      <td style={{ fontWeight: 800, color: "#0f172a" }}>{iat2Total}</td>
                      <td style={{ color: isTheoryOnly ? "#94a3b8" : "#2563eb", fontWeight: isTheoryOnly ? 400 : 700 }}>
                        {iat2Practical}
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
