'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import axios from 'axios';
import Link from 'next/link';

import styles from './AttendancePage.module.css';

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
const api = axios.create({ baseURL: BASE_URL, withCredentials: true });

const getPeriods = (date) => api.get('/api/staff/attendance/periods', { params: { date } });
const getStudents = (timetableId, date) => api.get('/api/staff/attendance/students', { params: { timetableId, date } });
const submitAttendance = (data) => api.post('/api/staff/attendance', data);

export default function AttendancePage() {
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [day, setDay] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendanceSubmitted, setAttendanceSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [timetableInfo, setTimetableInfo] = useState(null);
  const [selectAll, setSelectAll] = useState(true);

  // --------------------------------------------
  // Unauthorized handler
  // --------------------------------------------
  const handleUnauthorized = (error) => {
    if (error.response?.data?.islogout === true) {
      router.push('/');
      return true;
    }
    return false;
  };

  // --------------------------------------------
  // Helpers
  // --------------------------------------------
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDayNumber = (date) => {
    const jsDay = date.getDay();
    return jsDay === 0 ? 7 : jsDay;
  };

  // --------------------------------------------
  // Fetch periods
  // --------------------------------------------
  useEffect(() => {
    const fetchPeriods = async () => {
      setLoading(true);
      setError('');
      setPeriods([]);
      setSelectedPeriod(null);
      setStudents([]);
      setAttendanceSubmitted(false);
      setTimetableInfo(null);

      try {
        const dateStr = formatDate(selectedDate);
        const dayNum = getDayNumber(selectedDate);
        setDay(dayNum);

        const res = await getPeriods(dateStr);
        if (res.data.success) {
          setPeriods(res.data.data.periods);
        }
      } catch (err) {
        if (handleUnauthorized(err)) return;
        setError('Failed to load periods. Please try again.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPeriods();
  }, [selectedDate]);

  // --------------------------------------------
  // Fetch students when a period is selected
  // --------------------------------------------
  useEffect(() => {
    if (!selectedPeriod) {
      setStudents([]);
      setAttendanceSubmitted(false);
      setTimetableInfo(null);
      return;
    }

    const fetchStudents = async () => {
      setLoading(true);
      setError('');
      try {
        const dateStr = formatDate(selectedDate);
        const res = await getStudents(selectedPeriod.timetableId, dateStr);
        if (res.data.success) {
          // Add `selected: true` to every student
          const loadedStudents = res.data.data.students.map((s) => ({ ...s, selected: true }));
          setStudents(loadedStudents);
          setAttendanceSubmitted(res.data.data.attendanceSubmitted);
          setTimetableInfo(res.data.data.timetable);
          setSelectAll(true);
        }
      } catch (err) {
        if (handleUnauthorized(err)) return;
        setError('Failed to load students. Please try again.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, [selectedPeriod, selectedDate]);

  // Update selectAll whenever students change
  useEffect(() => {
    if (students.length > 0) {
      const allSelected = students.every((s) => s.selected);
      setSelectAll(allSelected);
    }
  }, [students]);

  // --------------------------------------------
  // Toggle Select All
  // --------------------------------------------
  const toggleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    setStudents((prev) => prev.map((s) => ({ ...s, selected: newSelectAll })));
  };

  // --------------------------------------------
  // Toggle individual student selection
  // --------------------------------------------
  const toggleStudentSelection = (studentId) => {
    if (attendanceSubmitted) return;
    setStudents((prev) =>
      prev.map((s) =>
        s.student_id === studentId ? { ...s, selected: !s.selected } : s
      )
    );
  };

  // --------------------------------------------
  // Toggle student status (Present ↔ Absent) – only if selected
  // --------------------------------------------
  const toggleStudentStatus = (studentId) => {
    if (attendanceSubmitted) return;
    setStudents((prev) =>
      prev.map((s) => {
        if (s.student_id === studentId && s.selected) {
          return { ...s, status: s.status === 'Present' ? 'Absent' : 'Present' };
        }
        return s;
      })
    );
  };

  // --------------------------------------------
  // Submit attendance – sends only selected students
  // --------------------------------------------
  const handleSubmit = async () => {
    if (!selectedPeriod || students.length === 0) {
      setError('No attendance data to submit.');
      return;
    }

    const selectedStudents = students.filter((s) => s.selected);
    if (selectedStudents.length === 0) {
      setError('No students selected for attendance.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        timetableId: selectedPeriod.timetableId,
        date: formatDate(selectedDate),
        students: selectedStudents.map((s) => ({
          student_id: s.student_id,
          status: s.status,
        })),
      };

      const res = await submitAttendance(payload);
      if (res.data.success) {
        alert('Attendance submitted successfully!');

        // Refresh to show submitted state
        const dateStr = formatDate(selectedDate);
        const refreshRes = await getStudents(selectedPeriod.timetableId, dateStr);
        if (refreshRes.data.success) {
          const refreshed = refreshRes.data.data.students.map((s) => ({ ...s, selected: true }));
          setStudents(refreshed);
          setAttendanceSubmitted(true);
          setTimetableInfo(refreshRes.data.data.timetable);
          setSelectAll(true);
        }
      }
    } catch (err) {
      if (handleUnauthorized(err)) return;
      const msg = err.response?.data?.message || 'Submission failed.';
      setError(msg);
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // --------------------------------------------
  // Render
  // --------------------------------------------
  return (
    <div className={styles.container}>
      <div className={styles.ctop}>
        <h1>Add Attendance</h1>
        <Link href="/hod/attendance/view">
          <button className={styles.viewBtn}>View Attendances</button>
        </Link>
      </div>

      <div className={styles.field}>
        <label>Date:</label>
        <DatePicker
          selected={selectedDate}
          onChange={(date) => setSelectedDate(date)}
          dateFormat="dd-MM-yyyy"
        />
        {day && (
          <span className={styles.dayLabel}>
            Day: {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][day - 1]}
          </span>
        )}
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className={styles.error}>{error}</p>}

      {periods.length > 0 && (
        <div className={styles.periods}>
          <label>Select Period:</label>
          <div className={styles.periodButtons}>
            {periods.map((p) => (
              <button
                key={p.timetableId}
                className={`${styles.periodBtn} ${
                  selectedPeriod?.timetableId === p.timetableId ? styles.active : ''
                }`}
                onClick={() => setSelectedPeriod(p)}
              >
                P{p.period} ({p.subject?.code || 'No subject'})
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedPeriod && (
        <div className={styles.studentSection}>
          <h2>
            {timetableInfo?.department || selectedPeriod.department} - Year{' '}
            {timetableInfo?.year || selectedPeriod.year} Sem{' '}
            {timetableInfo?.sem || selectedPeriod.semester} - Period{' '}
            {selectedPeriod.period}
          </h2>

          {attendanceSubmitted && (
            <p className={styles.info}>Attendance already submitted for this period.</p>
          )}

          {students.length > 0 && (
            <table className={styles.studentTable}>
              <thead>
                <tr>
                  <th className={styles.checkboxHeader}>
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={toggleSelectAll}
                      disabled={attendanceSubmitted}
                    />
                  </th>
                  <th>Roll No</th>
                  <th>Name</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr
                    key={s.student_id}
                    className={`${s.status === 'Present' ? styles.present : styles.absent} ${
                      !s.selected ? styles.deselected : ''
                    }`}
                    onClick={() => toggleStudentStatus(s.student_id)}
                    style={{
                      cursor: attendanceSubmitted || !s.selected ? 'default' : 'pointer',
                      opacity: s.selected ? 1 : 0.6,
                    }}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={s.selected}
                        onChange={() => toggleStudentSelection(s.student_id)}
                        onClick={(e) => e.stopPropagation()}
                        disabled={attendanceSubmitted}
                      />
                    </td>
                    <td>{s.roll_no}</td>
                    <td>{s.name}</td>
                    <td>
                      <span className={styles.statusBadge}>{s.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <button
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={
              submitting ||
              attendanceSubmitted ||
              students.length === 0 ||
              students.filter((s) => s.selected).length === 0
            }
          >
            {submitting ? 'Submitting...' : 'Submit Attendance'}
          </button>
        </div>
      )}
    </div>
  );
}