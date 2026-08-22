"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import styles from "./department.module.css";

export default function DepartmentsPage() {
  

  const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL + "/api",
  withCredentials: true,
});
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: "", code: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Fetch departments
  const fetchDepartments = async () => {
    try {
      setLoading(true);
      // ✅ Updated endpoint: /admin/department/all
      const res = await api.get("/admin/department/all");
      setDepartments(res.data.data || []);
      setError(null);
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Failed to load departments. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value.toUpperCase() }));
  };

  
  // Close modal without saving
  const closeModal = () => {
    setShowModal(false);
    setFormData({ name: "", code: "" });
    setFormError("");
  };

  return (
    <div className={styles.container}>
      {/* Header with title and Add button */}
      <div className={styles.header}>
        <h1 className={styles.title}>Departments</h1>
        
      </div>

      {/* Error banner */}
      {error && <div className={styles.errorBanner}>{error}</div>}

      {/* Loading state */}
      {loading ? (
        <div className={styles.loading}>Loading departments…</div>
      ) : (
        <>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Code</th>
                  <th className={styles.actionsHeader}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.length === 0 ? (
                  <tr>
                    <td colSpan="4" className={styles.emptyMessage}>
                      No departments found. Click "Add Department" to create one.
                    </td>
                  </tr>
                ) : (
                  departments.map((dept, index) => (
                    <tr key={dept._id}>
                      <td>{index + 1}</td>
                      <td>{dept.name}</td>
                      <td>{dept.code}</td>
                      <td className={styles.actionsCell}>
                        <button
                          className={styles.deleteButton}
                          onClick={() => handleDelete(dept.code)}
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
        </>
      )}

      {/* Modal Overlay */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Add New Department</h2>
              <button className={styles.modalClose} onClick={closeModal}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className={styles.modalForm}>
              {formError && <div className={styles.formError}>{formError}</div>}
              <div className={styles.formGroup}>
                <label htmlFor="name">Department Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g., Human Resources"
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="code">Department Code</label>
                <input
                  type="text"
                  id="code"
                  name="code"
                  value={formData.code}
                  onChange={handleInputChange}
                  placeholder="e.g., HR"
                  required
                />
                <small className={styles.helper}>Uppercase letters only, no spaces.</small>
              </div>
              <div className={styles.modalActions}>
                <button type="button" className={styles.cancelButton} onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className={styles.saveButton} disabled={submitting}>
                  {submitting ? "Saving…" : "Save Department"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}