"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
//--------------------------------------------------------------------------------------------------

export default function Admin() {
  const router = useRouter();

  const [students] = useState(1200);
  const [staff] = useState(85);
  const [pendingFees] = useState(250000);
  const [attendance] = useState(92);

  const [announcements, setAnnouncements] = useState([
    "Semester Exam starts on June 25",
    "AI & DS Symposium on July 10",
    "Placement Drive next week",
  ]);

  const [upcomingEvents, setUpcomingEvents] = useState([
    "Internal Exam - June 28",
    "Sports Day - July 05",
    "Placement Drive - July 12",
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editText, setEditText] = useState("");
  const [editType, setEditType] = useState("");
  const [editIndex, setEditIndex] = useState(null);

//--------------------------------------------------------------------------------------------------

  // Close whichever modal is open on Escape
  useEffect(() => {
    if (!isModalOpen && !isAdding) return;
    const handleKey = (e) => {
      if (e.key === "Escape") {
        setIsModalOpen(false);
        setIsAdding(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isModalOpen, isAdding]);

//--------------------------------------------------------------------------------------------------

  const typeLabel = editType === "announcement" ? "Announcement" : "Event";

  const openModal = (type, index, value) => {
    setEditType(type);
    setEditIndex(index);
    setEditText(value);
    setIsModalOpen(true);
  };

  const openAddModal = (type) => {
    setEditType(type);
    setEditText("");
    setIsAdding(true);
  };
//--------------------------------------------------------------------------------------------------


  const updateItem = () => {
    const value = editText.trim();
    if (!value) return;

    if (editType === "announcement") {
      const updated = [...announcements];
      updated[editIndex] = value;
      setAnnouncements(updated);
    }

    if (editType === "event") {
      const updated = [...upcomingEvents];
      updated[editIndex] = value;
      setUpcomingEvents(updated);
    }

    setIsModalOpen(false);
  };
//--------------------------------------------------------------------------------------------------


  const addNewItem = () => {
    const value = editText.trim();
    if (!value) return;

    if (editType === "announcement") {
      setAnnouncements([...announcements, value]);
    }

    if (editType === "event") {
      setUpcomingEvents([...upcomingEvents, value]);
    }

    setIsAdding(false);
  };
//--------------------------------------------------------------------------------------------------

  const deleteItem = () => {
    if (editType === "announcement") {
      setAnnouncements(announcements.filter((_, i) => i !== editIndex));
    }

    if (editType === "event") {
      setUpcomingEvents(upcomingEvents.filter((_, i) => i !== editIndex));
    }

    setIsModalOpen(false);
  };
//--------------------------------------------------------------------------------------------------

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

      <div className={styles.cards}>
        <div className={styles.card}>
          <div className={styles.cardTop}>
            <span className={styles.cardIcon}>
              <GraduationCap size={18} />
            </span>
            <h3>Total Students</h3>
          </div>
          <p>{students.toLocaleString("en-IN")}</p>
          <p className={styles.cardMeta}>Active enrollment</p>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTop}>
            <span className={styles.cardIcon}>
              <Users size={18} />
            </span>
            <h3>Total Staff</h3>
          </div>
          <p>{staff.toLocaleString("en-IN")}</p>
          <p className={styles.cardMeta}>Faculty & admin</p>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTop}>
            <span className={styles.cardIcon}>
              <IndianRupee size={18} />
            </span>
            <h3>Pending Fees</h3>
          </div>
          <p>₹{pendingFees.toLocaleString("en-IN")}</p>
          <p className={styles.cardMeta}>Due this term</p>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTop}>
            <span className={styles.cardIcon}>
              <CheckCircle2 size={18} />
            </span>
            <h3>Attendance</h3>
          </div>
          <p>{attendance}%</p>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${attendance}%` }}
            />
          </div>
        </div>
      </div>

      <div className={styles.contentGrid}>
        {/* Announcements */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>
              <Megaphone size={18} />
              Announcements
            </h2>
            <button
              className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
              onClick={() => openAddModal("announcement")}
            >
              <Plus size={14} />
              Add
            </button>
          </div>

          {announcements.length === 0 ? (
            <div className={styles.emptyState}>
              <Megaphone />
              <p>No announcements yet. Tap Add to create one.</p>
            </div>
          ) : (
            <ul>
              {announcements.map((item, index) => (
                <li key={index} className={styles.listItem}>
                  <span>{item}</span>
                  <button
                    className={styles.iconBtn}
                    aria-label={`Edit announcement: ${item}`}
                    onClick={() => openModal("announcement", index, item)}
                  >
                    <Pencil size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Upcoming Events */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>
              <CalendarDays size={18} />
              Upcoming Events
            </h2>
            <button
              className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
              onClick={() => openAddModal("event")}
            >
              <Plus size={14} />
              Add
            </button>
          </div>

          {upcomingEvents.length === 0 ? (
            <div className={styles.emptyState}>
              <CalendarDays />
              <p>No events scheduled. Tap Add to create one.</p>
            </div>
          ) : (
            <ul>
              {upcomingEvents.map((item, index) => (
                <li key={index} className={styles.listItem}>
                  <span>{item}</span>
                  <button
                    className={styles.iconBtn}
                    aria-label={`Edit event: ${item}`}
                    onClick={() => openModal("event", index, item)}
                  >
                    <Pencil size={14} />
                  </button>
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
            onClick={() => router.push("/admin/students")}
          >
            <UserPlus size={16} />
            Add Student
          </button>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => router.push("/admin/staff")}
          >
            <UserCog size={16} />
            Add Staff
          </button>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => router.push("/admin/fees")}
          >
            <Wallet size={16} />
            Collect Fees
          </button>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => router.push("/admin/marks")}
          >
            <ClipboardList size={16} />
            Add Marks
          </button>
        </div>
      </div>

      {/* Edit modal */}
      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Edit {typeLabel}</h2>
              <button
                className={styles.iconBtn}
                aria-label="Close"
                onClick={() => setIsModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <textarea
              autoFocus
              aria-label={`Edit ${typeLabel} text`}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
            />

            <div className={styles.modalBtns}>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={updateItem}>
                Update
              </button>
              <button className={`${styles.btn} ${styles.btnDanger}`} onClick={deleteItem}>
                <Trash2 size={14} />
                Delete
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

      {/* Add modal */}
      {isAdding && (
        <div className={styles.modalOverlay} onClick={() => setIsAdding(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Add {typeLabel}</h2>
              <button
                className={styles.iconBtn}
                aria-label="Close"
                onClick={() => setIsAdding(false)}
              >
                <X size={16} />
              </button>
            </div>

            <textarea
              autoFocus
              aria-label={`New ${typeLabel} text`}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
            />

            <div className={styles.modalBtns}>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={addNewItem}>
                Add
              </button>
              <button
                className={`${styles.btn} ${styles.btnGhost}`}
                onClick={() => setIsAdding(false)}
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