"use client";
import styles from "./page.module.css";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import Link from "next/link";
import Header from "../components/header";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorTimeout, setErrorTimeout] = useState(5);
  const [success, setSuccess] = useState(false);

  // Extract token from URL
  useEffect(() => {
    const t = searchParams.get("token");
    if (t) {
      setToken(t);
    } else {
      setError("Invalid or missing reset token");
      setErrorTimeout(5);
    }
  }, [searchParams]);

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

    if (!password || !confirmPassword) {
      setError("Please fill in all fields");
      setErrorTimeout(5);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      setErrorTimeout(5);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setErrorTimeout(5);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/reset-password`,
        { token, password },
        { withCredentials: true }
      );

      const data = response.data;
      if (data.status === "success") {
        setSuccess(true);
        // Redirect to login after 3 seconds
        setTimeout(() => router.push("/"), 3000);
      } else {
        setError(data.message || "Password reset failed");
        setErrorTimeout(5);
      }
    } catch (err) {
      console.error("Reset error:", err);
      const msg = err.response?.data?.message || "Server error. Please try again.";
      setError(msg);
      setErrorTimeout(5);
    } finally {
      setLoading(false);
    }
  };

  // Success view
  if (success) {
    return (
        <>
        <Header />
      <div className={styles.wrapper}>
        <div className={styles.card1}>
          <h1 className={styles.title}>✅ Password Reset</h1>
          <p className={styles.subtitle}>
            Your password has been updated successfully.
            <br />
            You will be redirected to the login page shortly.
          </p>
          <Link href="/" className={styles.primaryBtn}>
            Go to Login
          </Link>
        </div>
      </div>
      </>
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
          Reset Password <span>🔐</span>
        </h1>
        <p className={styles.subtitle}>
          Create a new password for your account
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label>New Password</label>
          <input
            className={styles.darkInput}
            type="password"
            placeholder="Enter new password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />

          <label>Confirm Password</label>
          <input
            className={styles.darkInput}
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
          />

          <button
            className={styles.primaryBtn1}
            type="submit"
            disabled={loading || !token}
          >
            {loading ? "Resetting..." : "Reset Password"}
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