"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import axios from "axios";
import {
  Calendar,
  Download,
  RotateCw,
  Layers,
  ArrowLeft,
  FileSpreadsheet,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import styles from "../examTimetable.module.css";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const api = axios.create({ baseURL: BASE_URL, withCredentials: true });

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

export default function ClassWiseExamTimetablePage() {
  const router = useRouter();
  const pathname = usePathname();
  const basePath = pathname?.startsWith("/hod") ? "/hod" : "/admin";
  const pdfContainerRef = useRef(null);

  // ---------- FILTERS STATE ----------
  const [examName, setExamName] = useState("");
  const [examList, setExamList] = useState([]);
  const [academicYear, setAcademicYear] = useState(getDefaultAcademicYear());
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedYear, setSelectedYear] = useState(1);
  const [selectedSemester, setSelectedSemester] = useState(1);

  const [timetableData, setTimetableData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  const years = [
    { label: "I", value: 1 },
    { label: "II", value: 2 },
    { label: "III", value: 3 },
    { label: "IV", value: 4 },
  ];

  // Helper: auto sync semester when year changes
  const handleYearChange = (yr) => {
    const yrNum = Number(yr);
    setSelectedYear(yrNum);
    // If current semester doesn't belong to this year, switch to the odd semester of this year
    const oddSem = yrNum * 2 - 1;
    const evenSem = yrNum * 2;
    if (selectedSemester !== oddSem && selectedSemester !== evenSem) {
      setSelectedSemester(oddSem);
    }
  };

  // Helper: format date
  const formatDateDisplay = (dStr) => {
    if (!dStr) return "";
    try {
      const parts = dStr.split("-");
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dStr;
    } catch {
      return dStr;
    }
  };

  // ---------- INITIAL LOAD ----------
  useEffect(() => {
    const currentYear = new Date().getFullYear();
    setAcademicYear(`${currentYear}-${currentYear + 1}`);

    // Fetch departments
    const fetchDepts = async () => {
      try {
        const res = await api.get("/api/admin/department/all");
        if (res.data?.data) {
          const depts = res.data.data.map((d) => d.code.toUpperCase());
          setDepartments(depts);
          if (depts.length > 0) setSelectedDept(depts[0]);
        }
      } catch (err) {
        console.error("Failed to load departments:", err);
      }
    };

    fetchDepts();
  }, []);

  // Fetch list of saved exams for academicYear
  useEffect(() => {
    const fetchExamList = async () => {
      try {
        const res = await api.get("/api/exam-timetable/list", {
          params: { academicYear },
        });
        if (res.data?.data) {
          setExamList(res.data.data);
          if (res.data.data.length > 0 && !examName) {
            setExamName(res.data.data[0].examName);
          }
        }
      } catch (err) {
        console.error("Failed to load exam list:", err);
      }
    };
    if (academicYear) fetchExamList();
  }, [academicYear]);

  // ---------- FETCH CLASS EXAM TIMETABLE ----------
  const fetchClassTimetable = async () => {
    if (!selectedDept || !academicYear) return;
    setLoading(true);
    try {
      const res = await api.get("/api/exam-timetable/class", {
        params: {
          department: selectedDept,
          year: selectedYear,
          semester: selectedSemester,
          academicYear,
          examName: examName || undefined,
        },
      });

      if (res.data?.data && res.data.data.length > 0) {
        setTimetableData(res.data.data[0]);
      } else {
        setTimetableData(null);
      }
    } catch (err) {
      if (err.response?.data?.islogout) router.push("/");
      console.error("Fetch class exam timetable error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassTimetable();
  }, [selectedDept, selectedYear, selectedSemester, academicYear, examName]);

  // ---------- BUILD ROWS ----------
  const classRows = React.useMemo(() => {
    if (!timetableData || !timetableData.dates) return [];

    const datesList = timetableData.dates || [];
    const entriesList = timetableData.entries || [];

    return datesList.map((dObj) => {
      const dateVal = dObj.date;
      const fnEntry = entriesList.find(
        (e) => e.date === dateVal && e.session === "FN"
      );
      const anEntry = entriesList.find(
        (e) => e.date === dateVal && e.session === "AN"
      );

      return {
        date: dateVal,
        fn: fnEntry || null,
        an: anEntry || null,
      };
    });
  }, [timetableData]);

  // ---------- EXPORT PORTRAIT PDF (EXACT A4 PROPORTION) ----------
  const handleExportPortraitPDF = async () => {
    if (!pdfContainerRef.current) return;
    setExportingPDF(true);

    try {
      const element = pdfContainerRef.current;

      // Ensure images are fully loaded
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

      // Create an offscreen wrapper with exact A4 portrait printable width (794px at 96 DPI)
      const wrapper = document.createElement("div");
      wrapper.style.position = "absolute";
      wrapper.style.left = "-9999px";
      wrapper.style.top = "0";
      wrapper.style.width = "794px";
      wrapper.style.padding = "24px";
      wrapper.style.background = "#ffffff";
      wrapper.style.boxSizing = "border-box";

      const clone = element.cloneNode(true);
      clone.style.border = "none";
      clone.style.boxShadow = "none";
      clone.style.margin = "0";
      clone.style.padding = "0";
      clone.style.maxWidth = "100%";
      clone.style.width = "100%";

      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);

      const canvas = await html2canvas(wrapper, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: 794,
      });

      document.body.removeChild(wrapper);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm
      const margin = 8; // 8mm margin
      const printWidth = pdfWidth - margin * 2; // 194mm
      const printHeight = pdfHeight - margin * 2; // 281mm

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

      pdf.save(`Class_Exam_Timetable_${selectedDept}_Yr${selectedYear}_Sem${selectedSemester}.pdf`);
    } catch (err) {
      console.error("PDF export error:", err);
      alert("Failed to export PDF: " + err.message);
    } finally {
      setExportingPDF(false);
    }
  };

  const yearLabel = ["I", "II", "III", "IV"][selectedYear - 1] || "I";

  return (
    <div className={styles.mcontainer}>
      <div className={styles.container}>
        {/* Top Header */}
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.title}>
              <Layers size={26} color="#2563eb" /> Class-Wise Exam Timetable
            </h1>
            <p className={styles.subtitle}>
              View and download department and class-specific internal assessment timetables
            </p>
          </div>

          <div className={styles.actionsGroup}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => router.push(`${basePath}/exam-timetable/master`)}
            >
              <FileSpreadsheet size={15} /> Master Matrix View
            </button>

            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleExportPortraitPDF}
              disabled={exportingPDF || !timetableData}
            >
              <Download size={15} /> {exportingPDF ? "Exporting..." : "Download Class PDF (Portrait)"}
            </button>
          </div>
        </div>

        {/* Filters Card (Matching Diagram #2) */}
        <div className={styles.filterCard}>
          <div className={styles.filterGrid}>
            <div className={styles.formGroup}>
              <label>Exam Name</label>
              {examList.length > 0 ? (
                <select
                  className={styles.formSelect}
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                >
                  {examList.map((ex) => (
                    <option key={ex._id} value={ex.examName}>
                      {ex.examName} ({ex.semesterType})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className={styles.formInput}
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  placeholder="e.g. Internal Assessment Test 1"
                />
              )}
            </div>

            <div className={styles.formGroup}>
              <label>Department</label>
              <select
                className={styles.formSelect}
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
              >
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Year</label>
              <select
                className={styles.formSelect}
                value={selectedYear}
                onChange={(e) => handleYearChange(e.target.value)}
              >
                {years.map((y) => (
                  <option key={y.value} value={y.value}>
                    Year {y.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Semester</label>
              <select
                className={styles.formSelect}
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(Number(e.target.value))}
              >
                {[selectedYear * 2 - 1, selectedYear * 2].map((s) => (
                  <option key={s} value={s}>
                    Semester {s}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Academic Year</label>
              <select
                className={styles.formSelect}
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
              >
                {getAcademicYearOptions(academicYear).map((ay) => (
                  <option key={ay} value={ay}>
                    {ay}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Notice Board Card View */}
        {loading ? (
          <p style={{ textAlign: "center", color: "#64748b", padding: "40px" }}>
            Loading class exam timetable...
          </p>
        ) : !timetableData || classRows.length === 0 ? (
          <div style={{ textAlign: "center", background: "#ffffff", padding: "50px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <Calendar size={40} color="#cbd5e1" style={{ margin: "0 auto 12px" }} />
            <h3 style={{ margin: "0 0 6px 0", color: "#334155" }}>No Exam Timetable Found</h3>
            <p style={{ color: "#64748b", fontSize: "13.5px", margin: 0 }}>
              No exam schedule has been assigned for {selectedDept} Year {yearLabel} (Sem {selectedSemester}) under {academicYear}.
            </p>
          </div>
        ) : (
          <div className={styles.noticeCard} ref={pdfContainerRef}>
            {/* College Logo Banner */}
            <div className={styles.collegeHeader}>
              <img
                src="/nilogo.png"
                alt="College Logo"
                width="746"
                height="111.6"
                className={styles.collegeLogo}
                style={{ width: "746px", height: "111.6px", maxWidth: "100%" }}
              />
              <h2 className={styles.examNoticeTitle}>
                {(timetableData.examName || examName).toUpperCase()}
              </h2>
            </div>

            {/* Metadata Grid (Matching diagram #2) */}
            <div className={styles.noticeMetaGrid}>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Department:</span>
                <span className={styles.metaValue}>{selectedDept}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Academic Year:</span>
                <span className={styles.metaValue}>{academicYear}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Year / Semester:</span>
                <span className={styles.metaValue}>{yearLabel} / {selectedSemester}</span>
              </div>
            </div>

            {/* Timetable Table */}
            <table className={styles.classTable}>
              <thead>
                <tr>
                  <th className={styles.dateCol}>Date</th>
                  <th className={styles.sessionCol}>Forenoon (F.N)</th>
                  <th className={styles.sessionCol}>Afternoon (A.N)</th>
                </tr>
              </thead>
              <tbody>
                {classRows.map((row) => (
                  <tr key={row.date}>
                    <td className={styles.dateCol}>
                      {formatDateDisplay(row.date)}
                    </td>
                    <td className={styles.sessionCol}>
                      {row.fn ? (
                        <div>
                          <div style={{ fontWeight: 800, fontSize: "16.5px", color: "#0f172a", marginBottom: "4px", letterSpacing: "0.25px" }}>
                            {row.fn.subjectCode}
                          </div>
                          <div style={{ fontSize: "14.5px", fontWeight: 600, color: "#1e293b", lineHeight: "1.45" }}>
                            {row.fn.subjectName}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: "#94a3b8", fontWeight: 800, fontSize: "20px" }}>—</span>
                      )}
                    </td>
                    <td className={styles.sessionCol}>
                      {row.an ? (
                        <div>
                          <div style={{ fontWeight: 800, fontSize: "16.5px", color: "#0f172a", marginBottom: "4px", letterSpacing: "0.25px" }}>
                            {row.an.subjectCode}
                          </div>
                          <div style={{ fontSize: "14.5px", fontWeight: 600, color: "#1e293b", lineHeight: "1.45" }}>
                            {row.an.subjectName}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: "#94a3b8", fontWeight: 800, fontSize: "20px" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Bottom ERP Footer */}
            <div className={styles.noticeFooter}>
              <span>Generated via NICETECH ERP System</span>
              <span>Generated on: {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} at {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
