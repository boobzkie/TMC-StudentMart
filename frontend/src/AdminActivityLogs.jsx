import { useCallback, useEffect, useState } from "react";
import { FileClock } from "lucide-react";
import AdminLayout from "./components/AdminLayout";
import AdminPageHero from "./components/AdminPageHero";
import { API_URL } from "./utils/api";
import "./AdminActivityLogs.css";

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const toneStyle = (status) => {
  if (status === "open") return { background: "var(--tmc-error-soft)", color: "var(--tmc-error)" };
  if (status === "under_review") return { background: "var(--tmc-warning-soft)", color: "var(--tmc-warning)" };
  if (status === "active") return { background: "var(--tmc-success-soft)", color: "var(--tmc-success)" };
  if (status === "rejected") return { background: "var(--tmc-error-soft)", color: "var(--tmc-error)" };
  return { background: "rgba(137,138,140,0.12)", color: "var(--tmc-text-muted)" };
};

const toneLabel = (status) => {
  if (status === "open") return "Open";
  if (status === "under_review") return "Under review";
  if (status === "active") return "Active";
  if (status === "rejected") return "Rejected";
  return String(status || "-");
};

export default function AdminActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchLogs = useCallback(async () => {
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
    if (!response.ok) throw new Error(data.message || "Unable to load activity logs.");
    return Array.isArray(data.stats && data.stats.recent_activity) ? data.stats.recent_activity : [];
  }, []);

  const refreshLogs = async () => {
    setRefreshing(true);
    setError("");
    try {
      const nextLogs = await fetchLogs();
      if (nextLogs !== null) setLogs(nextLogs);
    } catch (err) {
      setError(err.message || "We could not refresh activity logs. Please try again.");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetchLogs()
      .then((nextLogs) => {
        if (active && nextLogs !== null) setLogs(nextLogs);
      })
      .catch((err) => {
        if (active) setError(err.message || "We could not load activity logs. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [fetchLogs]);
  if (loading) {
    return (
      <AdminLayout title="Activity logs" subtitle="TMC StudentMart - administrator activity log">
        <AdminPageHero
          title="Activity Logs"
          description="Review recent account, listing, order, and support activity across StudentMart."
          icon={FileClock}
          onRefresh={refreshLogs}
          refreshing={loading || refreshing}
        />
        <div style={{ padding: 40, textAlign: "center", color: "var(--tmc-text-muted)" }}>Loading activity logs...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Activity logs" subtitle="TMC StudentMart - recent activity across users, listings, and orders">
      <AdminPageHero
        title="Activity Logs"
        description="Review recent account, listing, order, and support activity across StudentMart."
        icon={FileClock}
        onRefresh={refreshLogs}
        refreshing={refreshing}
      />
      {error && (
        <div className="dashboard-error" role="alert" style={{ padding: 16, border: "1px solid var(--tmc-error-soft)", background: "var(--tmc-error-soft)", color: "var(--tmc-error)", borderRadius: "var(--tmc-radius-md)", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <strong>Unable to load activity logs</strong>
            <span style={{ fontSize: 12.5, display: "block", marginTop: 2 }}>{error}</span>
          </div>
        </div>
      )}
      <section className="dashboard-section">
        <div className="dashboard-section-header">
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--tmc-ink)" }}>Activity log</h2>
          <p style={{ margin: 4, fontSize: 12.5, color: "var(--tmc-text-muted)" }}>Chronological feed of recent marketplace actions.</p>
        </div>
        <div className="tmc-table-wrap">
          <table className="tmc-table">
            <thead>
              <tr>
                <th style={{ width: "210px" }}>User</th>
                <th>Action</th>
                <th style={{ width: "170px" }}>Date / time</th>
                <th style={{ width: "140px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 30, textAlign: "center", color: "var(--tmc-text-muted)" }}>No activity recorded yet.</td>
                </tr>
              ) : (
                logs.map((item, index) => {
                  const style = toneStyle(item.status);
                  return (
                    <tr key={index}>
                      <td className="tmc-table-cell-main"><strong>{item.user}</strong><span style={{ display: "block", fontSize: 11.5, color: "var(--tmc-text-muted)" }}>{item.type}</span></td>
                      <td>{item.action}</td>
                      <td style={{ fontSize: 12.5 }}>{formatDate(item.date_time)}</td>
                      <td><span className="tmc-badge" style={{ ...style, fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", padding: "2px 8px", borderRadius: "999px" }}>{toneLabel(item.status)}</span></td>
                    </tr>
                  );
                }))
              }
            </tbody>
          </table>
        </div>
      </section>
    </AdminLayout>
  );
}

