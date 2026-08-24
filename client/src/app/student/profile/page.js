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
  Layers,
  RotateCw,
  BookOpen,
  FileText,
  ShieldCheck,
  HeartHandshake,
  ArrowLeft,
} from "lucide-react";
import styles from "../css/student.module.css";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const api = axios.create({ baseURL: BASE_URL, withCredentials: true });

export default function StudentProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState(null);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/student/profile");
      if (res.data.success) {
        setStudent(res.data.data);
      }
    } catch (err) {
      if (err.response?.data?.islogout === true || err.response?.status === 401) {
        router.push("/");
        return;
      }
      console.error("Failed to fetch student profile:", err);
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

  const photoSrc = student?.profile_image
    ? student.profile_image.startsWith("http")
      ? student.profile_image
      : student.profile_image === "/user.png"
        ? "/user.png"
        : `${BASE_URL}${student.profile_image.startsWith("/") ? "" : "/"}${student.profile_image}`
    : "/user.png";

  const q = student?.qualification || {};

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <div>
          <h1 className={styles.title}>Student Profile Record</h1>
          <p className={styles.subtitle}>
            Complete personal, academic, parent, and qualification details from database
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            className={styles.tabBtn}
            onClick={() => router.push("/student")}
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
          Loading complete profile records...
        </p>
      ) : !student ? (
        <div style={{ textAlign: "center", color: "#64748b", padding: "40px 0" }}>
          <User size={40} color="#cbd5e1" style={{ margin: "0 auto 10px" }} />
          <p>Unable to load student profile record.</p>
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
                alt={student.name || "Student"}
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
                {student.name || `${student.first_name || ""} ${student.last_name || ""}`.trim()}
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
                  Reg No: {student.register_no || "N/A"}
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
                  Roll No: {student.roll_no || "N/A"}
                </span>
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
                  Student ID: {student.student_id || "N/A"}
                </span>
                <span
                  className={`${styles.badge} ${styles.badgeSuccess}`}
                  style={{ fontSize: "12.5px", padding: "4px 12px" }}
                >
                  {student.student_status || "Active"}
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
            {/* 1. Academic & Enrollment Details */}
            <div className={styles.cardSection}>
              <div className={styles.sectionTitle}>
                <GraduationCap size={20} color="#0381ff" />
                Academic &amp; Enrollment Details
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13.5px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Department:</span>
                  <strong style={{ color: "#0b1d3a" }}>{student.department_code || "—"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Current Year &amp; Semester:</span>
                  <strong style={{ color: "#0b1d3a" }}>Year {student.year || "—"} • Semester {student.semester || "—"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Section:</span>
                  <strong style={{ color: "#0b1d3a" }}>Section {student.section || "A"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Regulation:</span>
                  <strong style={{ color: "#0b1d3a" }}>{student.regulation || "2021"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Academic Year:</span>
                  <strong style={{ color: "#0b1d3a" }}>{student.academic_year || "2025-2026"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Programme / Degree:</span>
                  <strong style={{ color: "#0b1d3a" }}>{student.programme || "B.E."}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Batch:</span>
                  <strong style={{ color: "#0b1d3a" }}>{student.batch || "—"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Medium of Instruction:</span>
                  <strong style={{ color: "#0b1d3a" }}>{student.medium || "English"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Admission Type:</span>
                  <strong style={{ color: "#0b1d3a" }}>{student.admission_type || "Regular"}</strong>
                </div>
                {student.admission_date && (
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                    <span style={{ color: "#64748b" }}>Admission Date:</span>
                    <strong style={{ color: "#0b1d3a" }}>{formatDate(student.admission_date)}</strong>
                  </div>
                )}
                {student.admission_no && (
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                    <span style={{ color: "#64748b" }}>Admission No:</span>
                    <strong style={{ color: "#0b1d3a" }}>{student.admission_no}</strong>
                  </div>
                )}
                {student.application_no && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>Application No:</span>
                    <strong style={{ color: "#0b1d3a" }}>{student.application_no}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Personal Information */}
            <div className={styles.cardSection}>
              <div className={styles.sectionTitle}>
                <User size={20} color="#0381ff" />
                Personal Information
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13.5px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Gender:</span>
                  <strong style={{ color: "#0b1d3a" }}>{student.gender || "—"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Date of Birth:</span>
                  <strong style={{ color: "#0b1d3a" }}>{formatDate(student.date_of_birth)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Blood Group:</span>
                  <strong style={{ color: "#0b1d3a" }}>{student.blood_group || "—"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Email:</span>
                  <strong style={{ color: "#0b1d3a" }}>{student.email || "—"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Mobile Number:</span>
                  <strong style={{ color: "#0b1d3a" }}>{student.mobile_number || student.student_phone || student.phone || "—"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Nationality:</span>
                  <strong style={{ color: "#0b1d3a" }}>{student.nationality || "Indian"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Mother Tongue:</span>
                  <strong style={{ color: "#0b1d3a" }}>{student.mother_tongue || "—"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Religion &amp; Community:</span>
                  <strong style={{ color: "#0b1d3a" }}>{student.religion || "—"} {student.community ? `(${student.community})` : ""}</strong>
                </div>
                {student.caste && (
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                    <span style={{ color: "#64748b" }}>Caste:</span>
                    <strong style={{ color: "#0b1d3a" }}>{student.caste}</strong>
                  </div>
                )}
                {student.aadhar_number && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>Aadhar Number:</span>
                    <strong style={{ color: "#0b1d3a" }}>{student.aadhar_number}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Parent / Guardian Details */}
            <div className={styles.cardSection}>
              <div className={styles.sectionTitle}>
                <Users size={20} color="#0381ff" />
                Parent &amp; Guardian Information
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13.5px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Father&apos;s Name:</span>
                  <strong style={{ color: "#0b1d3a" }}>{student.father_name || "—"}</strong>
                </div>
                {student.father_occupation && (
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                    <span style={{ color: "#64748b" }}>Father&apos;s Occupation:</span>
                    <strong style={{ color: "#0b1d3a" }}>{student.father_occupation}</strong>
                  </div>
                )}
                {student.father_mobile && (
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                    <span style={{ color: "#64748b" }}>Father&apos;s Mobile:</span>
                    <strong style={{ color: "#0b1d3a" }}>{student.father_mobile}</strong>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Mother&apos;s Name:</span>
                  <strong style={{ color: "#0b1d3a" }}>{student.mother_name || "—"}</strong>
                </div>
                {student.mother_occupation && (
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                    <span style={{ color: "#64748b" }}>Mother&apos;s Occupation:</span>
                    <strong style={{ color: "#0b1d3a" }}>{student.mother_occupation}</strong>
                  </div>
                )}
                {student.mother_mobile && (
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                    <span style={{ color: "#64748b" }}>Mother&apos;s Mobile:</span>
                    <strong style={{ color: "#0b1d3a" }}>{student.mother_mobile}</strong>
                  </div>
                )}
                {student.annual_family_income && (
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                    <span style={{ color: "#64748b" }}>Annual Family Income:</span>
                    <strong style={{ color: "#0b1d3a" }}>₹{student.annual_family_income.toLocaleString("en-IN")}</strong>
                  </div>
                )}
                {student.guardian_name && (
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                    <span style={{ color: "#64748b" }}>Guardian:</span>
                    <strong style={{ color: "#0b1d3a" }}>{student.guardian_name} ({student.guardian_relationship || "Guardian"})</strong>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#64748b" }}>First Graduate:</span>
                  <strong style={{ color: student.first_graduate ? "#15803d" : "#64748b" }}>
                    {student.first_graduate ? "Yes (Eligible)" : "No"}
                  </strong>
                </div>
              </div>
            </div>

            {/* 4. Address & Location */}
            <div className={styles.cardSection}>
              <div className={styles.sectionTitle}>
                <MapPin size={20} color="#0381ff" />
                Address &amp; Location
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13.5px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Address:</span>
                  <strong style={{ color: "#0b1d3a", textAlign: "right", maxWidth: "200px" }}>
                    {student.address || "—"}
                  </strong>
                </div>
                {student.panchayat_name && (
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                    <span style={{ color: "#64748b" }}>Panchayat / Town:</span>
                    <strong style={{ color: "#0b1d3a" }}>{student.panchayat_name}</strong>
                  </div>
                )}
                {student.taluk && (
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                    <span style={{ color: "#64748b" }}>Taluk:</span>
                    <strong style={{ color: "#0b1d3a" }}>{student.taluk}</strong>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>District &amp; State:</span>
                  <strong style={{ color: "#0b1d3a" }}>{student.district || "—"}, {student.state || "Tamil Nadu"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                  <span style={{ color: "#64748b" }}>Pincode:</span>
                  <strong style={{ color: "#0b1d3a" }}>{student.pincode || "—"}</strong>
                </div>
                {student.location_type && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>Location Type:</span>
                    <strong style={{ color: "#0b1d3a" }}>{student.location_type}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* 5. Previous Academic Qualification */}
            {q && (q.institution || q.qualifying_exam || q.total_marks || q.percentage) && (
              <div className={styles.cardSection}>
                <div className={styles.sectionTitle}>
                  <Award size={20} color="#0381ff" />
                  Previous Qualification Details
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13.5px" }}>
                  {q.qualifying_exam && (
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                      <span style={{ color: "#64748b" }}>Exam / Board:</span>
                      <strong style={{ color: "#0b1d3a" }}>{q.qualifying_exam}</strong>
                    </div>
                  )}
                  {q.institution && (
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                      <span style={{ color: "#64748b" }}>School / Institution:</span>
                      <strong style={{ color: "#0b1d3a", textAlign: "right", maxWidth: "200px" }}>{q.institution}</strong>
                    </div>
                  )}
                  {q.passing_year && (
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                      <span style={{ color: "#64748b" }}>Passing Year:</span>
                      <strong style={{ color: "#0b1d3a" }}>{q.passing_year}</strong>
                    </div>
                  )}
                  {q.register_number && (
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                      <span style={{ color: "#64748b" }}>Previous Reg No:</span>
                      <strong style={{ color: "#0b1d3a" }}>{q.register_number}</strong>
                    </div>
                  )}
                  {q.total_marks && (
                    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                      <span style={{ color: "#64748b" }}>Total Marks / Cutoff:</span>
                      <strong style={{ color: "#0b1d3a" }}>{q.total_marks} {q.aggregate ? `(Cutoff: ${q.aggregate})` : ""}</strong>
                    </div>
                  )}
                  {q.percentage && (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Percentage:</span>
                      <strong style={{ color: "#15803d" }}>{q.percentage}%</strong>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 6. Quota & Special Category */}
            {(student.special_quota || student.differently_abled || student.seven_point_five) && (
              <div className={styles.cardSection}>
                <div className={styles.sectionTitle}>
                  <ShieldCheck size={20} color="#0381ff" />
                  Quota &amp; Special Categories
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13.5px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                    <span style={{ color: "#64748b" }}>7.5% Govt School Quota:</span>
                    <strong style={{ color: student.seven_point_five ? "#15803d" : "#64748b" }}>
                      {student.seven_point_five ? "Yes (7.5% Quota)" : "No"}
                    </strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                    <span style={{ color: "#64748b" }}>Special Quota:</span>
                    <strong style={{ color: student.special_quota ? "#15803d" : "#64748b" }}>
                      {student.special_quota ? `Yes (${student.quota_category || "Special"})` : "No"}
                    </strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>Differently Abled:</span>
                    <strong style={{ color: student.differently_abled ? "#b45309" : "#64748b" }}>
                      {student.differently_abled ? `Yes (${student.disability_category || "Yes"})` : "No"}
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
