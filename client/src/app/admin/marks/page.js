"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import styles from "./page.module.css";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

function handleUnauthorized(err) {
  if (err.response?.data?.islogout === true || err.response?.status === 401) {
    window.location.href = "/";
    return true;
  }
  return false;
}

function currentAcademicYears(currentVal) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const startYear = now.getMonth() >= 5 ? currentYear : currentYear - 1;
  const years = [];
  for (let i = startYear - 5; i <= startYear + 5; i++) {
    years.push(`${i}-${i + 1}`);
  }
  if (currentVal && !years.includes(currentVal)) {
    years.push(currentVal);
    years.sort();
  }
  return years;
}

function getDefaultAcademicYear() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const startYear = now.getMonth() >= 5 ? currentYear : currentYear - 1;
  return `${startYear}-${startYear + 1}`;
}

function getCategoryLabel(cat) {
  if (cat === "T") return "Theory";
  if (cat === "L") return "Practical";
  if (cat === "T/L" || cat === "TL") return "Theory + Practical";
  return cat || "Theory";
}

export default function StaffMarksViewPage() {
  const [departments, setDepartments] = useState([]);
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const [semester, setSemester] = useState("");
  const [academicYear, setAcademicYear] = useState(getDefaultAcademicYear());

  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState("");

  const [marksData, setMarksData] = useState({
    marks: [],
    category: "",
    exams: [],
    allowedByExam: {},
  });
  const [groupedRows, setGroupedRows] = useState([]);

  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingMarks, setLoadingMarks] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const pdfRef = useRef(null);

  // Edit Modal State
  const [editTarget, setEditTarget] = useState(null);
  const [editAssignment, setEditAssignment] = useState("");
  const [editWrittenExam, setEditWrittenExam] = useState("");
  const [editPractical, setEditPractical] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Add Students Modal State
  const [showAddModal, setShowAddModal] = useState(null);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [selectedAvailable, setSelectedAvailable] = useState(new Set());
  const [addingStudents, setAddingStudents] = useState(false);

  // Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingMarks, setDeletingMarks] = useState(false);

  // Publish Modal State
  const [publishTarget, setPublishTarget] = useState(null);
  const [publishing, setPublishing] = useState(false);

  // Notify Modal State
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifying, setNotifying] = useState(false);

  const handlePublishMarks = async (exam) => {
    try {
      setPublishing(true);
      setError("");
      setSuccess("");

      const res = await api.post("/api/mark/publish", {
        department,
        year,
        semester,
        academicYear,
        subjectId,
        internalExam: exam || undefined,
      });

      setSuccess(res.data?.message || "Internal marks published successfully! Marks are now visible to students and editing is locked.");
      setPublishTarget(null);
      await refreshMarks();
    } catch (err) {
      if (handleUnauthorized(err)) return;
      setError(err.response?.data?.message || err.message || "Failed to publish marks.");
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublishMarks = async (exam) => {
    if (!window.confirm(`Are you sure you want to unpublish Internal Exam ${exam} marks? Students will no longer see them and faculty can resume editing.`)) return;
    try {
      setPublishing(true);
      setError("");
      setSuccess("");

      const res = await api.post("/api/mark/unpublish", {
        department,
        year,
        semester,
        academicYear,
        subjectId,
        internalExam: exam,
      });

      setSuccess(res.data?.message || "Internal marks unpublished successfully. Editing unlocked.");
      await refreshMarks();
    } catch (err) {
      if (handleUnauthorized(err)) return;
      setError(err.response?.data?.message || err.message || "Failed to unpublish marks.");
    } finally {
      setPublishing(false);
    }
  };

  const handleNotifyMarks = async () => {
    try {
      setNotifying(true);
      setError("");
      setSuccess("");

      const activeSubject = subjects.find((s) => String(s._id) === String(subjectId));
      const examNameStr =
        marksData.exams && marksData.exams.length > 0
          ? `Internal Assessment ${marksData.exams.join(" & ")}`
          : "Internal Assessment";

      // If a specific subject is loaded, also explicitly trigger publish endpoint to ensure marksData is updated
      if (subjectId) {
        try {
          await api.post("/api/mark/publish", {
            department,
            year,
            semester,
            academicYear,
            subjectId,
          });
        } catch (e) {
          // continue with notification broadcast
        }
      }

      const res = await api.post("/api/notifications/notify-marks", {
        department,
        year,
        semester,
        subjectCode: activeSubject?.subjectCode || "",
        subjectName: activeSubject?.subjectName || "",
        examName: examNameStr,
      });

      setSuccess(
        res.data?.message ||
          "Internal marks published and broadcast notifications sent successfully to students, staff, and administrators!"
      );
      setShowNotifyModal(false);
      await refreshMarks();
    } catch (err) {
      if (handleUnauthorized(err)) return;
      setError(err.response?.data?.message || err.message || "Failed to publish marks and broadcast notifications.");
    } finally {
      setNotifying(false);
    }
  };

  const yearOptions = [1, 2, 3, 4];
  const semesterOptions = [1, 2, 3, 4, 5, 6, 7, 8];
  const academicYearOptions = currentAcademicYears();

  useEffect(() => {
    let mounted = true;

    async function loadDepartments() {
      try {
        const res = await api.get("/api/admin/department/all");
        const list = Array.isArray(res.data)
          ? res.data
          : res.data?.data || res.data?.departments || [];
        if (mounted) setDepartments(list);
      } catch (err) {
        if (handleUnauthorized(err)) return;
        if (mounted) setError(err.response?.data?.message || err.message);
      }
    }

    loadDepartments();
    return () => {
      mounted = false;
    };
  }, []);

  // Auto-dismiss banners
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 5000);
      return () => clearTimeout(t);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(""), 6000);
      return () => clearTimeout(t);
    }
  }, [error]);

  const subject = useMemo(() => {
    return subjects.find((s) => String(s._id) === String(subjectId)) || null;
  }, [subjects, subjectId]);

  function groupMarks(marks) {
    const map = {};

    marks.forEach((mark) => {
      const sid = mark.student?._id || mark.student;
      if (!sid) return;

      if (!map[sid]) {
        map[sid] = {
          student: mark.student || { _id: sid },
          exams: {},
        };
      }

      map[sid].exams[mark.internalExam] = mark;
    });

    return Object.values(map).sort((a, b) =>
      String(a.student?.register_no || a.student?.student_id || "").localeCompare(
        String(b.student?.register_no || b.student?.student_id || "")
      )
    );
  }

  async function handleSearchSubjects() {
    setError("");
    setSuccess("");
    setSubjectId("");
    setMarksData({ marks: [], category: "", exams: [], allowedByExam: {} });
    setGroupedRows([]);

    if (!department || !year || !semester || !academicYear) {
      setError("Please select department, year, semester and academic year.");
      return;
    }

    try {
      setLoadingSubjects(true);
      const params = new URLSearchParams({
        department,
        year,
        semester,
        academicYear,
        mode: "view",
      });

      const res = await api.get(`/api/mark/subjects?${params.toString()}`);
      const data = res.data?.data ?? res.data;
      const list = Array.isArray(data) ? data : [];
      setSubjects(list);
      if (list.length === 0) {
        setSuccess("No subjects found assigned to you for the selected filters.");
      }
    } catch (err) {
      if (handleUnauthorized(err)) return;
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoadingSubjects(false);
    }
  }

  async function handleViewMarks() {
    setError("");
    setSuccess("");

    if (!subjectId) {
      setError("Please select a subject.");
      return;
    }

    try {
      setLoadingMarks(true);
      const params = new URLSearchParams({
        department,
        year,
        semester,
        academicYear,
        subjectId,
      });

      const res = await api.get(`/api/mark?${params.toString()}`);
      const data = res.data?.data ?? res.data;
      setMarksData(data);
      setGroupedRows(groupMarks(data.marks || []));
      if (!data.marks || data.marks.length === 0) {
        setSuccess("No internal marks recorded yet for this subject.");
      }
    } catch (err) {
      if (handleUnauthorized(err)) return;
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoadingMarks(false);
    }
  }

  async function refreshMarks() {
    if (!subjectId) return;
    try {
      setLoadingMarks(true);
      const params = new URLSearchParams({
        department,
        year,
        semester,
        academicYear,
        subjectId,
      });

      const res = await api.get(`/api/mark?${params.toString()}`);
      const data = res.data?.data ?? res.data;
      setMarksData(data);
      setGroupedRows(groupMarks(data.marks || []));
    } catch (err) {
      if (handleUnauthorized(err)) return;
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoadingMarks(false);
    }
  }

  // ---------- PDF Export Handler ----------
  const handleDownloadPdf = async () => {
    const element = pdfRef.current;
    if (!element) return;

    const images = element.querySelectorAll("img");
    await Promise.all(
      Array.from(images).map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      })
    );

    const originalOverflow = element.style.overflow;
    const originalMaxHeight = element.style.maxHeight;
    element.style.overflow = "visible";
    element.style.maxHeight = "none";

    try {
      setPdfGenerating(true);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        scrollX: 0,
        scrollY: 0,
        ignoreElements: (el) =>
          el.getAttribute("data-html2canvas-ignore") === "true" ||
          el.classList.contains(styles.noPrint),
      });

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const ratio = pdfWidth / canvas.width;
      const pageHeightInCanvasPx = pdfHeight / ratio;

      const generatedAtStr = new Date().toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });

      const footerLeftText = `Report Generated on: ${generatedAtStr}`;
      const footerRightText = "Generated via NICETech ERP System";
      const footerFontSize = 7.5;
      const footerMargin = 7;

      let renderedHeight = 0;
      let pageNum = 0;

      while (renderedHeight < canvas.height) {
        const availableHeight = pdfHeight - footerMargin - 2;
        const sliceHeight = Math.min(pageHeightInCanvasPx, canvas.height - renderedHeight);
        const renderHeight = Math.min(sliceHeight, availableHeight / ratio);

        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = renderHeight;
        const ctx = pageCanvas.getContext("2d");
        ctx.drawImage(
          canvas,
          0,
          renderedHeight,
          canvas.width,
          renderHeight,
          0,
          0,
          canvas.width,
          renderHeight
        );

        const imgData = pageCanvas.toDataURL("image/png");

        if (pageNum > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, renderHeight * ratio);

        pdf.setFontSize(footerFontSize);
        pdf.setTextColor(110, 110, 110);
        pdf.text(footerLeftText, 14, pdfHeight - footerMargin);
        const rightWidth = pdf.getTextWidth(footerRightText);
        pdf.text(footerRightText, pdfWidth - rightWidth - 14, pdfHeight - footerMargin);

        renderedHeight += renderHeight;
        pageNum++;
      }

      const subCode = subject?.subjectCode || subject?.subjectName || "Subject";
      pdf.save(`Internal_Mark_Report_${subCode}.pdf`);
    } catch (err) {
      console.error("PDF generation error:", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      element.style.overflow = originalOverflow;
      element.style.maxHeight = originalMaxHeight;
      setPdfGenerating(false);
    }
  };

  function openEdit(exam, row) {
    const record = row.exams[exam];
    if (!record) return;

    setEditTarget({ exam, record });
    setEditAssignment(record.theory?.assignment ?? "");
    setEditWrittenExam(record.theory?.writtenExam ?? "");
    setEditPractical(record.practical?.mark ?? "");
  }

  async function handleEditSave() {
    if (!editTarget) return;

    const allowed = marksData.allowedByExam?.[editTarget.exam] || [];
    const body = {};

    if (allowed.includes("theory")) {
      const assign = editAssignment === "" ? 0 : Number(editAssignment);
      const written = editWrittenExam === "" ? 0 : Number(editWrittenExam);

      if (isNaN(assign) || assign < 0 || assign > 100) {
        setError("Assignment marks must be between 0 and 100.");
        return;
      }
      if (isNaN(written) || written < 0 || written > 100) {
        setError("Written Exam marks must be between 0 and 100.");
        return;
      }
      if (assign + written > 100) {
        setError("Internal theory mark cannot exceed 100.");
        return;
      }

      body.assignment = assign;
      body.writtenExam = written;
    }

    if (allowed.includes("practical")) {
      const practical = editPractical === "" ? 0 : Number(editPractical);
      if (isNaN(practical) || practical < 0 || practical > 100) {
        setError("Practical mark must be between 0 and 100.");
        return;
      }
      body.practical = practical;
    }

    try {
      setSavingEdit(true);
      await api.put(`/api/mark/${editTarget.record._id}`, body);

      setSuccess("Mark updated successfully.");
      setEditTarget(null);
      await refreshMarks();
    } catch (err) {
      if (handleUnauthorized(err)) return;
      setError(err.response?.data?.message || err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleOpenAddStudents(exam) {
    if (!subjectId) return;

    try {
      const params = new URLSearchParams({
        department,
        year,
        semester,
        academicYear,
        subjectId,
        internalExam: String(exam),
      });

      const res = await api.get(`/api/mark/available-students?${params.toString()}`);
      const data = res.data?.data ?? res.data;
      const list = Array.isArray(data) ? data : [];
      setAvailableStudents(list);
      setSelectedAvailable(new Set());
      setShowAddModal({ exam });
    } catch (err) {
      if (handleUnauthorized(err)) return;
      setError(err.response?.data?.message || err.message);
    }
  }

  function toggleAvailableStudent(studentId) {
    setSelectedAvailable((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function toggleSelectAllAvailable() {
    if (selectedAvailable.size === availableStudents.length) {
      setSelectedAvailable(new Set());
    } else {
      setSelectedAvailable(new Set(availableStudents.map((s) => s._id)));
    }
  }

  async function handleAddStudents() {
    if (!showAddModal) return;
    if (selectedAvailable.size === 0) {
      setError("Select at least one student to add.");
      return;
    }

    try {
      setAddingStudents(true);
      const res = await api.post("/api/mark/add-students", {
        department,
        year,
        semester,
        academicYear,
        subjectId,
        internalExam: showAddModal.exam,
        studentIds: Array.from(selectedAvailable),
      });

      setSuccess(
        `Students added successfully. ${res.data?.data?.addedCount ?? selectedAvailable.size} records initialized.`
      );
      setShowAddModal(null);
      await refreshMarks();
    } catch (err) {
      if (handleUnauthorized(err)) return;
      setError(err.response?.data?.message || err.message);
    } finally {
      setAddingStudents(false);
    }
  }

  function openDeleteConfirm(exam) {
    setDeleteTarget({ exam });
  }

  async function handleDeleteMarks() {
    if (!deleteTarget) return;

    const params = new URLSearchParams({
      department,
      year,
      semester,
      academicYear,
      subjectId,
      internalExam: String(deleteTarget.exam),
    });

    try {
      setDeletingMarks(true);
      const res = await api.delete(`/api/mark?${params.toString()}`);
      const data = res.data?.data ?? res.data;

      setSuccess(
        `Marks deleted successfully. ${data.deletedCount ?? 0} records removed.`
      );
      setDeleteTarget(null);
      await refreshMarks();
    } catch (err) {
      if (handleUnauthorized(err)) return;
      setError(err.response?.data?.message || err.message);
    } finally {
      setDeletingMarks(false);
    }
  }

  function renderEditModal() {
    if (!editTarget) return null;

    const allowed = marksData.allowedByExam?.[editTarget.exam] || [];
    const totalTheory = (Number(editAssignment) || 0) + (Number(editWrittenExam) || 0);

    return (
      <div className={styles.modalOverlay}>
        <div className={styles.modal}>
          <div className={styles.modalHeader}>
            <h2>Edit Internal Exam {editTarget.exam} Marks</h2>
            <button
              className={styles.closeBtn}
              onClick={() => setEditTarget(null)}
            >
              ×
            </button>
          </div>

          <div className={styles.modalBody}>
            <p className={styles.modalStudentInfo}>
              <strong>Student:</strong>{" "}
              {editTarget.record.student?.first_name}{" "}
              {editTarget.record.student?.last_name}{" "}
              ({editTarget.record.student?.register_no || editTarget.record.student?.student_id})
            </p>

            {allowed.includes("theory") && (
              <>
                <label className={styles.modalField}>
                  Assignment (/100)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editAssignment}
                    onChange={(e) => setEditAssignment(e.target.value)}
                  />
                </label>
                <label className={styles.modalField}>
                  Written Exam (/100)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editWrittenExam}
                    onChange={(e) => setEditWrittenExam(e.target.value)}
                  />
                </label>
                <p className={totalTheory > 100 ? styles.modalTotalError : styles.modalTotalInfo}>
                  Theory Total: {totalTheory} / 100 {totalTheory > 100 ? "(Exceeds 100)" : ""}
                </p>
              </>
            )}

            {allowed.includes("practical") && (
              <label className={styles.modalField}>
                Practical (/100)
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={editPractical}
                  onChange={(e) => setEditPractical(e.target.value)}
                />
              </label>
            )}
          </div>

          <div className={styles.modalActions}>
            <button
              className={styles.btnGhost}
              onClick={() => setEditTarget(null)}
            >
              Cancel
            </button>
            <button
              className={styles.btnPrimary}
              onClick={handleEditSave}
              disabled={savingEdit || totalTheory > 100}
            >
              {savingEdit ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderAddStudentsModal() {
    if (!showAddModal) return null;

    return (
      <div className={styles.modalOverlay}>
        <div className={styles.modal}>
          <div className={styles.modalHeader}>
            <h2>Add Students - Internal Exam {showAddModal.exam}</h2>
            <button
              className={styles.closeBtn}
              onClick={() => setShowAddModal(null)}
            >
              ×
            </button>
          </div>

          <div className={styles.modalBody}>
            {availableStudents.length === 0 ? (
              <p className={styles.muted}>No unadded students found for this subject and exam.</p>
            ) : (
              <>
                <div className={styles.addModalHeaderRow}>
                  <label className={styles.selectAllLabel}>
                    <input
                      type="checkbox"
                      checked={
                        selectedAvailable.size === availableStudents.length &&
                        availableStudents.length > 0
                      }
                      onChange={toggleSelectAllAvailable}
                    />
                    Select All
                  </label>
                  <span className={styles.muted}>
                    {selectedAvailable.size} of {availableStudents.length} selected
                  </span>
                </div>
                <div className={styles.studentAddList}>
                  {availableStudents.map((stud) => (
                    <label key={stud._id} className={styles.studentAddItem}>
                      <input
                        type="checkbox"
                        checked={selectedAvailable.has(stud._id)}
                        onChange={() => toggleAvailableStudent(stud._id)}
                      />
                      <span className={styles.regNoCol}>
                        {stud.register_no || stud.student_id}
                      </span>
                      <span>
                        {stud.first_name} {stud.last_name}
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className={styles.modalActions}>
            <button
              className={styles.btnGhost}
              onClick={() => setShowAddModal(null)}
            >
              Cancel
            </button>
            <button
              className={styles.btnPrimary}
              onClick={handleAddStudents}
              disabled={selectedAvailable.size === 0 || addingStudents}
            >
              {addingStudents ? "Adding..." : `Add ${selectedAvailable.size} Student(s)`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderDeleteModal() {
    if (!deleteTarget) return null;

    const exam = deleteTarget.exam;
    const isPublished = deleteTarget.isPublished;
    const count = groupedRows.filter((row) => row.exams[exam]).length;

    return (
      <div className={styles.modalOverlay}>
        <div className={styles.modal}>
          <div className={styles.modalHeader}>
            <h2 style={{ color: isPublished ? "#b91c1c" : "inherit" }}>
              {isPublished ? "⚠️ Delete Published Mark Entry" : "Delete Complete Mark Entry"}
            </h2>
            <button
              className={styles.closeBtn}
              onClick={() => setDeleteTarget(null)}
            >
              ×
            </button>
          </div>

          <div className={styles.modalBody}>
            {isPublished && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  padding: "12px 14px",
                  color: "#991b1b",
                  marginBottom: "14px",
                  fontSize: "13.5px",
                  lineHeight: "1.5",
                  fontWeight: 600,
                }}
              >
                ⚠️ <strong>CRITICAL WARNING:</strong> Internal Exam {exam} marks are currently <strong>PUBLISHED</strong>.
                Deleting them will permanently remove all published marks from student and faculty records.
              </div>
            )}

            <p className={styles.deleteText}>
              Delete all Internal Exam {exam} marks?
            </p>
            <p className={styles.deleteDetails}>
              {department} • Year {year} • Semester {semester} • {academicYear}{" "}
              • {subject?.subjectName}
            </p>
            <p className={styles.deleteCount}>
              {count} student mark record{count !== 1 ? "s" : ""} will be
              deleted.
            </p>
          </div>

          <div className={styles.modalActions}>
            <button
              className={styles.btnGhost}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </button>
            <button
              className={styles.btnDanger}
              onClick={handleDeleteMarks}
              disabled={deletingMarks}
            >
              {deletingMarks ? "Deleting..." : isPublished ? "Confirm Delete Published Marks" : "Delete Marks"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderPublishModal() {
    if (!publishTarget) return null;
    const exam = publishTarget.exam;

    return (
      <div className={styles.modalOverlay}>
        <div className={styles.modal} style={{ maxWidth: "520px" }}>
          <div className={styles.modalHeader}>
            <h2>📢 Publish Internal Exam {exam} Marks</h2>
            <button
              className={styles.closeBtn}
              onClick={() => setPublishTarget(null)}
            >
              ×
            </button>
          </div>

          <div className={styles.modalBody} style={{ fontSize: "14px", lineHeight: "1.6", color: "#334155" }}>
            <p style={{ margin: "0 0 14px 0" }}>
              Are you sure you want to officially publish <strong>Internal Exam {exam}</strong> marks for <strong>{subject?.subjectCode} - {subject?.subjectName}</strong> ({department}, Year {year}, Sem {semester})?
            </p>

            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "12px 14px", marginBottom: "14px", color: "#166534", fontSize: "13px" }}>
              ✓ <strong>Student Visibility:</strong> All enrolled students will immediately be able to view their marks in the Student Portal.<br />
              🔒 <strong>Edit Lock:</strong> Entered marks will become locked and cannot be edited by faculty or HOD.<br />
              🛡️ <strong>Admin Security:</strong> Only an Administrator can delete published marks after confirmation.
            </div>
          </div>

          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.btnGhost}
              onClick={() => setPublishTarget(null)}
              disabled={publishing}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.btnPublish}
              onClick={() => handlePublishMarks(exam)}
              disabled={publishing}
            >
              {publishing ? "Publishing..." : `Confirm & Publish Internal ${exam}`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderMarkReportBox() {
    return renderTable();
  }

  function renderTable() {
    const { category, exams = [] } = marksData;

    if (!category || groupedRows.length === 0) return null;

    const hasI1 = exams.includes(1);
    const hasI2 = exams.includes(2);
    const canEdit = marksData.canEdit === true;
    const canDelete = marksData.canDelete === true;

    return (
      <>
        {/* Top bar with exam badges, publish actions, and download button */}
        <div className={styles.topActionBar}>
          <div className={styles.examBadges}>
            {exams.map((exam) => {
              const isPub = marksData.isPublishedByExam?.[exam] === true;
              return (
                <div key={exam} style={{ display: "inline-flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span className={isPub ? styles.badgePublished : styles.badgeDraft}>
                    {isPub ? "🟢" : "🟡"} Internal Exam {exam} ({isPub ? "Published" : "Draft"})
                  </span>
                  {!isPub ? (
                    <button
                      className={styles.btnPublish}
                      onClick={() => setPublishTarget({ exam })}
                      title={`Publish Internal Exam ${exam} marks to students and lock editing`}
                    >
                      📢 Publish I{exam}
                    </button>
                  ) : (
                    <button
                      className={styles.btnUnpublish}
                      onClick={() => handleUnpublishMarks(exam)}
                      title={`Unpublish Internal Exam ${exam} marks`}
                    >
                      Unpublish I{exam}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <button
            className={styles.pdfBtn}
            onClick={handleDownloadPdf}
            disabled={pdfGenerating || groupedRows.length === 0}
          >
            {pdfGenerating ? "Generating PDF..." : "📥 Download PDF Report"}
          </button>
        </div>

        {/* Dedicated Report Box for On-screen & Single-box PDF Export */}
        <div ref={pdfRef} className={styles.reportContainer}>
          {/* College Logo Top Bar */}
          <div className={styles.reportHeader}>
            <img
              src="/nilogo.png"
              alt="College Logo"
              className={styles.collegeLogo}
              crossOrigin="anonymous"
            />
          </div>

          {/* Report Title & Metadata block */}
          <div className={styles.reportMetaSection}>
            <h2 className={styles.reportTitle}>Internal Mark Report</h2>
            <div className={styles.reportMetaGrid}>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Sub Name </span>
                <span className={styles.metaValue}>{subject?.subjectName || "—"}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Sub Code :</span>
                <span className={styles.metaValue}>{subject?.subjectCode || "—"}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Category :</span>
                <span className={styles.metaValue}>
                  {getCategoryLabel(marksData.category || subject?.Category)}
                </span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Department :</span>
                <span className={styles.metaValue}>{department || "—"}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Year / Sem :</span>
                <span className={styles.metaValue}>
                  {year} / {semester}
                </span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Academic Year :</span>
                <span className={styles.metaValue}>{academicYear || "—"}</span>
              </div>

            </div>
          </div>

          {/* Marks Table */}
          <div className={styles.tableWrap}>
            {/* 1. Theory Subject Table */}
            {category === "T" && (
              <table className={styles.markTable}>
                <thead>
                  {/* Tier 1 Header */}
                  <tr>
                    <th rowSpan={2} className={styles.thCenter} style={{ width: "130px" }}>
                      Reg No
                    </th>
                    <th rowSpan={2} className={styles.thLeft}>
                      Student Name
                    </th>
                    {hasI1 && (
                      <th colSpan={3} className={styles.thGroup}>
                        Internal I
                      </th>
                    )}
                    {hasI2 && (
                      <th colSpan={3} className={styles.thGroup}>
                        Internal II
                      </th>
                    )}
                    {canEdit && (
                      <th
                        rowSpan={2}
                        className={`${styles.thCenter} ${styles.noPrint}`}
                        data-html2canvas-ignore="true"
                      >
                        Actions
                      </th>
                    )}
                  </tr>
                  {/* Tier 2 Header */}
                  <tr>
                    {hasI1 && (
                      <>
                        <th className={styles.thSub}>Assignment</th>
                        <th className={styles.thSub}>Written</th>
                        <th className={styles.thSub}>Total</th>
                      </>
                    )}
                    {hasI2 && (
                      <>
                        <th className={styles.thSub}>Assignment</th>
                        <th className={styles.thSub}>Written</th>
                        <th className={styles.thSub}>Total</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {groupedRows.map((row) => (
                    <tr key={row.student?._id || row.student}>
                      <td>{row.student?.register_no || row.student?.student_id}</td>
                      <td className={styles.tdLeft}>
                        {row.student?.first_name} {row.student?.last_name}
                      </td>

                      {hasI1 && (
                        <>
                          <td>{row.exams[1]?.theory?.assignment ?? "-"}</td>
                          <td>{row.exams[1]?.theory?.writtenExam ?? "-"}</td>
                          <td className={styles.totalCell}>
                            {row.exams[1]?.theory?.total ?? "-"}
                          </td>
                        </>
                      )}

                      {hasI2 && (
                        <>
                          <td>{row.exams[2]?.theory?.assignment ?? "-"}</td>
                          <td>{row.exams[2]?.theory?.writtenExam ?? "-"}</td>
                          <td className={styles.totalCell}>
                            {row.exams[2]?.theory?.total ?? "-"}
                          </td>
                        </>
                      )}

                      {canEdit && (
                        <td
                          className={`${styles.actionsCell} ${styles.noPrint}`}
                          data-html2canvas-ignore="true"
                        >
                          {exams.map((exam) => {
                            const isPub = marksData.isPublishedByExam?.[exam] === true;
                            if (isPub) {
                              return (
                                <span
                                  key={exam}
                                  className={styles.lockedTag}
                                  title="Marks are published to students. Editing is locked."
                                >
                                  🔒 I{exam} Locked
                                </span>
                              );
                            }
                            return (
                              <button
                                key={exam}
                                className={styles.btnSm}
                                onClick={() => openEdit(exam, row)}
                                disabled={!row.exams[exam]}
                              >
                                Edit I{exam}
                              </button>
                            );
                          })}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 2. Practical / Lab Subject Table */}
            {category === "L" && (
              <table className={styles.markTable}>
                <thead>
                  {/* Tier 1 Header */}
                  <tr>
                    <th rowSpan={2} className={styles.thCenter} style={{ width: "130px" }}>
                      Reg No
                    </th>
                    <th rowSpan={2} className={styles.thLeft}>
                      Student Name
                    </th>
                    {hasI1 && (
                      <th className={styles.thGroup}>
                        Internal I
                      </th>
                    )}
                    {hasI2 && (
                      <th className={styles.thGroup}>
                        Internal II
                      </th>
                    )}
                    {canEdit && (
                      <th
                        rowSpan={2}
                        className={`${styles.thCenter} ${styles.noPrint}`}
                        data-html2canvas-ignore="true"
                      >
                        Actions
                      </th>
                    )}
                  </tr>
                  {/* Tier 2 Header */}
                  <tr>
                    {hasI1 && <th className={styles.thSub}>Practical (/100)</th>}
                    {hasI2 && <th className={styles.thSub}>Practical (/100)</th>}
                  </tr>
                </thead>
                <tbody>
                  {groupedRows.map((row) => (
                    <tr key={row.student?._id || row.student}>
                      <td>{row.student?.register_no || row.student?.student_id}</td>
                      <td className={styles.tdLeft}>
                        {row.student?.first_name} {row.student?.last_name}
                      </td>

                      {hasI1 && (
                        <td className={styles.totalCell}>
                          {row.exams[1]?.practical?.mark ?? "-"}
                        </td>
                      )}
                      {hasI2 && (
                        <td className={styles.totalCell}>
                          {row.exams[2]?.practical?.mark ?? "-"}
                        </td>
                      )}

                      {canEdit && (
                        <td
                          className={`${styles.actionsCell} ${styles.noPrint}`}
                          data-html2canvas-ignore="true"
                        >
                          {exams.map((exam) => {
                            const isPub = marksData.isPublishedByExam?.[exam] === true;
                            if (isPub) {
                              return (
                                <span
                                  key={exam}
                                  className={styles.lockedTag}
                                  title="Marks are published to students. Editing is locked."
                                >
                                  🔒 I{exam} Locked
                                </span>
                              );
                            }
                            return (
                              <button
                                key={exam}
                                className={styles.btnSm}
                                onClick={() => openEdit(exam, row)}
                                disabled={!row.exams[exam]}
                              >
                                Edit I{exam}
                              </button>
                            );
                          })}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 3. Theory + Practical Subject Table */}
            {(category === "T/L" || category === "TL") && (
              <table className={styles.markTable}>
                <thead>
                  {/* Tier 1 Header */}
                  <tr>
                    <th rowSpan={2} className={styles.thCenter} style={{ width: "130px" }}>
                      Reg No
                    </th>
                    <th rowSpan={2} className={styles.thLeft}>
                      Student Name
                    </th>
                    {hasI1 && (
                      <th colSpan={4} className={styles.thGroup}>
                        Internal I
                      </th>
                    )}
                    {hasI2 && (
                      <th colSpan={4} className={styles.thGroup}>
                        Internal II
                      </th>
                    )}
                    {canEdit && (
                      <th
                        rowSpan={2}
                        className={`${styles.thCenter} ${styles.noPrint}`}
                        data-html2canvas-ignore="true"
                      >
                        Actions
                      </th>
                    )}
                  </tr>
                  {/* Tier 2 Header */}
                  <tr>
                    {hasI1 && (
                      <>
                        <th className={styles.thSub}>Assignment</th>
                        <th className={styles.thSub}>Written</th>
                        <th className={styles.thSub}>Theory Total</th>
                        <th className={styles.thSub}>Practical</th>
                      </>
                    )}
                    {hasI2 && (
                      <>
                        <th className={styles.thSub}>Assignment</th>
                        <th className={styles.thSub}>Written</th>
                        <th className={styles.thSub}>Theory Total</th>
                        <th className={styles.thSub}>Practical</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {groupedRows.map((row) => (
                    <tr key={row.student?._id || row.student}>
                      <td>{row.student?.register_no || row.student?.student_id}</td>
                      <td className={styles.tdLeft}>
                        {row.student?.first_name} {row.student?.last_name}
                      </td>

                      {hasI1 && (
                        <>
                          <td>{row.exams[1]?.theory?.assignment ?? "-"}</td>
                          <td>{row.exams[1]?.theory?.writtenExam ?? "-"}</td>
                          <td className={styles.totalCell}>
                            {row.exams[1]?.theory?.total ?? "-"}
                          </td>
                          <td className={styles.totalCell}>
                            {row.exams[1]?.practical?.mark ?? "-"}
                          </td>
                        </>
                      )}

                      {hasI2 && (
                        <>
                          <td>{row.exams[2]?.theory?.assignment ?? "-"}</td>
                          <td>{row.exams[2]?.theory?.writtenExam ?? "-"}</td>
                          <td className={styles.totalCell}>
                            {row.exams[2]?.theory?.total ?? "-"}
                          </td>
                          <td className={styles.totalCell}>
                            {row.exams[2]?.practical?.mark ?? "-"}
                          </td>
                        </>
                      )}

                      {canEdit && (
                        <td
                          className={`${styles.actionsCell} ${styles.noPrint}`}
                          data-html2canvas-ignore="true"
                        >
                          {exams.map((exam) => {
                            const isPub = marksData.isPublishedByExam?.[exam] === true;
                            if (isPub) {
                              return (
                                <span
                                  key={exam}
                                  className={styles.lockedTag}
                                  title="Marks are published to students. Editing is locked."
                                >
                                  🔒 I{exam} Locked
                                </span>
                              );
                            }
                            return (
                              <button
                                key={exam}
                                className={styles.btnSm}
                                onClick={() => openEdit(exam, row)}
                                disabled={!row.exams[exam]}
                              >
                                Edit I{exam}
                              </button>
                            );
                          })}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Bottom Interactive Actions (Ignored in PDF) */}
          {(canEdit || canDelete) && (
            <div
              className={`${styles.tableActions} ${styles.noPrint}`}
              data-html2canvas-ignore="true"
            >
              {exams.map((exam) => {
                const isPub = marksData.isPublishedByExam?.[exam] === true;
                return (
                  <div key={exam} className={styles.examActionGroup}>
                    {canEdit && !isPub && (
                      <button
                        className={styles.btnGold}
                        onClick={() => handleOpenAddStudents(exam)}
                      >
                        + Add Students (I{exam})
                      </button>
                    )}
                    {isPub && (
                      <span className={styles.lockedTag}>
                        🔒 Internal {exam} Published (Editing Locked)
                      </span>
                    )}
                    {canDelete && (
                      <button
                        className={styles.btnDanger}
                        onClick={() => openDeleteConfirm(exam)}
                      >
                        {isPub ? `Delete Published I${exam}` : `Delete Internal ${exam}`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </>
    );
  }

  function renderNotifyModal() {
    if (!showNotifyModal) return null;
    const activeSubject = subjects.find((s) => String(s._id) === String(subjectId));
    const targetDept = department || "All Departments (Campus-wide)";
    const targetYear = year ? `Year ${year}` : "All Years";
    const targetSem = semester ? `Semester ${semester}` : "All Semesters";
    const targetSubjectStr = activeSubject
      ? `${activeSubject.subjectCode} — ${activeSubject.subjectName}`
      : "All Entered Subjects in Scope";

    return (
      <div
        className={styles.modalOverlay}
        onClick={() => !notifying && setShowNotifyModal(false)}
      >
        <div
          className={styles.modal}
          style={{ maxWidth: "560px" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.modalHeader}>
            <h2 style={{ fontSize: "19px", color: "#0b1d3a", margin: 0 }}>
              📢 Publish Internal Marks & Send Notifications
            </h2>
            <button
              className={styles.modalClose}
              onClick={() => !notifying && setShowNotifyModal(false)}
            >
              ×
            </button>
          </div>

          <div className={styles.modalBody} style={{ fontSize: "14px", lineHeight: "1.6", color: "#334155" }}>
            <p style={{ margin: "0 0 14px 0" }}>
              Publish all internal marks currently in draft and broadcast instant notifications to students, staff, and administrators:
            </p>

            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px", marginBottom: "14px" }}>
              <div style={{ marginBottom: "6px" }}>
                <strong>Department Scope:</strong> <span style={{ color: "#2563eb", fontWeight: 700 }}>{targetDept}</span>
              </div>
              <div style={{ marginBottom: "6px" }}>
                <strong>Class Scope:</strong> {targetYear} {semester ? `| ${targetSem}` : ""}
              </div>
              <div style={{ marginBottom: "6px" }}>
                <strong>Subject Scope:</strong> <span style={{ color: "#0f766e", fontWeight: 600 }}>{targetSubjectStr}</span>
              </div>
              <div>
                <strong>Broadcast Message:</strong>
                <div style={{ fontStyle: "italic", color: "#475569", marginTop: "4px", background: "#ffffff", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  &ldquo;📢 Internal marks {activeSubject ? `for ${activeSubject.subjectCode} - ${activeSubject.subjectName} ` : department ? `for ${department} ` : ''}have been officially published. Check your marks portal now.&rdquo;
                </div>
              </div>
            </div>

            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "12px 14px", fontSize: "13px", color: "#166534", lineHeight: "1.5" }}>
              ✓ <strong>Publish Draft Marks:</strong> All matching draft marks will be set to <strong>Published</strong> and mark editing will be locked.<br />
              👥 <strong>Student Visibility:</strong> All enrolled students will immediately be able to view their marks in their student portal.<br />
              🔔 <strong>Multi-Channel Broadcast:</strong> Delivers instant Web Push notifications and in-app alerts to students, faculty, and administrators.
            </div>
          </div>

          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.btnGhost}
              onClick={() => setShowNotifyModal(false)}
              disabled={notifying}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.btnPublish}
              style={{ padding: "10px 18px", fontSize: "14px" }}
              onClick={handleNotifyMarks}
              disabled={notifying}
            >
              {notifying ? "Publishing & Broadcasting..." : "Confirm, Publish All & Broadcast"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.titleRow} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "20px" }}>
        <div>
          <h1 className={styles.title}>Internal Mark Management</h1>
          <p className={styles.subtitle}>
            View, edit, add missing students, and publish marks with instant student & staff notifications.
          </p>
        </div>

        <button
          type="button"
          className={styles.btnPrimary}
          style={{
            background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
            color: "#ffffff",
            border: "none",
            padding: "11px 20px",
            borderRadius: "10px",
            fontWeight: 700,
            fontSize: "14px",
            cursor: "pointer",
            boxShadow: "0 4px 14px rgba(22, 163, 74, 0.3)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "transform 0.15s, opacity 0.15s",
          }}
          onClick={() => setShowNotifyModal(true)}
        >
          📢 Publish Internal Marks & Send Notifications
        </button>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <span>{error}</span>
          <button className={styles.toastCloseBtn} onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}
      {success && (
        <div className={styles.successBanner}>
          <span>{success}</span>
          <button className={styles.toastCloseBtn} onClick={() => setSuccess("")}>
            ×
          </button>
        </div>
      )}

      <div className={styles.filterCard}>
        <div className={styles.filterGrid}>
          <div className={styles.field}>
            <label>Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="">Select Department</option>
              {departments.map((dept) => (
                <option key={dept._id || dept.code} value={dept.code || dept.name}>
                  {dept.name || dept.code} ({dept.code})
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label>Year</label>
            <select value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">Select Year</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  Year {y}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label>Semester</label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
            >
              <option value="">Select Semester</option>
              {semesterOptions.map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label>Academic Year</label>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
            >
              <option value="">Select Academic Year</option>
              {academicYearOptions.map((ay) => (
                <option key={ay} value={ay}>
                  {ay}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label>Subject</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              disabled={subjects.length === 0}
            >
              <option value="">Select Subject</option>
              {subjects.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.subjectCode} — {s.subjectName} ({s.Category})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.filterActions}>
          <button
            className={styles.btnSearch}
            onClick={handleSearchSubjects}
            disabled={loadingSubjects}
          >
            {loadingSubjects ? "Loading..." : "Load Subjects"}
          </button>
          <button
            className={styles.btnPrimary}
            onClick={handleViewMarks}
            disabled={loadingMarks || !subjectId}
          >
            {loadingMarks ? "Loading..." : "Search Marks"}
          </button>
        </div>
      </div>

      {loadingMarks && <p className={styles.emptyBox}>Loading marks report...</p>}

      {!loadingMarks && renderMarkReportBox()}

      {renderEditModal()}
      {renderAddStudentsModal()}
      {renderDeleteModal()}
      {renderPublishModal()}
      {renderNotifyModal()}
    </div>
  );
}
