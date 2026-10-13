import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  BarChart3,
  FileBarChart,
  MessageSquareWarning,
  Users,
  UserCheck,
  UserRoundX,
  UserPlus,
  ArrowRight,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import AdminLayout from "./components/AdminLayout";
import { API_URL } from "./utils/api";
import "./StaffDashboard.css";
import "./StaffInsights.css";

function readPermissions() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return Array.isArray(user.staff_permissions) ? user.staff_permissions : [];
  } catch {
    return [];
  }
}

export default function StaffDashboard() {
  const navigate = useNavigate();
  const permissions = readPermissions();
  const staffCanManageStudents = permissions.includes("manage_students");
  const staffCanModerateProducts = permissions.includes("moderate_products");
  const staffCanManageComplaints = permissions.includes("manage_complaints");
  const staffCanViewReports = permissions.includes("view_reports");
  const staffCanViewAnalytics = permissions.includes("view_analytics");
  const [stats, setStats] = useState(null);
  const [recentStudents, setRecentStudents] = useState([]);
  const [loading, setLoading] = useState(staffCanManageStudents);
  const [error, setError] = useState("");

  const tools = [
    staffCanManageStudents && { to: "/staff/users", label: "Manage students", description: "Find student accounts and update status.", icon: Users },
    staffCanModerateProducts && { to: "/staff/product-moderation", label: "Product moderation", description: "Review submitted marketplace listings.", icon: ShieldAlert },
    staffCanManageComplaints && { to: "/staff/complaints", label: "Complaints", description: "Review and handle student complaints.", icon: MessageSquareWarning },
    staffCanViewReports && { to: "/staff/reports", label: "Reports", description: "Review real product and complaint activity.", icon: FileBarChart },
    staffCanViewAnalytics && { to: "/staff/analytics", label: "Analytics", description: "Explore activity over a selected date range.", icon: BarChart3 },
  ].filter(Boolean);

  const loadDashboard = useCallback(async () => {
    if (!staffCanManageStudents) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      setError("");
      const token = localStorage.getItem("token");
      const response = await fetch(API_URL + "/staff/stats", {
        headers: { Accept: "application/json", Authorization: "Bearer " + token },
      });

      if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
        return;
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load the staff dashboard.");
      setStats(data.stats || {});
      setRecentStudents(Array.isArray(data.recent_students) ? data.recent_students : []);
    } catch (err) {
      setError(err.message || "Unable to load the staff dashboard.");
    } finally {
      setLoading(false);
    }
  }, [navigate, staffCanManageStudents]);

  useEffect(() => {
    const timer = setTimeout(loadDashboard, 0);
    return () => clearTimeout(timer);
  }, [loadDashboard]);

  const metricCards = [
    { label: "Total Students", key: "total_students", icon: Users, tone: "blue" },
    { label: "Active Students", key: "active_students", icon: UserCheck, tone: "green" },
    { label: "Inactive Students", key: "inactive_students", icon: UserRoundX, tone: "amber" },
    { label: "New in 30 Days", key: "new_students_30_days", icon: UserPlus, tone: "purple" },
  ];

  return (
    <AdminLayout title="Staff Dashboard" subtitle="Your assigned StudentMart workspace">
      <section className="staff-dashboard">
        <div className="staff-welcome-card">
          <div>
            <span className="staff-eyebrow">STAFF WORKSPACE</span>
            <h2>{staffCanManageStudents ? "Student account overview" : "Welcome to your workspace"}</h2>
            <p>{staffCanManageStudents ? "Review student account activity and update account status when needed." : "Open the tools assigned to your Staff account."}</p>
          </div>
          {staffCanManageStudents && <Link className="staff-primary-link" to="/staff/users">Manage students <ArrowRight size={17} /></Link>}
        </div>

        {error && <div className="staff-dashboard-error" role="alert"><span>{error}</span><button type="button" onClick={loadDashboard}>Try again</button></div>}

        {staffCanManageStudents && <>
          <div className="staff-metric-grid">
            {metricCards.map((card) => {
              const Icon = card.icon;
              return <article className={"staff-metric-card " + card.tone} key={card.key}><div className="staff-metric-icon"><Icon size={20} /></div><span>{card.label}</span><strong>{loading ? "—" : (stats?.[card.key] ?? 0)}</strong></article>;
            })}
          </div>
          <section className="staff-recent-card">
            <div className="staff-recent-heading"><div><h3>Recently registered students</h3><p>Latest student accounts added to StudentMart.</p></div><button className="staff-dashboard-refresh-button" type="button" onClick={loadDashboard} disabled={loading} aria-label="Refresh dashboard"><RefreshCw size={16} />Refresh</button></div>
            {loading ? <div className="staff-recent-empty">Loading student activity...</div> : recentStudents.length === 0 ? <div className="staff-recent-empty">No students have registered yet.</div> : <div className="staff-recent-table-wrap"><table className="staff-recent-table"><thead><tr><th>Student</th><th>Student ID</th><th>Email</th><th>Status</th><th>Registered</th></tr></thead><tbody>{recentStudents.map((student) => <tr key={student.id}><td>{student.name || "—"}</td><td>{student.student_id || "—"}</td><td>{student.email || "—"}</td><td><span className={"staff-status " + String(student.status || "").toLowerCase()}>{student.status || "Unknown"}</span></td><td>{student.created_at ? new Date(student.created_at).toLocaleDateString() : "—"}</td></tr>)}</tbody></table></div>}
          </section>
        </>}

        <section className="staff-tool-section">
          <div className="staff-tool-heading"><div><span className="staff-eyebrow">ASSIGNED ACCESS</span><h2>Available tools</h2></div><Activity size={20} aria-hidden="true" /></div>
          {tools.length === 0 ? <div className="staff-recent-empty">No Staff tools are assigned yet. Contact an administrator to request access.</div> : <div className="staff-tool-grid">{tools.map(({ to, label, description, icon: Icon }) => <Link className="staff-tool-card" key={to} to={to}><span className="staff-tool-icon"><Icon size={19} /></span><strong>{label}</strong><p>{description}</p><span className="staff-tool-open">Open tool <ArrowRight size={15} /></span></Link>)}</div>}
        </section>
      </section>
    </AdminLayout>
  );
}
