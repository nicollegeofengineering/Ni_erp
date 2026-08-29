"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { BookOpen, CalendarRange, ListFilter } from "lucide-react";
import StaffAssignedView from "@/app/components/StaffAssignedView";
import styles from "./subjects.module.css";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function SubjectsPage() {
  // Active Tab: 'assigned' (Assigned Subjects & Timetable) vs 'catalog' (All College Subjects)
  const [activeTab, setActiveTab] = useState("assigned");

  // ---------- State for Catalog ----------
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const searchTimeout = useRef(null);

  const handleUnauthorized = (error) => {
    if (error.response?.data?.islogout === true) {
      window.location.href = "/";
      return true;
    }
    return false;
  };

  // ---------- Fetch all catalog subjects ----------
  const fetchSubjects = useCallback(async () => {
    if (activeTab !== "catalog") return;
    setLoading(true);
    setError("");
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (search.trim()) params.search = search.trim();
      if (categoryFilter) params.category = categoryFilter;

      const res = await axios.get(`${API_BASE}/api/admin/subject/all`, {
        params,
        withCredentials: true,
      });

      setSubjects(res.data.data || []);
      setPagination((prev) => ({
        ...prev,
        total: res.data.pagination.total,
        totalPages: res.data.pagination.totalPages,
        hasNext: res.data.pagination.hasNext,
        hasPrev: res.data.pagination.hasPrev,
      }));
    } catch (err) {
      if (handleUnauthorized(err)) return;
      const msg = err.response?.data?.message || "Failed to load subjects. Please refresh.";
      setError(msg);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, pagination.page, pagination.limit, search, categoryFilter]);

  useEffect(() => {
    if (activeTab === "catalog") {
      fetchSubjects();
    }
  }, [activeTab, fetchSubjects]);

  // Debounced search
  const handleSearchChange = (e) => {
    const value = e.target.value.toUpperCase();
    setSearch(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 500);
  };

  const handleClearFilters = () => {
    setSearch("");
    setCategoryFilter("");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const goToPage = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Faculty Subjects & Timetable</h1>

        {/* View Switcher Tabs */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setActiveTab("assigned")}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: activeTab === "assigned" ? "2px solid #0284c7" : "1px solid #cbd5e1",
              background: activeTab === "assigned" ? "#0284c7" : "#ffffff",
              color: activeTab === "assigned" ? "#ffffff" : "#334155",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.15s ease",
            }}
          >
            <BookOpen size={16} /> My Assigned Subjects & Timetable
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("catalog")}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: activeTab === "catalog" ? "2px solid #0284c7" : "1px solid #cbd5e1",
              background: activeTab === "catalog" ? "#0284c7" : "#ffffff",
              color: activeTab === "catalog" ? "#ffffff" : "#334155",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.15s ease",
            }}
          >
            <ListFilter size={16} /> College Subject Catalog
          </button>
        </div>
      </div>

      {activeTab === "assigned" ? (
        /* Mobile-Friendly Assigned Subjects in Card Form (by Year) & Timetable in Table Form */
        <StaffAssignedView role="Staff" allowStaffSelection={false} />
      ) : (
        /* All College Subjects Directory Catalog */
        <>
          <div className={styles.filters}>
            <input
              type="text"
              placeholder="Search by name or code..."
              className={styles.searchInput}
              onChange={handleSearchChange}
              value={search}
            />
            <button onClick={handleClearFilters} className={styles.clearButton}>
              Clear Filters
            </button>
          </div>

          {error && <div className={styles.errorBanner}>{error}</div>}

          {loading ? (
            <div className={styles.loading}>Loading subjects catalog…</div>
          ) : (
            <>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Subject Name</th>
                      <th>Code</th>
                      <th>Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.length === 0 ? (
                      <tr>
                        <td colSpan="4" className={styles.emptyMessage}>
                          No subjects found. Adjust filters or search terms.
                        </td>
                      </tr>
                    ) : (
                      subjects.map((item, index) => (
                        <tr key={item._id}>
                          <td>{(pagination.page - 1) * pagination.limit + index + 1}</td>
                          <td>{item.subjectName}</td>
                          <td>{item.subjectCode}</td>
                          <td>{item.Category}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className={styles.pagination}>
                <button
                  onClick={() => goToPage(pagination.page - 1)}
                  disabled={!pagination.hasPrev}
                  className={styles.pageButton}
                >
                  Previous
                </button>
                <span className={styles.pageInfo}>
                  Page {pagination.page} of {pagination.totalPages || 1}
                </span>
                <button
                  onClick={() => goToPage(pagination.page + 1)}
                  disabled={!pagination.hasNext}
                  className={styles.pageButton}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}