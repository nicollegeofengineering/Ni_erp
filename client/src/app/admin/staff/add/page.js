"use client";

import { useEffect, useState } from "react";
import styles from "../css/staffadd.module.css";
import { useRouter } from "next/navigation";
import axios from "axios";

export default function AddStaff() {
  const router = useRouter();
  const [preview, setPreview] = useState("/user.png");
  const [imageFile, setImageFile] = useState(null);

  // ✅ FIXED: Empty initial state instead of placeholder text
  const [Emessage, setEmessage] = useState("");
  const [Smessage, setSmessage] = useState("");

  const [formData, setFormData] = useState({
    staff_id: "",
    prefix: "",
    photo_url: "",
    first_name: "",
    last_name: "",
    gender: "",
    date_of_birth: "",
    phone_number: "",
    email: "",
    personal_email:"",
    address: "",
    city: "",
    state: "",
    pincode: "",
    emergency_contact_name: "",
    emergency_contact_number: "",
    department_code: "",
    designation: "",
    role_type: "",
    employment_type: "",
    joining_date: "",
    experience_years: "",
    aadhar_number: "",
    pan_number: "",
    bank_name: "",
    account_number: "",
    ifsc_code: "",
    branch_name: "",
    highest_qualification: "",
    specialization: "",
    university:"",
    passing_year:"",
    salary: "",
    blood_group: "",
    marital_status: "",
    staff_status: "Active"
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

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];

    if (!allowedTypes.includes(file.type)) {
      alert("Only JPG, JPEG and PNG files are allowed");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("Image size must be less than 2MB");
      return;
    }

    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = new FormData();

      if (imageFile) {
        submitData.append("photo", imageFile);
      }

      Object.keys(formData).forEach((key) => {
        submitData.append(key, formData[key] ?? "");
      });

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/admin/staff/add`,
        submitData,
        {
          headers: {
            "Content-Type": "multipart/form-data"
          }
        }
      );

      if (response.data.emessage) {
        setEmessage(response.data.emessage);
        setSmessage("");
        return;
      }

      if (response.data.success) {
        setSmessage(response.data.message || "Staff Added Successfully");
        setEmessage("");

        // Reset form
        setFormData({
          staff_id: "",
          prefix: "",
          photo_url: "",
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
          department_code: "",
          designation: "",
          role_type: "",
          employment_type: "",
          joining_date: "",
          experience_years: "",
          aadhar_number: "",
          pan_number: "",
          bank_name: "",
          account_number: "",
          ifsc_code: "",
          branch_name: "",
          highest_qualification: "",
          specialization: "",
          salary: "",
          blood_group: "",
          marital_status: "",
          staff_status: "Active"
        });

        setPreview("/user.png");
        setImageFile(null);

        setTimeout(() => {
          router.push("/admin/staff");
        }, 1500);
        return;
      }

      setEmessage(response.data.message || "Unable to add staff. Please try again.");
      setSmessage("");
    } catch (err) {
      const errorMessage =
        err.response?.data?.emessage ||
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred.";
      setEmessage(errorMessage);
      setSmessage("");
      console.error(err);
    }
  };

  useEffect(() => {
    if (!Emessage && !Smessage) return;

    const timer = setTimeout(() => {
      setEmessage("");
      setSmessage("");
    }, 10000);

    return () => clearTimeout(timer);
  }, [Emessage, Smessage]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <p>Staff Directory &gt; Add New Staff</p>
          <h1>Staff Onboarding Profile</h1>
        </div>

        <div className={styles.actions}>
          <button 
            className={styles.actionBtn} 
            type="button" 
            onClick={() => router.push("/admin/staff")}
          >
            Cancel
          </button>
          <button 
            className={styles.actionBtn} 
            type="button" 
            onClick={handleSubmit}
          >
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
              <select
                className={styles.formInput}
                name="prefix"
                value={formData.prefix}
                onChange={handleChange}
              >
                <option value="">Select Prefix</option>
                <option value="Mr">Mr</option>
                <option value="Mrs">Mrs</option>
                <option value="Ms">Ms</option>
                <option value="Dr">Dr</option>
                <option value="Prof">Prof</option>
              </select>

              <input 
                className={styles.formInput} 
                name="first_name" 
                placeholder="First Name" 
                value={formData.first_name}
                onChange={handleChange} 
              />
              <input 
                className={styles.formInput} 
                name="last_name" 
                placeholder="Last Name" 
                value={formData.last_name}
                onChange={handleChange} 
              />
              <input 
                className={styles.formInput} 
                type="date" 
                name="date_of_birth" 
                value={formData.date_of_birth}
                onChange={handleChange} 
              />
              <select 
                className={styles.formInput} 
                name="gender" 
                value={formData.gender}
                onChange={handleChange}
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
              <select 
                className={styles.formInput} 
                name="blood_group" 
                value={formData.blood_group}
                onChange={handleChange}
              >
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
              <select
                className={styles.formInput}
                name="marital_status"
                value={formData.marital_status}
                onChange={handleChange}
              >
                <option value="">Marital Status</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
              </select>
              
            </div>
          </div>
        </section>

        {/* CONTACT */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>2. Contact Information</h2>
          <div className={styles.grid}>
            <input 
              className={styles.formInput} 
              name="phone_number" 
              placeholder="Phone Number" 
              value={formData.phone_number}
              onChange={handleChange} 
            />
            <input 
              className={styles.formInput} 
              name="email" 
              placeholder="Official Email" 
              value={formData.email}
              onChange={handleChange} 
            />
            <input 
              className={styles.formInput} 
              name="personal_email" 
              placeholder="Personal Email" 
              value={formData.personal_email}
              onChange={handleChange} 
            />
            <input 
              className={styles.formInput} 
              name="city" 
              placeholder="City" 
              value={formData.city}
              onChange={handleChange} 
            />
            <input 
              className={styles.formInput} 
              name="state" 
              placeholder="State" 
              value={formData.state}
              onChange={handleChange} 
            />
            <input 
              className={styles.formInput} 
              name="pincode" 
              placeholder="Pincode" 
              value={formData.pincode}
              onChange={handleChange} 
            />
            <textarea 
              className={styles.formTextarea} 
              name="address" 
              placeholder="Full Residential Address" 
              value={formData.address}
              onChange={handleChange} 
            />
          </div>
        </section>

        {/* PROFESSIONAL */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>3. Professional Details</h2>
          <div className={styles.grid}>
            <input 
              className={styles.formInput} 
              name="staff_id" 
              placeholder="Staff ID" 
              value={formData.staff_id}
              onChange={handleChange} 
            />
            <select
              className={styles.formInput}
              name="department_code"
              value={formData.department_code}
              onChange={handleChange}
            >
              <option value="">Select Department</option>
              <option value="CSE">Computer Science</option>
              <option value="AI&DS">AI & DS</option>
              <option value="IT">Information Technology</option>
              <option value="ECE">ECE</option>
              <option value="EEE">EEE</option>
              <option value="MECH">Mechanical</option>
              <option value="CIVIL">Civil</option>
            </select>

            <select
              className={styles.formInput}
              name="designation"
              value={formData.designation}
              onChange={handleChange}
            >
              <option value="">Select Designation</option>
              <option value="Professor">Professor</option>
              <option value="Associate Professor">Associate Professor</option>
              <option value="Assistant Professor">Assistant Professor</option>
              <option value="HOD">HOD</option>
              <option value="Lab Assistant">Lab Assistant</option>
              <option value="Office Staff">Office Staff</option>
              <option value="Accountant">Accountant</option>
              <option value="Librarian">Librarian</option>
            </select>

            {/* ✅ FIXED: Correct role_type values to match backend */}
            <select 
              className={styles.formInput} 
              name="role_type" 
              value={formData.role_type}
              onChange={handleChange}
            >
              <option value="">Role Type</option>
              <option value="Teaching">Teaching</option>
              <option value="Non-Teaching">Non-Teaching</option>
              <option value="Administrative">Administrative</option>
              <option value="Management">Management</option>
            </select>

            <select 
              className={styles.formInput} 
              name="employment_type" 
              value={formData.employment_type}
              onChange={handleChange}
            >
              <option value="">Employment Type</option>
              <option value="FullTime">Full Time</option>
              <option value="PartTime">Part Time</option>
              <option value="Contract">Contract</option>
              <option value="Temporary">Temporary</option>
            </select>
            <input 
              className={styles.formInput} 
              type="date" 
              name="joining_date" 
              value={formData.joining_date}
              onChange={handleChange} 
            />
            <input 
              className={styles.formInput} 
              name="experience_years" 
              placeholder="Experience (in years)" 
              value={formData.experience_years}
              onChange={handleChange} 
            />
          </div>
        </section>

        {/* EDUCATION */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>4. Education Details</h2>
          <div className={styles.grid}>
            <input 
              className={styles.formInput} 
              name="highest_qualification" 
              placeholder="Highest Qualification" 
              value={formData.highest_qualification}
              onChange={handleChange} 
            />
            <input 
              className={styles.formInput} 
              name="specialization" 
              placeholder="Specialization" 
              value={formData.specialization}
              onChange={handleChange} 
            />
            <input
              className={styles.formInput}
              name="university"
              placeholder="University/Institution"
              value={formData.university}
              onChange={handleChange}
            />
            <input
              className={styles.formInput}
              name="passing_year"
              placeholder="PassedOut Year"
              value={formData.passing_year}
              onChange={handleChange}
            />
          </div>
        </section>

        {/* STATUTORY */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>5. Statutory Details</h2>
          <div className={styles.grid}>
            <input 
              className={styles.formInput} 
              name="aadhar_number" 
              placeholder="Aadhar Number" 
              value={formData.aadhar_number}
              onChange={handleChange} 
            />
            <input 
              className={styles.formInput} 
              name="pan_number" 
              placeholder="PAN Number" 
              value={formData.pan_number}
              onChange={handleChange} 
            />
          </div>
        </section>

        {/* BANK */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>6. Bank Details</h2>
          <div className={styles.grid}>
            <input 
              className={styles.formInput} 
              name="bank_name" 
              placeholder="Bank Name" 
              value={formData.bank_name}
              onChange={handleChange} 
            />
            <input 
              className={styles.formInput} 
              name="account_number" 
              placeholder="Account Number" 
              value={formData.account_number}
              onChange={handleChange} 
            />
            <input 
              className={styles.formInput} 
              name="ifsc_code" 
              placeholder="IFSC Code" 
              value={formData.ifsc_code}
              onChange={handleChange} 
            />
            <input 
              className={styles.formInput} 
              name="branch_name" 
              placeholder="Branch Name" 
              value={formData.branch_name}
              onChange={handleChange} 
            />
            <input 
              className={styles.formInput} 
              name="salary" 
              placeholder="Salary/CTC" 
              value={formData.salary}
              onChange={handleChange} 
            />
          </div>
        </section>

        {/* EMERGENCY */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>7. Emergency Contact</h2>
          <div className={styles.grid}>
            <input 
              className={styles.formInput} 
              name="emergency_contact_name" 
              placeholder="Emergency Contact Name" 
              value={formData.emergency_contact_name}
              onChange={handleChange} 
            />
            <input 
              className={styles.formInput} 
              name="emergency_contact_number" 
              placeholder="Emergency Contact Number" 
              value={formData.emergency_contact_number}
              onChange={handleChange} 
            />
          </div>
        </section>
      </form>
      
      {Emessage && <div className={styles.errorMessage}><p>{Emessage}</p></div>}
      {Smessage && <div className={styles.successMessage}><p>{Smessage}</p></div>}
    </div>
  );
}