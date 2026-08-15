"use client";
import style from "./css/admin-top.module.css";
import styles from "./css/header.module.css";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function AdminTop() {
    const router = useRouter();
    const [userName, setUserName] = useState("");
    const [profileImage, setProfileImage] = useState("/user.png");

    // ---------- Helper: redirect on unauthorized (islogout) ----------
  const handleUnauthorized = (error) => {
    sessionStorage.removeItem("isLoggedIn");
    sessionStorage.removeItem("role");
    sessionStorage.removeItem("userName");
    sessionStorage.removeItem("profileImage");
    if (error?.response?.data?.islogout === true || !error?.response?.data?.status || error?.response?.status === 401) {
      router.push("/");
      return true;
    }
    return false;
  };

    useEffect(() => {
        const name = sessionStorage.getItem("userName") || "";
        const img = sessionStorage.getItem("profileImage") || "/user.png";
        setUserName(name);
        setProfileImage(`${process.env.NEXT_PUBLIC_BACKEND_URL}${img}`);
    }, []);

    const handleLogout = async () => {
        try {
            const result = await axios.post(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/logout`,
                {},
                {
                    withCredentials: true,
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            if (result.data.status === "success" || result.data.islogout === true || result.data.status === "failed") {
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
                <div className={styles.userImageWrapper}>
                    <img
                        src={profileImage}
                        alt="User"
                        className={styles.userImage}
                        id="hide-on-pdf"
                    />
                </div>
                <span className={style.userName}id="hide-on-pdf">{userName}</span>
                <button className={style.logout_btn} onClick={handleLogout} id="hide-on-pdf">
                    Logout
                </button>
            </div>
        </div>
    );
}