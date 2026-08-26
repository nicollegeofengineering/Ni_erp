"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  CalendarCheck,
  BookOpen,
  CalendarRange,
  Megaphone,
  MessageSquareCheck,
  User,
} from "lucide-react";

import style from "./css/admin_sidebar.module.css";

const NAV_ITEMS = [
  {
    href: "/student",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/student/marks",
    label: "Marks",
    icon: ClipboardList,
  },
  {
    href: "/student/attendance",
    label: "Attendance",
    icon: CalendarCheck,
  },
  {
    href: "/student/classes",
    label: "Classes",
    icon: BookOpen,
  },
  {
    href: "/student/timetable",
    label: "Timetable",
    icon: CalendarRange,
  },
  {
    href: "/student/exam-timetable",
    label: "Exam Timetable",
    icon: CalendarCheck,
  },
  {
    href: "/student/announcements",
    label: "Announcements",
    icon: Megaphone,
  },
  {
    href: "/student/feedback",
    label: "Course Feedback",
    icon: MessageSquareCheck,
  },
  {
    href: "/student/profile",
    label: "My Profile",
    icon: User,
  },
];

export default function StudentSidebar() {
  const [open, setOpen] = useState(false);
  const sidebarRef = useRef(null);
  const pathname = usePathname();

  // Close sidebar after navigation
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        open &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target) &&
        event.target.id !== "menu-toggle-btn"
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <>
      <button
        id="menu-toggle-btn"
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className={`${style.menuBtn} ${open ? style.menuBtnOpen : ""}`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={style.bar} style={{ backgroundColor: "#142447", display: "block" }} />
        <span className={style.bar} style={{ backgroundColor: "#142447", display: "block" }} />
        <span className={style.bar} style={{ backgroundColor: "#142447", display: "block" }} />
      </button>

      {open && (
        <div
          className={style.overlay}
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        ref={sidebarRef}
        className={`${style.sidebar} ${open ? style.open : ""}`}
        aria-label="Student Navigation"
      >
        <div className={style.brand}>
          <span className={style.brandName}>Student Portal</span>
        </div>

        <nav className={style.nav}>
          <ul className={style.navList}>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <li key={item.label} className={style.navItem}>
                  <Link
                    href={item.href}
                    className={`${style.navLink} ${
                      isActive ? style.activeLink : ""
                    }`}
                  >
                    <Icon className={style.icon} size={20} />
                    <span className={style.label}>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}
