import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  CreditCard,
  Eye,
  MessageSquare,
  Package,
  Search,
  ShieldCheck,
  ShoppingCart,
  UserRound,
  X,
} from "lucide-react";
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

const notificationCategoryFor = (item) => {
  const event = String(item?.event || "").toLowerCase();
  if (/payment|commission/.test(event)) return "payments";
  if (event.startsWith("order_") || event === "order_activity" || item?.order_id || item?.order_number) return "orders";
  if (/complaint/.test(event) || item?.complaint_id) return "complaints";
  if (/product|listing|stock|moderation|warning/.test(event) || item?.product_id || item?.warning_id) return "listings";
  return "system";
};

const notificationCategoryDetails = {
  orders: { label: "Orders & sales", icon: ShoppingCart },
  payments: { label: "Payments", icon: CreditCard },
  listings: { label: "Listings", icon: Package },
  complaints: { label: "Complaints", icon: MessageSquare },
  system: { label: "System", icon: BellRing },
};

const notificationReference = (item) => {
  if (item?.order_number) return { label: "Order", value: item.order_number };
  if (item?.order_id) return { label: "Order ID", value: item.order_id };
  if (item?.product_id) return { label: "Product ID", value: item.product_id };
  if (item?.complaint_id) return { label: "Complaint ID", value: item.complaint_id };
  if (item?.warning_id) return { label: "Warning ID", value: item.warning_id };
  return null;
};

const readableStatus = (value) => {
  if (!value) return "Update received";
  return String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const activityTypeDetails = (type) => {
  const normalized = String(type || "").toLowerCase();
  if (normalized === "user") return { label: "Account", icon: UserRound, tone: "account" };
  if (normalized === "product") return { label: "Listing", icon: Package, tone: "listing" };
  if (normalized === "order") return { label: "Order", icon: ShoppingCart, tone: "order" };
  if (normalized === "moderation") return { label: "Moderation", icon: ShieldCheck, tone: "moderation" };
  if (normalized === "complaint") return { label: "Complaint", icon: MessageSquare, tone: "complaint" };
  return { label: "Activity", icon: ClipboardList, tone: "other" };
};

const activityInitials = (value) => {
  const initials = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return initials || "—";
};

const activityStatusTone = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (["active", "resolved", "completed", "approved", "confirmed", "ready_for_pickup"].includes(normalized)) return "success";
  if (["pending", "under_review", "processing", "in_review", "out_of_stock"].includes(normalized)) return "warning";
  if (["open", "rejected", "declined", "suspended", "cancelled"].includes(normalized)) return "danger";
  return "neutral";
};

const formatActivityDateTime = (value) => {
  if (!value) return { date: "—", time: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "—", time: "" };
  return {
    date: date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }),
    time: date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
  };
};

