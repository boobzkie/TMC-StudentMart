import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import AdminLayout from "./components/AdminLayout";
import AdminPageHero from "./components/AdminPageHero";
import { API_URL, getAuthHeaders } from "./utils/api";
import { clearAuth, getStoredRole } from "./utils/auth";
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
  const isStaff = getStoredRole() === "staff";
  const [stats, setStats] = useState(null);
  const [notificationItems, setNotificationItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [markingNotificationId, setMarkingNotificationId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notificationLoadError, setNotificationLoadError] = useState("");
  const requestSequenceRef = useRef(0);

  const fetchUserNotifications = useCallback(async (signal) => {
    const response = await fetch(`${API_URL}/notifications`, { headers: getAuthHeaders(), ...(signal ? { signal } : {}) });
    if (response.status === 401) {
      clearAuth();
      window.location.replace("/login");
      return null;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Unable to load your notifications.");
    return {
      notifications: Array.isArray(data.notifications) ? data.notifications : [],
      unreadCount: Math.max(0, Number(data.unread_count) || 0),
    };
  }, []);

  const fetchStats = useCallback(async (signal) => {
    const token = localStorage.getItem("token");
    const response = await fetch(API_URL + "/admin/stats", {
      headers: { Accept: "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
      ...(signal ? { signal } : {}),
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

  const refreshNotifications = useCallback(async (signal) => {
    if (signal?.aborted) return;
    const requestSequence = ++requestSequenceRef.current;
    if (!signal) setRefreshing(true);
    setError("");
    try {
      const requests = [fetchUserNotifications(signal)];
      if (!isStaff) requests.push(fetchStats(signal));
      const results = await Promise.allSettled(requests);
      if (signal?.aborted || requestSequence !== requestSequenceRef.current) return;
      const [notificationsResult, statsResult] = results;

      if (notificationsResult.status === "fulfilled" && notificationsResult.value) {
        setNotificationItems(notificationsResult.value.notifications);
        setUnreadCount(notificationsResult.value.unreadCount);
        setNotificationLoadError("");
      } else if (notificationsResult.status === "rejected") {
        const message = notificationsResult.reason?.message || "We could not refresh your notifications. Please try again.";
        setNotificationLoadError(message);
        setError(message);
      }
      if (!isStaff && statsResult?.status === "fulfilled" && statsResult.value !== null) setStats(statsResult.value);
      if (!isStaff && statsResult?.status === "rejected") {
        setError(statsResult.reason?.message || "We could not refresh priority notifications. Please try again.");
      }
    } finally {
      if (!signal?.aborted && requestSequence === requestSequenceRef.current) {
        setLoading(false);
        if (!signal) setRefreshing(false);
      }
    }
  }, [fetchStats, fetchUserNotifications, isStaff]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void refreshNotifications(controller.signal); }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [refreshNotifications]);

  const markNotificationRead = async (notification) => {
    if (!notification?.id || notification.read_at || markingNotificationId) return;
    setMarkingNotificationId(notification.id);
    setError("");
    try {
      const response = await fetch(`${API_URL}/notifications/${encodeURIComponent(notification.id)}/read`, {
        method: "PUT",
        headers: getAuthHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to mark this notification as read.");
      setNotificationItems((items) => items.map((item) => (
        item.id === notification.id ? { ...item, read_at: data.notification?.read_at || new Date().toISOString() } : item
      )));
      setUnreadCount((count) => Math.max(0, count - 1));
      window.dispatchEvent(new Event("tmc-notifications-updated"));
    } catch (err) {
      setError(err.message || "We could not update this notification. Please try again.");
    } finally {
      setMarkingNotificationId(null);
    }
  };
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
        <AdminPageHero
          title="Notifications"
          description="See marketplace alerts that need review, including pending listings, orders, payments, and account checks."
          icon={Bell}
          onRefresh={refreshNotifications}
          refreshing={loading || refreshing}
          autoRefreshIntervalMs={120_000}
          autoRefreshKey="notifications"
          autoRefreshPaused={Boolean(markingNotificationId)}
        />
        <div style={{ padding: 40, textAlign: "center", color: "var(--tmc-text-muted)" }}>Loading notifications...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Notifications" subtitle="TMC StudentMart - administrator notifications and alerts">
      <AdminPageHero
        title="Notifications"
        description="See marketplace alerts that need review, including pending listings, orders, payments, and account checks."
        icon={Bell}
        onRefresh={refreshNotifications}
        refreshing={refreshing}
        autoRefreshIntervalMs={120_000}
        autoRefreshKey="notifications"
        autoRefreshPaused={Boolean(markingNotificationId)}
      />
      {error && (
        <div className="dashboard-error" role="alert" style={{ padding: 16, border: "1px solid var(--tmc-error-soft)", background: "var(--tmc-error-soft)", color: "var(--tmc-error)", borderRadius: "var(--tmc-radius-md)", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <strong>Unable to load notifications</strong>
            <span style={{ fontSize: 12.5, display: "block", marginTop: 2 }}>{error}</span>
          </div>
        </div>
      )}
      <section className="notifications-section" aria-labelledby="your-notifications-title">
        <header className="notifications-header">
          <div>
            <span className="notifications-eyebrow">YOUR INBOX</span>
            <h2 id="your-notifications-title">Notifications</h2>
            <p>{notificationLoadError ? "Notification status is unavailable." : unreadCount === 0 ? "You are all caught up." : `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`}</p>
          </div>
          <span className="notification-badge" aria-live="polite">{unreadCount} unread</span>
        </header>
        <div className="notifications-list" aria-live="polite">
          {notificationItems.length === 0 && notificationLoadError ? (
            <p className="notification-load-error" role="alert">{notificationLoadError}</p>
          ) : notificationItems.length === 0 ? (
            <div className="notifications-empty">
              <Bell size={28} aria-hidden="true" />
              <strong>No notifications yet</strong>
              <p>New account and marketplace updates will appear here.</p>
            </div>
          ) : notificationItems.map((item) => {
            const isUnread = !item.read_at;
            const isMarking = markingNotificationId === item.id;
            return (
              <article className={`notification-item${isUnread ? " is-unread" : ""}`} key={item.id}>
                <span className="notification-icon"><Bell size={17} aria-hidden="true" /></span>
                <div className="notification-content">
                  <h3 className="notification-title">{item.title || "Notification"}</h3>
                  <p className="notification-body">{item.message || "There is an update to review."}</p>
                  <div className="notification-meta">
                    <time className="notification-time" dateTime={item.created_at || undefined}>{formatDate(item.created_at)}</time>
                    <span className={`notification-badge${isUnread ? " unread" : ""}`}>{isUnread ? "Unread" : "Read"}</span>
                  </div>
                </div>
                {isUnread && (
                  <div className="notification-actions">
                    <button
                      type="button"
                      className="notification-mark-read"
                      onClick={() => markNotificationRead(item)}
                      disabled={Boolean(markingNotificationId)}
                      aria-label={`Mark ${item.title || "notification"} as read`}
                    >
                      {isMarking ? "Saving…" : "Mark as read"}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {!isStaff && <section className="dashboard-section">
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
      </section>}

      {!isStaff && recent.length > 0 && (
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

