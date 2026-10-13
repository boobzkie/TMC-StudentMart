import { Navigate } from "react-router-dom";

function StaffRoute({ children }) {
  const token = localStorage.getItem("token");
  const role = String(localStorage.getItem("role") || "").toLowerCase();

  if (!token) return <Navigate to="/login" replace />;
  if (role === "admin") return <Navigate to="/admin" replace />;

  if (role !== "staff") {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default StaffRoute;