"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  GraduationCap,
  CalendarCheck,
  ClipboardList,
  BookOpen,
  CalendarRange,
  Megaphone,
} from "lucide-react";
import styles from "../admin/css/dashboard.module.css";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const api = axios.create({ baseURL: BASE_URL, withCredentials: true });

export default function StudentDashboard() {
  const router = useRouter();

  const [studentName, setStudentName] = useState("");
  const [departmentCode, setDepartmentCode] = useState("");
  const [collegeAnnouncements, setCollegeAnnouncements] = useState([]);
  const [departmentAnnouncements, setDepartmentAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);

  // ---------- Fetch User & Announcements ----------
  useEffect(() => {
    const fetchProfileAndAnnouncements = async () => {
      try {
        const profRes = await api.get("/api/student/profile");
        if (profRes.data.success) {
          const s = profRes.data.data;
          const fullName =
            s.name ||
            `${s.first_name || ""} ${s.last_name || ""}`.trim() ||
            s.register_no ||
            "Student";
          setStudentName(fullName);
          if (s.department_code) setDepartmentCode(s.department_code);
        }
      } catch (e) {
        const name = sessionStorage.getItem("userName") || "Student";
        setStudentName(name);
      }

      setAnnouncementsLoading(true);
      try {
        const res = await api.get("/api/announcements");
        if (res.data.success) {
          setCollegeAnnouncements(res.data.data.college || []);
          setDepartmentAnnouncements(res.data.data.department || []);
          if (res.data.data.userDepartment) {
            setDepartmentCode(res.data.data.userDepartment);
          }
        }
      } catch (err) {
        if (err.response?.data?.islogout === true || err.response?.status === 401) {
          router.push("/");
          return;
        }
        console.error("Failed to load student announcements:", err);
      } finally {
        setAnnouncementsLoading(false);
      }
    };

    fetchProfileAndAnnouncements();
  }, []);

  const formatDate = (d) => {
    if (!d) return "";
    const date = new Date(d);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className={styles.dashboard}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>
          Welcome, {studentName} {departmentCode && `(${departmentCode})`}
        </h1>
        <p className={styles.subtitle}>
          {new Date().toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      <div className={styles.quickActions} style={{ marginTop: "10px" }}>
        <h2>Student Quick Access</h2>
        <div className={styles.actionButtons}>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => router.push("/student/marks")}
          >
            <ClipboardList size={16} />
            My Marks
          </button>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => router.push("/student/attendance")}
          >
            <CalendarCheck size={16} />
            My Attendance
          </button>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => router.push("/student/classes")}
          >
            <BookOpen size={16} />
            My Classes
          </button>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => router.push("/student/timetable")}
          >
            <CalendarRange size={16} />
            Class Timetable
          </button>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => router.push("/student/announcements")}
          >
            <Megaphone size={16} />
            All Announcements
          </button>
        </div>
      </div>

      {/* ===== Dual Announcements: College (Left) & Department (Right) ===== */}
      <div className={styles.contentGrid}>
        {/* College Announcements (Left) */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>
              <Megaphone size={18} />
              College Announcements
            </h2>
          </div>

          {announcementsLoading ? (
            <div className={styles.emptyState}>
              <p>Loading announcements...</p>
            </div>
          ) : collegeAnnouncements.length === 0 ? (
            <div className={styles.emptyState}>
              <Megaphone />
              <p>No college announcements yet.</p>
            </div>
          ) : (
            <ul className={styles.announcementList}>
              {collegeAnnouncements.map((item) => (
                <li
                  key={item._id}
                  className={`${styles.announcementCard} ${
                    item.pinned ? styles.pinnedCard : ""
                  }`}
                >
                  <div className={styles.announcementTop}>
                    <h3 className={styles.announcementTitle}>{item.title}</h3>
                    <div className={styles.announcementBadges}>
                      {item.priority === "urgent" && (
                        <span className={`${styles.badge} ${styles.badgeUrgent}`}>
                          Urgent
                        </span>
                      )}
                      {item.priority === "important" && (
                        <span
                          className={`${styles.badge} ${styles.badgeImportant}`}
                        >
                          Important
                        </span>
                      )}
                    </div>
                  </div>

                  <p className={styles.announcementContent}>{item.content}</p>

                  <div className={styles.announcementMeta}>
                    <span className={styles.authorTag}>
                      By {item.authorName || "Administration"} • {formatDate(item.createdAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Department Announcements (Right) */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>
              <Megaphone size={18} />
              {departmentCode ? `${departmentCode} Department` : "Department"} Announcements
            </h2>
          </div>

          {announcementsLoading ? (
            <div className={styles.emptyState}>
              <p>Loading department announcements...</p>
            </div>
          ) : departmentAnnouncements.length === 0 ? (
            <div className={styles.emptyState}>
              <Megaphone />
              <p>No department announcements posted yet.</p>
            </div>
          ) : (
            <ul className={styles.announcementList}>
              {departmentAnnouncements.map((item) => (
                <li
                  key={item._id}
                  className={`${styles.announcementCard} ${
                    item.pinned ? styles.pinnedCard : ""
                  }`}
                >
                  <div className={styles.announcementTop}>
                    <h3 className={styles.announcementTitle}>{item.title}</h3>
                    <div className={styles.announcementBadges}>
                      {item.priority === "urgent" && (
                        <span className={`${styles.badge} ${styles.badgeUrgent}`}>
                          Urgent
                        </span>
                      )}
                      {item.priority === "important" && (
                        <span
                          className={`${styles.badge} ${styles.badgeImportant}`}
                        >
                          Important
                        </span>
                      )}
                    </div>
                  </div>

                  <p className={styles.announcementContent}>{item.content}</p>

                  <div className={styles.announcementMeta}>
                    <span className={styles.authorTag}>
                      By {item.authorName} • {formatDate(item.createdAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
