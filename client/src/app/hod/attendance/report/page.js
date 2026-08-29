'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Loader2, BarChart3, FileDown } from 'lucide-react';
import styles from './Report.module.css';

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

// Helper for dynamic academic year options
function getAcademicYearOptions() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const startYear = now.getMonth() >= 5 ? currentYear : currentYear - 1;
  const years = [];
  for (let i = startYear - 4; i <= startYear + 3; i++) {
    years.push(`${i}-${i + 1}`);
  }
  return years;
}

function getDefaultAcademicYear() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const startYear = now.getMonth() >= 5 ? currentYear : currentYear - 1;
  return `${startYear}-${startYear + 1}`;
}

export default function HodAttendanceReportPage() {
  const router = useRouter();

  // Mode: 'class' | 'subject'
  const [reportType, setReportType] = useState('class');

  // Filter States
  const [academicYear, setAcademicYear] = useState(getDefaultAcademicYear());
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('1');
  const [semester, setSemester] = useState('1');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Subject Mode Specific
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [subjectsLoading, setSubjectsLoading] = useState(false);

  // Departments List
  const [departments, setDepartments] = useState([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);

  // Data & Status States
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState('');

  const pdfRef = useRef(null);

  // ---------- Unauthorized handler ----------
  const handleUnauthorized = (error) => {
    if (error.response?.data?.islogout === true || error.response?.status === 401) {
      router.push('/');
      return true;
    }
    return false;
  };

  // ---------- Fetch HOD department and departments on mount ----------
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        try {
          const sumRes = await api.get('/api/staff/attendance/today-summary');
          if (sumRes.data.success && sumRes.data.data?.department) {
            setDepartment(sumRes.data.data.department);
          }
        } catch (e) {
          // Ignore if fails
        }

        const res = await api.get('/api/admin/department/all');
        const list = Array.isArray(res.data)
          ? res.data
          : res.data?.data || res.data?.departments || [];
        setDepartments(list);
        if (list.length > 0) {
          setDepartment((prev) => prev || list[0].code);
        }
      } catch (err) {
        if (handleUnauthorized(err)) return;
        console.error('Failed to fetch departments:', err);
      } finally {
        setDepartmentsLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  // ---------- Adjust semester options when year changes ----------
  const handleYearChange = (newYear) => {
    setYear(newYear);
    if (newYear === '1') setSemester('1');
    else if (newYear === '2') setSemester('3');
    else if (newYear === '3') setSemester('5');
    else if (newYear === '4') setSemester('7');
  };

  // Available semesters based on Year
  const getSemesterOptions = () => {
    const y = parseInt(year) || 1;
    const sem1 = (y - 1) * 2 + 1;
    const sem2 = (y - 1) * 2 + 2;
    return [
      { label: `Semester ${sem1}`, value: String(sem1) },
      { label: `Semester ${sem2}`, value: String(sem2) },
    ];
  };

  // ---------- Fetch subjects when in subject mode or department/year changes ----------
  useEffect(() => {
    if (reportType !== 'subject') return;

    const fetchSubjects = async () => {
      if (!year) return;
      setSubjectsLoading(true);
      setError('');
      try {
        const params = { mode: 'view' };
        if (department) params.department = department;
        if (year) params.year = year;
        if (semester) params.semester = semester;

        const res = await api.get('/api/staff/attendance/subjects', { params });
        if (res.data.success) {
          const nextSubjects = Array.isArray(res.data.data) ? res.data.data : [];
          setSubjects(nextSubjects);
          if (nextSubjects.length > 0) {
            const firstSubjectId = (nextSubjects[0]?._id || nextSubjects[0]?.id || '').toString();
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
  }, [reportType, department, year, semester]);

  // Reset report data when switching modes
  const handleModeChange = (mode) => {
    setReportType(mode);
    setReportData(null);
    setError('');
  };

  // ---------- Generate report ----------
  const fetchReport = async () => {
    setError('');
    setReportData(null);

    if (reportType === 'class') {
      if (!department) {
        setError('Please select a department.');
        return;
      }
      if (!year || !semester) {
        setError('Please select Year and Semester.');
        return;
      }

      setLoading(true);
      try {
        const params = {
          department,
          year,
          semester,
        };
        if (academicYear) params.academicYear = academicYear;
        if (dateFrom) params.dateFrom = dateFrom;
        if (dateTo) params.dateTo = dateTo;

        const res = await api.get('/api/staff/attendance/report/class', { params });
        if (res.data.success) {
          setReportData(res.data.data);
        }
      } catch (err) {
        if (handleUnauthorized(err)) return;
        const msg = err.response?.data?.message || 'Failed to generate class attendance report.';
        setError(msg);
        console.error(err);
      } finally {
        setLoading(false);
      }
    } else {
      // Subject Mode
      if (!selectedSubject) {
        setError('Please select a subject.');
        return;
      }
      if (!dateFrom) {
        setError('Please select a From date.');
        return;
      }

      setLoading(true);
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
        const msg = err.response?.data?.message || 'Failed to generate subject report.';
        setError(msg);
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  // ---------- PDF export ----------
  const handleDownloadPdf = async () => {
    const element = pdfRef.current;
    if (!element) return;

    setPdfLoading(true);

    try {
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

      const originalOverflow = element.style.overflow;
      const originalMaxHeight = element.style.maxHeight;
      element.style.overflow = 'visible';
      element.style.maxHeight = 'none';

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

      const generatedAtStr = new Date().toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
      const footerText = `NICETech ERP System | Generated on ${generatedAtStr}`;
      const footerFontSize = 7;
      const footerMargin = 8;

      let renderedHeight = 0;
      let pageNum = 0;

      while (renderedHeight < canvas.height) {
        const availableHeight = pdfHeight - footerMargin - 2;
        const sliceHeight = Math.min(pageHeightInCanvasPx, canvas.height - renderedHeight);
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
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, renderHeight * ratio);

        pdf.setFontSize(footerFontSize);
        pdf.setTextColor(100, 116, 139);
        const textWidth = pdf.getTextWidth(footerText);
        const x = (pdfWidth - textWidth) / 2;
        const y = pdfHeight - footerMargin;
        pdf.text(footerText, x, y);

        renderedHeight += renderHeight;
        pageNum++;
      }

      const fileName =
        reportType === 'class'
          ? `Class_Attendance_Report_${department}_Y${year}_S${semester}.pdf`
          : `Subject_Attendance_Report_${reportData?.subject?.subjectCode || 'Subject'}.pdf`;

      pdf.save(fileName);
      element.style.overflow = originalOverflow;
      element.style.maxHeight = originalMaxHeight;
    } catch (err) {
      console.error('PDF error:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  };

  const academicYearOptions = getAcademicYearOptions();

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>HOD Attendance Report Generator</h1>
        <p className={styles.pageSubtitle}>
          Generate class-wise total attendance reports across all subjects or specific subject reports.
        </p>
      </div>

      {/* Mode Switcher Tabs */}
      <div className={styles.tabsContainer}>
        <button
          type="button"
          className={`${styles.tabBtn} ${reportType === 'class' ? styles.tabBtnActive : ''}`}
          onClick={() => handleModeChange('class')}
        >
          🏫 Class-Wise Report
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${reportType === 'subject' ? styles.tabBtnActive : ''}`}
          onClick={() => handleModeChange('subject')}
        >
          📚 Subject-Wise Report
        </button>
      </div>

      {/* Filter Controls Card with Clean Grid */}
      <div className={styles.controlsCard}>
        <div className={styles.controlsGrid}>
          {/* Academic Year */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Academic Year</label>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className={styles.filterSelect}
            >
              {academicYearOptions.map((ay) => (
                <option key={ay} value={ay}>
                  {ay}
                </option>
              ))}
            </select>
          </div>

          {/* Department */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className={styles.filterSelect}
              disabled={departmentsLoading}
            >
              <option value="">Select Department</option>
              {departments.map((d) => (
                <option key={d._id || d.code} value={d.code}>
                  {d.name || d.code} ({d.code})
                </option>
              ))}
            </select>
          </div>

          {/* Year */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Year</label>
            <select
              value={year}
              onChange={(e) => handleYearChange(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="1">Year 1</option>
              <option value="2">Year 2</option>
              <option value="3">Year 3</option>
              <option value="4">Year 4</option>
            </select>
          </div>

          {/* Semester */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Semester</label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className={styles.filterSelect}
            >
              {getSemesterOptions().map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Subject (Only in Subject Mode) */}
          {reportType === 'subject' && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Subject</label>
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
            </div>
          )}

          {/* Date Range */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>From Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={styles.dateInput}
            />
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>To Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={styles.dateInput}
            />
          </div>

          {/* Action Buttons Row */}
          <div className={styles.actionsGroup}>
            <button
              onClick={fetchReport}
              className={styles.primaryBtn}
              disabled={
                loading ||
                pdfLoading ||
                (reportType === 'subject' && (!selectedSubject || !dateFrom)) ||
                (reportType === 'class' && !department)
              }
            >
              {loading ? (
                <>
                  <Loader2 className={styles.spinnerIcon} size={16} />
                  Generating Report...
                </>
              ) : (
                <>
                  <BarChart3 size={16} />
                  Generate Report
                </>
              )}
            </button>

            {reportData && reportData.records && reportData.records.length > 0 && (
              <button
                onClick={handleDownloadPdf}
                className={styles.pdfBtn}
                disabled={pdfLoading || loading}
              >
                {pdfLoading ? (
                  <>
                    <Loader2 className={styles.spinnerIcon} size={16} />
                    Downloading PDF...
                  </>
                ) : (
                  <>
                    <FileDown size={16} />
                    Download PDF
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {/* KPI Metrics when Class Report is loaded */}
      {reportType === 'class' && reportData && (
        <div className={styles.summaryGrid}>
          <div className={styles.metricCard}>
            <span className={styles.metricTitle}>Enrolled Students</span>
            <span className={styles.metricValue}>{reportData.totalStudents || 0}</span>
            <span className={styles.metricSubtext}>Students in class</span>
          </div>

          <div className={`${styles.metricCard} ${styles.metricCardPurple}`}>
            <span className={styles.metricTitle}>Total Periods Conducted</span>
            <span className={styles.metricValue}>{reportData.totalPeriods || 0}</span>
            <span className={styles.metricSubtext}>Across all subjects</span>
          </div>

          <div className={`${styles.metricCard} ${styles.metricCardAmber}`}>
            <span className={styles.metricTitle}>Class Avg Attendance</span>
            <span className={styles.metricValue}>{reportData.classAvgPercentage || 0}%</span>
            <span className={styles.metricSubtext}>Overall cumulative</span>
          </div>

          <div className={`${styles.metricCard} ${styles.metricCardRed}`}>
            <span className={styles.metricTitle}>Attendance Shortage</span>
            <span className={styles.metricValue}>{reportData.shortageCount || 0}</span>
            <span className={styles.metricSubtext}>Students below 75%</span>
          </div>
        </div>
      )}

      {/* Printable / Viewable Report Sheet */}
      <div ref={pdfRef} className={styles.reportContainer}>
        {/* College Header */}
        <div className={styles.header}>
          <img src="/nilogo.png" alt="College Logo" width="700" height="104.7" />
        </div>

        {/* Report Metadata */}
        <div className={styles.title}>
          <h2>
            {reportType === 'class'
              ? 'CLASS ATTENDANCE REPORT'
              : 'SUBJECT ATTENDANCE REPORT'}
          </h2>

          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Academic Year:</span>
              <span className={styles.metaValue}>{academicYear}</span>
            </div>

            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Department:</span>
              <span className={styles.metaValue}>{department || 'All Departments'}</span>
            </div>

            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Year / Semester:</span>
              <span className={styles.metaValue}>
                {year} / {semester}
              </span>
            </div>

            {reportType === 'subject' && reportData?.subject && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Subject:</span>
                <span className={styles.metaValue}>
                  {reportData.subject.subjectCode} – {reportData.subject.subjectName}
                </span>
              </div>
            )}

            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Period Range:</span>
              <span className={styles.metaValue}>
                {dateFrom && dateTo
                  ? `${dateFrom} to ${dateTo}`
                  : dateFrom
                    ? `From ${dateFrom}`
                    : dateTo
                      ? `Up to ${dateTo}`
                      : 'Full Semester to Date'}
              </span>
            </div>

            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Total Periods Conducted:</span>
              <span className={styles.metaValue}>{reportData?.totalPeriods || 0}</span>
            </div>
          </div>
        </div>

        {loading && <p className={styles.loadingMsg}>Generating attendance report, please wait...</p>}

        {reportData && reportData.records && reportData.records.length === 0 && (
          <p className={styles.emptyMsg}>No attendance records found for the selected criteria.</p>
        )}

        {/* CLASS-WISE TABLE (S.No, Reg No, Roll No, Student Name, Total Periods, Present, Absent, Total Percentage) */}
        {reportType === 'class' && reportData && reportData.records && reportData.records.length > 0 && (
          <div className={styles.tableWrapper}>
            <table className={styles.reportTable}>
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Register No</th>
                  <th>Roll No</th>
                  <th>Student Name</th>
                  <th>Total Periods</th>
                  <th>Present</th>
                  <th>Absent</th>
                  <th>Total Percentage</th>
                </tr>
              </thead>
              <tbody>
                {reportData.records.map((st, idx) => (
                  <tr key={st.student_id || idx}>
                    <td>{idx + 1}</td>
                    <td>{st.register_no || '-'}</td>
                    <td>{st.roll_no || '-'}</td>
                    <td className={styles.leftAlign}>{st.name}</td>
                    <td>{st.total_periods}</td>
                    <td style={{ color: '#16a34a', fontWeight: 600 }}>{st.present}</td>
                    <td style={{ color: '#dc2626', fontWeight: 600 }}>{st.absent}</td>
                    <td>
                      <span
                        className={
                          st.percentage < 75
                            ? styles.pctTextRed
                            : st.percentage < 85
                              ? styles.pctTextAmber
                              : styles.pctTextGreen
                        }
                      >
                        {st.percentage}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* SUBJECT-WISE TABLE */}
        {reportType === 'subject' && reportData && reportData.records && reportData.records.length > 0 && (
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
                  <th>Total Percentage</th>
                </tr>
              </thead>
              <tbody>
                {reportData.records.map((student, idx) => (
                  <tr key={student.student_id || idx}>
                    <td>{idx + 1}</td>
                    <td>{student.register_no || '-'}</td>
                    <td>{student.roll_no || '-'}</td>
                    <td className={styles.leftAlign}>{student.name}</td>
                    <td>{student.department_code || department || '-'}</td>
                    <td>{student.semester || semester || '-'}</td>
                    <td>{student.total_periods}</td>
                    <td style={{ color: '#16a34a', fontWeight: 600 }}>{student.present}</td>
                    <td style={{ color: '#dc2626', fontWeight: 600 }}>{student.absent}</td>
                    <td>
                      <span
                        className={
                          student.percentage < 75
                            ? styles.pctTextRed
                            : student.percentage < 85
                              ? styles.pctTextAmber
                              : styles.pctTextGreen
                        }
                      >
                        {student.percentage}%
                      </span>
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