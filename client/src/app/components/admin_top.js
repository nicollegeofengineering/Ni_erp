"use client"
import style from "./css/admin-top.module.css";
import styles from "./css/header.module.css";
import Image from "next/image";
import axios from "axios";

export default function AdminTop() {

    const handleLogout = async () => {
        try {
            const result = await axios.post(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/logout`, 
                {}, 
                { 
                    withCredentials: true,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            if (result.data.status === "success") {
                sessionStorage.removeItem("isLoggedIn");
                sessionStorage.removeItem("role");
                
                window.location.href = "/";
            }
        } catch (error) {
            console.error("Logout failed:", error.response?.data || error.message);
            alert("Logout failed: " + (error.response?.data?.error || error.message));
        }
    }

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
            <Image
                src="/user.png"
                alt="User"
                height={35}
                width={35}
                className={styles.userImage}
                unoptimized
                priority
                id="hide-on-pdf"
            />
            <button className={style.logout_btn} onClick={handleLogout} id="hide-on-pdf">
                Logout
            </button>
        </div>
            
        </div>
    )
}