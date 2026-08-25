"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import AdminSidebar from "../../components/admin_sidebar";
import styles from "./admissions.module.css";
import {
  GraduationCap,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  FileText,
  Filter,
  RefreshCw,
  X,
  Mail,
  Phone,
  Calendar,
  Building,
  MapPin,
  Award,
  Send,
} from "lucide-react";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const api = axios.create({ baseURL: BASE_URL, withCredentials: true });

export default function AdminAdmissionsPage() {
  const [applications, setApplications] = useState([]);
  const [stats, setStats] = useState({ totalAll: 0, pending: 0, accepted: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ totalPages: 1, total: 0 });

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [yearFilter, setYearFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [selectedApp, setSelectedApp] = useState(null);
  const [actionModal, setActionModal] = useState(null); // { app, action: 'accepted' | 'rejected' }
  const [adminComment, setAdminComment] = useState("");
  const [updating, setUpdating] = useState(false);

  // Departments list for filter
  const departments = ["ALL", "CSE", "ECE", "EEE", "MECH", "CIVIL", "AI&DS", "IT", "MBA", "MCA"];

  // Fetch Applications
  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 15,
      };

      if (statusFilter !== "all") params.status = statusFilter;
      if (deptFilter !== "ALL") params.department = deptFilter;
      if (yearFilter !== "ALL") params.academicYear = yearFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await api.get("/api/admission/admin/applications/list", { params });

      if (res.data && res.data.success) {
        setApplications(res.data.data || []);
        if (res.data.stats) setStats(res.data.stats);
        if (res.data.pagination) setPagination(res.data.pagination);
      } else {
        console.error("Failed to load applications:", res.data?.message);
      }
    } catch (err) {
      console.error("Error fetching applications:", err?.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, deptFilter, yearFilter, searchQuery]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  // Handle Approve / Reject Submission
  const handleStatusUpdate = async () => {
    if (!actionModal || !actionModal.app) return;
    setUpdating(true);
    try {
      const res = await api.put(`/api/admission/admin/${actionModal.app._id}/status`, {
        status: actionModal.action,
        adminComment: adminComment.trim(),
      });

      if (res.data && res.data.success) {
        alert(`Application marked as ${actionModal.action.toUpperCase()} and intimation email sent to candidate.`);
        setActionModal(null);
        setAdminComment("");
        if (selectedApp && selectedApp._id === actionModal.app._id) {
          setSelectedApp(res.data.data);
        }
        fetchApplications();
      } else {
        alert("Failed to update status: " + (res.data?.message || "Unknown error"));
      }
    } catch (err) {
      console.error("Error updating status:", err);
      alert("Error: " + (err?.response?.data?.message || err.message));
    } finally {
      setUpdating(false);
    }
  };

  const openActionDialog = (app, action) => {
    setActionModal({ app, action });
    if (action === "accepted") {
      setAdminComment("Provisional admission granted. Please submit required original certificates at the college office within 3 working days.");
    } else {
      setAdminComment("Application could not be selected for the current academic session due to cutoff and seat availability criteria.");
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className={styles.mcontainer}>
      <AdminSidebar />
      <div className={styles.container}>
        {/* Top Header */}
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.title}>
              <GraduationCap size={26} color="#2563eb" /> Online Admissions Management
            </h1>
            <p className={styles.subtitle}>
              Review candidate applications submitted from the college website, filter by criteria, and manage approvals
            </p>
          </div>

          <button
            type="button"
            className={styles.btnAction}
            onClick={fetchApplications}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
          </button>
        </div>

        {/* Stats KPI Cards */}
        <div className={styles.statsGrid}>
          <div
            className={styles.statCard}
            onClick={() => {
              setStatusFilter("all");
              setPage(1);
            }}
          >
            <div className={styles.statIconBox} style={{ background: "#eff6ff", color: "#2563eb" }}>
              <FileText size={22} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Total Applications</span>
              <span className={styles.statValue}>{stats.totalAll}</span>
            </div>
          </div>

          <div
            className={styles.statCard}
            onClick={() => {
              setStatusFilter("pending");
              setPage(1);
            }}
          >
            <div className={styles.statIconBox} style={{ background: "#fef3c7", color: "#d97706" }}>
              <Clock size={22} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Pending Review</span>
              <span className={styles.statValue} style={{ color: "#d97706" }}>
                {stats.pending}
              </span>
            </div>
          </div>

          <div
            className={styles.statCard}
            onClick={() => {
              setStatusFilter("accepted");
              setPage(1);
            }}
          >
            <div className={styles.statIconBox} style={{ background: "#dcfce7", color: "#16a34a" }}>
              <CheckCircle size={22} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Accepted</span>
              <span className={styles.statValue} style={{ color: "#16a34a" }}>
                {stats.accepted}
              </span>
            </div>
          </div>

          <div
            className={styles.statCard}
            onClick={() => {
              setStatusFilter("rejected");
              setPage(1);
            }}
          >
            <div className={styles.statIconBox} style={{ background: "#fee2e2", color: "#dc2626" }}>
              <XCircle size={22} />
            </div>
            <div className={styles.statInfo}>
              <span className={styles.statLabel}>Rejected</span>
              <span className={styles.statValue} style={{ color: "#dc2626" }}>
                {stats.rejected}
              </span>
            </div>
          </div>
        </div>

        {/* Filters Card */}
        <div className={styles.filterCard}>
          <div className={styles.filterGrid}>
            {/* Status Filter Tabs */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Status Filter</label>
              <div className={styles.tabsGroup}>
                {["all", "pending", "accepted", "rejected"].map((st) => (
                  <button
                    key={st}
                    type="button"
                    className={`${styles.tabBtn} ${statusFilter === st ? styles.tabActive : ""}`}
                    onClick={() => {
                      setStatusFilter(st);
                      setPage(1);
                    }}
                  >
                    {st.charAt(0).toUpperCase() + st.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Department Filter */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Department</label>
              <select
                className={styles.formSelect}
                value={deptFilter}
                onChange={(e) => {
                  setDeptFilter(e.target.value);
                  setPage(1);
                }}
              >
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d === "ALL" ? "All Departments" : d}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className={styles.searchInputWrapper}>
              <label className={styles.formLabel}>Search Candidate</label>
              <div style={{ position: "relative" }}>
                <Search size={15} className={styles.searchIcon} />
                <input
                  type="text"
                  className={`${styles.formInput} ${styles.searchInput}`}
                  placeholder="Search by Name, Hall Ticket, Email, or Mobile..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Applications Table */}
        <div className={styles.tableCard}>
          <div className={styles.tableToolbar}>
            <div className={styles.tableTitle}>
              <Filter size={15} color="#2563eb" /> Candidate Applications
              <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 500 }}>
                ({pagination.total} total found)
              </span>
            </div>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Candidate Name</th>
                  <th>Hall Ticket No</th>
                  <th>Preferred Branch</th>
                  <th>Department</th>
                  <th>Cutoff Mark</th>
                  <th>Contact Info</th>
                  <th>Submitted On</th>
                  <th>Status</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                      Loading admission applications...
                    </td>
                  </tr>
                ) : applications.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                      No applications found matching the selected filters.
                    </td>
                  </tr>
                ) : (
                  applications.map((app) => (
                    <tr key={app._id}>
                      <td>
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>{app.name}</div>
                        <div style={{ fontSize: "11px", color: "#64748b" }}>
                          Father: {app.fatherName}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#2563eb" }}>
                          {app.hallTicketNo}
                        </span>
                        <div style={{ fontSize: "11px", color: "#64748b" }}>
                          {app.academicYear}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{app.branchPreferred}</span>
                        <div style={{ fontSize: "11px", color: "#64748b" }}>
                          {app.admissionFor}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: "#334155" }}>
                          {app.department}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontWeight: 800,
                            color: app.cutoffMark >= 160 ? "#16a34a" : "#0f172a",
                          }}
                        >
                          {app.cutoffMark ? `${app.cutoffMark} / 200` : "—"}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <Phone size={11} color="#64748b" /> {app.mobile}
                        </div>
                        <div style={{ fontSize: "11px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
                          <Mail size={11} color="#64748b" /> {app.email}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: "12px", color: "#475569" }}>
                          {formatDate(app.submittedAt || app.createdAt)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`${styles.statusBadge} ${
                            app.status === "accepted"
                              ? styles.statusAccepted
                              : app.status === "rejected"
                              ? styles.statusRejected
                              : styles.statusPending
                          }`}
                        >
                          {app.status === "accepted" && <CheckCircle size={12} />}
                          {app.status === "rejected" && <XCircle size={12} />}
                          {app.status === "pending" && <Clock size={12} />}
                          {app.status}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actionBtns} style={{ justifyContent: "center" }}>
                          <button
                            type="button"
                            className={styles.btnView}
                            onClick={() => setSelectedApp(app)}
                            title="View Full Application Details"
                          >
                            <Eye size={13} /> View
                          </button>

                          {app.status === "pending" && (
                            <>
                              <button
                                type="button"
                                className={styles.btnAccept}
                                style={{ padding: "5px 9px", fontSize: "11.5px" }}
                                onClick={() => openActionDialog(app, "accepted")}
                                title="Approve Application"
                              >
                                <CheckCircle size={12} /> Accept
                              </button>
                              <button
                                type="button"
                                className={styles.btnReject}
                                style={{ padding: "5px 9px", fontSize: "11.5px" }}
                                onClick={() => openActionDialog(app, "rejected")}
                                title="Reject Application"
                              >
                                <XCircle size={12} /> Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className={styles.pagination}>
              <span>
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} items)
              </span>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className={styles.pageBtn}
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className={styles.pageBtn}
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* CANDIDATE DETAILS MODAL */}
        {selectedApp && (
          <div className={styles.modalOverlay} onClick={() => setSelectedApp(null)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  <GraduationCap size={20} color="#2563eb" /> Application Details — {selectedApp.name}
                </h3>
                <button type="button" className={styles.closeBtn} onClick={() => setSelectedApp(null)}>
                  <X size={18} />
                </button>
              </div>

              <div className={styles.modalBody}>
                {/* Status & Reference Header Banner */}
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    padding: "12px 16px",
                    marginBottom: "18px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <div>
                    <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                      Application ID:
                    </span>{" "}
                    <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#2563eb" }}>
                      {selectedApp._id}
                    </span>
                  </div>
                  <div>
                    <span
                      className={`${styles.statusBadge} ${
                        selectedApp.status === "accepted"
                          ? styles.statusAccepted
                          : selectedApp.status === "rejected"
                          ? styles.statusRejected
                          : styles.statusPending
                      }`}
                    >
                      {selectedApp.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Section 1: Academic & Branch Preference */}
                <div className={styles.detailSection}>
                  <div className={styles.sectionHeading}>
                    <Award size={14} /> Academic &amp; Course Preferences
                  </div>
                  <div className={styles.detailGrid}>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Hall Ticket Number</span>
                      <span className={styles.detailValue} style={{ fontFamily: "monospace", color: "#2563eb" }}>
                        {selectedApp.hallTicketNo}
                      </span>
                    </div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Academic Year</span>
                      <span className={styles.detailValue}>{selectedApp.academicYear}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Admission Level</span>
                      <span className={styles.detailValue}>{selectedApp.admissionFor}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Department</span>
                      <span className={styles.detailValue}>{selectedApp.department}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Preferred Branch</span>
                      <span className={styles.detailValue}>{selectedApp.branchPreferred}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Cutoff Marks</span>
                      <span className={styles.detailValue} style={{ fontWeight: 800, color: "#16a34a" }}>
                        {selectedApp.cutoffMark ? `${selectedApp.cutoffMark} / 200` : "Not provided"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 2: Personal Details */}
                <div className={styles.detailSection}>
                  <div className={styles.sectionHeading}>Personal Information</div>
                  <div className={styles.detailGrid}>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Full Name</span>
                      <span className={styles.detailValue}>{selectedApp.name}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Father / Guardian Name</span>
                      <span className={styles.detailValue}>{selectedApp.fatherName}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Date of Birth</span>
                      <span className={styles.detailValue}>{formatDate(selectedApp.dob)}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Gender</span>
                      <span className={styles.detailValue}>{selectedApp.gender}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Religion</span>
                      <span className={styles.detailValue}>{selectedApp.religion}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Community</span>
                      <span className={styles.detailValue}>{selectedApp.community}</span>
                    </div>
                  </div>
                </div>

                {/* Section 3: Contact & Address */}
                <div className={styles.detailSection}>
                  <div className={styles.sectionHeading}>
                    <MapPin size={14} /> Contact &amp; Residential Details
                  </div>
                  <div className={styles.detailGrid}>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Student Mobile</span>
                      <span className={styles.detailValue}>{selectedApp.mobile}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Parent Mobile</span>
                      <span className={styles.detailValue}>{selectedApp.parentMobile}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>Email Address</span>
                      <span className={styles.detailValue}>{selectedApp.email}</span>
                    </div>
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>District &amp; State</span>
                      <span className={styles.detailValue}>
                        {selectedApp.district}, {selectedApp.state} – {selectedApp.pincode}
                      </span>
                    </div>
                  </div>
                  <div style={{ marginTop: "10px" }}>
                    <div className={styles.detailLabel}>Residence Address</div>
                    <div style={{ fontSize: "13px", color: "#0f172a", marginTop: "2px" }}>
                      {selectedApp.residenceAddress}
                    </div>
                  </div>
                  {!selectedApp.sameAsResidence && (
                    <div style={{ marginTop: "8px" }}>
                      <div className={styles.detailLabel}>Permanent Address</div>
                      <div style={{ fontSize: "13px", color: "#0f172a", marginTop: "2px" }}>
                        {selectedApp.permanentAddress}
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 4: Admin Remarks & Review History */}
                {selectedApp.adminComment && (
                  <div
                    style={{
                      background: "#f8fafc",
                      borderLeft: "4px solid #2563eb",
                      padding: "12px 16px",
                      borderRadius: "4px",
                      marginTop: "14px",
                    }}
                  >
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#334155" }}>
                      Admin Remarks on Record:
                    </div>
                    <div style={{ fontSize: "13px", color: "#1e293b", marginTop: "4px" }}>
                      "{selectedApp.adminComment}"
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnCancel} onClick={() => setSelectedApp(null)}>
                  Close
                </button>
                <button
                  type="button"
                  className={styles.btnReject}
                  onClick={() => {
                    const app = selectedApp;
                    setSelectedApp(null);
                    openActionDialog(app, "rejected");
                  }}
                >
                  <XCircle size={14} /> Reject Application
                </button>
                <button
                  type="button"
                  className={styles.btnAccept}
                  onClick={() => {
                    const app = selectedApp;
                    setSelectedApp(null);
                    openActionDialog(app, "accepted");
                  }}
                >
                  <CheckCircle size={14} /> Accept Application
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ACTION / REMARK MODAL */}
        {actionModal && (
          <div className={styles.modalOverlay} onClick={() => setActionModal(null)}>
            <div className={styles.modalContent} style={{ maxWidth: "540px" }} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  {actionModal.action === "accepted" ? (
                    <>
                      <CheckCircle size={18} color="#16a34a" /> Provisionally Accept Application
                    </>
                  ) : (
                    <>
                      <XCircle size={18} color="#dc2626" /> Reject Application
                    </>
                  )}
                </h3>
                <button type="button" className={styles.closeBtn} onClick={() => setActionModal(null)}>
                  <X size={18} />
                </button>
              </div>

              <div className={styles.modalBody}>
                <p style={{ fontSize: "13.5px", color: "#334155", marginTop: 0 }}>
                  You are about to mark <strong>{actionModal.app.name}</strong>'s application as{" "}
                  <strong style={{ color: actionModal.action === "accepted" ? "#16a34a" : "#dc2626" }}>
                    {actionModal.action.toUpperCase()}
                  </strong>
                  . An automatic intimation email will be dispatched to <strong>{actionModal.app.email}</strong>.
                </p>

                <div className={styles.formGroup} style={{ marginTop: "14px" }}>
                  <label className={styles.formLabel}>Admin Remarks / Next Steps Instructions for Candidate</label>
                  <textarea
                    rows={4}
                    className={styles.formInput}
                    style={{ resize: "vertical", width: "100%", boxSizing: "border-box" }}
                    placeholder="Enter instructions, document submission dates, or reason for status update..."
                    value={adminComment}
                    onChange={(e) => setAdminComment(e.target.value)}
                  />
                  <small style={{ fontSize: "11.5px", color: "#64748b" }}>
                    This note will be included in the email notification sent to the student and shown on their tracking page.
                  </small>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnCancel} onClick={() => setActionModal(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={actionModal.action === "accepted" ? styles.btnAccept : styles.btnReject}
                  onClick={handleStatusUpdate}
                  disabled={updating}
                >
                  <Send size={13} /> {updating ? "Processing & Sending Email..." : `Confirm ${actionModal.action.toUpperCase()}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
