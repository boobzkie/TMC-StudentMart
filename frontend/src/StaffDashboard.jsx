import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  Activity,
  ArrowRight,
  BarChart3,
  MessageSquareWarning,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  Users,
  UserRoundX,
  UserPlus,
} from "lucide-react";

import AdminLayout from "./components/AdminLayout";
import { API_URL } from "./utils/api";

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

  return new Date(value).toLocaleDateString(undefined, {
    dateStyle: "medium",
  });
}

function getLastUpdatedLabel(timestamp) {
  if (!timestamp) {
    return "Not updated yet";
  }

  return `Updated at ${new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

const STAFF_METRIC_CARDS = [
  {
    key: "total_students",
    label: "Student Accounts",
    description: "Registered student users",
    icon: Users,
    tone: "blue",
  },
  {
    key: "active_students",
    label: "Active Student Accounts",
    description: "Students with active status",
    icon: UserCheck,
    tone: "green",
  },
  {
    key: "inactive_students",
    label: "Inactive Student Accounts",
    description: "Students needing attention",
    icon: UserRoundX,
    tone: "amber",
  },
  {
    key: "new_students_30_days",
    label: "New Student Accounts in 30 Days",
    description: "Recently registered accounts",
    icon: UserPlus,
    tone: "purple",
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
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
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
          description: "Review real product and complaint activity.",
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

      setRecentStudents(
        Array.isArray(data.recent_students) ? data.recent_students : []
      );

      setLastUpdatedAt(Date.now());
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

  const welcomeText = staffCanManageStudents
    ? "Review student account activity and update account status when needed."
    : "Open the tools assigned to your Staff account.";

  const dataStatusText = loading
    ? "Loading workspace data"
    : refreshing
      ? "Updating workspace data"
      : error
        ? "Update failed"
        : getLastUpdatedLabel(lastUpdatedAt);

  return (
    <AdminLayout
      title="Marketplace Overview"
      subtitle="Your assigned StudentMart workspace."
    >
      <section className="staff-dashboard">
        <div className="staff-dashboard-hero">
          <div className="staff-dashboard-hero-content">
            <div className="staff-dashboard-hero-icon">
              <Activity size={24} strokeWidth={2} aria-hidden="true" />
            </div>

            <div>
              <span className="staff-dashboard-eyebrow">
                STAFF WORKSPACE
              </span>

              <h2>
                {staffCanManageStudents
                  ? "Student Account Overview"
                  : "Welcome to your workspace"}
              </h2>

              <p>{welcomeText}</p>
            </div>
          </div>

          <div className="staff-dashboard-status">
            <span className="staff-status-dot" />
            <span>{dataStatusText}</span>
          </div>

          {staffCanManageStudents ? (
            <button
              type="button"
              className="staff-dashboard-refresh-button"
              onClick={() => {
                if (!loading && !refreshing) {
                  loadDashboard(true);
                }
              }}
              disabled={loading || refreshing}
            >
              <RefreshCw
                size={16}
                className={refreshing ? "staff-dashboard-spin" : ""}
                aria-hidden="true"
              />
              {refreshing ? "Updating..." : "Refresh Data"}
            </button>
          ) : null}
        </div>

        {error ? (
          <div
            className="staff-dashboard-error"
            role="alert"
          >
            <span>{error}</span>

            <button type="button" onClick={loadDashboard}>
              Try Again
            </button>
          </div>
        ) : null}

        {staffCanManageStudents ? (
          <>
            <div className="staff-metric-grid">
              {STAFF_METRIC_CARDS.map((card) => {
                const Icon = card.icon;

                return (
                  <article
                    className={`staff-metric-card tone-${card.tone}`}
                    key={card.key}
                  >
                    <div className="staff-metric-icon">
                      <Icon size={20} aria-hidden="true" />
                    </div>

                    <span>{card.label}</span>

                    <strong>
                      {loading ? "..." : formatValue(stats?.[card.key] ?? 0)}
                    </strong>

                    <small>{card.description}</small>
                  </article>
                );
              })}
            </div>

            <div className="staff-analytics-grid">
              <article className="staff-chart-card">
                <div className="staff-chart-header">
                  <div>
                    <h3>Student Account Status</h3>
                    <p>
                      Current student accounts grouped by account status.
                    </p>
                  </div>

                  <span className="staff-chart-total">
                    {formatValue(totalStudents)} total
                  </span>
                </div>

                {loading ? (
                  <div className="staff-chart-skeleton">
                    <span />
                    <span />
                    <span />
                  </div>
                ) : totalStudents > 0 ? (
                  <>
                    <div
                      className="staff-chart-block"
                      role="img"
                      aria-label="Bar chart of student account status"
                    >
                      <div className="staff-chart-row">
                        <div className="staff-chart-row-top">
                          <span>Active students</span>
                          <strong>{formatValue(activeStudents)}</strong>
                        </div>

                        <div className="staff-chart-track">
                          <div
                            className="staff-chart-fill green"
                            style={{
                              width: `${Math.round(
                                (activeStudents / statusTotal) * 100
                              )}%`,
                            }}
                          />
                        </div>

                        <small>{activeRate}% of status-counted students</small>
                      </div>

                      <div className="staff-chart-row">
                        <div className="staff-chart-row-top">
                          <span>Inactive or suspended students</span>
                          <strong>{formatValue(inactiveStudents)}</strong>
                        </div>

                        <div className="staff-chart-track">
                          <div
                            className="staff-chart-fill amber"
                            style={{
                              width: `${Math.round(
                                (inactiveStudents / statusTotal) * 100
                              )}%`,
                            }}
                          />
                        </div>

                        <small>
                          {100 - activeRate}% of status-counted students
                        </small>
                      </div>
                    </div>

                    <div className="staff-chart-note">
                      <Activity size={16} aria-hidden="true" />
                      <p>
                        {formatValue(newStudents)} account
                        {newStudents === 1 ? "" : "s"} registered in the last
                        30 days. Historical trend charts are not included because
                        the staff endpoint provides account status totals only.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="staff-empty-state">
                    <BarChart3 size={22} aria-hidden="true" />
                    <strong>No student account data</strong>
                    <span>
                      Student account status summaries will appear here.
                    </span>
                  </div>
                )}
              </article>

              <article className="staff-chart-card">
                <div className="staff-chart-header">
                  <div>
                    <h3>Recent Registrations</h3>
                    <p>
                      Latest student accounts added to StudentMart.
                    </p>
                  </div>
                </div>

                {loading ? (
                  <div className="staff-recent-empty">
                    Loading student activity...
                  </div>
                ) : recentStudents.length === 0 ? (
                  <div className="staff-recent-empty">
                    No students have registered yet.
                  </div>
                ) : (
                  <div className="staff-recent-table-wrap">
                    <table className="staff-recent-table">
                      <caption className="staff-visually-hidden">
                        Recently registered student accounts
                      </caption>

                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Student ID</th>
                          <th>Email</th>
                          <th>Status</th>
                          <th>Registered</th>
                        </tr>
                      </thead>

                      <tbody>
                        {recentStudents.map((student) => (
                          <tr key={student.id}>
                            <td>{student.name || "—"}</td>
                            <td>{student.student_id || "—"}</td>
                            <td>{student.email || "—"}</td>
                            <td>
                              <span
                                className={`staff-status ${String(
                                  student.status || ""
                                ).toLowerCase()}`}
                              >
                                {student.status || "Unknown"}
                              </span>
                            </td>
                            <td>
                              {formatDate(student.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            </div>

            {staffCanManageStudents ? (
              <div className="staff-dashboard-action">
                <Link
                  className="staff-primary-link"
                  to="/staff/users"
                >
                  Manage student accounts
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </div>
            ) : null}
          </>
        ) : null}

        <section className="staff-tool-section">
          <div className="staff-tool-heading">
            <div>
              <span className="staff-eyebrow">
                ASSIGNED ACCESS
              </span>

              <h2>Available Tools</h2>
            </div>

            <Activity size={20} aria-hidden="true" />
          </div>

          {tools.length === 0 ? (
            <div className="staff-recent-empty">
              No Staff tools are assigned yet. Contact an administrator to request
              access.
            </div>
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

                  <strong>{label}</strong>

                  <p>{description}</p>

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
