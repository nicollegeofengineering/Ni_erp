"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  GraduationCap,
  Users,
  CheckCircle2,
  Megaphone,
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  X,
  UserPlus,
  ClipboardList,
  Calendar,
  RotateCw,
  FileSpreadsheet,
} from "lucide-react";
import styles from "../admin/css/dashboard.module.css";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const api = axios.create({ baseURL: BASE_URL, withCredentials: true });

export default function Hod() {
  const router = useRouter();

  const [students, setStudents] = useState(0);
  const [staff, setStaff] = useState(0);
  const [attendance, setAttendance] = useState(0);
  const [departmentCode, setDepartmentCode] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [hodMatrix, setHodMatrix] = useState([]);
  const [matrixLoading, setMatrixLoading] = useState(false);

  // ---------- Announcements State ----------
  const [collegeAnnouncements, setCollegeAnnouncements] = useState([]);
  const [departmentAnnouncements, setDepartmentAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);

  // Modal State for HOD Department Announcement
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [modalForm, setModalForm] = useState({
    title: "",
    content: "",
    type: "department",
    priority: "normal",
    pinned: false,
  });

  // ---------- Fetch Dashboard & Attendance Matrix ----------
  const fetchDashboardData = async (dateStr) => {
    setMatrixLoading(true);
    try {
      const res = await api.get("/api/staff/attendance/today-summary", {
        params: { date: dateStr || selectedDate },
      });
      if (res.data.success) {
        const data = res.data.data;
        setStudents(data.totalStudents || 0);
        setStaff(data.totalStaff || 0);
        setAttendance(data.overallPercentage || 0);
        setDepartmentCode(data.department || "");
        setHodMatrix(data.hodMatrix || []);
      }
    } catch (err) {
      if (err.response?.data?.islogout === true || err.response?.status === 401) {
        router.push("/");
        return;
      }
      console.error("Failed to load HOD dashboard summary:", err);
    } finally {
      setMatrixLoading(false);
    }
  };

  // ---------- Fetch Announcements ----------
  const fetchAnnouncements = async () => {
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
      console.error("Failed to fetch announcements:", err);
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(selectedDate);
    fetchAnnouncements();
  }, [selectedDate]);

  // Modal Handlers
  const handleOpenAddModal = () => {
    setIsEditMode(false);
    setEditingId(null);
    setModalForm({
      title: "",
      content: "",
      type: "department",
      department: departmentCode,
      priority: "normal",
      pinned: false,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item) => {
    setIsEditMode(true);
    setEditingId(item._id);
    setModalForm({
      title: item.title || "",
      content: item.content || "",
      type: "department",
      department: item.department || departmentCode,
      priority: item.priority || "normal",
      pinned: Boolean(item.pinned),
    });
    setIsModalOpen(true);
  };

  const handleSaveAnnouncement = async () => {
    if (!modalForm.title.trim() || !modalForm.content.trim()) {
      alert("Please provide both title and content");
      return;
    }

    try {
      if (isEditMode) {
        await api.put(`/api/announcements/${editingId}`, modalForm);
      } else {
        await api.post("/api/announcements", {
          ...modalForm,
          type: "department",
          department: departmentCode,
        });
      }
      setIsModalOpen(false);
      fetchAnnouncements();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to save announcement");
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    if (!window.confirm("Are you sure you want to delete this department announcement?")) return;
    try {
      await api.delete(`/api/announcements/${id}`);
      fetchAnnouncements();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete announcement");
    }
  };

  // Close modal on Escape
  useEffect(() => {
    if (!isModalOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") setIsModalOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isModalOpen]);

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
          HOD Dashboard {departmentCode && `– ${departmentCode}`}
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

      <div className={styles.cards}>
        <div className={styles.card}>
          <div className={styles.cardTop}>
            <span className={styles.cardIcon}>
              <GraduationCap size={18} />
            </span>
            <h3>Department Students</h3>
          </div>
          <p>{students.toLocaleString("en-IN")}</p>
          <p className={styles.cardMeta}>Enrolled in {departmentCode || "Dept"}</p>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTop}>
            <span className={styles.cardIcon}>
              <Users size={18} />
            </span>
            <h3>Faculty & Staff</h3>
          </div>
          <p>{staff.toLocaleString("en-IN")}</p>
          <p className={styles.cardMeta}>Department Members</p>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTop}>
            <span className={styles.cardIcon}>
              <CheckCircle2 size={18} />
            </span>
            <h3>Today&apos;s Attendance</h3>
          </div>
          <p>{attendance}%</p>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${Math.min(100, attendance)}%` }}
            />
          </div>
        </div>
      </div>

      {/* ===== HOD Year-wise Period Attendance Matrix ===== */}
      <div className={styles.matrixSection}>
        <div className={styles.matrixHeader}>
          <h2>
            <Calendar size={20} />
            {departmentCode ? `${departmentCode} Department` : "Department"} Attendance (Absentees per Period)
          </h2>
          <div className={styles.matrixControls}>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className={styles.datePickerInput}
            />
            <button
              className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
              onClick={() => fetchDashboardData(selectedDate)}
              title="Refresh"
            >
              <RotateCw size={13} />
              Refresh
            </button>
          </div>
        </div>

        <div className={styles.matrixTableWrapper}>
          <table className={styles.matrixTable}>
            <thead>
              <tr>
                <th>Attendance</th>
                <th>P1</th>
                <th>P2</th>
                <th>P3</th>
                <th>P4</th>
                <th>P5</th>
                <th>P6</th>
                <th>P7</th>
              </tr>
            </thead>
            <tbody>
              {matrixLoading ? (
                <tr>
                  <td colSpan={8} style={{ padding: "24px", color: "#64748b" }}>
                    Loading attendance data...
                  </td>
                </tr>
              ) : hodMatrix.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "24px", color: "#64748b" }}>
                    No records found for today.
                  </td>
                </tr>
              ) : (
                hodMatrix.map((item) => (
                  <tr key={item.year}>
                    <td className={styles.matrixDeptName}>
                      {item.yearLabel}
                    </td>
                    {[1, 2, 3, 4, 5, 6, 7].map((p) => {
                      const periodData = item.periods?.[p];
                      if (!periodData || !periodData.taken) {
                        return (
                          <td key={p} className={styles.notTaken}>
                            -
                          </td>
                        );
                      }
                      const abs = periodData.absent;
                      return (
                        <td key={p}>
                          <span
                            className={`${styles.absentBadge} ${
                              abs > 0 ? styles.absentPositive : styles.absentZero
                            }`}
                            title={`Present: ${periodData.present} | Absent: ${periodData.absent} | Total: ${periodData.total}`}
                          >
                            {abs}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.matrixFooter}>
          <div className={styles.legend}>
            <div className={styles.legendItem}>
              <span className={`${styles.absentBadge} ${styles.absentZero}`}>0</span>
              <span>All Present</span>
            </div>
            <div className={styles.legendItem}>
              <span className={`${styles.absentBadge} ${styles.absentPositive}`}>X</span>
              <span>Number of Absentees</span>
            </div>
            <div className={styles.legendItem}>
              <span className={styles.notTaken}>-</span>
              <span>Not Marked Yet</span>
            </div>
          </div>
          <span>Showing date: {selectedDate}</span>
        </div>
      </div>

      {/* ===== Dual Announcements: College (Left) & Department (Right) ===== */}
      <div className={styles.contentGrid}>
        {/* College Announcements (Left - Read Only for HOD) */}
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

        {/* Department Announcements (Right - Managed by HOD) */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>
              <Megaphone size={18} />
              {departmentCode ? `${departmentCode} Department` : "Department"} Announcements
            </h2>
            <button
              className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
              onClick={handleOpenAddModal}
            >
              <Plus size={14} />
              Add
            </button>
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
                    <div className={styles.cardActionBtns}>
                      <button
                        className={styles.iconBtn}
                        onClick={() => handleOpenEditModal(item)}
                        title="Edit"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        className={styles.iconBtn}
                        onClick={() => handleDeleteAnnouncement(item._id)}
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={styles.quickActions}>
        <h2>Quick Actions</h2>
        <div className={styles.actionButtons}>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => router.push("/hod/attendance")}
          >
            <CheckCircle2 size={16} />
            Mark Attendance
          </button>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => router.push("/hod/attendance/view")}
          >
            <Calendar size={16} />
            View Attendance
          </button>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => router.push("/hod/attendance/report")}
          >
            <FileSpreadsheet size={16} />
            Attendance Report
          </button>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => router.push("/hod/marks")}
          >
            <ClipboardList size={16} />
            Marks
          </button>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => router.push("/hod/students")}
          >
            <UserPlus size={16} />
            Students
          </button>
        </div>
      </div>

      {/* Add / Edit Department Announcement Modal */}
      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{isEditMode ? "Edit Department Announcement" : "Create Department Announcement"}</h2>
              <button
                className={styles.iconBtn}
                aria-label="Close"
                onClick={() => setIsModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className={styles.formGroup}>
              <label>Title *</label>
              <input
                type="text"
                className={styles.modalInput}
                placeholder="Enter announcement title..."
                value={modalForm.title}
                onChange={(e) =>
                  setModalForm({ ...modalForm, title: e.target.value })
                }
              />
            </div>

            <div className={styles.formGroup}>
              <label>Priority</label>
              <select
                className={styles.modalSelect}
                value={modalForm.priority}
                onChange={(e) =>
                  setModalForm({ ...modalForm, priority: e.target.value })
                }
              >
                <option value="normal">Normal</option>
                <option value="important">Important</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Content / Message *</label>
              <textarea
                rows={4}
                placeholder="Type the announcement message for department staff and students..."
                value={modalForm.content}
                onChange={(e) =>
                  setModalForm({ ...modalForm, content: e.target.value })
                }
              />
            </div>

            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={modalForm.pinned}
                onChange={(e) =>
                  setModalForm({ ...modalForm, pinned: e.target.checked })
                }
              />
              Pin this announcement to top
            </label>

            <div className={styles.modalBtns}>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handleSaveAnnouncement}
              >
                {isEditMode ? "Save Changes" : "Post to Department"}
              </button>
              <button
                className={`${styles.btn} ${styles.btnGhost}`}
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}