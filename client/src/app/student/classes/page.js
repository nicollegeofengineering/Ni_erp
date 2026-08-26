"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  BookOpen,
  User,
  Building,
  Calendar,
  Layers,
  Award,
  RotateCw,
  Mail,
  ArrowLeft,
} from "lucide-react";
import styles from "../css/student.module.css";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const api = axios.create({ baseURL: BASE_URL, withCredentials: true });

export default function StudentClassesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [classData, setClassData] = useState({
    semester: 1,
    year: 1,
    department: "",
    totalClasses: 0,
    classes: [],
  });

  const fetchClasses = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/student/classes");
      if (res.data.success) {
        setClassData(res.data.data);
      }
    } catch (err) {
      if (err.response?.data?.islogout === true || err.response?.status === 401) {
        router.push("/");
        return;
      }
      console.error("Failed to fetch classes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <div>
          <h1 className={styles.title}>My Courses & Classes</h1>
          <p className={styles.subtitle}>
            Active subjects for {classData.department || "Dept"} — Year {classData.year}, Semester {classData.semester}
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
            onClick={fetchClasses}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <RotateCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statCardTop}>
            <div className={styles.statIcon}>
              <BookOpen size={18} />
            </div>
            <h3>Enrolled Courses</h3>
          </div>
          <p>{classData.totalClasses}</p>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statCardTop}>
            <div className={styles.statIcon}>
              <Layers size={18} />
            </div>
            <h3>Current Semester</h3>
          </div>
          <p>Semester {classData.semester}</p>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statCardTop}>
            <div className={styles.statIcon}>
              <Award size={18} />
            </div>
            <h3>Department</h3>
          </div>
          <p>{classData.department || "N/A"}</p>
        </div>
      </div>

      {/* Classes Card Grid */}
      <div className={styles.cardSection}>
        <div className={styles.sectionTitle}>
          <BookOpen size={20} color="#0381ff" />
          Enrolled Subjects & Faculty (From Timetable)
        </div>

        {loading ? (
          <p style={{ textAlign: "center", color: "#64748b", padding: "30px 0" }}>
            Loading course curriculum...
          </p>
        ) : classData.classes.length === 0 ? (
          <div style={{ textAlign: "center", color: "#64748b", padding: "40px 0" }}>
            <BookOpen size={36} color="#cbd5e1" style={{ margin: "0 auto 10px" }} />
            <p>No active courses scheduled in the timetable for this semester.</p>
          </div>
        ) : (
          <div className={styles.classesGrid}>
            {classData.classes.map((cls) => (
              <div key={cls.subjectId} className={styles.classCard}>
                <div>
                  <div className={styles.classTop}>
                    <span className={styles.classCode}>{cls.subjectCode}</span>
                    <span
                      className={`${styles.badge} ${cls.category === "Lab" || cls.category === "Practical"
                          ? styles.badgeInfo
                          : styles.badgeSuccess
                        }`}
                    >
                      {cls.category}
                    </span>
                  </div>

                  <h3 className={styles.className}>{cls.subjectName}</h3>
                </div>

                <div className={styles.classDetails}>
                  <div className={styles.classDetailRow}>
                    <User size={15} color="#0381ff" />
                    <span>
                      Faculty: <strong>{cls.facultyName}</strong>
                    </span>
                  </div>

                  {cls.facultyEmail && (
                    <div className={styles.classDetailRow}>
                      <Mail size={15} color="#64748b" />
                      <span style={{ fontSize: "12px" }}>{cls.facultyEmail}</span>
                    </div>
                  )}

                  <div className={styles.classDetailRow}>
                    <Award size={15} color="#0381ff" />
                    <span>Credits: {cls.credits}</span>
                  </div>

                  {cls.hallNumber && (
                    <div className={styles.classDetailRow}>
                      <Building size={15} color="#0381ff" />
                      <span>Classroom / Lab: Hall {cls.hallNumber}</span>
                    </div>
                  )}


                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
