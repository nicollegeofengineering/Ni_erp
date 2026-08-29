"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import {
  BookOpen,
  CalendarRange,
  Clock,
  Building,
  User,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronDown,
} from "lucide-react";
import styles from "./StaffAssignedView.module.css";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  withCredentials: true,
});

const PERIOD_TIMINGS = {
  1: "09:45 - 10:30",
  2: "10:30 - 11:15",
  3: "11:30 - 12:15",
  4: "12:15 - 13:00",
  5: "13:35 - 14:20",
  6: "14:20 - 15:05",
  7: "15:05 - 16:00",
};

const DAY_NAMES = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

const SHORT_DAY_NAMES = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

const YEAR_NAMES = {
  1: "1st Year",
  2: "2nd Year",
  3: "3rd Year",
  4: "4th Year",
};

function getDefaultAcademicYear() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const startYear = now.getMonth() >= 5 ? currentYear : currentYear - 1;
  return `${startYear}-${startYear + 1}`;
}

function getAcademicYearOptions(currentVal) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const startYear = now.getMonth() >= 5 ? currentYear : currentYear - 1;
  const years = [];
  for (let i = startYear - 4; i <= startYear + 3; i++) {
    years.push(`${i}-${i + 1}`);
  }
  if (currentVal && !years.includes(currentVal)) {
    years.push(currentVal);
    years.sort();
  }
  return years;
}

