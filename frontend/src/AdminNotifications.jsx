import { useCallback, useEffect, useState } from "react";
import AdminLayout from "./components/AdminLayout";
import { API_URL } from "./utils/api";
import "./AdminNotifications.css";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const toneName = (tone) => {
  if (tone === "danger") return "Open";
  if (tone === "warning") return "Low stock";
  if (tone === "success") return "Active";
  if (tone === "info") return "Unverified";
  return "Pending";
};

const toneStyle = (tone) => {
  if (tone === "danger") return { background: "var(--tmc-error-soft)", color: "var(--tmc-error)" };
  if (tone === "warning") return { background: "var(--tmc-warning-soft)", color: "var(--tmc-warning)" };
  if (tone === "success") return { background: "var(--tmc-success-soft)", color: "var(--tmc-success)" };
  return { background: "var(--tmc-info-soft)", color: "var(--tmc-info)" };
};

export default function AdminNotifications() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchStats = useCallback(async () => {
    const token = localStorage.getItem("token");
    const response = await fetch(API_URL + "/admin/stats", {
      headers: { Accept: "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    });
    if (response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("role");
      window.location.replace("/login");
      return null;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Unable to load notifications.");
    return data.stats || {};
  }, []);

  useEffect(() => {
    let active = true;
    fetchStats()
      .then((nextStats) => {
        if (active && nextStats !== null) setStats(nextStats);
      })
      .catch((err) => {
        if (active) setError(err.message || "We could not load notifications. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [fetchStats]);
  const stat = (key, fallback = 0) => {
    if (!stats) return fallback;
    const value = stats[key];
    return value === null || value === undefined ? fallback : value;
  };



  const notifications = [];
  if (stats) {
    if (stat("pending_products") > 0) {
      notifications.push({
        id: "n-pending-products",
        title: "Pending product approvals",
        body: stat("pending_products") + " listing(s) await moderation decision.",
        to: "/admin/product-moderation",
        tone: "pending",
      });
    }
    if (stat("open_complaints") > 0) {
      notifications.push({
        id: "n-open-complaints",
        title: "Open complaints",
        body: stat("open_complaints") + " complaint(s) need a response.",
        to: "/admin/complaints",
        tone: "danger",
      });
    }
    if (stat("new_orders") > 0) {
      notifications.push({
        id: "n-new-orders",
        title: "New orders",
        body: stat("new_orders") + " order(s) awaiting confirmation.",
        to: "/admin/transactions",
        tone: "pending",
      });
    }
    if (stat("pending_payments") > 0) {
      notifications.push({
        id: "n-pending-payments",
        title: "Pending payments",
        body: stat("pending_payments") + " order(s) with unsettled payment.",
        to: "/admin/transactions",
        tone: "warning",
      });
    }
    if (stat("low_stock_products") > 0) {
      notifications.push({
        id: "n-low-stock",
        title: "Low-stock products",
        body: stat("low_stock_products") + " listing(s) are running low on inventory.",
        to: "/admin/products",
        tone: "warning",
      });
    }
    if (stat("unverified_accounts") > 0) {
      notifications.push({
        id: "n-unverified",
        title: "Unverified accounts",
        body: stat("unverified_accounts") + " active account(s) without email verification.",
        to: "/admin/users",
        tone: "info",
      });
    }
  }

  const recent = (stats && stats.recent_activity ? stats.recent_activity : []).slice(0, 10);



  if (loading) {
    return (
      <AdminLayout title="Notifications" subtitle="TMC StudentMart - administrator notifications">
        <div style={{ padding: 40, textAlign: "center", color: "var(--tmc-text-muted)" }}>Loading notifications...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Notifications" subtitle="TMC StudentMart - administrator notifications and alerts">
      {error && (
        <div className="dashboard-error" role="alert" style={{ padding: 16, border: "1px solid var(--tmc-error-soft)", background: "var(--tmc-error-soft)", color: "var(--tmc-error)", borderRadius: "var(--tmc-radius-md)", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <strong>Unable to load notifications</strong>
            <span style={{ fontSize: 12.5, display: "block", marginTop: 2 }}>{error}</span>
          </div>
        </div>
      )}
      <section className="dashboard-section">
        <div className="dashboard-section-header">
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--tmc-ink)" }}>Priority notifications</h2>
          <p style={{ margin: 4, fontSize: 12.5, color: "var(--tmc-text-muted)" }}>Action items that require your attention.</p>
        </div>
        <div className="dashboard-kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {notifications.length === 0 ? (
            <div className="tmc-empty" style={{ gridColumn: "1 / -1" }}>
              <div className="tmc-empty-icon" style={{ fontSize: 34 }}>&#10003;</div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--tmc-ink)" }}>All clear</h2>
              <p style={{ margin: 0 }}>There are no priority notifications right now.</p>
            </div>
          ) : (
            notifications.map((item) => (
              <a key={item.id} href={item.to} onClick={(event) => { event.preventDefault(); window.location.href = item.to; }} className="tmc-card" style={{ textDecoration: "none", display: "flex", alignItems: "flex-start", gap: 12, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 9, background: "var(--tmc-deep-navy-soft)", flex: "0 0 36" }}>
                  <span style={{ fontSize: 16 }}>!</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: "var(--tmc-ink)" }}>{item.title}</div>
                  <div style={{ display: "block", fontSize: 12.5, color: "var(--tmc-text-muted)", marginTop: 4 }}>{item.body}</div>
                </div>
                <span className="tmc-badge" style={{ ...toneStyle(item.tone), fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", padding: "3px 9px", borderRadius: "999px", marginTop: 2 }}>{toneName(item.tone)}</span>
              </a>
            ))
          )}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="dashboard-section" style={{ marginTop: 24 }}>
          <div className="dashboard-section-header">
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--tmc-ink)" }}>Recent activity</h2>
          </div>
          <div className="tmc-table-wrap">
            <table className="tmc-table">
              <thead>
                <tr>
                  <th style={{ width: "210px" }}>User</th>
                  <th>Action</th>
                  <th style={{ width: "170px" }}>Date / time</th>
                  <th style={{ width: "130px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((item, index) => {
                  let badgeBg = "rgba(137,138,140,0.12)";
                  let badgeColor = "var(--tmc-text-muted)";
                  let badgeLabel = String(item.status || "-");
                  if (item.status === "open") { badgeBg = "var(--tmc-error-soft)"; badgeColor = "var(--tmc-error)"; badgeLabel = "Open"; }
                  else if (item.status === "under_review") { badgeBg = "var(--tmc-warning-soft)"; badgeColor = "var(--tmc-warning)"; badgeLabel = "Under review"; }
                  else if (item.status === "active") { badgeBg = "var(--tmc-success-soft)"; badgeColor = "var(--tmc-success)"; badgeLabel = "Active"; }
                  else if (item.status === "rejected") { badgeBg = "var(--tmc-error-soft)"; badgeColor = "var(--tmc-error)"; badgeLabel = "Rejected"; }
                  return (
                    <tr key={index}>
                      <td className="tmc-table-cell-main"><strong>{item.user}</strong><span style={{ display: "block", fontSize: 11.5, color: "var(--tmc-text-muted)" }}>{item.type}</span></td>
                      <td>{item.action}</td>
                      <td style={{ fontSize: 12.5 }}>{formatDate(item.date_time)}</td>
                      <td><span className="tmc-badge" style={{ background: badgeBg, color: badgeColor, fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", padding: "2px 8px", borderRadius: "999px" }}>{badgeLabel}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AdminLayout>
  );
}

