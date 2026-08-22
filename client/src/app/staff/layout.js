import Sidebar from "../components/staff_sidebar";
import Admin_top from "../components/admin_top";

export default function AdminLayout({ children }) {
  return (
    <div className="admin-container">
      <Sidebar />

      <div className="main-content">
        <Admin_top />

        <div className="page-content">
          {children}
        </div>
      </div>
    </div>
  );
}