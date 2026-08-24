"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  ClipboardList,
  GraduationCap,
  Award,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  ArrowLeft,
} from "lucide-react";
import styles from "../css/student.module.css";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const api = axios.create({ baseURL: BASE_URL, withCredentials: true });

export default function StudentMarksPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [selectedSemester, setSelectedSemester] = useState(null);
  const [currentSemester, setCurrentSemester] = useState(null);
  const [marks, setMarks] = useState([]);
  const [summary, setSummary] = useState({
    totalSubjects: 0,
    passedCount: 0,
    averageTotal: 0,
  });

  const fetchMarks = async (sem) => {
    setLoading(true);
    try {
      const res = await api.get("/api/student/marks", {
        params: sem ? { semester: sem } : {},
      });
      if (res.data.success) {
        const data = res.data.data;
        setMarks(data.marks || []);
        const curSem = data.currentSemester || data.semester || 1;
        setCurrentSemester(curSem);
        if (!selectedSemester) {
          setSelectedSemester(data.semester || curSem);
        }

        // Calculate statistics
        let passed = 0;
        let totalScoreSum = 0;
        let evaluatedCount = 0;

        (data.marks || []).forEach((m) => {
          const score1 = m.iat1?.theory?.total ?? m.iat1?.practical?.mark ?? null;
          const score2 = m.iat2?.theory?.total ?? m.iat2?.practical?.mark ?? null;

          const scores = [score1, score2].filter((s) => s !== null);
          if (scores.length > 0) {
            const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
            totalScoreSum += avg;
            evaluatedCount++;
            if (avg >= 50) passed++;
          }
        });

        setSummary({
          totalSubjects: data.marks?.length || 0,
          passedCount: passed,
          averageTotal:
            evaluatedCount > 0
              ? parseFloat((totalScoreSum / evaluatedCount).toFixed(1))
              : 0,
        });
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
          <p>{summary.totalSubjects}</p>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statCardTop}>
            <div className={styles.statIcon}>
              <CheckCircle2 size={18} />
            </div>
            <h3>Clear / Pass Subjects</h3>
          </div>
          <p>{summary.passedCount}</p>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statCardTop}>
            <div className={styles.statIcon}>
              <Award size={18} />
            </div>
            <h3>Average Score</h3>
          </div>
          <p>{summary.averageTotal}%</p>
          <div className={styles.progressTrack}>
            <div
              className={`${styles.progressFill} ${
                summary.averageTotal < 50 ? styles.progressFillDanger : ""
              }`}
              style={{ width: `${Math.min(100, summary.averageTotal)}%` }}
            />
          </div>
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
                  <th>Subject Details</th>
                  <th>Cat</th>
                  <th>Credits</th>
                  <th>IAT 1 (Assgn)</th>
                  <th>IAT 1 (Exam)</th>
                  <th>IAT 1 (Total)</th>
                  <th>IAT 2 (Assgn)</th>
                  <th>IAT 2 (Exam)</th>
                  <th>IAT 2 (Total)</th>
                  <th>Avg Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {marks.map((m) => {
                  const iat1Assign = m.iat1?.theory?.assignment ?? "-";
                  const iat1Exam = m.iat1?.theory?.writtenExam ?? "-";
                  const iat1Total =
                    m.iat1?.theory?.total ?? m.iat1?.practical?.mark ?? "-";

                  const iat2Assign = m.iat2?.theory?.assignment ?? "-";
                  const iat2Exam = m.iat2?.theory?.writtenExam ?? "-";
                  const iat2Total =
                    m.iat2?.theory?.total ?? m.iat2?.practical?.mark ?? "-";

                  const num1 = typeof iat1Total === "number" ? iat1Total : null;
                  const num2 = typeof iat2Total === "number" ? iat2Total : null;
                  const validNums = [num1, num2].filter((n) => n !== null);

                  const avgScore =
                    validNums.length > 0
                      ? (validNums.reduce((a, b) => a + b, 0) / validNums.length).toFixed(1)
                      : "-";

                  const isPassed =
                    avgScore !== "-" ? parseFloat(avgScore) >= 50 : null;

                  return (
                    <tr key={m.subjectId}>
                      <td>
                        <div className={styles.subCode}>{m.subjectCode}</div>
                        <div className={styles.subName}>{m.subjectName}</div>
                      </td>
                      <td>{m.category}</td>
                      <td>{m.credits}</td>
                      <td>{iat1Assign}</td>
                      <td>{iat1Exam}</td>
                      <td style={{ fontWeight: 700 }}>{iat1Total}</td>
                      <td>{iat2Assign}</td>
                      <td>{iat2Exam}</td>
                      <td style={{ fontWeight: 700 }}>{iat2Total}</td>
                      <td style={{ fontWeight: 700, color: "#1e3a8a" }}>
                        {avgScore !== "-" ? `${avgScore}` : "-"}
                      </td>
                      <td>
                        {isPassed === true && (
                          <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                            PASS
                          </span>
                        )}
                        {isPassed === false && (
                          <span className={`${styles.badge} ${styles.badgeDanger}`}>
                            FAIL
                          </span>
                        )}
                        {isPassed === null && (
                          <span className={`${styles.badge} ${styles.badgeInfo}`}>
                            PENDING
                          </span>
                        )}
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
