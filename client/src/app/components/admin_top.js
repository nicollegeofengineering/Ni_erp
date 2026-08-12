"use client";
import style from "./css/admin-top.module.css";
import styles from "./css/header.module.css";
import Image from "next/image";
import axios from "axios";
import { useState, useEffect } from "react";

export default function AdminTop() {
    const [userName, setUserName] = useState("");
    const [profileImage, setProfileImage] = useState("/user.png");

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

            if (result.data.status === "success") {
                // Clear all session data
                sessionStorage.removeItem("isLoggedIn");
                sessionStorage.removeItem("role");
                sessionStorage.removeItem("userName");
                sessionStorage.removeItem("profileImage");
                window.location.href = "/";
            }
        } catch (error) {
            console.error("Logout failed:", error.response?.data || error.message);
            alert("Logout failed: " + (error.response?.data?.error || error.message));
        }
    };

    return (
        <div className={style.container}>
            <div className={style.logo}>
                <Image
                    src="/logoni1.png"
                    alt="Logo"
                    height={100}
                    width={100}
                    className={style.logoImage}
                    unoptimized
                    priority
                />
            </div>
            <div className={style.right_con}>
                <div className={styles.userImageWrapper}>
                <Image
                    src={profileImage}
                    alt="User"
                    height={45}
                    width={45}
                    className={styles.userImage}
                    unoptimized
                    priority
                    id="hide-on-pdf"
                />
                </div>
                <span className={style.userName}>{userName}</span>
                <button className={style.logout_btn} onClick={handleLogout} id="hide-on-pdf">
                    Logout
                </button>
            </div>
        </div>
    );
}