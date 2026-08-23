"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import styles from "../css/marksview.module.css";

export default function AdminMarksView() {
  const router = useRouter();

  const [filters, setFilters] = useState({
    department_code: "",
    academic_year: "",
    year: "",
    semester: "",
    batch: "",
  });
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [marksData, setMarksData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { department_code, academic_year, year, semester, batch } = filters;
    if (department_code && academic_year && year && semester) {
      fetchExamAndSubjects();
    }
  }, [filters]);

  const fetchExamAndSubjects = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        academic_year: filters.academic_year,
        department_code: filters.department_code,
        year: filters.year,
        semester: filters.semester,
        batch: filters.batch,
      });
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/mark/exam-subjects?${params}`,
        { withCredentials: true }
      );
      if (res.data.success) {
        setExams(res.data.data.exams || []);
        setSubjects(res.data.data.subjects || []);
        if (res.data.data.exams.length > 0) {
          setSelectedExam(res.data.data.exams[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedExam && selectedSubject) {
      fetchMarks();
    }
  }, [selectedExam, selectedSubject]);

  const fetchMarks = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        exam_name: selectedExam,
        subject: selectedSubject._id,
        academic_year: filters.academic_year,
        department_code: filters.department_code,
        year: filters.year,
        semester: filters.semester,
        section: filters.section || "",
        batch: filters.batch,
      });
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/mark?${params}`,
        { withCredentials: true }
      );
      if (res.data.success) {
        setMarksData(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteMark = async (markId) => {
    if (!confirm("Delete this student's mark entry?")) return;
    try {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/mark/${markId}`,
        { withCredentials: true }
      );
      setMarksData(prev => prev.filter(mark => mark._id !== markId));
      alert("Mark deleted.");
    } catch (err) {
      console.error(err);
      alert("Error deleting mark.");
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Marks Overview</h1>
        <p>View and delete marks (Admin/Hod only).</p>
      </div>

      <div className={styles.filters}>
        <select
          value={filters.department_code}
          onChange={e => setFilters(prev => ({ ...prev, department_code: e.target.value }))}
        >
          <option value="">Select Department</option>
          <option value="CSE">CSE</option>
          <option value="AI&DS">AI&DS</option>
          <option value="IT">IT</option>
          <option value="ECE">ECE</option>
          <option value="EEE">EEE</option>
          <option value="MECH">MECH</option>
          <option value="CIVIL">CIVIL</option>
        </select>
        <input
          type="text"
          placeholder="Academic Year"
          value={filters.academic_year}
          onChange={e => setFilters(prev => ({ ...prev, academic_year: e.target.value }))}
        />
        <select
          value={filters.year}
          onChange={e => setFilters(prev => ({ ...prev, year: e.target.value }))}
        >
          <option value="">Year</option>
          {[1,2,3,4].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={filters.semester}
          onChange={e => setFilters(prev => ({ ...prev, semester: e.target.value }))}
        >
          <option value="">Semester</option>
          {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          type="text"
          placeholder="Batch"
          value={filters.batch}
          onChange={e => setFilters(prev => ({ ...prev, batch: e.target.value }))}
        />
      </div>

      {exams.length > 0 && (
        <div className={styles.selectorRow}>
          <label>Exam: </label>
          <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)}>
            {exams.map(ex => <option key={ex} value={ex}>{ex}</option>)}
          </select>
        </div>
      )}

      {subjects.length > 0 && selectedExam && (
        <div className={styles.selectorRow}>
          <label>Subject: </label>
          <select
            value={selectedSubject?._id || ""}
            onChange={e => {
              const sub = subjects.find(s => s._id === e.target.value);
              setSelectedSubject(sub);
            }}
          >
            <option value="">-- Select Subject --</option>
            {subjects.map(s => (
              <option key={s._id} value={s._id}>
                {s.subjectCode} – {s.subjectName} ({s.Category})
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedSubject && marksData.length > 0 && (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Register No.</th>
                <th>Student Name</th>
                <th>Component</th>
                <th>Marks</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {marksData.map(mark => (
                <tr key={mark._id}>
                  <td>{mark.student?.register_no || '-'}</td>
                  <td>{mark.student ? `${mark.student.first_name} ${mark.student.last_name}` : 'Unknown'}</td>
                  <td>{mark.component}</td>
                  <td>{mark.marks_obtained ?? '-'}</td>
                  <td>
                    <button className={styles.deleteBtn} onClick={() => deleteMark(mark._id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {loading && <div className={styles.loading}>Loading...</div>}
      {selectedSubject && marksData.length === 0 && !loading && (
        <div className={styles.empty}>No marks found.</div>
      )}
    </div>
  );
}