"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Megaphone, Search, ArrowLeft } from "lucide-react";
import Link from "next/link";
import styles from "../../admin/css/dashboard.module.css";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const api = axios.create({ baseURL: BASE_URL, withCredentials: true });

export default function StudentAnnouncementsPage() {
  const router = useRouter();

  const [collegeAnnouncements, setCollegeAnnouncements] = useState([]);
  const [departmentAnnouncements, setDepartmentAnnouncements] = useState([]);
  const [departmentCode, setDepartmentCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all"); // 'all', 'college', 'department'
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchAnnouncements = async () => {
      setLoading(true);
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
        console.error("Failed to load announcements:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnnouncements();
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

  // Combine and filter announcements
  const allAnnouncements = [
    ...collegeAnnouncements.map((a) => ({ ...a, source: "college" })),
    ...departmentAnnouncements.map((a) => ({ ...a, source: "department" })),
  ];

  const filteredAnnouncements = allAnnouncements
    .filter((a) => {
      if (activeTab === "college") return a.source === "college";
      if (activeTab === "department") return a.source === "department";
      return true;
    })
    .filter((a) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        a.title?.toLowerCase().includes(q) ||
        a.content?.toLowerCase().includes(q) ||
        a.authorName?.toLowerCase().includes(q)
      );
    });

  return (
    <div className={styles.dashboard}>
      <div className={styles.titleRow}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link href="/student">
            <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}>
              <ArrowLeft size={14} /> Back
            </button>
          </Link>
          <h1 className={styles.title}>Announcements Bulletin</h1>
        </div>
        <p className={styles.subtitle}>
          Official college and {departmentCode || "department"} circulars
        </p>
      </div>

      <div
        style={{
          background: "#fff",
          padding: "16px 20px",
          borderRadius: "14px",
          boxShadow: "0 2px 10px rgba(11, 29, 58, 0.08)",
          marginBottom: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            className={`${styles.btn} ${
              activeTab === "all" ? styles.btnPrimary : styles.btnGhost
            }`}
            onClick={() => setActiveTab("all")}
          >
            All ({allAnnouncements.length})
          </button>
          <button
            className={`${styles.btn} ${
              activeTab === "college" ? styles.btnPrimary : styles.btnGhost
            }`}
            onClick={() => setActiveTab("college")}
          >
            College ({collegeAnnouncements.length})
          </button>
          <button
            className={`${styles.btn} ${
              activeTab === "department" ? styles.btnPrimary : styles.btnGhost
            }`}
            onClick={() => setActiveTab("department")}
          >
            Department ({departmentAnnouncements.length})
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Search size={16} color="#64748b" />
          <input
            type="text"
            placeholder="Search circulars..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.modalInput}
            style={{ width: "220px", padding: "6px 12px" }}
          />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {loading ? (
          <div className={styles.emptyState}>
            <p>Loading announcements...</p>
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className={styles.emptyState}>
            <Megaphone />
            <p>No circulars found matching your filter.</p>
          </div>
        ) : (
          filteredAnnouncements.map((item) => (
            <div
              key={item._id}
              className={`${styles.announcementCard} ${
                item.pinned ? styles.pinnedCard : ""
              }`}
              style={{ padding: "18px 22px" }}
            >
              <div className={styles.announcementTop}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <h3
                    className={styles.announcementTitle}
                    style={{ fontSize: "16px" }}
                  >
                    {item.title}
                  </h3>
                  <span
                    className={`${styles.badge} ${
                      item.source === "college" ? styles.badgeNormal : styles.badgeDept
                    }`}
                  >
                    {item.source === "college"
                      ? "College Circular"
                      : `${item.department || "Dept"} Circular`}
                  </span>
                </div>

                <div className={styles.announcementBadges}>
                  {item.priority === "urgent" && (
                    <span className={`${styles.badge} ${styles.badgeUrgent}`}>
                      Urgent
                    </span>
                  )}
                  {item.priority === "important" && (
                    <span className={`${styles.badge} ${styles.badgeImportant}`}>
                      Important
                    </span>
                  )}
                </div>
              </div>

              <p
                className={styles.announcementContent}
                style={{ fontSize: "14px", marginTop: "10px" }}
              >
                {item.content}
              </p>

              <div className={styles.announcementMeta}>
                <span className={styles.authorTag}>
                  Published by {item.authorName || "Administration"} •{" "}
                  {formatDate(item.createdAt)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
