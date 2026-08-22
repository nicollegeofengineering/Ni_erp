"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  GraduationCap,
  Users,
  IndianRupee,
  CheckCircle2,
  Megaphone,
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  X,
  UserPlus,
  UserCog,
  Wallet,
  ClipboardList,
} from "lucide-react";
import styles from "./css/dashboard.module.css";

const handleUnauthorized = (error, router) => {
  if (error.response?.data?.islogout === true) {
    router.push("/");
    return true;
  }
  return false;
};

export default function Admin() {
  const router = useRouter();

  // --- Stats state ---
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeStaff: 0,
    pendingFees: 0,
    attendancePercentage: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // --- News state ---
  const [announcements, setAnnouncements] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- Modal state ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "announcement",
    status: "published",
  });

  // Fetch dashboard stats
  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/dashboard/stats`,
        { withCredentials: true }
      );
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      if (handleUnauthorized(error, router)) return;
      console.error("Error fetching stats:", error);
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch news (announcements & events)
  const fetchNews = async () => {
    try {
      setLoading(true);
      const [annRes, evtRes] = await Promise.all([
        axios.get(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/news?category=announcement`, {
          withCredentials: true,
        }),
        axios.get(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/news?category=event`, {
          withCredentials: true,
        }),
      ]);
      setAnnouncements(annRes.data);
      setEvents(evtRes.data);
    } catch (error) {
      if (handleUnauthorized(error, router)) return;
      console.error("Error fetching news:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchNews();
  }, []);

  // --- Modal handlers (unchanged) ---
  const openAddModal = (category) => {
    setFormData({ title: "", content: "", category, status: "published" });
    setEditItem(null);
    setIsAdding(true);
  };

  const openEditModal = (item) => {
    setFormData({
      title: item.title,
      content: item.content || "",
      category: item.category,
      status: item.status,
    });
    setEditItem(item);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsAdding(false);
    setEditItem(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const saveNews = async () => {
    const { title, content, category, status } = formData;
    if (!title.trim()) {
      alert("Title is required");
      return;
    }
    try {
      if (editItem) {
        await axios.put(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/news/${editItem._id}`,
          { title, content, category, status },
          { withCredentials: true }
        );
      } else {
        await axios.post(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/news`,
          { title, content, category, status },
          { withCredentials: true }
        );
      }
      closeModal();
      fetchNews();
    } catch (error) {
      if (handleUnauthorized(error, router)) return;
      console.error("Error saving news:", error);
      alert("Failed to save. Please try again.");
    }
  };

  const deleteNews = async (id) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    try {
      await axios.delete(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/news/${id}`, {
        withCredentials: true,
      });
      fetchNews();
    } catch (error) {
      if (handleUnauthorized(error, router)) return;
      console.error("Error deleting news:", error);
      alert("Failed to delete.");
    }
  };

  // --- Render ---
  return (
    <div className={styles.dashboard}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>Dashboard</h1>
        <p className={styles.subtitle}>
          {new Date().toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
      </div>

      {/* Stats Cards */}
      <div className={styles.cards}>
        <div className={styles.card}>
          <div className={styles.cardTop}>
            <span className={styles.cardIcon}><GraduationCap size={18} /></span>
            <h3>Total Students</h3>
          </div>
          <p>{statsLoading ? "..." : stats.totalStudents.toLocaleString("en-IN")}</p>
          <p className={styles.cardMeta}>Active enrollment</p>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTop}>
            <span className={styles.cardIcon}><Users size={18} /></span>
            <h3>Total Staff</h3>
          </div>
          <p>{statsLoading ? "..." : stats.activeStaff.toLocaleString("en-IN")}</p>
          <p className={styles.cardMeta}>Faculty & admin</p>
        </div>

        

        <div className={styles.card}>
          <div className={styles.cardTop}>
            <span className={styles.cardIcon}><CheckCircle2 size={18} /></span>
            <h3>Attendance</h3>
          </div>
          <p>{statsLoading ? "..." : `${stats.attendancePercentage}%`}</p>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${stats.attendancePercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Announcements & Events – same as before */}
      <div className={styles.contentGrid}>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2><Megaphone size={18} /> Announcements</h2>
            <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={() => openAddModal("announcement")}>
              <Plus size={14} /> Add
            </button>
          </div>
          {loading ? (
            <div className={styles.emptyState}>Loading...</div>
          ) : announcements.length === 0 ? (
            <div className={styles.emptyState}><Megaphone /><p>No announcements yet.</p></div>
          ) : (
            <ul>
              {announcements.map((item) => (
                <li key={item._id} className={styles.listItem}>
                  <span>{item.title}</span>
                  <div>
                    <button className={styles.iconBtn} onClick={() => openEditModal(item)}>
                      <Pencil size={14} />
                    </button>
                    <button className={styles.iconBtn} onClick={() => deleteNews(item._id)} style={{ marginLeft: "6px" }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2><CalendarDays size={18} /> Upcoming Events</h2>
            <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={() => openAddModal("event")}>
              <Plus size={14} /> Add
            </button>
          </div>
          {loading ? (
            <div className={styles.emptyState}>Loading...</div>
          ) : events.length === 0 ? (
            <div className={styles.emptyState}><CalendarDays /><p>No events scheduled.</p></div>
          ) : (
            <ul>
              {events.map((item) => (
                <li key={item._id} className={styles.listItem}>
                  <span>{item.title}</span>
                  <div>
                    <button className={styles.iconBtn} onClick={() => openEditModal(item)}>
                      <Pencil size={14} />
                    </button>
                    <button className={styles.iconBtn} onClick={() => deleteNews(item._id)} style={{ marginLeft: "6px" }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Quick Actions – unchanged */}
      <div className={styles.quickActions}>
        <h2>Quick Actions</h2>
        <div className={styles.actionButtons}>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => router.push("/admin/students")}>
            <UserPlus size={16} /> Add Student
          </button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => router.push("/admin/staff")}>
            <UserCog size={16} /> Add Staff
          </button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => router.push("/admin/fees")}>
            <Wallet size={16} /> Collect Fees
          </button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => router.push("/admin/marks")}>
            <ClipboardList size={16} /> Add Marks
          </button>
        </div>
      </div>

      {/* Modal – unchanged */}
      {(isModalOpen || isAdding) && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{editItem ? "Edit" : "Add"} {formData.category === "announcement" ? "Announcement" : "Event"}</h2>
              <button className={styles.iconBtn} onClick={closeModal}>
                <X size={16} />
              </button>
            </div>

            <div style={{ marginTop: "12px" }}>
              <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>
                Title *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                style={{ width: "95%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)" }}
                placeholder="Enter title"
              />
            </div>

            <div style={{ marginTop: "12px" }}>
              <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>Content</label>
              <textarea
                name="content"
                value={formData.content}
                onChange={handleChange}
                style={{ width: "95%", minHeight: "80px", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", resize: "vertical" }}
                placeholder="Optional description"
              />
            </div>

            <div style={{ marginTop: "12px", display: "flex", gap: "12px" }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>Category</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)" }}
                >
                  <option value="announcement">Announcement</option>
                  <option value="event">Event</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)" }}
                >
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>

            <div className={styles.modalBtns}>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={saveNews}>
                {editItem ? "Update" : "Add"}
              </button>
              <button className={`${styles.btn} ${styles.btnGhost}`} onClick={closeModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}