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
  Building2,
  BookOpen,
  CalendarRange,
  UserRoundCheck,
  ChevronRight,
} from "lucide-react";

import style from "./css/admin_sidebar.module.css";

const NAV_ITEMS = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Students",
    icon: Users,
    children: [
      { href: "/admin/students", label: "View Students" },
      { href: "/admin/students/add", label: "Add Students" },
    ],
  },
  {
    label: "Staff",
    icon: UserCog,
    children: [
      { href: "/admin/staff", label: "View Staff" },
      { href: "/admin/staff/add", label: "Add Staff" },
    ],
  },
  {
    href: "/admin/fees",
    label: "Fees",
    icon: Wallet,
  },
  {
    label: "Marks",
    icon: ClipboardList,
    children: [
      { href: "/admin/marks", label: "View Marks" },
      { href: "/admin/marks/add", label: "Add Marks" },
      { href: "/admin/marks/edit", label: "Edit Marks" },
    ],
  },
  {
    href: "/admin/attendance",
    label: "Attendance",
    icon: CalendarCheck,
  },
  {
    href: "/admin/hall",
    label: "Hall Management",
    icon: Building2,
  },
  {
    href: "/admin/subjects",
    label: "Subjects",
    icon: BookOpen,
  },
  {
    href: "/admin/department",
    label: "Department",
    icon: Building2,
  },
  {
    label: "Timetable",
    icon: CalendarRange,
    children: [
      { href: "/admin/timetable/master", label: "Master Timetable" },
      { href: "/admin/timetable/class", label: "Class Timetable" },
      { href: "/admin/timetable/staff", label: "Staff Timetable" },
      { href: "/admin/timetable/hall", label:"Hall Timetable"}
    ],
  },
  {
    href: "/admin/hall-allocation",
    label: "Hall Allocation",
    icon: UserRoundCheck,
  },
];

export default function AdminSidebar() {
  const [open, setOpen] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState(null);

  const sidebarRef = useRef(null);
  const pathname = usePathname();

  // Auto‑open submenu based on current route
  useEffect(() => {
    const activeParent = NAV_ITEMS.find((item) =>
      item.children?.some((child) => pathname.startsWith(child.href))
    );
    if (activeParent) {
      setOpenSubmenu(activeParent.label);
    }
  }, [pathname]);

  // Close sidebar after navigation
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close sidebar when clicking outside
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

  const handleSubmenuToggle = (label) => {
    setOpenSubmenu((current) => (current === label ? null : label));
  };

  const isRouteActive = (href) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href;
  };

  const isParentActive = (children) => {
    return children?.some((child) => pathname === child.href);
  };

  return (
    <>
      {/* ---------- MENU BUTTON (with inline styles as fallback) ---------- */}
      <button
        id="menu-toggle-btn"
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className={`${style.menuBtn} ${open ? style.menuBtnOpen : ""}`}
        onClick={() => setOpen((current) => !current)}
        style={{
          position: "fixed",
          top: "108px",
          left: "20px",
          zIndex: 1002,
          width: "44px",
          height: "44px",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "5px",
          border: "none",
          borderRadius: "12px",
          background: "#ffffff",
          boxShadow: "0 4px 14px rgba(20,36,71,0.16)",
          cursor: "pointer",
        }}
      >
        <span
          className={style.bar}
          style={{
            display: "block",
            width: "20px",
            height: "2.5px",
            background: "#142447",
            borderRadius: "2px",
            transition: "transform 0.25s ease, opacity 0.2s ease",
            transform: open ? "translateY(7px) rotate(45deg)" : "translateY(0) rotate(0)",
          }}
        />
        <span
          className={style.bar}
          style={{
            display: "block",
            width: "20px",
            height: "2.5px",
            background: "#142447",
            borderRadius: "2px",
            transition: "transform 0.25s ease, opacity 0.2s ease",
            opacity: open ? 0 : 1,
            transform: open ? "scaleX(0)" : "scaleX(1)",
          }}
        />
        <span
          className={style.bar}
          style={{
            display: "block",
            width: "20px",
            height: "2.5px",
            background: "#142447",
            borderRadius: "2px",
            transition: "transform 0.25s ease, opacity 0.2s ease",
            transform: open ? "translateY(-7px) rotate(-45deg)" : "translateY(0) rotate(0)",
          }}
        />
      </button>

      {/* ---------- SIDEBAR ---------- */}
      <nav
        ref={sidebarRef}
        aria-label="Admin navigation"
        className={`${style.sidebar} ${open ? style.open : ""}`}
      >
        <div className={style.brand}>Admin Panel</div>

        <ul className={style.navList}>
          {NAV_ITEMS.map((item, index) => {
            const { href, label, icon: Icon, children } = item;
            const hasChildren = Array.isArray(children) && children.length > 0;
            const active = hasChildren
              ? isParentActive(children)
              : isRouteActive(href);
            const submenuOpen = openSubmenu === label;

            return (
              <li key={label} style={{ "--i": index }}>
                {hasChildren ? (
                  <>
                    <button
                      type="button"
                      className={`${style.navLink} ${active ? style.active : ""}`}
                      onClick={() => handleSubmenuToggle(label)}
                      aria-expanded={submenuOpen}
                    >
                      <Icon className={style.icon} size={20} strokeWidth={2} aria-hidden="true" />
                      <span>{label}</span>
                      <ChevronRight
                        size={17}
                        className={`${style.chevron} ${submenuOpen ? style.chevronOpen : ""}`}
                        aria-hidden="true"
                      />
                    </button>

                    <div
                      className={`${style.submenu} ${submenuOpen ? style.submenuOpen : ""}`}
                    >
                      {children.map((child) => {
                        const childActive = pathname === child.href;
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={`${style.submenuLink} ${childActive ? style.submenuActive : ""}`}
                            onClick={() => setOpen(false)}
                          >
                            <span className={style.submenuDot} />
                            <span>{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`${style.navLink} ${active ? style.active : ""}`}
                  >
                    <Icon className={style.icon} size={20} strokeWidth={2} aria-hidden="true" />
                    <span>{label}</span>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ---------- OVERLAY ---------- */}
      {open && (
        <div className={style.overlay} onClick={() => setOpen(false)} aria-hidden="true" />
      )}
    </>
  );
}