export default function AdminNotifications() {
  const isStaff = getStoredRole() === "staff";
  const [stats, setStats] = useState(null);
  const [notificationItems, setNotificationItems] = useState([]);
  const [selectedNotificationId, setSelectedNotificationId] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [markingNotificationId, setMarkingNotificationId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notificationLoadError, setNotificationLoadError] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [readFilter, setReadFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activityQuery, setActivityQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
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
        const incomingItems = notificationsResult.value.notifications;
        setNotificationItems(incomingItems);
        setSelectedNotificationId((currentId) => (
          currentId && incomingItems.some((item) => String(item.id) === String(currentId))
            ? currentId
            : incomingItems[0]?.id ?? null
        ));
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

  const notificationCounts = useMemo(() => notificationItems.reduce((counts, item) => {
    const category = notificationCategoryFor(item);
    counts[category] += 1;
    return counts;
  }, { orders: 0, payments: 0, listings: 0, complaints: 0, system: 0 }), [notificationItems]);

  const filteredNotifications = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return notificationItems.filter((item) => {
      const categoryMatches = categoryFilter === "all" || notificationCategoryFor(item) === categoryFilter;
      const readMatches = readFilter === "all"
        || (readFilter === "unread" ? !item.read_at : Boolean(item.read_at));
      const searchMatches = !query || [item.title, item.message, item.event, item.order_number, item.status, item.product_id, item.complaint_id, item.warning_id]
        .some((value) => String(value || "").toLowerCase().includes(query));
      return categoryMatches && readMatches && searchMatches;
    });
  }, [categoryFilter, notificationItems, readFilter, searchQuery]);

  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filteredNotifications.length / pageSize));
  const visiblePage = Math.min(currentPage, pageCount);
  const pageNotifications = filteredNotifications.slice((visiblePage - 1) * pageSize, visiblePage * pageSize);
  const firstVisible = filteredNotifications.length ? (visiblePage - 1) * pageSize + 1 : 0;
  const lastVisible = Math.min(visiblePage * pageSize, filteredNotifications.length);
  const selectedNotification = notificationItems.find((item) => String(item.id) === String(selectedNotificationId)) || null;
  const readCount = notificationItems.reduce((count, item) => count + (item.read_at ? 1 : 0), 0);



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
  const normalizedActivityQuery = activityQuery.trim().toLowerCase();
  const filteredRecent = recent.filter((item) => (
    !normalizedActivityQuery || [item.user, item.role, item.type, item.action, item.target, item.status]
      .some((value) => String(value || "").toLowerCase().includes(normalizedActivityQuery))
  ));
  const summaryCards = [
    { label: "Inbox records", value: notificationItems.length, description: "Latest notifications", icon: Bell, tone: "blue" },
    { label: "Unread", value: unreadCount, description: "Awaiting your attention", icon: BellRing, tone: "amber" },
    { label: "Read", value: readCount, description: "In the loaded inbox", icon: CheckCheck, tone: "green" },
    { label: "Orders & sales", value: notificationCounts.orders, description: "Order-related updates", icon: ShoppingCart, tone: "violet" },
    { label: "Listings", value: notificationCounts.listings, description: "Product and inventory updates", icon: Package, tone: "teal" },
    { label: "Complaints", value: notificationCounts.complaints, description: "Complaint updates", icon: MessageSquare, tone: "rose" },
  ];
  const categoryFilters = [
    { id: "all", label: "All", count: notificationItems.length },
    { id: "orders", label: "Orders", count: notificationCounts.orders },
    { id: "payments", label: "Payments", count: notificationCounts.payments },
    { id: "listings", label: "Listings", count: notificationCounts.listings },
    { id: "complaints", label: "Complaints", count: notificationCounts.complaints },
    { id: "system", label: "System", count: notificationCounts.system },
  ];

  return (
    <AdminLayout title="Notifications" subtitle="TMC StudentMart - notifications and alerts">
      <div className="notifications-page">
        <AdminPageHero
          title="Notifications"
          description="Stay updated with order, listing, complaint, and system activity across your workspace."
          icon={Bell}
          onRefresh={refreshNotifications}
          refreshing={loading || refreshing}
          autoRefreshIntervalMs={120_000}
          autoRefreshKey="notifications"
          autoRefreshPaused={Boolean(markingNotificationId)}
          className="notifications-page-hero"
          meta={<span className="notifications-hero-meta">{unreadCount} unread notification{unreadCount === 1 ? "" : "s"}</span>}
        />

        {error && (
          <div className="notification-error" role="alert">
            <Bell size={18} aria-hidden="true" />
            <div><strong>Notifications need attention</strong><span>{error}</span></div>
          </div>
        )}

        <section className="notification-summary-grid" aria-label="Notification summary">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <article className={`notification-summary-card notification-summary-card--${card.tone}`} key={card.label}>
                <span className="notification-summary-icon"><Icon size={19} aria-hidden="true" /></span>
                <div className="notification-summary-copy">
                  <span>{card.label}</span>
                  <strong>{loading ? "—" : card.value}</strong>
                  <small>{card.description}</small>
                </div>
              </article>
            );
          })}
        </section>

        <div className="notifications-workspace">
          <section className="notifications-section" aria-labelledby="your-notifications-title">
            <header className="notifications-header">
              <div>
                <span className="notifications-eyebrow">YOUR INBOX</span>
                <h2 id="your-notifications-title">Recent notifications</h2>
                <p>{notificationLoadError ? "Notification status is unavailable." : unreadCount === 0 ? "You are all caught up." : `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"} waiting for your attention.`}</p>
              </div>
              <span className="notification-badge" aria-live="polite">{unreadCount} unread</span>
            </header>

            <div className="notification-inbox-toolbar">
              <div className="notification-category-filters" role="group" aria-label="Filter notifications by category">
                {categoryFilters.map((category) => (
                  <button
                    type="button"
                    key={category.id}
                    className={categoryFilter === category.id ? "active" : ""}
                    aria-pressed={categoryFilter === category.id}
                    onClick={() => { setCategoryFilter(category.id); setCurrentPage(1); }}
                  >
                    {category.label}<span>{category.count}</span>
                  </button>
                ))}
              </div>
              <div className="notification-list-controls">
                <label className="notification-search">
                  <Search size={17} aria-hidden="true" />
                  <span className="sr-only">Search notifications</span>
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => { setSearchQuery(event.target.value); setCurrentPage(1); }}
                    placeholder="Search notifications…"
                  />
                </label>
                <label className="notification-status-filter">
                  <span>Status</span>
                  <select value={readFilter} onChange={(event) => { setReadFilter(event.target.value); setCurrentPage(1); }}>
                    <option value="all">All notifications</option>
                    <option value="unread">Unread only</option>
                    <option value="read">Read only</option>
                  </select>
                </label>
              </div>
            </div>

            {loading ? (
              <div className="notification-list-state" role="status"><span className="notification-loading-dot" />Loading your notifications…</div>
            ) : notificationItems.length === 0 ? (
              <div className="notifications-empty">
                <span className="notifications-empty-icon"><Bell size={25} aria-hidden="true" /></span>
                <strong>{notificationLoadError ? "Your inbox could not be loaded" : "No notifications yet"}</strong>
                <p>{notificationLoadError || "New account and marketplace updates will appear here."}</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="notifications-empty notifications-empty--compact">
                <span className="notifications-empty-icon"><Search size={23} aria-hidden="true" /></span>
                <strong>No matching notifications</strong>
                <p>Try another search term or change the selected filters.</p>
                <button type="button" onClick={() => { setSearchQuery(""); setCategoryFilter("all"); setReadFilter("all"); setCurrentPage(1); }}>Clear filters</button>
              </div>
            ) : (
              <>
                <div className="notification-table-scroll" role="region" aria-label="Notification results" tabIndex="0">
                  <table className="notification-table">
                    <thead>
                      <tr>
                        <th scope="col">Type</th>
                        <th scope="col">Message</th>
                        <th scope="col">Related record</th>
                        <th scope="col">Date &amp; time</th>
                        <th scope="col">Status</th>
                        <th scope="col"><span className="sr-only">Action</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageNotifications.map((item) => {
                        const category = notificationCategoryFor(item);
                        const categoryDetails = notificationCategoryDetails[category];
                        const TypeIcon = categoryDetails.icon;
                        const reference = notificationReference(item);
                        const isUnread = !item.read_at;
                        const isSelected = String(item.id) === String(selectedNotificationId);
                        return (
                          <tr className={`${isUnread ? "is-unread " : ""}${isSelected ? "is-selected" : ""}`} key={item.id}>
                            <td>
                              <span className={`notification-type notification-type--${category}`}>
                                <span className="notification-type-icon"><TypeIcon size={15} aria-hidden="true" /></span>
                                <span>{categoryDetails.label}</span>
                              </span>
                            </td>
                            <td className="notification-message-cell">
                              <strong>{item.title || "Notification"}</strong>
                              <span>{item.message || "There is an update to review."}</span>
                            </td>
                            <td className="notification-reference-cell">
                              {reference ? <><strong>{reference.value}</strong><span>{reference.label}</span></> : <span className="notification-no-reference">—</span>}
                              {item.status && <small>{readableStatus(item.status)}</small>}
                            </td>
                            <td><time className="notification-time" dateTime={item.created_at || undefined}>{formatDate(item.created_at)}</time></td>
                            <td><span className={`notification-state${isUnread ? " notification-state--unread" : " notification-state--read"}`}><span />{isUnread ? "Unread" : "Read"}</span></td>
                            <td>
                              <button
                                type="button"
                                className="notification-view-button"
                                onClick={() => setSelectedNotificationId(item.id)}
                                aria-pressed={isSelected}
                                aria-label={`View details for ${item.title || "notification"}`}
                              >
                                <Eye size={15} aria-hidden="true" /><span>View</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <footer className="notification-table-footer">
                  <span>Showing {firstVisible}–{lastVisible} of {filteredNotifications.length} notification{filteredNotifications.length === 1 ? "" : "s"}</span>
                  <nav className="notification-pagination" aria-label="Notification pages">
                    <button type="button" onClick={() => setCurrentPage(Math.max(1, visiblePage - 1))} disabled={visiblePage <= 1} aria-label="Previous page"><ChevronLeft size={17} aria-hidden="true" /></button>
                    <span>Page <strong>{visiblePage}</strong> of {pageCount}</span>
                    <button type="button" onClick={() => setCurrentPage(Math.min(pageCount, visiblePage + 1))} disabled={visiblePage >= pageCount} aria-label="Next page"><ChevronRight size={17} aria-hidden="true" /></button>
                  </nav>
                </footer>
              </>
            )}
          </section>

          <aside className="notification-detail-panel" aria-labelledby="notification-details-title">
            <header className="notification-detail-header">
              <span className="notification-detail-header-icon"><Bell size={18} aria-hidden="true" /></span>
              <div><span className="notifications-eyebrow">SELECTED UPDATE</span><h2 id="notification-details-title">Notification details</h2></div>
              <button type="button" className="notification-detail-close" onClick={() => setSelectedNotificationId(null)} aria-label="Clear selected notification"><X size={17} aria-hidden="true" /></button>
            </header>
            {selectedNotification ? (() => {
              const category = notificationCategoryFor(selectedNotification);
              const categoryDetails = notificationCategoryDetails[category];
              const DetailIcon = categoryDetails.icon;
              const reference = notificationReference(selectedNotification);
              const isUnread = !selectedNotification.read_at;
              return (
                <div className="notification-detail-content" key={selectedNotification.id}>
                  <div className="notification-detail-topline">
                    <span className={`notification-state${isUnread ? " notification-state--unread" : " notification-state--read"}`}><span />{isUnread ? "Unread" : "Read"}</span>
                    <time dateTime={selectedNotification.created_at || undefined}>{formatDate(selectedNotification.created_at)}</time>
                  </div>
                  <span className={`notification-detail-type notification-detail-type--${category}`}><DetailIcon size={18} aria-hidden="true" /></span>
                  <h3>{selectedNotification.title || "Notification"}</h3>
                  <p className="notification-detail-message">{selectedNotification.message || "There is an update to review."}</p>
                  <dl className="notification-detail-facts">
                    <div><dt>Category</dt><dd>{categoryDetails.label}</dd></div>
                    {reference && <div><dt>{reference.label}</dt><dd>{reference.value}</dd></div>}
                    {selectedNotification.status && <div><dt>Current status</dt><dd>{readableStatus(selectedNotification.status)}</dd></div>}
                    <div><dt>Received</dt><dd><time dateTime={selectedNotification.created_at || undefined}>{formatDate(selectedNotification.created_at)}</time></dd></div>
                  </dl>
                  <div className="notification-detail-actions">
                    {isUnread ? (
                      <button type="button" className="notification-mark-read" onClick={() => markNotificationRead(selectedNotification)} disabled={Boolean(markingNotificationId)}>
                        {markingNotificationId === selectedNotification.id ? <Clock3 size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
                        {markingNotificationId === selectedNotification.id ? "Saving…" : "Mark as read"}
                      </button>
                    ) : (
                      <p className="notification-read-confirmation"><CheckCheck size={16} aria-hidden="true" />You have read this notification.</p>
                    )}
                  </div>
                  <p className="notification-detail-note"><CircleHelp size={15} aria-hidden="true" />Opening details does not change the notification’s read status.</p>
                </div>
              );
            })() : (
              <div className="notification-detail-empty">
                <span><Bell size={22} aria-hidden="true" /></span>
                <strong>Select a notification</strong>
                <p>Choose a row to see its message, reference, and current status.</p>
              </div>
            )}
          </aside>
        </div>

        {!isStaff && <section className="dashboard-section notification-admin-section">
          <div className="dashboard-section-header">
            <div><span className="notifications-eyebrow">ADMIN OVERVIEW</span><h2 className="notification-secondary-title">Priority notifications</h2><p className="notification-secondary-copy">Action items that require administrator attention.</p></div>
          </div>
          <div className="dashboard-kpi-grid notification-priority-grid">
            {notifications.length === 0 ? (
              <div className="tmc-empty notification-all-clear">
                <div className="tmc-empty-icon" aria-hidden="true">✓</div>
                <h2>All clear</h2>
                <p>There are no priority notifications right now.</p>
              </div>
            ) : (
              notifications.map((item) => (
                <a key={item.id} href={item.to} onClick={(event) => { event.preventDefault(); window.location.href = item.to; }} className="tmc-card notification-priority-card">
                  <span className="notification-priority-icon" aria-hidden="true">!</span>
                  <span className="notification-priority-copy"><strong>{item.title}</strong><small>{item.body}</small></span>
                  <span className="tmc-badge notification-priority-badge" style={toneStyle(item.tone)}>{toneName(item.tone)}</span>
                </a>
              ))
            )}
          </div>
        </section>}

        {!isStaff && recent.length > 0 && (
          <section className="dashboard-section notification-admin-section">
            <div className="dashboard-section-header notification-activity-heading">
              <div>
                <span className="notifications-eyebrow">LATEST ACTIVITY</span>
                <h2 className="notification-secondary-title">Recent activity</h2>
                <p className="notification-secondary-copy">See who made each change, what it affected, and when it happened.</p>
              </div>
              <div className="notification-activity-tools">
                <span className="notification-activity-count">{filteredRecent.length} of {recent.length} records</span>
                <label className="notification-activity-search">
                  <Search size={16} aria-hidden="true" />
                  <span className="sr-only">Search recent activity</span>
                  <input
                    type="search"
                    value={activityQuery}
                    onChange={(event) => setActivityQuery(event.target.value)}
                    placeholder="Search activity…"
                  />
                </label>
              </div>
            </div>
            <div className="tmc-table-wrap notification-recent-table-wrap">
              <table className="tmc-table notification-recent-table" aria-label="Recent account and marketplace activity">
                <thead><tr><th scope="col">Type</th><th scope="col">Actor</th><th scope="col">Activity</th><th scope="col">Target record</th><th scope="col">Date &amp; time</th><th scope="col">Status</th></tr></thead>
                <tbody>
                  {filteredRecent.length === 0 ? (
                    <tr><td colSpan={6}><div className="notification-activity-empty"><Search size={18} aria-hidden="true" /><span>No recent activity matches that search.</span><button type="button" onClick={() => setActivityQuery("")}>Clear search</button></div></td></tr>
                  ) : filteredRecent.map((item, index) => {
                    const type = activityTypeDetails(item.type);
                    const TypeIcon = type.icon;
                    const dateTime = formatActivityDateTime(item.date_time);
                    const statusTone = activityStatusTone(item.status);
                    return (
                      <tr key={`${item.type || "activity"}-${item.date_time || "unknown"}-${index}`}>
                        <td><span className={`notification-activity-type notification-activity-type--${type.tone}`}><span><TypeIcon size={15} aria-hidden="true" /></span>{type.label}</span></td>
                        <td>
                          <div className="notification-activity-actor">
                            <span className="notification-activity-avatar" aria-hidden="true">{activityInitials(item.user)}</span>
                            <span className="notification-activity-actor-copy"><strong>{item.user || "Unknown user"}</strong><small>{readableStatus(item.role || "system")}</small></span>
                          </div>
                        </td>
                        <td className="notification-activity-action">{item.action || "Activity recorded"}</td>
                        <td className="notification-activity-target" title={item.target || undefined}>{item.target || "—"}</td>
                        <td><time className="notification-activity-time" dateTime={item.date_time || undefined}><span>{dateTime.date}</span>{dateTime.time && <small>{dateTime.time}</small>}</time></td>
                        <td><span className={`notification-recent-status notification-recent-status--${statusTone}`}><span aria-hidden="true" />{readableStatus(item.status)}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <footer className="notification-activity-footer">Showing {filteredRecent.length} of the {recent.length} latest activity records.</footer>
          </section>
        )}
      </div>
    </AdminLayout>
  );
}

