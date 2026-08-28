"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  Calendar,
  Download,
  ArrowLeft,
  GraduationCap,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import styles from "../../admin/exam-timetable/examTimetable.module.css";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const api = axios.create({ baseURL: BASE_URL, withCredentials: true });

// Sub-component for individual Timetable Notice Card with its own PDF downloader
function StudentTimetableCard({ timetable, studentInfo, isLatest }) {
  const cardRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

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

  const datesList = timetable.dates || [];
  const entriesList = timetable.entries || [];

  const rows = datesList.map((dObj) => {
    const dateVal = dObj.date;
    const fnEntry = entriesList.find((e) => e.date === dateVal && e.session === "FN");
    const anEntry = entriesList.find((e) => e.date === dateVal && e.session === "AN");

    return {
      date: dateVal,
      fn: fnEntry || null,
      an: anEntry || null,
    };
  });

  const yrLabel = ["I", "II", "III", "IV"][(studentInfo?.year || 1) - 1] || "I";

  const handleDownloadPDF = async () => {
    if (!cardRef.current) return;
    setDownloading(true);

    try {
      const element = cardRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm
      const margin = 10;
      const printWidth = pdfWidth - margin * 2; // 190mm
      const printHeight = pdfHeight - margin * 2; // 277mm

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

      pdf.save(`Exam_Timetable_${timetable.examName}_Sem${studentInfo?.semester}.pdf`);
    } catch (err) {
      console.error("PDF export error:", err);
      alert("Failed to export PDF: " + err.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div style={{ marginBottom: "40px" }}>
      {/* Top Card Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: "920px", margin: "0 auto 12px auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
            {timetable.examName}
          </span>
          {isLatest && (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "#16a34a",
                background: "#dcfce7",
                padding: "3px 8px",
                borderRadius: "4px",
              }}
            >
              Latest Timetable
            </span>
          )}
        </div>

        <button
          type="button"
          className={styles.btnPrimary}
          onClick={handleDownloadPDF}
          disabled={downloading}
        >
          <Download size={14} /> {downloading ? "Exporting..." : `Download ${timetable.examName} PDF`}
        </button>
      </div>

      {/* Printable Card */}
      <div className={styles.noticeCard} ref={cardRef}>
        {/* College Logo Banner */}
        <div className={styles.collegeHeader}>
          <img
            src="/nilogo.png"
            alt="College Logo"
            className={styles.collegeLogo}
            style={{ width: "580px", maxWidth: "100%", height: "auto" }}
          />
          <h2 className={styles.examNoticeTitle}>
            {timetable.examName.toUpperCase()}
          </h2>
        </div>

        {/* Metadata Grid */}
        <div className={styles.noticeMetaGrid}>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Department:</span>
            <span className={styles.metaValue}>{studentInfo?.department_code || studentInfo?.department}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Academic Year:</span>
            <span className={styles.metaValue}>{studentInfo?.academic_year || timetable.academicYear}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Year / Semester:</span>
            <span className={styles.metaValue}>Year {yrLabel} / Semester {studentInfo?.semester}</span>
          </div>
        </div>

        {/* Table */}
        <table className={styles.classTable}>
          <thead>
            <tr>
              <th className={styles.dateCol}>Date</th>
              <th className={styles.sessionCol}>Forenoon (F.N)</th>
              <th className={styles.sessionCol}>Afternoon (A.N)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.date}>
                <td className={styles.dateCol}>
                  {formatDateDisplay(row.date)}
                </td>
                <td className={styles.sessionCol}>
                  {row.fn ? (
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "13px", color: "#0f172a" }}>
                        {row.fn.subjectCode}
                      </div>
                      <div style={{ fontSize: "12px", color: "#334155" }}>
                        {row.fn.subjectName}
                      </div>
                    </div>
                  ) : (
                    <span style={{ color: "#94a3b8", fontWeight: 700 }}>—</span>
                  )}
                </td>
                <td className={styles.sessionCol}>
                  {row.an ? (
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "13px", color: "#0f172a" }}>
                        {row.an.subjectCode}
                      </div>
                      <div style={{ fontSize: "12px", color: "#334155" }}>
                        {row.an.subjectName}
                      </div>
                    </div>
                  ) : (
                    <span style={{ color: "#94a3b8", fontWeight: 700 }}>—</span>
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
    </div>
  );
}

export default function StudentExamTimetablePage() {
  const router = useRouter();

  const [studentInfo, setStudentInfo] = useState(null);
  const [timetablesList, setTimetablesList] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Fetch Student Profile
  useEffect(() => {
    const fetchStudentProfile = async () => {
      try {
        const res = await api.get("/api/student/profile");
        if (res.data?.success) {
          setStudentInfo(res.data.data);
        }
      } catch (err) {
        if (err.response?.data?.islogout) router.push("/");
        console.error("Failed to load student profile:", err);
      }
    };
    fetchStudentProfile();
  }, []);

  // 2. Fetch All Class Timetables for this Student (Sorted latest first)
  const fetchStudentExamSchedules = async () => {
    if (!studentInfo) return;
    setLoading(true);
    try {
      const deptCode = studentInfo.department_code || studentInfo.department;
      const yr = studentInfo.year || 1;
      const sem = studentInfo.semester || 1;
      const acadYear = studentInfo.academic_year || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;

      const res = await api.get("/api/exam-timetable/class", {
        params: {
          department: deptCode,
          year: yr,
          semester: sem,
          academicYear: acadYear,
        },
      });

      if (res.data?.data && res.data.data.length > 0) {
        setTimetablesList(res.data.data);
      } else {
        setTimetablesList([]);
      }
    } catch (err) {
      console.error("Failed to fetch student exam schedule:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (studentInfo) {
      fetchStudentExamSchedules();
    }
  }, [studentInfo]);

  return (
    <div className={styles.mcontainer}>
      <div className={styles.container}>
        {/* Top Header */}
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.title}>
              <Calendar size={26} color="#2563eb" /> My Exam Timetable
            </h1>
            <p className={styles.subtitle}>
              View and download all internal assessment exam schedules for Semester {studentInfo?.semester || 1}
            </p>
          </div>

          <div className={styles.actionsGroup}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => router.push("/student")}
            >
              <ArrowLeft size={15} /> Back to Dashboard
            </button>
          </div>
        </div>

        {/* Timetable Cards List */}
        {loading ? (
          <p style={{ textAlign: "center", color: "#64748b", padding: "40px" }}>
            Loading your exam schedule...
          </p>
        ) : timetablesList.length === 0 ? (
          <div style={{ textAlign: "center", background: "#ffffff", padding: "50px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <Calendar size={40} color="#cbd5e1" style={{ margin: "0 auto 12px" }} />
            <h3 style={{ margin: "0 0 6px 0", color: "#334155" }}>No Exam Schedule Published</h3>
            <p style={{ color: "#64748b", fontSize: "13.5px", margin: 0 }}>
              There is currently no exam timetable scheduled for your class (Semester {studentInfo?.semester || 1}).
            </p>
          </div>
        ) : (
          <div>
            {timetablesList.map((tt, idx) => (
              <StudentTimetableCard
                key={tt._id || idx}
                timetable={tt}
                studentInfo={studentInfo}
                isLatest={idx === 0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
