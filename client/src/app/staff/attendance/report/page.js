'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import styles from './Report.module.css';

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

// Axios instance with credentials
const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

export default function SubjectReportPage() {
  const router = useRouter();

  // State
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState('');
  const [subjectsLoading, setSubjectsLoading] = useState(true);

  const pdfRef = useRef(null);

  // ---------- Unauthorized handler ----------
  const handleUnauthorized = (error) => {
    if (error.response?.data?.islogout === true) {
      router.push('/');
      return true;
    }
    return false;
  };

  // ---------- Fetch subjects on mount ----------
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const res = await api.get('/api/staff/attendance/subjects');
        if (res.data.success) {
          setSubjects(res.data.data);
          if (res.data.data.length > 0) {
            setSelectedSubject(res.data.data[0]._id);
          }
        }
      } catch (err) {
        if (handleUnauthorized(err)) return;
        setError('Failed to load subjects.');
        console.error(err);
      } finally {
        setSubjectsLoading(false);
      }
    };
    fetchSubjects();
  }, []);

  // ---------- Fetch report ----------
  const fetchReport = async () => {
    if (!selectedSubject) {
      setError('Please select a subject.');
      return;
    }
    if (!dateFrom) {
      setError('Please select a From date.');
      return;
    }
    setLoading(true);
    setError('');
    setReportData(null);

    try {
      const params = { subjectId: selectedSubject };
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const res = await api.get('/api/staff/attendance/report/subject', { params });
      if (res.data.success) {
        setReportData(res.data.data);
      }
    } catch (err) {
      if (handleUnauthorized(err)) return;
      const msg = err.response?.data?.message || 'Failed to generate report.';
      setError(msg);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ---------- PDF export with footer on every page ----------
  const handleDownloadPdf = async () => {
    const element = pdfRef.current;
    if (!element) return;

    // Ensure images are loaded
    const images = element.querySelectorAll('img');
    await Promise.all(
      Array.from(images).map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      })
    );

    // Temporarily change overflow to capture full content
    const originalOverflow = element.style.overflow;
    const originalMaxHeight = element.style.maxHeight;
    element.style.overflow = 'visible';
    element.style.maxHeight = 'none';

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

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const ratio = pdfWidth / canvas.width;
      const pageHeightInCanvasPx = pdfHeight / ratio;

      // Footer text and style
      const footerText = 'Generated via NICETech ERP System. Developed by students of NICETECH';
      const footerFontSize = 7;
      const footerMargin = 8; // mm from bottom

      let renderedHeight = 0;
      let pageNum = 0;

      while (renderedHeight < canvas.height) {
        // Leave some space at the bottom for the footer
        const availableHeight = pdfHeight - footerMargin - 2; // reserve footer space
        const sliceHeight = Math.min(pageHeightInCanvasPx, canvas.height - renderedHeight);

        // Calculate the actual height to render on the PDF page (with footer margin)
        const renderHeight = Math.min(sliceHeight, availableHeight / ratio);

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = renderHeight;
        const ctx = pageCanvas.getContext('2d');
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

        const imgData = pageCanvas.toDataURL('image/png');

        if (pageNum > 0) pdf.addPage();

        // Add the image (full width)
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, renderHeight * ratio);

        // Add footer text on this page
        pdf.setFontSize(footerFontSize);
        pdf.setTextColor(200, 200, 200); // light grey
        const textWidth = pdf.getTextWidth(footerText);
        const x = (pdfWidth - textWidth) / 2;
        const y = pdfHeight - footerMargin;
        pdf.text(footerText, x, y);

        renderedHeight += renderHeight;
        pageNum++;
      }

      const subjectName = reportData?.subject?.subjectName || 'subject';
      pdf.save(`Attendance_Report_${subjectName}.pdf`);
    } catch (err) {
      console.error('PDF error:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      element.style.overflow = originalOverflow;
      element.style.maxHeight = originalMaxHeight;
    }
  };

  // ---------- Render ----------
  return (
    <div className={styles.pageWrapper}>
      {/* Controls */}
      <div className={styles.controls}>
        <select
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
          className={styles.filterSelect}
          disabled={subjectsLoading}
        >
          {subjectsLoading ? (
            <option>Loading subjects...</option>
          ) : subjects.length === 0 ? (
            <option value="">No subjects available</option>
          ) : (
            subjects.map((s) => (
              <option key={s._id} value={s._id}>
                {s.subjectCode} – {s.subjectName}
              </option>
            ))
          )}
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className={styles.dateInput}
        />
        <span>to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className={styles.dateInput}
        />

        <button
          onClick={fetchReport}
          className={styles.primaryBtn}
          disabled={loading || subjectsLoading || !selectedSubject}
        >
          {loading ? 'Loading...' : 'Generate Report'}
        </button>

        {reportData && reportData.records.length > 0 && (
          <button onClick={handleDownloadPdf} className={styles.pdfBtn}>
            Download PDF
          </button>
        )}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* Report content */}
      <div ref={pdfRef} className={styles.reportContainer}>
        {/* Header with logo */}
        <div className={styles.header}>
          <img src="/nilogo.png" alt="College Logo" width="700" height="104.3" />
        </div>

        <div className={styles.title}>
          <h2>Attendance Report</h2>
          {reportData?.subject && (
            <p>
              <strong>Subject:</strong> {reportData.subject.subjectCode} –{' '}
              {reportData.subject.subjectName}
            </p>
          )}
          <p>
            <strong>Period:</strong>{' '}
            {dateFrom && dateTo
              ? `${dateFrom} to ${dateTo}`
              : dateFrom
              ? `from ${dateFrom}`
              : dateTo
              ? `up to ${dateTo}`
              : 'All dates'}
          </p>
          <p>
            <strong>Total Periods:</strong> {reportData?.totalPeriods || 0}
          </p>
          <p>
            <strong>Total Students:</strong> {reportData?.totalStudents || 0}
          </p>
        </div>

        {loading && <p className={styles.loadingMsg}>Generating report...</p>}

        {reportData && reportData.records.length === 0 && (
          <p className={styles.emptyMsg}>No attendance records found for this subject.</p>
        )}

        {reportData && reportData.records.length > 0 && (
          <div className={styles.tableWrapper}>
            <table className={styles.reportTable}>
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Register No</th>
                  <th>Roll No</th>
                  <th>Student Name</th>
                  <th>Department</th>
                  <th>Semester</th>
                  <th>Total Periods</th>
                  <th>Present</th>
                  <th>Absent</th>
                  <th>Percentage (%)</th>
                </tr>
              </thead>
              <tbody>
                {reportData.records.map((student, idx) => (
                  <tr key={student.student_id}>
                    <td>{idx + 1}</td>
                    <td>{student.register_no}</td>
                    <td>{student.roll_no}</td>
                    <td className={styles.leftAlign}>{student.name}</td>
                    <td>{student.department_code}</td>
                    <td>{student.semester}</td>
                    <td>{student.total_periods}</td>
                    <td>{student.present}</td>
                    <td>{student.absent}</td>
                    <td>{student.percentage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}