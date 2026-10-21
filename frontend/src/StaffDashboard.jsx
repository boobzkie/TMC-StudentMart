import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  Activity,
  ArrowRight,
  BarChart3,
  MessageSquareWarning,
  ShieldAlert,
  UserCheck,
  Users,
  UserRoundX,
  UserPlus,
} from "lucide-react";

import AdminLayout from "./components/AdminLayout";
import { API_URL } from "./utils/api";

import { Card, Badge, Button, SectionHeader, EmptyState, LoadingSpinner, StatCard } from "./ui";
import "./StaffDashboard.css";

function readPermissions() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return Array.isArray(user.staff_permissions) ? user.staff_permissions : [];
  } catch {
    return [];
  }
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatValue(value) {
  return toNumber(value).toLocaleString();
}

function formatDate(value) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleDateString(undefined, {
    dateStyle: "medium",
  });
}

const STAFF_METRIC_CARDS = [
  {
    key: "total_students",
    label: "Student Accounts",
    description: "Registered student users",
    icon: Users,
    tone: "primary",
  },
  {
    key: "active_students",
    label: "Active Accounts",
    description: "Students with active status",
    icon: UserCheck,
    tone: "success",
  },
  {
    key: "inactive_students",
    label: "Inactive Accounts",
    description: "Students needing attention",
    icon: UserRoundX,
    tone: "warning",
  },
  {
    key: "new_students_30_days",
    label: "New in 30 Days",
    description: "Recently registered accounts",
    icon: UserPlus,
    tone: "info",
  },
];

