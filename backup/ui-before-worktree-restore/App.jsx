import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ErrorBoundary from "./ErrorBoundary";
import AdminRoute from "./AdminRoute";
import StaffRoute from "./StaffRoute";

const Login = lazy(() => import("./Login"));
const PasswordRecovery = lazy(() => import("./PasswordRecovery"));
const StaffRegistration = lazy(() => import("./StaffRegistration"));
const AdminDashboard = lazy(() => import("./AdminDashboard"));
const AdminUsers = lazy(() => import("./AdminUsers"));
const AdminProducts = lazy(() => import("./AdminProducts"));
const AdminCategories = lazy(() => import("./AdminCategories"));
const AdminProductModeration = lazy(() => import("./AdminProductModeration"));
const AdminSellers = lazy(() => import("./AdminSellers"));
const AdminTransactions = lazy(() => import("./AdminTransactions"));
const AdminOrderOptions = lazy(() => import("./AdminOrderOptions"));
const AdminCommission = lazy(() => import("./AdminCommission"));
const AdminReports = lazy(() => import("./AdminReports"));
const AdminAnalytics = lazy(() => import("./AdminAnalytics"));
const AdminComplaints = lazy(() => import("./AdminComplaints"));
const AdminStaff = lazy(() => import("./AdminStaff"));
const AdminNotifications = lazy(() => import("./AdminNotifications"));
const AdminActivityLogs = lazy(() => import("./AdminActivityLogs"));
const AccountSettings = lazy(() => import("./AccountSettings"));
const StaffDashboard = lazy(() => import("./StaffDashboard"));
const StaffComplaints = lazy(() => import("./StaffComplaints"));
const StaffInsights = lazy(() => import("./StaffInsights"));
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
  return (
    <Suspense fallback={<div role="status" aria-live="polite" style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "var(--tmc-text-muted)" }}>Loading TMC StudentMart…</div>}>
      <Routes>
    <Route path="/login" element={<Login />} /><Route path="/admin/login" element={<Login />} />
    <Route path="/forgot-password" element={<PasswordRecovery />} />
    <Route path="/password/reset" element={<PasswordRecovery />} />
    <Route path="/staff/register" element={<StaffRegistration />} />
    <Route path="/admin" element={<ErrorBoundary><AdminRoute><AdminDashboard /></AdminRoute></ErrorBoundary>} /><Route path="/admin/dashboard" element={<ErrorBoundary><AdminRoute><AdminDashboard /></AdminRoute></ErrorBoundary>} />
    <Route path="/admin/users" element={<ErrorBoundary><AdminRoute><AdminUsers /></AdminRoute></ErrorBoundary>} /><Route path="/admin/staff" element={<ErrorBoundary><AdminRoute><AdminStaff /></AdminRoute></ErrorBoundary>} />
    <Route path="/admin/products" element={<ErrorBoundary><AdminRoute><AdminProducts /></AdminRoute></ErrorBoundary>} /><Route path="/admin/categories" element={<ErrorBoundary><AdminRoute><AdminCategories /></AdminRoute></ErrorBoundary>} />
    <Route path="/admin/product-moderation" element={<ErrorBoundary><AdminRoute><AdminProductModeration /></AdminRoute></ErrorBoundary>} /><Route path="/admin/sellers" element={<ErrorBoundary><AdminRoute><AdminSellers /></AdminRoute></ErrorBoundary>} />
    <Route path="/admin/transactions" element={<ErrorBoundary><AdminRoute><AdminTransactions /></AdminRoute></ErrorBoundary>} /><Route path="/admin/order-options" element={<ErrorBoundary><AdminRoute><AdminOrderOptions /></AdminRoute></ErrorBoundary>} /><Route path="/admin/commission" element={<ErrorBoundary><AdminRoute><AdminCommission /></AdminRoute></ErrorBoundary>} />
    <Route path="/admin/reports" element={<ErrorBoundary><AdminRoute><AdminReports /></AdminRoute></ErrorBoundary>} /><Route path="/admin/analytics" element={<ErrorBoundary><AdminRoute><AdminAnalytics /></AdminRoute></ErrorBoundary>} />
    <Route path="/admin/complaints" element={<ErrorBoundary><AdminRoute><AdminComplaints /></AdminRoute></ErrorBoundary>} />
    <Route path="/admin/notifications" element={<ErrorBoundary><AdminRoute><AdminNotifications /></AdminRoute></ErrorBoundary>} />
    <Route path="/admin/activity-logs" element={<ErrorBoundary><AdminRoute><AdminActivityLogs /></AdminRoute></ErrorBoundary>} />
    <Route path="/admin/settings" element={<ErrorBoundary><AdminRoute><AccountSettings /></AdminRoute></ErrorBoundary>} />
    <Route path="/staff" element={<ErrorBoundary><StaffRoute><StaffDashboard /></StaffRoute></ErrorBoundary>} /><Route path="/staff/dashboard" element={<ErrorBoundary><StaffRoute><StaffDashboard /></StaffRoute></ErrorBoundary>} />
    <Route path="/staff/users" element={<ErrorBoundary><StaffRoute><StaffUsersRoute /></StaffRoute></ErrorBoundary>} />
    <Route path="/staff/product-moderation" element={<ErrorBoundary><StaffRoute><StaffProductModerationRoute /></StaffRoute></ErrorBoundary>} />
    <Route path="/staff/complaints" element={<ErrorBoundary><StaffRoute><StaffComplaintsRoute /></StaffRoute></ErrorBoundary>} />
    <Route path="/staff/reports" element={<ErrorBoundary><StaffRoute><StaffReportsRoute /></StaffRoute></ErrorBoundary>} />
    <Route path="/staff/analytics" element={<ErrorBoundary><StaffRoute><StaffAnalyticsRoute /></StaffRoute></ErrorBoundary>} />
    <Route path="/staff/settings" element={<ErrorBoundary><StaffRoute><AccountSettings /></StaffRoute></ErrorBoundary>} />
    <Route path="/" element={<Navigate to="/login" replace />} /><Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    </Suspense>
  );
}
export default App;
