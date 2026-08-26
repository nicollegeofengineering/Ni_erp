'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Link from 'next/link';
import styles from './AttendanceList.module.css';

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
const api = axios.create({ baseURL: BASE_URL, withCredentials: true });

// Helper to format date
const formatDate = (date) => {
  const d = new Date(date);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Helper to get today's date in YYYY-MM-DD format
const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function AttendanceListPage() {
  const router = useRouter();

  // State for attendance list and pagination
  const [attendance, setAttendance] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // State for filters (default to today's date)
  const todayStr = getTodayDateString();
  const [filters, setFilters] = useState({
    dateFrom: todayStr,
    dateTo: todayStr,
    department: '',
    year: '',
    semester: '',
  });

  // State for departments dropdown
  const [departments, setDepartments] = useState([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);

  // Unauthorized handler
  const handleUnauthorized = (error) => {
    if (error.response?.data?.islogout === true) {
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
        if (res.data.success) {
          setDepartments(res.data.data);
        }
      } catch (err) {
        if (handleUnauthorized(err)) return;
        console.error('Failed to fetch departments:', err);
      } finally {
        setDepartmentsLoading(false);
      }
    };
    fetchDepartments();
  }, []);

  // ---------- Fetch attendance records ----------
  const fetchAttendance = async (page = 1, currentFilters = filters) => {
    setLoading(true);
    setError('');
    try {
      const params = { ...currentFilters, page, limit: pagination.limit };
      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === undefined || params[key] === null) {
          delete params[key];
        }
      });
      const res = await api.get('/api/staff/attendance', { params });
      if (res.data.success) {
        setAttendance(res.data.data.attendance || []);
        setPagination(res.data.data.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 });
      }
    } catch (err) {
      if (handleUnauthorized(err)) return;
      setError('Failed to load attendance records.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Load records on initial mount
  useEffect(() => {
    fetchAttendance(1);
  }, []);

  // ---------- Filter handlers ----------
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const applyFilters = () => {
    fetchAttendance(1, filters);
  };

  const clearFilters = () => {
    const today = getTodayDateString();
    const defaultFilters = { dateFrom: today, dateTo: today, department: '', year: '', semester: '' };
    setFilters(defaultFilters);
    fetchAttendance(1, defaultFilters);
  };

  // ---------- Render ----------
  return (
    <div className={styles.container}>
      <div className={styles.ctop}>
        <h1>Attendance Records</h1>
        <Link href="/hod/attendance">
          <button className={styles.viewBtn}>Back</button>
        </Link>
      </div>

      <div className={styles.filters}>
        <p>From:</p>
        <input
          type="date"
          name="dateFrom"
          value={filters.dateFrom}
          onChange={handleFilterChange}
          placeholder="From"
        />
        <p>To:</p>
        <input
          type="date"
          name="dateTo"
          value={filters.dateTo}
          onChange={handleFilterChange}
          placeholder="To"
        />

        <select
          name="department"
          value={filters.department}
          onChange={handleFilterChange}
          className={styles.filterSelect}
          disabled={departmentsLoading}
        >
          <option value="">All Departments</option>
          {departments.map((dept) => (
            <option key={dept._id || dept.code} value={dept.code}>
              {dept.name || dept.code} ({dept.code})
            </option>
          ))}
        </select>

        <select
          name="year"
          value={filters.year}
          onChange={handleFilterChange}
          className={styles.filterSelect}
        >
          <option value="">All Years</option>
          {[1, 2, 3, 4].map((y) => (
            <option key={y} value={y}>
              Year {y}
            </option>
          ))}
        </select>

        <select
          name="semester"
          value={filters.semester}
          onChange={handleFilterChange}
          className={styles.filterSelect}
        >
          <option value="">All Semesters</option>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
            <option key={s} value={s}>
              Sem {s}
            </option>
          ))}
        </select>

        <button onClick={applyFilters} className={styles.applyBtn}>Apply</button>
        <button onClick={clearFilters} className={styles.clearBtn}>Clear</button>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className={styles.error}>{error}</p>}

      {!loading && attendance.length === 0 && <p>No attendance records found.</p>}

      {attendance.length > 0 && (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Dept</th>
                <th>Year</th>
                <th>Sem</th>
                <th>Period</th>
                <th>Subject</th>
                <th>Faculty</th>
                <th>Present</th>
                <th>Absent</th>
                <th>Total</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {attendance.map((rec) => (
                <tr key={rec._id}>
                  <td>{formatDate(rec.date)}</td>
                  <td>{rec.department}</td>
                  <td>{rec.year}</td>
                  <td>{rec.semester}</td>
                  <td>P{rec.period}</td>
                  <td>{rec.subject?.subjectCode || 'N/A'}</td>
                  <td>{rec.staff ? `${rec.staff.first_name || ''} ${rec.staff.last_name || ''}`.trim() : '-'}</td>
                  <td>{rec.presentCount}</td>
                  <td>{rec.absentCount}</td>
                  <td>{rec.totalStudents}</td>
                  <td>
                    <Link href={`/hod/attendance/${rec._id}`}>
                      <button className={styles.viewBtn}>
                        {rec.canEdit !== false ? 'Edit' : 'View'}
                      </button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={styles.pagination}>
            <button
              onClick={() => fetchAttendance(pagination.page - 1, filters)}
              disabled={pagination.page <= 1}
            >
              Previous
            </button>
            <span>
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => fetchAttendance(pagination.page + 1, filters)}
              disabled={pagination.page >= pagination.totalPages}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}