export default function StaffAssignedView({
  role = "Staff",
  allowStaffSelection = false,
  initialStaffId = null,
}) {
  const [academicYear, setAcademicYear] = useState(getDefaultAcademicYear());
  const [semesterType, setSemesterType] = useState("");
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [timetableData, setTimetableData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeMobileDay, setActiveMobileDay] = useState(1);

  const searchRef = useRef(null);

  // Set active mobile day to today (Mon-Sat)
  useEffect(() => {
    const today = new Date().getDay(); // 0=Sun, 1=Mon..6=Sat
    if (today >= 1 && today <= 6) {
      setActiveMobileDay(today);
    }
  }, []);

  // Fetch staff list if selection allowed (Admin or HOD)
  useEffect(() => {
    if (!allowStaffSelection) return;
    const fetchStaff = async () => {
      try {
        const res = await api.get("/admin/staff/all", { params: { limit: 1000 } });
        const list = res.data.data || [];
        setStaffList(list);
        if (initialStaffId) {
          const found = list.find((s) => s._id === initialStaffId || s.staff_id === initialStaffId);
          if (found) setSelectedStaff(found);
        }
      } catch (err) {
        console.error("Failed to load staff list:", err);
      }
    };
    fetchStaff();
  }, [allowStaffSelection, initialStaffId]);

  // Click outside search dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch staff timetable & assigned subjects
  useEffect(() => {
    const fetchTimetable = async () => {
      setLoading(true);
      try {
        const params = { academicYear };
        if (semesterType) params.semesterType = semesterType;
        if (selectedStaff?._id) {
          params.staffId = selectedStaff._id;
        }

        const res = await api.get("/admin/timetable/staffview", { params });
        const data = res.data.data || [];
        setTimetableData(data);

        // If staff is auto-resolved by backend and we don't have selectedStaff, extract staff info
        if (!selectedStaff && data.length > 0 && data[0].staff) {
          setSelectedStaff(data[0].staff);
        }
      } catch (err) {
        console.error("Failed to fetch staff timetable:", err);
        setTimetableData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTimetable();
  }, [academicYear, semesterType, selectedStaff]);

  // Filtered staff list for search
  const filteredStaffList = useMemo(() => {
    if (!searchQuery.trim()) return staffList;
    const q = searchQuery.toUpperCase();
    return staffList.filter((s) => {
      const name = `${s.prefix || ""} ${s.first_name || ""} ${s.last_name || ""}`.toUpperCase();
      const code = (s.staff_code || "").toUpperCase();
      const dept = (s.department_code || "").toUpperCase();
      return name.includes(q) || code.includes(q) || dept.includes(q);
    });
  }, [staffList, searchQuery]);

  // Format Staff Display
  const getStaffName = (staff) => {
    if (!staff) return "Assigned Faculty";
    const { prefix = "", first_name = "", last_name = "" } = staff;
    return `${prefix} ${first_name} ${last_name}`.trim().replace(/\s+/g, " ");
  };

  // Group Assigned Subjects by Year (1st Year, 2nd Year, 3rd Year, 4th Year)
  const subjectsByYear = useMemo(() => {
    if (!timetableData.length) return {};

    const map = new Map(); // key: `${subjectId}__${department}__${year}`

    timetableData.forEach((entry) => {
      if (!entry.subject) return;
      const sub = entry.subject;
      const subId = sub._id || sub.subjectCode;
      const dept = entry.department || "GEN";
      const year = entry.year || 1;
      const semester = entry.semester || (year * 2 - 1);
      const classCode = `${dept}-${year}`;
      const hallCode = entry.hall?.hallCode || entry.hall?.hallName || null;

      const key = `${subId}__${dept}__${year}`;

      if (!map.has(key)) {
        map.set(key, {
          subjectId: subId,
          subjectName: sub.subjectName,
          subjectCode: sub.subjectCode,
          category: sub.Category || sub.category || "T",
          department: dept,
          year: Number(year),
          semester: Number(semester),
          classCode: classCode,
          periodsCount: 1,
          halls: hallCode ? [hallCode] : [],
        });
      } else {
        const item = map.get(key);
        item.periodsCount += 1;
        if (hallCode && !item.halls.includes(hallCode)) {
          item.halls.push(hallCode);
        }
      }
    });

    const items = Array.from(map.values());

    // Group items by Year (1, 2, 3, 4)
    const grouped = {};
    items.forEach((item) => {
      const y = item.year;
      if (!grouped[y]) grouped[y] = [];
      grouped[y].push(item);
    });

    // Sort subjects within each year by subjectCode
    Object.keys(grouped).forEach((y) => {
      grouped[y].sort((a, b) => a.subjectCode.localeCompare(b.subjectCode));
    });

    return grouped;
  }, [timetableData]);

  // Timetable Matrix for Table View
  const timetableMatrix = useMemo(() => {
    if (!timetableData.length) return {};
    const matrix = {};
    timetableData.forEach((entry) => {
      if (!entry.subject) return;
      const key = `${entry.day}__${entry.period}`;
      matrix[key] = {
        department: entry.department,
        year: entry.year,
        semester: entry.semester,
        classCode: `${entry.department}-${entry.year}`,
        subjectCode: entry.subject.subjectCode,
        subjectName: entry.subject.subjectName,
        category: entry.subject.Category || "T",
        hall: entry.hall?.hallCode || entry.hall?.hallName || null,
      };
    });
    return matrix;
  }, [timetableData]);

  // Total teaching stats
  const totalWeeklyPeriods = timetableData.length;
  const totalDistinctSubjects = Object.values(subjectsByYear).reduce(
    (acc, list) => acc + list.length,
    0
  );
  const yearsList = Object.keys(subjectsByYear)
    .map(Number)
    .sort((a, b) => a - b);

  // Active Mobile Single Day Schedule
  const activeDaySlots = useMemo(() => {
    const slots = [];
    for (let p = 1; p <= 7; p++) {
      const key = `${activeMobileDay}__${p}`;
      const entry = timetableMatrix[key] || null;
      slots.push({
        period: p,
        timing: PERIOD_TIMINGS[p],
        data: entry,
      });
    }
    return slots;
  }, [timetableMatrix, activeMobileDay]);

  const getCategoryClass = (cat) => {
    switch (cat) {
      case "L":
        return styles.catLab;
      case "T/L":
        return styles.catTheoryLab;
      case "T":
        return styles.catTheory;
      default:
        return styles.catOther;
    }
  };

  const getCategoryLabel = (cat) => {
    switch (cat) {
      case "L":
        return "Lab";
      case "T/L":
        return "Theory + Lab";
      case "T":
        return "Theory";
      default:
        return cat || "General";
    }
  };

  return (
    <div className={styles.wrapper}>
      {/* Control Filter Bar */}
      <div className={styles.controlBar}>
        <div className={styles.controlGroup}>
          <span className={styles.controlLabel}>
            <Calendar size={15} style={{ display: "inline", verticalAlign: "-2px", marginRight: "4px" }} />
            Academic Year:
          </span>
          <select
            className={styles.selectInput}
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
          >
            {getAcademicYearOptions(academicYear).map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>

          <span className={styles.controlLabel} style={{ marginLeft: "6px" }}>
            Semester:
          </span>
          <select
            className={styles.selectInput}
            value={semesterType}
            onChange={(e) => setSemesterType(e.target.value)}
          >
            <option value="">All Semesters</option>
            <option value="ODD">ODD Semesters (1, 3, 5, 7)</option>
            <option value="EVEN">EVEN Semesters (2, 4, 6, 8)</option>
          </select>
        </div>

        {allowStaffSelection && (
          <div className={styles.controlGroup} ref={searchRef}>
            <span className={styles.controlLabel}>Select Faculty:</span>
            <div className={styles.searchWrapper}>
              <Search className={styles.searchIcon} size={14} />
              <input
                type="text"
                placeholder={selectedStaff ? getStaffName(selectedStaff) : "Search staff name / code..."}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                className={styles.searchInput}
              />
              {showDropdown && (
                <ul className={styles.dropdownList}>
                  {filteredStaffList.length === 0 ? (
                    <li className={styles.dropdownItem} style={{ color: "#94a3b8" }}>
                      No faculty found
                    </li>
                  ) : (
                    filteredStaffList.map((s) => {
                      const isSelected = selectedStaff?._id === s._id;
                      return (
                        <li
                          key={s._id}
                          className={`${styles.dropdownItem} ${isSelected ? styles.dropdownItemActive : ""}`}
                          onClick={() => {
                            setSelectedStaff(s);
                            setSearchQuery("");
                            setShowDropdown(false);
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{getStaffName(s)}</span>
                          <span style={{ fontSize: "11px", color: "#64748b" }}>
                            {s.staff_code ? `Code: ${s.staff_code} • ` : ""}
                            {s.department_code || s.department || "Faculty"}
                          </span>
                        </li>
                      );
                    })
                  )}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Staff Overview Banner */}
      <div className={styles.staffBanner}>
        <div className={styles.staffMeta}>
          <div className={styles.staffAvatar}>
            <User size={24} />
          </div>
          <div className={styles.staffDetails}>
            <h3>{selectedStaff ? getStaffName(selectedStaff) : "Faculty Timetable & Subjects"}</h3>
            <div className={styles.staffSub}>
              {selectedStaff?.staff_code && <span>Code: {selectedStaff.staff_code}</span>}
              {selectedStaff?.staff_id && <span>ID: {selectedStaff.staff_id}</span>}
              {selectedStaff?.department_code && (
                <span>Dept: {selectedStaff.department_code}</span>
              )}
              <span>Academic Year: {academicYear}</span>
            </div>
          </div>
        </div>

        <div className={styles.staffStats}>
          <div className={styles.statPill}>
            <div className={styles.statVal}>{totalDistinctSubjects}</div>
            <div className={styles.statLbl}>Assigned Subjects</div>
          </div>
          <div className={styles.statPill}>
            <div className={styles.statVal}>{totalWeeklyPeriods}</div>
            <div className={styles.statLbl}>Weekly Periods</div>
          </div>
          <div className={styles.statPill}>
            <div className={styles.statVal}>{yearsList.length}</div>
            <div className={styles.statLbl}>Years Handled</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingSpinner}>
          <Clock className="spin-icon" size={24} />
          <span>Loading assigned subjects and schedule...</span>
        </div>
      ) : (
        <>
          {/* ===== SECTION 1: TIMETABLE IN TABLE FORM ===== */}
          <div className={styles.timetableSection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <CalendarRange size={20} color="#0284c7" />
                Weekly Class Timetable
              </h2>
              <span className={styles.sectionBadge}>
                {totalWeeklyPeriods} Active Slots
              </span>
            </div>

            {/* Mobile Day Selector Tabs */}
            <div className={styles.mobileDayTabs}>
              {[1, 2, 3, 4, 5, 6].map((dayNum) => (
                <button
                  key={dayNum}
                  type="button"
                  className={`${styles.dayTabBtn} ${
                    activeMobileDay === dayNum ? styles.dayTabBtnActive : ""
                  }`}
                  onClick={() => setActiveMobileDay(dayNum)}
                >
                  {SHORT_DAY_NAMES[dayNum]}
                </button>
              ))}
            </div>

            {totalWeeklyPeriods === 0 ? (
              <div className={styles.emptyMessage}>
                No timetable periods assigned for the selected academic year and semester.
              </div>
            ) : (
              <>
                {/* Full Desktop / Tablet Matrix Table View */}
                <div className={styles.tableScrollWrapper}>
                  <table className={styles.timetableTable}>
                    <thead>
                      <tr>
                        <th className={styles.dayHeaderCol}>Day / Period</th>
                        {[1, 2, 3, 4, 5, 6, 7].map((p) => (
                          <th key={p}>
                            <div className={styles.periodHeader}>
                              <span>P{p}</span>
                              <span className={styles.periodTiming}>{PERIOD_TIMINGS[p]}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[1, 2, 3, 4, 5, 6].map((dayNum) => {
                        // If day has any slots or is Mon-Fri
                        const hasSlots = [1, 2, 3, 4, 5, 6, 7].some(
                          (p) => timetableMatrix[`${dayNum}__${p}`]
                        );
                        if (dayNum === 6 && !hasSlots) return null; // skip Saturday if empty

                        return (
                          <tr key={dayNum}>
                            <td className={styles.dayCell}>{DAY_NAMES[dayNum]}</td>
                            {[1, 2, 3, 4, 5, 6, 7].map((p) => {
                              const slot = timetableMatrix[`${dayNum}__${p}`];
                              if (!slot) {
                                return (
                                  <td key={p}>
                                    <span className={styles.freeSlot}>—</span>
                                  </td>
                                );
                              }
                              return (
                                <td key={p}>
                                  <div className={styles.slotBox}>
                                    <span className={styles.slotClass}>
                                      {slot.classCode}
                                    </span>
                                    <span className={styles.slotCode}>
                                      {slot.subjectCode}
                                    </span>
                                    <span className={styles.slotName} title={slot.subjectName}>
                                      {slot.subjectName}
                                    </span>
                                    {slot.hall && (
                                      <span className={styles.slotHall}>
                                        {slot.hall}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Single-Day Card Breakdown View */}
                <div className={styles.mobileDayCards}>
                  <h4 style={{ margin: "6px 0 2px 0", fontSize: "14px", color: "#0f172a" }}>
                    {DAY_NAMES[activeMobileDay]} Schedule Breakdown:
                  </h4>
                  {activeDaySlots.map((slot) => {
                    const entry = slot.data;
                    return (
                      <div
                        key={slot.period}
                        className={`${styles.mobileSlotRow} ${
                          entry ? styles.mobileSlotFilled : ""
                        }`}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span className={styles.mobilePeriodBadge}>P{slot.period}</span>
                          <div>
                            <div style={{ fontSize: "10px", color: "#64748b" }}>
                              {slot.timing}
                            </div>
                            <div style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>
                              {entry ? `${entry.subjectCode} — ${entry.subjectName}` : "Free Period"}
                            </div>
                          </div>
                        </div>

                        {entry && (
                          <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: "3px", alignItems: "flex-end" }}>
                            <span className={styles.slotClass}>{entry.classCode}</span>
                            {entry.hall && <span className={styles.slotHall}>{entry.hall}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* ===== SECTION 2: ASSIGNED SUBJECTS (ARRANGED BY YEAR) ===== */}
          <div className={styles.subjectsContainer}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                <BookOpen size={20} color="#0284c7" />
                Assigned Subjects (By Year)
              </h2>
              <span className={styles.sectionBadge}>
                {totalDistinctSubjects} Courses
              </span>
            </div>

            {yearsList.length === 0 ? (
              <div className={styles.emptyMessage}>
                No subjects assigned to this faculty member yet.
              </div>
            ) : (
              yearsList.map((year) => {
                const yearSubjects = subjectsByYear[year] || [];
                const yearLabel = YEAR_NAMES[year] || `Year ${year}`;

                return (
                  <div key={year} className={styles.yearSection}>
                    <div className={styles.yearTitle}>
                      <span className={styles.yearTag}>{yearLabel}</span>
                      <span>
                        {yearLabel} Courses & Classes ({yearSubjects.length} {yearSubjects.length === 1 ? "Subject" : "Subjects"})
                      </span>
                    </div>

                    <div className={styles.cardsGrid}>
                      {yearSubjects.map((sub) => (
                        <div key={`${sub.subjectId}_${sub.classCode}`} className={styles.subjectCard}>
                          <div>
                            <div className={styles.cardTop}>
                              <span className={styles.subjectCodeBadge}>
                                {sub.subjectCode}
                              </span>
                              <span
                                className={`${styles.categoryBadge} ${getCategoryClass(
                                  sub.category
                                )}`}
                              >
                                {getCategoryLabel(sub.category)}
                              </span>
                            </div>

                            <h3 className={styles.subjectName}>{sub.subjectName}</h3>
                          </div>

                          <div className={styles.cardDetails}>
                            <div className={styles.cardDetailRow}>
                              <Layers size={13} color="#0284c7" />
                              <span>Class / Section:</span>
                              <span className={styles.classBadge}>
                                {sub.classCode} (Sem {sub.semester})
                              </span>
                            </div>

                            <div className={styles.cardDetailRow}>
                              <Clock size={13} color="#0284c7" />
                              <span>Allocated Hours:</span>
                              <span className={styles.periodsBadge}>
                                {sub.periodsCount} periods / week
                              </span>
                            </div>

                            {sub.halls && sub.halls.length > 0 && (
                              <div className={styles.cardDetailRow}>
                                <Building size={13} color="#15803d" />
                                <span>Classroom / Lab:</span>
                                <span className={styles.hallBadge}>
                                  {sub.halls.join(", ")}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
