"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import axios from "axios";
import styles from "../../css/studentview.module.css";

export default function ViewStudent() {
  const router = useRouter();
  const params = useParams();
  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState(null);
  const [photoUrl, setPhotoUrl] = useState("/user.png");

  const handleUnauthorized = (error) => {
    if (error.response?.data?.islogout === true) {
      router.push("/");
      return true;
    }
    return false;
  };

  useEffect(() => {
    const fetchStudent = async () => {
      try {
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/admin/student/${id}`,
          { withCredentials: true }
        );
        if (response.data.success) {
          setStudent(response.data.data);
          if (response.data.data.profile_image) {
            setPhotoUrl(
              `${process.env.NEXT_PUBLIC_BACKEND_URL}${response.data.data.profile_image}`
            );
          }
        }
      } catch (error) {
        if (handleUnauthorized(error)) return;
        console.error("Error fetching student:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStudent();
  }, [id]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div style={{ textAlign: "center", padding: "40px", color: "#5b6478" }}>
          Loading student details...
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className={styles.container}>
        <div style={{ textAlign: "center", padding: "40px", color: "#c52a2a" }}>
          Student not found.
        </div>
      </div>
    );
  }

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const renderField = (label, value, emptyText = "-") => {
    return (
      <div className={styles.fieldWrapper}>
        <span className={styles.fieldLabel}>{label}</span>
        <span className={styles.fieldValue}>{value || emptyText}</span>
      </div>
    );
  };

  const renderBoolean = (label, value) => {
    return (
      <div className={styles.fieldWrapper}>
        <span className={styles.fieldLabel}>{label}</span>
        <span className={styles.fieldValue}>{value ? "Yes" : "No"}</span>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <p>Student Directory &gt; View Student</p>
          <h1>Student Profile</h1>
        </div>
        <div className={styles.actions}>
          <button
            className={styles.actionBtn}
            type="button"
            onClick={() => router.push("/admin/students")}
          >
            Back to List
          </button>
          <button
            className={styles.actionBtn}
            type="button"
            onClick={() => router.push(`/admin/students/edit/${id}`)}
          >
            Edit Student
          </button>
        </div>
      </div>

      {/* Student Identification */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Student Identification</h2>
        <div className={styles.personalGrid}>
          <div className={styles.imageBox}>
            <img src={photoUrl} alt="student" className={styles.profileImage} />
          </div>
          <div className={styles.grid}>
            {renderField("Application No.", student.application_no)}
            {renderField("Admission No.", student.admission_no)}
            {renderField("Register No.", student.register_no)}
            {renderField("Roll No.", student.roll_no)}
          </div>
        </div>
      </section>

      {/* Admission & Academic Information */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Admission &amp; Academic Information</h2>
        <div className={styles.grid}>
          {renderField("Academic Year", student.academic_year)}
          {renderField("Admission Date", formatDate(student.admission_date))}
          {renderField("Admission Type", student.admission_type)}
          {renderField("Admission Mode", student.admission_mode)}
          {renderField("Programme", student.programme)}
          {renderField("Department", student.department_code)}
          {renderField("Batch", student.batch)}
          {renderField("Regulation", student.regulation)}
          {renderField("Medium", student.medium)}
          {renderField("Year", student.year)}
          {renderField("Semester", student.semester)}
          {renderField("Section", student.section)}
        </div>
      </section>

      {/* Personal Information */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Personal Information</h2>
        <div className={styles.grid}>
          {renderField("First Name", student.first_name)}
          {renderField("Last Name", student.last_name)}
          {renderField("Date of Birth", formatDate(student.date_of_birth))}
          {renderField("Gender", student.gender)}
          {renderField("Blood Group", student.blood_group)}
          {renderField("Nationality", student.nationality)}
          {renderField("Mother Tongue", student.mother_tongue)}
          {renderField("Religion", student.religion)}
          {renderField("Community", student.community)}
          {renderField("Caste", student.caste)}
          {renderField("Aadhar No.", student.aadhar_number)}
        </div>
      </section>

      {/* Contact & Address */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Contact &amp; Address</h2>
        <div className={styles.grid}>
          {renderField("Mobile Number", student.mobile_number)}
          {renderField("Email", student.email)}
          <div className={`${styles.fieldWrapper} ${styles.fullWidth}`}>
            <span className={styles.fieldLabel}>Address</span>
            <span className={styles.fieldValue}>{student.address || "-"}</span>
          </div>
          {renderField("Panchayat Name", student.panchayat_name)}
          {renderField("Location Type", student.location_type)}
          {renderField("Taluk", student.taluk)}
          {renderField("District", student.district)}
          {renderField("State", student.state)}
          {renderField("Pincode", student.pincode)}
        </div>
      </section>

      {/* Parent / Guardian */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Parent / Guardian</h2>
        <div className={styles.grid}>
          {renderField("Father Name", student.father_name)}
          {renderField("Father Mobile", student.father_mobile)}
          {renderField("Father Occupation", student.father_occupation)}
          {renderField("Mother Name", student.mother_name)}
          {renderField("Mother Mobile", student.mother_mobile)}
          {renderField("Mother Occupation", student.mother_occupation)}
          {renderField("Annual Family Income", student.annual_family_income)}
          {renderBoolean("First Graduate", student.first_graduate)}
          {renderBoolean("7.5%", student.seven_point_five)}
          {renderField("Guardian Name", student.guardian_name)}
          {renderField("Guardian Relationship", student.guardian_relationship)}
          {renderField("Guardian Mobile", student.guardian_mobile)}
          {renderField("Guardian Occupation", student.guardian_occupation)}
        </div>
      </section>

      {/* Qualification */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          {student.admission_type === "Regular"
            ? "Regular Admission Details"
            : "Lateral Entry Details"}
        </h2>
        <div className={styles.grid}>
          {student.admission_type === "Regular" ? (
            <>
              {renderField("EMIS Number", student.qualification?.emis_number)}
              {renderField("Institution", student.qualification?.institution)}
              {renderField("Qualifying Exam", student.qualification?.qualifying_exam)}
              {renderField("Passing Year", student.qualification?.passing_year)}
              {renderField("Register Number", student.qualification?.register_number)}
              {renderField("Total Marks", student.qualification?.total_marks)}
              {renderField("Mathematics Marks", student.qualification?.mathematics_marks)}
              {renderField("Physics Marks", student.qualification?.physics_marks)}
              {renderField("Chemistry Marks", student.qualification?.chemistry_marks)}
              {renderField("Cutoff", student.qualification?.aggregate)}
            </>
          ) : (
            <>
              {renderField("UMIS Number", student.qualification?.umis_number)}
              {renderField("Institution", student.qualification?.institution)}
              {renderField("Qualifying Exam", student.qualification?.qualifying_exam)}
              {renderField("Passing Year", student.qualification?.passing_year)}
              {renderField("Register Number", student.qualification?.register_number)}
              {renderField("Diploma Branch", student.qualification?.diploma_branch)}
              {renderField("Total Marks", student.qualification?.total_marks)}
              {renderField("Percentage", student.qualification?.percentage)}
            </>
          )}
        </div>
      </section>

      {/* Category & Special Information */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Category &amp; Special Information</h2>
        <div className={styles.grid}>
          {renderBoolean("Special Quota", student.special_quota)}
          {renderField("Quota Category", student.quota_category)}
          {renderBoolean("Differently Abled", student.differently_abled)}
          {renderField("Disability Category", student.disability_category)}
        </div>
      </section>

      {/* Student Status */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Student Status</h2>
        <div className={styles.grid}>
          {renderField("Admission Status", student.admission_status)}
          {renderField("Student Status", student.student_status)}
        </div>
      </section>
    </div>
  );
}