export default function StaffDashboard() {
  const navigate = useNavigate();
  const permissions = useMemo(() => readPermissions(), []);
  const staffCanManageStudents = permissions.includes("manage_students");
  const staffCanModerateProducts = permissions.includes("moderate_products");
  const staffCanManageComplaints = permissions.includes("manage_complaints");
  const staffCanViewReports = permissions.includes("view_reports");
  const staffCanViewAnalytics = permissions.includes("view_analytics");

  const [stats, setStats] = useState(null);
  const [recentStudents, setRecentStudents] = useState([]);
  const [loading, setLoading] = useState(staffCanManageStudents);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const tools = useMemo(
    () =>
      [
        staffCanManageStudents && {
          to: "/staff/users",
          label: "Manage Student Accounts",
          description: "Find student accounts and update account status.",
          icon: Users,
        },
        staffCanModerateProducts && {
          to: "/staff/product-moderation",
          label: "Product Moderation",
          description: "Review submitted marketplace listings.",
          icon: ShieldAlert,
        },
        staffCanManageComplaints && {
          to: "/staff/complaints",
          label: "Complaints",
          description: "Review and handle student complaints.",
          icon: MessageSquareWarning,
        },
        staffCanViewReports && {
          to: "/staff/reports",
          label: "Reports",
          description: "Review product and complaint activity.",
          icon: BarChart3,
        },
        staffCanViewAnalytics && {
          to: "/staff/analytics",
          label: "Analytics",
          description: "Explore activity over a selected date range.",
          icon: BarChart3,
        },
      ].filter(Boolean),
    [
      staffCanManageStudents,
      staffCanManageComplaints,
      staffCanModerateProducts,
      staffCanViewAnalytics,
      staffCanViewReports,
    ]
  );

  const loadDashboard = useCallback(async (showRefresh = false) => {
    if (!staffCanManageStudents) {
      setLoading(false);
      return;
    }

    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/staff/stats`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
        return;
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Unable to load the staff dashboard.");
      }

      setStats(data.stats || {});
      setRecentStudents(Array.isArray(data.recent_students) ? data.recent_students : []);
    } catch (err) {
      setError(err.message || "Unable to load the staff dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigate, staffCanManageStudents]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDashboard();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadDashboard]);

  const activeStudents = toNumber(stats?.active_students);
  const inactiveStudents = toNumber(stats?.inactive_students);
  const totalStudents = toNumber(stats?.total_students);
  const newStudents = toNumber(stats?.new_students_30_days);
  const statusTotal = Math.max(1, activeStudents + inactiveStudents);
  const activeRate =
    activeStudents + inactiveStudents > 0
      ? Math.round((activeStudents / (activeStudents + inactiveStudents)) * 100)
      : 0;

  return (
    <AdminLayout
      title="Staff Dashboard"
      subtitle="Your assigned StudentMart workspace."
    >
      <section className="staff-dashboard">
        <SectionHeader
          title="Workspace overview"
          subtitle="Current activity and tools assigned to your role."
          action={() => loadDashboard(true)}
          actionLabel={refreshing ? "Updating…" : "Refresh data"}
          actionVariant="outline"
        />

        {error ? (
          <div className="dashboard-error" role="alert">
            <div className="dashboard-error-body">
              <strong>Unable to load dashboard</strong>
              <span>{error}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => loadDashboard(true)}>
              Try again
            </Button>
          </div>
        ) : null}

        {staffCanManageStudents ? (
          <>
            <div className="metrics-grid">
              {STAFF_METRIC_CARDS.map((card) => {
                const Icon = card.icon;
                const value = loading ? "—" : formatValue(stats?.[card.key] ?? 0);
                return (
                  <StatCard
                    key={card.key}
                    label={card.label}
                    value={value}
                    icon={Icon}
                    tone={card.tone}
                    subtitle={card.description}
                  />
                );
              })}
            </div>

            <div className="activity-grid-2">
              <Card className="staff-chart-card">
                <Card.Header>
                  <span className="staff-chart-eyebrow">Student Account Status</span>
                  <h3 className="staff-chart-title">Current student accounts grouped by status</h3>
                </Card.Header>
                <Card.Body>
                  {loading ? (
                    <div className="staff-chart-skeleton">
                      <LoadingSpinner size="sm" />
                      <p>Loading account status…</p>
                    </div>
                  ) : totalStudents > 0 ? (
                    <>
                      <div className="chart-total">
                        <span>{formatValue(totalStudents)}</span>
                        <span className="chart-total-label">total accounts</span>
                      </div>
                      <div className="chart-block">
                        <div className="chart-row">
                          <div className="chart-row-top">
                            <span>Active students</span>
                            <strong>{formatValue(activeStudents)}</strong>
                          </div>
                          <div className="chart-track">
                            <div
                              className="chart-fill chart-fill--success"
                              style={{
                                width: `${Math.round((activeStudents / statusTotal) * 100)}%`,
                              }}
                            />
                          </div>
                          <small className="chart-percent">{activeRate}%</small>
                        </div>

                        <div className="chart-row">
                          <div className="chart-row-top">
                            <span>Inactive / suspended</span>
                            <strong>{formatValue(inactiveStudents)}</strong>
                          </div>
                          <div className="chart-track">
                            <div
                              className="chart-fill chart-fill--warning"
                              style={{
                                width: `${Math.round((inactiveStudents / statusTotal) * 100)}%`,
                              }}
                            />
                          </div>
                          <small className="chart-percent">{100 - activeRate}%</small>
                        </div>
                      </div>

                      {newStudents > 0 && (
                        <div className="chart-note">
                          <Activity size={14} aria-hidden="true" />
                          <span>
                            {formatValue(newStudents)} account{newStudents === 1 ? "" : "s"} registered in the last 30 days.
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <EmptyState
                      icon={BarChart3}
                      title="No student account data"
                      subtitle="Student account status summaries will appear here once accounts are registered."
                    />
                  )}
                </Card.Body>
              </Card>

              <Card className="staff-chart-card">
                <Card.Header>
                  <span className="staff-chart-eyebrow">Recent Registrations</span>
                  <h3 className="staff-chart-title">Latest student accounts added to StudentMart</h3>
                </Card.Header>
                <Card.Body>
                  {loading ? (
                    <div className="staff-chart-skeleton">
                      <LoadingSpinner size="sm" />
                      <p>Loading student activity…</p>
                    </div>
                  ) : recentStudents.length === 0 ? (
                    <EmptyState
                      icon={Users}
                      title="No recent registrations"
                      subtitle="No students have registered yet."
                    />
                  ) : (
                    <div className="recent-table-wrap">
                      <table className="staff-recent-table">
                        <thead>
                          <tr>
                            <th style={{ width: "200px" }}>Student</th>
                            <th style={{ width: "130px" }}>Student ID</th>
                            <th>Email</th>
                            <th style={{ width: "130px" }}>Status</th>
                            <th style={{ width: "150px" }}>Registered</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentStudents.map((student) => (
                            <tr key={student.id}>
                              <td className="user-cell-main">
                                <strong>{student.name || "—"}</strong>
                                <span>{student.student_id || "—"}</span>
                              </td>
                              <td>{student.student_id || "—"}</td>
                              <td>{student.email || "—"}</td>
                              <td>
                                <Badge
                                  variant={
                                    String(student.status || "").toLowerCase() === "active"
                                      ? "success"
                                      : String(student.status || "").toLowerCase() === "inactive" ||
                                        String(student.status || "").toLowerCase() === "suspended"
                                      ? "warning"
                                      : "neutral"
                                  }
                                  size="sm"
                                >
                                  {student.status || "Unknown"}
                                </Badge>
                              </td>
                              <td style={{ fontSize: 12.5 }}>{formatDate(student.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card.Body>
                {staffCanManageStudents && (
                  <Card.Footer>
                    <Link className="staff-primary-link" to="/staff/users">
                      Manage student accounts
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </Card.Footer>
                )}
              </Card>
            </div>
          </>
        ) : null}

        <section className="staff-tool-section">
          <div className="staff-tool-heading">
            <div>
              <span className="staff-eyebrow">Assigned Access</span>
              <h2 className="staff-tool-heading-title">Available Tools</h2>
            </div>
            <Activity size={20} aria-hidden="true" />
          </div>

          {tools.length === 0 ? (
            <EmptyState
              icon={ShieldAlert}
              title="No Staff tools assigned"
              subtitle="Contact an administrator to request access to staff tools."
            />
          ) : (
            <div className="staff-tool-grid">
              {tools.map(({ to, label, description, icon: Icon }) => (
                <Link
                  className="staff-tool-card"
                  key={to}
                  to={to}
                >
                  <span className="staff-tool-icon">
                    <Icon size={19} aria-hidden="true" />
                  </span>

                  <strong className="staff-tool-label">{label}</strong>

                  <p className="staff-tool-description">{description}</p>

                  <span className="staff-tool-open">
                    Open tool
                    <ArrowRight size={15} aria-hidden="true" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </section>
    </AdminLayout>
  );
}
