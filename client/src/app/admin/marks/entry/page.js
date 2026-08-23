"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import styles from "../css/marksentry.module.css";

export default function MarksEntry() {
  const router = useRouter();

  const [filters, setFilters] = useState({
    exam_name: "",
    academic_year: "",
    year: "",
    semester: "",
    batch: "",
  });
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [roster, setRoster] = useState([]);
  const [marksData, setMarksData] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const { exam_name, academic_year, year, semester, batch } = filters;
    if (exam_name && academic_year && year && semester) {
      fetchSubjects();
    }
  }, [filters]);

  const fetchSubjects = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        exam_name: filters.exam_name,
        academic_year: filters.academic_year,
        year: filters.year,
        semester: filters.semester,
        batch: filters.batch,
      });
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/mark/subjects?${params}`,
        { withCredentials: true }
      );
      if (res.data.success) {
        setSubjects(res.data.data);
        if (res.data.data.length > 0) {
          setSelectedSubject(res.data.data[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedSubject) return;
    fetchRosterAndMarks();
  }, [selectedSubject]);

  const fetchRosterAndMarks = async () => {
    try {
      setLoading(true);
      const deptCode = selectedSubject.department_code || filters.department_code || '';
      const rosterRes = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/mark/roster?` +
        new URLSearchParams({
          department_code: deptCode,
          year: filters.year,
          semester: filters.semester,
          section: filters.section || "",
          batch: filters.batch,
        }),
        { withCredentials: true }
      );
      const students = rosterRes.data.data || [];

      const marksRes = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/mark?` +
        new URLSearchParams({
          exam_name: filters.exam_name,
          subject: selectedSubject._id,
          academic_year: filters.academic_year,
          year: filters.year,
          semester: filters.semester,
          section: filters.section || "",
        }),
        { withCredentials: true }
      );
      const existingMarks = marksRes.data.data || [];

      const map = {};
      students.forEach(student => {
        const theoryMark = existingMarks.find(m => m.student._id === student._id && m.component === 'Theory');
        const practicalMark = existingMarks.find(m => m.student._id === student._id && m.component === 'Practical');
        map[student._id] = {
          theoryMarkId: theoryMark?._id || null,
          practicalMarkId: practicalMark?._id || null,
          theory: theoryMark?.marks_obtained ?? "",
          practical: practicalMark?.marks_obtained ?? "",
        };
      });
      setRoster(students);
      setMarksData(map);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkChange = (studentId, field, value) => {
    setMarksData(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value === "" ? "" : Number(value),
      },
    }));
  };

  const saveAllMarks = async () => {
    try {
      setSaving(true);
      const category = selectedSubject.Category;
      const components = category === "TL" ? ["Theory", "Practical"] : [category === "T" ? "Theory" : "Practical"];

      const promises = [];
      for (const studentId of Object.keys(marksData)) {
        const data = marksData[studentId];
        for (const component of components) {
          const markValue = component === "Theory" ? data.theory : data.practical;
          if (markValue === "" || markValue === null || markValue === undefined) continue;

          const payload = {
            exam_name: filters.exam_name,
            subject: selectedSubject._id,
            component: component,
            student: studentId,
            marks_obtained: Number(markValue),
            academic_year: filters.academic_year,
            department_code: selectedSubject.department_code,
            year: filters.year,
            semester: filters.semester,
            section: filters.section || "",
            batch: filters.batch,
          };

          const markId = component === "Theory" ? data.theoryMarkId : data.practicalMarkId;
          if (markId) {
            promises.push(
              axios.patch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/mark/${markId}`,
                payload,
                { withCredentials: true }
              )
            );
          } else {
            promises.push(
              axios.post(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/mark`,
                payload,
                { withCredentials: true }
              )
            );
          }
        }
      }
      await Promise.all(promises);
      alert("All marks saved successfully!");
      fetchRosterAndMarks();
    } catch (err) {
      console.error(err);
      alert("Error saving marks. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const category = selectedSubject?.Category;
  const showTheory = category === "T" || category === "TL";
  const showPractical = category === "L" || category === "TL";

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Mark Entry</h1>
        <p>Enter or edit marks for your timetabled subjects.</p>
      </div>

      <div className={styles.filters}>
        <select
          value={filters.exam_name}
          onChange={e => setFilters(prev => ({ ...prev, exam_name: e.target.value }))}
        >
          <option value="">Select Exam</option>
          <option value="Internal 1">Internal 1</option>
          <option value="Internal 2">Internal 2</option>
          <option value="Internal 3">Internal 3</option>
          <option value="Model">Model</option>
        </select>
        <input
          type="text"
          placeholder="Academic Year (e.g. 2026-27)"
          value={filters.academic_year}
          onChange={e => setFilters(prev => ({ ...prev, academic_year: e.target.value }))}
        />
        <select
          value={filters.year}
          onChange={e => setFilters(prev => ({ ...prev, year: e.target.value }))}
        >
          <option value="">Year</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
        </select>
        <select
          value={filters.semester}
          onChange={e => setFilters(prev => ({ ...prev, semester: e.target.value }))}
        >
          <option value="">Semester</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
          <option value="5">5</option>
          <option value="6">6</option>
          <option value="7">7</option>
          <option value="8">8</option>
        </select>
        <input
          type="text"
          placeholder="Batch (optional)"
          value={filters.batch}
          onChange={e => setFilters(prev => ({ ...prev, batch: e.target.value }))}
        />
      </div>

      {subjects.length > 0 && (
        <div className={styles.subjectSelector}>
          <label>Select Subject: </label>
          <select
            value={selectedSubject?._id || ""}
            onChange={e => {
              const sub = subjects.find(s => s._id === e.target.value);
              setSelectedSubject(sub);
            }}
          >
            {subjects.map(s => (
              <option key={s._id} value={s._id}>
                {s.subjectCode} – {s.subjectName} ({s.Category})
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedSubject && roster.length > 0 && (
        <div className={styles.tableWrapper}>
          <div className={styles.tableHeader}>
            <span>{roster.length} students found</span>
            <button className={styles.saveBtn} onClick={saveAllMarks} disabled={saving}>
              {saving ? "Saving..." : "Save All Marks"}
            </button>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Register No.</th>
                <th>Student Name</th>
                {showTheory && <th>Theory Marks</th>}
                {showPractical && <th>Practical Marks</th>}
              </tr>
            </thead>
            <tbody>
              {roster.map(student => {
                const data = marksData[student._id] || {};
                return (
                  <tr key={student._id}>
                    <td>{student.register_no}</td>
                    <td>{student.full_name}</td>
                    {showTheory && (
                      <td>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={data.theory ?? ""}
                          onChange={e => handleMarkChange(student._id, "theory", e.target.value)}
                          className={styles.markInput}
                        />
                      </td>
                    )}
                    {showPractical && (
                      <td>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={data.practical ?? ""}
                          onChange={e => handleMarkChange(student._id, "practical", e.target.value)}
                          className={styles.markInput}
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {loading && <div className={styles.loading}>Loading...</div>}
      {subjects.length === 0 && filters.exam_name && !loading && (
        <div className={styles.empty}>No subjects found for this selection.</div>
      )}
    </div>
  );
}