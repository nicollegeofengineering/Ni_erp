"use client";
import styles from "./page.module.css";
import Header from "./components/header";
import { useState, useEffect } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { GoogleLogin } from "@react-oauth/google";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [error, setError] = useState("");
  const [errorTimeout, setErrorTimeout] = useState(5);
  const router = useRouter();

  // ---------- Auto-login check ----------
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/me`,
          { withCredentials: true }
        );
        if (response.data.status === "success") {
          const user = response.data.user;
          // Store user data in sessionStorage for other pages
          sessionStorage.setItem("isLoggedIn", "true");
          sessionStorage.setItem("role", user.role);
          sessionStorage.setItem("userName", user.name);
          if (user.profile_image) {
            sessionStorage.setItem("profileImage", user.profile_image);
          } else {
            sessionStorage.setItem("profileImage", "/user.png");
          }

          // Redirect based on role
          const role = user.role;
          if (role === "Admin") router.push("/admin");
          else if (role === "Student") router.push("/student");
          else if (role === "Staff") router.push("/staff");
          else if (role === "Hod") router.push("/hod");
          else {
            setLoadingAuth(false);
          }
        } else {
          setLoadingAuth(false);
        }
      } catch (err) {
        setLoadingAuth(false);
      }
    };

    checkAuth();
  }, [router]);

  // ---------- Token refresh ----------
  useEffect(() => {
    const refreshInterval = setInterval(async () => {
      try {
        await axios.post(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/refresh-token`,
          {},
          { withCredentials: true }
        );
      } catch (err) {
        console.log("Token refresh failed:", err);
      }
    }, 15 * 60 * 1000);
    return () => clearInterval(refreshInterval);
  }, []);

  // ---------- Auto-dismiss error ----------
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

  // ---------- Email/Password Login ----------
  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required");
      setErrorTimeout(5);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/login`,
        { email, password },
        { withCredentials: true }
      );

      const data = response.data;
      if (data.status === "success") {
        // ✅ Store name, role, and profile image
        sessionStorage.setItem("isLoggedIn", "true");
        sessionStorage.setItem("role", data.role);
        sessionStorage.setItem("userName", data.name);
        if (data.profile_image) {
          sessionStorage.setItem("profileImage", data.profile_image);
        } else {
          sessionStorage.setItem("profileImage", "/user.png"); // fallback
        }

        // Redirect based on role
        const role = data.role;
        if (role === "Admin") {
          router.push("/admin");
        } else if (role === "Student") {
          router.push("/student");
        } else if (role === "Staff") {
          router.push("/staff");
        } else if (role === "Hod") {
          router.push("/hod");
        } else {
          setError("Unknown user role");
          setErrorTimeout(5);
          setLoading(false);
        }
      } else {
        setError(data.message || "Login failed");
        setErrorTimeout(5);
      }
    } catch (err) {
      console.error("Login error:", err);
      const msg = err.response?.data?.message || "Server error. Please try again.";
      setError(msg);
      setErrorTimeout(5);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Google Login ----------
  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    try {
      const { credential } = credentialResponse;
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/verify_google`,
        { token: credential },
        { withCredentials: true }
      );
      const data = response.data;

      if (data.emessage) {
        setError(data.emessage);
        setErrorTimeout(5);
        return;
      }
      if (data.profile_image) {
        sessionStorage.setItem("profileImage", data.profile_image);
      } else {
        sessionStorage.setItem("profileImage", "/user.png");
      }
      if (data.status === "success") {
        sessionStorage.setItem("isLoggedIn", "true");
        sessionStorage.setItem("role", data.role);
        sessionStorage.setItem("userName", data.name);
        const role = data.role;
        if (role === "Admin") router.push("/admin");
        else if (role === "Student") router.push("/student");
        else if (role === "Staff") router.push("/staff");
        else if (role === "Hod") router.push("/hod");
        else {
          setError("Unknown user role");
          setErrorTimeout(5);
        }
      }
    } catch (err) {
      console.error("Google login error:", err);
      setError(err.response?.data?.emessage || "Google login failed");
      setErrorTimeout(5);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError("Google sign‑in failed. Please try again.");
    setErrorTimeout(5);
    setLoading(false);
  };

  // ---------- Loading state ----------
  if (loadingAuth) {
    return (
      <>
        <Header />
        <div className={styles.wrapper}>
          <div className={styles.card} style={{ textAlign: "center" }}>
            <div className={styles.spinner} style={{ margin: "40px auto" }}></div>
            <p>Checking session...</p>
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
            Welcome back <span>👋</span>
          </h1>
          <p className={styles.subtitle}>Sign in to your college portal</p>

          <div className={styles.form}>
            <label>College Email Address</label>
            <input
              className={styles.darkInput}
              type="email"
              placeholder="example@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <label>Password</label>
            <input
              className={styles.darkInput}
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />

            <div className={styles.forgotRow}>
              <a href="/forgot-password" className={styles.forgotLink}>
                Forgot password?
              </a>
            </div>

            <button
              className={styles.primaryBtn}
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In →"}
            </button>

            <div className={styles.divider}>
              <span>or continue with</span>
            </div>

            <div className={styles.googleWrapper}>
              {loading ? (
                <button className={styles.googleLoading} disabled>
                  <span className={styles.spinner}></span>
                  Signing in...
                </button>
              ) : (
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  onClick={() => setLoading(true)}
                  theme="filled_white"
                  shape="pill"
                  text="continue_with"
                  ux_mode="popup"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}