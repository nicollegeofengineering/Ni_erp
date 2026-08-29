"use client";

import React from "react";
import StaffAssignedView from "@/app/components/StaffAssignedView";
import styles from "../subjects/subjects.module.css";

export default function StaffTimetablePage() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>My Timetable & Assigned Subjects</h1>
      </div>

      <StaffAssignedView role="Staff" allowStaffSelection={false} />
    </div>
  );
}
