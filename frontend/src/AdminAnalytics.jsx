import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileBarChart,
  Package,
  Search,
  ShieldCheck,
  TrendingUp,
  Users,
  UserCheck,
  UserPlus,
  XCircle,
} from "lucide-react";

import { Link, useNavigate } from "react-router-dom";

import AdminLayout from "./components/AdminLayout";
import AdminPageHero from "./components/AdminPageHero";
import { API_URL } from "./utils/api";

import "./AdminAnalytics.css";


/* =========================================================
   DEFAULT ANALYTICS DATA
========================================================= */

const DEFAULT_STATS = {
  total_users: 0,
  total_students: 0,
  total_admins: 0,
  total_staff: 0,

  total_products: 0,
  pending_products: 0,
  approved_products: 0,
  active_products: 0,
  rejected_products: 0,
  inactive_products: 0,
  suspended_products: 0,
  sold_out_products: 0,
  archived_products: 0,
  total_orders: 0,
  listings_over_time: [],
  orders_over_time: [],
  complaints_over_time: [],
};

/* =========================================================
   HELPERS
========================================================= */

function safeNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function getPercentage(value, total) {
  if (!total || total <= 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

/* =========================================================
   STAT CARD
========================================================= */

function AnalyticsStatCard({
  title,
  value,
  description,
  icon: Icon,
  type = "blue",
}) {
  return (
    <article
      className={`analytics-stat-card ${type}`}
    >
      <div className="analytics-stat-top">
        <div className="analytics-stat-icon">
          <Icon
            size={21}
            strokeWidth={2}
          />
        </div>

        <span className="analytics-stat-label">
          {title}
        </span>
      </div>

      <strong className="analytics-stat-value">
        {value.toLocaleString()}
      </strong>

      <span className="analytics-stat-description">
        {description}
      </span>
    </article>
  );
}

/* =========================================================
   PROGRESS ROW
========================================================= */

function AnalyticsProgressRow({
  label,
  value,
  percentage,
  type,
  icon: Icon,
}) {
  return (
    <div className="analytics-progress-row">
      <div className="analytics-progress-heading">
        <div className="analytics-progress-label">
          <span
            className={`analytics-progress-icon ${type}`}
          >
            <Icon size={16} />
          </span>

          <span>{label}</span>
        </div>

        <strong>
          {value.toLocaleString()}
        </strong>
      </div>

      <div className="analytics-progress-track">
        <div
          className={`analytics-progress-fill ${type}`}
          style={{
            width: `${Math.min(
              Math.max(percentage, 0),
              100
            )}%`,
          }}
        />
      </div>

      <span className="analytics-progress-percent">
        {percentage}%
      </span>
    </div>
  );
}

function AnalyticsActivityChart({ stats, periodLabel }) {
  const series = [
    { key: "listings", label: "Listings", rows: stats.listings_over_time || [], className: "listing" },
    { key: "orders", label: "Orders", rows: stats.orders_over_time || [], className: "order" },
    { key: "complaints", label: "Complaints", rows: stats.complaints_over_time || [], className: "complaint" },
  ];
  const axis = series[0].rows;
  const maxValue = Math.max(1, ...series.flatMap((item) => item.rows.map((point) => safeNumber(point[item.key]))));
  const xAt = (index) => axis.length > 1 ? index * (700 / (axis.length - 1)) : 350;
  const yAt = (value) => 162 - (safeNumber(value) / maxValue) * 128;
  const tickEvery = Math.max(1, Math.ceil(axis.length / 6));
  const labels = axis.filter((_, index) => index === 0 || index === axis.length - 1 || index % tickEvery === 0);
  const hasActivity = series.some((item) => item.rows.some((point) => safeNumber(point[item.key]) > 0));

  return (
    <article className="analytics-panel analytics-activity-panel" id="analytics-activity">
      <div className="analytics-panel-header">
        <div><span>SELECTED PERIOD</span><h2>Marketplace Activity Trend</h2><p>Listings, orders, and complaints · {periodLabel}</p></div>
        <div className="analytics-panel-icon"><Activity size={19} /></div>
      </div>
      {hasActivity ? <>
        <svg className="analytics-activity-chart" viewBox="0 0 700 180" role="img" aria-label={`Listings, orders, and complaints during ${periodLabel}`}>
          {[34, 76, 119, 162].map((y) => <line key={y} x1="0" y1={y} x2="700" y2={y} className="analytics-activity-gridline" />)}
          {series.map((item) => <g key={item.key} className={`analytics-activity-series ${item.className}`}>
            <polyline points={item.rows.map((point, index) => `${xAt(index)},${yAt(point[item.key])}`).join(" ")} />
            {item.rows.map((point, index) => <circle key={`${item.key}-${point.key}`} cx={xAt(index)} cy={yAt(point[item.key])} r="3"><title>{point.label}: {safeNumber(point[item.key])} {item.label.toLowerCase()}</title></circle>)}
          </g>)}
        </svg>
        <div className="analytics-activity-axis">{labels.map((point) => <span key={point.key}>{point.label}</span>)}</div>
      </> : <div className="analytics-activity-empty">No listings, orders, or complaints were recorded during this period.</div>}
      <div className="analytics-activity-legend">{series.map((item) => <span key={item.key} className={item.className}><i />{item.label}</span>)}</div>
    </article>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

function AdminAnalytics() {
  const navigate = useNavigate();

  const [stats, setStats] =
    useState(DEFAULT_STATS);
  const [period, setPeriod] = useState("30d");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [reportSearch, setReportSearch] = useState("");
  const [reportType, setReportType] = useState("");
  const [reportSort, setReportSort] = useState("name");
  const [reportPage, setReportPage] = useState(1);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  /* =======================================================
     LOAD ANALYTICS
  ======================================================= */

  const loadAnalytics = useCallback(
    async (isRefresh = false) => {
      const token =
        localStorage.getItem("token");

      if (!token) {
        navigate("/login", {
          replace: true,
        });

        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setHasLoaded(false);
      }

      setError("");

      try {
        const response = await fetch(
          `${API_URL}/admin/stats?period=${encodeURIComponent(period)}`,
          {
            method: "GET",

            headers: {
              Accept:
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },
          }
        );

        /* ================================================
           AUTH ERROR
        ================================================ */

        if (
          response.status === 401 ||
          response.status === 403
        ) {
          localStorage.removeItem(
            "token"
          );

          localStorage.removeItem(
            "role"
          );

          localStorage.removeItem(
            "user"
          );

          navigate("/login", {
            replace: true,
          });

          return;
        }

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Unable to load analytics."
          );
        }

        const incoming =
          data.stats || data;

        setStats({
          total_users:
            safeNumber(
              incoming.total_users
            ),

          total_students:
            safeNumber(
              incoming.total_students
            ),

          total_admins:
            safeNumber(
              incoming.total_admins
            ),
          total_staff: safeNumber(incoming.total_staff),

          total_products:
            safeNumber(
              incoming.total_products
            ),

          pending_products:
            safeNumber(
              incoming.pending_products
            ),

          approved_products:
            safeNumber(
              incoming.approved_products ??
                incoming.active_products
            ),

          active_products:
            safeNumber(
              incoming.active_products ??
                incoming.approved_products
            ),

          rejected_products:
            safeNumber(
              incoming.rejected_products
            ),

          inactive_products:
            safeNumber(
              incoming.inactive_products
            ),
          suspended_products: safeNumber(incoming.suspended_products),
          sold_out_products: safeNumber(incoming.sold_out_products),
          archived_products: safeNumber(incoming.archived_products),
          total_orders: safeNumber(incoming.total_orders),
          listings_over_time: Array.isArray(incoming.listings_over_time) ? incoming.listings_over_time : [],
          orders_over_time: Array.isArray(incoming.orders_over_time) ? incoming.orders_over_time : [],
          complaints_over_time: Array.isArray(incoming.complaints_over_time) ? incoming.complaints_over_time : [],
        });
        setHasLoaded(true);
        setUpdatedAt(new Date());
      } catch (err) {
        console.error(
          "Analytics error:",
          err
        );

        setError(
          err.message ||
            "We couldn't load analytics. Please try again."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [navigate, period]
  );

  /* =======================================================
     INITIAL LOAD

     The API request is deferred until after the effect
     has been scheduled. This avoids the synchronous
     set-state-in-effect lint warning while preserving
     the existing API-loading behavior.
  ======================================================= */

  useEffect(() => {
    const timer = setTimeout(() => {
      loadAnalytics();
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [loadAnalytics]);

  /* =======================================================
     CALCULATIONS
  ======================================================= */

  const calculated = useMemo(() => {
    const totalProducts =
      safeNumber(
        stats.total_products
      );

    const totalUsers =
      safeNumber(
        stats.total_users
      );

    const activeProducts =
      safeNumber(
        stats.active_products
      );

    const pendingProducts =
      safeNumber(
        stats.pending_products
      );

    const rejectedProducts =
      safeNumber(
        stats.rejected_products
      );

    const inactiveProducts =
      safeNumber(
        stats.inactive_products
      );

    const suspendedProducts = safeNumber(stats.suspended_products);
    const soldOutProducts = safeNumber(stats.sold_out_products);
    const archivedProducts = safeNumber(stats.archived_products);

    const reviewedProducts =
      activeProducts +
      rejectedProducts;

    const approvalRate =
      getPercentage(
        activeProducts,
        reviewedProducts
      );

    const pendingRate =
      getPercentage(
        pendingProducts,
        totalProducts
      );

    const rejectedRate =
      getPercentage(
        rejectedProducts,
        totalProducts
      );

    const inactiveRate =
      getPercentage(
        inactiveProducts,
        totalProducts
      );

    const suspendedRate = getPercentage(suspendedProducts, totalProducts);
    const soldOutRate = getPercentage(soldOutProducts, totalProducts);
    const archivedRate = getPercentage(archivedProducts, totalProducts);

    const activeRate =
      getPercentage(
        activeProducts,
        totalProducts
      );

    const studentRate =
      getPercentage(
        stats.total_students,
        totalUsers
      );

    const adminRate =
      getPercentage(
        stats.total_admins,
        totalUsers
      );

    const staffRate = getPercentage(stats.total_staff, totalUsers);

    return {
      totalProducts,
      totalUsers,

      activeProducts,
      pendingProducts,
      rejectedProducts,
      inactiveProducts,
      suspendedProducts,
      soldOutProducts,
      archivedProducts,

      reviewedProducts,

      approvalRate,

      pendingRate,
      rejectedRate,
      inactiveRate,
      suspendedRate,
      soldOutRate,
      archivedRate,
      activeRate,

      studentRate,
      adminRate,
      staffRate,
    };
  }, [stats]);

  const periodLabels = { today: "Today", "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", "6m": "Last 6 months", "12m": "Last 12 months" };
  const periodLabel = periodLabels[period] || "Last 30 days";
  const knownRoleTotal = safeNumber(stats.total_students) + safeNumber(stats.total_admins) + safeNumber(stats.total_staff);
  const roleDistributionRows = [
    { label: "Students", value: safeNumber(stats.total_students), className: "student" },
    { label: "Administrators", value: safeNumber(stats.total_admins), className: "admin" },
    { label: "Staff", value: safeNumber(stats.total_staff), className: "staff" },
    ...(safeNumber(stats.total_users) > knownRoleTotal ? [{ label: "Archived / other", value: safeNumber(stats.total_users) - knownRoleTotal, className: "other" }] : []),
  ];
  let roleStop = 0;
  const roleColors = { student: "var(--tmc-admin-primary)", admin: "var(--tmc-admin-info)", staff: "var(--tmc-admin-success)", other: "var(--tmc-admin-surface-muted)" };
  const roleRingBackground = calculated.totalUsers > 0
    ? `conic-gradient(${roleDistributionRows.map((row) => {
      const start = roleStop;
      roleStop += (row.value / calculated.totalUsers) * 100;
      return `${roleColors[row.className]} ${start}% ${roleStop}%`;
    }).join(", ")})`
    : "var(--tmc-admin-surface-muted)";
  const activitySeriesCount = (stats.listings_over_time || []).reduce((sum, point) => sum + safeNumber(point.listings), 0)
    + (stats.orders_over_time || []).reduce((sum, point) => sum + safeNumber(point.orders), 0)
    + (stats.complaints_over_time || []).reduce((sum, point) => sum + safeNumber(point.complaints), 0);
  const analyticsReportRows = [
    { name: "Product Performance", type: "Products", metric: "Total products", value: calculated.totalProducts, scope: "Current total", route: "/admin/products" },
    { name: "User Distribution", type: "Users", metric: "Registered accounts", value: calculated.totalUsers, scope: "Current total", route: "#analytics-users" },
    { name: "Order Summary", type: "Orders", metric: "All marketplace orders", value: safeNumber(stats.total_orders), scope: "Current total", route: "/admin/transactions" },
    { name: "Marketplace Activity", type: "Analytics", metric: "Listings + orders + complaints", value: activitySeriesCount, scope: periodLabel, route: "#analytics-activity" },
  ];
  const filteredAnalyticsRows = analyticsReportRows.filter((row) => {
    const query = reportSearch.trim().toLowerCase();
    return (!query || `${row.name} ${row.type} ${row.metric}`.toLowerCase().includes(query))
      && (!reportType || row.type === reportType);
  }).sort((left, right) => {
    if (reportSort === "records") return right.value - left.value;
    if (reportSort === "updated") return 0;
    return left.name.localeCompare(right.name);
  });
  const analyticsPageCount = Math.max(1, Math.ceil(filteredAnalyticsRows.length / 5));
  const currentAnalyticsPage = Math.min(reportPage, analyticsPageCount);
  const visibleAnalyticsRows = filteredAnalyticsRows.slice((currentAnalyticsPage - 1) * 5, currentAnalyticsPage * 5);

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <AdminLayout
      title="Analytics"
      subtitle="Analyze users and marketplace activity."
    >
      <div className="analytics-page">

        <AdminPageHero
          title="Marketplace Analytics"
          description="Review current account and product totals alongside activity trends from the selected period."
          icon={BarChart3}
          sideContent={(
            <label className="analytics-period-select">
              <CalendarDays size={16} aria-hidden="true" />
              <span className="analytics-sr-only">Activity period</span>
              <select value={period} onChange={(event) => { setPeriod(event.target.value); setReportPage(1); }} aria-label="Activity period">
                <option value="today">Today</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="6m">Last 6 months</option>
                <option value="12m">Last 12 months</option>
              </select>
            </label>
          )}
          onRefresh={() => loadAnalytics(true)}
          refreshing={loading || refreshing}
        />

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="analytics-error">

            <div className="analytics-error-content">

              <XCircle size={21} />

              <div>
                <strong>
                  Unable to load analytics
                </strong>

                <span>
                  {error}
                </span>
              </div>

            </div>

            <button
              type="button"
              onClick={() =>
                loadAnalytics(true)
              }
            >
              Try Again
            </button>

          </div>
        )}

        {/* =================================================
            LOADING
        ================================================= */}

        {loading ? (
          <div className="analytics-loading-grid">

            {Array.from({
              length: 4,
            }).map((_, index) => (
              <div
                className="analytics-skeleton-card"
                key={index}
              >
                <span />
                <span />
                <span />
              </div>
            ))}

          </div>
        ) : !hasLoaded ? (
          <div className="analytics-empty-state" role="status">
            <BarChart3 size={22} />
            <strong>Analytics are unavailable</strong>
            <span>Load current marketplace data to view this dashboard.</span>
            <button type="button" onClick={() => loadAnalytics(true)}>Try again</button>
          </div>
        ) : (
          <>

            {/* =============================================
                OVERVIEW
            ============================================= */}

            <section className="analytics-section">

              <div className="analytics-section-heading">

                <div>
                  <span>
                    OVERVIEW
                  </span>

                  <h2>
                    Current System Activity
                  </h2>

                  <p>Account and product cards are current totals; the activity trend follows {periodLabel.toLowerCase()}.</p>
                </div>

                <div className="analytics-live-badge">
                  <span />
                  Live Data
                </div>

              </div>

              <div className="analytics-stat-grid">

                <AnalyticsStatCard
                  title="Total Users"
                  value={
                    stats.total_users
                  }
                  description="All registered accounts"
                  icon={Users}
                  type="blue"
                />

                <AnalyticsStatCard
                  title="Students"
                  value={
                    stats.total_students
                  }
                  description="Student accounts"
                  icon={UserCheck}
                  type="purple"
                />

                <AnalyticsStatCard
                  title="Staff"
                  value={stats.total_staff}
                  description="Non-archived staff accounts"
                  icon={UserPlus}
                  type="indigo"
                />

                <AnalyticsStatCard
                  title="Total Products"
                  value={
                    stats.total_products
                  }
                  description="Marketplace products"
                  icon={Package}
                  type="green"
                />

                <AnalyticsStatCard
                  title="Pending Products"
                  value={
                    stats.pending_products
                  }
                  description="Awaiting moderation"
                  icon={Clock3}
                  type="orange"
                />

              </div>

            </section>

            <AnalyticsActivityChart stats={stats} periodLabel={periodLabel} />

            {/* =============================================
                PRODUCT ANALYTICS
            ============================================= */}

            <section className="analytics-panel-grid">

              <article className="analytics-panel" id="analytics-product-status">

                <div className="analytics-panel-header">

                  <div>
                    <span>
                      PRODUCTS
                    </span>

                    <h2>
                      Product Status
                    </h2>
                  </div>

                  <div className="analytics-panel-icon">
                    <Package size={19} />
                  </div>

                </div>

                <div className="analytics-progress-list">

                  <AnalyticsProgressRow
                    label="Active"
                    value={
                      calculated.activeProducts
                    }
                    percentage={
                      calculated.activeRate
                    }
                    type="success"
                    icon={CheckCircle2}
                  />

                  <AnalyticsProgressRow
                    label="Pending"
                    value={
                      calculated.pendingProducts
                    }
                    percentage={
                      calculated.pendingRate
                    }
                    type="warning"
                    icon={Clock3}
                  />

                  <AnalyticsProgressRow
                    label="Rejected"
                    value={
                      calculated.rejectedProducts
                    }
                    percentage={
                      calculated.rejectedRate
                    }
                    type="danger"
                    icon={XCircle}
                  />

                  <AnalyticsProgressRow
                    label="Inactive"
                    value={
                      calculated.inactiveProducts
                    }
                    percentage={
                      calculated.inactiveRate
                    }
                    type="neutral"
                    icon={ShieldCheck}
                  />

                  <AnalyticsProgressRow label="Suspended" value={calculated.suspendedProducts} percentage={calculated.suspendedRate} type="danger" icon={ShieldCheck} />
                  <AnalyticsProgressRow label="Sold out" value={calculated.soldOutProducts} percentage={calculated.soldOutRate} type="neutral" icon={Package} />
                  <AnalyticsProgressRow label="Archived" value={calculated.archivedProducts} percentage={calculated.archivedRate} type="neutral" icon={Package} />

                </div>

              </article>

              {/* ===========================================
                  MODERATION ANALYTICS
              =========================================== */}

              <article className="analytics-panel">

                <div className="analytics-panel-header">

                  <div>
                    <span>
                      MODERATION
                    </span>

                    <h2>
                      Approval Overview
                    </h2>
                  </div>

                  <div className="analytics-panel-icon">
                    <TrendingUp size={19} />
                  </div>

                </div>

                <div className="analytics-approval">

                  {/* DYNAMIC APPROVAL RING */}

                  <div
                    className="analytics-ring"
                    style={{
                      "--approval-progress":
                        `${calculated.approvalRate * 3.6}deg`,
                    }}
                  >

                    <div className="analytics-ring-inner">

                      <strong>
                        {
                          calculated.approvalRate
                        }%
                      </strong>

                      <span>
                        Approval Rate
                      </span>

                    </div>

                  </div>

                  <div className="analytics-approval-details">

                    <div>
                      <span>
                        Reviewed Products
                      </span>

                      <strong>
                        {
                          calculated.reviewedProducts.toLocaleString()
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Active
                      </span>

                      <strong>
                        {
                          calculated.activeProducts.toLocaleString()
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Rejected
                      </span>

                      <strong>
                        {
                          calculated.rejectedProducts.toLocaleString()
                        }
                      </strong>
                    </div>

                  </div>

                </div>

                <div className="analytics-insight">

                  <Activity
                    size={17}
                  />

                  <p>
                    The approval rate is
                    calculated from products
                    that have already been
                    reviewed. Pending products
                    are excluded.
                  </p>

                </div>

              </article>

            </section>

            {/* =============================================
                USER DISTRIBUTION
            ============================================= */}

            <section className="analytics-panel" id="analytics-users">

              <div className="analytics-panel-header">

                <div>
                  <span>
                    USERS
                  </span>

                  <h2>
                    User Distribution
                  </h2>
                </div>

                <div className="analytics-panel-icon">
                  <Users size={19} />
                </div>

              </div>

              <div className="analytics-user-distribution">

                <div className="analytics-user-main">

                  <div
                    className="analytics-user-ring"
                    style={{ background: roleRingBackground }}
                    role="img"
                    aria-label={`User roles: ${stats.total_students} students, ${stats.total_admins} administrators, ${stats.total_staff} staff`}
                  >
                    <div>
                      <strong>{calculated.totalUsers.toLocaleString()}</strong>
                      <span>Total users</span>
                    </div>
                  </div>

                  <div>
                    <h3>User Count by Role</h3>
                    <p>Current account distribution across the marketplace roles.</p>
                  </div>

                </div>

                <div className="analytics-user-bars">
                  {roleDistributionRows.map((row) => {
                    const percentage = getPercentage(row.value, calculated.totalUsers);
                    return <div className="analytics-user-row" key={row.className}>
                      <div><span>{row.label}</span><strong>{row.value.toLocaleString()}</strong></div>
                      <div className="analytics-user-track"><div className={`analytics-user-fill ${row.className}`} style={{ width: `${percentage}%` }} /></div>
                      <small>{percentage}%</small>
                    </div>;
                  })}
                </div>

              </div>

              <div className="analytics-notice">

                <div className="analytics-notice-icon">
                  <Activity size={18} />
                </div>

                <div>

                  <strong>
                    Analytics Data Scope
                  </strong>

                  <p>Account and product figures are current totals. The selected period applies to the marketplace activity chart. Staff totals exclude archived accounts; the role chart includes the unclassified remainder where one exists.</p>

                </div>

              </div>

            </section>

            <section className="analytics-panel analytics-report-details" id="analytics-report-details">
              <div className="analytics-panel-header">
                <div><span>LIVE OVERVIEW</span><h2>Report Details</h2><p>Quick links to the current data behind this dashboard.</p></div>
                <div className="analytics-panel-icon"><FileBarChart size={18} /></div>
              </div>
              <div className="analytics-report-toolbar">
                <label className="analytics-report-search"><Search size={15} /><span className="analytics-sr-only">Search report details</span><input value={reportSearch} onChange={(event) => { setReportSearch(event.target.value); setReportPage(1); }} placeholder="Search reports…" /></label>
                <label><span className="analytics-sr-only">Filter report details by type</span><select value={reportType} onChange={(event) => { setReportType(event.target.value); setReportPage(1); }}><option value="">All types</option><option value="Products">Products</option><option value="Users">Users</option><option value="Orders">Orders</option><option value="Analytics">Analytics</option></select></label>
                <label><span className="analytics-sr-only">Sort report details</span><select value={reportSort} onChange={(event) => setReportSort(event.target.value)}><option value="name">Name A–Z</option><option value="records">Most records</option></select></label>
                <button type="button" onClick={() => { setReportSearch(""); setReportType(""); setReportSort("name"); setReportPage(1); }}>Reset</button>
              </div>
              <div className="analytics-report-table-wrap">
                <table className="analytics-report-table">
                  <thead><tr><th scope="col">Report</th><th scope="col">Metric</th><th scope="col">Current Value</th><th scope="col">Scope</th><th scope="col">Updated</th><th scope="col">Actions</th></tr></thead>
                  <tbody>{visibleAnalyticsRows.map((row) => <tr key={row.name}><td><strong>{row.name}</strong><small>{row.type}</small></td><td>{row.metric}</td><td>{row.value.toLocaleString()}</td><td>{row.scope}</td><td>{updatedAt ? updatedAt.toLocaleString() : "—"}</td><td><Link to={row.route}>View</Link></td></tr>)}</tbody>
                </table>
                {!visibleAnalyticsRows.length && <div className="analytics-report-empty">No report details match those filters.</div>}
              </div>
              <div className="analytics-report-footer"><span>Showing {filteredAnalyticsRows.length ? (currentAnalyticsPage - 1) * 5 + 1 : 0}–{Math.min(currentAnalyticsPage * 5, filteredAnalyticsRows.length)} of {filteredAnalyticsRows.length} reports</span><div><button type="button" onClick={() => setReportPage((page) => Math.max(1, page - 1))} disabled={currentAnalyticsPage <= 1} aria-label="Previous report details page"><ChevronLeft size={16} /></button><span>{currentAnalyticsPage} / {analyticsPageCount}</span><button type="button" onClick={() => setReportPage((page) => Math.min(analyticsPageCount, page + 1))} disabled={currentAnalyticsPage >= analyticsPageCount} aria-label="Next report details page"><ChevronRight size={16} /></button></div></div>
            </section>

          </>
        )}

      </div>
    </AdminLayout>
  );
}

export default AdminAnalytics;
