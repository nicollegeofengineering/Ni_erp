'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import axios from 'axios';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

import styles from './AttendancePage.module.css';

const BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

export default function AttendancePage() {
  const router = useRouter();

  // --------------------------------------------------
  // DATE
  // --------------------------------------------------

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [day, setDay] = useState(null);

  // --------------------------------------------------
  // FILTERS
  // --------------------------------------------------

  const [selectedDept, setSelectedDept] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');

  // --------------------------------------------------
  // OPTIONS
  // --------------------------------------------------

  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);

  // --------------------------------------------------
  // ATTENDANCE
  // --------------------------------------------------

  const [students, setStudents] = useState([]);
  const [attendanceExists, setAttendanceExists] = useState(false);
  const [existingAttendance, setExistingAttendance] = useState(null);
  const [selectAll, setSelectAll] = useState(true);

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [checkingAttendance, setCheckingAttendance] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState('');

  // --------------------------------------------------
  // HELPERS
  // --------------------------------------------------

  const formatDate = (date) => {
    if (!date) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  };

  const getDayNumber = (date) => {
    if (!date) return null;

    const jsDay = date.getDay();

    // Monday = 1 ... Sunday = 7
    return jsDay === 0 ? 7 : jsDay;
  };

  const handleUnauthorized = (error) => {
    if (
      error.response?.status === 401 ||
      error.response?.data?.isLogout === true
    ) {
      router.push('/');
      return true;
    }

    return false;
  };

  const resetAttendanceState = () => {
    setStudents([]);
    setAttendanceExists(false);
    setExistingAttendance(null);
    setSelectAll(true);
  };

  // --------------------------------------------------
  // DERIVED OPTIONS
  // --------------------------------------------------

  // Unique departments
  const departmentOptions = useMemo(() => {
    return [...new Set(
      classes
        .map((item) => item.department)
        .filter(Boolean)
    )].sort();
  }, [classes]);

  // Years ONLY for selected department
  const yearOptions = useMemo(() => {
    if (!selectedDept) return [];

    return [...new Set(
      classes
        .filter((item) => item.department === selectedDept)
        .map((item) => item.year)
        .filter((year) => year !== undefined && year !== null)
    )].sort((a, b) => Number(a) - Number(b));
  }, [classes, selectedDept]);

  // Selected subject object
  const selectedSubjectData = useMemo(() => {
    return subjects.find(
      (subject) => String(subject.id) === String(selectedSubject)
    );
  }, [subjects, selectedSubject]);

  // --------------------------------------------------
  // FETCH CLASSES
  // --------------------------------------------------

  useEffect(() => {
    const fetchClasses = async () => {
      setLoadingClasses(true);
      setError('');

      try {
        const response = await api.get('/api/staff/attendance/classes');

        if (!response.data?.success) {
          throw new Error(
            response.data?.message || 'Failed to load classes'
          );
        }

        setClasses(response.data.data || []);
      } catch (err) {
        if (handleUnauthorized(err)) return;

        console.error('Error fetching classes:', err);

        setError(
          err.response?.data?.message ||
          'Failed to load departments and years.'
        );
      } finally {
        setLoadingClasses(false);
      }
    };

    fetchClasses();
  }, []);

  // --------------------------------------------------
  // DATE CHANGE
  // --------------------------------------------------

  useEffect(() => {
    const newDay = getDayNumber(selectedDate);
    setDay(newDay);

    // Existing selected class can remain, but attendance
    // must be checked again because date changed.
    resetAttendanceState();
  }, [selectedDate]);

  // --------------------------------------------------
  // DEPARTMENT CHANGE
  // --------------------------------------------------

  useEffect(() => {
    setSelectedYear('');
    setSelectedSubject('');
    setSelectedPeriod('');
    setSubjects([]);
    resetAttendanceState();
  }, [selectedDept]);

  // --------------------------------------------------
  // YEAR CHANGE
  // --------------------------------------------------

  useEffect(() => {
    setSelectedSubject('');
    setSelectedPeriod('');
    setSubjects([]);
    resetAttendanceState();
  }, [selectedYear]);

  // --------------------------------------------------
  // SUBJECT CHANGE
  // --------------------------------------------------

  useEffect(() => {
    setSelectedPeriod('');
    resetAttendanceState();
  }, [selectedSubject]);

  // --------------------------------------------------
  // FETCH SUBJECTS
  // --------------------------------------------------

  useEffect(() => {
    if (!selectedDept || !selectedYear) {
      setSubjects([]);
      return;
    }

    const fetchSubjects = async () => {
      setLoadingSubjects(true);
      setError('');
      setSelectedSubject('');
      setSelectedPeriod('');
      resetAttendanceState();

      try {
        const response = await api.get(
          '/api/staff/attendance/subjects',
          {
            params: {
              department: selectedDept,
              year: selectedYear,
            },
          }
        );

        if (!response.data?.success) {
          throw new Error(
            response.data?.message || 'Failed to load subjects'
          );
        }

        setSubjects(response.data.data || []);
      } catch (err) {
        if (handleUnauthorized(err)) return;

        console.error('Error fetching subjects:', err);

        setSubjects([]);

        setError(
          err.response?.data?.message ||
          'Failed to load subjects.'
        );
      } finally {
        setLoadingSubjects(false);
      }
    };

    fetchSubjects();
  }, [selectedDept, selectedYear]);

  // --------------------------------------------------
  // CHECK ATTENDANCE
  // --------------------------------------------------

  useEffect(() => {
    if (
      !selectedDept ||
      !selectedYear ||
      !selectedSubject ||
      !selectedPeriod ||
      !selectedDate
    ) {
      return;
    }

    const controller = new AbortController();

    const checkAttendance = async () => {
      setCheckingAttendance(true);
      setError('');
      setStudents([]);
      setAttendanceExists(false);
      setExistingAttendance(null);
      setSelectAll(true);

      try {
        const dateStr = formatDate(selectedDate);

        // --------------------------------------------
        // STEP 1: CHECK EXISTING ATTENDANCE
        // --------------------------------------------

        const checkResponse = await api.get(
          '/api/staff/attendance/check',
          {
            params: {
              date: dateStr,
              department: selectedDept,
              year: selectedYear,
              subjectId: selectedSubject,
              period: selectedPeriod,
            },
            signal: controller.signal,
          }
        );

        if (!checkResponse.data?.success) {
          throw new Error(
            checkResponse.data?.message ||
            'Attendance check failed'
          );
        }

        // --------------------------------------------
        // EXISTING ATTENDANCE
        // --------------------------------------------

        if (checkResponse.data.attendanceExists) {
          const attendance =
            checkResponse.data.attendance;

          setAttendanceExists(true);
          setExistingAttendance(attendance);

          const existingStudents = (
            attendance?.students || []
          ).map((student) => {
            const studentData =
              student.student_id &&
              typeof student.student_id === 'object'
                ? student.student_id
                : null;

            return {
              student_id:
                studentData?._id ||
                studentData?.student_id ||
                student.student_id,

              register_no:
                student.register_no || studentData?.register_no || '',

              roll_no:
                student.roll_no || studentData?.roll_no || '',

              name:
                student.name ||
                (studentData
                  ? `${studentData.first_name || ''} ${
                      studentData.last_name || ''
                    }`.trim()
                  : `Student ${student.student_id}`),

              status: student.status,

              // Existing attendance is READ ONLY
              selected: false,
            };
          });

          setStudents(existingStudents);
          setSelectAll(false);

          return;
        }

        // --------------------------------------------
        // NO ATTENDANCE YET
        // --------------------------------------------

        setAttendanceExists(false);
        setExistingAttendance(null);

        // --------------------------------------------
        // STEP 2: LOAD STUDENTS
        // --------------------------------------------

        setLoadingStudents(true);

        const studentsResponse = await api.get(
          '/api/staff/attendance/students',
          {
            params: {
              date: dateStr,
              department: selectedDept,
              year: selectedYear,
              subjectId: selectedSubject,
              period: selectedPeriod,
            },
            signal: controller.signal,
          }
        );

        if (!studentsResponse.data?.success) {
          throw new Error(
            studentsResponse.data?.message ||
            'Failed to load students'
          );
        }

        if (studentsResponse.data.data?.attendanceSubmitted) {
          setAttendanceExists(true);
        }

        const isSubmitted = !!studentsResponse.data.data?.attendanceSubmitted;
        const loadedStudents = (
          studentsResponse.data.data?.students || []
        ).map((student) => ({
          ...student,
          selected: !isSubmitted,
          status: student.status || 'Present',
        }));

        setStudents(loadedStudents);
        setSelectAll(!isSubmitted && loadedStudents.length > 0);
      } catch (err) {
        if (err.name === 'CanceledError') return;
        if (err.name === 'AbortError') return;

        if (handleUnauthorized(err)) return;

        console.error(
          'Error checking/loading attendance:',
          err
        );

        setError(
          err.response?.data?.message ||
          err.message ||
          'Failed to check attendance.'
        );
      } finally {
        setCheckingAttendance(false);
        setLoadingStudents(false);
      }
    };

    checkAttendance();

    return () => {
      controller.abort();
    };
  }, [
    selectedDate,
    selectedDept,
    selectedYear,
    selectedSubject,
    selectedPeriod,
  ]);

  // --------------------------------------------------
  // SELECT ALL
  // --------------------------------------------------

  const toggleSelectAll = () => {
    if (attendanceExists || students.length === 0) {
      return;
    }

    const nextValue = !selectAll;

    setSelectAll(nextValue);

    setStudents((previous) =>
      previous.map((student) => ({
        ...student,
        selected: nextValue,
      }))
    );
  };

  // --------------------------------------------------
  // SELECT INDIVIDUAL STUDENT
  // --------------------------------------------------

  const toggleStudentSelection = (studentId) => {
    if (attendanceExists) {
      return;
    }

    setStudents((previous) =>
      previous.map((student) =>
        String(student.student_id) === String(studentId)
          ? {
              ...student,
              selected: !student.selected,
            }
          : student
      )
    );
  };

  // --------------------------------------------------
  // PRESENT / ABSENT
  // --------------------------------------------------

  const toggleStudentStatus = (studentId) => {
    if (attendanceExists) {
      return;
    }

    setStudents((previous) =>
      previous.map((student) => {
        if (
          String(student.student_id) === String(studentId) &&
          student.selected
        ) {
          return {
            ...student,
            status:
              student.status === 'Present'
                ? 'Absent'
                : 'Present',
          };
        }

        return student;
      })
    );
  };

  // --------------------------------------------------
  // KEEP SELECT ALL STATE IN SYNC
  // --------------------------------------------------

  useEffect(() => {
    if (!students.length || attendanceExists) {
      return;
    }

    setSelectAll(
      students.every((student) => student.selected)
    );
  }, [students, attendanceExists]);

  // --------------------------------------------------
  // SUBMIT
  // --------------------------------------------------

  const handleSubmit = async () => {
    if (attendanceExists) {
      setError(
        'Attendance has already been submitted for this period.'
      );
      return;
    }

    if (
      !selectedDept ||
      !selectedYear ||
      !selectedSubject ||
      !selectedPeriod
    ) {
      setError(
        'Please select department, year, subject and period.'
      );
      return;
    }

    const selectedStudents =
      students.filter((student) => student.selected);

    if (selectedStudents.length === 0) {
      setError('Please select at least one student.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        date: formatDate(selectedDate),
        department: selectedDept,
        year: Number(selectedYear),
        subjectId: selectedSubject,
        period: Number(selectedPeriod),

        students: selectedStudents.map((student) => ({
          student_id: student.student_id,
          status: student.status,
        })),
      };

      const response = await api.post(
        '/api/staff/attendance',
        payload
      );

      if (!response.data?.success) {
        throw new Error(
          response.data?.message ||
          'Attendance submission failed.'
        );
      }

      alert('Attendance submitted successfully.');

      // Re-check immediately so UI becomes read-only
      const checkResponse = await api.get(
        '/api/staff/attendance/check',
        {
          params: {
            date: formatDate(selectedDate),
            department: selectedDept,
            year: selectedYear,
            subjectId: selectedSubject,
            period: selectedPeriod,
          },
        }
      );

      if (
        checkResponse.data?.success &&
        checkResponse.data.attendanceExists
      ) {
        const attendance =
          checkResponse.data.attendance;

        setAttendanceExists(true);
        setExistingAttendance(attendance);

        const existingStudents = (
          attendance?.students || []
        ).map((student) => {
          const studentData =
            student.student_id &&
            typeof student.student_id === 'object'
              ? student.student_id
              : null;

          return {
            student_id:
              studentData?._id ||
              studentData?.student_id ||
              student.student_id,

            register_no:
              studentData?.register_no || '',

            roll_no:
              studentData?.roll_no || '',

            name: studentData
              ? `${studentData.first_name || ''} ${
                  studentData.last_name || ''
                }`.trim()
              : `Student ${student.student_id}`,

            status: student.status,
            selected: false,
          };
        });

        setStudents(existingStudents);
        setSelectAll(false);
      }
    } catch (err) {
      if (handleUnauthorized(err)) return;

      console.error(
        'Error submitting attendance:',
        err
      );

      setError(
        err.response?.data?.message ||
        err.message ||
        'Failed to submit attendance.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div className={styles.container}>
      {/* HEADER */}
      <div className={styles.ctop}>
        <h1>Add Attendance</h1>

        <Link href="/staff/attendance/view">
          <button className={styles.viewBtn}>
            View Attendances
          </button>
        </Link>
      </div>

      {/* DATE */}
      <div className={styles.field}>
        <label>Date:</label>

        <DatePicker
          selected={selectedDate}
          onChange={(date) => {
            if (date) {
              setSelectedDate(date);
            }
          }}
          dateFormat="dd-MM-yyyy"
        />

        {day && (
          <span className={styles.dayLabel}>
            Day:{' '}
            {[
              'Mon',
              'Tue',
              'Wed',
              'Thu',
              'Fri',
              'Sat',
              'Sun',
            ][day - 1]}
          </span>
        )}
      </div>

      {/* ERROR */}
      {error && (
        <p className={styles.error}>
          {error}
        </p>
      )}

      {/* FILTERS */}
      <div className={styles.filters}>
        {/* DEPARTMENT */}
        <select
          value={selectedDept}
          onChange={(e) => {
            setSelectedDept(e.target.value);
          }}
          disabled={loadingClasses}
        >
          <option value="">
            {loadingClasses
              ? 'Loading Departments...'
              : 'Select Department'}
          </option>

          {departmentOptions.map((department) => (
            <option
              key={department}
              value={department}
            >
              {department}
            </option>
          ))}
        </select>

        {/* YEAR */}
        <select
          value={selectedYear}
          onChange={(e) => {
            setSelectedYear(e.target.value);
          }}
          disabled={
            !selectedDept ||
            loadingClasses
          }
        >
          <option value="">
            Select Year
          </option>

          {yearOptions.map((year) => (
            <option
              key={year}
              value={year}
            >
              Year {year}
            </option>
          ))}
        </select>

        {/* SUBJECT */}
        <select
          value={selectedSubject}
          onChange={(e) => {
            setSelectedSubject(e.target.value);
          }}
          disabled={
            !selectedDept ||
            !selectedYear ||
            loadingSubjects
          }
        >
          <option value="">
            {loadingSubjects
              ? 'Loading Subjects...'
              : 'Select Subject'}
          </option>

          {subjects.map((subject) => (
            <option
              key={subject.id}
              value={subject.id}
            >
              {subject.code} - {subject.name}
            </option>
          ))}
        </select>

        {/* PERIOD */}
        <select
          value={selectedPeriod}
          onChange={(e) => {
            setSelectedPeriod(e.target.value);
          }}
          disabled={
            !selectedSubject ||
            checkingAttendance
          }
        >
          <option value="">
            Select Period
          </option>

          {[1, 2, 3, 4, 5, 6, 7].map(
            (period) => (
              <option
                key={period}
                value={period}
              >
                P{period}
              </option>
            )
          )}
        </select>
      </div>

      {/* LOADING */}
      {(loadingClasses ||
        loadingSubjects ||
        checkingAttendance ||
        loadingStudents) && (
        <p>
          {loadingClasses
            ? 'Loading classes...'
            : loadingSubjects
            ? 'Loading subjects...'
            : checkingAttendance
            ? 'Checking attendance...'
            : 'Loading students...'}
        </p>
      )}

      {/* EXISTING ATTENDANCE MESSAGE */}
      {attendanceExists && (
        <div className={styles.info}>
          Attendance already submitted for this
          period. Student attendance is read-only.
        </div>
      )}

      {/* STUDENT SECTION */}
      {students.length > 0 && (
        <div className={styles.studentSection}>
          <h2>
            {selectedDept} - Year {selectedYear}
            {' - '}
            {selectedSubjectData?.code || ''}
            {' - '}
            {selectedSubjectData?.name || ''}
            {' - '}
            P{selectedPeriod}
          </h2>

          {existingAttendance && (
            <p>
              Existing attendance record found.
              Marking is disabled.
            </p>
          )}

          <table
            className={styles.studentTable}
          >
            <thead>
              <tr>
                <th
                  className={
                    styles.checkboxHeader
                  }
                >
                  <input
                    type="checkbox"
                    checked={
                      attendanceExists
                        ? false
                        : selectAll
                    }
                    onChange={toggleSelectAll}
                    disabled={
                      attendanceExists ||
                      students.length === 0
                    }
                  />
                </th>

                <th>Register No</th>
                <th>Roll No</th>
                <th>Student Name</th>
                <th>Attendance Status</th>
              </tr>
            </thead>

            <tbody>
              {students.map((student) => (
                <tr
                  key={student.student_id}
                  className={`${
                    student.status ===
                    'Present'
                      ? styles.present
                      : styles.absent
                  } ${
                    !student.selected
                      ? styles.deselected
                      : ''
                  }`}
                  onClick={() =>
                    toggleStudentStatus(
                      student.student_id
                    )
                  }
                  style={{
                    cursor:
                      attendanceExists ||
                      !student.selected
                        ? 'default'
                        : 'pointer',

                    opacity:
                      attendanceExists
                        ? 1
                        : student.selected
                        ? 1
                        : 0.6,
                  }}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={
                        attendanceExists
                          ? false
                          : student.selected
                      }
                      onChange={() =>
                        toggleStudentSelection(
                          student.student_id
                        )
                      }
                      onClick={(e) =>
                        e.stopPropagation()
                      }
                      disabled={
                        attendanceExists
                      }
                    />
                  </td>

                  <td>
                    <strong>
                      {student.register_no ||
                        student.student_id}
                    </strong>
                  </td>

                  <td>
                    {student.roll_no || '-'}
                  </td>

                  <td>
                    <strong>
                      {student.name || '-'}
                    </strong>
                  </td>

                  <td>
                    <span
                      className={
                        styles.statusBadge
                      }
                    >
                      {student.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* SUBMIT */}
          <button
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={
              attendanceExists ||
              submitting ||
              checkingAttendance ||
              loadingStudents ||
              students.length === 0 ||
              students.filter(
                (student) =>
                  student.selected
              ).length === 0
            }
          >
            {submitting ? (
              <span className="btn-loading">
                <Loader2 size={16} className="spin-icon" /> Submitting Attendance...
              </span>
            ) : attendanceExists ? (
              'Attendance Already Submitted'
            ) : (
              'Submit Attendance'
            )}
          </button>
        </div>
      )}
    </div>
  );
}