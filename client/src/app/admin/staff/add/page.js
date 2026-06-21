"use client";

import { useState } from "react";
import styles from "../css/staffadd.module.css";
import { useRouter } from "next/navigation";

export default function AddStaff() {
  const router = useRouter();
  const [preview, setPreview] = useState("/user.png");

  const [formData, setFormData] = useState({
    staff_id: "",
    prefix: "",
    first_name: "",
    last_name: "",
    gender: "",
    date_of_birth: "",
    phone_number: "",
    email: "",
    personal_email: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    emergency_contact_name: "",
    emergency_contact_number: "",
    department_id: "",
    designation_id: "",
    role_type: "",
    employment_type: "",
    joining_date: "",
    experience_years: "",
    staff_status: "Active",
    highest_qualification: "",
    specialization: "",
    university: "",
    passing_year: "",
    aadhar_number: "",
    pan_number: "",
    bank_name: "",
    account_number: "",
    ifsc_code: "",
    branch_name: "",
    salary: "",
    blood_group: "",
    marital_status: ""
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log(formData);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <p>Staff Directory &gt; Add New Staff</p>
          <h1>Staff Onboarding Profile</h1>
        </div>

        <div className={styles.actions}>
          <button className={styles.actionBtn} type="button" onClick={() => router.push("/admin/staff")}>
            Cancel
          </button>
          <button className={styles.actionBtn} onClick={handleSubmit}>
            Save Staff Profile
          </button>
        </div>
      </div>

      <form id="staffForm" onSubmit={handleSubmit}>
        {/* PERSONAL */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>1. Personal Information</h2>
          <div className={styles.personalGrid}>
            <div className={styles.imageBox}>
              <img src={preview} alt="profile preview" className={styles.profileImage} />
              <p className={styles.imageUploadLabel}>Upload Profile Photo</p>
              <input
                className={styles.formInput}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
              />
            </div>

            <div className={styles.grid}>
              <input className={styles.formInput} name="prefix" placeholder="Prefix" onChange={handleChange} />
              <input className={styles.formInput} name="first_name" placeholder="First Name" onChange={handleChange} />
              <input className={styles.formInput} name="last_name" placeholder="Last Name" onChange={handleChange} />
              <input className={styles.formInput} type="date" name="date_of_birth" onChange={handleChange} />
              <select className={styles.formInput} name="gender" onChange={handleChange}>
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
              <select className={styles.formInput} name="blood_group" onChange={handleChange}>
                <option value="">Blood Group</option>
                <option value="A+">A+</option>
                <option value="B+">B+</option>
                <option value="O+">O+</option>
                <option value="AB+">AB+</option>
                <option value="A-">A-</option>
                <option value="B-">B-</option>
                <option value="O-">O-</option>
                <option value="AB-">AB-</option>
              </select>
            </div>
          </div>
        </section>

        {/* CONTACT */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>2. Contact Information</h2>
          <div className={styles.grid}>
            <input className={styles.formInput} name="phone_number" placeholder="Phone Number" onChange={handleChange} />
            <input className={styles.formInput} name="email" placeholder="Official Email" onChange={handleChange} />
            <input className={styles.formInput} name="personal_email" placeholder="Personal Email" onChange={handleChange} />
            <input className={styles.formInput} name="city" placeholder="City" onChange={handleChange} />
            <input className={styles.formInput} name="state" placeholder="State" onChange={handleChange} />
            <input className={styles.formInput} name="pincode" placeholder="Pincode" onChange={handleChange} />
            <textarea className={styles.formTextarea} name="address" placeholder="Full Residential Address" onChange={handleChange} />
          </div>
        </section>

        {/* PROFESSIONAL */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>3. Professional Details</h2>
          <div className={styles.grid}>
            <input className={styles.formInput} name="staff_id" placeholder="Staff ID" onChange={handleChange} />
            <input className={styles.formInput} name="department_id" placeholder="Department ID" onChange={handleChange} />
            <input className={styles.formInput} name="designation_id" placeholder="Designation ID" onChange={handleChange} />
            <select className={styles.formInput} name="role_type" onChange={handleChange}>
              <option value="">Role Type</option>
              <option value="Teaching">Teaching</option>
              <option value="Non-Teaching">Non-Teaching</option>
              <option value="Administrative">Administrative</option>
              <option value="Management">Management</option>
            </select>
            <select className={styles.formInput} name="employment_type" onChange={handleChange}>
              <option value="">Employment Type</option>
              <option value="Full Time">Full Time</option>
              <option value="Part Time">Part Time</option>
              <option value="Contract">Contract</option>
            </select>
            <input className={styles.formInput} type="date" name="joining_date" onChange={handleChange} />
            <input className={styles.formInput} name="experience_years" placeholder="Years of Experience" onChange={handleChange} />
          </div>
        </section>

        {/* EDUCATION */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>4. Education Details</h2>
          <div className={styles.grid}>
            <input className={styles.formInput} name="highest_qualification" placeholder="Highest Qualification" onChange={handleChange} />
            <input className={styles.formInput} name="specialization" placeholder="Specialization" onChange={handleChange} />
            <input className={styles.formInput} name="university" placeholder="University/Institute" onChange={handleChange} />
            <input className={styles.formInput} name="passing_year" placeholder="Passing Year" onChange={handleChange} />
          </div>
        </section>

        {/* STATUTORY */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>5. Statutory Details</h2>
          <div className={styles.grid}>
            <input className={styles.formInput} name="aadhar_number" placeholder="Aadhar Number" onChange={handleChange} />
            <input className={styles.formInput} name="pan_number" placeholder="PAN Number" onChange={handleChange} />
          </div>
        </section>

        {/* BANK */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>6. Bank Details</h2>
          <div className={styles.grid}>
            <input className={styles.formInput} name="bank_name" placeholder="Bank Name" onChange={handleChange} />
            <input className={styles.formInput} name="account_number" placeholder="Account Number" onChange={handleChange} />
            <input className={styles.formInput} name="ifsc_code" placeholder="IFSC Code" onChange={handleChange} />
            <input className={styles.formInput} name="branch_name" placeholder="Branch Name" onChange={handleChange} />
            <input className={styles.formInput} name="salary" placeholder="Salary/CTC" onChange={handleChange} />
          </div>
        </section>

        {/* EMERGENCY */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>7. Emergency Contact</h2>
          <div className={styles.grid}>
            <input className={styles.formInput} name="emergency_contact_name" placeholder="Emergency Contact Name" onChange={handleChange} />
            <input className={styles.formInput} name="emergency_contact_number" placeholder="Emergency Contact Number" onChange={handleChange} />
          </div>
        </section>
      </form>
    </div>
  );
}