import { Navigate, Route, Routes } from "react-router-dom";
import Login from "./Login";
import PasswordRecovery from "./PasswordRecovery";
import StaffRegistration from "./StaffRegistration";
import AdminDashboard from "./AdminDashboard";
import AdminUsers from "./AdminUsers";
import AdminProducts from "./AdminProducts";
import AdminCategories from "./AdminCategories";
import AdminProductModeration from "./AdminProductModeration";
import AdminSellers from "./AdminSellers";
import AdminTransactions from "./AdminTransactions";
import AdminOrderOptions from "./AdminOrderOptions";
import AdminCommission from "./AdminCommission";
import AdminReports from "./AdminReports";
import AdminAnalytics from "./AdminAnalytics";
import AdminActivityLogs from "./AdminActivityLogs";
import AdminNotifications from "./AdminNotifications";
import AdminComplaints from "./AdminComplaints";
import AdminStaff from "./AdminStaff";
import AccountSettings from "./AccountSettings";
import StaffDashboard from "./StaffDashboard";
import StaffComplaints from "./StaffComplaints";
import StaffInsights from "./StaffInsights";
import AdminRoute from "./AdminRoute";
import StaffRoute from "./StaffRoute";

function StaffProductModerationRoute() {
  let staffUser = {};
  try { staffUser = JSON.parse(localStorage.getItem("user") || "{}"); } catch { staffUser = {}; }
  const permissions = Array.isArray(staffUser.staff_permissions) ? staffUser.staff_permissions : [];
  return permissions.includes("moderate_products") ? <AdminProductModeration /> : <Navigate to="/staff" replace />;
}

function StaffUsersRoute() {
  let staffUser = {};
  try { staffUser = JSON.parse(localStorage.getItem("user") || "{}"); } catch { staffUser = {}; }
  const permissions = Array.isArray(staffUser.staff_permissions) ? staffUser.staff_permissions : [];
  return permissions.includes("manage_students") ? <AdminUsers /> : <Navigate to="/staff" replace />;
}

function readStaffPermissions() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return Array.isArray(user.staff_permissions) ? user.staff_permissions : [];
  } catch {
    return [];
  }
}

function StaffPermissionRoute({ permission, children }) {
  return readStaffPermissions().includes(permission)
    ? children
    : <Navigate to="/staff" replace />;
}

function StaffComplaintsRoute() {
  return <StaffPermissionRoute permission="manage_complaints"><StaffComplaints /></StaffPermissionRoute>;
}

function StaffReportsRoute() {
  return <StaffPermissionRoute permission="view_reports"><StaffInsights mode="reports" /></StaffPermissionRoute>;
}

function StaffAnalyticsRoute() {
  return <StaffPermissionRoute permission="view_analytics"><StaffInsights mode="analytics" /></StaffPermissionRoute>;
}

function App() {
  return <Routes>
    <Route path="/login" element={<Login />} /><Route path="/admin/login" element={<Login />} />
    <Route path="/forgot-password" element={<PasswordRecovery />} />
    <Route path="/password/reset" element={<PasswordRecovery />} />
    <Route path="/staff/register" element={<StaffRegistration />} />
    <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} /><Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
    <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} /><Route path="/admin/staff" element={<AdminRoute><AdminStaff /></AdminRoute>} />
    <Route path="/admin/products" element={<AdminRoute><AdminProducts /></AdminRoute>} /><Route path="/admin/categories" element={<AdminRoute><AdminCategories /></AdminRoute>} />
    <Route path="/admin/product-moderation" element={<AdminRoute><AdminProductModeration /></AdminRoute>} /><Route path="/admin/sellers" element={<AdminRoute><AdminSellers /></AdminRoute>} />
    <Route path="/admin/transactions" element={<AdminRoute><AdminTransactions /></AdminRoute>} /><Route path="/admin/order-options" element={<AdminRoute><AdminOrderOptions /></AdminRoute>} /><Route path="/admin/commission" element={<AdminRoute><AdminCommission /></AdminRoute>} />
    <Route path="/admin/reports" element={<AdminRoute><AdminReports /></AdminRoute>} /><Route path="/admin/analytics" element={<AdminRoute><AdminAnalytics /></AdminRoute>} /><Route path="/admin/activity-logs" element={<AdminRoute><AdminActivityLogs /></AdminRoute>} /><Route path="/admin/notifications" element={<AdminRoute><AdminNotifications /></AdminRoute>} />
    <Route path="/admin/complaints" element={<AdminRoute><AdminComplaints /></AdminRoute>} />
    <Route path="/admin/settings" element={<AdminRoute><AccountSettings /></AdminRoute>} />
    <Route path="/staff" element={<StaffRoute><StaffDashboard /></StaffRoute>} /><Route path="/staff/dashboard" element={<StaffRoute><StaffDashboard /></StaffRoute>} />
    <Route path="/staff/users" element={<StaffRoute><StaffUsersRoute /></StaffRoute>} />
    <Route path="/staff/product-moderation" element={<StaffRoute><StaffProductModerationRoute /></StaffRoute>} />
    <Route path="/staff/complaints" element={<StaffRoute><StaffComplaintsRoute /></StaffRoute>} />
    <Route path="/staff/reports" element={<StaffRoute><StaffReportsRoute /></StaffRoute>} />
    <Route path="/staff/analytics" element={<StaffRoute><StaffAnalyticsRoute /></StaffRoute>} />
    <Route path="/staff/settings" element={<StaffRoute><AccountSettings /></StaffRoute>} />
    <Route path="/" element={<Navigate to="/login" replace />} /><Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>;
}
export default App;
