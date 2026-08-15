"use client";

import { useState, useEffect } from "react";
import styles from "../../css/staffedit.module.css";
import { useRouter, useParams } from "next/navigation";
import axios from "axios";
import {
  ArrowLeft, Save, X, User, Phone, Briefcase,
  GraduationCap, ShieldCheck, Landmark, AlertCircle
} from "lucide-react";

export default function EditStaff() {
  const router = useRouter();
  const params = useParams();
  const staffId = params?.id;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [preview, setPreview] = useState("/user.png");
  const [imageFile, setImageFile] = useState(null);
  const [formData, setFormData] = useState({
    staff_id: "",
    prefix: "",
    first_name: "",
    last_name: "",
    staff_code:"",
    gender: "",
    date_of_birth: "",
    phone_number: "",
    email: "",
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
    personal_email: "",
    aadhar_number: "",
    pan_number: "",
    bank_name: "",
    university: "",
    passing_year: "",
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

  // ---------- Helper: redirect on unauthorized (islogout) ----------
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
          const data = response.data.data;
          setFormData({
            staff_id: data.staff_id || "",
            prefix: data.prefix || "",
            first_name: data.first_name || "",
            last_name: data.last_name || "",
            staff_code:data.staff_code||"",
            gender: data.gender || "",
            date_of_birth: data.date_of_birth || "",
            phone_number: data.phone_number || "",
            email: data.email || "",
            address: data.address || "",
            city: data.city || "",
            state: data.state || "",
            pincode: data.pincode || "",
            emergency_contact_name: data.emergency_contact_name || "",
            emergency_contact_number: data.emergency_contact_number || "",
            department_code: data.department_id || "",
            designation: data.designation_id || "",
            role_type: data.role_type || "",
            employment_type: data.employment_type || "",
            joining_date: data.joining_date || "",
            experience_years: data.experience_years ? data.experience_years.replace(' Years', '') : "",
            personal_email: data.personal_email || "",
            aadhar_number: data.aadhar_number || "",
            pan_number: data.pan_number || "",
            bank_name: data.bank_name || "",
            university: data.university || "",
            passing_year: data.passing_year || "",
            account_number: data.account_number || "",
            ifsc_code: data.ifsc_code || "",
            branch_name: data.branch_name || "",
            highest_qualification: data.highest_qualification || "",
            specialization: data.specialization || "",
            salary: data.salary ? data.salary.replace(/[^0-9.]/g, '') : "",
            blood_group: data.blood_group || "",
            marital_status: data.marital_status || "",
            staff_status: data.staff_status || "Active"
          });
          
          if (data.profile_image && data.profile_image !== '/user.png') {
            setPreview(`${process.env.NEXT_PUBLIC_BACKEND_URL}${data.profile_image}`);
          }
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
    
    // Validate required fields
    if (!formData.first_name?.trim()) {
      setError("First name is required");
      return;
    }
    if (!formData.last_name?.trim()) {
      setError("Last name is required");
      return;
    }
    if (!formData.phone_number?.trim()) {
      setError("Phone number is required");
      return;
    }
    if (!formData.email?.trim()) {
      setError("Email is required");
      return;
    }
    if (!formData.department_code) {
      setError("Department is required");
      return;
    }
    if (!formData.designation) {
      setError("Designation is required");
      return;
    }
    if (!formData.role_type) {
      setError("Role type is required");
      return;
    }
    if (!formData.joining_date) {
      setError("Joining date is required");
      return;
    }
    if (!formData.staff_status) {
      setError("Staff status is required");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const submitData = new FormData();
      if (imageFile) {
        submitData.append("photo", imageFile);
      }

      Object.keys(formData).forEach((key) => {
        submitData.append(key, formData[key] ?? "");
      });

      const response = await axios.put(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/admin/staff/${staffId}`,
        submitData,
        {
          headers: {
            "Content-Type": "multipart/form-data"
          },  withCredentials: true 
        }
      );

      if (response.data.emessage) {
        setError(response.data.emessage);
        setSuccess(false);
        return;
      }

      if (response.data.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push(`/admin/staff/view/${staffId}`);
        }, 1500);
      }
    } catch (err) {
      if (handleUnauthorized(err)) return;
      const errorMessage =
        err.response?.data?.emessage ||
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred.";
      setError(errorMessage);
      setSuccess(false);
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.push(`/admin/staff/view/${staffId}`);
  };

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
  if (error && !formData.staff_id) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <AlertCircle size={48} className={styles.errorIcon} />
          <h2>Unable to load staff profile</h2>
          <p>{error}</p>
          <button 
            className={styles.backBtn} 
            type="button" 
            onClick={() => router.push("/admin/staff")}
          >
            <ArrowLeft size={16} /> Back to Staff List
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <p className={styles.headerSubtitle}>Staff Directory &gt; Edit Staff Profile</p>
          <h1 className={styles.headerTitle}>
            Edit Staff Profile
            <span className={styles.staffIdBadge}>ID: {formData.staff_id}</span>
          </h1>
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelBtn} type="button" onClick={handleCancel}>
            <X size={16} /> Cancel
          </button>
          <button 
            className={styles.saveBtn} 
            type="button" 
            onClick={handleSubmit}
            disabled={saving}
          >
            <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.errorMessage}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className={styles.successMessage}>
          <span>✅ Staff profile updated successfully!</span>
        </div>
      )}

      <form id="editStaffForm" onSubmit={handleSubmit}>
        {/* PERSONAL */}
        <section className={styles.card}>
          <h2 className={styles.cardTitleBar}>
            <span className={styles.sectionBadge}>01</span>
            <User size={16} className={styles.cardTitleIcon} />
            <span className={styles.cardTitle}>Personal Information</span>
          </h2>
          <div className={styles.personalGrid}>
            <div className={styles.imageBox}>
              <img src={preview} alt="Profile preview" className={styles.profileImage} />
              <p className={styles.imageUploadLabel}>Update Profile Photo</p>
              <input
                className={styles.fileInput}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
              />
              <small className={styles.fileHint}>JPG, PNG (Max 2MB)</small>
            </div>

            <div className={styles.grid}>
              <div className={styles.fieldWrapper}>
                <span className={styles.fieldLabel}>Prefix</span>
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
              </div>

              <div className={styles.fieldWrapper}>
                <span className={styles.fieldLabel}>First Name *</span>
                <input
                  className={styles.formInput}
                  name="first_name"
                  placeholder="First Name"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className={styles.fieldWrapper}>
                <span className={styles.fieldLabel}>Last Name *</span>
                <input
                  className={styles.formInput}
                  name="last_name"
                  placeholder="Last Name"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className={styles.fieldWrapper}>
                <span className={styles.fieldLabel}>Date of Birth</span>
                <input
                  className={styles.formInput}
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleChange}
                />
              </div>

              <div className={styles.fieldWrapper}>
                <span className={styles.fieldLabel}>Gender *</span>
                <select
                  className={styles.formInput}
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className={styles.fieldWrapper}>
                <span className={styles.fieldLabel}>Blood Group</span>
                <select
                  className={styles.formInput}
                  name="blood_group"
                  value={formData.blood_group}
                  onChange={handleChange}
                >
                  <option value="">Blood Group</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="A1+">A1+</option>
                  <option value="A1-">A1-</option>
                  <option value="A2+">A2+</option>
                  <option value="A2-">A2-</option>
                  <option value="A1B+">A1B+</option>
                  <option value="A1B-">A1B-</option>
                  <option value="A2B+">A2B+</option>
                  <option value="A2B-">A2B-</option>
                  
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* CONTACT */}
        <section className={styles.card}>
          <h2 className={styles.cardTitleBar}>
            <span className={styles.sectionBadge}>02</span>
            <Phone size={16} className={styles.cardTitleIcon} />
            <span className={styles.cardTitle}>Contact Information</span>
          </h2>
          <div className={styles.grid}>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Phone Number *</span>
              <input
                className={styles.formInput}
                name="phone_number"
                placeholder="Phone Number"
                value={formData.phone_number}
                onChange={handleChange}
                required
              />
            </div>

            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Official Email *</span>
              <input
                className={styles.formInput}
                name="email"
                placeholder="Official Email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Personal Email</span>
              <input
                className={styles.formInput}
                name="personal_email"
                placeholder="Personal Email"
                value={formData.personal_email}
                onChange={handleChange}
              />
            </div>

            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>City</span>
              <input
                className={styles.formInput}
                name="city"
                placeholder="City"
                value={formData.city}
                onChange={handleChange}
              />
            </div>

            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>State</span>
              <input
                className={styles.formInput}
                name="state"
                placeholder="State"
                value={formData.state}
                onChange={handleChange}
              />
            </div>

            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Pincode</span>
              <input
                className={styles.formInput}
                name="pincode"
                placeholder="Pincode"
                value={formData.pincode}
                onChange={handleChange}
              />
            </div>

            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Full Residential Address</span>
              <textarea
                className={styles.formTextarea}
                name="address"
                placeholder="Full Residential Address"
                value={formData.address}
                onChange={handleChange}
                rows="3"
              />
            </div>
          </div>
        </section>

        {/* PROFESSIONAL */}
        <section className={styles.card}>
          <h2 className={styles.cardTitleBar}>
            <span className={styles.sectionBadge}>03</span>
            <Briefcase size={16} className={styles.cardTitleIcon} />
            <span className={styles.cardTitle}>Professional Details</span>
          </h2>
          <div className={styles.grid}>

            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Staff Code</span>
              <input
                className={styles.formInput}
                name="staff_code"
                placeholder="Staff Code"
                value={formData.staff_code}
                onChange={handleChange}
              />
            </div>

            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Department *</span>
              <select
                className={styles.formInput}
                name="department_code"
                value={formData.department_code}
                onChange={handleChange}
                required
              >
                <option value="">Select Department</option>
                <option value="CSE">Computer Science</option>
                <option value="AI&DS">AI & DS</option>
                <option value="IT">Information Technology</option>
                <option value="ECE">Electronics & Communication</option>
                <option value="EEE">Electrical & Electronics</option>
                <option value="MECH">Mechanical</option>
                <option value="CIVIL">Civil</option>
              </select>
            </div>

            {/* ✅ Updated Designation options to match backend */}
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Designation *</span>
              <select
                className={styles.formInput}
                name="designation"
                value={formData.designation}
                onChange={handleChange}
                required
              >
                <option value="">Select Designation</option>
                <option value="Professor">Professor</option>
                <option value="Assistant Professor">Assistant Professor</option>
                <option value="Associate Professor">Associate Professor</option>
                <option value="Lecturer">Lecturer</option>
                <option value="HOD">HOD</option>
                <option value="Lab Assistant">Lab Assistant</option>
                <option value="Clerk">Clerk</option>
                <option value="Accountant">Accountant</option>
                <option value="Manager">Manager</option>
                <option value="Director">Director</option>
                <option value="Principal">Principal</option>
              </select>
            </div>

            {/* ✅ Updated Role Type options to match backend */}
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Role Type *</span>
              <select
                className={styles.formInput}
                name="role_type"
                value={formData.role_type}
                onChange={handleChange}
                required
              >
                <option value="">Select Role Type</option>
                <option value="Admin">Admin</option>
                <option value="Hod">HOD</option>
                <option value="Staff">Staff</option>
                <option value="Student">Student</option>
                <option value="Accountant">Accountant</option>
              </select>
            </div>

            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Employment Type</span>
              <select
                className={styles.formInput}
                name="employment_type"
                value={formData.employment_type}
                onChange={handleChange}
              >
                <option value="">Select Employment Type</option>
                <option value="FullTime">Full Time</option>
                <option value="PartTime">Part Time</option>
                <option value="Contract">Contract</option>
                <option value="Temporary">Temporary</option>
              </select>
            </div>

            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Joining Date *</span>
              <input
                className={styles.formInput}
                type="date"
                name="joining_date"
                value={formData.joining_date}
                onChange={handleChange}
                required
              />
            </div>

            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Years of Experience</span>
              <input
                className={styles.formInput}
                name="experience_years"
                placeholder="Years of Experience"
                value={formData.experience_years}
                onChange={handleChange}
              />
            </div>

            {/* ✅ Updated Staff Status to match backend */}
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Staff Status *</span>
              <select
                className={styles.formInput}
                name="staff_status"
                value={formData.staff_status}
                onChange={handleChange}
                required
              >
                <option value="">Select Staff Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Resigned">Resigned</option>
                <option value="Retired">Retired</option>
              </select>
            </div>
          </div>
        </section>

        {/* EDUCATION */}
        <section className={styles.card}>
          <h2 className={styles.cardTitleBar}>
            <span className={styles.sectionBadge}>04</span>
            <GraduationCap size={16} className={styles.cardTitleIcon} />
            <span className={styles.cardTitle}>Education Details</span>
          </h2>
          <div className={styles.grid}>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Highest Qualification</span>
              <input
                className={styles.formInput}
                name="highest_qualification"
                placeholder="Highest Qualification"
                value={formData.highest_qualification}
                onChange={handleChange}
              />
            </div>

            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Specialization</span>
              <input
                className={styles.formInput}
                name="specialization"
                placeholder="Specialization"
                value={formData.specialization}
                onChange={handleChange}
              />
            </div>

            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>University / Institution</span>
              <input
                className={styles.formInput}
                name="university"
                placeholder="University / Institution"
                value={formData.university}
                onChange={handleChange}
              />
            </div>

            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Passing Year</span>
              <input
                className={styles.formInput}
                name="passing_year"
                placeholder="Passing Year"
                value={formData.passing_year}
                onChange={handleChange}
              />
            </div>
          </div>
        </section>

        {/* STATUTORY */}
        <section className={styles.card}>
          <h2 className={styles.cardTitleBar}>
            <span className={styles.sectionBadge}>05</span>
            <ShieldCheck size={16} className={styles.cardTitleIcon} />
            <span className={styles.cardTitle}>Statutory Details</span>
          </h2>
          <div className={styles.grid}>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Aadhar Number</span>
              <input
                className={styles.formInput}
                name="aadhar_number"
                placeholder="Aadhar Number"
                value={formData.aadhar_number}
                onChange={handleChange}
              />
            </div>

            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>PAN Number</span>
              <input
                className={styles.formInput}
                name="pan_number"
                placeholder="PAN Number"
                value={formData.pan_number}
                onChange={handleChange}
              />
            </div>
          </div>
        </section>

        {/* BANK */}
        <section className={styles.card}>
          <h2 className={styles.cardTitleBar}>
            <span className={styles.sectionBadge}>06</span>
            <Landmark size={16} className={styles.cardTitleIcon} />
            <span className={styles.cardTitle}>Bank Details</span>
          </h2>
          <div className={styles.grid}>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Bank Name</span>
              <input
                className={styles.formInput}
                name="bank_name"
                placeholder="Bank Name"
                value={formData.bank_name}
                onChange={handleChange}
              />
            </div>

            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Account Number</span>
              <input
                className={styles.formInput}
                name="account_number"
                placeholder="Account Number"
                value={formData.account_number}
                onChange={handleChange}
              />
            </div>

            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>IFSC Code</span>
              <input
                className={styles.formInput}
                name="ifsc_code"
                placeholder="IFSC Code"
                value={formData.ifsc_code}
                onChange={handleChange}
              />
            </div>

            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Branch Name</span>
              <input
                className={styles.formInput}
                name="branch_name"
                placeholder="Branch Name"
                value={formData.branch_name}
                onChange={handleChange}
              />
            </div>

            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Salary/CTC</span>
              <input
                className={styles.formInput}
                name="salary"
                placeholder="Salary/CTC"
                value={formData.salary}
                onChange={handleChange}
              />
            </div>
          </div>
        </section>

        {/* EMERGENCY */}
        <section className={styles.card}>
          <h2 className={styles.cardTitleBar}>
            <span className={styles.sectionBadge}>07</span>
            <AlertCircle size={16} className={styles.cardTitleIcon} />
            <span className={styles.cardTitle}>Emergency Contact</span>
          </h2>
          <div className={styles.grid}>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Emergency Contact Name</span>
              <input
                className={styles.formInput}
                name="emergency_contact_name"
                placeholder="Emergency Contact Name"
                value={formData.emergency_contact_name}
                onChange={handleChange}
              />
            </div>

            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Emergency Contact Number</span>
              <input
                className={styles.formInput}
                name="emergency_contact_number"
                placeholder="Emergency Contact Number"
                value={formData.emergency_contact_number}
                onChange={handleChange}
              />
            </div>
          </div>
        </section>
      </form>
    </div>
  );
}