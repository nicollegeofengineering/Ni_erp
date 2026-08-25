"use client";

import style from "./css/admin-top.module.css";
import styles from "./css/header.module.css";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import NotificationBell from "./NotificationBell";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export default function AdminTop() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("Admin");
  const [profileImage, setProfileImage] = useState("/user.png");

  // ---------- Helper: redirect on unauthorized (islogout) ----------
  const handleUnauthorized = (error) => {
    sessionStorage.removeItem("isLoggedIn");
    sessionStorage.removeItem("role");
    sessionStorage.removeItem("userName");
    sessionStorage.removeItem("profileImage");
    if (
      error?.response?.data?.islogout === true ||
      !error?.response?.data?.status ||
      error?.response?.status === 401
    ) {
      router.push("/");
      return true;
    }
    return false;
  };

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/user/profile`, {
          withCredentials: true,
        });

        if (res.data.success) {
          const u = res.data.data;
          const role = res.data.role || u.role || sessionStorage.getItem("role") || "Admin";
          setUserRole(role);
          sessionStorage.setItem("role", role);

          const name = u.name || u.first_name || u.username || "User";
          setUserName(name);
          sessionStorage.setItem("userName", name);

          if (u.profile_image) {
            const imgUrl = u.profile_image.startsWith("http")
              ? u.profile_image
              : u.profile_image === "/user.png"
              ? "/user.png"
              : `${BASE_URL}${u.profile_image.startsWith("/") ? "" : "/"}${u.profile_image}`;
            setProfileImage(imgUrl);
            sessionStorage.setItem("profileImage", imgUrl);
          }
        }
      } catch (err) {
        const name = sessionStorage.getItem("userName") || "";
        const role = sessionStorage.getItem("role") || "Admin";
        const img = sessionStorage.getItem("profileImage") || "/user.png";
        setUserName(name);
        setUserRole(role);
        setProfileImage(
          img.startsWith("http") || img === "/user.png"
            ? img
            : `${BASE_URL}${img.startsWith("/") ? "" : "/"}${img}`
        );
      }
    };

    fetchUserProfile();
  }, []);

  const handleLogout = async () => {
    try {
      const result = await axios.post(
        `${BASE_URL}/auth/logout`,
        {},
        {
          withCredentials: true,
          headers: { "Content-Type": "application/json" },
        }
      );

      if (
        result.data.status === "success" ||
        result.data.islogout === true ||
        result.data.status === "failed"
      ) {
        sessionStorage.removeItem("isLoggedIn");
        sessionStorage.removeItem("role");
        sessionStorage.removeItem("userName");
        sessionStorage.removeItem("profileImage");
        window.location.href = "/";
        return;
      }
    } catch (error) {
      if (handleUnauthorized(error)) return;
      console.error("Logout failed:", error.response?.data || error.message);
      alert("Logout failed: " + (error.response?.data?.error || error.message));
    }
  };

  const getProfilePath = () => {
    const r = userRole.toLowerCase();
    if (r === "hod") return "/hod/profile";
    if (r === "staff") return "/staff/profile";
    return "/admin/profile";
  };

  return (
    <div className={style.container}>
      <div className={style.logo}>
        <img
          src="/logoni1.png"
          alt="Logo"
          height={100}
          width={100}
          className={style.logoImage}
        />
      </div>
      <div className={style.right_con}>
        <NotificationBell />

        <Link
          href={getProfilePath()}
          className={style.profileLink}
          title="View My Profile"
        >
          <div className={style.userImageWrapper}>
            <img
              src={profileImage}
              alt="User"
              className={style.userImage}
              onError={(e) => {
                e.target.src = "/user.png";
              }}
              id="hide-on-pdf"
            />
          </div>
          <div className={style.userInfo}>
            <span
              className={style.userName}
              id="hide-on-pdf"
            >
              {userName || "User"}
            </span>
            <span
              className={style.userRole}
              id="hide-on-pdf"
            >
              {userRole}
            </span>
          </div>
        </Link>

        <button
          className={style.logout_btn}
          onClick={handleLogout}
          id="hide-on-pdf"
        >
          Logout
        </button>
      </div>
    </div>
  );
}