import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Package,
  ShoppingCart,
  ShieldAlert,
  UserRoundCog,
  UserRound,
  Users,
  Tags,
  XCircle,
} from "lucide-react";
import AdminLayout from "./components/AdminLayout";
import { API_URL } from "./utils/api";
import { Badge, Button, EmptyState, LoadingSpinner, StatCard, Table } from "./ui";
import "./AdminDashboard.css";

function formatCount(value) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : String(value ?? 0);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getBarWidth(value, total) {
  if (!total || value <= 0) return "0%";
  return `${Math.min(100, Math.max(0, (value / total) * 100))}%`;
}

function getActivityStatus(status) {
  const key = String(status || "").toLowerCase();
  return {
    open: { variant: "danger", label: "Open" },
    under_review: { variant: "warning", label: "Under review" },
    pending: { variant: "warning", label: "Pending" },
    active: { variant: "success", label: "Active" },
    approved: { variant: "success", label: "Approved" },
    confirmed: { variant: "success", label: "Confirmed" },
    ready_for_pickup: { variant: "info", label: "Ready for pickup" },
    completed: { variant: "success", label: "Completed" },
    resolved: { variant: "success", label: "Resolved" },
    rejected: { variant: "danger", label: "Rejected" },
    declined: { variant: "danger", label: "Declined" },
    cancelled: { variant: "neutral", label: "Cancelled" },
    archived: { variant: "neutral", label: "Archived" },
  }[key] || { variant: "neutral", label: String(status || "—") };
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState(null);
  const [categoryError, setCategoryError] = useState("");
  const [trendPeriod, setTrendPeriod] = useState("30d");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchStats = useCallback(async () => {
    const token = localStorage.getItem("token");
    let response;
    try {
      response = await fetch(API_URL + "/admin/stats?period=" + encodeURIComponent(trendPeriod), {
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: "Bearer " + token } : {}),
        },
      });
    } catch (requestError) {
      console.error("Dashboard API request failed:", requestError);
      throw new Error("Unable to reach the Laravel API. Confirm the backend is running, then try again.");
    }

    if (response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("role");
      navigate("/login", { replace: true });
      return null;
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Dashboard API returned HTTP", response.status);
      if (response.status >= 500) {
        throw new Error("Dashboard data is temporarily unavailable. Check the API and database services, then try again.");
      }
      throw new Error(data.message || "Unable to load marketplace overview.");
    }
    if (!data.stats || typeof data.stats !== "object" || Array.isArray(data.stats)) {
      throw new Error("The marketplace overview response did not include statistics.");
    }
    return data.stats;
  }, [navigate, trendPeriod]);

  const fetchCategories = useCallback(async () => {
    const token = localStorage.getItem("token");
    const response = await fetch(API_URL + "/admin/categories", {
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("role");
      navigate("/login", { replace: true });
      return;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error("Unable to load listing categories.");
    setCategories(Array.isArray(data.categories) ? data.categories : []);
    setCategoryError("");
  }, [navigate]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchCategories().catch((err) => {
        console.error("Dashboard categories request failed:", err);
        setCategoryError("Category totals are temporarily unavailable.");
        setCategories([]);
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchCategories]);

  useEffect(() => {
    let active = true;
    fetchStats()
      .then((nextStats) => {
        if (active && nextStats !== null) setStats(nextStats);
      })
      .catch((err) => {
        if (active) setError(err.message || "We could not load the marketplace overview. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [fetchStats]);

  const refreshStats = async () => {
    if (stats) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      setStats(await fetchStats());
    } catch (err) {
      setError(err.message || "We could not load the marketplace overview. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const stat = (key) => {
    if (!stats) return null;
    const value = stats?.[key];
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };

  const primaryMetrics = [
    {
      label: "Student accounts",
      value: stat("total_students"),
      subtitle: "Students in the marketplace",
      tone: "info",
      icon: UserRound,
      to: "/admin/users",
    },
    {
      label: "Active listings",
      value: stat("active_products"),
      subtitle: "Approved and visible to students",
      tone: "success",
      icon: Package,
      to: "/admin/products",
    },
    {
      label: "Pending orders",
      value: stat("new_orders"),
      subtitle: "Awaiting seller confirmation",
      tone: "warning",
      icon: ShoppingCart,
      to: "/admin/transactions?status=pending",
    },
    {
      label: "Pending moderation",
      value: stat("pending_products"),
      subtitle: "Listings waiting for review",
      tone: "warning",
      icon: ShieldAlert,
      to: "/admin/product-moderation",
    },
  ];

  const attentionItems = [
    {
      key: "pending_products",
      label: "Pending listing approvals",
      subtitle: "Listings waiting for an administrator decision",
      value: stat("pending_products"),
      tone: "pending",
      statusLabel: "Pending review",
      statusVariant: "warning",
      to: "/admin/product-moderation",
      icon: ShieldAlert,
    },
    {
      key: "open_complaints",
      label: "Open complaints",
      subtitle: "Student complaints that need a response",
      value: stat("open_complaints"),
      tone: "danger",
      statusLabel: "Open",
      statusVariant: "danger",
      to: "/admin/complaints",
      icon: XCircle,
    },
    {
      key: "new_orders",
      label: "Pending orders",
      subtitle: "Orders awaiting confirmation",
      value: stat("new_orders"),
      tone: "pending",
      statusLabel: "Pending",
      statusVariant: "warning",
      to: "/admin/transactions",
      icon: CreditCard,
    },
    {
      key: "pending_staff_applications",
      label: "Staff applications",
      subtitle: "Applications waiting for administrator review",
      value: stat("pending_staff_applications"),
      tone: "pending",
      statusLabel: "Pending review",
      statusVariant: "warning",
      to: "/admin/staff?status=pending",
      icon: UserRoundCog,
    },
    {
      key: "low_stock_products",
      label: "Low-stock listings",
      subtitle: "Listings running low on inventory",
      value: stat("low_stock_products"),
      tone: "warning",
      statusLabel: "Low stock",
      statusVariant: "warning",
      to: "/admin/products",
      icon: Package,
    },
  ];

  const actionableItems = attentionItems.filter((item) => item.value !== null && Number(item.value) > 0);
  const hasUnavailableAttentionCount = attentionItems.some((item) => item.value === null);
  const recentActivity = Array.isArray(stats?.recent_activity) ? stats.recent_activity : [];
  const recent = recentActivity.slice(0, 6);
  const orderTotal = stat("total_orders");
  const productTotal = stat("total_products");
  const orderBreakdown = [
    { label: "Pending", key: "pending_orders", tone: "warning" },
    { label: "Confirmed", key: "processing_orders", tone: "info" },
    { label: "Ready for pickup", key: "ready_for_pickup_orders", tone: "info" },
    { label: "Completed", key: "completed_orders", tone: "success" },
    { label: "Declined", key: "declined_orders", tone: "danger" },
    { label: "Cancelled", key: "cancelled_orders", tone: "neutral" },
  ].map((item) => ({ ...item, value: stat(item.key) }));
  const listingBreakdown = [
    { label: "Active", key: "active_products", tone: "success" },
    { label: "Pending review", key: "pending_products", tone: "warning" },
    { label: "Inactive", key: "inactive_products", tone: "neutral" },
    { label: "Sold out", key: "sold_out_products", tone: "info" },
    { label: "Rejected", key: "rejected_products", tone: "danger" },
    { label: "Suspended", key: "suspended_products", tone: "danger" },
    { label: "Archived", key: "archived_products", tone: "neutral" },
  ].map((item) => ({ ...item, value: stat(item.key) }));
  const hasOrderBreakdown = orderTotal !== null && orderBreakdown.every((item) => item.value !== null);
  const hasListingBreakdown = productTotal !== null && listingBreakdown.every((item) => item.value !== null);
  const categoryRows = Array.isArray(categories)
    ? categories
        .filter((category) => Number(category.listings_count) > 0 || Number(category.archived_count) > 0)
        .sort((left, right) => Number(right.listings_count || 0) - Number(left.listings_count || 0))
        .slice(0, 6)
    : [];
  const categoryMax = Math.max(1, ...categoryRows.map((category) => Number(category.listings_count) || 0));
  const orderTrend = Array.isArray(stats?.orders_over_time) ? stats.orders_over_time : [];
  const trendMax = Math.max(1, ...orderTrend.map((item) => Number(item.orders) || 0));
  const trendPoints = orderTrend.map((item, index) => ({
    ...item,
    x: orderTrend.length < 2 ? 360 : 28 + (index * 664) / (orderTrend.length - 1),
    y: 166 - ((Number(item.orders) || 0) / trendMax) * 132,
  }));
  const trendLinePoints = trendPoints.map((item) => `${item.x},${item.y}`).join(" ");

  if (loading && !stats) {
    return (
      <AdminLayout title="Dashboard" subtitle="Overview of marketplace activity and administrative tasks.">
        <div className="dashboard-loading">
          <LoadingSpinner size="lg" />
          <p className="dashboard-loading-text">Loading marketplace overview…</p>
        </div>
      </AdminLayout>
    );
  }

  if (error && !stats) {
    return (
      <AdminLayout title="Dashboard" subtitle="Overview of marketplace activity and administrative tasks.">
        <div className="dashboard-error-state" role="alert">
          <AlertCircle size={22} aria-hidden="true" />
          <div>
            <strong>Unable to load the dashboard</strong>
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" loading={refreshing} onClick={refreshStats}>
            Try again
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Dashboard" subtitle="Overview of marketplace activity and administrative tasks.">
      {error && (
        <div className="dashboard-error" role="alert">
          <div className="dashboard-error-body">
            <strong>Unable to load overview</strong>
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" loading={refreshing} onClick={refreshStats}>
            Try again
          </Button>
        </div>
      )}

      <section className="dashboard-section dashboard-attention" aria-labelledby="dashboard-attention-title">
        <div className="dashboard-section-header">
          <div>
            <span className="dashboard-section-eyebrow">Action queue</span>
            <h2 className="dashboard-section-title" id="dashboard-attention-title">Needs attention</h2>
            <p className="dashboard-section-subtitle">Items with work waiting for an administrator.</p>
          </div>
          <Button variant="outline" size="sm" loading={refreshing} onClick={refreshStats}>
            Refresh overview
          </Button>
        </div>

        {stats === null ? (
          <div className="attention-empty" role="status">
            <span className="attention-empty-icon"><ShieldAlert size={19} aria-hidden="true" /></span>
            <div>
              <strong>Action queue unavailable</strong>
              <p>Refresh the overview to check for items that need attention.</p>
            </div>
          </div>
        ) : actionableItems.length > 0 ? (
          <>
            <div className={"attention-list" + (actionableItems.length === 1 ? " attention-list--single" : "")}>
              {actionableItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.key}
                    to={item.to}
                    className={"attention-row attention-row--" + item.tone}
                    aria-label={"View " + item.label + ": " + formatCount(item.value)}
                  >
                    <span className="attention-icon">
                      <Icon size={19} aria-hidden="true" />
                    </span>
                    <span className="attention-copy">
                      <span className="attention-label">{item.label}</span>
                      <span className="attention-subtitle">{item.subtitle}</span>
                      <span className="attention-status">
                        <Badge variant={item.statusVariant} size="sm">{item.statusLabel}</Badge>
                      </span>
                    </span>
                    <strong className="attention-value">{formatCount(item.value)}</strong>
                    <ArrowRight size={16} className="attention-arrow" aria-hidden="true" />
                  </Link>
                );
              })}
            </div>
            {hasUnavailableAttentionCount && (
              <p className="attention-data-note" role="status">
                Some attention counts were not included in the API response.
              </p>
            )}
          </>
        ) : hasUnavailableAttentionCount ? (
          <div className="attention-empty" role="status">
            <span className="attention-empty-icon"><AlertCircle size={19} aria-hidden="true" /></span>
            <div>
              <strong>Action queue counts unavailable</strong>
              <p>The API did not provide all attention counts, so this section cannot confirm that there are no pending items.</p>
            </div>
          </div>
        ) : (
          <div className="attention-empty" role="status">
            <span className="attention-empty-icon"><CheckCircle2 size={19} aria-hidden="true" /></span>
            <div>
              <strong>You’re all caught up</strong>
              <p>There are no product reviews, complaints, pending orders, staff applications, or low-stock listings waiting for action.</p>
            </div>
          </div>
        )}
      </section>

      <section className="dashboard-section dashboard-summary" aria-labelledby="dashboard-summary-title">
        <div className="dashboard-section-header">
          <div>
            <span className="dashboard-section-eyebrow">Marketplace snapshot</span>
            <h2 className="dashboard-section-title" id="dashboard-summary-title">At a glance</h2>
          </div>
        </div>
        <div className="metrics-grid" aria-label="Marketplace summary">
          {primaryMetrics.map((item) => (
            <StatCard
              key={item.label}
              label={item.label}
              value={formatCount(item.value)}
              icon={item.icon}
              tone={item.tone}
              subtitle={item.subtitle}
              href={item.to}
            />
          ))}
        </div>
      </section>

      <section className="dashboard-section dashboard-insights" aria-labelledby="dashboard-insights-title">
        <div className="dashboard-section-header">
          <div>
            <span className="dashboard-section-eyebrow">Marketplace activity</span>
            <h2 className="dashboard-section-title" id="dashboard-insights-title">Orders and listing status</h2>
            <p className="dashboard-section-subtitle">A current breakdown from marketplace records.</p>
          </div>
        </div>
        <div className="dashboard-insight-grid">
          <article className="dashboard-chart-card" aria-labelledby="dashboard-order-chart-title">
            <div className="dashboard-chart-heading">
              <div>
                <h3 id="dashboard-order-chart-title">Orders by status</h3>
                <p>{formatCount(orderTotal)} total orders</p>
              </div>
              <CreditCard size={19} aria-hidden="true" />
            </div>
            {!hasOrderBreakdown ? (
              <div className="dashboard-chart-empty" role="status">Order status totals are not available.</div>
            ) : orderTotal === 0 ? (
              <div className="dashboard-chart-empty" role="status">No orders have been placed yet.</div>
            ) : (
              <div className="dashboard-chart-rows" role="img" aria-label={"Orders by status: " + orderBreakdown.map((item) => `${item.label} ${formatCount(item.value)}`).join(", ")}>
                {orderBreakdown.map((item) => (
                  <div className="dashboard-chart-row" key={item.key}>
                    <span className="dashboard-chart-label">{item.label}</span>
                    <span className="dashboard-chart-track" title={`${item.label}: ${formatCount(item.value)} of ${formatCount(orderTotal)}`} aria-hidden="true">
                      <span className={`dashboard-chart-fill dashboard-chart-fill--${item.tone}`} style={{ width: getBarWidth(item.value, orderTotal) }} />
                    </span>
                    <strong className="dashboard-chart-value">{formatCount(item.value)}</strong>
                  </div>
                ))}
              </div>
            )}
          </article>
          <article className="dashboard-chart-card" aria-labelledby="dashboard-listing-chart-title">
            <div className="dashboard-chart-heading">
              <div>
                <h3 id="dashboard-listing-chart-title">Listings by status</h3>
                <p>{formatCount(productTotal)} total listings</p>
              </div>
              <Package size={19} aria-hidden="true" />
            </div>
            {!hasListingBreakdown ? (
              <div className="dashboard-chart-empty" role="status">Listing status totals are not available.</div>
            ) : productTotal === 0 ? (
              <div className="dashboard-chart-empty" role="status">No listings have been submitted yet.</div>
            ) : (
              <div className="dashboard-chart-rows" role="img" aria-label={"Listings by status: " + listingBreakdown.map((item) => `${item.label} ${formatCount(item.value)}`).join(", ")}>
                {listingBreakdown.map((item) => (
                  <div className="dashboard-chart-row" key={item.key}>
                    <span className="dashboard-chart-label">{item.label}</span>
                    <span className="dashboard-chart-track" title={`${item.label}: ${formatCount(item.value)} of ${formatCount(productTotal)}`} aria-hidden="true">
                      <span className={`dashboard-chart-fill dashboard-chart-fill--${item.tone}`} style={{ width: getBarWidth(item.value, productTotal) }} />
                    </span>
                    <strong className="dashboard-chart-value">{formatCount(item.value)}</strong>
                  </div>
                ))}
              </div>
            )}
          </article>
          <article className="dashboard-chart-card dashboard-trend-card" aria-labelledby="dashboard-trend-title">
            <div className="dashboard-chart-heading dashboard-trend-heading">
              <div>
                <h3 id="dashboard-trend-title">Orders over time</h3>
                <p>New orders created during the selected period</p>
              </div>
              <label className="dashboard-trend-filter">
                <span>Trend range</span>
                <select value={trendPeriod} onChange={(event) => setTrendPeriod(event.target.value)}>
                  <option value="today">Today</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 3 months</option>
                  <option value="12m">Last 12 months</option>
                </select>
              </label>
            </div>
            {orderTrend.length === 0 ? (
              <div className="dashboard-chart-empty" role="status">No order trend data is available for this period.</div>
            ) : (
              <div className="dashboard-trend-visual" role="img" aria-label={`Orders over time: ${orderTrend.map((item) => `${item.label}, ${item.orders} orders`).join("; ")}`}>
                <svg viewBox="0 0 720 200" preserveAspectRatio="none" aria-hidden="true">
                  <line x1="28" y1="166" x2="692" y2="166" className="dashboard-trend-axis" />
                  <line x1="28" y1="100" x2="692" y2="100" className="dashboard-trend-gridline" />
                  <line x1="28" y1="34" x2="692" y2="34" className="dashboard-trend-gridline" />
                  {trendPoints.length > 1 && <polyline points={trendLinePoints} className="dashboard-trend-line" />}
                  {trendPoints.map((point) => (
                    <circle key={point.key} cx={point.x} cy={point.y} r="4" className="dashboard-trend-point">
                      <title>{point.label}: {point.orders} orders</title>
                    </circle>
                  ))}
                </svg>
                <div className="dashboard-trend-labels" aria-hidden="true">
                  <span>{orderTrend[0].label}</span>
                  {orderTrend.length > 2 && <span>{orderTrend[Math.floor((orderTrend.length - 1) / 2)].label}</span>}
                  {orderTrend.length > 1 && <span>{orderTrend[orderTrend.length - 1].label}</span>}
                </div>
              </div>
            )}
          </article>
          <article className="dashboard-chart-card" aria-labelledby="dashboard-category-chart-title">
            <div className="dashboard-chart-heading">
              <div>
                <h3 id="dashboard-category-chart-title">Active listings by category</h3>
                <p>Archived listings are counted separately</p>
              </div>
              <Tags size={19} aria-hidden="true" />
            </div>
            {categories === null ? (
              <div className="dashboard-chart-empty" role="status">Loading category totals…</div>
            ) : categoryError ? (
              <div className="dashboard-chart-empty" role="status">{categoryError}</div>
            ) : categoryRows.length === 0 ? (
              <div className="dashboard-chart-empty" role="status">No active or archived listings are assigned to a category.</div>
            ) : (
              <div className="dashboard-category-rows" role="img" aria-label="Active listings and archived listings by category">
                {categoryRows.map((category) => {
                  const activeListings = Number(category.listings_count) || 0;
                  const archivedListings = Number(category.archived_count) || 0;
                  return (
                    <div className="dashboard-category-row" key={category.id}>
                      <span className="dashboard-category-label">
                        <strong>{category.name}</strong>
                        <small>{archivedListings} archived</small>
                      </span>
                      <span className="dashboard-chart-track" aria-hidden="true">
                        <span className="dashboard-chart-fill dashboard-chart-fill--info" style={{ width: getBarWidth(activeListings, categoryMax) }} />
                      </span>
                      <strong className="dashboard-chart-value">{activeListings}</strong>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
          <article className="dashboard-chart-card dashboard-user-overview" aria-labelledby="dashboard-users-title">
            <div className="dashboard-chart-heading">
              <div>
                <h3 id="dashboard-users-title">User overview</h3>
                <p>Accounts by portal role</p>
              </div>
              <Users size={19} aria-hidden="true" />
            </div>
            <ul className="dashboard-user-rows">
              {[
                ["Students", stat("total_students")],
                ["Staff", stat("total_staff")],
                ["Administrators", stat("total_admins")],
              ].map(([label, value]) => (
                <li key={label}><span>{label}</span><strong>{formatCount(value)}</strong></li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="dashboard-section dashboard-recent" aria-labelledby="dashboard-recent-title">
        <div className="dashboard-section-header">
          <div>
            <span className="dashboard-section-eyebrow">Recent activity</span>
            <h2 className="dashboard-section-title" id="dashboard-recent-title">Latest marketplace actions</h2>
            <p className="dashboard-section-subtitle">Recent actions across users, listings, and orders.</p>
          </div>
          {recentActivity.length > 6 && (
            <Button variant="outline" size="sm" onClick={() => navigate("/admin/activity-logs")}>
              View all activity logs
            </Button>
          )}
        </div>

        <div className="recent-table-wrap" role="region" aria-label="Recent marketplace activity" tabIndex={0}>
          {!Array.isArray(stats?.recent_activity) ? (
            <EmptyState
              icon={AlertCircle}
              title="Recent activity unavailable"
              subtitle="The API response did not include recent activity for this dashboard."
            />
          ) : recent.length === 0 ? (
            <EmptyState
              icon={UserRound}
              title="No recent activity"
              subtitle="There are no recent marketplace actions recorded yet."
            />
          ) : (
            <Table>
              <table className="tmc-table">
                <Table.Header>
                  <tr>
                    <Table.HeadCell style={{ width: "220px" }}>User</Table.HeadCell>
                    <Table.HeadCell>Action</Table.HeadCell>
                    <Table.HeadCell style={{ width: "170px" }}>Date / time</Table.HeadCell>
                    <Table.HeadCell style={{ width: "140px" }}>Status</Table.HeadCell>
                  </tr>
                </Table.Header>
                <Table.Body>
                  {recent.map((item, index) => {
                    const badge = getActivityStatus(item.status);
                    const rowKey = String(item.type || "activity") + "-" + String(item.date_time || index) + "-" + index;
                    return (
                      <Table.Row key={rowKey}>
                        <Table.Cell className="user-cell-main">
                          <strong>{item.user || "—"}</strong>
                          <span>{item.type || "—"}</span>
                        </Table.Cell>
                        <Table.Cell>{item.action || "—"}</Table.Cell>
                        <Table.Cell style={{ fontSize: 12.5 }}>{formatDate(item.date_time)}</Table.Cell>
                        <Table.Cell>
                          <Badge variant={badge.variant} size="sm">{badge.label}</Badge>
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </table>
            </Table>
          )}
        </div>
      </section>
    </AdminLayout>
  );
}
