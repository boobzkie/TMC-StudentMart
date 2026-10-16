import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldAlert,
  CreditCard,
  Package,
  XCircle,
  UserRound,
  UserPlus,


} from "lucide-react";
import AdminLayout from "./components/AdminLayout";
import { API_URL } from "./utils/api";
import "./AdminDashboard.css";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toneLabel = {
  pending: "Pending",
  danger: "Open",
  success: "Active",
  warning: "Low stock",
  info: "Unverified",
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(API_URL + "/admin/stats", {
        headers: { Accept: "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
      });
      if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("role");
        navigate("/login", { replace: true });
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to load marketplace overview.");
      setStats(data.stats || {});
    } catch (err) {
      setError(err.message || "We could not load the marketplace overview. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const stat = (key, fallback = 0) => {
    if (!stats) return fallback;
    const value = stats[key];
    return value === null || value === undefined ? fallback : value;
  };

  if (loading) {
    return (
      <AdminLayout title="Dashboard" subtitle="Marketplace overview - TMC StudentMart">
        <div style={{ padding: 40, textAlign: "center", color: "var(--tmc-text-muted)" }}>
          Loading marketplace overview...
        </div>
      </AdminLayout>
    );
  }



  const s = stats;
  const attentionItems = [
    {
      key: "pending_products",
      label: "Pending product approvals",
      subtitle: "Listings waiting for an administrator decision",
      value: stat("pending_products"),
      tone: "pending",
      to: "/admin/product-moderation",
    },
    {
      key: "open_complaints",
      label: "Open complaints",
      subtitle: "Student complaints that need a response",
      value: stat("open_complaints"),
      tone: "danger",
      to: "/admin/complaints",
    },
    {
      key: "new_orders",
      label: "Pending orders",
      subtitle: "Orders awaiting confirmation",
      value: stat("new_orders"),
      tone: "pending",
      to: "/admin/transactions",
    },
    {
      key: "pending_payments",
      label: "Pending payments",
      subtitle: "Orders with payment not yet settled",
      value: stat("pending_payments"),
      tone: "warning",
      to: "/admin/transactions",
    },
    {
      key: "low_stock_products",
      label: "Low-stock products",
      subtitle: "Listings running low on inventory",
      value: stat("low_stock_products"),
      tone: "warning",
      to: "/admin/products",
    },
    {
      key: "unverified_accounts",
      label: "Unverified accounts",
      subtitle: "Active accounts without email verification",
      value: stat("unverified_accounts"),
      tone: "info",
      to: "/admin/users",
    },
  ];

  const gridBlocks = [
    {
      title: "Marketplace activity",
      items: [
        { label: "Active listings", value: stat("active_products"), tone: "success", to: "/admin/products", help: "Approved and visible" },
        { label: "New listings", value: stat("new_products"), tone: "info", to: "/admin/products", help: "Added in the last 7 days" },
        { label: "Approved listings", value: stat("approved_products"), tone: "success", to: "/admin/products?status=active" },
        { label: "Rejected listings", value: stat("rejected_products"), tone: "danger", to: "/admin/products?status=rejected" },
      ],
    },
    {
      title: "Order activity",
      items: [
        { label: "New orders", value: stat("new_orders"), tone: "pending", to: "/admin/transactions?status=pending" },
        { label: "Processing orders", value: stat("processing_orders"), tone: "pending", to: "/admin/transactions?status=confirmed" },
        { label: "Ready for pickup", value: stat("ready_for_pickup_orders"), tone: "pending", to: "/admin/transactions?status=ready_for_pickup" },
        { label: "Completed orders", value: stat("completed_orders"), tone: "success", to: "/admin/transactions?status=completed" },
        { label: "Cancelled orders", value: stat("cancelled_orders"), tone: "neutral", to: "/admin/transactions?status=cancelled" },
      ],
    },
    {
      title: "Account activity",
      items: [
        { label: "Registered students", value: stat("total_students"), tone: "info", to: "/admin/users?role=student" },
        { label: "Active sellers", value: stat("active_sellers"), tone: "success", to: "/admin/sellers" },
        { label: "Staff accounts", value: stat("total_staff"), tone: "info", to: "/admin/staff" },
        { label: "Recently registered users", value: stat("recently_registered_users"), tone: "info", to: "/admin/users" },
      ],
    },
    {
      title: "Stock alerts",
      items: [
        { label: "Low stock", value: stat("low_stock_products"), tone: "warning", to: "/admin/products?stock=low" },
        { label: "Out of stock", value: stat("out_of_stock_products"), tone: "danger", to: "/admin/products?stock=out" },
      ],
    },
  ];

  const recent = (s.recent_activity || []).slice(0, 8);

  return (
    <AdminLayout title="Marketplace overview" subtitle="TMC StudentMart - what needs attention right now?">
      {error && (
        <div className="dashboard-error" role="alert" style={{ padding: 16, border: "1px solid var(--tmc-error-soft)", background: "var(--tmc-error-soft)", color: "var(--tmc-error)", borderRadius: "var(--tmc-radius-md)", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
          <XCircle size={16} aria-hidden="true" />
          <div style={{ flex: 1 }}>
            <strong>Unable to load overview</strong>
            <span style={{ fontSize: 12.5, display: "block", marginTop: 2 }}>{error}</span>
          </div>
          <button type="button" onClick={loadStats} className="tmc-btn tmc-btn-sm tmc-btn-outline">Try again</button>
        </div>
      )}

      <section className="dashboard-section dashboard-attention">
        <div className="dashboard-section-header">
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--tmc-ink)" }}>Attention required</h2>
          <p style={{ margin: 4, fontSize: 12.5, color: "var(--tmc-text-muted)" }}>Items that need administrator action today.</p>
        </div>
        <div className="dashboard-kpi-grid">
          {attentionItems.map((item) => {
            const config = toneLabel[item.tone] ? { tone: item.tone, label: toneLabel[item.tone] } : { tone: "pending", label: "Pending" };
            const badgeStyle = config.tone === "danger" ? { background: "var(--tmc-error-soft)", color: "var(--tmc-error)" } : config.tone === "warning" ? { background: "var(--tmc-warning-soft)", color: "var(--tmc-warning)" } : config.tone === "success" ? { background: "var(--tmc-success-soft)", color: "var(--tmc-success)" } : { background: "var(--tmc-info-soft)", color: "var(--tmc-info)" };
            return (
              <a
                key={item.key}
                href={item.to}
                onClick={(event) => { event.preventDefault(); navigate(item.to); }}
                className="dashboard-kpi-card dashboard-kpi-attention"
                style={{ textDecoration: "none" }}
              >
                <div className="dashboard-kpi-body">
                  <div className="dashboard-kpi-meta">
                    <span className="dashboard-kpi-label" style={{ display: "block", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--tmc-text-muted)" }}>{item.label}</span>
                    <span className="dashboard-kpi-subtitle" style={{ display: "block", fontSize: 11.5, color: "var(--tmc-text-muted)", marginTop: 2 }}>{item.subtitle}</span>
                  </div>
                  <div className="dashboard-kpi-value" style={{ fontSize: 27, fontWeight: 800, color: "var(--tmc-ink)" }}>{item.value}</div>
                  <span className="tmc-badge" style={{ ...badgeStyle, fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", padding: "3px 9px", borderRadius: "999px" }}>{config.label}</span>
                </div>
                <div className="dashboard-kpi-icon" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: "var(--tmc-radius-md)", background: "var(--tmc-deep-navy-soft)" }}>
                  {item.key === "pending_products" && <ShieldAlert size={18} aria-hidden="true" />}
                  {item.key === "open_complaints" && <XCircle size={18} aria-hidden="true" />}
                  {item.key === "new_orders" && <CreditCard size={18} aria-hidden="true" />}
                  {item.key === "pending_payments" && <CreditCard size={18} aria-hidden="true" />}
                  {item.key === "low_stock_products" && <Package size={18} aria-hidden="true" />}
                  {item.key === "unverified_accounts" && <UserRound size={18} aria-hidden="true" />}
                </div>
                <span className="dashboard-kpi-arrow" style={{ fontSize: 12, color: "var(--tmc-text-soft)" }}>&#8594;</span>
              </a>
            );
          })}
        </div>
      </section>



      <section className="dashboard-section dashboard-grid-section">
        {gridBlocks.map((block) => (
          <div key={block.title} className="dashboard-card">
            <header className="dashboard-card-header">
              <span className="dashboard-card-title" style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--tmc-text-muted)" }}>{block.title}</span>
            </header>
            <div className="dashboard-kpi-grid dashboard-activity-grid">
              {block.items.map((item) => {
                const config = toneLabel[item.tone] ? { tone: item.tone, label: toneLabel[item.tone] } : { tone: "pending", label: "Pending" };
                const badgeStyle = config.tone === "danger" ? { background: "var(--tmc-error-soft)", color: "var(--tmc-error)" } : config.tone === "warning" ? { background: "var(--tmc-warning-soft)", color: "var(--tmc-warning)" } : config.tone === "success" ? { background: "var(--tmc-success-soft)", color: "var(--tmc-success)" } : { background: "var(--tmc-info-soft)", color: "var(--tmc-info)" };
                return (
                  <a
                    key={item.label}
                    href={item.to}
                    onClick={(event) => { event.preventDefault(); navigate(item.to); }}
                    className="dashboard-activity-card"
                    style={{ textDecoration: "none" }}
                  >
                    <div className="dashboard-activity-meta">
                      <span className="dashboard-activity-label" style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "var(--tmc-ink)" }}>{item.label}</span>
                      {item.help && <span className="dashboard-activity-help" style={{ display: "block", fontSize: 11, color: "var(--tmc-text-muted)", marginTop: 2 }}>{item.help}</span>}
                    </div>
                    <div className="dashboard-activity-value" style={{ fontSize: 24, fontWeight: 800, color: "var(--tmc-ink)" }}>{item.value}</div>
                    <span className="tmc-badge" style={{ ...badgeStyle, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", padding: "2px 8px", borderRadius: "999px" }}>{config.label}</span>
                    <span className="dashboard-activity-arrow" style={{ fontSize: 12, color: "var(--tmc-text-soft)" }}>&#8594;</span>
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="dashboard-section dashboard-recent">
        <div className="dashboard-section-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--tmc-ink)" }}>Recent activity</h2>
            <p style={{ margin: 4, fontSize: 12.5, color: "var(--tmc-text-muted)" }}>Latest marketplace actions across users, listings, and orders.</p>
          </div>
          {s.recent_activity && s.recent_activity.length > 8 && (
            <button type="button" onClick={() => navigate("/admin/activity-logs")} className="tmc-btn tmc-btn-sm tmc-btn-outline">View all activity logs</button>
          )}
        </div>
        <div className="tmc-table-wrap">
          <table className="tmc-table">
            <thead>
              <tr>
                <th style={{ width: "210px" }}>User</th>
                <th style={{ flex: 1 }}>Action</th>
                <th style={{ width: "170px" }}>Date / time</th>
                <th style={{ width: "130px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 30, textAlign: "center", color: "var(--tmc-text-muted)" }}>No recent activity recorded.</td>
                </tr>
              ) : (
                recent.map((item, index) => {
                  let badgeBg = "rgba(137,138,140,0.12)";
                  let badgeColor = "var(--tmc-text-muted)";
                  let badgeLabel = String(item.status || "-");
                  if (item.status === "open") { badgeBg = "var(--tmc-error-soft)"; badgeColor = "var(--tmc-error)"; badgeLabel = "Open"; }
                  else if (item.status === "under_review") { badgeBg = "var(--tmc-warning-soft)"; badgeColor = "var(--tmc-warning)"; badgeLabel = "Under review"; }
                  else if (item.status === "active") { badgeBg = "var(--tmc-success-soft)"; badgeColor = "var(--tmc-success)"; badgeLabel = "Active"; }
                  else if (item.status === "rejected") { badgeBg = "var(--tmc-error-soft)"; badgeColor = "var(--tmc-error)"; badgeLabel = "Rejected"; }
                  return (
                    <tr key={index}>
                      <td className="tmc-table-cell-main">
                        <strong>{item.user}</strong>
                        <span style={{ display: "block", fontSize: 11.5, color: "var(--tmc-text-muted)" }}>{item.type}</span>
                      </td>
                      <td>{item.action}</td>
                      <td style={{ fontSize: 12.5 }}>{formatDate(item.date_time)}</td>
                      <td>
                        <span className="tmc-badge" style={{ background: badgeBg, color: badgeColor, fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", padding: "2px 8px", borderRadius: "999px" }}>{badgeLabel}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminLayout>
  );
}

