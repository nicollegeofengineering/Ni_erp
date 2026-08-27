"use client";

import { useEffect, useState } from "react";
import styles from "../css/studentadd.module.css";
import { useRouter } from "next/navigation";
import axios from "axios";

export default function AddStudent() {
  const router = useRouter();
  const [preview, setPreview] = useState("/user.png");
  const [imageFile, setImageFile] = useState(null);
  const [Emessage, setEmessage] = useState("");
  const [Smessage, setSmessage] = useState("");

  const [formData, setFormData] = useState({
    student_id: "",
    application_no: "",
    admission_no: "",
    register_no: "",
    roll_no: "",
    academic_year: "",
    admission_date: "",
    admission_type: "Regular",
    admission_mode: "",
    programme: "",
    department_code: "",
    batch: "",
    regulation: "",
    medium: "",
    year: "",
    semester: "",
    section: "",
    first_name: "",
    middle_name: "",
    last_name: "",
    date_of_birth: "",
    gender: "",
    blood_group: "",
    nationality: "",
    mother_tongue: "",
    religion: "",
    community: "",
    caste: "",
    aadhar_number: "",
    mobile_number: "",
    email: "",
    address: "",
    panchayat_name: "",
    location_type: "",
    taluk: "",
    district: "",
    state: "",
    pincode: "",
    father_name: "",
    father_mobile: "",
    father_occupation: "",
    mother_name: "",
    mother_mobile: "",
    mother_occupation: "",
    annual_family_income: "",
    first_graduate: false,
    seven_point_five:false,
    guardian_name: "",
    guardian_relationship: "",
    guardian_mobile: "",
    guardian_occupation: "",
    // Qualification (will be nested)
    qualification: {
      // Regular
      emis_number: "",
      institution: "",
      qualifying_exam: "",
      passing_year: "",
      register_number: "",
      total_marks: "",
      mathematics_marks: "",
      physics_marks: "",
      chemistry_marks: "",
      aggregate: "",
      eligibility: "",
      // Lateral
      umis_number: "",
      diploma_branch: "",
      percentage: "",
    },
    special_quota: false,
    quota_category: "",
    differently_abled: false,
    disability_category: "",
    admission_status: "Applied",
    student_status: "Active",
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === "checkbox") {
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleQualificationChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      qualification: { ...prev.qualification, [name]: value },
    }));
  };

  const handleUnauthorized = (error) => {
    if (error.response?.data?.islogout === true) {
      router.push("/");
      return true;
    }
    return false;
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      alert("Only JPG, JPEG, PNG and WEBP files are allowed");
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
      // Append all form fields
      Object.keys(formData).forEach((key) => {
        if (key === "qualification") {
          submitData.append(key, JSON.stringify(formData[key]));
        } else {
          submitData.append(key, formData[key] ?? "");
        }
      });

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/admin/student/add`,
        submitData,
        {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      if (response.data.emessage) {
        setEmessage(response.data.emessage);
        setSmessage("");
        return;
      }

      if (response.data.success) {
        setSmessage(response.data.message || "Student Added Successfully");
        setEmessage("");
        // Reset form
        setFormData({
          student_id: "",
          application_no: "",
          admission_no: "",
          register_no: "",
          roll_no: "",
          academic_year: "",
          admission_date: "",
          admission_type: "Regular",
          admission_mode: "",
          programme: "",
          department_code: "",
          batch: "",
          regulation: "",
          medium: "",
          year: "",
          semester: "",
          section: "",
          first_name: "",
          middle_name: "",
          last_name: "",
          date_of_birth: "",
          gender: "",
          blood_group: "",
          nationality: "",
          mother_tongue: "",
          religion: "",
          community: "",
          caste: "",
          aadhar_number: "",
          mobile_number: "",
          email: "",
          address: "",
          panchayat_name: "",
          location_type: "",
          taluk: "",
          district: "",
          state: "",
          pincode: "",
          father_name: "",
          father_mobile: "",
          father_occupation: "",
          mother_name: "",
          mother_mobile: "",
          mother_occupation: "",
          annual_family_income: "",
          first_graduate: false,
          seven_point_five:false,
          guardian_name: "",
          guardian_relationship: "",
          guardian_mobile: "",
          guardian_occupation: "",
          qualification: {
            emis_number: "",
            institution: "",
            qualifying_exam: "",
            passing_year: "",
            register_number: "",
            total_marks: "",
            mathematics_marks: "",
            physics_marks: "",
            chemistry_marks: "",
            aggregate: "",
            umis_number: "",
            diploma_branch: "",
            percentage: "",
          },
          special_quota: false,
          quota_category: "",
          differently_abled: false,
          disability_category: "",
          admission_status: "Applied",
          student_status: "Active",
        });
        setPreview("/user.png");
        setImageFile(null);
        setTimeout(() => router.push("/hod/students"), 1500);
        return;
      }

      setEmessage(response.data.message || "Unable to add student. Please try again.");
      setSmessage("");
    } catch (err) {
      if (handleUnauthorized(err)) return;
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

  // Determine which qualification fields to show
  const isRegular = formData.admission_type === "Regular";

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <p>Student Directory &gt; Add New Student</p>
          <h1>Student Onboarding Profile</h1>
        </div>
        <div className={styles.actions}>
          <button className={styles.actionBtn} type="button" onClick={() => router.push("/hod/students")}>
            Cancel
          </button>
          <button className={styles.actionBtn} type="button" onClick={handleSubmit}>
            Save Student Profile
          </button>
        </div>
      </div>

      <form id="studentForm" onSubmit={handleSubmit}>
        {/* Student Identification */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Student Identification</h2>
          <div className={styles.personalGrid}>
            <div className={styles.imageBox}>
              <img src={preview} alt="profile preview" className={styles.profileImage} />
              <p className={styles.imageUploadLabel}>Upload Student Photo</p>
              <input
                className={styles.formInput}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
              />
            </div>
            <div className={styles.grid}>
              <div className={styles.fieldWrapper}>
                <span className={styles.fieldLabel}>Application No. *</span>
                <input className={styles.formInput} name="application_no" placeholder="Application No." value={formData.application_no} onChange={handleChange} required />
              </div>
              <div className={styles.fieldWrapper}>
                <span className={styles.fieldLabel}>Admission No. *</span>
                <input className={styles.formInput} name="admission_no" placeholder="Admission No." value={formData.admission_no} onChange={handleChange} required />
              </div>
              <div className={styles.fieldWrapper}>
                <span className={styles.fieldLabel}>Register No. *</span>
                <input className={styles.formInput} name="register_no" placeholder="Register No." value={formData.register_no} onChange={handleChange} required />
              </div>
              <div className={styles.fieldWrapper}>
                <span className={styles.fieldLabel}>Roll No. *</span>
                <input className={styles.formInput} name="roll_no" placeholder="Roll No." value={formData.roll_no} onChange={handleChange} required />
              </div>
            </div>
          </div>
        </section>

        {/* Admission & Academic Information */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Admission &amp; Academic Information</h2>
          <div className={styles.grid}>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Current Academic Year</span>
              <input className={styles.formInput} name="academic_year" placeholder="e.g. 2026-2027" value={formData.academic_year} onChange={handleChange} />
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Admission Date</span>
              <input className={styles.formInput} type="date" name="admission_date" value={formData.admission_date} onChange={handleChange} />
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Admission Type *</span>
              <select className={styles.formInput} name="admission_type" value={formData.admission_type} onChange={handleChange} required>
                <option value="Regular">Regular</option>
                <option value="Lateral">Lateral Entry</option>
              </select>
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Admission Mode</span>
              <select className={styles.formInput} name="admission_mode" value={formData.admission_mode} onChange={handleChange} required>
                <option value="">Select Programme</option>
                <option value="Tnea Counselling">Tnea Counselling</option>
                <option value="Management">Management</option>
              </select>
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Programme</span>
              <select className={styles.formInput} name="programme" value={formData.programme} onChange={handleChange} required>
                <option value="">Select Programme</option>
                <option value="B.E">B.E</option>
                <option value="B.Tech">B.Tech</option>
              </select>
            </div>

            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Department *</span>
              <select className={styles.formInput} name="department_code" value={formData.department_code} onChange={handleChange} required>
                <option value="">Select Department</option>
                <option value="CSE">Computer Science Engineering</option>
                <option value="AI&DS">Artificial Intelligence And Data Science</option>
                <option value="IT">Information Technology</option>
                <option value="ECE">Electronics and Communication Engineering</option>
                <option value="EEE">Electrical and Electronics Engineering</option>
                <option value="MECH">Mechanical Engineering</option>
                <option value="CIVIL">Civil Engineering</option>
              </select>
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Batch</span>
              <input className={styles.formInput} name="batch" placeholder="2023" value={formData.batch} onChange={handleChange} />
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Regulation</span>
              <input className={styles.formInput} name="regulation" placeholder="2021" value={formData.regulation} onChange={handleChange} />
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Medium</span>
              <select className={styles.formInput} name="medium" value={formData.medium} onChange={handleChange}>
                <option value="">Select Medium</option>
                <option value="English">English</option>
                <option value="Tamil">Tamil</option>
              </select>
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Year</span>
              <select className={styles.formInput} name="year" value={formData.year} onChange={handleChange}>
                <option value="">Select Year</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
              </select>
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Semester</span>
              <select className={styles.formInput} name="semester" value={formData.semester} onChange={handleChange}>
                <option value="">Select Semester</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6</option>
                <option value="7">7</option>
                <option value="8">8</option>
              </select>
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Section</span>
              <input className={styles.formInput} name="section" placeholder="e.g. A" value={formData.section} onChange={handleChange} />
            </div>
          </div>
        </section>

        {/* Personal Information */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Personal Information</h2>
          <div className={styles.grid}>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>First Name *</span>
              <input className={styles.formInput} name="first_name" placeholder="First Name" value={formData.first_name} onChange={handleChange} required />
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Last Name *</span>
              <input className={styles.formInput} name="last_name" placeholder="Last Name" value={formData.last_name} onChange={handleChange} required />
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Date of Birth</span>
              <input className={styles.formInput} type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} />
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Gender *</span>
              <select className={styles.formInput} name="gender" value={formData.gender} onChange={handleChange} required>
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Blood Group</span>
              <select className={styles.formInput} name="blood_group" value={formData.blood_group} onChange={handleChange}>
                <option value="">Blood Group</option>
                  <option value="A+">A+</option>
                  <option value="B+">B+</option>
                  <option value="O+">O+</option>
                  <option value="AB+">AB+</option>
                  <option value="A-">A-</option>
                  <option value="B-">B-</option>
                  <option value="O-">O-</option>
                  <option value="AB-">AB-</option>
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
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Nationality</span>
              <input className={styles.formInput} name="nationality" placeholder="Nationality" value={formData.nationality} onChange={handleChange} />
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Mother Tongue</span>
              <input className={styles.formInput} name="mother_tongue" placeholder="Mother Tongue" value={formData.mother_tongue} onChange={handleChange} />
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Religion</span>
              <input className={styles.formInput} name="religion" placeholder="Religion" value={formData.religion} onChange={handleChange} />
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Community</span>
              <input className={styles.formInput} name="community" placeholder="Community" value={formData.community} onChange={handleChange} />
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Caste</span>
              <input className={styles.formInput} name="caste" placeholder="Caste" value={formData.caste} onChange={handleChange} />
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Aadhar No. *</span>
              <input className={styles.formInput} name="aadhar_number" placeholder="Aadhar Number (12 digits)" value={formData.aadhar_number} onChange={handleChange} required />
            </div>
          </div>
        </section>

        {/* Contact & Address */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Contact &amp; Address</h2>
          <div className={styles.grid}>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Mobile Number *</span>
              <input className={styles.formInput} name="mobile_number" placeholder="Mobile Number" value={formData.mobile_number} onChange={handleChange} required />
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Email *</span>
              <input className={styles.formInput} name="email" placeholder="Email" value={formData.email} onChange={handleChange} required />
            </div>
            <div className={`${styles.fieldWrapper} ${styles.fullWidth}`}>
              <span className={styles.fieldLabel}>Address</span>
              <textarea className={styles.formTextarea} name="address" placeholder="Address" value={formData.address} onChange={handleChange} rows="3" />
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Panchayat Name</span>
              <input className={styles.formInput} name="panchayat_name" placeholder="Panchayat Name" value={formData.panchayat_name} onChange={handleChange} />
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Location Type</span>
              <select className={styles.formInput} name="location_type" value={formData.location_type} onChange={handleChange}>
                <option value="">Select Location Type</option>
                <option value="Rural">Rural</option>
                <option value="Urban">Urban</option>
                <option value="Semi-Urban">Semi-Urban</option>
              </select>
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Taluk</span>
              <input className={styles.formInput} name="taluk" placeholder="Taluk" value={formData.taluk} onChange={handleChange} />
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>District</span>
              <input className={styles.formInput} name="district" placeholder="District" value={formData.district} onChange={handleChange} />
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>State</span>
              <input className={styles.formInput} name="state" placeholder="State" value={formData.state} onChange={handleChange} />
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Pincode</span>
              <input className={styles.formInput} name="pincode" placeholder="Pincode" value={formData.pincode} onChange={handleChange} />
            </div>
          </div>
        </section>

        {/* Parent / Guardian */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Parent / Guardian</h2>
          <div className={styles.grid}>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Father Name</span>
              <input className={styles.formInput} name="father_name" placeholder="Father Name" value={formData.father_name} onChange={handleChange} />
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Father Mobile</span>
              <input className={styles.formInput} name="father_mobile" placeholder="Father Mobile" value={formData.father_mobile} onChange={handleChange} />
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Father Occupation</span>
              <input className={styles.formInput} name="father_occupation" placeholder="Father Occupation" value={formData.father_occupation} onChange={handleChange} />
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Mother Name</span>
              <input className={styles.formInput} name="mother_name" placeholder="Mother Name" value={formData.mother_name} onChange={handleChange} />
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Mother Mobile</span>
              <input className={styles.formInput} name="mother_mobile" placeholder="Mother Mobile" value={formData.mother_mobile} onChange={handleChange} />
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Mother Occupation</span>
              <input className={styles.formInput} name="mother_occupation" placeholder="Mother Occupation" value={formData.mother_occupation} onChange={handleChange} />
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Annual Family Income</span>
              <input className={styles.formInput} name="annual_family_income" placeholder="Annual Family Income" value={formData.annual_family_income} onChange={handleChange} />
            </div>
            <div className={styles.fieldWrapper}>
              
              <div className={styles.checkboxGroup}>
                <div className={styles.checkboxsub}>
                <span className={styles.fieldLabel}>First Graduate</span>
                <label>
                  <input type="checkbox" name="first_graduate" checked={formData.first_graduate} onChange={handleChange} /> Yes
                </label>
                </div>
                <div className={styles.checkboxsub}>
                <span className={styles.fieldLabel}>7.5 Reservation</span>
                <label>
                  <input type="checkbox" name="seven_point_five" checked={formData.seven_point_five} onChange={handleChange} /> Yes
                </label>
                </div>
              </div>
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Guardian Name</span>
              <input className={styles.formInput} name="guardian_name" placeholder="Guardian Name" value={formData.guardian_name} onChange={handleChange} />
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Guardian Relationship</span>
              <input className={styles.formInput} name="guardian_relationship" placeholder="Relationship" value={formData.guardian_relationship} onChange={handleChange} />
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Guardian Mobile</span>
              <input className={styles.formInput} name="guardian_mobile" placeholder="Guardian Mobile" value={formData.guardian_mobile} onChange={handleChange} />
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Guardian Occupation</span>
              <input className={styles.formInput} name="guardian_occupation" placeholder="Guardian Occupation" value={formData.guardian_occupation} onChange={handleChange} />
            </div>
          </div>
        </section>

        {/* Qualification Section (Dynamic) */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>{isRegular ? "Regular Admission Details" : "Lateral Entry Details"}</h2>
          <div className={styles.grid}>
            {isRegular ? (
              // Regular fields
              <>
                <div className={styles.fieldWrapper}>
                  <span className={styles.fieldLabel}>EMIS Number *</span>
                  <input className={styles.formInput} name="emis_number" placeholder="EMIS Number" value={formData.qualification.emis_number} onChange={handleQualificationChange} required />
                </div>
                <div className={styles.fieldWrapper}>
                  <span className={styles.fieldLabel}>Institution *</span>
                  <input className={styles.formInput} name="institution" placeholder="Institution" value={formData.qualification.institution} onChange={handleQualificationChange} required />
                </div>
                <div className={styles.fieldWrapper}>
                  <span className={styles.fieldLabel}>Qualifying Exam *</span>
                  <input className={styles.formInput} name="qualifying_exam" placeholder="Qualifying Exam" value={formData.qualification.qualifying_exam} onChange={handleQualificationChange} required />
                </div>
                <div className={styles.fieldWrapper}>
                  <span className={styles.fieldLabel}>Passing Year *</span>
                  <input className={styles.formInput} name="passing_year" placeholder="Passing Year" value={formData.qualification.passing_year} onChange={handleQualificationChange} required />
                </div>
                <div className={styles.fieldWrapper}>
                  <span className={styles.fieldLabel}>Register Number *</span>
                  <input className={styles.formInput} name="register_number" placeholder="Register Number" value={formData.qualification.register_number} onChange={handleQualificationChange} required />
                </div>
                <div className={styles.fieldWrapper}>
                  <span className={styles.fieldLabel}>Total Marks *</span>
                  <input className={styles.formInput} name="total_marks" placeholder="Total Marks" value={formData.qualification.total_marks} onChange={handleQualificationChange} required />
                </div>
                <div className={styles.fieldWrapper}>
                  <span className={styles.fieldLabel}>Mathematics Marks</span>
                  <input className={styles.formInput} name="mathematics_marks" placeholder="Mathematics Marks" value={formData.qualification.mathematics_marks} onChange={handleQualificationChange} />
                </div>
                <div className={styles.fieldWrapper}>
                  <span className={styles.fieldLabel}>Physics Marks</span>
                  <input className={styles.formInput} name="physics_marks" placeholder="Physics Marks" value={formData.qualification.physics_marks} onChange={handleQualificationChange} />
                </div>
                <div className={styles.fieldWrapper}>
                  <span className={styles.fieldLabel}>Chemistry Marks</span>
                  <input className={styles.formInput} name="chemistry_marks" placeholder="Chemistry Marks" value={formData.qualification.chemistry_marks} onChange={handleQualificationChange} />
                </div>
                <div className={styles.fieldWrapper}>
                  <span className={styles.fieldLabel}>Cutoff</span>
                  <input className={styles.formInput} name="aggregate" placeholder="Aggregate" value={formData.qualification.aggregate} onChange={handleQualificationChange} />
                </div>
                
              </>
            ) : (
              // Lateral fields
              <>
                <div className={styles.fieldWrapper}>
                  <span className={styles.fieldLabel}>UMIS Number *</span>
                  <input className={styles.formInput} name="umis_number" placeholder="UMIS Number" value={formData.qualification.umis_number} onChange={handleQualificationChange} required />
                </div>
                <div className={styles.fieldWrapper}>
                  <span className={styles.fieldLabel}>Institution *</span>
                  <input className={styles.formInput} name="institution" placeholder="Institution" value={formData.qualification.institution} onChange={handleQualificationChange} required />
                </div>
                <div className={styles.fieldWrapper}>
                  <span className={styles.fieldLabel}>Qualifying Exam *</span>
                  <input className={styles.formInput} name="qualifying_exam" placeholder="Qualifying Exam" value={formData.qualification.qualifying_exam} onChange={handleQualificationChange} required />
                </div>
                <div className={styles.fieldWrapper}>
                  <span className={styles.fieldLabel}>Passing Year *</span>
                  <input className={styles.formInput} name="passing_year" placeholder="Passing Year" value={formData.qualification.passing_year} onChange={handleQualificationChange} required />
                </div>
                <div className={styles.fieldWrapper}>
                  <span className={styles.fieldLabel}>Register Number *</span>
                  <input className={styles.formInput} name="register_number" placeholder="Register Number" value={formData.qualification.register_number} onChange={handleQualificationChange} required />
                </div>
                <div className={styles.fieldWrapper}>
                  <span className={styles.fieldLabel}>Diploma Branch *</span>
                  <input className={styles.formInput} name="diploma_branch" placeholder="Diploma Branch" value={formData.qualification.diploma_branch} onChange={handleQualificationChange} required />
                </div>
                <div className={styles.fieldWrapper}>
                  <span className={styles.fieldLabel}>Total Marks *</span>
                  <input className={styles.formInput} name="total_marks" placeholder="Total Marks" value={formData.qualification.total_marks} onChange={handleQualificationChange} required />
                </div>
                <div className={styles.fieldWrapper}>
                  <span className={styles.fieldLabel}>Percentage</span>
                  <input className={styles.formInput} name="percentage" placeholder="Percentage" value={formData.qualification.percentage} onChange={handleQualificationChange} />
                </div>
                
              </>
            )}
          </div>
        </section>

        {/* Category & Special Information */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Category &amp; Special Information</h2>
          <div className={styles.grid}>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Special Quota</span>
              <select className={styles.formInput} name="special_quota" value={formData.special_quota ? "true" : "false"} onChange={(e) => setFormData(prev => ({ ...prev, special_quota: e.target.value === "true" }))}>
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Quota Category</span>
              <input className={styles.formInput} name="quota_category" placeholder="Quota Category" value={formData.quota_category} onChange={handleChange} />
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Differently Abled</span>
              <select className={styles.formInput} name="differently_abled" value={formData.differently_abled ? "true" : "false"} onChange={(e) => setFormData(prev => ({ ...prev, differently_abled: e.target.value === "true" }))}>
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Disability Category</span>
              <input className={styles.formInput} name="disability_category" placeholder="Disability Category" value={formData.disability_category} onChange={handleChange} />
            </div>
            
          </div>
        </section>

        {/* Student Status */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Student Status</h2>
          <div className={styles.grid}>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Admission Status</span>
              <select className={styles.formInput} name="admission_status" value={formData.admission_status} onChange={handleChange}>
                <option value="Applied">Applied</option>
                <option value="Admitted">Admitted</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            <div className={styles.fieldWrapper}>
              <span className={styles.fieldLabel}>Student Status</span>
              <select className={styles.formInput} name="student_status" value={formData.student_status} onChange={handleChange}>
                <option value="Active">Active</option>
                <option value="Graduated">Graduated</option>
                <option value="Discontinued">Discontinued</option>
                <option value="Transferred">Transferred</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
          </div>
        </section>
      </form>

      {Emessage && <div className={styles.errorMessage}><p>{Emessage}</p></div>}
      {Smessage && <div className={styles.successMessage}><p>{Smessage}</p></div>}
    </div>
  );
}