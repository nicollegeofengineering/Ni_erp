"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Search, SlidersHorizontal, X, Users, UserCheck,
  GraduationCap, UserPlus, Eye, Pencil,
  ChevronLeft, ChevronRight, BookOpen
} from 'lucide-react';
import styles from './css/studentmain.module.css';
import axios from 'axios';

const ITEMS_PER_PAGE = 10;

function getInitials(name) {
  const cleaned = name.replace(/^(Dr|Mr|Mrs|Ms|Prof)\.?\s+/i, '');
  return cleaned.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

export default function Students() {
  const router = useRouter();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // ----- Default filters for faster loading (only admitted, active, year 4, AI&DS) -----
  const [searchText, setSearchText] = useState('');
  const [selDepartment, setSelDepartment] = useState('AI&DS');
  const [selAdmissionType, setSelAdmissionType] = useState(''); // empty = all types
  const [selAdmissionStatus, setSelAdmissionStatus] = useState('Admitted');
  const [selStudentStatus, setSelStudentStatus] = useState('Active');
  const [selYear, setSelYear] = useState('4');

  const [imgError, setImgError] = useState(new Set());

  const [stats, setStats] = useState({
    totalStudents: 0,
    activeStudents: 0,
    admitted: 0,
    applied: 0,
  });

  const [departments, setDepartments] = useState([]);
  const [admissionTypes, setAdmissionTypes] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    startIndex: 0,
    endIndex: 0,
  });

  const handleImgError = (id) => setImgError(prev => new Set(prev).add(id));

  const handleUnauthorized = (error) => {
    if (error.response?.data?.islogout === true) {
      router.push('/');
      return true;
    }
    return false;
  };

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        search: searchText,
        department: selDepartment,
        admissionType: selAdmissionType,
        admissionStatus: selAdmissionStatus,
        studentStatus: selStudentStatus,
        year: selYear,
      });

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/admin/student?${params}`,
        { withCredentials: true }
      );

      if (response.data.success) {
        setStudents(response.data.data.students);
        setStats(response.data.data.stats);
        setDepartments(response.data.data.filters.departments || []);
        setAdmissionTypes(response.data.data.filters.admissionTypes || []);
        setPagination(response.data.data.pagination);
      }
    } catch (error) {
      if (handleUnauthorized(error)) return;
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [currentPage, searchText, selDepartment, selAdmissionType, selAdmissionStatus, selStudentStatus, selYear]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, selDepartment, selAdmissionType, selAdmissionStatus, selStudentStatus, selYear]);

  const hasActiveFilters = !!(searchText || selDepartment || selAdmissionType || selAdmissionStatus || selStudentStatus || selYear);

  const clearFilters = () => {
    setSearchText('');
    setSelDepartment('AI&DS');
    setSelAdmissionType('');
    setSelAdmissionStatus('Admitted');
    setSelStudentStatus('Active');
    setSelYear('4');
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setCurrentPage(newPage);
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1>Student Management</h1>
          <p>Manage and view all student records.</p>
        </div>
        <button className={styles.addBtn} onClick={() => router.push('/hod/students/add')}>
          <Plus size={18} /> Add Student
        </button>
      </div>

      {/* Statistics */}
      <div className={styles.statsGrid}>
        <div className={styles.card}>
          <div className={`${styles.cardIcon} ${styles.iconPrimary}`}><Users size={20} /></div>
          <div>
            <span className={styles.cardLabel}>Total Students</span>
            <h2 className={styles.cardValue}>{stats.totalStudents}</h2>
          </div>
        </div>
        <div className={styles.card}>
          <div className={`${styles.cardIcon} ${styles.iconSuccess}`}><UserCheck size={20} /></div>
          <div>
            <span className={styles.cardLabel}>Active</span>
            <h2 className={styles.cardValue}>{stats.activeStudents}</h2>
          </div>
        </div>
        <div className={styles.card}>
          <div className={`${styles.cardIcon} ${styles.iconInfo}`}><GraduationCap size={20} /></div>
          <div>
            <span className={styles.cardLabel}>Admitted</span>
            <h2 className={styles.cardValue}>{stats.admitted}</h2>
          </div>
        </div>
        <div className={styles.card}>
          <div className={`${styles.cardIcon} ${styles.iconNeutral}`}><BookOpen size={20} /></div>
          <div>
            <span className={styles.cardLabel}>Applied</span>
            <h2 className={styles.cardValue}>{stats.applied}</h2>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterLabel}>
          <SlidersHorizontal size={16} />
          <span>Filters</span>
        </div>

        <select value={selDepartment} onChange={e => setSelDepartment(e.target.value)}>
          <option value="">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        <select value={selAdmissionType} onChange={e => setSelAdmissionType(e.target.value)}>
          <option value="">All Admission Types</option>
          {admissionTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select value={selAdmissionStatus} onChange={e => setSelAdmissionStatus(e.target.value)}>
          <option value="">Admission Status: All</option>
          <option value="Applied">Applied</option>
          <option value="Admitted">Admitted</option>
          <option value="Cancelled">Cancelled</option>
          <option value="Rejected">Rejected</option>
        </select>

        <select value={selStudentStatus} onChange={e => setSelStudentStatus(e.target.value)}>
          <option value="">Student Status: All</option>
          <option value="Active">Active</option>
          <option value="Graduated">Graduated</option>
          <option value="Discontinued">Discontinued</option>
          <option value="Transferred">Transferred</option>
          <option value="Suspended">Suspended</option>
        </select>

        <select value={selYear} onChange={e => setSelYear(e.target.value)}>
          <option value="">All Years</option>
          <option value="1">Year 1</option>
          <option value="2">Year 2</option>
          <option value="3">Year 3</option>
          <option value="4">Year 4</option>
        </select>

        <div className={styles.searchBox}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by name or ID"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
          />
        </div>

        {hasActiveFilters && (
          <button className={styles.clearBtn} onClick={clearFilters}>
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.loadingState}>Loading student records...</div>
        ) : (
          <table className={styles.table}>
            <thead className={styles.tableHead}>
              <tr>
                <th className={styles.tableHeader}>Reg No</th>
                <th className={styles.tableHeader}>Photo</th>
                <th className={styles.tableHeader}>Admission No.</th>
                <th className={styles.tableHeader}>Roll No.</th>
                <th className={styles.tableHeader}>Name</th>
                <th className={styles.tableHeader}>Department</th>
                <th className={styles.tableHeader}>Admission Type</th>
                <th className={styles.tableHeader}>Status</th>
                <th className={styles.tableHeader}>Action</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td className={styles.emptyState} colSpan={9}>
                    No students match these filters. Try adjusting search or filters.
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id}>
                    <td className={styles.tableData}>{student.id}</td>
                    <td className={styles.tableData}>
                      {student.image && !imgError.has(student.id) ? (
                        <img
                          src={`${process.env.NEXT_PUBLIC_BACKEND_URL}${student.image}`}
                          alt={student.name}
                          className={styles.avatar}
                          onError={() => handleImgError(student.id)}
                        />
                      ) : (
                        <div className={styles.avatarFallback}>{getInitials(student.name)}</div>
                      )}
                    </td>
                    <td className={styles.tableData}>{student.admissionNo}</td>
                    <td className={styles.tableData}>{student.rollNo}</td>
                    <td className={styles.tableData}>
                      <strong>{student.name}</strong>
                      <br />
                      <span className={styles.typePill}>{student.year ? `Year ${student.year}` : ''}</span>
                    </td>
                    <td className={styles.tableData}>{student.department}</td>
                    <td className={styles.tableData}>
                      <span className={`${styles.admissionTypePill} ${student.admissionType === 'Regular' ? styles.regular : styles.lateral}`}>
                        {student.admissionType}
                      </span>
                    </td>
                    <td className={styles.tableData}>
                      <span className={`${styles.statusPill} ${student.studentStatus === 'Active' ? styles.active : styles.inactive}`}>
                        <span className={styles.statusDot} />
                        {student.studentStatus}
                      </span>
                      <br />
                      <span style={{ fontSize: '11px', color: '#5b6478' }}>
                        {student.admissionStatus}
                      </span>
                    </td>
                    <td className={styles.tableData}>
                      <div className={styles.actionGroup}>
                        <button className={styles.viewBtn} onClick={() => router.push(`/hod/students/view/${student.id}`)}>
                          <Eye size={14} /> View
                        </button>
                        <button className={styles.editBtn} onClick={() => router.push(`/hod/students/edit/${student.id}`)}>
                          <Pencil size={14} /> Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {students.length > 0 && (
          <div className={styles.pagination}>
            <span className={styles.paginationInfo}>
              Showing {pagination.startIndex}–{pagination.endIndex} of {pagination.totalItems}
            </span>
            <div className={styles.paginationControls}>
              <button
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              <span>{currentPage} / {pagination.totalPages}</span>
              <button
                disabled={currentPage === pagination.totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}