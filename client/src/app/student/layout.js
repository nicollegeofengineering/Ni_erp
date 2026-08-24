import StudentSidebar from "../components/student_sidebar";
import StudentTop from "../components/student_top";

export default function StudentLayout({ children }) {
  return (
    <div className="admin-container">
      <StudentSidebar />

      <div className="main-content">
        <StudentTop />

        <div className="page-content">
          {children}
        </div>
      </div>
    </div>
  );
}
