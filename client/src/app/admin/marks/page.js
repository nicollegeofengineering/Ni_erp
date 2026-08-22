"use client";

import { useState } from "react";
import axios from "axios";
import styles from "./css/studentmarks.module.css";

export default function StudentMarks() {
  const [regNo, setRegNo] = useState("");
  const [marksData, setMarksData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchMarks = async () => {
    if (!regNo.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/mark/student?register_no=${regNo.trim()}`,
        { withCredentials: true }
      );
      if (res.data.success) {
        setMarksData(res.data.data);
      } else {
        setError("No marks found.");
      }
    } catch (err) {
      setError("Error fetching marks.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>My Marks</h1>
      </div>
      <div className={styles.searchBox}>
        <input
          type="text"
          placeholder="Enter Register Number"
          value={regNo}
          onChange={e => setRegNo(e.target.value)}
          onKeyDown={e => e.key === "Enter" && fetchMarks()}
        />
        <button onClick={fetchMarks} disabled={loading}>
          {loading ? "Loading..." : "View Marks"}
        </button>
      </div>
      {error && <div className={styles.error}>{error}</div>}
      {marksData && (
        <div className={styles.marksContainer}>
          {Object.entries(marksData).map(([semester, exams]) => (
            <div key={semester} className={styles.semesterCard}>
              <h2>Semester {semester}</h2>
              {Object.entries(exams).map(([examName, subjects]) => (
                <div key={examName} className={styles.examSection}>
                  <h3>{examName}</h3>
                  <table className={styles.marksTable}>
                    <thead>
                      <tr>
                        <th>Subject Code</th>
                        <th>Subject Name</th>
                        <th>Theory</th>
                        <th>Practical</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjects.map(sub => (
                        <tr key={sub._id}>
                          <td>{sub.code}</td>
                          <td>{sub.name}</td>
                          <td>{sub.theory_marks ?? "-"}</td>
                          <td>{sub.practical_marks ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}