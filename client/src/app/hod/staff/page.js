"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  SlidersHorizontal,
  X,
  Users,
  UserCheck,
  GraduationCap,
  Briefcase,
  Eye,
  Pencil,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import styles from "./css/staffmain.module.css";
import axios from "axios";

const ITEMS_PER_PAGE = 10;

function getInitials(name) {
  const cleaned = name.replace(/^(Dr|Mr|Mrs|Ms|Prof)\.?\s+/i, "");

  return cleaned
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export default function Staff() {
  const router = useRouter();

  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);

  // Logged-in HOD department
  const [selDepartment, setSelDepartment] = useState("");

  const [selDesignation, setSelDesignation] = useState("");
  const [selStatus, setSelStatus] = useState("Active");
  const [selCategory, setSelCategory] = useState("");
  const [searchText, setSearchText] = useState("");

  const [imgError, setImgError] = useState(new Set());

  // Stats
  const [stats, setStats] = useState({
    totalStaff: 0,
    activeStaff: 0,
    teachingStaff: 0,
    nonTeachingStaff: 0,
  });

  // Only designation is required as a dynamic filter now
  const [designations, setDesignations] = useState([]);

  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: ITEMS_PER_PAGE,
    startIndex: 0,
    endIndex: 0,
  });

  const handleImgError = (id) => {
    setImgError((prev) => new Set(prev).add(id));
  };

  // --------------------------------------------------
  // Unauthorized handler
  // --------------------------------------------------

  const handleUnauthorized = (error) => {
    if (error.response?.data?.islogout === true) {
      router.push("/");
      return true;
    }

    return false;
  };

  // --------------------------------------------------
  // Get logged-in HOD department
  // --------------------------------------------------

  const fetchHodDepartment = async () => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/hod/staff/hoddep`,
        {
          withCredentials: true,
        }
      );

      const department = response.data?.department_code;

      if (!department) {
        console.error("Department not found for logged-in HOD");
        return;
      }

      console.log("HOD Department:", department);

      setSelDepartment(department);
    } catch (error) {
      if (handleUnauthorized(error)) return;

      console.error("Error fetching HOD department:", error);
    }
  };

  // --------------------------------------------------
  // Fetch staff
  // --------------------------------------------------

  const fetchStaff = async () => {
    // IMPORTANT:
    // Don't fetch until HOD department is available
    if (!selDepartment) {
      return;
    }

    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: ITEMS_PER_PAGE.toString(),
        search: searchText,
        department: selDepartment,
        designation: selDesignation,
        status: selStatus,
        category: selCategory,
      });

      console.log("Fetching staff for department:", selDepartment);

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/admin/staff?${params}`,
        {
          withCredentials: true,
        }
      );

      if (response.data.success) {
        setStaffList(response.data.data.staff);

        setStats(response.data.data.stats);

        setDesignations(
          response.data.data.filters?.designations || []
        );

        setPagination(response.data.data.pagination);
      }
    } catch (error) {
      if (handleUnauthorized(error)) return;

      console.error("Error fetching staff:", error);
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // First load:
  // Get HOD department
  // --------------------------------------------------

  useEffect(() => {
    fetchHodDepartment();
  }, []);

  // --------------------------------------------------
  // Fetch staff ONLY after department is available
  // --------------------------------------------------

  useEffect(() => {
    if (!selDepartment) {
      return;
    }

    fetchStaff();
  }, [
    selDepartment,
    currentPage,
    searchText,
    selDesignation,
    selStatus,
    selCategory,
  ]);

  // --------------------------------------------------
  // Reset page when filters change
  // --------------------------------------------------

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchText,
    selDesignation,
    selStatus,
    selCategory,
  ]);

  // --------------------------------------------------
  // Active filters
  // --------------------------------------------------

  const hasActiveFilters = !!(
    searchText ||
    selDesignation ||
    selStatus ||
    selCategory
  );

  // --------------------------------------------------
  // Clear filters
  // --------------------------------------------------

  const clearFilters = () => {
    setSearchText("");
    setSelDesignation("");
    setSelStatus("Active");
    setSelCategory("");
    setCurrentPage(1);

    // DO NOT clear selDepartment
    // HOD must always stay inside their department
  };

  // --------------------------------------------------
  // Pagination
  // --------------------------------------------------

  const handlePageChange = (newPage) => {
    if (
      newPage >= 1 &&
      newPage <= pagination.totalPages
    ) {
      setCurrentPage(newPage);
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1>Staff Management</h1>
          <p>
            Manage and view staff personnel in your department.
          </p>
        </div>

       
      </div>

      {/* Department Display */}
      <div className={styles.filters}>
        <div className={styles.filterLabel}>
          <SlidersHorizontal size={16} />
          <span>Department</span>
        </div>

        <div className={styles.departmentDisplay}>
          {selDepartment || "Loading department..."}
        </div>
      </div>

      {/* Statistics */}
      <div className={styles.statsGrid}>
        <div className={styles.card}>
          <div
            className={`${styles.cardIcon} ${styles.iconPrimary}`}
          >
            <Users size={20} />
          </div>

          <div>
            <span className={styles.cardLabel}>
              Total Staff
            </span>

            <h2 className={styles.cardValue}>
              {stats.totalStaff}
            </h2>
          </div>
        </div>

        <div className={styles.card}>
          <div
            className={`${styles.cardIcon} ${styles.iconSuccess}`}
          >
            <UserCheck size={20} />
          </div>

          <div>
            <span className={styles.cardLabel}>
              Active
            </span>

            <h2 className={styles.cardValue}>
              {stats.activeStaff}
            </h2>
          </div>
        </div>

        

        
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterLabel}>
          <SlidersHorizontal size={16} />
          <span>Filters</span>
        </div>

        {/* Department select REMOVED */}

        <select
          value={selDesignation}
          onChange={(e) =>
            setSelDesignation(e.target.value)
          }
        >
          <option value="">
            All Designations
          </option>

          {designations.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <select
          value={selStatus}
          onChange={(e) =>
            setSelStatus(e.target.value)
          }
        >
          <option value="">
            Status: All
          </option>

          <option value="Active">
            Active
          </option>

          <option value="Inactive">
            Inactive
          </option>

          <option value="Resigned">
            Resigned
          </option>

          <option value="Retired">
            Retired
          </option>
        </select>

        

        <div className={styles.searchBox}>
          <Search
            size={16}
            className={styles.searchIcon}
          />

          <input
            type="text"
            placeholder="Search by name or ID"
            value={searchText}
            onChange={(e) =>
              setSearchText(e.target.value)
            }
          />
        </div>

        {hasActiveFilters && (
          <button
            className={styles.clearBtn}
            onClick={clearFilters}
          >
            <X size={14} />
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.loadingState}>
            Loading staff records...
          </div>
        ) : (
          <table className={styles.table}>
            <thead className={styles.tableHead}>
              <tr>
                <th
                  className={styles.tableHeader}
                  scope="col"
                >
                  ID
                </th>

                <th
                  className={styles.tableHeader}
                  scope="col"
                >
                  Photo
                </th>

                <th
                  className={styles.tableHeader}
                  scope="col"
                >
                  Staff Code
                </th>

                <th
                  className={styles.tableHeader}
                  scope="col"
                >
                  Name
                </th>

                <th
                  className={styles.tableHeader}
                  scope="col"
                >
                  Department
                </th>

                <th
                  className={styles.tableHeader}
                  scope="col"
                >
                  Designation
                </th>

                <th
                  className={styles.tableHeader}
                  scope="col"
                >
                  Contact
                </th>

                <th
                  className={styles.tableHeader}
                  scope="col"
                >
                  Status
                </th>

                <th
                  className={styles.tableHeader}
                  scope="col"
                >
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {staffList.length === 0 ? (
                <tr>
                  <td
                    className={styles.emptyState}
                    colSpan={9}
                  >
                    No staff match these filters.
                  </td>
                </tr>
              ) : (
                staffList.map((staff) => (
                  <tr key={staff.id}>
                    <td className={styles.tableData}>
                      {staff.id}
                    </td>

                    <td className={styles.tableData}>
                      {staff.image &&
                      !imgError.has(staff.id) ? (
                        <img
                          src={`${process.env.NEXT_PUBLIC_BACKEND_URL}${staff.image}`}
                          alt={staff.name}
                          className={styles.avatar}
                          onError={() =>
                            handleImgError(staff.id)
                          }
                        />
                      ) : (
                        <div
                          className={
                            styles.avatarFallback
                          }
                        >
                          {getInitials(staff.name)}
                        </div>
                      )}
                    </td>

                    <td className={styles.tableData}>
                      {staff.staffCode}
                    </td>

                    <td className={styles.tableData}>
                      <strong>{staff.name}</strong>
                      <br />

                      <span
                        className={styles.typePill}
                      >
                        {staff.type}
                      </span>
                    </td>

                    <td className={styles.tableData}>
                      {staff.department}
                    </td>

                    <td className={styles.tableData}>
                      {staff.designation}
                    </td>

                    <td className={styles.tableData}>
                      {staff.email}
                      <br />
                      {staff.phone}
                    </td>

                    <td className={styles.tableData}>
                      <span
                        className={`${styles.statusPill} ${
                          staff.status === "Active"
                            ? styles.active
                            : styles.inactive
                        }`}
                      >
                        <span
                          className={
                            styles.statusDot
                          }
                        />

                        {staff.status}
                      </span>
                    </td>

                    <td className={styles.tableData}>
                      <div
                        className={
                          styles.actionGroup
                        }
                      >
                        <button
                          className={styles.viewBtn}
                          onClick={() =>
                            router.push(
                              `/hod/staff/view/${staff.id}`
                            )
                          }
                        >
                          <Eye size={14} />
                          View
                        </button>

                        
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {staffList.length > 0 && (
          <div className={styles.pagination}>
            <span
              className={styles.paginationInfo}
            >
              Showing {pagination.startIndex}–
              {pagination.endIndex} of{" "}
              {pagination.totalItems}
            </span>

            <div
              className={
                styles.paginationControls
              }
            >
              <button
                disabled={currentPage === 1}
                onClick={() =>
                  handlePageChange(
                    currentPage - 1
                  )
                }
              >
                <ChevronLeft size={16} />
              </button>

              <span>
                {currentPage} /{" "}
                {pagination.totalPages}
              </span>

              <button
                disabled={
                  currentPage ===
                  pagination.totalPages
                }
                onClick={() =>
                  handlePageChange(
                    currentPage + 1
                  )
                }
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