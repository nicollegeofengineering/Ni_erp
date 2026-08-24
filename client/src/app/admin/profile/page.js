"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  User,
  ShieldCheck,
  Mail,
  Calendar,
  KeyRound,
  RotateCw,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Phone,
  Building,
  MapPin,
  Briefcase,
  GraduationCap,
} from "lucide-react";
import styles from "../../student/css/student.module.css";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const api = axios.create({ baseURL: BASE_URL, withCredentials: true });

export default function AdminProfilePage() {
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
      console.error("Failed to load admin profile:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const formatDate = (d) => {
    if (!d) return "—";
    const date = new Date(d);
    return date.toLocaleDateString("en-IN", {
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
    ? `${profile.prefix ? profile.prefix + " " : ""}${profile.first_name || profile.name || "Administrator"} ${profile.last_name || ""}`.trim()
    : "Administrator";

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <div>
          <h1 className={styles.title}>Administrator Profile</h1>
          <p className={styles.subtitle}>
            System administrator credentials, account information &amp; permissions
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            className={styles.tabBtn}
            onClick={() => router.push("/admin")}
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
          Loading administrator profile...
        </p>
      ) : !profile ? (
        <div style={{ textAlign: "center", color: "#64748b", padding: "40px 0" }}>
          <User size={40} color="#cbd5e1" style={{ margin: "0 auto 10px" }} />
          <p>Unable to load administrator account profile.</p>
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
                  Role: Administrator
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
                  Username: {profile.username || profile.email}
                </span>
                {profile.staff_id && (
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
                    Staff ID: {profile.staff_id}
                  </span>
                )}
                <span
                  className={`${styles.badge} ${styles.badgeSuccess}`}
                  style={{ fontSize: "12.5px", padding: "4px 12px" }}
                >
                  {profile.isActive !== false ? "Active Account" : "Inactive"}
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
            {/* 1. Account & Security Information */}
            <div className={styles.cardSection}>
              <div className={styles.sectionTitle}>
                <KeyRound size={20} color="#0381ff" />
                Account &amp; Security Credentials
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13.5px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Username / Email:</span>
                  <strong style={{ color: "#0b1d3a" }}>{profile.username || profile.email}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Official Email:</span>
                  <strong style={{ color: "#0b1d3a" }}>{profile.email}</strong>
                </div>
                {profile.login_id && profile.login_id !== profile.email && (
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                    <span style={{ color: "#64748b" }}>Login ID:</span>
                    <strong style={{ color: "#0b1d3a" }}>{profile.login_id}</strong>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Account Status:</span>
                  <strong style={{ color: "#15803d" }}>{profile.isActive !== false ? "Active & Verified" : "Suspended"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Created Date:</span>
                  <strong style={{ color: "#0b1d3a" }}>{formatDate(profile.createdAt)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>Last Modified:</span>
                  <strong style={{ color: "#0b1d3a" }}>{formatDate(profile.updatedAt)}</strong>
                </div>
              </div>
            </div>

            {/* 2. Faculty / Administrative Details if available */}
            {profile.department_code || profile.designation || profile.phone_number ? (
              <div className={styles.cardSection}>
                <div className={styles.sectionTitle}>
                  <Briefcase size={20} color="#0381ff" />
                  Administrative Profile Details
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13.5px" }}>
                  {profile.designation && (
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                      <span style={{ color: "#64748b" }}>Designation:</span>
                      <strong style={{ color: "#0b1d3a" }}>{profile.designation}</strong>
                    </div>
                  )}
                  {profile.department_code && (
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                      <span style={{ color: "#64748b" }}>Department:</span>
                      <strong style={{ color: "#0b1d3a" }}>{profile.department_code}</strong>
                    </div>
                  )}
                  {profile.phone_number && (
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                      <span style={{ color: "#64748b" }}>Contact Phone:</span>
                      <strong style={{ color: "#0b1d3a" }}>{profile.phone_number}</strong>
                    </div>
                  )}
                  {profile.highest_qualification && (
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                      <span style={{ color: "#64748b" }}>Qualification:</span>
                      <strong style={{ color: "#0b1d3a" }}>{profile.highest_qualification}</strong>
                    </div>
                  )}
                  {profile.joining_date && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Joining Date:</span>
                      <strong style={{ color: "#0b1d3a" }}>{formatDate(profile.joining_date)}</strong>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className={styles.cardSection}>
                <div className={styles.sectionTitle}>
                  <ShieldCheck size={20} color="#0381ff" />
                  System Privileges &amp; Scope
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
                  {[
                    "Universal System & Database Control",
                    "Student, HOD & Faculty Lifecycle Management",
                    "Department & Course Curriculum Operations",
                    "Academic Timetable & Hall Allocations",
                    "College-wide Announcements & Circulars Control",
                    "Consolidated Attendance & Internal Marks Authority",
                  ].map((priv, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        background: "#f8fafc",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <CheckCircle2 size={16} color="#16a34a" />
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>{priv}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Personal & Contact Details (if available) */}
            {(profile.gender || profile.blood_group || profile.date_of_birth || profile.address) && (
              <div className={styles.cardSection}>
                <div className={styles.sectionTitle}>
                  <User size={20} color="#0381ff" />
                  Personal Information
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13.5px" }}>
                  {profile.gender && (
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                      <span style={{ color: "#64748b" }}>Gender:</span>
                      <strong style={{ color: "#0b1d3a" }}>{profile.gender}</strong>
                    </div>
                  )}
                  {profile.date_of_birth && (
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                      <span style={{ color: "#64748b" }}>Date of Birth:</span>
                      <strong style={{ color: "#0b1d3a" }}>{formatDate(profile.date_of_birth)}</strong>
                    </div>
                  )}
                  {profile.blood_group && (
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                      <span style={{ color: "#64748b" }}>Blood Group:</span>
                      <strong style={{ color: "#0b1d3a" }}>{profile.blood_group}</strong>
                    </div>
                  )}
                  {profile.address && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Address:</span>
                      <strong style={{ color: "#0b1d3a", textAlign: "right", maxWidth: "200px" }}>
                        {profile.address}{profile.city ? `, ${profile.city}` : ""}{profile.pincode ? ` - ${profile.pincode}` : ""}
                      </strong>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
