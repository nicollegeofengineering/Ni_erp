"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  MessageSquareCheck,
  Award,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  User,
  GraduationCap,
  Calendar,
  Send,
  Sparkles,
  MessageSquare,
} from "lucide-react";
import {
  QUESTION_DISPLAY,
  QUESTION_KEYS,
  RATING_LABELS,
  RATING_COLORS,
} from "../../constants/feedbackQuestions";
import styles from "./feedback.module.css";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const api = axios.create({ baseURL: BASE_URL, withCredentials: true });

export default function StudentFeedbackPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [submissionInfo, setSubmissionInfo] = useState(null);
  const [studentInfo, setStudentInfo] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [feedbackData, setFeedbackData] = useState({});
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Check feedback status on mount
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setErrorMsg("");

      // 1. Check if student already submitted feedback
      const statusRes = await api.get("/api/feedback/student/status");
      const statusData = statusRes.data;

      if (statusData.hasSubmitted) {
        setHasSubmitted(true);
        setSubmissionInfo(statusData);
        setLoading(false);
        return;
      }

      // 2. Fetch eligible subjects (T, L, T/L only) for student's class
      const subjectsRes = await api.get("/api/feedback/student/eligible-subjects");
      const subData = subjectsRes.data;
      const subjectList = subData.data?.subjects || [];
      setStudentInfo(subData.data?.student || null);
      setSubjects(subjectList);

      // 3. Initialize ratings map for each subject
      const initialMap = {};
      subjectList.forEach((sub) => {
        const uniqueKey = `${sub.subjectCode}||${sub.facultyName}`;
        initialMap[uniqueKey] = {
          subjectId: sub.subjectId,
          subjectCode: sub.subjectCode,
          subjectName: sub.subjectName,
          category: sub.category,
          staffId: sub.staffId,
          facultyName: sub.facultyName,
          ratings: QUESTION_KEYS.reduce((acc, k) => ({ ...acc, [k]: null }), {}),
          comment: "",
        };
      });
      setFeedbackData(initialMap);

    } catch (err) {
      console.error("Error loading feedback page:", err);
      if (err.response?.status === 401 || err.response?.data?.islogout) {
        router.push("/");
        return;
      }
      setErrorMsg(err.response?.data?.message || err.message || "An unexpected error occurred while loading feedback.");
    } finally {
      setLoading(false);
    }
  };

  // Handle rating selection
  const handleRatingChange = (uniqueKey, questionKey, value) => {
    setFeedbackData((prev) => ({
      ...prev,
      [uniqueKey]: {
        ...prev[uniqueKey],
        ratings: {
          ...prev[uniqueKey]?.ratings,
          [questionKey]: value,
        },
      },
    }));
  };

  // Handle comment change
  const handleCommentChange = (uniqueKey, comment) => {
    setFeedbackData((prev) => ({
      ...prev,
      [uniqueKey]: {
        ...prev[uniqueKey],
        comment,
      },
    }));
  };

  // Progress calculations
  const totalRequiredQuestions = useMemo(() => {
    return subjects.length * QUESTION_KEYS.length;
  }, [subjects]);

  const totalAnsweredQuestions = useMemo(() => {
    let answered = 0;
    Object.values(feedbackData).forEach((item) => {
      if (item?.ratings) {
        Object.values(item.ratings).forEach((val) => {
          if (val !== null && val !== undefined) answered++;
        });
      }
    });
    return answered;
  }, [feedbackData]);

  const progressPercentage = totalRequiredQuestions > 0
    ? Math.round((totalAnsweredQuestions / totalRequiredQuestions) * 100)
    : 0;

  // Submit Feedback
  const handleSubmit = async () => {
    setErrorMsg("");

    // Validate that all questions are answered for all subjects
    const uncompletedSubjects = [];
    for (const key in feedbackData) {
      const item = feedbackData[key];
      const unanswered = QUESTION_KEYS.filter((k) => item.ratings[k] === null || item.ratings[k] === undefined);
      if (unanswered.length > 0) {
        uncompletedSubjects.push(`${item.subjectCode} (${item.facultyName}) - ${unanswered.length} unanswered`);
      }
    }

    if (uncompletedSubjects.length > 0) {
      alert(`Please answer all 14 questions for every subject before submitting:\n\n• ${uncompletedSubjects.join("\n• ")}`);
      return;
    }

    if (!window.confirm("Are you sure you want to submit your course feedback? Once submitted, your responses are securely locked.")) {
      return;
    }

    try {
      setSubmitting(true);
      const payload = Object.values(feedbackData).map((item) => ({
        subjectId: item.subjectId,
        subjectCode: item.subjectCode,
        subjectName: item.subjectName,
        category: item.category,
        staffId: item.staffId,
        facultyName: item.facultyName,
        ratings: item.ratings,
        comment: item.comment,
      }));

      const res = await api.post("/api/feedback/student/submit", payload);

      setHasSubmitted(true);
      setSubmissionInfo({
        hasSubmitted: true,
        submittedAt: new Date(),
      });
      setSuccessMsg("Feedback submitted successfully!");
    } catch (err) {
      console.error("Submission error:", err);
      alert(err.response?.data?.message || err.message || "Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p style={{ fontWeight: 600, fontSize: "15px" }}>Loading feedback form...</p>
      </div>
    );
  }

  // State: Already Submitted
  if (hasSubmitted) {
    return (
      <div className={styles.container}>
        <div className={styles.submittedCard}>
          <div className={styles.successIconWrapper}>
            <CheckCircle2 size={44} strokeWidth={2.5} />
          </div>
          <h2 className={styles.submittedHeading}>Feedback Already Submitted</h2>
          <p className={styles.submittedText}>
            Thank you for providing your valuable evaluation. Your anonymous responses have been securely recorded and help maintain high academic standards.
          </p>

          <div className={styles.submittedMetaBox}>
            <div>
              <strong>Status:</strong> <span style={{ color: "#16a34a", fontWeight: 700 }}>✓ Submitted</span>
            </div>
            {submissionInfo?.submittedAt && (
              <div>
                <strong>Submission Date:</strong>{" "}
                <span>{new Date(submissionInfo.submittedAt).toLocaleString("en-GB")}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header Banner */}
      <div className={styles.headerCard}>
        <h1 className={styles.headerTitle}>
          <MessageSquareCheck size={30} /> Student Feedback on Course & Faculty
        </h1>
        <p className={styles.headerSubtitle}>
          Evaluate each faculty member on the 14 standard academic criteria using the 5-point scale (1 = Poor to 5 = Excellent). Your feedback is completely <strong>anonymous</strong> and aids in continuous quality enhancement.
        </p>

        {studentInfo && (
          <div className={styles.studentMetaBar}>
            <div className={styles.metaItem}>
              <GraduationCap size={15} /> <span>Reg No: <strong>{studentInfo.register_no || studentInfo.student_id}</strong></span>
            </div>
            <div className={styles.metaItem}>
              <BookOpen size={15} /> <span>Dept: <strong>{studentInfo.department}</strong></span>
            </div>
            <div className={styles.metaItem}>
              <Calendar size={15} /> <span>Year: <strong>{studentInfo.year}</strong> | Sem: <strong>{studentInfo.semester}</strong></span>
            </div>
            <div className={styles.metaItem}>
              <Sparkles size={15} /> <span>Courses to Evaluate: <strong>{subjects.length}</strong></span>
            </div>
          </div>
        )}
      </div>

      {errorMsg && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "12px", padding: "14px 18px", color: "#dc2626", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
          <AlertCircle size={20} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Overall Progress Bar */}
      <div className={styles.overallProgressCard}>
        <div className={styles.progressTop}>
          <span>Overall Evaluation Progress</span>
          <span>
            {totalAnsweredQuestions} of {totalRequiredQuestions} questions answered ({progressPercentage}%)
          </span>
        </div>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${progressPercentage}%` }} />
        </div>
      </div>

      {/* Subjects Evaluation Form */}
      {subjects.length === 0 ? (
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "36px", textAlign: "center", color: "#64748b" }}>
          <BookOpen size={40} style={{ margin: "0 auto 12px auto", opacity: 0.5 }} />
          <h3>No Eligible Courses Found</h3>
          <p>No Theory (T) or Lab (L) courses are assigned in the active timetable for your semester.</p>
        </div>
      ) : (
        subjects.map((sub) => {
          const uniqueKey = `${sub.subjectCode}||${sub.facultyName}`;
          const currentEntry = feedbackData[uniqueKey] || {};
          const currentRatings = currentEntry.ratings || {};
          const answeredCount = Object.values(currentRatings).filter((v) => v !== null && v !== undefined).length;
          const isComplete = answeredCount === QUESTION_KEYS.length;

          return (
            <div key={uniqueKey} className={styles.subjectCard}>
              <div className={styles.subjectHeader}>
                <div className={styles.subjectInfo}>
                  <div className={styles.subjectTitleRow}>
                    <span className={styles.subjectCode}>{sub.subjectCode}</span>
                    <span className={styles.subjectName}>- {sub.subjectName}</span>
                    <span className={styles.categoryBadge}>
                      {sub.category === "T" ? "Theory (T)" : sub.category === "L" ? "Practical/Lab (L)" : "Theory & Practical (T/L)"}
                    </span>
                  </div>
                  <div className={styles.facultyBadge}>
                    <User size={15} />
                    <span>Faculty: <strong>{sub.facultyName}</strong></span>
                  </div>
                </div>

                <div className={`${styles.subjectAnswerCount} ${isComplete ? styles.badgeComplete : styles.badgeIncomplete}`}>
                  {answeredCount}/{QUESTION_KEYS.length} Completed
                </div>
              </div>

              {/* 14 Questions List */}
              <div className={styles.questionsList}>
                {QUESTION_KEYS.map((qKey, qIdx) => {
                  const label = QUESTION_DISPLAY[qKey];
                  const selectedVal = currentRatings[qKey];
                  const isAnswered = selectedVal !== null && selectedVal !== undefined;

                  return (
                    <div
                      key={qKey}
                      className={`${styles.questionItem} ${isAnswered ? styles.questionItemAnswered : ""}`}
                    >
                      <div className={styles.questionText}>
                        <span className={styles.questionIndex}>{qIdx + 1}.</span>
                        <span>{label}</span>
                      </div>

                      <div className={styles.ratingRow}>
                        {[1, 2, 3, 4, 5].map((val) => {
                          const isActive = selectedVal === val;
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => handleRatingChange(uniqueKey, qKey, val)}
                              className={`${styles.ratingBtn} ${isActive ? styles.ratingBtnActive : ""}`}
                            >
                              <span className={styles.ratingVal}>{val}</span>
                              <span className={styles.ratingLabel}>{RATING_LABELS[val]}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Subject Comment / Suggestion Box */}
              <div className={styles.commentSection}>
                <label className={styles.commentLabel}>
                  <MessageSquare size={16} /> Additional Suggestions & Feedback for {sub.facultyName} (Optional)
                </label>
                <textarea
                  className={styles.commentTextarea}
                  placeholder="Share constructive suggestions or remarks regarding this subject or teaching methodology (max 500 characters)..."
                  maxLength={500}
                  value={currentEntry.comment || ""}
                  onChange={(e) => handleCommentChange(uniqueKey, e.target.value)}
                />
                <div style={{ fontSize: "11.5px", color: "#94a3b8", textAlign: "right", marginTop: "4px" }}>
                  {(currentEntry.comment || "").length}/500 characters
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* Submit Bottom Bar */}
      {subjects.length > 0 && (
        <div className={styles.submitBar}>
          <div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "#1e293b" }}>
              Ready to submit?
            </div>
            <div style={{ fontSize: "13px", color: "#64748b" }}>
              {totalAnsweredQuestions === totalRequiredQuestions ? (
                <span style={{ color: "#16a34a", fontWeight: 600 }}>✓ All {totalRequiredQuestions} questions answered</span>
              ) : (
                <span style={{ color: "#b45309" }}>{totalRequiredQuestions - totalAnsweredQuestions} questions remaining</span>
              )}
            </div>
          </div>

          <button
            type="button"
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={submitting || totalAnsweredQuestions < totalRequiredQuestions}
          >
            {submitting ? (
              <span>Submitting...</span>
            ) : (
              <>
                <Send size={18} /> Submit Feedback
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
