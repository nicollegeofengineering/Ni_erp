"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import styles from "./timetable.module.css";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function TimetablePage() {
  const router = useRouter();

  // ---------- HOD department ----------
  const [hodDepartment, setHodDepartment] = useState("");

  // ---------- STATE ----------
  const [academicYear, setAcademicYear] = useState("2026-2027");
  const [semesterType, setSemesterType] = useState("ODD");
  const [wef, setWef] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingKey, setDeletingKey] = useState(null);

  // Master data
  const [departments, setDepartments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [hallList, setHallList] = useState([]);

  // Timetable entries
  const [entries, setEntries] = useState({});

  // Popup state
  const [popup, setPopup] = useState(null);
  const popupInputRef = useRef(null);
  const pdfContainerRef = useRef(null);

  // ---------- CONSTANTS ----------
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const dayMap = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5 };
  const years = [
    { label: "I", value: 1 },
    { label: "II", value: 2 },
    { label: "III", value: 3 },
    { label: "IV", value: 4 },
  ];

  const periodColumns = [
    { label: "P1", period: 1, type: "period" },
    { label: "P2", period: 2, type: "period" },
    { label: "Break", period: null, type: "break" },
    { label: "P3", period: 3, type: "period" },
    { label: "P4", period: 4, type: "period" },
    { label: "Lunch", period: null, type: "break" },
    { label: "P5", period: 5, type: "period" },
    { label: "P6", period: 6, type: "period" },
    { label: "Break", period: null, type: "break" },
    { label: "P7", period: 7, type: "period" },
  ];

  const semesterNum = semesterType === "ODD" ? 1 : 2;

  // ---------- HELPERS ----------
  const getSubjectCode = (s) => s?.subjectCode || "";
  const getSubjectName = (s) => s?.subjectName || "";
  const getSubjectCategory = (s) => s?.Category || s?.category || "";
  const getStaffCode = (s) => s?.staff_code || "";
  const getStaffName = (s) => {
    if (!s) return "";
    const { prefix = "", first_name = "", last_name = "" } = s;
    return `${prefix} ${first_name} ${last_name}`.trim().replace(/\s+/g, " ");
  };
  const getFacultyId = (s) => s?.staff_id || "";
  const getHallCode = (h) => h?.hallCode || h?.hallName || "";
  const getHallName = (h) => h?.hallName || "";

  const isLabSubject = (subject) => {
    const cat = getSubjectCategory(subject).toUpperCase();
    return cat === "LAB" || cat === "PRACTICAL";
  };

  // ---------- Helper: redirect on unauthorized (islogout) ----------
  const handleUnauthorized = (error) => {
    if (error.response?.data?.islogout === true) {
      router.push("/");
      return true;
    }
    return false;
  };

  // ---------- Axios instance (baseURL + withCredentials) ----------
  const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_BACKEND_URL + "/api",
    withCredentials: true,
  });

  // ---------- Fetch HOD department ----------
  const fetchHodDepartment = async () => {
    try {
      const res = await api.get("/hod/staff/hoddep");
      const dept = res.data?.department_code;
      if (dept) {
        setHodDepartment(dept);
        console.log("HOD Department:", dept);
      } else {
        console.error("Department not found");
      }
    } catch (err) {
      if (handleUnauthorized(err)) return;
      console.error("Error fetching HOD department:", err);
    }
  };

  useEffect(() => {
    fetchHodDepartment();
  }, []);

  // ---------- AUTO SET ACADEMIC YEAR ----------
  useEffect(() => {
    const currentYear = new Date().getFullYear();
    setAcademicYear(`${currentYear}-${currentYear + 1}`);
  }, []);

  // ---------- FETCH MASTER DATA ----------
  useEffect(() => {
    const fetchAll = async () => {
      try {
        // HOD can also fetch these master lists (permissions may be adjusted later)
        const [staffRes, hallRes, subRes] = await Promise.all([
          api.get("/admin/staff/all", { params: { limit: 1000 } }),
          api.get("/admin/hall/all", { params: { limit: 1000 } }),
          api.get("/admin/subject/all", { params: { limit: 1000 } }),
        ]);

        const staffData = staffRes.data.data || [];
        const uniqueDepts = new Map();
        staffData.forEach((staff) => {
          const code = staff.department_code;
          if (code && !uniqueDepts.has(code)) {
            uniqueDepts.set(code, {
              departmentCode: code,
              _id: code,
            });
          }
        });
        const depts = Array.from(uniqueDepts.values());

        setDepartments(depts);
        setSubjects(subRes.data.data || []);
        setStaffList(staffData);
        setHallList(hallRes.data.data || []);
      } catch (err) {
        if (handleUnauthorized(err)) return;
        console.error("Failed to fetch master data:", err);
      }
    };
    fetchAll();

    const today = new Date();
    setWef(today.toISOString().split("T")[0]);
  }, []);

  // ---------- BUILD BRANCHES ----------
  const branches = useMemo(() => {
    return departments.flatMap((dept) =>
      years.map((y) => ({
        label: `${dept.departmentCode} ${y.label}`,
        departmentCode: dept.departmentCode,
        year: y.value,
        _id: dept._id,
      }))
    );
  }, [departments]);

  // ---------- LOAD TIMETABLE (HOD endpoint) ----------
  useEffect(() => {
    if (!academicYear || branches.length === 0) {
      if (branches.length > 0 && !academicYear) setLoading(false);
      return;
    }

    const loadTimetable = async () => {
      setLoading(true);
      try {
        // Use HOD endpoint to fetch all timetable (may include all departments)
        const res = await api.get("/admin/timetable/all", { params: { academicYear } });
        const data = res.data.data || [];

        const newEntries = {};
        data.forEach((item) => {
          const deptCode = item.department;
          const yearVal = item.year;
          const dayNum = item.day;
          const periodNum = item.period;

          if (dayNum < 1 || dayNum > 5) return;

          const key = `${deptCode}__${yearVal}__${dayNum}__${periodNum}`;
          newEntries[key] = {
            subject: item.subject || null,
            staff: item.staff || null,
            hall: item.hall || null,
            status: "idle",
            errorMsg: null,
          };
        });

        setEntries(newEntries);
      } catch (err) {
        if (handleUnauthorized(err)) return;
        console.error("Failed to load timetable:", err);
      } finally {
        setLoading(false);
      }
    };

    loadTimetable();
  }, [academicYear, branches]);

  // ---------- SAVE ENTRY (HOD endpoint) ----------
  const saveEntry = async (entryKey, dayNum, branch, periodNum, subject, staff, hall) => {
    // Only allow if branch is editable
    if (!isEditable(branch)) {
      alert("You are not allowed to modify this department.");
      return;
    }

    const payload = {
      academicYear,
      department: branch.departmentCode,
      year: branch.year,
      semester: semesterNum,
      day: dayNum,
      period: periodNum,
      subject: subject?._id || null,
      staff: staff?._id || null,
      hall: hall?._id || null,
    };

    setEntries((prev) => ({
      ...prev,
      [entryKey]: { ...prev[entryKey], status: "saving", errorMsg: null },
    }));

    try {
      await api.put("/admin/timetable/upsert", payload);
      setEntries((prev) => ({
        ...prev,
        [entryKey]: {
          subject,
          staff,
          hall,
          status: "success",
          errorMsg: null,
        },
      }));
      setTimeout(() => {
        setEntries((prev) => ({
          ...prev,
          [entryKey]: { ...prev[entryKey], status: "idle" },
        }));
      }, 1500);
    } catch (err) {
      if (handleUnauthorized(err)) return;
      const msg =
        err.response?.status === 409
          ? err.response?.data?.message || "Conflict: slot already taken"
          : "Failed to save";
      setEntries((prev) => ({
        ...prev,
        [entryKey]: { ...prev[entryKey], status: "error", errorMsg: msg },
      }));
    }
  };

  // ---------- HANDLE CELL UPDATE ----------
  const attemptUpdate = (entryKey, dayNum, branch, periodNum, newSubject, newStaff, newHall) => {
    if (!isEditable(branch)) {
      alert("You cannot edit this department.");
      return;
    }

    const prev = entries[entryKey] || {};
    const subject = newSubject !== undefined ? newSubject : prev.subject;
    const staff = newStaff !== undefined ? newStaff : prev.staff;
    const hall = newHall !== undefined ? newHall : prev.hall;

    if (subject && isLabSubject(subject) && !hall) {
      alert("Please select a computer hall for this lab period.");
      return;
    }

    setEntries((prev) => ({
      ...prev,
      [entryKey]: { ...prev[entryKey], subject, staff, hall, status: "idle", errorMsg: null },
    }));

    if (subject && staff) {
      saveEntry(entryKey, dayNum, branch, periodNum, subject, staff, hall);
    }
  };

  // ---------- DELETE HANDLERS (HOD endpoints) ----------
  const handleDeleteCell = async (dayNum, branch, periodNum, entryKey) => {
    if (!isEditable(branch)) {
      alert("You cannot delete this department.");
      return;
    }

    const confirmDelete = window.confirm(
      `Clear this slot (${branch.label}, ${days[dayNum - 1]}, Period ${periodNum})?`
    );
    if (!confirmDelete) return;

    setDeletingKey(entryKey);
    try {
      await api.delete("/admin/timetable/cell", {
        params: {
          academicYear,
          department: branch.departmentCode,
          year: branch.year,
          semester: semesterNum,
          day: dayNum,
          period: periodNum,
        },
      });
      setEntries((prev) => {
        const next = { ...prev };
        delete next[entryKey];
        return next;
      });
    } catch (err) {
      if (handleUnauthorized(err)) return;
      alert(`Failed to clear slot: ${err.response?.data?.message || err.message}`);
    } finally {
      setDeletingKey(null);
    }
  };

  const handleDeleteRow = async (dayNum, branch) => {
    if (!isEditable(branch)) {
      alert("You cannot delete this department.");
      return;
    }

    const confirmDelete = window.confirm(
      `Clear the WHOLE ${days[dayNum - 1]} row for ${branch.label}?`
    );
    if (!confirmDelete) return;

    const rowKey = `${branch.departmentCode}__${branch.year}__${dayNum}`;
    setDeletingKey(rowKey);
    try {
      await api.delete("/admin/timetable/row", {
        params: {
          academicYear,
          department: branch.departmentCode,
          year: branch.year,
          semester: semesterNum,
          day: dayNum,
        },
      });
      setEntries((prev) => {
        const next = { ...prev };
        periodColumns.forEach((col) => {
          if (col.type !== "period") return;
          const key = `${branch.departmentCode}__${branch.year}__${dayNum}__${col.period}`;
          delete next[key];
        });
        return next;
      });
    } catch (err) {
      if (handleUnauthorized(err)) return;
      alert(`Failed to clear row: ${err.response?.data?.message || err.message}`);
    } finally {
      setDeletingKey(null);
    }
  };

  const handleDeleteClass = async (branch) => {
    if (!isEditable(branch)) {
      alert("You cannot delete this department.");
      return;
    }

    const classKey = `${branch.departmentCode}__${branch.year}`;
    const confirmDelete = window.confirm(
      `⚠️ Delete the FULL timetable for ${branch.label} (${semesterType} sem, ${academicYear})?`
    );
    if (!confirmDelete) return;

    setDeletingKey(classKey);
    try {
      await api.delete("/admin/timetable/class", {
        params: {
          academicYear,
          department: branch.departmentCode,
          year: branch.year,
          semester: semesterNum,
        },
      });
      setEntries((prev) => {
        const next = {};
        Object.entries(prev).forEach(([key, val]) => {
          if (!key.startsWith(`${branch.departmentCode}__${branch.year}__`)) {
            next[key] = val;
          }
        });
        return next;
      });
    } catch (err) {
      if (handleUnauthorized(err)) return;
      alert(`Failed to delete class timetable: ${err.response?.data?.message || err.message}`);
    } finally {
      setDeletingKey(null);
    }
  };

  // ---------- POPUP HANDLERS ----------
  const openPopup = (e, type, dayNum, branch, periodNum, entryKey) => {
    // Only allow popup for editable branches
    if (!isEditable(branch)) return;

    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const { x, y } = getAdjustedPosition(rect);
    setPopup({
      type,
      dayNum,
      branch,
      periodNum,
      entryKey,
      x,
      y,
      search: "",
    });
    setTimeout(() => popupInputRef.current?.focus(), 50);
  };

  const getAdjustedPosition = (rect, popupWidth = 220, popupHeight = 250) => {
    let x = rect.left;
    let y = rect.bottom + window.scrollY + 2;
    if (x + popupWidth > window.innerWidth) {
      x = window.innerWidth - popupWidth - 5;
    }
    if (x < 0) x = 5;
    if (y + popupHeight > window.innerHeight + window.scrollY) {
      y = rect.top + window.scrollY - popupHeight - 2;
    }
    if (y < 0) y = 5;
    return { x, y };
  };

  const closePopup = () => setPopup(null);

  // ---------- POPUP SELECTION HANDLERS ----------
  const handleSelectSubject = (subject) => {
    if (!popup) return;
    const { dayNum, branch, periodNum, entryKey } = popup;
    closePopup();
    attemptUpdate(entryKey, dayNum, branch, periodNum, subject, undefined, undefined);
  };

  const handleSelectStaff = (staff) => {
    if (!popup) return;
    const { dayNum, branch, periodNum, entryKey } = popup;
    closePopup();
    attemptUpdate(entryKey, dayNum, branch, periodNum, undefined, staff, undefined);
  };

  const handleSelectHall = (hall) => {
    if (!popup) return;
    const { dayNum, branch, periodNum, entryKey } = popup;
    closePopup();
    attemptUpdate(entryKey, dayNum, branch, periodNum, undefined, undefined, hall);
  };

  // ... (popup handlers unchanged, they call attemptUpdate which already checks isEditable)

  // ---------- FILTER FUNCTIONS (unchanged) ----------
  const filterSubjects = (query) => {
    if (!query) return subjects;
    const q = query.toUpperCase();
    return subjects.filter(
      (s) =>
        getSubjectCode(s).toUpperCase().includes(q) ||
        getSubjectName(s).toUpperCase().includes(q)
    );
  };

  const filterStaff = (query, dayNum, periodNum, currentKey, currentSubjectId) => {
    const assignedStaffIds = new Set();
    Object.entries(entries).forEach(([key, val]) => {
      if (key === currentKey) return;
      const parts = key.split("__");
      const keyDay = parseInt(parts[2]);
      const keyPeriod = parseInt(parts[3]);
      if (keyDay === dayNum && keyPeriod === periodNum && val.staff) {
        const sameSubject = currentSubjectId && val.subject && val.subject._id === currentSubjectId;
        if (!sameSubject) {
          assignedStaffIds.add(val.staff._id);
        }
      }
    });

    let list = staffList.filter((s) => !assignedStaffIds.has(s._id));
    if (!query) return list;
    const q = query.toUpperCase();
    return list.filter(
      (s) =>
        getStaffCode(s).toUpperCase().includes(q) ||
        getStaffName(s).toUpperCase().includes(q)
    );
  };

  const filterHalls = (query, dayNum, periodNum, currentKey) => {
    const assignedHallIds = new Set();
    const currentEntry = entries[currentKey] || {};
    const currentSubjectId = currentEntry.subject?._id;

    Object.entries(entries).forEach(([key, val]) => {
      if (key === currentKey) return;
      const parts = key.split("__");
      const keyDay = parseInt(parts[2]);
      const keyPeriod = parseInt(parts[3]);
      if (keyDay === dayNum && keyPeriod === periodNum && val.hall) {
        const otherSubjectId = val.subject?._id;
        const sameSubject = currentSubjectId && otherSubjectId && currentSubjectId === otherSubjectId;
        if (!sameSubject) {
          assignedHallIds.add(val.hall._id);
        }
      }
    });

    let list = hallList.filter((h) => !assignedHallIds.has(h._id));
    if (!query) return list;
    const q = query.toUpperCase();
    return list.filter(
      (h) =>
        getHallCode(h).toUpperCase().includes(q) ||
        getHallName(h).toUpperCase().includes(q)
    );
  };

  // ---------- SUBJECT REFERENCE ----------
  const referenceRows = useMemo(() => {
    const map = new Map();
    Object.values(entries).forEach((entry) => {
      if (entry.subject && entry.staff) {
        const key = `${entry.subject._id}__${entry.staff._id}`;
        if (!map.has(key)) {
          map.set(key, {
            subjectCode: getSubjectCode(entry.subject),
            subjectName: getSubjectName(entry.subject),
            category: getSubjectCategory(entry.subject),
            staffName: getStaffName(entry.staff),
            staffCode: getStaffCode(entry.staff),
            facultyId: getFacultyId(entry.staff),
          });
        }
      }
    });
    return Array.from(map.values());
  }, [entries]);

  // ---------- PDF EXPORT (unchanged) ----------
  const handleDownloadPdf = async () => {
    // ... (same as before)
  };

  // ---------- CHECK IF BRANCH IS EDITABLE ----------
  const isEditable = (branch) => {
    return hodDepartment && branch.departmentCode === hodDepartment;
  };

  // ---------- RENDER ----------
  return (
    <div className={styles.mcontainer}>
      {/* Action Buttons Bar */}
      <div className={styles.hbutton}>
        <select
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
          className={styles.filterSelect}
        >
          {useMemo(() => {
            const currentYear = new Date().getFullYear();
            const options = [];
            for (let i = -1; i <= 1; i++) {
              const start = currentYear + i;
              const end = start + 1;
              const label = `${start}-${end}`;
              options.push(
                <option key={label} value={label}>
                  {label}
                </option>
              );
            }
            return options;
          }, [])}
        </select>

        <select
          value={semesterType}
          onChange={(e) => setSemesterType(e.target.value)}
          className={styles.filterSelect}
        >
          <option value="ODD">ODD</option>
          <option value="EVEN">EVEN</option>
        </select>

        <button onClick={handleDownloadPdf} className={styles.pbutton}>
          EXPORT PDF
        </button>
      </div>

      {/* Show managed department */}
      {hodDepartment && (
        <div style={{ marginBottom: "10px", fontSize: "16px", fontWeight: "bold", color: "#1a2a4a" }}>
          Managing Department: <span style={{ color: "#2b7be4" }}>{hodDepartment}</span>
        </div>
      )}

      <div className={styles.container} ref={pdfContainerRef}>
        {/* Header, title, wef... (unchanged) */}
        <div className={styles.header}>
          <img src="/nilogo.png" alt="College Logo" width="700" height="104.3" />
        </div>
        <div className={styles.headtop}>
          <h3>MASTER TIMETABLE</h3>
          <span> {"("}</span>
          <p>{academicYear}</p>
          <span>{")-("}</span>
          <p>{semesterType}</p>
          <span>{")"}</span>
        </div>
        <div className={styles.headbottom}>
          <div className={styles.wef}>
            <p>w.e.f:</p>
            <input type="date" value={wef} onChange={(e) => setWef(e.target.value)} />
          </div>
        </div>

        {/* ===== MASTER TIMETABLE ===== */}
        <div className={styles.mtWrapper}>
          <table className={styles.mtTable}>
            <thead>
              <tr>
                <th className={styles.mtDayHead}>Day</th>
                <th className={styles.mtBranchHead}>Branch</th>
                {periodColumns.map((col, idx) => (
                  <th key={`${col.label}-${idx}`}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={2 + periodColumns.length} className={styles.mtLoadingCell}>
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && branches.length === 0 && (
                <tr>
                  <td colSpan={2 + periodColumns.length} className={styles.mtLoadingCell}>
                    No departments found.
                  </td>
                </tr>
              )}
              {!loading && branches.length > 0 && academicYear === "" && (
                <tr>
                  <td colSpan={2 + periodColumns.length} className={styles.mtLoadingCell}>
                    Please enter an Academic Year.
                  </td>
                </tr>
              )}

              {!loading &&
                branches.length > 0 &&
                academicYear !== "" &&
                days.map((day) => {
                  const dayNum = dayMap[day];
                  return branches.map((branch, idx) => {
                    const editable = isEditable(branch);
                    const classKey = `${branch.departmentCode}__${branch.year}`;
                    const rowClass = editable ? styles.editableRow : styles.readOnlyRow;

                    return (
                      <tr key={`${day}-${branch.label}`} className={rowClass}>
                        {idx === 0 && (
                          <td rowSpan={branches.length} className={styles.mtDayCell}>
                            {day}
                          </td>
                        )}
                        <td className={styles.mtBranchCell}>
                          {branch.label}
                          {editable && (
                            <span
                              className={styles.deleteIcon}
                              title={`Delete full timetable for ${branch.label}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClass(branch);
                              }}
                              style={{
                                cursor: "pointer",
                                color: "#f44336",
                                fontSize: "9px",
                                opacity: deletingKey === classKey ? 0.4 : 1,
                              }}
                            >
                              🗑
                            </span>
                          )}
                        </td>

                        {periodColumns.map((col, idx) => {
                          if (col.type !== "period") {
                            return (
                              <td key={`${col.label}-${idx}`} className={styles.mtBreakCell}>
                                &nbsp;
                              </td>
                            );
                          }

                          const entryKey = `${branch.departmentCode}__${branch.year}__${dayNum}__${col.period}`;
                          const entry = entries[entryKey] || {};
                          const { subject, staff, hall, status, errorMsg } = entry;
                          const isLab = subject ? isLabSubject(subject) : false;

                          return (
                            <td
                              key={`${col.label}-${idx}`}
                              className={`${styles.mtPeriodCell} ${
                                status === "error" ? styles.mtCellError : ""
                              } ${!editable ? styles.readOnlyCell : ""}`}
                              style={{
                                opacity: editable ? 1 : 0.65,
                                cursor: editable ? "pointer" : "default",
                              }}
                            >
                              <div className={styles.mtPeriodBox}>
                                {/* Subject selector */}
                                <span
                                  className={styles.mtSubjectCode}
                                  onClick={(e) => {
                                    if (!editable) return;
                                    openPopup(e, "subject", dayNum, branch, col.period, entryKey);
                                  }}
                                  style={{ cursor: editable ? "pointer" : "default" }}
                                >
                                  {subject ? getSubjectCode(subject) : editable ? "+" : "-"}
                                </span>
                                {/* Staff selector */}
                                <span
                                  className={styles.mtStaffCode}
                                  onClick={(e) => {
                                    if (!editable) return;
                                    openPopup(e, "staff", dayNum, branch, col.period, entryKey);
                                  }}
                                  style={{ cursor: editable ? "pointer" : "default" }}
                                >
                                  {staff ? getStaffCode(staff) : editable ? "+" : "-"}
                                </span>
                                {/* Hall selector */}
                                <span
                                  className={styles.mtHallCode}
                                  onClick={(e) => {
                                    if (!editable) return;
                                    openPopup(e, "hall", dayNum, branch, col.period, entryKey);
                                  }}
                                  style={{
                                    cursor: editable ? "pointer" : "default",
                                    fontSize: "10px",
                                    color: hall ? "#1976d2" : (isLab ? "#f44336" : "#888"),
                                    fontWeight: "bold",
                                    marginLeft: "4px",
                                  }}
                                  title={isLab && !hall ? "Lab requires a hall" : "Select hall"}
                                >
                                  {hall ? getHallName(hall) : editable ? "+" : "-"}
                                </span>
                                {status === "success" && (
                                  <span className={styles.mtSuccessTick}>✓</span>
                                )}
                                {status === "error" && (
                                  <span className={styles.mtErrorMsg}>{errorMsg}</span>
                                )}
                                {isLab && !hall && editable && (
                                  <span className={styles.mtHallWarning} style={{ color: "#f44336", fontSize: "8px", display: "block" }}>
                                    ⚠ Hall req.
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  });
                })}
            </tbody>
          </table>
        </div>

        {/* ===== SUBJECT REFERENCE (unchanged) ===== */}
        <div className={styles.srWrapper}>
          <table className={styles.srTable}>
            <thead>
              <tr>
                <th>Subject Code</th>
                <th>Subject Name</th>
                <th>Category</th>
                <th>Staff Name</th>
                <th>Staff Code</th>
                <th>Faculty ID</th>
              </tr>
            </thead>
            <tbody>
              {referenceRows.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center", color: "#888" }}>
                    No entries yet
                  </td>
                </tr>
              ) : (
                referenceRows.map((row, idx) => (
                  <tr key={idx}>
                    <td>{row.subjectCode}</td>
                    <td className={styles.leftAlign}>{row.subjectName}</td>
                    <td>{row.category}</td>
                    <td className={styles.leftAlign}>{row.staffName}</td>
                    <td>{row.staffCode}</td>
                    <td>{row.facultyId}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Signatures */}
        <div className={styles.sign}>
          <p>HOD</p>
          <p>PRINCIPAL</p>
        </div>
      </div>

      {/* ===== POPUP ===== */}
      {popup && (
        <div className={styles.mtPopupOverlay} onClick={closePopup}>
          <div
            className={styles.mtPopup}
            style={{ top: popup.y, left: popup.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={popupInputRef}
              type="text"
              className={styles.mtPopupSearch}
              placeholder={
                popup.type === "subject"
                  ? "Search subject code / name"
                  : popup.type === "staff"
                  ? "Search staff code / name"
                  : "Search hall code / name"
              }
              value={popup.search}
              onChange={(e) => setPopup((prev) => ({ ...prev, search: e.target.value }))}
            />
            <div className={styles.mtPopupList}>
              {popup.type === "subject" &&
                filterSubjects(popup.search).map((s) => (
                  <div key={s._id} className={styles.mtPopupItem} onClick={() => handleSelectSubject(s)}>
                    <span className={styles.mtPopupItemCode}>{getSubjectCode(s)}</span>
                    <span className={styles.mtPopupItemName}>{getSubjectName(s)}</span>
                  </div>
                ))}

              {popup.type === "staff" &&
                filterStaff(
                  popup.search,
                  popup.dayNum,
                  popup.periodNum,
                  popup.entryKey,
                  entries[popup.entryKey]?.subject?._id
                ).map((s) => (
                  <div key={s._id} className={styles.mtPopupItem} onClick={() => handleSelectStaff(s)}>
                    <span className={styles.mtPopupItemCode}>{getStaffCode(s)}</span>
                    <span className={styles.mtPopupItemName}>{getStaffName(s)}</span>
                  </div>
                ))}

              {popup.type === "hall" &&
                filterHalls(
                  popup.search,
                  popup.dayNum,
                  popup.periodNum,
                  popup.entryKey
                ).map((h) => (
                  <div key={h._id} className={styles.mtPopupItem} onClick={() => handleSelectHall(h)}>
                    <span className={styles.mtPopupItemCode}>{getHallCode(h)}</span>
                    <span className={styles.mtPopupItemName}>{getHallName(h)}</span>
                  </div>
                ))}

              {popup.type === "subject" && filterSubjects(popup.search).length === 0 && (
                <div className={styles.mtPopupEmpty}>No subjects found</div>
              )}
              {popup.type === "staff" &&
                filterStaff(
                  popup.search,
                  popup.dayNum,
                  popup.periodNum,
                  popup.entryKey,
                  entries[popup.entryKey]?.subject?._id
                ).length === 0 && (
                  <div className={styles.mtPopupEmpty}>No available staff</div>
                )}
              {popup.type === "hall" &&
                filterHalls(popup.search, popup.dayNum, popup.periodNum, popup.entryKey).length === 0 && (
                  <div className={styles.mtPopupEmpty}>No available halls</div>
                )}
            </div>

            {/* Clear slot option – only show if editable */}
            {(popup.type === "subject" || popup.type === "staff") &&
              isEditable(popup.branch) &&
              (entries[popup.entryKey]?.subject || entries[popup.entryKey]?.staff) && (
                <div
                  className={styles.mtPopupItem}
                  style={{ justifyContent: "center", color: "#f44336", fontWeight: "bold" }}
                  onClick={() => {
                    const { dayNum, branch, periodNum, entryKey } = popup;
                    closePopup();
                    handleDeleteCell(dayNum, branch, periodNum, entryKey);
                  }}
                >
                  ✕ Clear this slot
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
}