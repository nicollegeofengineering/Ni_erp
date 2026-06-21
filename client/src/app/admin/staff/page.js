"use client"

import React from 'react'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, SlidersHorizontal, X, Users, UserCheck,
  GraduationCap, Briefcase, UserPlus, Eye, Pencil,
  ChevronLeft, ChevronRight
} from 'lucide-react'
import styles from './css/staffmain.module.css'

const ITEMS_PER_PAGE = 10

function getInitials(name) {
  const cleaned = name.replace(/^(Dr|Mr|Mrs|Ms|Prof)\.?\s+/i, '')
  return cleaned.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

export default function Staff() {
  const router = useRouter()

  const [staffList] = useState([
    {
      id: "EMP-1042",
      image: "https://static.vecteezy.com/system/resources/thumbnails/053/630/733/small/a-man-in-a-suit-and-tie-standing-with-his-arms-crossed-photo.jpeg",
      name: "Dr. Robert Chen",
      staffCode: "RCHE",
      department: "Computer Science",
      designation: "Professor",
      category: "Teaching",
      email: "robert@college.edu",
      phone: "+1 555 123 4567",
      status: "Active",
      type: "Full-time",
      joiningDate: "2019-08-01"
    },
    {
      id: "EMP-1089",
      image: "https://static.vecteezy.com/system/resources/thumbnails/038/962/461/small/ai-generated-caucasian-successful-confident-young-businesswoman-ceo-boss-bank-employee-worker-manager-with-arms-crossed-in-formal-wear-isolated-in-white-background-photo.jpg",
      name: "Sarah Jenkins",
      staffCode: "SJEN",
      department: "Administration",
      designation: "HR Manager",
      category: "Non-Teaching",
      email: "sarah@college.edu",
      phone: "+1 555 987 6543",
      status: "Active",
      type: "Contract",
      joiningDate: "2026-06-10"
    }
  ])

  const [currentPage, setCurrentPage] = useState(1)
  const [selDepartment, setSelDepartment] = useState("")
  const [selDesignation, setSelDesignation] = useState("")
  const [selStatus, setSelStatus] = useState("")
  const [searchText, setSearchText] = useState("")
  const [imgError, setImgError] = useState(new Set())


  const handleImgError = (id) => setImgError(prev => new Set(prev).add(id))

  // Derived stats — driven by real data instead of hardcoded numbers
  const totalStaff = staffList.length
  const totalActiveStaff = staffList.filter(s => s.status === "Active").length
  const teachingStaff = staffList.filter(s => s.category === "Teaching").length
  const nonTeachingStaff = staffList.filter(s => s.category === "Non-Teaching").length
  

  const [departments,setDepartments] = useState([
    "Computer Science",
    "AI&DS",
    "Information Technology",
    "Electronics",
    "Mechanical",
    "Civil",
  ])

  const [designations,setDesignations] = useState([
    "Professor",
    "Associate Professor",
    "Assistant Professor",
    "HR Manager",
    "Accountant",
    "Librarian"
  ])



  const totalPages = Math.max(1, Math.ceil(staffList.length / ITEMS_PER_PAGE))

  const paginatedStaff = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return staffList.slice(start, start + ITEMS_PER_PAGE)
  }, [staffList, currentPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchText, selDepartment, selDesignation, selStatus])

  const hasActiveFilters = !!(searchText || selDepartment || selDesignation || selStatus)
  const clearFilters = () => {
    setSearchText("")
    setSelDepartment("")
    setSelDesignation("")
    setSelStatus("")
  }

  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE
  const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, staffList.length)

  return (
    <div className={styles.container}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1>Staff Management</h1>
          <p>Manage and view all college personnel records.</p>
        </div>
        <button className={styles.addBtn} onClick={() => router.push("/admin/staff/add")}>
          <Plus size={18} /> Add Staff
        </button>
      </div>

      {/* Statistics */}
      <div className={styles.statsGrid}>
        <div className={styles.card}>
          <div className={`${styles.cardIcon} ${styles.iconPrimary}`}><Users size={20} /></div>
          <div>
            <span className={styles.cardLabel}>Total Staff</span>
            <h2 className={styles.cardValue}>{totalStaff}</h2>
          </div>
        </div>

        <div className={styles.card}>
          <div className={`${styles.cardIcon} ${styles.iconSuccess}`}><UserCheck size={20} /></div>
          <div>
            <span className={styles.cardLabel}>Active</span>
            <h2 className={styles.cardValue}>{totalActiveStaff}</h2>
          </div>
        </div>

        <div className={styles.card}>
          <div className={`${styles.cardIcon} ${styles.iconInfo}`}><GraduationCap size={20} /></div>
          <div>
            <span className={styles.cardLabel}>Teaching</span>
            <h2 className={styles.cardValue}>{teachingStaff}</h2>
          </div>
        </div>

        <div className={styles.card}>
          <div className={`${styles.cardIcon} ${styles.iconNeutral}`}><Briefcase size={20} /></div>
          <div>
            <span className={styles.cardLabel}>Non Teaching</span>
            <h2 className={styles.cardValue}>{nonTeachingStaff}</h2>
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

        <select value={selDesignation} onChange={e => setSelDesignation(e.target.value)}>
          <option value="">All Designations</option>
          {designations.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        <select value={selStatus} onChange={e => setSelStatus(e.target.value)}>
          <option value="">Status: All</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
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
        <table className={styles.table}>
          <thead className={styles.tableHead}>
            <tr>
              <th className={styles.tableHeader} scope="col">ID</th>
              <th className={styles.tableHeader} scope="col">Photo</th>
              <th className={styles.tableHeader} scope="col">Staff Code</th>
              <th className={styles.tableHeader} scope="col">Name</th>
              <th className={styles.tableHeader} scope="col">Department</th>
              <th className={styles.tableHeader} scope="col">Designation</th>
              <th className={styles.tableHeader} scope="col">Contact</th>
              <th className={styles.tableHeader} scope="col">Status</th>
              <th className={styles.tableHeader} scope="col">Action</th>
            </tr>
          </thead>

          <tbody>
            {paginatedStaff.length === 0 ? (
              <tr>
                <td className={styles.emptyState} colSpan={9}>
                  No staff match these filters. Try adjusting search or filters.
                </td>
              </tr>
            ) : paginatedStaff.map((staff) => (
              <tr key={staff.id}>
                <td className={styles.tableData}>{staff.id}</td>

                <td className={styles.tableData}>
                  {staff.image && !imgError.has(staff.id) ? (
                    <img
                      src={staff.image}
                      alt={staff.name}
                      className={styles.avatar}
                      onError={() => handleImgError(staff.id)}
                    />
                  ) : (
                    <div className={styles.avatarFallback}>{getInitials(staff.name)}</div>
                  )}
                </td>

                <td className={styles.tableData}>{staff.staffCode}</td>

                <td className={styles.tableData}>
                  <strong>{staff.name}</strong>
                  <br />
                  <span className={styles.typePill}>{staff.type}</span>
                </td>

                <td className={styles.tableData}>{staff.department}</td>
                <td className={styles.tableData}>{staff.designation}</td>

                <td className={styles.tableData}>
                  {staff.email}
                  <br />
                  {staff.phone}
                </td>

                <td className={styles.tableData}>
                  <span className={`${styles.statusPill} ${staff.status === "Active" ? styles.active : styles.inactive}`}>
                    <span className={styles.statusDot} />
                    {staff.status}
                  </span>
                </td>

                <td className={styles.tableData}>
                  <div className={styles.actionGroup}>
                    <button className={styles.viewBtn} onClick={() => router.push(`/admin/staff/view`)}>
                      <Eye size={14} /> View
                    </button>
                    <button className={styles.editBtn} onClick={() => router.push(`/admin/staff/edit`)}>
                      <Pencil size={14} /> Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {staffList.length > 0 && (
          <div className={styles.pagination}>
            <span className={styles.paginationInfo}>
              Showing {startIdx + 1}–{endIdx} of {staffList.length}
            </span>
            <div className={styles.paginationControls}>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft size={16} />
              </button>
              <span>{currentPage} / {totalPages}</span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
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