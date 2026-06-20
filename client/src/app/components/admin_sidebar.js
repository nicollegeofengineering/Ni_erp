"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserCog,
  Wallet,
  ClipboardList,
  CalendarCheck,
  CalendarClock,
} from "lucide-react";
import style from "./css/admin_sidebar.module.css";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/students", label: "Students", icon: Users },
  { href: "/admin/staff", label: "Staff", icon: UserCog },
  { href: "/admin/fees", label: "Fees", icon: Wallet },
  { href: "/admin/marks", label: "Marks", icon: ClipboardList },
  { href: "/admin/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/admin/timetable", label: "Timetable", icon: CalendarClock },
];

export default function AdminSidebar() {
  const [open, setOpen] = useState(false);
  const sidebarRef = useRef(null);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  },[])

  // Close sidebar when clicking outside of it
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

  // Close the drawer automatically after navigating to a new route
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <button
        id="menu-toggle-btn"
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className={`${style.menuBtn} ${open ? style.menuBtnOpen : ""}`}
        onClick={() => setOpen(!open)}
      >
        <span className={style.bar} />
        <span className={style.bar} />
        <span className={style.bar} />
      </button>

      <nav
        ref={sidebarRef}
        aria-label="Admin navigation"
        className={`${style.sidebar} ${open ? style.open : ""}`}
      >
        <div className={style.brand}>Admin Panel</div>

        <ul className={style.navList}>
          {NAV_ITEMS.map(({ href, label, icon: Icon }, i) => {
            const isActive = pathname === href;
            return (
              <li key={href} style={{ "--i": i }}>
                <Link
                  href={href}
                  onClick={() => setOpen(!open)}
                  className={`${style.navLink} ${isActive ? style.active : ""}`}
                >
                  <Icon className={style.icon} size={20} strokeWidth={2} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {open && (
        <div
          className={style.overlay}
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}