"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";;
import styles from "./hall-timetable.module.css";
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

export default function HallTimetablePage() {
 const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL + "/api",
  withCredentials: true,
});
  const [academicYear, setAcademicYear] = useState(getDefaultAcademicYear());
  const [semesterType, setSemesterType] = useState("ODD");
  const [wef, setWef] = useState("");
  const [hallList, setHallList] = useState([]);
  const [selectedHall, setSelectedHall] = useState(null);
  const [hallTimetableData, setHallTimetableData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

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

  // ---------- HELPER: format staff full name ----------
  const getStaffFullName = (staff) => {
    if (!staff) return "";
    const { prefix = "", first_name = "", last_name = "" } = staff;
    return `${prefix} ${first_name} ${last_name}`.trim().replace(/\s+/g, " ");
  };

  // ---------- INITIAL FETCHES ----------
  useEffect(() => {
    const currentYear = new Date().getFullYear();
    setAcademicYear(`${currentYear}-${currentYear + 1}`);

    const fetchHalls = async () => {
      try {
        // ✅ Use /admin/hall/all
        const res = await api.get("/admin/hall/all", { params: { limit: 1000 } });
        setHallList(res.data.data || []);
      } catch (err) {
        console.error("Failed to load hall list", err);
      }
    };
    fetchHalls();

    setWef(new Date().toISOString().split("T")[0]);
  }, []);

  // ---------- FETCH HALL TIMETABLE ----------
  const fetchHallTimetable = async (hallId = null, search = "") => {
    setLoading(true);
    try {
      const params = { academicYear, semesterType };
      if (hallId) {
        params.hallId = hallId;
      } else if (search) {
        params.search = search;
      }

      // ✅ Use /admin/timetable/hallview with semesterType filter
      const res = await api.get("/admin/timetable/hallview", { params });
      setHallTimetableData(res.data.data || []);
    } catch (err) {
      console.error("Failed to load hall timetable", err);
      setHallTimetableData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!academicYear) return;
    if (selectedHall) {
      fetchHallTimetable(selectedHall._id);
    } else {
      setHallTimetableData([]);
    }
  }, [academicYear, selectedHall, semesterType]);

  // ---------- FILTERED HALL LIST FOR DROPDOWN ----------
  const filteredHalls = useMemo(() => {
    if (!searchQuery) return hallList;
    const q = searchQuery.toUpperCase();
    return hallList.filter(h =>
      h.hallName?.toUpperCase().includes(q) ||
      h.hallCode?.toUpperCase().includes(q)
    );
  }, [hallList, searchQuery]);

  // ---------- GROUP DATA FOR TABLE ----------
  const timetableMatrix = useMemo(() => {
    if (!hallTimetableData.length) return {};
    const matrix = {};

    hallTimetableData.forEach(entry => {
      if (!entry.hall || !entry.subject) return;
      const key = `${entry.day}__${entry.period}`;
      if (!matrix[key]) matrix[key] = [];

      // Use backend-computed staffName if available, else build it
      const staffName = entry.staffName || getStaffFullName(entry.staff);
      const staffCode = entry.staff?.staff_code || "";

      matrix[key].push({
        department: entry.department,
        year: entry.year,
        subjectId: entry.subject._id,
        subjectCode: entry.subject.subjectCode,
        subjectName: entry.subject.subjectName,
        staffId: entry.staff?._id || '',
        staffName: staffName,
        staffCode: staffCode,
      });
    });

    // Group by subject+staff within each period
    const groupedMatrix = {};
    Object.keys(matrix).forEach(key => {
      const slots = matrix[key];
      const groupMap = new Map();
      slots.forEach(slot => {
        const groupKey = `${slot.subjectId}_${slot.staffId}`;
        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, {
            subjectCode: slot.subjectCode,
            subjectName: slot.subjectName,
            staffCode: slot.staffCode,
            staffName: slot.staffName,
            classes: [],
          });
        }
        groupMap.get(groupKey).classes.push(`${slot.department} ${slot.year}`);
      });
      groupedMatrix[key] = Array.from(groupMap.values()).map(group => ({
        ...group,
        classes: group.classes.join(', '),
      }));
    });

    return groupedMatrix;
  }, [hallTimetableData]);

  // ---------- UNIQUE SUBJECTS + STAFF NAMES TAUGHT IN THIS HALL ----------
  const hallSubjects = useMemo(() => {
    if (!hallTimetableData.length) return [];
    const map = new Map();

    hallTimetableData.forEach(entry => {
      if (!entry.subject) return;
      const sub = entry.subject;
      const id = sub._id;
      if (!map.has(id)) {
        map.set(id, {
          subjectCode: sub.subjectCode,
          subjectName: sub.subjectName,
          category: sub.Category || sub.category || "",
          staffNames: new Set(),
        });
      }
      // Use backend-computed staffName if available
      const staffName = entry.staffName || getStaffFullName(entry.staff);
      if (staffName) map.get(id).staffNames.add(staffName);
    });

    return Array.from(map.values()).map(item => ({
      ...item,
      staffNames: Array.from(item.staffNames).join(", "),
    }));
  }, [hallTimetableData]);

  // ---------- PDF EXPORT (unchanged) ----------
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
          renderedHeight += sliceHeight;
          continue;
        }

        if (pageNum > 0) pdf.addPage();
        pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, sliceHeight * ratio);

        renderedHeight += sliceHeight;
        pageNum++;
      }

      const filename = selectedHall
        ? `HallTimetable_${selectedHall.hallCode || selectedHall.hallName}.pdf`
        : "HallTimetable.pdf";
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
      {/* Top controls */}
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
            placeholder="Search hall..."
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            className={styles.searchInput}
          />
          {showDropdown && filteredHalls.length > 0 && (
            <ul className={styles.dropdown}>
              {filteredHalls.slice(0, 20).map(hall => (
                <li
                  key={hall._id}
                  onClick={() => {
                    setSelectedHall(hall);
                    setSearchQuery(`${hall.hallCode || ""} - ${hall.hallName}`);
                    setShowDropdown(false);
                  }}
                >
                  {hall.hallCode} - {hall.hallName}
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          className={styles.clearbtn}
          onClick={() => {
            setSelectedHall(null);
            setSearchQuery("");
            setShowDropdown(false);
          }}
        >
          Clear
        </button>

        <button
          onClick={handleDownloadPdf}
          className={styles.pdfButton}
          disabled={!selectedHall}
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
          <h3>HALL TIMETABLE</h3>
          <span> ({academicYear}) </span>
          <span> ({semesterType}) </span>
        </div>

        <div className={styles.wefRow}>
          <p>w.e.f: <input type="date" value={wef} readOnly /></p>
        </div>

        {selectedHall && (
          <div className={styles.hallInfo}>
            <p><strong>Hall Name:</strong> {selectedHall.hallName}</p>
            <p><strong>Hall Code:</strong> {selectedHall.hallCode}</p>
            <p><strong>Capacity:</strong> {selectedHall.capacity || "---"}</p>
          </div>
        )}

        <div className={styles.tableWrapper}>
          <table className={styles.hallTable}>
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
              {!selectedHall ? (
                <tr>
                  <td colSpan={columns.length + 1} className={styles.emptyMsg}>
                    Select a hall to view its timetable
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
                        const groups = timetableMatrix[key] || [];

                        return (
                          <td key={idx} className={styles.periodCell}>
                            <div className={styles.periodContent}>
                              {groups.length > 0 ? (
                                groups.map((group, gi) => (
                                  <div key={gi} className={styles.mergedSlot}>
                                    <span className={styles.classesList}>
                                      {group.classes}
                                    </span>
                                    <span className={styles.subjectCode}>
                                      {group.subjectCode}
                                    </span>
                                    <span className={styles.staffCode}>
                                      {group.staffCode}
                                    </span>
                                  </div>
                                ))
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
        {selectedHall && hallSubjects.length > 0 && (
          <div className={styles.srWrapper}>
            <table className={styles.srTable}>
              <thead>
                <tr>
                  <th>Subject Code</th>
                  <th>Subject Name</th>
                  <th>Staff Name</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {hallSubjects.map((row, idx) => (
                  <tr key={idx}>
                    <td>{row.subjectCode}</td>
                    <td className={styles.leftAlign}>{row.subjectName}</td>
                    <td>{row.staffNames || "—"}</td>
                    <td>{row.category}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className={styles.footer}>
          <div className={styles.creditLine}>
            Generated via NI‑Timetable Management System | © {new Date().getFullYear()} Department of Artificial Intelligence and Data Science, Noorul Islam College of Engineering and Technology. All Rights Reserved.
          </div>
        </div>
      </div>
    </div>
  );
}