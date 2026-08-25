"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  Calendar,
  Save,
  Plus,
  Trash2,
  Download,
  RotateCw,
  Search,
  X,
  FileSpreadsheet,
  Layers,
  ArrowRight,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import styles from "../examTimetable.module.css";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const api = axios.create({ baseURL: BASE_URL, withCredentials: true });

export default function MasterExamTimetablePage() {
  const router = useRouter();
  const pdfContainerRef = useRef(null);

  // ---------- TOP FORM STATE ----------
  const [examName, setExamName] = useState("Internal Assessment Test 1");
  const [existingExams, setExistingExams] = useState([]);
  const [academicYear, setAcademicYear] = useState("2026-2027");
  const [semesterType, setSemesterType] = useState("ODD");

  // ---------- MASTER DATA ----------
  const [departments, setDepartments] = useState([]);
  const [dates, setDates] = useState([
    { date: "2026-08-25" },
    { date: "2026-08-26" },
    { date: "2026-08-27" },
  ]);

  // Matrix entries map: key -> { department, year, semester, date, session, subject, subjectCode, subjectName }
  // Key format: `${dept}|${year}|${session}|${date}`
  const [entriesMap, setEntriesMap] = useState({});

  // Loading & Saving state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  // ---------- SUBJECT PICKER MODAL STATE ----------
  const [modalOpen, setModalOpen] = useState(false);
  const [activeCell, setActiveCell] = useState(null); // { dept, year, semester, session, date, key }
  const [modalSubjects, setModalSubjects] = useState([]);
  const [modalSearch, setModalSearch] = useState("");
  const [modalLoading, setModalLoading] = useState(false);

  const years = [
    { label: "I", value: 1 },
    { label: "II", value: 2 },
    { label: "III", value: 3 },
    { label: "IV", value: 4 },
  ];

  const sessions = ["FN", "AN"];

  // Helper to calculate semester based on year and semesterType
  const getSemester = (yearVal, semType) => {
    return semType === "ODD" ? yearVal * 2 - 1 : yearVal * 2;
  };

  // Helper: Format date for display
  const formatDateDisplay = (dStr) => {
    if (!dStr) return "";
    try {
      const parts = dStr.split("-");
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}`;
      }
      return dStr;
    } catch {
      return dStr;
    }
  };

  // ---------- INITIAL LOAD ----------
  useEffect(() => {
    const curYear = new Date().getFullYear();
    setAcademicYear(`${curYear}-${curYear + 1}`);

    const fetchDepts = async () => {
      try {
        const res = await api.get("/api/admin/department/all");
        if (res.data?.data) {
          const depts = res.data.data.map((d) => d.code.toUpperCase());
          setDepartments(depts);
        }
      } catch (err) {
        console.error("Failed to load departments:", err);
      }
    };

    fetchDepts();
  }, []);

  // Fetch list of saved exams for academicYear and semesterType
  const fetchExistingExams = async () => {
    if (!academicYear) return;
    try {
      const res = await api.get("/api/exam-timetable/list", {
        params: { academicYear, semesterType },
      });
      if (res.data?.data) {
        setExistingExams(res.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch existing exams:", err);
    }
  };

  useEffect(() => {
    fetchExistingExams();
  }, [academicYear, semesterType]);

  // ---------- FETCH SAVED TIMETABLE ----------
  const fetchExamTimetable = async () => {
    if (!examName || !academicYear || !semesterType) return;
    setLoading(true);
    try {
      const res = await api.get("/api/exam-timetable/get", {
        params: { examName, academicYear, semesterType },
      });

      if (res.data?.data) {
        const data = res.data.data;
        if (data.dates && data.dates.length > 0) {
          setDates(data.dates.map((d) => ({ date: d.date })));
        }

        const newMap = {};
        (data.entries || []).forEach((entry) => {
          const key = `${entry.department}|${entry.year}|${entry.session}|${entry.date}`;
          newMap[key] = entry;
        });
        setEntriesMap(newMap);
      } else {
        setEntriesMap({});
      }
    } catch (err) {
      if (err.response?.data?.islogout) router.push("/");
      console.error("Fetch exam timetable error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExamTimetable();
  }, [examName, academicYear, semesterType]);

  // ---------- COLUMN HANDLERS ----------
  const handleAddColumn = () => {
    const lastDate = dates.length > 0 ? dates[dates.length - 1].date : new Date().toISOString().split("T")[0];
    let nextDateStr = lastDate;
    try {
      const d = new Date(lastDate);
      d.setDate(d.getDate() + 1);
      nextDateStr = d.toISOString().split("T")[0];
    } catch {
      nextDateStr = new Date().toISOString().split("T")[0];
    }
    setDates((prev) => [...prev, { date: nextDateStr }]);
  };

  const handleDateChange = (index, newDate) => {
    const oldDate = dates[index]?.date;
    const updated = [...dates];
    updated[index] = { date: newDate };
    setDates(updated);

    // Update keys in entriesMap if date was changed
    if (oldDate && oldDate !== newDate) {
      setEntriesMap((prev) => {
        const nextMap = { ...prev };
        Object.keys(nextMap).forEach((key) => {
          if (key.endsWith(`|${oldDate}`)) {
            const entry = nextMap[key];
            delete nextMap[key];
            const newKey = key.replace(`|${oldDate}`, `|${newDate}`);
            nextMap[newKey] = { ...entry, date: newDate };
          }
        });
        return nextMap;
      });
    }
  };

  const handleRemoveColumn = (index) => {
    if (dates.length <= 1) {
      alert("At least one date column is required.");
      return;
    }
    const removedDate = dates[index]?.date;
    setDates((prev) => prev.filter((_, i) => i !== index));

    // Remove entries for this date
    if (removedDate) {
      setEntriesMap((prev) => {
        const nextMap = { ...prev };
        Object.keys(nextMap).forEach((key) => {
          if (key.endsWith(`|${removedDate}`)) {
            delete nextMap[key];
          }
        });
        return nextMap;
      });
    }
  };

  // ---------- CELL CLICK & SUBJECT PICKER ----------
  const handleCellClick = async (dept, yr, sess, dateVal) => {
    const sem = getSemester(yr, semesterType);
    const key = `${dept}|${yr}|${sess}|${dateVal}`;
    setActiveCell({ dept, year: yr, semester: sem, session: sess, date: dateVal, key });
    setModalSearch("");
    setModalOpen(true);
    setModalLoading(true);

    try {
      const res = await api.get("/api/exam-timetable/subjects", {
        params: { department: dept, semester: sem, academicYear },
      });
      if (res.data?.success) {
        setModalSubjects(res.data.subjects || res.data.timetableSubjects || []);
      }
    } catch (err) {
      console.error("Error fetching subjects:", err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleSelectSubject = (subj) => {
    if (!activeCell) return;
    const { dept, year, semester, session, date, key } = activeCell;

    setEntriesMap((prev) => ({
      ...prev,
      [key]: {
        department: dept,
        year,
        semester,
        session,
        date,
        subject: subj._id,
        subjectCode: subj.subjectCode,
        subjectName: subj.subjectName,
      },
    }));

    setModalOpen(false);
  };

  const handleClearCell = () => {
    if (!activeCell) return;
    setEntriesMap((prev) => {
      const nextMap = { ...prev };
      delete nextMap[activeCell.key];
      return nextMap;
    });
    setModalOpen(false);
  };

  // Filtered modal subjects - strictly for this department & year/semester (excluding already assigned)
  const filteredSubjects = useMemo(() => {
    if (!activeCell) return [];
    const term = modalSearch.trim().toLowerCase();

    // Find all subject codes already assigned to this same (department, year/semester) across all dates and sessions
    const assignedSubjectCodesForThisClass = new Set();
    Object.keys(entriesMap).forEach((key) => {
      const [entryDept, entryYr] = key.split("|");
      if (entryDept === activeCell.dept && Number(entryYr) === Number(activeCell.year)) {
        if (key !== activeCell.key && entriesMap[key]?.subjectCode) {
          assignedSubjectCodesForThisClass.add(entriesMap[key].subjectCode.trim().toUpperCase());
        }
      }
    });

    const list = modalSubjects.filter(
      (s) => !assignedSubjectCodesForThisClass.has((s.subjectCode || "").trim().toUpperCase())
    );

    if (!term) return list;
    return list.filter(
      (s) =>
        s.subjectCode?.toLowerCase().includes(term) ||
        s.subjectName?.toLowerCase().includes(term)
    );
  }, [modalSubjects, modalSearch, activeCell, entriesMap]);

  // ---------- SAVE MASTER EXAM TIMETABLE ----------
  const handleSave = async () => {
    if (!examName.trim()) {
      alert("Please enter Exam Name.");
      return;
    }

    setSaving(true);
    try {
      const entriesArray = Object.values(entriesMap);
      const payload = {
        examName: examName.trim(),
        academicYear,
        semesterType,
        dates,
        entries: entriesArray,
      };

      const res = await api.post("/api/exam-timetable/save", payload);
      if (res.data?.success) {
        alert("✓ Master Exam Timetable saved successfully!");
        fetchExistingExams();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Failed to save exam timetable.");
    } finally {
      setSaving(false);
    }
  };

  // Preset exam options
  const defaultExamPresets = [
    "Internal Assessment Test 1",
    "Internal Assessment Test 2",
    "Model Examination",
  ];

  // Combined unique exam options
  const examOptions = React.useMemo(() => {
    const set = new Set(defaultExamPresets);
    existingExams.forEach((ex) => {
      if (ex.examName) set.add(ex.examName);
    });
    return Array.from(set);
  }, [existingExams]);

  // Dynamically scale cell width as number of date columns increases
  const dynamicCellWidth = useMemo(() => {
    const count = dates.length;
    if (count <= 3) return 145;
    if (count <= 5) return 125;
    if (count <= 7) return 110;
    if (count <= 9) return 96;
    return Math.max(82, Math.floor(750 / count));
  }, [dates.length]);

  // ---------- EXPORT LANDSCAPE MASTER PDF (MULTI-PAGE CAPABLE) ----------
  const handleExportLandscapePDF = async () => {
    if (!pdfContainerRef.current) return;
    setExportingPDF(true);

    // Give React 150ms to re-render DOM cleanly without edit controls / add column
    await new Promise((resolve) => setTimeout(resolve, 150));

    try {
      const element = pdfContainerRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth(); // 297mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 210mm
      const margin = 10;
      const printWidth = pdfWidth - margin * 2; // 277mm
      const printHeight = pdfHeight - margin * 2; // 190mm

      // Canvas pixels per page height
      const pageCanvasHeight = (canvas.width * printHeight) / printWidth;
      let renderedHeight = 0;
      let pageIndex = 0;

      while (renderedHeight < canvas.height) {
        if (pageIndex > 0) {
          pdf.addPage();
        }

        const currentChunkHeight = Math.min(pageCanvasHeight, canvas.height - renderedHeight);
        const chunkCanvas = document.createElement("canvas");
        chunkCanvas.width = canvas.width;
        chunkCanvas.height = currentChunkHeight;

        const ctx = chunkCanvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, chunkCanvas.width, chunkCanvas.height);
        ctx.drawImage(
          canvas,
          0,
          renderedHeight,
          canvas.width,
          currentChunkHeight,
          0,
          0,
          canvas.width,
          currentChunkHeight
        );

        const chunkImgData = chunkCanvas.toDataURL("image/png");
        const chunkHeightInMm = (currentChunkHeight * printWidth) / canvas.width;

        pdf.addImage(chunkImgData, "PNG", margin, margin, printWidth, chunkHeightInMm);

        renderedHeight += currentChunkHeight;
        pageIndex++;
      }

      pdf.save(`Master_Exam_Timetable_${examName}_${academicYear}.pdf`);
    } catch (err) {
      console.error("PDF export error:", err);
      alert("Failed to export PDF: " + err.message);
    } finally {
      setExportingPDF(false);
    }
  };

  return (
    <div className={styles.mcontainer}>
      <div className={styles.container}>
        {/* Top Header */}
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.title}>
              <FileSpreadsheet size={26} color="#2563eb" /> Master Exam Timetable
            </h1>
            <p className={styles.subtitle}>
              Configure and assign internal exam schedules across departments and years
            </p>
          </div>

          <div className={styles.actionsGroup}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => router.push("/admin/exam-timetable/class")}
            >
              <Layers size={15} /> Class-Wise View <ArrowRight size={14} />
            </button>

            <button
              type="button"
              className={styles.btnSecondary}
              onClick={handleExportLandscapePDF}
              disabled={exportingPDF || dates.length === 0}
            >
              <Download size={15} /> {exportingPDF ? "Exporting..." : "Download Landscape PDF"}
            </button>

            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleSave}
              disabled={saving}
            >
              <Save size={15} /> {saving ? "Saving..." : "Save Master Timetable"}
            </button>
          </div>
        </div>

        {/* Filters & Settings Card */}
        <div className={styles.filterCard}>
          <div className={styles.filterGrid}>
            {/* Academic Year */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Academic Year</label>
              <select
                className={styles.formSelect}
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
              >
                {[-1, 0, 1].map((offset) => {
                  const y = new Date().getFullYear() + offset;
                  const label = `${y}-${y + 1}`;
                  return (
                    <option key={label} value={label}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Semester Type */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Semester Type</label>
              <div className={styles.semToggleGroup}>
                <button
                  type="button"
                  className={`${styles.semToggleBtn} ${
                    semesterType === "ODD" ? styles.semToggleActive : ""
                  }`}
                  onClick={() => setSemesterType("ODD")}
                >
                  ODD Sem (1, 3, 5, 7)
                </button>
                <button
                  type="button"
                  className={`${styles.semToggleBtn} ${
                    semesterType === "EVEN" ? styles.semToggleActive : ""
                  }`}
                  onClick={() => setSemesterType("EVEN")}
                >
                  EVEN Sem (2, 4, 6, 8)
                </button>
              </div>
            </div>

            {/* Exam Name Selector & Custom Input */}
            <div className={styles.formGroup} style={{ flex: 1.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label className={styles.formLabel} style={{ margin: 0 }}>
                  Select / Switch Exam
                </label>
                {existingExams.length > 0 && (
                  <span style={{ fontSize: "11px", color: "#2563eb", fontWeight: 700 }}>
                    {existingExams.length} Exam(s) found
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <select
                  className={styles.formSelect}
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  style={{ minWidth: "220px", flex: 1 }}
                >
                  <optgroup label="Standard Exams">
                    <option value="Internal Assessment Test 1">Internal Assessment Test 1 (IAT 1)</option>
                    <option value="Internal Assessment Test 2">Internal Assessment Test 2 (IAT 2)</option>
                    <option value="Model Examination">Model Examination</option>
                  </optgroup>
                  {existingExams.filter(
                    (ex) => !["Internal Assessment Test 1", "Internal Assessment Test 2", "Model Examination"].includes(ex.examName)
                  ).length > 0 && (
                    <optgroup label="Other Saved Exams">
                      {existingExams
                        .filter(
                          (ex) => !["Internal Assessment Test 1", "Internal Assessment Test 2", "Model Examination"].includes(ex.examName)
                        )
                        .map((ex) => (
                          <option key={ex._id} value={ex.examName}>
                            {ex.examName}
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>

                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="Or type custom exam name..."
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  style={{ minWidth: "180px", flex: 1 }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Master Matrix Card (Captured for Landscape PDF) */}
        <div className={styles.tableCard} ref={pdfContainerRef}>
          {/* Printable College Header Banner */}
          <div className={styles.printHeader}>
            <img
              src="/nilogo.png"
              alt="College Logo"
              className={styles.collegeLogo}
              style={{ width: "420px", maxWidth: "100%", height: "auto" }}
            />
            <h2 className={styles.printExamTitle}>
              MASTER EXAM TIMETABLE — {(examName || "INTERNAL EXAMINATION").toUpperCase()}
            </h2>
            <div className={styles.printMetaRow}>
              <span><strong>Academic Year:</strong> {academicYear}</span>
              <span>•</span>
              <span><strong>Semester Type:</strong> {semesterType} Semester</span>
            </div>
          </div>

          <div className={styles.tableToolbar}>
            <div className={styles.tableTitle}>
              <span>Exam Schedule Matrix</span>
              <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 500 }}>
                ({dates.length} Date Column{dates.length > 1 ? "s" : ""})
              </span>
            </div>
          </div>

          <div className={styles.tableWrapper} style={exportingPDF ? { overflow: "visible", width: "100%", maxWidth: "100%" } : {}}>
            {loading ? (
              <p style={{ textAlign: "center", color: "#64748b", padding: "40px" }}>
                Loading master timetable matrix...
              </p>
            ) : (
              <table className={styles.masterTable} style={exportingPDF ? { width: "100%", tableLayout: "fixed" } : {}}>
                <thead>
                  <tr>
                    <th
                      className={styles.deptTh}
                      style={exportingPDF ? { width: "11%", minWidth: "auto" } : {}}
                    >
                      Department &amp; Year
                    </th>
                    <th
                      className={styles.sessionTh}
                      style={exportingPDF ? { width: "5%", minWidth: "auto" } : {}}
                    >
                      Session
                    </th>
                    {dates.map((dObj, idx) => (
                      <th
                        key={idx}
                        className={styles.dateTh}
                        style={
                          exportingPDF
                            ? { width: `${84 / dates.length}%`, minWidth: "auto", padding: "4px 2px" }
                            : { minWidth: `${dynamicCellWidth}px`, width: `${dynamicCellWidth}px` }
                        }
                      >
                        <div className={styles.dateThInner}>
                          {!exportingPDF ? (
                            <>
                              <input
                                type="date"
                                className={styles.dateInput}
                                style={{ width: `${Math.max(dynamicCellWidth - 14, 72)}px` }}
                                value={dObj.date}
                                onChange={(e) => handleDateChange(idx, e.target.value)}
                              />
                              <span style={{ fontSize: "11px", fontWeight: "800", color: "#2563eb" }}>
                                {formatDateDisplay(dObj.date)}
                              </span>
                              {dates.length > 1 && (
                                <button
                                  type="button"
                                  className={styles.removeColBtn}
                                  onClick={() => handleRemoveColumn(idx)}
                                  title="Delete column"
                                >
                                  <Trash2 size={11} /> Remove
                                </button>
                              )}
                            </>
                          ) : (
                            <span style={{ fontSize: "10px", fontWeight: "800", color: "#0f172a", whiteSpace: "nowrap" }}>
                              {formatDateDisplay(dObj.date)}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                    {!exportingPDF && (
                      <th className={styles.addColumnTh}>
                        <button type="button" className={styles.addColBtn} onClick={handleAddColumn}>
                          <Plus size={12} /> Add
                        </button>
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody>
                  {departments.length === 0 ? (
                    <tr>
                      <td colSpan={dates.length + (exportingPDF ? 2 : 3)} style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                        Loading departments...
                      </td>
                    </tr>
                  ) : (
                    departments.map((dept) => {
                      return years.map((yr) => {
                        const semNum = getSemester(yr.value, semesterType);

                        return sessions.map((sess, sessIdx) => {
                          const isFirstSession = sessIdx === 0;

                          return (
                            <tr key={`${dept}-${yr.value}-${sess}`}>
                              {/* Department & Year Header Row (spans 2 sessions) */}
                              {isFirstSession && (
                                <td
                                  rowSpan={2}
                                  className={styles.deptTh}
                                  style={
                                    exportingPDF
                                      ? { width: "11%", minWidth: "auto", textAlign: "center", verticalAlign: "middle", padding: "4px 2px" }
                                      : { textAlign: "center", verticalAlign: "middle" }
                                  }
                                >
                                  <div style={{ fontWeight: 800, fontSize: "11px", color: "#0f172a" }}>
                                    {dept} {yr.label}
                                  </div>
                                  <div style={{ fontSize: "9.5px", color: "#64748b", fontWeight: 600 }}>
                                    (Sem {semNum})
                                  </div>
                                </td>
                              )}

                              {/* Session Code FN / AN */}
                              <td
                                className={`${styles.sessionCell} ${
                                  sess === "FN" ? styles.sessionFN : styles.sessionAN
                                }`}
                                style={exportingPDF ? { width: "5%", minWidth: "auto", padding: "4px 1px", fontSize: "10px" } : {}}
                              >
                                {sess === "FN" ? "F.N" : "A.N"}
                              </td>

                              {/* Date Slot Cells */}
                              {dates.map((dObj) => {
                                const key = `${dept}|${yr.value}|${sess}|${dObj.date}`;
                                const assigned = entriesMap[key];

                                return (
                                  <td
                                    key={key}
                                    className={styles.subjectCell}
                                    style={
                                      exportingPDF
                                        ? { width: `${84 / dates.length}%`, minWidth: "auto", padding: "3px 2px" }
                                        : { minWidth: `${dynamicCellWidth}px`, width: `${dynamicCellWidth}px` }
                                    }
                                    onClick={() => !exportingPDF && handleCellClick(dept, yr.value, sess, dObj.date)}
                                  >
                                    {assigned ? (
                                      <div className={styles.assignedBox}>
                                        <span
                                          className={styles.subCodeText}
                                          style={{
                                            fontSize: exportingPDF
                                              ? dates.length > 6
                                                ? "9px"
                                                : "10px"
                                              : dynamicCellWidth < 105
                                              ? "10.5px"
                                              : "11.5px",
                                          }}
                                        >
                                          {assigned.subjectCode}
                                        </span>
                                        <span
                                          className={styles.subNameText}
                                          style={{
                                            fontSize: exportingPDF
                                              ? dates.length > 6
                                                ? "8px"
                                                : "8.5px"
                                              : dynamicCellWidth < 105
                                              ? "9px"
                                              : "10px",
                                            lineHeight: 1.1,
                                          }}
                                        >
                                          {assigned.subjectName}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className={styles.emptyCellPlaceholder}>
                                        {exportingPDF ? "—" : "+ Assign"}
                                      </div>
                                    )}
                                  </td>
                                );
                              })}

                              {/* Empty buffer for Add Column TH */}
                              {!exportingPDF && <td style={{ background: "#fafafa" }}></td>}
                            </tr>
                          );
                        });
                      });
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* SUBJECT PICKER MODAL */}
        {modalOpen && activeCell && (
          <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <div>
                  <h3 className={styles.modalTitle}>Select Exam Subject</h3>
                  <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
                    {activeCell.dept} Year {activeCell.year} (Semester {activeCell.semester}) • {activeCell.session} on {activeCell.date}
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.modalCloseBtn}
                  onClick={() => setModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className={styles.modalBody}>
                <input
                  type="text"
                  className={styles.modalSearch}
                  placeholder="Search by subject code or name..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  autoFocus
                />

                {modalLoading ? (
                  <p style={{ textAlign: "center", color: "#64748b", padding: "20px" }}>
                    Loading subjects for {activeCell.dept} Year {activeCell.year} (Semester {activeCell.semester})...
                  </p>
                ) : modalSubjects.length === 0 ? (
                  <div style={{ textAlign: "center", color: "#64748b", padding: "24px 10px" }}>
                    <p style={{ margin: "0 0 4px 0", fontWeight: 700, color: "#334155" }}>
                      No subjects configured in Timetable
                    </p>
                    <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
                      No subjects are mapped for {activeCell.dept} Year {activeCell.year} (Semester {activeCell.semester}).
                    </p>
                  </div>
                ) : filteredSubjects.length === 0 ? (
                  <div style={{ textAlign: "center", color: "#64748b", padding: "24px 10px" }}>
                    <p style={{ margin: "0 0 4px 0", fontWeight: 700, color: "#334155" }}>
                      No subjects available
                    </p>
                    <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
                      All mapped subjects for this department &amp; year have already been assigned in this exam.
                    </p>
                  </div>
                ) : (
                  <div className={styles.subjectList}>
                    {filteredSubjects.map((s) => {
                      const isCurrent =
                        entriesMap[activeCell.key]?.subjectCode === s.subjectCode;

                      return (
                        <div
                          key={s._id}
                          className={`${styles.subjectOption} ${
                            isCurrent ? styles.subjectOptionSelected : ""
                          }`}
                          onClick={() => handleSelectSubject(s)}
                        >
                          <div>
                            <div style={{ fontWeight: 800, fontSize: "13px", color: "#0f172a" }}>
                              {s.subjectCode}
                            </div>
                            <div style={{ fontSize: "12px", color: "#475569" }}>
                              {s.subjectName}
                            </div>
                          </div>

                          <span
                            style={{
                              fontSize: "11px",
                              padding: "2px 8px",
                              borderRadius: "4px",
                              background: "#f1f5f9",
                              color: "#334155",
                              fontWeight: 700,
                            }}
                          >
                            {s.Category || "Theory"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={handleClearCell}
                  style={{ color: "#ef4444", borderColor: "#fecaca" }}
                >
                  <Trash2 size={14} /> Clear Slot
                </button>

                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
