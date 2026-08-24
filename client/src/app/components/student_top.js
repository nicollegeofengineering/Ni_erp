"use client";

import style from "./css/admin-top.module.css";
import styles from "./css/header.module.css";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export default function StudentTop() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [profileImage, setProfileImage] = useState("/user.png");

  const handleUnauthorized = () => {
    sessionStorage.removeItem("isLoggedIn");
    sessionStorage.removeItem("role");
    sessionStorage.removeItem("userName");
    sessionStorage.removeItem("profileImage");
    router.push("/");
    return true;
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/api/student/profile`, {
          withCredentials: true,
        });

        if (res.data.success) {
          const s = res.data.data;
          const fullName =
            s.name ||
            `${s.first_name || ""} ${s.last_name || ""}`.trim() ||
            s.register_no ||
            "Student";
          setUserName(fullName);
          sessionStorage.setItem("userName", fullName);

          if (s.profile_image) {
            const imgUrl = s.profile_image.startsWith("http")
              ? s.profile_image
              : s.profile_image === "/user.png"
              ? "/user.png"
              : `${BASE_URL}${s.profile_image.startsWith("/") ? "" : "/"}${s.profile_image}`;
            setProfileImage(imgUrl);
            sessionStorage.setItem("profileImage", imgUrl);
          }
        }
      } catch (err) {
        const name = sessionStorage.getItem("userName") || "Student";
        const img = sessionStorage.getItem("profileImage") || "/user.png";
        setUserName(name);
        setProfileImage(img);
      }
    };
    fetchProfile();
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
      }
    } catch (error) {
      handleUnauthorized();
    }
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
        <Link
          href="/student/profile"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            textDecoration: "none",
            color: "inherit",
          }}
          title="View My Profile"
        >
          <div
            className={style.userImageWrapper}
            style={{
              width: "42px",
              height: "42px",
              borderRadius: "50%",
              overflow: "hidden",
              border: "2px solid #0381ff",
              position: "relative",
              flexShrink: 0,
              background: "#f1f5f9",
            }}
          >
            <img
              src={profileImage}
              alt="Student"
              className={style.userImage}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                borderRadius: "50%",
              }}
              onError={(e) => {
                e.target.src = "/user.png";
              }}
              id="hide-on-pdf"
            />
          </div>
          <span
            className={style.userName}
            style={{
              fontWeight: 700,
              color: "#0b1d3a",
              fontSize: "14px",
            }}
            id="hide-on-pdf"
          >
            {userName || "Student"}
          </span>
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
