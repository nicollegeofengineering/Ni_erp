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
  const [subjectsLoading, setSubjectsLoading] = useState(false);

  // Department & Year filters
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('');
  const [departments, setDepartments] = useState([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);

  const pdfRef = useRef(null);

  // ---------- Unauthorized handler ----------
  const handleUnauthorized = (error) => {
    if (error.response?.data?.islogout === true || error.response?.status === 401) {
      router.push('/');
      return true;
    }
    return false;
  };

  // ---------- Fetch departments on mount ----------
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await api.get('/api/admin/department/all');
        const list = Array.isArray(res.data)
          ? res.data
          : res.data?.data || res.data?.departments || [];
        setDepartments(list);
      } catch (err) {
        if (handleUnauthorized(err)) return;
        console.error('Failed to fetch departments:', err);
      } finally {
        setDepartmentsLoading(false);
      }
    };
    fetchDepartments();
  }, []);

  // ---------- Fetch subjects on mount or filter change ----------
  useEffect(() => {
    const fetchSubjects = async () => {
      setSubjectsLoading(true);
      setError('');
      try {
        const params = { mode: 'view' };
        if (department) params.department = department;
        if (year) params.year = year;

        const res = await api.get('/api/staff/attendance/subjects', { params });
        if (res.data.success) {
          const nextSubjects = Array.isArray(res.data.data) ? res.data.data : [];
          setSubjects(nextSubjects);

          if (nextSubjects.length > 0) {
            const firstSubject = nextSubjects[0];
            const firstSubjectId = (firstSubject?._id || firstSubject?.id || '').toString();
            setSelectedSubject(firstSubjectId);
          } else {
            setSelectedSubject('');
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
  }, [department, year]);

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
      const params = {
        subjectId: selectedSubject,
        dateFrom,
      };
      if (dateTo) params.dateTo = dateTo;
      if (department) params.department = department;
      if (year) params.year = year;

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
      const generatedAtStr = new Date().toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      const footerText = `Generated via NICETech ERP System on ${generatedAtStr}`;
      const footerFontSize = 6.5;
      const footerMargin = 8; // mm from bottom

      let renderedHeight = 0;
      let pageNum = 0;

      while (renderedHeight < canvas.height) {
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
        pdf.setTextColor(148, 163, 184); // subtle light grey
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
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          className={styles.filterSelect}
          disabled={departmentsLoading}
        >
          <option value="">All Assigned Depts</option>
          {departments.map((d) => (
            <option key={d._id || d.code} value={d.code}>
              {d.name || d.code} ({d.code})
            </option>
          ))}
        </select>

        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className={styles.filterSelect}
        >
          <option value="">All Years</option>
          <option value="1">Year 1</option>
          <option value="2">Year 2</option>
          <option value="3">Year 3</option>
          <option value="4">Year 4</option>
        </select>

        <select
          value={selectedSubject}
          onChange={(e) => setSelectedSubject(e.target.value)}
          className={styles.filterSelect}
          disabled={subjectsLoading}
        >
          {subjectsLoading ? (
            <option>Loading subjects...</option>
          ) : subjects.length === 0 ? (
            <option value="">No assigned subjects available</option>
          ) : (
            subjects.map((s) => {
              const subjectId = (s._id || s.id || '').toString();
              const subjectCode = s.subjectCode || s.code || 'N/A';
              const subjectName = s.subjectName || s.name || 'Unnamed subject';

              return (
                <option key={subjectId} value={subjectId}>
                  {subjectCode} – {subjectName}
                </option>
              );
            })
          )}
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className={styles.dateInput}
          title="From Date"
        />
        <span>to</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className={styles.dateInput}
          title="To Date"
        />

        <button
          onClick={fetchReport}
          className={styles.primaryBtn}
          disabled={loading || subjectsLoading || !selectedSubject || !dateFrom}
        >
          {loading ? 'Loading...' : 'Generate Report'}
        </button>

        {reportData && reportData.records && reportData.records.length > 0 && (
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
          <h2>SUBJECT ATTENDANCE REPORT</h2>
          {reportData?.subject && (
            <p>
              <strong>Subject:</strong> {reportData.subject.subjectCode} –{' '}
              {reportData.subject.subjectName}
            </p>
          )}
          <p>
            <strong>Period Range:</strong>{' '}
            {dateFrom && dateTo
              ? `${dateFrom} to ${dateTo}`
              : dateFrom
              ? `From ${dateFrom}`
              : dateTo
              ? `Up to ${dateTo}`
              : 'All dates'}
          </p>
          <p>
            <strong>Total Periods Conducted:</strong> {reportData?.totalPeriods || 0} | <strong>Total Students:</strong> {reportData?.totalStudents || 0}
          </p>
        </div>

        {loading && <p className={styles.loadingMsg}>Generating report...</p>}

        {reportData && reportData.records && reportData.records.length === 0 && (
          <p className={styles.emptyMsg}>No attendance records found for this subject and date range.</p>
        )}

        {reportData && reportData.records && reportData.records.length > 0 && (
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
                    <td>{student.register_no || '-'}</td>
                    <td>{student.roll_no || '-'}</td>
                    <td className={styles.leftAlign}>{student.name}</td>
                    <td>{student.department_code || '-'}</td>
                    <td>{student.semester || '-'}</td>
                    <td>{student.total_periods}</td>
                    <td>{student.present}</td>
                    <td>{student.absent}</td>
                    <td>
                      <strong
                        style={{
                          color:
                            student.percentage < 70
                              ? '#dc2626'
                              : student.percentage < 80
                              ? '#d97706'
                              : '#16a34a',
                        }}
                      >
                        {student.percentage}%
                      </strong>
                    </td>
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