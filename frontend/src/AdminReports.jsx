import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  Activity,
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  FileBarChart,
  Package,
  Search,
  ShieldCheck,
  Users,
  UserPlus,
} from "lucide-react";

import AdminLayout from "./components/AdminLayout";
import AdminPageHero from "./components/AdminPageHero";
import { API_URL } from "./utils/api";

import "./AdminReports.css";


const DEFAULT_STATS = {
  total_users: 0,
  total_students: 0,
  total_admins: 0,
  total_staff: 0,
  total_products: 0,
  total_orders: 0,
  pending_products: 0,
  approved_products: 0,
  active_products: 0,
  rejected_products: 0,
  inactive_products: 0,
  suspended_products: 0,
  sold_out_products: 0,
  archived_products: 0,
  listings_over_time: [],
  orders_over_time: [],
  complaints_over_time: [],
  students_over_time: [],
};

const PAGE_SIZE = 5;

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatCurrency(value) {
  const amount = Number(value);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function sumSeries(series, key) {
  return Array.isArray(series)
    ? series.reduce((sum, point) => sum + safeNumber(point?.[key]), 0)
    : 0;
}

function getProductStatusRows(stats) {
  return [
    { key: "active", label: "Active", value: safeNumber(stats.active_products), color: "active" },
    { key: "pending", label: "Pending", value: safeNumber(stats.pending_products), color: "pending" },
    { key: "rejected", label: "Rejected", value: safeNumber(stats.rejected_products), color: "rejected" },
    { key: "inactive", label: "Inactive", value: safeNumber(stats.inactive_products), color: "inactive" },
    { key: "suspended", label: "Suspended", value: safeNumber(stats.suspended_products), color: "suspended" },
    { key: "sold_out", label: "Sold out", value: safeNumber(stats.sold_out_products), color: "sold-out" },
    { key: "archived", label: "Archived", value: safeNumber(stats.archived_products), color: "archived" },
  ];
}

function buildCsv(rows) {
  const escapeCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [
    ["Report", "Type", "Description", "Scope", "Records", "Last fetched"],
    ...rows.map((row) => [row.name, row.type, row.description, row.scope, row.records ?? "Unavailable", row.updated]),
  ].map((row) => row.map(escapeCell).join(",")).join("\r\n");
}

function MarketplaceTrendChart({ stats, periodLabel }) {
  const series = [
    { key: "listings", label: "Listings", rows: stats.listings_over_time, className: "listings" },
    { key: "orders", label: "Orders", rows: stats.orders_over_time, className: "orders" },
    { key: "complaints", label: "Complaints", rows: stats.complaints_over_time, className: "complaints" },
  ];
  const labels = series[0].rows || [];
  const maxValue = Math.max(1, ...series.flatMap((item) => (item.rows || []).map((point) => safeNumber(point[item.key]))));
  const xAt = (index) => labels.length > 1 ? index * (700 / (labels.length - 1)) : 350;
  const yAt = (value) => 172 - (safeNumber(value) / maxValue) * 138;
  const tickEvery = Math.max(1, Math.ceil(labels.length / 6));
  const axisLabels = labels.filter((_, index) => index === 0 || index === labels.length - 1 || index % tickEvery === 0);
  const hasActivity = series.some((item) => (item.rows || []).some((point) => safeNumber(point[item.key]) > 0));

  return (
    <article className="reports-panel reports-trend-panel" id="reports-activity-trend">
      <div className="reports-panel-header">
        <div className="reports-panel-icon blue"><Activity size={19} /></div>
        <div><span>MARKETPLACE ACTIVITY</span><h3>Activity Trend</h3><p>Listings, orders, and complaints · {periodLabel}</p></div>
      </div>
      {hasActivity ? (
        <>
          <svg className="reports-trend-chart" viewBox="0 0 700 190" role="img" aria-label={`Marketplace listings, orders, and complaints over ${periodLabel}`}>
            {[34, 80, 126, 172].map((y) => <line key={y} x1="0" y1={y} x2="700" y2={y} className="reports-chart-gridline" />)}
            {series.map((item) => {
              const rows = item.rows || [];
              const points = rows.map((point, index) => `${xAt(index)},${yAt(point[item.key])}`).join(" ");
              return <g key={item.key} className={`reports-trend-series ${item.className}`}><polyline points={points} /><title>{item.label}</title>{rows.map((point, index) => <circle key={`${item.key}-${point.key}`} cx={xAt(index)} cy={yAt(point[item.key])} r="3.5"><title>{point.label}: {safeNumber(point[item.key])} {item.label.toLowerCase()}</title></circle>)}</g>;
            })}
          </svg>
          <div className="reports-trend-axis">{axisLabels.map((point) => <span key={point.key}>{point.label}</span>)}</div>
        </>
      ) : <div className="reports-chart-empty">No listing, order, or complaint activity was recorded during this period.</div>}
      <div className="reports-chart-legend" aria-label="Chart legend">{series.map((item) => <span key={item.key} className={item.className}><i />{item.label}</span>)}</div>
      <p className="reports-chart-note">Role-by-role registration history is not returned by the current admin statistics API.</p>
    </article>
  );
}

function ReportsSkeleton() {
  return (
    <div className="reports-stats-grid">
      {[1, 2, 3, 4, 5].map((item) => (
        <div
          className="reports-stat-card reports-skeleton-card"
          key={item}
        >
          <div className="reports-skeleton-icon" />

          <div className="reports-skeleton-content">
            <div className="reports-skeleton-line reports-skeleton-small" />

            <div className="reports-skeleton-line reports-skeleton-number" />

            <div className="reports-skeleton-line reports-skeleton-text" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ReportStatCard({
  icon: Icon,
  label,
  value,
  description,
  type = "blue",
}) {
  return (
    <article className={`reports-stat-card ${type}`}>
      <div className="reports-stat-icon">
        <Icon
          size={22}
          strokeWidth={2.2}
        />
      </div>

      <div className="reports-stat-content">
        <span className="reports-stat-label">
          {label}
        </span>

        <strong className="reports-stat-value">
          {Number(value).toLocaleString()}
        </strong>

        <small className="reports-stat-description">
          {description}
        </small>
      </div>
    </article>
  );
}

function ProgressRow({
  label,
  value,
  total,
  type = "blue",
}) {
  const safeValue = Number(value) || 0;
  const safeTotal = Number(total) || 0;

  const percentage =
    safeTotal > 0
      ? Math.round(
          (safeValue / safeTotal) * 100
        )
      : 0;

  return (
    <div className="reports-progress-row">
      <div className="reports-progress-heading">
        <span className="reports-progress-label">
          {label}
        </span>

        <strong>
          {safeValue.toLocaleString()}
        </strong>
      </div>

      <div
        className="reports-progress-track"
        aria-label={`${label}: ${percentage}%`}
      >
        <div
          className={`reports-progress-fill ${type}`}
          style={{
            width: `${Math.min(
              percentage,
              100
            )}%`,
          }}
        />
      </div>

      <div className="reports-progress-footer">
        <span>
          {percentage}% of total products
        </span>
      </div>
    </div>
  );
}

export default function AdminReports() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("30d");

  const [stats, setStats] = useState(
    DEFAULT_STATS
  );

  const [commissionSummary, setCommissionSummary] = useState(null);
  const [commissionError, setCommissionError] = useState("");
  const [fetchedAt, setFetchedAt] = useState(null);
  const [reportSearch, setReportSearch] = useState("");
  const [reportType, setReportType] = useState("");
  const [reportSort, setReportSort] = useState("updated");
  const [reportPage, setReportPage] = useState(1);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] = useState("");
  const reportsRequestSequenceRef = useRef(0);

  const loadReports = useCallback(
    async (showRefresh = false, signal) => {
      const requestSequence = ++reportsRequestSequenceRef.current;
      try {
        if (showRefresh) {
          if (!signal) setRefreshing(true);
        } else {
          setLoading(true);
          setFetchedAt(null);
        }

        setError("");

        const token =
          localStorage.getItem("token");

        if (!token) {
          navigate("/login", {
            replace: true,
          });

          return;
        }

        const headers = {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        };
        const [statsResult, commissionResult] = await Promise.allSettled([
          fetch(`${API_URL}/admin/stats?period=${encodeURIComponent(period)}`, { method: "GET", headers, ...(signal ? { signal } : {}) }),
          fetch(`${API_URL}/admin/commission`, { method: "GET", headers, ...(signal ? { signal } : {}) }),
        ]);
        if (signal?.aborted || requestSequence !== reportsRequestSequenceRef.current) return;
        if (statsResult.status === "rejected") throw statsResult.reason;
        const response = statsResult.value;
        const commissionResponse = commissionResult.status === "fulfilled" ? commissionResult.value : null;

        if (
          [response.status, commissionResponse?.status].some((status) => status === 401 || status === 403)
        ) {
          localStorage.removeItem("token");
          localStorage.removeItem("role");
          localStorage.removeItem("user");

          navigate("/login", {
            replace: true,
          });

          return;
        }

        const data = await response.json().catch(() => ({}));
        if (signal?.aborted || requestSequence !== reportsRequestSequenceRef.current) return;

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Unable to load reports."
          );
        }

        const incoming =
          data.stats || data;

        setStats({
          ...DEFAULT_STATS,
          ...incoming,
          total_users:
            Number(
              incoming.total_users
            ) || 0,

          total_students:
            Number(
              incoming.total_students
            ) || 0,

          total_admins:
            Number(
              incoming.total_admins
            ) || 0,
          total_staff: Number(incoming.total_staff) || 0,

          total_products:
            Number(
              incoming.total_products
            ) || 0,

          pending_products:
            Number(
              incoming.pending_products
            ) || 0,

          approved_products:
            Number(
              incoming.approved_products ??
                incoming.active_products ??
                0
            ) || 0,

          active_products:
            Number(
              incoming.active_products ??
                incoming.approved_products ??
                0
            ) || 0,

          rejected_products:
            Number(
              incoming.rejected_products
            ) || 0,

          inactive_products:
            Number(
              incoming.inactive_products
            ) || 0,
          suspended_products: safeNumber(incoming.suspended_products),
          sold_out_products: safeNumber(incoming.sold_out_products),
          archived_products: safeNumber(incoming.archived_products),
          total_orders: safeNumber(incoming.total_orders),
          listings_over_time: Array.isArray(incoming.listings_over_time) ? incoming.listings_over_time : [],
          orders_over_time: Array.isArray(incoming.orders_over_time) ? incoming.orders_over_time : [],
          complaints_over_time: Array.isArray(incoming.complaints_over_time) ? incoming.complaints_over_time : [],
          students_over_time: Array.isArray(incoming.students_over_time) ? incoming.students_over_time : [],
        });
        if (commissionResponse) {
          const commissionData = await commissionResponse.json().catch(() => ({}));
          if (signal?.aborted || requestSequence !== reportsRequestSequenceRef.current) return;
          if (commissionResponse.ok) {
            setCommissionSummary(commissionData.summary || null);
            setCommissionError("");
          } else {
            setCommissionSummary(null);
            setCommissionError(commissionData.message || "Commission report data is currently unavailable.");
          }
        } else {
          setCommissionSummary(null);
          setCommissionError(commissionResult.reason?.message || "Commission report data is currently unavailable.");
        }
        setFetchedAt(new Date());
      } catch (err) {
        if (signal?.aborted || err?.name === "AbortError" || requestSequence !== reportsRequestSequenceRef.current) return;
        console.error(
          "Reports error:",
          err
        );

        setError(
          "We couldn't load the reports. Please try again."
        );
      } finally {
        if (!signal?.aborted && requestSequence === reportsRequestSequenceRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [navigate, period]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadReports();
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [loadReports]);

  const productReviewedCount = useMemo(() => {
    return (
      stats.active_products +
      stats.rejected_products
    );
  }, [
    stats.active_products,
    stats.rejected_products,
  ]);

  const approvalRate = useMemo(() => {
    if (productReviewedCount <= 0) {
      return 0;
    }

    return Math.round(
      (stats.active_products /
        productReviewedCount) *
        100
    );
  }, [
    productReviewedCount,
    stats.active_products,
  ]);

  const studentPercentage = useMemo(() => {
    if (stats.total_users <= 0) {
      return 0;
    }

    return Math.round(
      (stats.total_students /
        stats.total_users) *
        100
    );
  }, [
    stats.total_students,
    stats.total_users,
  ]);

  const periodLabels = { today: "Today", "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days", "6m": "Last 6 months", "12m": "Last 12 months" };
  const periodLabel = periodLabels[period] || "Last 30 days";
  const productStatusRows = useMemo(() => getProductStatusRows(stats), [stats]);
  const totalProducts = safeNumber(stats.total_products);
  const productStatusColors = {
    active: "var(--tmc-admin-success)",
    pending: "var(--tmc-admin-warning)",
    rejected: "var(--tmc-admin-danger)",
    inactive: "var(--tmc-admin-info)",
    suspended: "var(--tmc-admin-primary)",
    "sold-out": "var(--tmc-admin-primary-hover)",
    archived: "var(--tmc-admin-secondary)",
  };
  let statusStop = 0;
  const statusRing = totalProducts > 0
    ? `conic-gradient(${productStatusRows.map((row) => {
      const start = statusStop;
      statusStop += (row.value / totalProducts) * 100;
      return `${productStatusColors[row.color]} ${start}% ${statusStop}%`;
    }).join(", ")})`
    : "var(--tmc-admin-surface-muted)";
  const userGroups = [
    { key: "students", label: "Students", value: safeNumber(stats.total_students) },
    { key: "administrators", label: "Administrators", value: safeNumber(stats.total_admins) },
    { key: "staff", label: "Staff", value: safeNumber(stats.total_staff) },
  ];
  const classifiedUsers = userGroups.reduce((sum, group) => sum + group.value, 0);
  const userTotal = safeNumber(stats.total_users);
  const userDistributionRows = [
    ...userGroups,
    ...(userTotal > classifiedUsers
      ? [{ key: "other", label: "Other / archived", value: userTotal - classifiedUsers }]
      : []),
  ];
  const userDistributionTotal = Math.max(userTotal, classifiedUsers);
  const userGroupColors = {
    students: "var(--tmc-admin-primary)",
    administrators: "var(--tmc-admin-info)",
    staff: "var(--tmc-admin-success)",
    other: "var(--tmc-admin-secondary)",
  };
  let userStop = 0;
  const userRing = userDistributionTotal > 0
    ? `conic-gradient(${userDistributionRows.map((row) => {
      const start = userStop;
      userStop += (row.value / userDistributionTotal) * 100;
      return `${userGroupColors[row.key]} ${start}% ${userStop}%`;
    }).join(", ")})`
    : "var(--tmc-admin-surface-muted)";
  const largestUserGroup = [...userGroups].sort((a, b) => b.value - a.value)[0];
  const largestUserShare = stats.total_users > 0 ? Math.round((largestUserGroup.value / stats.total_users) * 100) : 0;
  const mostCommonProductStatus = [...productStatusRows].sort((a, b) => b.value - a.value)[0];
  const periodActivityCount = sumSeries(stats.listings_over_time, "listings")
    + sumSeries(stats.orders_over_time, "orders")
    + sumSeries(stats.complaints_over_time, "complaints");
  const reportRows = useMemo(() => {
    const updated = fetchedAt ? fetchedAt.toLocaleString() : "—";
    return [
      { id: "users", name: "User Account Report", type: "Users", description: "Current registered accounts by marketplace role.", scope: "Current totals", records: safeNumber(stats.total_users), route: "/admin/reports#reports-user-distribution" },
      { id: "products", name: "Product Performance Report", type: "Products", description: "Current listing totals and product status breakdown.", scope: "Current totals", records: safeNumber(stats.total_products), route: "/admin/reports#reports-product-status" },
      { id: "orders", name: "Order Summary Report", type: "Orders", description: "Order status totals and selected-period order activity.", scope: "Current totals", records: safeNumber(stats.total_orders), route: "/admin/transactions" },
      { id: "commission", name: "Commission Report", type: "Finance", description: commissionSummary ? `Earned ${formatCurrency(commissionSummary.total_earned)} · collected ${formatCurrency(commissionSummary.total_collected)}.` : "Commission ledger summary is unavailable.", scope: commissionSummary ? "All-time totals" : "Unavailable", records: commissionSummary ? safeNumber(commissionSummary.completed_orders) : null, route: "/admin/commission" },
      { id: "activity", name: "Marketplace Activity Report", type: "Analytics", description: "Combined listing, order, and complaint events in the selected period.", scope: periodLabel, records: periodActivityCount, route: "/admin/reports#reports-activity-trend" },
    ].map((row) => ({ ...row, updated }));
  }, [commissionSummary, fetchedAt, periodActivityCount, periodLabel, stats.total_orders, stats.total_products, stats.total_users]);
  const filteredReports = useMemo(() => {
    const query = reportSearch.trim().toLowerCase();
    const rows = reportRows.filter((row) => {
      const matchesText = !query || `${row.name} ${row.type} ${row.description}`.toLowerCase().includes(query);
      return matchesText && (!reportType || row.type === reportType);
    });
    if (reportSort === "name") return [...rows].sort((a, b) => a.name.localeCompare(b.name));
    if (reportSort === "records") return [...rows].sort((a, b) => (b.records ?? -1) - (a.records ?? -1));
    return rows;
  }, [reportRows, reportSearch, reportSort, reportType]);
  const reportPageCount = Math.max(1, Math.ceil(filteredReports.length / PAGE_SIZE));
  const currentReportPage = Math.min(reportPage, reportPageCount);
  const visibleReports = filteredReports.slice((currentReportPage - 1) * PAGE_SIZE, currentReportPage * PAGE_SIZE);
  const handleExport = () => {
    const blob = new Blob(["\uFEFF", buildCsv(filteredReports)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `studentmart-reports-${period}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <AdminLayout
      title="Reports & Analytics"
      subtitle="Review marketplace reports, trends, and current operational metrics."
    >
      <div className="reports-page">

        <AdminPageHero
          title="Marketplace Reports & Analytics"
          description="Explore marketplace trends, account and product insights, and exportable reports in one place."
          icon={FileBarChart}
          sideContent={(
            <label className="reports-period-select">
              <CalendarDays size={16} aria-hidden="true" />
              <span className="reports-sr-only">Activity period</span>
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
          onRefresh={(signal) => loadReports(true, signal)}
          autoRefreshIntervalMs={120_000}
          autoRefreshKey={period}
          refreshing={loading || refreshing}
        />


        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="reports-error">

            <div className="reports-error-icon">
              <AlertCircle size={19} />
            </div>

            <div className="reports-error-content">

              <strong>
                Unable to load reports
              </strong>

              <p>
                {error}
              </p>

            </div>

            <button
              type="button"
              onClick={() =>
                loadReports(true)
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
          <ReportsSkeleton />
        ) : !fetchedAt ? (
          <div className="reports-empty-state" role="status">
            <AlertCircle size={22} />
            <strong>Reports are unavailable</strong>
            <span>Load current marketplace data to view this dashboard.</span>
            <button type="button" onClick={() => loadReports(true)}>Try again</button>
          </div>
        ) : (
          <>

            {/* =============================================
                OVERVIEW
            ============================================= */}

            <section className="reports-section">

              <div className="reports-section-heading">

                <div>

                  <span>
                    SYSTEM OVERVIEW
                  </span>

                  <h3>
                    Current Statistics
                  </h3>

                  <p>
                    Live figures returned by
                    the administrator statistics
                    endpoint.
                  </p>

                </div>

              </div>

              <div className="reports-stats-grid">
                <ReportStatCard
                  icon={Users}
                  label="Total Users"
                  value={stats.total_users}
                  description="All registered accounts"
                  type="blue"
                />
                <ReportStatCard
                  icon={Users}
                  label="Students"
                  value={stats.total_students}
                  description="Student accounts"
                  type="purple"
                />
                <ReportStatCard
                  icon={UserPlus}
                  label="Staff"
                  value={stats.total_staff}
                  description="Non-archived staff accounts"
                  type="purple"
                />
                <ReportStatCard
                  icon={ShieldCheck}
                  label="Administrators"
                  value={stats.total_admins}
                  description="Admin accounts"
                  type="indigo"
                />
                <ReportStatCard
                  icon={Package}
                  label="Total Products"
                  value={stats.total_products}
                  description="All marketplace listings"
                  type="green"
                />
              </div>

            </section>

            <section className="reports-dashboard-grid" aria-label="Marketplace activity and quick insights">
              <MarketplaceTrendChart stats={stats} periodLabel={periodLabel} />

              <article className="reports-panel reports-status-panel" id="reports-product-status">
                <div className="reports-panel-header">
                  <div className="reports-panel-icon green"><Package size={19} /></div>
                  <div><span>PRODUCTS</span><h3>Product Status</h3><p>Current status of all marketplace listings</p></div>
                </div>
                <div className="reports-status-content">
                  <div className="reports-status-ring" style={{ background: statusRing }} role="img" aria-label={`Product status distribution across ${totalProducts} products`}>
                    <div><strong>{totalProducts.toLocaleString()}</strong><span>Total products</span></div>
                  </div>
                  <div className="reports-status-legend">
                    {productStatusRows.map((row) => {
                      const percentage = totalProducts ? Math.round((row.value / totalProducts) * 100) : 0;
                      return <div key={row.key} className={row.color}><i /><span>{row.label}</span><strong>{row.value.toLocaleString()}</strong><small>{percentage}%</small></div>;
                    })}
                  </div>
                </div>
                <p className="reports-panel-note">All seven listing states from the admin statistics response are included.</p>
              </article>

              <article className="reports-panel reports-insights-panel">
                <div className="reports-panel-header">
                  <div className="reports-panel-icon blue"><Activity size={19} /></div>
                  <div><span>LIVE DATA</span><h3>Quick Insights</h3></div>
                </div>
                <div className="reports-insight-row"><span className="reports-insight-icon users"><Users size={17} /></span><div><small>Largest user group</small><strong>{stats.total_users ? `${largestUserGroup.label} (${largestUserShare}%)` : "No accounts yet"}</strong></div></div>
                <div className="reports-insight-row"><span className="reports-insight-icon products"><Package size={17} /></span><div><small>Most common product status</small><strong>{totalProducts ? `${mostCommonProductStatus.label} (${mostCommonProductStatus.value})` : "No products yet"}</strong></div></div>
                <div className="reports-insight-row"><span className="reports-insight-icon orders"><Activity size={17} /></span><div><small>Activity events · {periodLabel}</small><strong>{periodActivityCount.toLocaleString()}</strong></div></div>
                <p className="reports-panel-note">Insights are calculated from current account/product totals and the selected-period API series.</p>
              </article>
            </section>

            <section className="reports-secondary-grid" aria-label="Approval and user analytics">
              <article className="reports-panel reports-approval-panel" id="reports-approval-overview">
                <div className="reports-panel-header">
                  <div className="reports-panel-icon green"><Activity size={19} /></div>
                  <div><span>MODERATION</span><h3>Approval Overview</h3><p>Reviewed listings · pending listings are excluded</p></div>
                </div>
                <div className="reports-approval-content">
                  <div className="reports-approval-ring" style={{ "--approval-progress": `${approvalRate * 3.6}deg` }} role="img" aria-label={`Approval rate: ${approvalRate}% of ${productReviewedCount} reviewed products`}>
                    <div><strong>{approvalRate}%</strong><span>Approval rate</span></div>
                  </div>
                  <div className="reports-approval-details">
                    <div><span>Reviewed products</span><strong>{productReviewedCount.toLocaleString()}</strong></div>
                    <div><span>Active</span><strong>{safeNumber(stats.active_products).toLocaleString()}</strong></div>
                    <div><span>Rejected</span><strong>{safeNumber(stats.rejected_products).toLocaleString()}</strong></div>
                  </div>
                </div>
                <p className="reports-panel-note">Approval rate is calculated from active and rejected listings only.</p>
              </article>

              <article className="reports-panel reports-user-distribution-panel" id="reports-user-distribution">
                <div className="reports-panel-header">
                  <div className="reports-panel-icon blue"><Users size={19} /></div>
                  <div><span>ACCOUNTS</span><h3>User Distribution</h3><p>Current registered accounts by role</p></div>
                </div>
                <div className="reports-user-distribution-content">
                  <div className="reports-role-ring" style={{ background: userRing }} role="img" aria-label={`User distribution across ${userTotal} total accounts`}>
                    <div><strong>{userTotal.toLocaleString()}</strong><span>Total users</span></div>
                  </div>
                  <div className="reports-role-bars">
                    {userDistributionRows.map((row) => {
                      const percentage = userDistributionTotal > 0 ? Math.round((row.value / userDistributionTotal) * 100) : 0;
                      return <div className="reports-role-row" key={row.key}>
                        <div><span>{row.label}</span><strong>{row.value.toLocaleString()}</strong></div>
                        <div className="reports-role-track" aria-hidden="true"><span className={row.key} style={{ width: `${percentage}%` }} /></div>
                        <small>{percentage}%</small>
                      </div>;
                    })}
                  </div>
                </div>
                <p className="reports-panel-note">Staff totals exclude archived accounts; the remaining count is grouped as other or archived when present.</p>
              </article>
            </section>


            {/* =============================================
                PRODUCT + USER REPORT
            ============================================= */}

            <section className="reports-two-column">

              {/* PRODUCT REPORT */}

              <div className="reports-panel">

                <div className="reports-panel-header">

                  <div className="reports-panel-icon green">
                    <Package size={20} />
                  </div>

                  <div>

                    <span>
                      PRODUCT REPORT
                    </span>

                    <h3>
                      Product Status
                    </h3>

                  </div>

                </div>


                <div className="reports-product-summary">

                  <div>

                    <strong>
                      {stats.total_products.toLocaleString()}
                    </strong>

                    <span>
                      Total products
                    </span>

                  </div>

                  <div>

                    <strong>
                      {productReviewedCount.toLocaleString()}
                    </strong>

                    <span>
                      Reviewed products
                    </span>

                  </div>

                  <div>

                    <strong>
                      {approvalRate}%
                    </strong>

                    <span>
                      Approval rate
                    </span>

                  </div>

                </div>


                <div className="reports-progress-list">

                  <ProgressRow
                    label="Active Products"
                    value={
                      stats.active_products
                    }
                    total={
                      stats.total_products
                    }
                    type="green"
                  />

                  <ProgressRow
                    label="Pending Products"
                    value={
                      stats.pending_products
                    }
                    total={
                      stats.total_products
                    }
                    type="yellow"
                  />

                  <ProgressRow
                    label="Rejected Products"
                    value={
                      stats.rejected_products
                    }
                    total={
                      stats.total_products
                    }
                    type="red"
                  />

                  <ProgressRow
                    label="Inactive Products"
                    value={
                      stats.inactive_products
                    }
                    total={
                      stats.total_products
                    }
                    type="gray"
                  />

                </div>

              </div>


              {/* USER REPORT */}

              <div className="reports-panel">

                <div className="reports-panel-header">

                  <div className="reports-panel-icon blue">
                    <Users size={20} />
                  </div>

                  <div>

                    <span>
                      USER REPORT
                    </span>

                    <h3>
                      Account Overview
                    </h3>

                  </div>

                </div>


                <div className="reports-user-main">

                  <div className="reports-user-total">

                    <span>
                      Registered Users
                    </span>

                    <strong>
                      {stats.total_users.toLocaleString()}
                    </strong>

                  </div>


                  <div className="reports-user-ring">

                    <div
                      className="reports-ring"
                      style={{
                        background: `conic-gradient(
                          var(--tmc-ui-blue) ${studentPercentage}%,
                          var(--tmc-admin-bg-muted) ${studentPercentage}% 100%
                        )`,
                      }}
                    >

                      <div className="reports-ring-inner">

                        <strong>
                          {studentPercentage}%
                        </strong>

                        <span>
                          Students
                        </span>

                      </div>

                    </div>

                  </div>

                </div>


                <div className="reports-user-breakdown">

                  <div className="reports-breakdown-item">

                    <div className="reports-breakdown-dot blue" />

                    <div>

                      <span>
                        Students
                      </span>

                      <strong>
                        {stats.total_students.toLocaleString()}
                      </strong>

                    </div>

                  </div>


                  <div className="reports-breakdown-item">

                    <div className="reports-breakdown-dot purple" />

                    <div>

                      <span>
                        Administrators
                      </span>

                      <strong>
                        {stats.total_admins.toLocaleString()}
                      </strong>

                    </div>

                  </div>

                </div>

              </div>

            </section>


            <section className="reports-panel reports-available-panel" aria-labelledby="reports-list-title">
              <div className="reports-available-heading">
                <div><h3 id="reports-list-title">Available Reports</h3><p>Open a detailed view or export the currently filtered report catalog.</p></div>
                <div className="reports-available-toolbar">
                  <label className="reports-search-control"><Search size={15} /><span className="reports-sr-only">Search reports</span><input value={reportSearch} onChange={(event) => { setReportSearch(event.target.value); setReportPage(1); }} placeholder="Search reports…" /></label>
                  <label><span className="reports-sr-only">Filter reports by type</span><select value={reportType} onChange={(event) => { setReportType(event.target.value); setReportPage(1); }}><option value="">All report types</option><option value="Users">Users</option><option value="Products">Products</option><option value="Orders">Orders</option><option value="Finance">Finance</option><option value="Analytics">Analytics</option></select></label>
                  <label><span className="reports-sr-only">Sort reports</span><select value={reportSort} onChange={(event) => setReportSort(event.target.value)}><option value="updated">Default order</option><option value="name">Name A–Z</option><option value="records">Most records</option></select></label>
                  <button type="button" className="reports-export-button" onClick={handleExport} disabled={!filteredReports.length}><Download size={15} />Export CSV</button>
                  <button type="button" className="reports-reset-button" onClick={() => { setReportSearch(""); setReportType(""); setReportSort("updated"); setReportPage(1); }}>Reset</button>
                </div>
              </div>

              {commissionError && <div className="reports-commission-note" role="status"><AlertCircle size={15} />Commission report details are unavailable: {commissionError}</div>}

              <div className="reports-table-wrap">
                <table className="reports-table">
                  <thead><tr><th scope="col">Report Name</th><th scope="col">Type</th><th scope="col">Description</th><th scope="col">Data Scope</th><th scope="col">Records</th><th scope="col">Updated</th><th scope="col">Actions</th></tr></thead>
                  <tbody>
                    {visibleReports.map((report) => <tr key={report.id}>
                      <td><strong>{report.name}</strong></td>
                      <td><span className={`reports-type-badge ${report.type.toLowerCase()}`}>{report.type}</span></td>
                      <td>{report.description}</td>
                      <td>{report.scope}</td>
                      <td>{report.records == null ? "—" : report.records.toLocaleString()}</td>
                      <td>{report.updated}</td>
                      <td><Link to={report.route} className="reports-view-link">View</Link></td>
                    </tr>)}
                  </tbody>
                </table>
                {!visibleReports.length && <div className="reports-table-empty">No reports match those filters.</div>}
              </div>

              <div className="reports-table-footer"><span>Showing {filteredReports.length ? (currentReportPage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(currentReportPage * PAGE_SIZE, filteredReports.length)} of {filteredReports.length} reports{fetchedAt ? ` · data fetched ${fetchedAt.toLocaleString()}` : ""}</span><div><button type="button" onClick={() => setReportPage((page) => Math.max(1, page - 1))} disabled={currentReportPage <= 1} aria-label="Previous reports page"><ChevronLeft size={16} /></button><span>{currentReportPage} / {reportPageCount}</span><button type="button" onClick={() => setReportPage((page) => Math.min(reportPageCount, page + 1))} disabled={currentReportPage >= reportPageCount} aria-label="Next reports page"><ChevronRight size={16} /></button></div></div>
            </section>


            {/* =============================================
                DATA LIMITATION NOTE
            ============================================= */}

            <section className="reports-note">

              <div className="reports-note-icon">
                <AlertCircle size={19} />
              </div>

              <div>

                <strong>Data coverage</strong>

                <p>
                  Account and product cards show current totals. The activity chart uses real listings, order, and complaint series for the selected period; the API does not return role-by-role registration history. Commission totals come from the existing commission ledger. No payment collection or revenue is inferred from order totals.
                </p>

              </div>

            </section>

          </>
        )}

      </div>
    </AdminLayout>
  );
}
