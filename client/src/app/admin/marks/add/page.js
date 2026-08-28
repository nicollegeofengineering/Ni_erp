"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Loader2 } from "lucide-react";
import styles from "./page.module.css";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

function handleUnauthorized(err) {
  if (err.response?.data?.islogout === true || err.response?.status === 401) {
    window.location.href = "/";
    return true;
  }
  return false;
}

function currentAcademicYears(currentVal) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const startYear = now.getMonth() >= 5 ? currentYear : currentYear - 1;
  const years = [];
  for (let i = startYear - 5; i <= startYear + 5; i++) {
    years.push(`${i}-${i + 1}`);
  }
  if (currentVal && !years.includes(currentVal)) {
    years.push(currentVal);
    years.sort();
  }
  return years;
}

function getDefaultAcademicYear() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const startYear = now.getMonth() >= 5 ? currentYear : currentYear - 1;
  return `${startYear}-${startYear + 1}`;
}

export default function StaffMarksAddPage() {
  const [departments, setDepartments] = useState([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");
  const [semester, setSemester] = useState("");
  const [academicYear, setAcademicYear] = useState(getDefaultAcademicYear());
  const [internalExam, setInternalExam] = useState("1");

  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);

  const [students, setStudents] = useState([]);
  const [category, setCategory] = useState("");
  const [allowedComponents, setAllowedComponents] = useState([]);

  const [markRows, setMarkRows] = useState({});

  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const yearOptions = [1, 2, 3, 4];
  const semesterOptions = [1, 2, 3, 4, 5, 6, 7, 8];
  const academicYearOptions = currentAcademicYears();
  const examOptions = [1, 2];

  // ---------- Load departments ----------
  useEffect(() => {
    let mounted = true;
    const fetchDepartments = async () => {
      try {
        const res = await api.get("/api/admin/department/all");
        const list = Array.isArray(res.data)
          ? res.data
          : res.data?.data || res.data?.departments || [];
        if (mounted) setDepartments(list);
      } catch (err) {
        if (handleUnauthorized(err)) return;
        console.error("Failed to fetch departments:", err);
        if (mounted) {
          setError(err.response?.data?.message || "Failed to load departments.");
        }
      } finally {
        if (mounted) setDepartmentsLoading(false);
      }
    };
    fetchDepartments();
    return () => {
      mounted = false;
    };
  }, []);

  // Auto-dismiss banners
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 5000);
      return () => clearTimeout(t);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(""), 6000);
      return () => clearTimeout(t);
    }
  }, [error]);

  const selectedCount = useMemo(() => {
    return Object.values(markRows).filter((row) => row.selected).length;
  }, [markRows]);

  function updateRow(studentId, field, value) {
    setMarkRows((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value,
      },
    }));
  }

  // ---------- Search subjects ----------
  async function handleSearchSubjects() {
    setError("");
    setSuccess("");
    setSelectedSubject(null);
    setStudents([]);
    setCategory("");
    setMarkRows({});

    if (!department || !year || !semester || !academicYear) {
      setError("Please select department, year, semester and academic year.");
      return;
    }

    try {
      setLoadingSubjects(true);
      const params = new URLSearchParams({
        department,
        year,
        semester,
        academicYear,
        mode: "entry",
      });
      const res = await api.get(`/api/mark/subjects?${params.toString()}`);
      if (res.data.success) {
        const data = res.data.data || [];
        setSubjects(Array.isArray(data) ? data : []);
        if (data.length === 0) {
          setSuccess("No subjects found assigned to you for the selected filters.");
        }
      } else {
        setError(res.data.message || "Failed to fetch subjects.");
        setSubjects([]);
      }
    } catch (err) {
      if (handleUnauthorized(err)) return;
      setError(
        err.response?.data?.message || err.message || "Failed to fetch subjects."
      );
      setSubjects([]);
    } finally {
      setLoadingSubjects(false);
    }
  }

  // ---------- Select subject and load students ----------
  async function handleSelectSubject(subj, examParam) {
    setError("");
    setSuccess("");
    setSelectedSubject(subj);
    setStudents([]);
    setCategory("");
    setMarkRows({});

    const examToUse = examParam || internalExam;

    try {
      setLoadingStudents(true);
      const params = new URLSearchParams({
        department,
        year,
        semester,
        academicYear,
        subjectId: subj._id,
        internalExam: examToUse,
      });

      const res = await api.get(`/api/mark/students?${params.toString()}`);
      if (res.data.success) {
        const data = res.data.data || {};
        const studentsList = data.students || [];
        const existingMarks = data.existingMarks || {};

        setCategory(data.category || subj.Category || "");
        setAllowedComponents(data.allowedComponents || []);
        setStudents(studentsList);

        const initialRows = {};
        let filledCount = 0;

        studentsList.forEach((student) => {
          const prev = existingMarks[student._id] || {};
          const hasPrev =
            (prev.assignment !== undefined && prev.assignment !== null && prev.assignment !== "") ||
            (prev.writtenExam !== undefined && prev.writtenExam !== null && prev.writtenExam !== "") ||
            (prev.practical !== undefined && prev.practical !== null && prev.practical !== "");

          if (hasPrev) filledCount++;

          initialRows[student._id] = {
            selected: true,
            assignment:
              prev.assignment !== undefined && prev.assignment !== null && prev.assignment !== ""
                ? String(prev.assignment)
                : "",
            writtenExam:
              prev.writtenExam !== undefined && prev.writtenExam !== null && prev.writtenExam !== ""
                ? String(prev.writtenExam)
                : "",
            practical:
              prev.practical !== undefined && prev.practical !== null && prev.practical !== ""
                ? String(prev.practical)
                : "",
          };
        });
        setMarkRows(initialRows);

        if (studentsList.length === 0) {
          setSuccess("No active students found in this department and semester.");
        } else if (filledCount > 0) {
          setSuccess(`Loaded previously entered marks for ${filledCount} student(s).`);
        }
      } else {
        setError(res.data.message || "Failed to load students.");
        setStudents([]);
      }
    } catch (err) {
      if (handleUnauthorized(err)) return;
      setError(
        err.response?.data?.message || err.message || "Failed to load students."
      );
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }

  // Reload students & marks when internalExam changes
  useEffect(() => {
    if (selectedSubject) {
      handleSelectSubject(selectedSubject, internalExam);
    }
  }, [internalExam]);

  function toggleStudent(studentId) {
    setMarkRows((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        selected: !prev[studentId]?.selected,
      },
    }));
  }

  function toggleSelectAll() {
    const allSelected = students.length > 0 && students.every((s) => markRows[s._id]?.selected);
    setMarkRows((prev) => {
      const next = { ...prev };
      students.forEach((s) => {
        next[s._id] = { ...next[s._id], selected: !allSelected };
      });
      return next;
    });
  }

  function getTheoryTotal(row) {
    const assignment = Number(row?.assignment || 0);
    const written = Number(row?.writtenExam || 0);
    return assignment + written;
  }

  // ---------- Save marks ----------
  async function handleSave() {
    setError("");
    setSuccess("");

    if (!selectedSubject) {
      setError("Please select a subject.");
      return;
    }

    if (selectedCount === 0) {
      setError("Select at least one student to save marks.");
      return;
    }

    // Validate theory totals
    if (allowedComponents.includes("theory")) {
      for (const student of students) {
        const row = markRows[student._id];
        if (!row?.selected) continue;

        const assign = Number(row.assignment || 0);
        const written = Number(row.writtenExam || 0);

        if (isNaN(assign) || assign < 0 || assign > 100) {
          setError(`Assignment must be between 0 and 100 for ${student.register_no || student.student_id}.`);
          return;
        }
        if (isNaN(written) || written < 0 || written > 100) {
          setError(`Written Exam must be between 0 and 100 for ${student.register_no || student.student_id}.`);
          return;
        }

        const total = getTheoryTotal(row);
        if (total > 100) {
          setError(
            `Internal theory mark cannot exceed 100. Check ${student.register_no || student.student_id
            } (total: ${total}).`
          );
          return;
        }
      }
    }

    // Validate practical
    if (allowedComponents.includes("practical")) {
      for (const student of students) {
        const row = markRows[student._id];
        if (!row?.selected) continue;
        const practical = Number(row.practical || 0);
        if (isNaN(practical) || practical < 0 || practical > 100) {
          setError(
            `Practical mark must be between 0 and 100 for ${student.register_no || student.student_id
            }.`
          );
          return;
        }
      }
    }

    const studentsPayload = students
      .filter((student) => markRows[student._id]?.selected)
      .map((student) => {
        const row = markRows[student._id] || {};
        const payload = {
          studentId: student._id,
        };

        if (allowedComponents.includes("theory")) {
          payload.assignment = Number(row.assignment) || 0;
          payload.writtenExam = Number(row.writtenExam) || 0;
        }

        if (allowedComponents.includes("practical")) {
          payload.practical = Number(row.practical) || 0;
        }

        return payload;
      });

    try {
      setSaving(true);
      const res = await api.post("/api/mark", {
        department,
        year,
        semester,
        academicYear,
        subjectId: selectedSubject._id,
        internalExam: Number(internalExam),
        students: studentsPayload,
      });

      if (res.data.success) {
        setSuccess(
          `Marks saved successfully. ${
            res.data.data?.savedCount ?? studentsPayload.length
          } records saved.`
        );
        setSelectedSubject(null);
        setStudents([]);
        setCategory("");
        setMarkRows({});
      } else {
        setError(res.data.message || "Failed to save marks.");
      }
    } catch (err) {
      if (handleUnauthorized(err)) return;
      setError(
        err.response?.data?.message || err.message || "Failed to save marks."
      );
    } finally {
      setSaving(false);
    }
  }

  function renderMarkInputs() {
    if (!students.length || !category) return null;

    const allSelected =
      students.length > 0 && students.every((s) => markRows[s._id]?.selected);

    return (
      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <div>
            <h3>
              {selectedSubject?.subjectCode} — {selectedSubject?.subjectName}
            </h3>
            <p>
              Internal Exam {internalExam} • Category {category}
            </p>
          </div>
          <div className={styles.selectionSummary}>
            {selectedCount} / {students.length} selected
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.markTable}>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>Register No</th>
                <th>Student Name</th>
                {allowedComponents.includes("theory") && (
                  <>
                    <th>Assignment (/100)</th>
                    <th>Written Exam (/100)</th>
                    <th>Total /100</th>
                  </>
                )}
                {allowedComponents.includes("practical") && (
                  <th>Practical /100</th>
                )}
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const row = markRows[student._id] || {};
                const theoryTotal = getTheoryTotal(row);
                const theoryError = theoryTotal > 100;

                return (
                  <tr key={student._id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={!!row.selected}
                        onChange={() => toggleStudent(student._id)}
                      />
                    </td>
                    <td>{student.register_no || student.student_id}</td>
                    <td>
                      {student.first_name} {student.last_name}
                    </td>

                    {allowedComponents.includes("theory") && (
                      <>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="0"
                            value={row.assignment}
                            disabled={!row.selected}
                            onChange={(e) =>
                              updateRow(
                                student._id,
                                "assignment",
                                e.target.value
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            placeholder="0"
                            value={row.writtenExam}
                            disabled={!row.selected}
                            onChange={(e) =>
                              updateRow(
                                student._id,
                                "writtenExam",
                                e.target.value
                              )
                            }
                          />
                        </td>
                        <td className={theoryError ? styles.errorCell : styles.totalCell}>
                          {theoryTotal}
                        </td>
                      </>
                    )}

                    {allowedComponents.includes("practical") && (
                      <td>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="0"
                          value={row.practical}
                          disabled={!row.selected}
                          onChange={(e) =>
                            updateRow(
                              student._id,
                              "practical",
                              e.target.value
                            )
                          }
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className={styles.saveRow}>
          <button
            className={styles.btnPrimary}
            onClick={handleSave}
            disabled={saving || selectedCount === 0}
          >
            {saving ? (
              <span className="btn-loading">
                <Loader2 size={15} className="spin-icon" /> Saving Marks...
              </span>
            ) : (
              `Save Marks (${selectedCount})`
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>Internal Mark Entry</h1>
        <p className={styles.subtitle}>
          Enter Internal Exam 1 or Internal Exam 2 marks for assigned subjects.
        </p>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <span>{error}</span>
          <button className={styles.toastCloseBtn} onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}
      {success && (
        <div className={styles.successBanner}>
          <span>{success}</span>
          <button className={styles.toastCloseBtn} onClick={() => setSuccess("")}>
            ×
          </button>
        </div>
      )}

      <div className={styles.filterCard}>
        <div className={styles.filterGrid}>
          <div className={styles.field}>
            <label>Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              disabled={departmentsLoading}
            >
              <option value="">Select Department</option>
              {departments.map((dept) => (
                <option key={dept._id || dept.code} value={dept.code || dept.name}>
                  {dept.name || dept.code} ({dept.code})
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label>Year</label>
            <select value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">Select Year</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  Year {y}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label>Semester</label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
            >
              <option value="">Select Semester</option>
              {semesterOptions.map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label>Academic Year</label>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
            >
              <option value="">Select Academic Year</option>
              {academicYearOptions.map((ay) => (
                <option key={ay} value={ay}>
                  {ay}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label>Internal Exam</label>
            <select
              value={internalExam}
              onChange={(e) => setInternalExam(e.target.value)}
            >
              {examOptions.map((exam) => (
                <option key={exam} value={exam}>
                  Internal Exam {exam}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.filterActions}>
          <button
            className={styles.btnSearch}
            onClick={handleSearchSubjects}
            disabled={loadingSubjects}
          >
            {loadingSubjects ? "Loading..." : "Search Subjects"}
          </button>
        </div>
      </div>

      {subjects.length > 0 && (
        <div className={styles.subjectSelectionArea}>
          <h2 className={styles.sectionHeading}>Assigned Subjects</h2>
          <div className={styles.subjectCardGrid}>
            {subjects.map((subj) => (
              <button
                key={subj._id}
                className={`${styles.subjectCard} ${selectedSubject?._id === subj._id ? styles.subjectCardActive : ""
                  }`}
                onClick={() => handleSelectSubject(subj)}
              >
                <span className={styles.subjectCode}>{subj.subjectCode}</span>
                <span className={styles.subjectName}>{subj.subjectName}</span>
                <span className={styles.subjectCategory}>
                  Category: {subj.Category}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {loadingStudents && (
        <div className={styles.loadingBox}>Loading student list...</div>
      )}

      {renderMarkInputs()}
    </div>
  );
}
