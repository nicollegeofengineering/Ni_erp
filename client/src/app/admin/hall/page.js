"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import styles from "./hall.module.css";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function HallsPage() {
  const router = useRouter(); // ✅ Hook must be used inside the component

  // ---------- State ----------
  const [halls, setHalls] = useState([]);
  const [loading, setLoading] = useState(true);
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

  // Search
  const [search, setSearch] = useState("");
  const [inputValue, setInputValue] = useState("");
  const searchTimeout = useRef(null);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [formData, setFormData] = useState({
    hallName: "",
    hallCode: "",
    capacity: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // ---------- Helper: redirect on unauthorized (islogout) ----------
  const handleUnauthorized = (error) => {
    if (error.response?.data?.islogout === true) {
      // Redirect to login; the cookie will be cleared by the backend logout endpoint
      router.push("/");
      return true;
    }
    return false;
  };

  // ---------- Fetch halls ----------
  const fetchHalls = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
      };
      if (search.trim()) params.search = search.trim();

      // The cookie is sent automatically with `withCredentials: true`
      const res = await axios.get(`${API_BASE}/api/admin/hall/all`, {
        params,
        withCredentials: true,
      });

      setHalls(res.data.data || []);
      setPagination((prev) => ({
        ...prev,
        total: res.data.pagination.total,
        totalPages: res.data.pagination.totalPages,
        hasNext: res.data.pagination.hasNext,
        hasPrev: res.data.pagination.hasPrev,
      }));
    } catch (err) {
      if (handleUnauthorized(err)) return;
      const msg = err.response?.data?.message || "Failed to load halls. Please refresh.";
      setError(msg);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, router]);

  useEffect(() => {
    fetchHalls();
  }, [fetchHalls]);

  // Debounced search
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearch(value);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 500);
  };

  const clearSearch = () => {
    setInputValue("");
    setSearch("");
    setPagination((prev) => ({ ...prev, page: 1 }));
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
  };

  // Pagination
  const goToPage = (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  // ---------- Modal ----------
  const openAddModal = () => {
    setModalMode("add");
    setFormData({ hallName: "", hallCode: "", capacity: "" });
    setFormError("");
    setModalOpen(true);
  };

  const openEditModal = (hall) => {
    setModalMode("edit");
    setFormData({
      hallName: hall.hallName || "",
      hallCode: hall.hallCode || "",
      capacity: hall.capacity.toString(),
      _id: hall._id,
    });
    setFormError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setFormData({ hallName: "", hallCode: "", capacity: "" });
    setFormError("");
  };

  // Handle form change
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    if (name === "capacity") {
      const numValue = value.replace(/[^0-9]/g, "");
      setFormData((prev) => ({ ...prev, [name]: numValue }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Submit add/edit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    const { hallName, hallCode, capacity } = formData;
    if (!hallName.trim()) {
      setFormError("Hall name is required.");
      return;
    }
    if (!hallCode.trim()) {
      setFormError("Hall code is required.");
      return;
    }
    const capNum = parseInt(capacity);
    if (!capacity || isNaN(capNum) || capNum <= 0) {
      setFormError("Capacity must be a positive number.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        hallName: hallName.trim(),
        hallCode: hallCode.trim().toUpperCase(),
        capacity: capNum,
      };

      if (modalMode === "add") {
        await axios.post(`${API_BASE}/api/admin/hall`, payload, {
          withCredentials: true,
        });
      } else {
        await axios.put(`${API_BASE}/api/admin/hall/${formData._id}`, payload, {
          withCredentials: true,
        });
      }
      closeModal();
      await fetchHalls();
    } catch (err) {
      if (handleUnauthorized(err)) return;
      const msg = err.response?.data?.message || "Operation failed.";
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete
  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to delete hall "${name}"?`)) return;
    try {
      await axios.delete(`${API_BASE}/api/admin/hall/${id}`, {
        withCredentials: true,
      });
      await fetchHalls();
    } catch (err) {
      if (handleUnauthorized(err)) return;
      alert(`Delete failed: ${err.response?.data?.message || err.message}`);
    }
  };

  // ---------- Render ----------
  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Halls</h1>
        <button className={styles.addButton} onClick={openAddModal}>
          + Add Hall
        </button>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.searchWrapper}>
          <input
            type="text"
            placeholder="Search by hall name or code..."
            className={styles.searchInput}
            value={inputValue}
            onChange={handleSearchChange}
          />
          {inputValue && (
            <button
              className={styles.clearButton}
              onClick={clearSearch}
              type="button"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {loading ? (
        <div className={styles.loading}>Loading halls…</div>
      ) : (
        <>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  {/*  */}
                  <th>Hall Name</th>
                  {/*  */}
                  <th>Hall Code</th>
                  {/*  */}
                  <th>Capacity</th>
                  {/*  */}
                  <th className={styles.actionsHeader}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {halls.length === 0 ? (
                  <tr>
                    <td colSpan="5" className={styles.emptyMessage}>
                      No halls found. Adjust search or add a new hall.
                    </td>
                  </tr>
                ) : (
                  halls.map((item, index) => (
                    <tr key={item._id}>
                      <td>{(pagination.page - 1) * pagination.limit + index + 1}</td>
                      <td>{item.hallName}</td>
                      <td>{item.hallCode}</td>
                      <td>{item.capacity}</td>
                      <td className={styles.actionsCell}>
                        <button
                          className={styles.editButton}
                          onClick={() => openEditModal(item)}
                        >
                          Edit
                        </button>
                        <button
                          className={styles.deleteButton}
                          onClick={() => handleDelete(item._id, item.hallName)}
                        >
                          Delete
                        </button>
                      </td>
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

      {/* Modal */}
      {modalOpen && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>{modalMode === "add" ? "Add Hall" : "Edit Hall"}</h2>
              <button className={styles.modalClose} onClick={closeModal}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className={styles.modalForm}>
              {formError && <div className={styles.formError}>{formError}</div>}

              <div className={styles.formGroup}>
                <label htmlFor="hallName">Hall Name</label>
                <input
                  type="text"
                  id="hallName"
                  name="hallName"
                  value={formData.hallName}
                  onChange={handleFormChange}
                  placeholder="e.g., Main Auditorium"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="hallCode">Hall Code</label>
                <input
                  type="text"
                  id="hallCode"
                  name="hallCode"
                  value={formData.hallCode}
                  onChange={handleFormChange}
                  placeholder="e.g., MA101"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="capacity">Capacity</label>
                <input
                  type="text"
                  id="capacity"
                  name="capacity"
                  value={formData.capacity}
                  onChange={handleFormChange}
                  placeholder="e.g., 200"
                  required
                />
                <small className={styles.helper}>Number of seats (must be positive).</small>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.saveButton}
                  disabled={submitting}
                >
                  {submitting ? (
                    <span className="btn-loading">
                      <Loader2 size={16} className="spin-icon" /> Saving...
                    </span>
                  ) : modalMode === "add" ? (
                    "Add Hall"
                  ) : (
                    "Update Hall"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}