"use client";
import styles from "./forget.module.css";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import Link from "next/link";
import Header from "../components/header";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorTimeout, setErrorTimeout] = useState(5);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  // Auto‑dismiss error after a few seconds
  useEffect(() => {
    if (errorTimeout === 0) {
      setError("");
      setErrorTimeout(5);
    }
    if (error && errorTimeout > 0) {
      const timer = setTimeout(() => setErrorTimeout(errorTimeout - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [error, errorTimeout]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim()) {
      setError("Email is required");
      setErrorTimeout(5);
      return;
    }

    // Simple email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      setErrorTimeout(5);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/forgot-password`,
        { email },
        { withCredentials: true }
      );

      // Backend always returns a 200 with a success message (even if email not found)
      setSuccess(true);
      // Clear any previous errors
      setError("");
    } catch (err) {
      console.error("Forgot password error:", err);
      const msg = err.response?.data?.message || "Server error. Please try again.";
      setError(msg);
      setErrorTimeout(5);
    } finally {
      setLoading(false);
    }
  };

  // If success, show confirmation without the form
  if (success) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.card}>
          <h1 className={styles.title}>📧 Check Your Email</h1>
          <p className={styles.subtitle}>
            If an account exists with <strong>{email}</strong>, you will receive
            a password reset link shortly.
          </p>
          <p className={styles.subtitle} style={{ marginTop: "8px", fontSize: "14px" }}>
            The link will expire in 15 minutes.
          </p>
          <div className={styles.successActions}>
            <Link href="/" className={styles.primaryBtn}>
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <Header />
    <div className={styles.wrapper}>
      {error && (
        <div className={styles.error}>
          <span className={styles.errorIcon}>⚠️</span>
          <p>{error}</p>
          <button onClick={() => setError("")}>✕</button>
        </div>
      )}
      <div className={styles.card}>
        <h1 className={styles.title}>
          Forgot Password <span>🔑</span>
        </h1>
        <p className={styles.subtitle}>
          Enter your email address and we'll send you a link to reset your password.
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label>Email Address</label>
          <input
            className={styles.darkInput}
            type="email"
            placeholder="you@college.edu.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <button
            className={styles.primaryBtn}
            type="submit"
            disabled={loading}
          >
            {loading ? "Sending..." : "Send Reset Link →"}
          </button>

          <div className={styles.loginLink}>
            <Link href="/">← Back to Login</Link>
          </div>
        </form>
      </div>
    </div>
    </>
  );
}