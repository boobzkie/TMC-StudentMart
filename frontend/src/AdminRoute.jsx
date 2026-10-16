import { Navigate } from "react-router-dom";
import { clearAuth, getStoredRole, getStoredUser, getToken, isPortalRole } from "./utils/auth";

function AdminRoute({ children }) {
  const token = getToken();
  const role = getStoredRole();
  const user = getStoredUser();

  if (!token || !user) {
    clearAuth();
    return <Navigate to="/login" replace />;
  }

  if (!isPortalRole(role)) {
    clearAuth();
    return <Navigate to="/login" replace />;
  }

  if (role === "staff") {
    return <Navigate to="/staff" replace />;
  }

  if (role !== "admin") {
    clearAuth();
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default AdminRoute;