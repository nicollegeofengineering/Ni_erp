"use client";

import { useState } from "react";
import styles from "../css/staffview.module.css";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Pencil, Download, User, Phone, Briefcase,
  GraduationCap, ShieldCheck, Landmark, AlertCircle, Copy, Check
} from "lucide-react";

function getInitials(first, last) {
  return `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase();
}

export default function ViewStaff() {
  const router = useRouter();
  const [imgError, setImgError] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  // Mock data
  const staffDetails = {
    staff_id: "EMP-2024-045",
    prefix: "Dr.",
    first_name: "Sarah",
    last_name: "Mitchell",
    gender: "Female",
    date_of_birth: "1988-06-15",
    phone_number: "+1 (555) 123-4567",
    email: "s.mitchell@university.edu",
    personal_email: "sarah.m.88@gmail.com",
    address: "1245 Innovation Drive, Tech Park Apartments, Apt 4B",
    city: "San Francisco",
    state: "California",
    pincode: "94105",
    emergency_contact_name: "James Mitchell (Husband)",
    emergency_contact_number: "+1 (555) 987-6543",
    department_id: "Computer Science (CS-01)",
    designation_id: "Associate Professor",
    role_type: "Teaching",
    employment_type: "Full Time",
    joining_date: "2018-08-01",
    experience_years: "8 Years",
    staff_status: "Active",
    highest_qualification: "Ph.D. in Artificial Intelligence",
    specialization: "Machine Learning & Neural Networks",
    university: "Stanford University",
    passing_year: "2016",
    aadhar_number: "XXXX-XXXX-8921",
    pan_number: "ABCDE1234F",
    bank_name: "Chase Bank",
    account_number: "XXXXXXXX4589",
    ifsc_code: "CHAS0001234",
    branch_name: "Downtown SF Branch",
    salary: "$120,000 / Year",
    blood_group: "O+",
    marital_status: "Married",
    profile_image: "/user.png"
  };

  const handleCopy = async (value, fieldKey) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(fieldKey);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      // clipboard unavailable — fail silently, nothing visible to copy
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
          <button className={styles.backBtn} type="button" onClick={() => router.push("/admin/staff")}>
            <ArrowLeft size={16} /> Back
          </button>
          <button className={styles.editBtn} onClick={() => router.push(`/admin/staff/edit/${staffDetails.staff_id}`)}>
            <Pencil size={16} /> Edit Profile
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
              {!imgError ? (
                <img
                  src={staffDetails.profile_image}
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
            <DataField label="Department ID" value={staffDetails.department_id} />
            <DataField label="Designation ID" value={staffDetails.designation_id} />
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
            <DataField label="University/Institute" value={staffDetails.university} />
            <DataField label="Passing Year" value={staffDetails.passing_year} />
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