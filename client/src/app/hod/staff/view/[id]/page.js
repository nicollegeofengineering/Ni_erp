// app/admin/staff/view/[id]/page.js
"use client";

import { useState, useEffect } from "react";
import styles from "../../css/staffview.module.css";
import { useRouter, useParams } from "next/navigation";
import axios from "axios";
import {
  ArrowLeft, Pencil, Download, User, Phone, Briefcase,
  GraduationCap, ShieldCheck, Landmark, AlertCircle, Copy, Check
} from "lucide-react";

function getInitials(first, last) {
  return `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase();
}

export default function ViewStaff() {
  const router = useRouter();
  const params = useParams();
  const staffId = params?.id;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [staffDetails, setStaffDetails] = useState(null);
  const [imgError, setImgError] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  const handleUnauthorized = (error) => {
    if (error.response?.data?.islogout === true) {
      // Redirect to login; the cookie will be cleared by the backend logout endpoint
      router.push("/");
      return true;
    }
    return false;
  };

  // Fetch staff details on component mount
  useEffect(() => {
    const fetchStaffDetails = async () => {
      if (!staffId) {
        setError('Staff ID is required');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/admin/staff/${staffId}`,
          { withCredentials: true }
        );

        if (response.data.success) {
          setStaffDetails(response.data.data);
        } else {
          setError(response.data.message || 'Failed to fetch staff details');
        }
      } catch (err) {
      if (handleUnauthorized(err)) return;
        console.error('Error fetching staff details:', err);
        setError(
          err.response?.data?.message || 
          err.message || 
          'An unexpected error occurred'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchStaffDetails();
  }, [staffId]);

  const handleCopy = async (value, fieldKey) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      // clipboard unavailable — fail silently
    }
  };

  const DataField = ({ label, value, fullWidth = false, copyable = false, fieldKey }) => (
    <div className={`${styles.dataGroup} ${fullWidth ? styles.fullWidth : ""}`}>
      <span className={styles.dataLabel}>{label}</span>
      <div className={styles.dataValueBox}>
        <span className={styles.dataValueText}>{value || "—"}</span>
        {copyable && value && (
          <button
            type="button"
            className={styles.copyBtn}
            onClick={() => handleCopy(value, fieldKey)}
            aria-label={`Copy ${label}`}
          >
            {copiedField === fieldKey ? <Check size={14} /> : <Copy size={14} />}
          </button>
        )}
      </div>
    </div>
  );

  const SectionHeader = ({ index, icon, title }) => (
    <div className={styles.cardTitleBar}>
      <span className={styles.sectionBadge}>{index}</span>
      {icon}
      <h2 className={styles.cardTitle}>{title}</h2>
    </div>
  );

  const handlePrint = () => window.print();

  // Loading state
  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading staff profile...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !staffDetails) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <AlertCircle size={48} className={styles.errorIcon} />
          <h2>Unable to load staff profile</h2>
          <p>{error || 'Staff member not found'}</p>
          <button 
            className={styles.backBtn} 
            type="button" 
            onClick={() => router.push("/hod/staff")}
          >
            <ArrowLeft size={16} /> Back to Staff List
          </button>
        </div>
      </div>
    );
  }

  const isActive = staffDetails.staff_status === "Active";

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <p className={styles.headerSubtitle}>Staff Directory &gt; View Staff Profile</p>
          <h1 className={styles.headerTitle}>
            Staff Profile Details
            <span className={`${styles.statusBadge} ${isActive ? styles.statusActive : styles.statusInactive}`}>
              {staffDetails.staff_status}
            </span>
          </h1>
        </div>

        <div className={styles.actions}>
          <button className={styles.backBtn} type="button" onClick={() => router.push("/hod/staff")}>
            <ArrowLeft size={16} /> Back
          </button>
         
          <button className={styles.pdfBtn} onClick={handlePrint}>
            <Download size={16} /> Save as PDF
          </button>
        </div>
      </div>

      <div className={styles.printContent}>
        {/* PERSONAL */}
        <section className={styles.card}>
          <SectionHeader index="01" icon={<User size={16} className={styles.cardTitleIcon} />} title="Personal Information" />
          <div className={styles.personalGrid}>
            <div className={styles.imageBox}>
              {!imgError && staffDetails.profile_image ? (
                <img
                  src={`${process.env.NEXT_PUBLIC_BACKEND_URL}${staffDetails.profile_image}`}
                  alt={`${staffDetails.first_name} ${staffDetails.last_name}`}
                  className={`${styles.profileImage} ${isActive ? styles.ringActive : styles.ringInactive}`}
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className={`${styles.profileImageFallback} ${isActive ? styles.ringActive : styles.ringInactive}`}>
                  {getInitials(staffDetails.first_name, staffDetails.last_name)}
                </div>
              )}
              <div>
                <h3 className={styles.staffName}>
                  {staffDetails.prefix} {staffDetails.first_name} {staffDetails.last_name}
                </h3>
                <p className={styles.staffRole}>{staffDetails.designation_id}</p>
              </div>
            </div>

            <div className={styles.grid}>
              <DataField label="Prefix" value={staffDetails.prefix} />
              <DataField label="First Name" value={staffDetails.first_name} />
              <DataField label="Last Name" value={staffDetails.last_name} />
              <DataField label="Date of Birth" value={staffDetails.date_of_birth} />
              <DataField label="Gender" value={staffDetails.gender} />
              <DataField label="Blood Group" value={staffDetails.blood_group} />
              <DataField label="Marital Status" value={staffDetails.marital_status} />
            </div>
          </div>
        </section>

        {/* CONTACT */}
        <section className={styles.card}>
          <SectionHeader index="02" icon={<Phone size={16} className={styles.cardTitleIcon} />} title="Contact Information" />
          <div className={styles.grid}>
            <DataField label="Phone Number" value={staffDetails.phone_number} copyable fieldKey="phone" />
            <DataField label="Official Email" value={staffDetails.email} copyable fieldKey="officialEmail" />
            <DataField label="Personal Email" value={staffDetails.personal_email} copyable fieldKey="personalEmail" />
            <DataField label="City" value={staffDetails.city} />
            <DataField label="State" value={staffDetails.state} />
            <DataField label="Pincode" value={staffDetails.pincode} />
            <DataField label="Full Residential Address" value={staffDetails.address} fullWidth />
          </div>
        </section>

        {/* PROFESSIONAL */}
        <section className={styles.card}>
          <SectionHeader index="03" icon={<Briefcase size={16} className={styles.cardTitleIcon} />} title="Professional Details" />
          <div className={styles.grid}>
            <DataField label="Staff ID" value={staffDetails.staff_id} copyable fieldKey="staffId" />
            <DataField label="Staff Code" value={staffDetails.staff_code}/>
            <DataField label="Department" value={staffDetails.department_id} />
            <DataField label="Designation" value={staffDetails.designation_id} />
            <DataField label="Role Type" value={staffDetails.role_type} />
            <DataField label="Employment Type" value={staffDetails.employment_type} />
            <DataField label="Joining Date" value={staffDetails.joining_date} />
            <DataField label="Years of Experience" value={staffDetails.experience_years} />
          </div>
        </section>

        {/* EDUCATION */}
        <section className={styles.card}>
          <SectionHeader index="04" icon={<GraduationCap size={16} className={styles.cardTitleIcon} />} title="Education Details" />
          <div className={styles.grid}>
            <DataField label="Highest Qualification" value={staffDetails.highest_qualification} />
            <DataField label="Specialization" value={staffDetails.specialization} />
            <DataField label="University/Institute" value={staffDetails.university || "—"} />
            <DataField label="Passing Year" value={staffDetails.passing_year || "—"} />
          </div>
        </section>

        {/* STATUTORY */}
        <section className={styles.card}>
          <SectionHeader index="05" icon={<ShieldCheck size={16} className={styles.cardTitleIcon} />} title="Statutory Details" />
          <div className={styles.grid}>
            <DataField label="Aadhar Number" value={staffDetails.aadhar_number} copyable fieldKey="aadhar" />
            <DataField label="PAN Number" value={staffDetails.pan_number} copyable fieldKey="pan" />
          </div>
        </section>

        {/* BANK */}
        <section className={styles.card}>
          <SectionHeader index="06" icon={<Landmark size={16} className={styles.cardTitleIcon} />} title="Bank Details" />
          <div className={styles.grid}>
            <DataField label="Bank Name" value={staffDetails.bank_name} />
            <DataField label="Account Number" value={staffDetails.account_number} copyable fieldKey="account" />
            <DataField label="IFSC Code" value={staffDetails.ifsc_code} copyable fieldKey="ifsc" />
            <DataField label="Branch Name" value={staffDetails.branch_name} />
            <DataField label="Salary/CTC" value={staffDetails.salary} />
          </div>
        </section>

        {/* EMERGENCY */}
        <section className={styles.card}>
          <SectionHeader index="07" icon={<AlertCircle size={16} className={styles.cardTitleIcon} />} title="Emergency Contact" />
          <div className={styles.grid}>
            <DataField label="Emergency Contact Name" value={staffDetails.emergency_contact_name} />
            <DataField label="Emergency Contact Number" value={staffDetails.emergency_contact_number} copyable fieldKey="emergencyPhone" />
          </div>
        </section>
      </div>
    </div>
  );
}