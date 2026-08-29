"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { Smartphone, FileText } from "lucide-react";
import StaffAssignedView from "@/app/components/StaffAssignedView";
import styles from "./staff-timetable.module.css";
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

export default function StaffTimetablePage() {
  const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL + "/api",
  withCredentials: true,
});

  const [academicYear, setAcademicYear] = useState(getDefaultAcademicYear());
  const [semesterType, setSemesterType] = useState("ODD");
  const [wef, setWef] = useState("");
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [staffTimetableData, setStaffTimetableData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [viewMode, setViewMode] = useState("reference");

  const pdfContainerRef = useRef(null);
  const searchRef = useRef(null);

  // ---------- COLUMN DEFINITIONS ----------
  const columns = [
    { type: "period", label: "P1", period: 1 },
    { type: "period", label: "P2", period: 2 },
    { type: "merge", label: "BREAK", key: "break1" },
    { type: "period", label: "P3", period: 3 },
    { type: "period", label: "P4", period: 4 },
    { type: "merge", label: "LUNCH", key: "lunch" },
    { type: "period", label: "P5", period: 5 },
    { type: "period", label: "P6", period: 6 },
    { type: "merge", label: "BREAK", key: "break2" },
    { type: "period", label: "P7", period: 7 },
  ];

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const dayMap = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5 };

  // ---------- HELPERS FOR STAFF FIELDS ----------
  const getStaffFullName = (staff) => {
    if (!staff) return "";
    const { prefix = "", first_name = "", last_name = "" } = staff;
    return `${prefix} ${first_name} ${last_name}`.trim().replace(/\s+/g, " ");
  };

  const getStaffDisplay = (staff) => {
    if (!staff) return "";
    const code = staff.staff_code || "";
    const name = getStaffFullName(staff);
    return code ? `${code} - ${name}` : name;
  };

  // ---------- INITIAL FETCHES ----------
  useEffect(() => {
    const currentYear = new Date().getFullYear();
    setAcademicYear(`${currentYear}-${currentYear + 1}`);

    const fetchStaff = async () => {
      try {
        // ✅ Use /admin/staff/all
        const res = await api.get("/admin/staff/all", { params: { limit: 1000 } });
        setStaffList(res.data.data|| []);
      } catch (err) {
        console.error("Failed to load staff list", err);
      }
    };
    fetchStaff();

    setWef(new Date().toISOString().split("T")[0]);
  }, []);

  // ---------- FETCH STAFF TIMETABLE ----------
  const fetchStaffTimetable = async (staffId = null, search = "") => {
    setLoading(true);
    try {
      const params = { academicYear, semesterType };
      if (staffId) {
        params.staffId = staffId;
      } else if (search) {
        params.search = search;
      }

      // ✅ Use /admin/timetable/staffview with semesterType filter
      const res = await api.get("/admin/timetable/staffview", { params });
      setStaffTimetableData(res.data.data || []);
    } catch (err) {
      console.error("Failed to load staff timetable", err);
      setStaffTimetableData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!academicYear) return;
    if (selectedStaff) {
      fetchStaffTimetable(selectedStaff._id);
    } else {
      setStaffTimetableData([]);
    }
  }, [academicYear, selectedStaff, semesterType]);

  // ---------- FILTERED STAFF LIST FOR DROPDOWN ----------
  const filteredStaff = useMemo(() => {
    if (!searchQuery) return staffList;
    const q = searchQuery.toUpperCase();
    return staffList.filter(s => {
      const fullName = getStaffFullName(s).toUpperCase();
      const code = (s.staff_code || "").toUpperCase();
      return fullName.includes(q) || code.includes(q);
    });
  }, [staffList, searchQuery]);

  // ---------- GROUP DATA FOR TABLE ----------
  const timetableMatrix = useMemo(() => {
    if (!staffTimetableData.length) return {};
    const matrix = {};
    staffTimetableData.forEach(entry => {
      if (!entry.staff || !entry.subject) return;
      const key = `${entry.day}__${entry.period}`;
      matrix[key] = {
        department: entry.department,
        year: entry.year,
        subjectCode: entry.subject.subjectCode,
        subjectName: entry.subject.subjectName,
      };
    });
    return matrix;
  }, [staffTimetableData]);

  // ---------- UNIQUE SUBJECTS FOR THIS STAFF ----------
  const staffSubjects = useMemo(() => {
    if (!staffTimetableData.length) return [];
    const seen = new Map();
    staffTimetableData.forEach(entry => {
      if (!entry.subject || !entry.staff) return;
      const sub = entry.subject;
      const key = sub._id;
      if (!seen.has(key)) {
        seen.set(key, {
          subjectCode: sub.subjectCode,
          subjectName: sub.subjectName,
          category: sub.Category || sub.category || "",
        });
      }
    });
    return Array.from(seen.values());
  }, [staffTimetableData]);

  // ---------- PDF EXPORT (unchanged but uses selected staff) ----------
  const trimCanvasBottom = (canvas) => {
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;
    const imageData = ctx.getImageData(0, 0, width, height).data;

    let lastNonBlankRow = 0;
    for (let y = height - 1; y >= 0; y--) {
      let rowHasContent = false;
      const rowStart = y * width * 4;
      for (let x = 0; x < width; x++) {
        const idx = rowStart + x * 4;
        const r = imageData[idx];
        const g = imageData[idx + 1];
        const b = imageData[idx + 2];
        const a = imageData[idx + 3];
        if (a > 0 && !(r > 250 && g > 250 && b > 250)) {
          rowHasContent = true;
          break;
        }
      }
      if (rowHasContent) {
        lastNonBlankRow = y;
        break;
      }
    }
    const padding = 20;
    const trimmedHeight = Math.min(height, lastNonBlankRow + padding);
    if (trimmedHeight >= height) return canvas;
    const trimmedCanvas = document.createElement("canvas");
    trimmedCanvas.width = width;
    trimmedCanvas.height = trimmedHeight;
    trimmedCanvas.getContext("2d").drawImage(canvas, 0, 0);
    return trimmedCanvas;
  };

  const handleDownloadPdf = async () => {
    const element = pdfContainerRef.current;
    if (!element) return;

    const images = element.querySelectorAll("img");
    await Promise.all(
      Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
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
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      let canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      });

      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        throw new Error("Canvas is empty – check logo or visibility.");
      }

      canvas = trimCanvasBottom(canvas);

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const ratio = pdfWidth / canvas.width;
      const pageHeightInCanvasPx = Math.floor(pdfHeight / ratio);

      let renderedHeight = 0;
      let pageNum = 0;

      while (renderedHeight < canvas.height) {
        const remaining = canvas.height - renderedHeight;
        let sliceHeight = Math.min(pageHeightInCanvasPx, Math.round(remaining));
        if (sliceHeight < 1) break;

        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const ctx = pageCanvas.getContext("2d");
        ctx.drawImage(
          canvas,
          0, renderedHeight, canvas.width, sliceHeight,
          0, 0, canvas.width, sliceHeight
        );

        const dataUrl = pageCanvas.toDataURL("image/png");
        if (!dataUrl || dataUrl === "data:," || dataUrl.length < 50) {
          console.error("Empty slice canvas, skipping page", pageNum);
          renderedHeight += sliceHeight;
          continue;
        }

        if (pageNum > 0) pdf.addPage();
        pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, sliceHeight * ratio);

        renderedHeight += sliceHeight;
        pageNum++;
      }

      const filename = selectedStaff
        ? `StaffTimetable_${selectedStaff.staff_code || selectedStaff.staff_id}.pdf`
        : "StaffTimetable.pdf";
      pdf.save(filename);
    } catch (err) {
      console.error("PDF generation error:", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      element.style.overflow = originalOverflow;
      element.style.maxHeight = originalMaxHeight;
    }
  };

  // ---------- RENDER ----------
  return (
    <div className={styles.pageWrapper}>
      {/* Top View Mode Selector */}
      <div style={{ width: "100%", maxWidth: "1200px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
          Staff Timetable & Assigned Subjects
        </h2>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={() => setViewMode("reference")}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              border: viewMode === "reference" ? "2px solid #0284c7" : "1px solid #cbd5e1",
              background: viewMode === "reference" ? "#0284c7" : "#ffffff",
              color: viewMode === "reference" ? "#ffffff" : "#334155",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Smartphone size={15} /> Mobile & Digital View
          </button>
          <button
            type="button"
            onClick={() => setViewMode("pdf")}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              border: viewMode === "pdf" ? "2px solid #0284c7" : "1px solid #cbd5e1",
              background: viewMode === "pdf" ? "#0284c7" : "#ffffff",
              color: viewMode === "pdf" ? "#ffffff" : "#334155",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <FileText size={15} /> Official Printable / PDF View
          </button>
        </div>
      </div>

      {viewMode === "reference" ? (
        <StaffAssignedView
          role="Admin"
          allowStaffSelection={true}
          initialStaffId={selectedStaff?._id}
        />
      ) : (
        <>
          {/* Top controls for PDF View */}
          <div className={styles.controls}>
            <select
              value={academicYear}
              onChange={e => setAcademicYear(e.target.value)}
              className={styles.filterSelect}
            >
              {getAcademicYearOptions(academicYear).map((ay) => (
                <option key={ay} value={ay}>{ay}</option>
              ))}
            </select>

            <select
              value={semesterType}
              onChange={e => setSemesterType(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="ODD">ODD</option>
              <option value="EVEN">EVEN</option>
            </select>

            <div className={styles.searchContainer} ref={searchRef}>
              <input
                type="text"
                placeholder="Search staff..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                className={styles.searchInput}
              />
              {showDropdown && filteredStaff.length > 0 && (
                <ul className={styles.dropdown}>
                  {filteredStaff.slice(0, 20).map(staff => (
                    <li
                      key={staff._id}
                      onClick={() => {
                        setSelectedStaff(staff);
                        setSearchQuery(getStaffDisplay(staff));
                        setShowDropdown(false);
                      }}
                    >
                      {getStaffDisplay(staff)}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              className={styles.clearbtn}
              onClick={() => {
                setSelectedStaff(null);
                setSearchQuery("");
                setShowDropdown(false);
              }}
            >
              Clear
            </button>

            <button
              onClick={handleDownloadPdf}
              className={styles.pdfButton}
              disabled={!selectedStaff}
            >
              DOWNLOAD PDF
            </button>
          </div>

          {/* Timetable display */}
          <div className={styles.container} ref={pdfContainerRef}>
            <div className={styles.header}>
          <img src="/nilogo.png" alt="College Logo" width="700" height="104.3" />
        </div>

        <div className={styles.titleRow}>
          <h3>STAFF TIMETABLE</h3>
          <span> ({academicYear}) </span>
          <span> ({semesterType}) </span>
        </div>

        <div className={styles.wefRow}>
          <p>w.e.f: <input type="date" value={wef} readOnly /></p>
        </div>

        {selectedStaff && (
          <div className={styles.staffInfo}>
            <p><strong>Staff Name:</strong> {getStaffFullName(selectedStaff)}</p>
            <p><strong>Staff Code:</strong> {selectedStaff.staff_code}</p>
            <p><strong>Staff ID:</strong> {selectedStaff.staff_id}</p>
          </div>
        )}

        <div className={styles.tableWrapper}>
          <table className={styles.staffTable}>
            <colgroup>
              <col className={styles.colDay} />
              {columns.map((col, i) => (
                <col
                  key={i}
                  className={col.type === "merge" ? styles.colBreak : styles.colPeriod}
                />
              ))}
            </colgroup>

            <thead>
              <tr>
                <th className={styles.dayHead}>Day</th>
                {columns.map((col, i) => (
                  <th key={i}>{col.label}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {!selectedStaff ? (
                <tr>
                  <td colSpan={columns.length + 1} className={styles.emptyMsg}>
                    Select a staff member to view their timetable
                  </td>
                </tr>
              ) : loading ? (
                <tr>
                  <td colSpan={columns.length + 1} className={styles.emptyMsg}>
                    Loading...
                  </td>
                </tr>
              ) : (
                days.map((day, dayIdx) => {
                  const dayNum = dayMap[day];
                  return (
                    <tr key={day}>
                      <td className={styles.dayCell}>{day}</td>
                      {columns.map((col, idx) => {
                        if (col.type === "merge") {
                          if (dayIdx !== 0) return null;
                          return (
                            <td
                              key={col.key}
                              className={styles.breakColumn}
                              rowSpan={days.length}
                            >
                              <span>{col.label}</span>
                            </td>
                          );
                        }

                        const key = `${dayNum}__${col.period}`;
                        const slot = timetableMatrix[key];
                        return (
                          <td key={idx} className={styles.periodCell}>
                            <div className={styles.periodContent}>
                              {slot ? (
                                <>
                                  <span className={styles.classInfo}>
                                    {slot.department} {slot.year}
                                  </span>
                                  <span className={styles.subjectCode}>
                                    {slot.subjectCode}
                                  </span>
                                </>
                              ) : (
                                <span className={styles.emptyCell}>-</span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Subject reference table */}
        {selectedStaff && staffSubjects.length > 0 && (
          <div className={styles.srWrapper}>
            <table className={styles.srTable}>
              <thead>
                <tr>
                  <th>Subject Code</th>
                  <th>Subject Name</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {staffSubjects.map((row, idx) => (
                  <tr key={idx}>
                    <td>{row.subjectCode}</td>
                    <td className={styles.leftAlign}>{row.subjectName}</td>
                    <td>{row.category}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

          <div className={styles.footer}>
            <div className={styles.creditLine}>
              Generated via NICETECH ERP System on {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} at {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
            </div>
          </div>
        </div>
      </>
      )}
    </div>
  );
}