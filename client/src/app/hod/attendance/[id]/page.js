'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import axios from 'axios';
import styles from './AttendanceDetail.module.css';

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
const api = axios.create({ baseURL: BASE_URL, withCredentials: true });

export default function AttendanceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const attendanceId = params.id;

  const [attendance, setAttendance] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleUnauthorized = (error) => {
    if (error.response?.data?.islogout === true) {
      router.push('/');
      return true;
    }
    return false;
  };

  const fetchAttendance = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/api/staff/attendance/${attendanceId}`);
      if (res.data.success) {
        const data = res.data.data;
        setAttendance(data);
        setStudents(data.students || []);
      }
    } catch (err) {
      if (handleUnauthorized(err)) return;
      setError('Failed to load attendance record.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (attendanceId) {
      fetchAttendance();
    }
  }, [attendanceId]);

  // Toggle student status
  const toggleStatus = (studentId) => {
    setStudents(prev =>
      prev.map(s =>
        s.student_id === studentId
          ? { ...s, status: s.status === 'Present' ? 'Absent' : 'Present' }
          : s
      )
    );
  };

  // Save changes
  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        students: students.map(s => ({ student_id: s.student_id, status: s.status }))
      };
      const res = await api.put(`/api/staff/attendance/${attendanceId}`, payload);
      if (res.data.success) {
        setSuccess('Attendance updated successfully!');
        await fetchAttendance();
      }
    } catch (err) {
      if (handleUnauthorized(err)) return;
      const msg = err.response?.data?.message || 'Update failed.';
      setError(msg);
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // ---------- Delete with math challenge ----------
  const openDeleteModal = () => {
    const a = Math.floor(Math.random() * 9) + 1; // 1-9
    const b = Math.floor(Math.random() * 9) + 1;
    setNum1(a);
    setNum2(b);
    setUserAnswer('');
    setDeleteError('');
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setUserAnswer('');
    setDeleteError('');
  };

  const handleDelete = async () => {
    const expected = num1 + num2;
    if (parseInt(userAnswer) !== expected) {
      setDeleteError('Incorrect answer. Please try again.');
      return;
    }

    setDeleting(true);
    setDeleteError('');
    try {
      const res = await api.delete(`/api/staff/attendance/${attendanceId}`);
      if (res.data.success) {
        setSuccess('Attendance deleted successfully!');
        closeDeleteModal();
        // Redirect back to list after a short delay
        setTimeout(() => router.push('/hod/attendance'), 1500);
      }
    } catch (err) {
      if (handleUnauthorized(err)) return;
      const msg = err.response?.data?.message || 'Delete failed.';
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className={styles.container}>Loading...</div>;
  if (error) return <div className={styles.container}><p className={styles.error}>{error}</p></div>;
  if (!attendance) return <div className={styles.container}>Record not found.</div>;

  const formatDate = (date) => new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className={styles.container}>
      <h1>Attendance Detail</h1>

      <div className={styles.meta}>
        <p><strong>Date:</strong> {formatDate(attendance.date)}</p>
        <p><strong>Department:</strong> {attendance.department}</p>
        <p><strong>Year:</strong> {attendance.year}</p>
        <p><strong>Semester:</strong> {attendance.semester}</p>
        <p><strong>Period:</strong> P{attendance.period}</p>
        <p><strong>Subject:</strong> {attendance.subject?.subjectName || 'N/A'}</p>
        <p><strong>Staff:</strong> {attendance.staff?.first_name} {attendance.staff?.last_name}</p>
      </div>

      {success && <p className={styles.success}>{success}</p>}
      {error && <p className={styles.error}>{error}</p>}

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Roll No</th>
            <th>Name</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {students.map(s => (
            <tr
              key={s.student_id}
              className={s.status === 'Present' ? styles.present : styles.absent}
              onClick={() => toggleStatus(s.student_id)}
              style={{ cursor: 'pointer' }}
            >
              <td>{s.roll_no || s.student_id}</td>
              <td>{s.name || s.student_id}</td>
              <td>
                <span className={styles.statusBadge}>{s.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={styles.actions}>
        <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button className={styles.deleteBtn} onClick={openDeleteModal}>
          Delete Attendance
        </button>
        <button className={styles.backBtn} onClick={() => router.push('/hod/attendance/view')}>
          Back to List
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className={styles.modalOverlay} onClick={closeDeleteModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Deletion</h3>
            <p>Are you sure you want to delete this attendance record?</p>
            <p>To confirm, solve: <strong>{num1} + {num2} = ?</strong></p>
            <input
              type="number"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="Enter your answer"
              className={styles.modalInput}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleDelete()}
            />
            {deleteError && <p className={styles.error}>{deleteError}</p>}
            <div className={styles.modalActions}>
              <button className={styles.modalCancelBtn} onClick={closeDeleteModal}>Cancel</button>
              <button className={styles.modalDeleteBtn} onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}