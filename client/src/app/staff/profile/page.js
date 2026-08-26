"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  User,
  GraduationCap,
  Mail,
  Phone,
  Calendar,
  Building,
  MapPin,
  Users,
  Award,
  RotateCw,
  ArrowLeft,
  Briefcase,
  ShieldCheck,
  CreditCard,
  KeyRound,
  FileText,
  DollarSign,
  HeartHandshake,
} from "lucide-react";
import styles from "../../student/css/student.module.css";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const api = axios.create({ baseURL: BASE_URL, withCredentials: true });

export default function StaffProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/user/profile");
      if (res.data.success) {
        setProfile(res.data.data);
      }
    } catch (err) {
      if (err.response?.data?.islogout === true || err.response?.status === 401) {
        router.push("/");
        return;
      }
      console.error("Failed to load staff profile:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const photoSrc = profile?.profile_image
    ? profile.profile_image.startsWith("http")
      ? profile.profile_image
      : profile.profile_image === "/user.png"
        ? "/user.png"
        : `${BASE_URL}${profile.profile_image.startsWith("/") ? "" : "/"}${profile.profile_image}`
    : "/user.png";

  const fullName = profile
    ? `${profile.prefix ? profile.prefix + " " : ""}${profile.first_name || profile.name || "Faculty Member"} ${profile.last_name || ""}`.trim()
    : "Faculty Member";

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <div>
          <h1 className={styles.title}>Faculty Staff Profile</h1>
          <p className={styles.subtitle}>
            Complete academic, employment, personal, contact &amp; banking records from database
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            className={styles.tabBtn}
            onClick={() => router.push("/staff")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              color: "#334155",
            }}
          >
            <ArrowLeft size={15} /> Back to Dashboard
          </button>

          <button
            className={`${styles.tabBtn} ${styles.tabBtnActive}`}
            onClick={fetchProfile}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <RotateCw size={14} /> Refresh Profile
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ textAlign: "center", color: "#64748b", padding: "40px 0" }}>
          Loading staff profile records from database...
        </p>
      ) : !profile ? (
        <div style={{ textAlign: "center", color: "#64748b", padding: "40px 0" }}>
          <User size={40} color="#cbd5e1" style={{ margin: "0 auto 10px" }} />
          <p>Unable to load faculty staff profile record.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          {/* Header Identity Card */}
          <div
            className={styles.cardSection}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "24px",
              flexWrap: "wrap",
              padding: "24px 28px",
              background: "linear-gradient(135deg, #ffffff 0%, #f0f7ff 100%)",
            }}
          >
            <div
              style={{
                width: "110px",
                height: "110px",
                borderRadius: "50%",
                overflow: "hidden",
                border: "3.5px solid #0381ff",
                boxShadow: "0 6px 18px rgba(3, 129, 255, 0.25)",
                flexShrink: 0,
                background: "#f1f5f9",
              }}
            >
              <img
                src={photoSrc}
                alt={fullName}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={(e) => {
                  e.target.src = "/user.png";
                }}
              />
            </div>

            <div>
              <h2
                style={{
                  margin: "0 0 6px 0",
                  fontSize: "24px",
                  color: "#0b1d3a",
                  fontWeight: 800,
                }}
              >
                {fullName}
              </h2>
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                  alignItems: "center",
                  marginTop: "6px",
                }}
              >
                <span
                  style={{
                    background: "#0b1d3a",
                    color: "#ffffff",
                    padding: "4px 12px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: 700,
                  }}
                >
                  Faculty • {profile.department_code || "Department"}
                </span>
                <span
                  style={{
                    background: "#eff6ff",
                    color: "#0381ff",
                    padding: "4px 12px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: 700,
                    border: "1px solid #bfdbfe",
                  }}
                >
                  Staff ID: {profile.staff_id || "N/A"}
                </span>
                {profile.staff_code && (
                  <span
                    style={{
                      background: "#e8edf6",
                      color: "#1e3a8a",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "12.5px",
                      fontWeight: 600,
                    }}
                  >
                    Staff Code: {profile.staff_code}
                  </span>
                )}
                <span
                  className={`${styles.badge} ${styles.badgeSuccess}`}
                  style={{ fontSize: "12.5px", padding: "4px 12px" }}
                >
                  {profile.staff_status || "Active"}
                </span>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
              gap: "20px",
            }}
          >
            {/* 1. Account & Login Credentials */}
            <div className={styles.cardSection}>
              <div className={styles.sectionTitle}>
                <KeyRound size={20} color="#0381ff" />
                Account &amp; Login Details
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13.5px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Login ID / Username:</span>
                  <strong style={{ color: "#0b1d3a" }}>{profile.username || profile.email}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Staff ID:</span>
                  <strong style={{ color: "#0b1d3a" }}>{profile.staff_id || "—"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Official Email:</span>
                  <strong style={{ color: "#0b1d3a" }}>{profile.email || "—"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>System Role:</span>
                  <strong style={{ color: "#0b1d3a" }}>{profile.role_type || "Staff"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Account Status:</span>
                  <strong style={{ color: "#15803d" }}>Active</strong>
                </div>
              </div>
            </div>

            {/* 2. Employment & Department Info */}
            <div className={styles.cardSection}>
              <div className={styles.sectionTitle}>
                <Briefcase size={20} color="#0381ff" />
                Employment &amp; Designation Details
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13.5px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Department:</span>
                  <strong style={{ color: "#0b1d3a" }}>{profile.department_code || "—"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Designation:</span>
                  <strong style={{ color: "#0b1d3a" }}>{profile.designation || "Assistant Professor"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Employment Type:</span>
                  <strong style={{ color: "#0b1d3a" }}>{profile.employment_type || "FullTime"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Date of Joining:</span>
                  <strong style={{ color: "#0b1d3a" }}>{formatDate(profile.joining_date)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Experience:</span>
                  <strong style={{ color: "#0b1d3a" }}>{profile.experience_years ? `${profile.experience_years} Years` : "—"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Staff Status:</span>
                  <strong style={{ color: "#15803d" }}>{profile.staff_status || "Active"}</strong>
                </div>
              </div>
            </div>

            {/* 3. Educational Qualifications */}
            <div className={styles.cardSection}>
              <div className={styles.sectionTitle}>
                <GraduationCap size={20} color="#0381ff" />
                Educational Qualifications
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13.5px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Highest Qualification:</span>
                  <strong style={{ color: "#0b1d3a" }}>{profile.highest_qualification || "M.E. / M.Tech"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Specialization Area:</span>
                  <strong style={{ color: "#0b1d3a" }}>{profile.specialization || "—"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>University / Institute:</span>
                  <strong style={{ color: "#0b1d3a", textAlign: "right", maxWidth: "200px" }}>{profile.university || "—"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Year of Passing:</span>
                  <strong style={{ color: "#0b1d3a" }}>{profile.passing_year || "—"}</strong>
                </div>
              </div>
            </div>

            {/* 4. Personal Information */}
            <div className={styles.cardSection}>
              <div className={styles.sectionTitle}>
                <User size={20} color="#0381ff" />
                Personal Information
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13.5px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Gender:</span>
                  <strong style={{ color: "#0b1d3a" }}>{profile.gender || "—"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Date of Birth:</span>
                  <strong style={{ color: "#0b1d3a" }}>{formatDate(profile.date_of_birth)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Blood Group:</span>
                  <strong style={{ color: "#0b1d3a" }}>{profile.blood_group || "—"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Marital Status:</span>
                  <strong style={{ color: "#0b1d3a" }}>{profile.marital_status || "—"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Aadhar Number:</span>
                  <strong style={{ color: "#0b1d3a" }}>{profile.aadhar_number || "—"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>PAN Number:</span>
                  <strong style={{ color: "#0b1d3a" }}>{profile.pan_number || "—"}</strong>
                </div>
              </div>
            </div>

            {/* 5. Contact & Address Information */}
            <div className={styles.cardSection}>
              <div className={styles.sectionTitle}>
                <Mail size={20} color="#0381ff" />
                Contact &amp; Address Details
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13.5px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Phone / Mobile:</span>
                  <strong style={{ color: "#0b1d3a" }}>{profile.phone_number || "—"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Personal Email:</span>
                  <strong style={{ color: "#0b1d3a" }}>{profile.personal_email || "—"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Emergency Contact:</span>
                  <strong style={{ color: "#0b1d3a" }}>
                    {profile.emergency_contact_name ? `${profile.emergency_contact_name} (${profile.emergency_contact_number || "—"})` : "—"}
                  </strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>City &amp; State:</span>
                  <strong style={{ color: "#0b1d3a" }}>{profile.city || "—"}{profile.state ? `, ${profile.state}` : ""}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Pincode:</span>
                  <strong style={{ color: "#0b1d3a" }}>{profile.pincode || "—"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Street Address:</span>
                  <strong style={{ color: "#0b1d3a", textAlign: "right", maxWidth: "200px" }}>
                    {profile.address || "—"}
                  </strong>
                </div>
              </div>
            </div>

            {/* 6. Banking & Financial Information */}
            <div className={styles.cardSection}>
              <div className={styles.sectionTitle}>
                <CreditCard size={20} color="#0381ff" />
                Banking &amp; Payroll Information
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13.5px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Bank Name:</span>
                  <strong style={{ color: "#0b1d3a" }}>{profile.bank_name || "—"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Bank Account Number:</span>
                  <strong style={{ color: "#0b1d3a" }}>{profile.bank_account_number || "—"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>IFSC Code:</span>
                  <strong style={{ color: "#0b1d3a" }}>{profile.ifsc_code || "—"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Branch Name:</span>
                  <strong style={{ color: "#0b1d3a" }}>{profile.branch_name || "—"}</strong>
                </div>
                {profile.salary && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>Salary:</span>
                    <strong style={{ color: "#15803d" }}>₹{Number(profile.salary).toLocaleString("en-IN")}</strong>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
