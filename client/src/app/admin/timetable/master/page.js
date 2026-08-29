"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import styles from "./timetable.module.css";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

function getAcademicYearOptions(currentVal) {
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

export default function TimetablePage() {
  const router = useRouter();

  // ---------- STATE ----------
  const [academicYear, setAcademicYear] = useState(getDefaultAcademicYear());
  const [semesterType, setSemesterType] = useState("ODD");
  const [wef, setWef] = useState("");
  const [loading, setLoading] = useState(true);
  const [IsDownload, setIsDownload] = useState(false);
  const [deletingKey, setDeletingKey] = useState(null);

  // Master data
  const [departments, setDepartments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [hallList, setHallList] = useState([]);

  // Timetable entries
  const [entries, setEntries] = useState({});

  // Popup state
  const [popup, setPopup] = useState(null);
  const popupInputRef = useRef(null);
  const pdfContainerRef = useRef(null);

  // ---------- CONSTANTS ----------
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const dayMap = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5 };
  const years = [
    { label: "I", value: 1 },
    { label: "II", value: 2 },
    { label: "III", value: 3 },
    { label: "IV", value: 4 },
  ];

  const periodColumns = [
    { label: "P1", period: 1, type: "period" },
    { label: "P2", period: 2, type: "period" },
    { label: "Break", period: null, type: "break" },
    { label: "P3", period: 3, type: "period" },
    { label: "P4", period: 4, type: "period" },
    { label: "Lunch", period: null, type: "break" },
    { label: "P5", period: 5, type: "period" },
    { label: "P6", period: 6, type: "period" },
    { label: "Break", period: null, type: "break" },
    { label: "P7", period: 7, type: "period" },
  ];

  // ---------- HELPER: absolute semester ----------
  const getAbsoluteSemester = (year) => {
    return semesterType === "ODD" ? year * 2 - 1 : year * 2;
  };

  // ---------- HELPERS ----------
  const getSubjectCode = (s) => s?.subjectCode || "";
  const getSubjectName = (s) => s?.subjectName || "";
  const getSubjectCategory = (s) => s?.Category || s?.category || "";
  const getStaffCode = (s) => s?.staff_code || "";
  const getStaffName = (s) => {
    if (!s) return "";
    const { prefix = "", first_name = "", last_name = "" } = s;
    return `${prefix} ${first_name} ${last_name}`.trim().replace(/\s+/g, " ");
  };
  const getFacultyId = (s) => s?.staff_id || "";
  const getHallCode = (h) => h?.hallCode || h?.hallName || "";
  const getHallName = (h) => h?.hallName || "";

  const isLabSubject = (subject) => {
    const cat = getSubjectCategory(subject).toUpperCase();
    return cat === "LAB" || cat === "PRACTICAL";
  };

  // ---------- Helper: redirect on unauthorized ----------
  const handleUnauthorized = (error) => {
    if (error.response?.data?.islogout === true) {
      router.push("/");
      return true;
    }
    return false;
  };

  // ---------- Axios instance ----------
  const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_BACKEND_URL + "/api",
    withCredentials: true,
  });

  // ---------- AUTO SET ACADEMIC YEAR ----------
  useEffect(() => {
    const today = new Date();
    setWef(today.toISOString().split("T")[0]);
    const currentYear = new Date().getFullYear();
    setAcademicYear(`${currentYear}-${currentYear + 1}`);
  }, []);

  // ---------- FETCH MASTER DATA (departments from dept route) ----------
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [staffRes, hallRes, subRes, deptRes] = await Promise.all([
          api.get("/admin/staff/all", { params: { limit: 1000 } }),
          api.get("/admin/hall/all", { params: { limit: 1000 } }),
          api.get("/admin/subject/all", { params: { limit: 1000 } }),
          api.get("/admin/department/all"),
        ]);

        const deptData = deptRes.data.data || [];
        setDepartments(
          deptData.map((d) => ({
            departmentCode: d.code,
            _id: d._id,
            name: d.name,
          }))
        );

        setSubjects(subRes.data.data || []);
        setStaffList(staffRes.data.data || []);
        setHallList(hallRes.data.data || []);
      } catch (err) {
        if (handleUnauthorized(err)) return;
        console.error("Failed to fetch master data:", err);
      }
    };
    fetchAll();
  }, []);

  // ---------- BUILD BRANCHES (ALL departments) ----------
  const branches = useMemo(() => {
    return departments.flatMap((dept) =>
      years.map((y) => ({
        label: `${dept.departmentCode} ${y.label}`,
        departmentCode: dept.departmentCode,
        year: y.value,
        _id: dept._id,
      }))
    );
  }, [departments]);

  // ---------- LOAD TIMETABLE (master-all endpoint) ----------
  useEffect(() => {
    if (!academicYear || !semesterType) return;

    const loadTimetable = async () => {
      setLoading(true);
      try {
        const res = await api.get("/admin/timetable/master-all", {
          params: { academicYear, semesterType },
        });
        const data = res.data.data || [];

        const newEntries = {};
        data.forEach((item) => {
          const deptCode = item.department;
          const yearVal = item.year;
          const dayNum = item.day;
          const periodNum = item.period;

          if (dayNum < 1 || dayNum > 5) return;

          const key = `${deptCode}__${yearVal}__${dayNum}__${periodNum}`;
          newEntries[key] = {
            subject: item.subject || null,
            staff: item.staff || null,
            hall: item.hall || null,
            status: "idle",
            errorMsg: null,
          };
        });

        setEntries(newEntries);
      } catch (err) {
        if (handleUnauthorized(err)) return;
        console.error("Failed to load timetable:", err);
      } finally {
        setLoading(false);
      }
    };

    loadTimetable();
  }, [academicYear, semesterType]);

  // ---------- SAVE ENTRY ----------
  const saveEntry = async (entryKey, dayNum, branch, periodNum, subject, staff, hall) => {
    const payload = {
      academicYear,
      department: branch.departmentCode,
      year: branch.year,
      semester: getAbsoluteSemester(branch.year),
      day: dayNum,
      period: periodNum,
      subject: subject?._id || null,
      staff: staff?._id || null,
      hall: hall?._id || null,
    };

    setEntries((prev) => ({
      ...prev,
      [entryKey]: { ...prev[entryKey], status: "saving", errorMsg: null },
    }));

    try {
      await api.put("/admin/timetable/upsert", payload);
      setEntries((prev) => ({
        ...prev,
        [entryKey]: {
          subject,
          staff,
          hall,
          status: "success",
          errorMsg: null,
        },
      }));
      setTimeout(() => {
        setEntries((prev) => ({
          ...prev,
          [entryKey]: { ...prev[entryKey], status: "idle" },
        }));
      }, 1500);
    } catch (err) {
      if (handleUnauthorized(err)) return;
      const msg =
        err.response?.status === 409
          ? err.response?.data?.message || "Conflict: slot already taken"
          : "Failed to save";
      setEntries((prev) => ({
        ...prev,
        [entryKey]: { ...prev[entryKey], status: "error", errorMsg: msg },
      }));
    }
  };

  // ---------- HANDLE CELL UPDATE ----------
  const attemptUpdate = (entryKey, dayNum, branch, periodNum, newSubject, newStaff, newHall) => {
    const prev = entries[entryKey] || {};
    const subject = newSubject !== undefined ? newSubject : prev.subject;
    const staff = newStaff !== undefined ? newStaff : prev.staff;
    const hall = newHall !== undefined ? newHall : prev.hall;

    setEntries((prev) => ({
      ...prev,
      [entryKey]: { ...prev[entryKey], subject, staff, hall, status: "idle", errorMsg: null },
    }));

    if (subject && staff) {
      saveEntry(entryKey, dayNum, branch, periodNum, subject, staff, hall);
    }
  };

  // ---------- DELETE HANDLERS ----------
  const handleDeleteCell = async (dayNum, branch, periodNum, entryKey) => {
    const confirmDelete = window.confirm(
      `Clear this slot (${branch.label}, ${days[dayNum - 1]}, Period ${periodNum})?`
    );
    if (!confirmDelete) return;

    setDeletingKey(entryKey);
    try {
      await api.delete("/admin/timetable/cell", {
        params: {
          academicYear,
          department: branch.departmentCode,
          year: branch.year,
          semester: getAbsoluteSemester(branch.year),
          day: dayNum,
          period: periodNum,
        },
      });
      setEntries((prev) => {
        const next = { ...prev };
        delete next[entryKey];
        return next;
      });
    } catch (err) {
      if (handleUnauthorized(err)) return;
      alert(`Failed to clear slot: ${err.response?.data?.message || err.message}`);
    } finally {
      setDeletingKey(null);
    }
  };

  const handleDeleteRow = async (dayNum, branch) => {
    const confirmDelete = window.confirm(
      `Clear the WHOLE ${days[dayNum - 1]} row for ${branch.label}?`
    );
    if (!confirmDelete) return;

    const rowKey = `${branch.departmentCode}__${branch.year}__${dayNum}`;
    setDeletingKey(rowKey);
    try {
      await api.delete("/admin/timetable/row", {
        params: {
          academicYear,
          department: branch.departmentCode,
          year: branch.year,
          semester: getAbsoluteSemester(branch.year),
          day: dayNum,
        },
      });
      setEntries((prev) => {
        const next = { ...prev };
        periodColumns.forEach((col) => {
          if (col.type !== "period") return;
          const key = `${branch.departmentCode}__${branch.year}__${dayNum}__${col.period}`;
          delete next[key];
        });
        return next;
      });
    } catch (err) {
      if (handleUnauthorized(err)) return;
      alert(`Failed to clear row: ${err.response?.data?.message || err.message}`);
    } finally {
      setDeletingKey(null);
    }
  };

  const handleDeleteClass = async (branch) => {
    const classKey = `${branch.departmentCode}__${branch.year}`;
    const confirmDelete = window.confirm(
      `⚠️ Delete the FULL timetable for ${branch.label} (${semesterType} sem, ${academicYear})?`
    );
    if (!confirmDelete) return;

    setDeletingKey(classKey);
    try {
      await api.delete("/admin/timetable/class", {
        params: {
          academicYear,
          department: branch.departmentCode,
          year: branch.year,
          semester: getAbsoluteSemester(branch.year),
        },
      });
      setEntries((prev) => {
        const next = {};
        Object.entries(prev).forEach(([key, val]) => {
          if (!key.startsWith(`${branch.departmentCode}__${branch.year}__`)) {
            next[key] = val;
          }
        });
        return next;
      });
    } catch (err) {
      if (handleUnauthorized(err)) return;
      alert(`Failed to delete class timetable: ${err.response?.data?.message || err.message}`);
    } finally {
      setDeletingKey(null);
    }
  };

  // ---------- POPUP HANDLERS ----------
  const openPopup = (e, type, dayNum, branch, periodNum, entryKey) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const { x, y } = getAdjustedPosition(rect);
    setPopup({
      type,
      dayNum,
      branch,
      periodNum,
      entryKey,
      x,
      y,
      search: "",
    });
    setTimeout(() => popupInputRef.current?.focus(), 50);
  };

  const getAdjustedPosition = (rect, popupWidth = 240, popupHeight = 250) => {
    let x = rect.left;
    if (x + popupWidth > window.innerWidth - 10) {
      x = Math.max(10, window.innerWidth - popupWidth - 10);
    }
    if (x < 10) x = 10;

    let y = rect.bottom + 4;
    // If not enough space below in viewport, flip popup above the cell
    if (y + popupHeight > window.innerHeight - 10) {
      y = Math.max(10, rect.top - popupHeight - 4);
    }
    if (y < 10) y = 10;

    return { x, y };
  };

  const closePopup = () => setPopup(null);

  const handleSelectSubject = (subject) => {
    if (!popup) return;
    const { entryKey, dayNum, branch, periodNum } = popup;
    const prev = entries[entryKey] || {};
    attemptUpdate(entryKey, dayNum, branch, periodNum, subject, prev.staff, prev.hall);
    closePopup();
  };

  const handleSelectStaff = (staff) => {
    if (!popup) return;
    const { entryKey, dayNum, branch, periodNum } = popup;
    const prev = entries[entryKey] || {};
    attemptUpdate(entryKey, dayNum, branch, periodNum, prev.subject, staff, prev.hall);
    closePopup();
  };

  const handleSelectHall = (hall) => {
    if (!popup) return;
    const { entryKey, dayNum, branch, periodNum } = popup;
    const prev = entries[entryKey] || {};
    attemptUpdate(entryKey, dayNum, branch, periodNum, prev.subject, prev.staff, hall);
    closePopup();
  };

  // ---------- FILTER FUNCTIONS ----------
  const filterSubjects = (query) => {
    if (!query) return subjects;
    const q = query.toUpperCase();
    return subjects.filter(
      (s) =>
        getSubjectCode(s).toUpperCase().includes(q) ||
        getSubjectName(s).toUpperCase().includes(q)
    );
  };

  const filterStaff = (query, dayNum, periodNum, currentKey, currentSubjectId) => {
    const assignedStaffIds = new Set();
    Object.entries(entries).forEach(([key, val]) => {
      if (key === currentKey) return;
      const parts = key.split("__");
      const keyDay = parseInt(parts[2]);
      const keyPeriod = parseInt(parts[3]);
      if (keyDay === dayNum && keyPeriod === periodNum && val.staff) {
        const sameSubject = currentSubjectId && val.subject && val.subject._id === currentSubjectId;
        if (!sameSubject) {
          assignedStaffIds.add(val.staff._id);
        }
      }
    });

    let list = staffList.filter((s) => !assignedStaffIds.has(s._id));
    if (!query) return list;
    const q = query.toUpperCase();
    return list.filter(
      (s) =>
        getStaffCode(s).toUpperCase().includes(q) ||
        getStaffName(s).toUpperCase().includes(q)
    );
  };

  const filterHalls = (query, dayNum, periodNum, currentKey) => {
    const assignedHallIds = new Set();
    const currentEntry = entries[currentKey] || {};
    const currentSubjectId = currentEntry.subject?._id;

    Object.entries(entries).forEach(([key, val]) => {
      if (key === currentKey) return;
      const parts = key.split("__");
      const keyDay = parseInt(parts[2]);
      const keyPeriod = parseInt(parts[3]);
      if (keyDay === dayNum && keyPeriod === periodNum && val.hall) {
        const otherSubjectId = val.subject?._id;
        const sameSubject = currentSubjectId && otherSubjectId && currentSubjectId === otherSubjectId;
        if (!sameSubject) {
          assignedHallIds.add(val.hall._id);
        }
      }
    });

    let list = hallList.filter((h) => !assignedHallIds.has(h._id));
    if (!query) return list;
    const q = query.toUpperCase();
    return list.filter(
      (h) =>
        getHallCode(h).toUpperCase().includes(q) ||
        getHallName(h).toUpperCase().includes(q)
    );
  };

  // ---------- SUBJECT REFERENCE ----------
  const referenceRows = useMemo(() => {
    const map = new Map();
    Object.values(entries).forEach((entry) => {
      if (entry.subject && entry.staff) {
        const key = `${entry.subject._id}__${entry.staff._id}`;
        if (!map.has(key)) {
          map.set(key, {
            subjectCode: getSubjectCode(entry.subject),
            subjectName: getSubjectName(entry.subject),
            category: getSubjectCategory(entry.subject),
            staffName: getStaffName(entry.staff),
            staffCode: getStaffCode(entry.staff),
            facultyId: getFacultyId(entry.staff),
          });
        }
      }
    });
    return Array.from(map.values());
  }, [entries]);

  // ---------- PDF EXPORT (with forced white backgrounds and black borders) ----------
  const handleDownloadPdf = async () => {
    setIsDownload(true);
    const element = pdfContainerRef.current;
    if (!element) {
      alert("No content to export");
      setIsDownload(false);
      return;
    }

    // Save original styles and force plain dark-on-white
    const allEls = element.querySelectorAll('*');
    const originalStyles = [];

    allEls.forEach((el, i) => {
      originalStyles[i] = {
        el,
        backgroundColor: el.style.backgroundColor,
        color: el.style.color,
        borderColor: el.style.borderColor,
        border: el.style.border,
        opacity: el.style.opacity,
      };

      el.style.opacity = '1';
      el.style.color = '#000000';
    });

    // Force plain white/black on every cell EXCEPT the Day column, whose
    // top/bottom borders are deliberately set per-row (inline, in JSX) to
    // fake a merged look across each day's group of rows.
    const allCells = element.querySelectorAll('td, th');
    allCells.forEach((cell) => {
      if (cell.classList.contains(styles.mtDayCell)) {
        cell.style.backgroundColor = 'white';
        cell.style.borderLeft = '1px solid #000000';
        cell.style.borderRight = '1px solid #000000';
        return;
      }
      cell.style.backgroundColor = 'white';
      cell.style.borderColor = '#000000';
      cell.style.border = '1px solid #000000';
    });

    const rows = element.querySelectorAll('tr');
    rows.forEach((row) => {
      row.style.backgroundColor = 'white';
    });

    // Hide delete icons
    const deleteIcons = element.querySelectorAll(`.${styles.deleteIcon}`);
    const rowClearIcons = element.querySelectorAll(`.${styles.rowClearIcon}`);
    deleteIcons.forEach((icon) => { icon.style.display = "none"; });
    rowClearIcons.forEach((icon) => { icon.style.display = "none"; });

    // Fix overflow for PDF
    const scrollables = [element, ...element.querySelectorAll("*")].filter((el) => {
      const cs = window.getComputedStyle(el);
      return (
        (cs.overflowY === "auto" || cs.overflowY === "scroll" ||
         cs.overflowX === "auto" || cs.overflowX === "scroll") &&
        (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth)
      );
    });

    const originalScrollStyles = scrollables.map((el) => ({
      el,
      overflow: el.style.overflow,
      height: el.style.height,
      maxHeight: el.style.maxHeight,
      width: el.style.width,
    }));

    scrollables.forEach((el) => {
      el.style.overflow = "visible";
      el.style.height = "auto";
      el.style.maxHeight = "none";
      el.style.width = "max-content";
    });

    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        scrollX: 0,
        scrollY: 0,
      });

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const ratio = pdfWidth / canvas.width;
      const pageHeightInCanvasPx = pdfHeight / ratio;

      let renderedHeight = 0;
      let pageNum = 0;

      while (renderedHeight < canvas.height) {
        const sliceHeight = Math.min(pageHeightInCanvasPx, canvas.height - renderedHeight);

        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;

        const ctx = pageCanvas.getContext("2d");
        ctx.drawImage(
          canvas,
          0, renderedHeight, canvas.width, sliceHeight,
          0, 0, canvas.width, sliceHeight
        );

        const imgData = pageCanvas.toDataURL("image/png");

        if (pageNum > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, sliceHeight * ratio);

        // Footer timestamp
        pdf.setFontSize(6.5);
        pdf.setTextColor(148, 163, 184);
        const generatedAtStr = new Date().toLocaleString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        });
        const footerText = `Generated via NICETECH ERP System on ${generatedAtStr}`;
        const textWidth = pdf.getTextWidth(footerText);
        pdf.text(footerText, (pdfWidth - textWidth) / 2, pdfHeight - 4);

        renderedHeight += sliceHeight;
        pageNum += 1;
      }

      pdf.save("NI_MasterTimetable.pdf");
    } catch (error) {
      console.error("PDF generation error:", error);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      // Restore scroll/overflow styles
      originalScrollStyles.forEach(({ el, overflow, height, maxHeight, width }) => {
        el.style.overflow = overflow;
        el.style.height = height;
        el.style.maxHeight = maxHeight;
        el.style.width = width;
      });

      // Restore every element's original style
      originalStyles.forEach(({ el, backgroundColor, color, borderColor, border, opacity }) => {
        el.style.backgroundColor = backgroundColor;
        el.style.color = color;
        el.style.borderColor = borderColor;
        el.style.border = border;
        el.style.opacity = opacity;
      });

      // Restore delete icons
      deleteIcons.forEach((icon) => { icon.style.display = ""; });
      rowClearIcons.forEach((icon) => { icon.style.display = ""; });

      setIsDownload(false);
    }
  };

  // ---------- RENDER ----------
  return (
    <div className={styles.mcontainer}>
      <div className={styles.hbutton}>
        <select
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
          className={styles.filterSelect}
        >
          {getAcademicYearOptions(academicYear).map((ay) => (
            <option key={ay} value={ay}>
              {ay}
            </option>
          ))}
        </select>

        <select
          value={semesterType}
          onChange={(e) => setSemesterType(e.target.value)}
          className={styles.filterSelect}
        >
          <option value="ODD">ODD</option>
          <option value="EVEN">EVEN</option>
        </select>

        <button onClick={handleDownloadPdf} className={styles.pbutton} disabled={IsDownload}>
          {IsDownload ? "EXPORTING..." : "EXPORT PDF"}
        </button>
      </div>

      <div className={styles.container} ref={pdfContainerRef}>
        <div className={styles.header}>
          <img src="/nilogo.png" alt="College Logo" width="700" height="104.3" />
        </div>

        <div className={styles.headtop}>
          <h3>MASTER TIMETABLE</h3>
          <span> {"("}</span>
          <p>{academicYear}</p>
          <span>{")-("}</span>
          <p>{semesterType}</p>
          <span>{")"}</span>
        </div>

        <div className={styles.headbottom}>
          <div className={styles.wef}>
            <p>w.e.f:</p>
            <input type="date" value={wef} onChange={(e) => setWef(e.target.value)} />
          </div>
        </div>

        <div className={styles.mtWrapper}>
          <table className={styles.mtTable}>
            <thead>
              <tr>
                <th className={styles.mtDayHead}>Day</th>
                <th className={styles.mtBranchHead}>Branch</th>
                {periodColumns.map((col, idx) => (
                  <th key={`${col.label}-${idx}`}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={2 + periodColumns.length} className={styles.mtLoadingCell}>
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && branches.length === 0 && (
                <tr>
                  <td colSpan={2 + periodColumns.length} className={styles.mtLoadingCell}>
                    No departments found.
                  </td>
                </tr>
              )}
              {!loading && branches.length > 0 && academicYear === "" && (
                <tr>
                  <td colSpan={2 + periodColumns.length} className={styles.mtLoadingCell}>
                    Please enter an Academic Year.
                  </td>
                </tr>
              )}

              {!loading &&
                branches.length > 0 &&
                academicYear !== "" &&
                days.map((day) => {
                  const dayNum = dayMap[day];
                  return branches.map((branch, idx) => {
                    const classKey = `${branch.departmentCode}__${branch.year}`;
                    const isFirstOfDay = idx === 0;
                    const isLastOfDay = idx === branches.length - 1;

                    return (
                      <tr key={`${day}-${branch.label}`}>
                        <td
                          className={styles.mtDayCell}
                          style={{
                            borderTop: isFirstOfDay ? "1px solid black" : "none",
                            borderBottom: isLastOfDay ? "1px solid black" : "none",
                          }}
                        >
                          {isFirstOfDay ? day : ""}
                        </td>
                        <td className={styles.mtBranchCell}>
                          {branch.label}
                          <span
                            className={styles.deleteIcon}
                            title={`Delete full timetable for ${branch.label}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClass(branch);
                            }}
                            style={{
                              cursor: "pointer",
                              color: "#f44336",
                              fontSize: "9px",
                              opacity: deletingKey === classKey ? 0.4 : 1,
                            }}
                          >
                            🗑
                          </span>
                        </td>

                        {periodColumns.map((col, idx) => {
                          if (col.type !== "period") {
                            return (
                              <td key={`${col.label}-${idx}`} className={styles.mtBreakCell}>
                                &nbsp;
                              </td>
                            );
                          }

                          const entryKey = `${branch.departmentCode}__${branch.year}__${dayNum}__${col.period}`;
                          const entry = entries[entryKey] || {};
                          const { subject, staff, hall, status, errorMsg } = entry;
                          const isLab = subject ? isLabSubject(subject) : false;

                          return (
                            <td
                              key={`${col.label}-${idx}`}
                              className={`${styles.mtPeriodCell} ${
                                status === "error" ? styles.mtCellError : ""
                              }`}
                            >
                              <div className={styles.mtPeriodBox}>
                                <span
                                  className={styles.mtSubjectCode}
                                  onClick={(e) =>
                                    openPopup(e, "subject", dayNum, branch, col.period, entryKey)
                                  }
                                >
                                  {subject ? getSubjectCode(subject) : "+"}
                                </span>
                                <span
                                  className={styles.mtStaffCode}
                                  onClick={(e) =>
                                    openPopup(e, "staff", dayNum, branch, col.period, entryKey)
                                  }
                                >
                                  {staff ? getStaffCode(staff) : "+"}
                                </span>
                                <span
                                  className={styles.mtHallCode}
                                  onClick={(e) => openPopup(e, "hall", dayNum, branch, col.period, entryKey)}
                                  style={{
                                    cursor: "pointer",
                                    fontSize: "10px",
                                    color: hall ? "#1976d2" : (isLab ? "#f44336" : "#888"),
                                    fontWeight: "bold",
                                    marginLeft: "4px",
                                  }}
                                  title={isLab && !hall ? "Lab requires a hall" : "Select hall"}
                                >
                                  {hall ? getHallCode(hall) : "+"}
                                </span>
                                {status === "success" && (
                                  <span className={styles.mtSuccessTick}>✓</span>
                                )}
                                {status === "error" && (
                                  <span className={styles.mtErrorMsg}>{errorMsg}</span>
                                )}
                                {isLab && !hall && (
                                  <span className={styles.mtHallWarning} style={{ color: "#f44336", fontSize: "8px", display: "block" }}>
                                    ⚠ Hall req.
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  });
                })}
            </tbody>
          </table>
        </div>

        <div className={styles.srWrapper}>
          <table className={styles.srTable}>
            <thead>
              <tr>
                <th>Subject Code</th>
                <th>Subject Name</th>
                <th>Category</th>
                <th>Staff Name</th>
                <th>Staff Code</th>
                <th>Faculty ID</th>
              </tr>
            </thead>
            <tbody>
              {referenceRows.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center", color: "#888" }}>
                    No entries yet
                  </td>
                </tr>
              ) : (
                referenceRows.map((row, idx) => (
                  <tr key={idx}>
                    <td>{row.subjectCode}</td>
                    <td className={styles.leftAlign}>{row.subjectName}</td>
                    <td>{row.category}</td>
                    <td className={styles.leftAlign}>{row.staffName}</td>
                    <td>{row.staffCode}</td>
                    <td>{row.facultyId}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.sign}>
          <p>HOD</p>
          <p>PRINCIPAL</p>
        </div>
      </div>

      {popup && (
        <div className={styles.mtPopupOverlay} onClick={closePopup}>
          <div
            className={styles.mtPopup}
            style={{ top: popup.y, left: popup.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={popupInputRef}
              type="text"
              className={styles.mtPopupSearch}
              placeholder={
                popup.type === "subject"
                  ? "Search subject code / name"
                  : popup.type === "staff"
                  ? "Search staff code / name"
                  : "Search hall code / name"
              }
              value={popup.search}
              onChange={(e) => setPopup((prev) => ({ ...prev, search: e.target.value }))}
            />
            <div className={styles.mtPopupList}>
              {popup.type === "subject" &&
                filterSubjects(popup.search).map((s) => (
                  <div key={s._id} className={styles.mtPopupItem} onClick={() => handleSelectSubject(s)}>
                    <span className={styles.mtPopupItemCode}>{getSubjectCode(s)}</span>
                    <span className={styles.mtPopupItemName}>{getSubjectName(s)}</span>
                  </div>
                ))}

              {popup.type === "staff" &&
                filterStaff(
                  popup.search,
                  popup.dayNum,
                  popup.periodNum,
                  popup.entryKey,
                  entries[popup.entryKey]?.subject?._id
                ).map((s) => (
                  <div key={s._id} className={styles.mtPopupItem} onClick={() => handleSelectStaff(s)}>
                    <span className={styles.mtPopupItemCode}>{getStaffCode(s)}</span>
                    <span className={styles.mtPopupItemName}>{getStaffName(s)}</span>
                  </div>
                ))}

              {popup.type === "hall" &&
                filterHalls(
                  popup.search,
                  popup.dayNum,
                  popup.periodNum,
                  popup.entryKey
                ).map((h) => (
                  <div key={h._id} className={styles.mtPopupItem} onClick={() => handleSelectHall(h)}>
                    <span className={styles.mtPopupItemCode}>{getHallCode(h)}</span>
                    <span className={styles.mtPopupItemName}>{getHallName(h)}</span>
                  </div>
                ))}

              {popup.type === "subject" && filterSubjects(popup.search).length === 0 && (
                <div className={styles.mtPopupEmpty}>No subjects found</div>
              )}
              {popup.type === "staff" &&
                filterStaff(
                  popup.search,
                  popup.dayNum,
                  popup.periodNum,
                  popup.entryKey,
                  entries[popup.entryKey]?.subject?._id
                ).length === 0 && (
                  <div className={styles.mtPopupEmpty}>No available staff</div>
                )}
              {popup.type === "hall" &&
                filterHalls(popup.search, popup.dayNum, popup.periodNum, popup.entryKey).length === 0 && (
                  <div className={styles.mtPopupEmpty}>No available halls</div>
                )}
            </div>

            {(popup.type === "subject" || popup.type === "staff") &&
              (entries[popup.entryKey]?.subject || entries[popup.entryKey]?.staff) && (
                <div
                  className={styles.mtPopupItem}
                  style={{ justifyContent: "center", color: "#f44336", fontWeight: "bold" }}
                  onClick={() => {
                    const { dayNum, branch, periodNum, entryKey } = popup;
                    closePopup();
                    handleDeleteCell(dayNum, branch, periodNum, entryKey);
                  }}
                >
                  ✕ Clear this slot
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
}