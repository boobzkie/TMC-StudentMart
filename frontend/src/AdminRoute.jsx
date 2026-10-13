import { Navigate } from "react-router-dom";

function AdminRoute({ children }) {
  const token = localStorage.getItem("token");
  const role = String(localStorage.getItem("role") || "").toLowerCase();

  if (!token) return <Navigate to="/login" replace />;
  if (role === "staff") return <Navigate to="/staff" replace />;

  if (role !== "admin") {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default AdminRoute;