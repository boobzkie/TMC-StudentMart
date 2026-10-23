import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  ChartColumn,
  ChartPie,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CreditCard,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Package,
  Receipt,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  TrendingUp,
  TriangleAlert,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import AdminLayout from "./components/AdminLayout";
import AdminPageHero from "./components/AdminPageHero";
import { API_URL, sortRows } from "./utils/api";
import { Badge, Button, EmptyState, StatCard, Table } from "./ui";
import "./AdminDashboard.css";

const COUNT_FORMATTER = new Intl.NumberFormat();
const MONEY_FORMATTER = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const RANGE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 3 months" },
  { value: "6m", label: "Last 6 months" },
  { value: "12m", label: "Last 12 months" },
];

const TONE_COLORS = {
  primary: "var(--dash-color-primary)",
  success: "var(--dash-color-success)",
  warning: "var(--dash-color-warning)",
  danger: "var(--dash-color-danger)",
  info: "var(--dash-color-info)",
  accent: "var(--dash-color-accent)",
  navy: "var(--dash-color-navy)",
  teal: "var(--dash-color-teal)",
  sky: "var(--dash-color-sky)",
  slate: "var(--dash-color-slate)",
  neutral: "var(--dash-color-neutral)",
};

const STATUS_META = {
  active: { label: "Active", variant: "success" },
  approved: { label: "Approved", variant: "success" },
  pending: { label: "Pending", variant: "warning" },
  confirmed: { label: "Confirmed", variant: "info" },
  ready_for_pickup: { label: "Ready for pickup", variant: "info" },
  completed: { label: "Completed", variant: "success" },
  declined: { label: "Declined", variant: "danger" },
  cancelled: { label: "Cancelled", variant: "neutral" },
  paid: { label: "Paid", variant: "success" },
  unpaid: { label: "Unpaid", variant: "warning" },
  rejected: { label: "Rejected", variant: "danger" },
  suspended: { label: "Suspended", variant: "danger" },
  sold_out: { label: "Sold out", variant: "info" },
  inactive: { label: "Inactive", variant: "neutral" },
  archived: { label: "Archived", variant: "neutral" },
  in_review: { label: "In review", variant: "warning" },
  resolved: { label: "Resolved", variant: "success" },
};

const ORDER_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "ready_for_pickup", label: "Ready for pickup" },
  { value: "completed", label: "Completed" },
  { value: "declined", label: "Declined" },
  { value: "cancelled", label: "Cancelled" },
];

const USER_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "suspended", label: "Suspended" },
  { value: "archived", label: "Archived" },
];

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatCount(value) {
  if (value === null || value === undefined || value === "") return "—";
  return COUNT_FORMATTER.format(toNumber(value));
}

function formatMoney(value) {
  return MONEY_FORMATTER.format(toNumber(value));
}

function formatPercent(value) {
  const number = toNumber(value);
  return `${number >= 10 || number === 0 ? Math.round(number) : number.toFixed(1)}%`;
}

function formatCompact(value) {
  const number = toNumber(value);
  const absolute = Math.abs(number);
  if (absolute >= 1000000) {
    return `${(number / 1000000).toFixed(absolute % 1000000 === 0 ? 0 : 1)}M`;
  }
  if (absolute >= 1000) {
    return `${(number / 1000).toFixed(absolute % 1000 === 0 ? 0 : 1)}k`;
  }
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function formatDateTime(value) {
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

function formatShortDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function getStatusMeta(status) {
  const key = String(status || "").toLowerCase();
  return STATUS_META[key] || {
    label: key ? key.replace(/_/g, " ") : "—",
    variant: "neutral",
  };
}

function StatusBadge({ status }) {
  const meta = getStatusMeta(status);
  return <Badge variant={meta.variant} size="sm">{meta.label}</Badge>;
}

function roleLabel(role) {
  const key = String(role || "").toLowerCase();
  return {
    student: "Student",
    staff: "Staff",
    admin: "Administrator",
    seller: "Seller",
  }[key] || (key ? key.replace(/_/g, " ") : "—");
}

function activityTypeLabel(type) {
  const key = String(type || "").toLowerCase();
  return {
    user: "Account",
    product: "Listing",
    order: "Order",
    moderation: "Moderation",
    complaint: "Complaint",
  }[key] || "Activity";
}

function getScale(maxValue, isCurrency) {
  const safe = Math.max(toNumber(maxValue), isCurrency ? 1 : 4);
  const rough = safe / 4;
  const power = Math.pow(10, Math.floor(Math.log10(rough)));
  const normalized = rough / power;
  const base = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  let step = base * power;
  if (!isCurrency) step = Math.max(1, Math.round(step));
  const max = Math.ceil(safe / step) * step;
  const ticks = [];
  for (let value = 0; value <= max + step / 1000; value += step) {
    ticks.push(Number(value.toFixed(6)));
  }
  return { max, step, ticks };
}

function getLabelIndexes(length) {
  if (length <= 1) return [0];
  const count = Math.min(length, 5);
  const indexes = [];
  for (let index = 0; index < count; index += 1) {
    indexes.push(Math.round((index * (length - 1)) / (count - 1)));
  }
  return [...new Set(indexes)];
}

function DonutChart({ items, total, centerValue, centerLabel, ariaLabel, emptyMessage = "No data recorded yet." }) {
  const positiveItems = items.filter((item) => toNumber(item.value) > 0);
  const sum = total !== undefined && total !== null ? toNumber(total) : positiveItems.reduce((accumulator, item) => accumulator + toNumber(item.value), 0);

  if (!sum || positiveItems.length === 0) {
    return <div className="dash-chart-empty" role="status">{emptyMessage}</div>;
  }

  const { stops, offset } = positiveItems.reduce((accumulator, item) => {
    const start = accumulator.offset;
    const next = Math.min(100, accumulator.offset + (toNumber(item.value) / sum) * 100);
    return {
      offset: next,
      stops: [
        ...accumulator.stops,
        `${TONE_COLORS[item.tone] || TONE_COLORS.neutral} ${start.toFixed(3)}% ${next.toFixed(3)}%`,
      ],
    };
  }, { offset: 0, stops: [] });
  if (offset < 100) stops.push(`var(--tmc-admin-bg-muted) ${offset.toFixed(3)}% 100%`);

  return (
    <div className="dash-donut-layout" role="img" aria-label={ariaLabel}>
      <div className="dash-donut" style={{ background: `conic-gradient(${stops.join(", ")})` }} aria-hidden="true">
        <span className="dash-donut-center">
          <strong>{centerValue !== undefined ? centerValue : formatCount(sum)}</strong>
          <small>{centerLabel}</small>
        </span>
      </div>
      <ul className="dash-legend">
        {items.map((item) => {
          const value = toNumber(item.value);
          return (
            <li key={item.label}>
              <span className={`dash-swatch dash-swatch--${item.tone || "neutral"}`} aria-hidden="true" />
              <span className="dash-legend-label">{item.label}</span>
              <strong className="dash-legend-value">{formatCount(value)}</strong>
              <span className="dash-legend-percent">{formatPercent(sum ? (value / sum) * 100 : 0)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TrendChart({
  data,
  valueKey,
  title,
  unitLabel = "value",
  formatValue = formatCount,
  emptyMessage = "No activity recorded for this period.",
  tone = "primary",
}) {
  const points = Array.isArray(data) ? data : [];
  const values = points.map((item) => toNumber(item[valueKey]));
  const maxValue = Math.max(0, ...values);

  if (points.length === 0 || maxValue <= 0) {
    return <div className="dash-chart-empty" role="status">{emptyMessage}</div>;
  }

  const isCurrency = unitLabel === "sales";
  const scale = getScale(maxValue, isCurrency);
  const width = 720;
  const height = 200;
  const pad = { top: 16, right: 18, bottom: 30, left: 8 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const stepX = points.length > 1 ? plotWidth / (points.length - 1) : 0;
  const coordinates = points.map((item, index) => ({
    ...item,
    x: points.length > 1 ? pad.left + index * stepX : pad.left + plotWidth / 2,
    y: pad.top + plotHeight - (toNumber(item[valueKey]) / scale.max) * plotHeight,
  }));
  const line = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const area = `${line} L ${coordinates[coordinates.length - 1].x.toFixed(2)} ${(pad.top + plotHeight).toFixed(2)} L ${coordinates[0].x.toFixed(2)} ${(pad.top + plotHeight).toFixed(2)} Z`;
  const labelIndexes = getLabelIndexes(points.length);
  const ariaLabel = `${title}: ${points.map((item) => `${item.label} ${formatValue(item[valueKey])}`).join(", ")}`;

  return (
    <div className="dash-trend" role="img" aria-label={ariaLabel}>
      <div className="dash-trend-canvas">
        <div className="dash-trend-yaxis" aria-hidden="true">
          {scale.ticks.map((tick) => (
            <span key={tick} style={{ top: `${((pad.top + plotHeight - (tick / scale.max) * plotHeight) / height) * 100}%` }}>
              {isCurrency ? `₱${formatCompact(tick)}` : formatCompact(tick)}
            </span>
          ))}
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
          {scale.ticks.map((tick) => {
            const y = pad.top + plotHeight - (tick / scale.max) * plotHeight;
            return (
              <line
                key={tick}
                x1={pad.left}
                x2={width - pad.right}
                y1={y}
                y2={y}
                className={tick === 0 ? "dash-trend-axis" : "dash-trend-gridline"}
              />
            );
          })}
          <path d={area} className={`dash-trend-area dash-trend-area--${tone}`} />
          <path d={line} className={`dash-trend-line dash-trend-line--${tone}`} />
          {coordinates.map((point, index) => (
            <g key={point.key || `${point.label}-${index}`}>
              <circle cx={point.x} cy={point.y} r="4.5" className={`dash-trend-point dash-trend-point--${tone}`} />
              <circle cx={point.x} cy={point.y} r="13" className="dash-trend-hit">
                <title>{`${point.label}: ${formatValue(point[valueKey])} ${unitLabel}`}</title>
              </circle>
            </g>
          ))}
        </svg>
      </div>
      <div className="dash-trend-xaxis" aria-hidden="true">
        {labelIndexes.map((index) => <span key={index}>{points[index]?.label}</span>)}
      </div>
    </div>
  );
}

function BarChart({ items, formatValue = formatCount, ariaLabel, emptyMessage = "No data recorded yet.", tone = "info" }) {
  const rows = (Array.isArray(items) ? items : []).filter((item) => toNumber(item.value) > 0);
  const max = Math.max(1, ...rows.map((item) => toNumber(item.value)));

  if (rows.length === 0) {
    return <div className="dash-chart-empty" role="status">{emptyMessage}</div>;
  }

  return (
    <div className="dash-bars" role="img" aria-label={ariaLabel}>
      {rows.map((item) => (
        <div className="dash-bar-row" key={item.key ?? item.label}>
          <span className="dash-bar-label">
            <strong>{item.label}</strong>
            {item.meta && <small>{item.meta}</small>}
          </span>
          <span className="dash-bar-track" aria-hidden="true">
            <span
              className={`dash-bar-fill dash-bar-fill--${item.tone || tone}`}
              style={{ width: `${Math.max(3, (toNumber(item.value) / max) * 100)}%` }}
            />
          </span>
          <strong className="dash-bar-value">{formatValue(item.value)}</strong>
        </div>
      ))}
    </div>
  );
}

function DashboardTable({
  columns,
  rows,
  initialSort,
  getSearchText,
  searchPlaceholder = "Search records",
  filters = [],
  pageSize = 6,
  emptyTitle,
  emptySubtitle,
  rowKey,
  searchable = true,
}) {
  const dataset = useMemo(() => (Array.isArray(rows) ? rows : []), [rows]);
  const [search, setSearch] = useState("");
  const [filterState, setFilterState] = useState(() => filters.reduce((accumulator, filter) => ({
    ...accumulator,
    [filter.key]: "all",
  }), {}));
  const [sort, setSort] = useState(initialSort || (columns[0] ? { key: columns[0].key, direction: "desc" } : null));
  const [page, setPage] = useState(1);

  const resolveSearchText = useCallback((row) => {
    if (getSearchText) return getSearchText(row);
    return columns
      .map((column) => (column.searchValue ? column.searchValue(row) : row[column.key]))
      .filter((value) => value !== null && value !== undefined)
      .join(" ");
  }, [columns, getSearchText]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    let result = dataset;

    if (query) {
      result = result.filter((row) => String(resolveSearchText(row) || "").toLowerCase().includes(query));
    }

    filters.forEach((filter) => {
      const value = filterState[filter.key];
      if (value && value !== "all") {
        result = result.filter((row) => String(filter.getValue ? filter.getValue(row) : row[filter.key]) === value);
      }
    });

    if (sort?.key) {
      result = sortRows(result, sort, (row, key) => {
        const column = columns.find((item) => item.key === key);
        return column?.sortValue ? column.sortValue(row) : row[key];
      });
    }

    return result;
  }, [dataset, search, resolveSearchText, filters, filterState, sort, columns]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);
  const showToolbar = searchable || filters.length > 0;

  const handleSort = (key) => {
    setPage(1);
    setSort((previous) => (
      previous?.key === key
        ? { key, direction: previous.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    ));
  };

  return (
    <div className="dash-table">
      {showToolbar && (
        <div className="dash-table-toolbar">
          {searchable && (
            <label className="dash-search">
              <Search size={15} aria-hidden="true" />
              <input
                type="search"
                value={search}
                placeholder={searchPlaceholder}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </label>
          )}
          {filters.length > 0 && (
            <div className="dash-filters">
              <SlidersHorizontal size={15} aria-hidden="true" className="dash-filters-icon" />
              {filters.map((filter) => (
                <label className="dash-filter" key={filter.key}>
                  <span>{filter.label}</span>
                  <select
                    value={filterState[filter.key] ?? "all"}
                    onChange={(event) => {
                      setFilterState((previous) => ({ ...previous, [filter.key]: event.target.value }));
                      setPage(1);
                    }}
                  >
                    <option value="all">All</option>
                    {filter.options.map((option) => (
                      <option value={option.value} key={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={emptyTitle || "No records"}
          subtitle={emptySubtitle || "Nothing matches the current search and filters."}
        />
      ) : (
        <>
          <Table>
            <table className="tmc-table">
              <Table.Header>
                <tr>
                  {columns.map((column) => {
                    const active = sort?.key === column.key;
                    return (
                      <Table.HeadCell
                        key={column.key}
                        style={column.width ? { width: column.width } : undefined}
                        className={column.align ? `dash-cell--${column.align}` : undefined}
                        aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
                      >
                        {column.sortable === false ? column.label : (
                          <button type="button" className="table-sort-button" onClick={() => handleSort(column.key)}>
                            <span>{column.label}</span>
                            <span className="table-sort-indicator" aria-hidden="true">
                              {active ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}
                            </span>
                          </button>
                        )}
                      </Table.HeadCell>
                    );
                  })}
                </tr>
              </Table.Header>
              <Table.Body>
                {visible.map((row, index) => (
                  <Table.Row key={rowKey ? rowKey(row) : row.id ?? `${index}`}>
                    {columns.map((column) => (
                      <Table.Cell key={column.key} className={column.align ? `dash-cell--${column.align}` : undefined}>
                        {column.render ? column.render(row) : (row[column.key] ?? "—")}
                      </Table.Cell>
                    ))}
                  </Table.Row>
                ))}
              </Table.Body>
            </table>
          </Table>
          <div className="dash-table-footer">
            <span>Showing {start + 1}–{Math.min(start + pageSize, filtered.length)} of {filtered.length}</span>
            <div className="dash-pagination">
              <button
                type="button"
                className="dash-page-button"
                onClick={() => setPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
              >
                <ChevronLeft size={15} aria-hidden="true" />
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button
                type="button"
                className="dash-page-button"
                onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                aria-label="Next page"
              >
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SectionHeading({ eyebrow, title, subtitle, id, action }) {
  return (
    <div className="dashboard-section-header">
      <div>
        {eyebrow && <span className="dashboard-section-eyebrow">{eyebrow}</span>}
        <h2 className="dashboard-section-title" id={id}>{title}</h2>
        {subtitle && <p className="dashboard-section-subtitle">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function ChartCard({ title, subtitle, icon: Icon, children, id, className = "" }) {
  return (
    <article className={`dash-card ${className}`.trim()} aria-labelledby={id}>
      <header className="dash-card-heading">
        <div>
          <h3 id={id}>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {Icon && <span className="dash-card-icon" aria-hidden="true"><Icon size={18} /></span>}
      </header>
      {children}
    </article>
  );
}

function DashboardSkeleton() {
  return (
    <div className="dash-skeleton" role="status" aria-label="Loading marketplace analytics">
      <div className="dash-skeleton-hero" />
      <div className="dash-skeleton-kpis">
        {Array.from({ length: 7 }).map((_, index) => <span key={index} />)}
      </div>
      <div className="dash-skeleton-grid">
        <span className="dash-skeleton-wide" />
        <span />
      </div>
      <div className="dash-skeleton-grid">
        <span />
        <span />
      </div>
      <p className="dash-skeleton-text">Loading marketplace analytics…</p>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [trendPeriod, setTrendPeriod] = useState("30d");
  const [trendView, setTrendView] = useState("sales");
  const [marketplaceView, setMarketplaceView] = useState("categories");
  const [categoryMetric, setCategoryMetric] = useState("active_listings");
  const [recentView, setRecentView] = useState("orders");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchStats = useCallback(async () => {
    const token = localStorage.getItem("token");
    let response;

    try {
      response = await fetch(`${API_URL}/admin/stats?period=${encodeURIComponent(trendPeriod)}`, {
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
      throw new Error(data.message || "Unable to load marketplace analytics.");
    }
    if (!data.stats || typeof data.stats !== "object" || Array.isArray(data.stats)) {
      throw new Error("The marketplace analytics response did not include statistics.");
    }
    return data.stats;
  }, [navigate, trendPeriod]);

  useEffect(() => {
    let active = true;

    fetchStats()
      .then((nextStats) => {
        if (active && nextStats !== null) {
          setStats(nextStats);
          setError("");
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.message || "We could not load the marketplace analytics. Please try again.");
        }
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
      const nextStats = await fetchStats();
      if (nextStats !== null) setStats(nextStats);
    } catch (requestError) {
      setError(requestError.message || "We could not load the marketplace analytics. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const numberStat = useCallback((key) => toNumber(stats?.[key]), [stats]);

  const orderTotal = numberStat("total_orders");
  const productTotal = numberStat("total_products");
  const totalUsers = numberStat("total_users");
  const complaintTotal = numberStat("total_complaints");

  const orderStatusItems = useMemo(() => [
    { label: "Pending", value: numberStat("pending_orders"), tone: "warning" },
    { label: "Confirmed", value: numberStat("processing_orders"), tone: "info" },
    { label: "Ready for pickup", value: numberStat("ready_for_pickup_orders"), tone: "sky" },
    { label: "Completed", value: numberStat("completed_orders"), tone: "success" },
    { label: "Declined", value: numberStat("declined_orders"), tone: "danger" },
    { label: "Cancelled", value: numberStat("cancelled_orders"), tone: "neutral" },
  ], [numberStat]);

  const listingStatusItems = useMemo(() => [
    { label: "Active", value: numberStat("active_products"), tone: "success" },
    { label: "Pending review", value: numberStat("pending_products"), tone: "warning" },
    { label: "Inactive", value: numberStat("inactive_products"), tone: "slate" },
    { label: "Sold out", value: numberStat("sold_out_products"), tone: "info" },
    { label: "Rejected", value: numberStat("rejected_products"), tone: "danger" },
    { label: "Suspended", value: numberStat("suspended_products"), tone: "navy" },
    { label: "Archived", value: numberStat("archived_products"), tone: "neutral" },
  ], [numberStat]);

  const complaintStatusItems = useMemo(() => [
    { label: "Pending", value: numberStat("pending_complaints"), tone: "warning" },
    { label: "In review", value: numberStat("under_review_complaints"), tone: "info" },
    { label: "Resolved", value: numberStat("resolved_complaints"), tone: "success" },
    { label: "Rejected", value: numberStat("rejected_complaints"), tone: "danger" },
  ], [numberStat]);

  const roleItems = useMemo(() => [
    { label: "Students", value: numberStat("total_students"), tone: "info" },
    { label: "Staff", value: numberStat("total_staff"), tone: "accent" },
    { label: "Administrators", value: numberStat("total_admins"), tone: "primary" },
  ], [numberStat]);

  const paymentBreakdown = stats?.payment_breakdown || {};
  const paidCount = toNumber(paymentBreakdown?.paid?.count ?? stats?.paid_orders);
  const unpaidCount = toNumber(paymentBreakdown?.unpaid?.count ?? stats?.pending_payments);
  const paidAmount = toNumber(paymentBreakdown?.paid?.amount);
  const unpaidAmount = toNumber(paymentBreakdown?.unpaid?.amount);
  const paymentItems = useMemo(() => [
    { label: "Paid", value: paidCount, tone: "success" },
    { label: "Unpaid", value: unpaidCount, tone: "warning" },
  ], [paidCount, unpaidCount]);

  const salesSeries = Array.isArray(stats?.sales_over_time) ? stats.sales_over_time : [];
  const ordersSeries = Array.isArray(stats?.orders_over_time) ? stats.orders_over_time : [];
  const studentsSeries = Array.isArray(stats?.students_over_time) ? stats.students_over_time : [];
  const categoryPerformance = Array.isArray(stats?.category_performance) ? stats.category_performance : [];
  const topProducts = Array.isArray(stats?.top_products) ? stats.top_products : [];
  const recentOrders = Array.isArray(stats?.recent_orders) ? stats.recent_orders : [];
  const recentUsers = Array.isArray(stats?.recent_users) ? stats.recent_users : [];
  const recentActivity = Array.isArray(stats?.recent_activity)
    ? stats.recent_activity.map((item, index) => ({ ...item, __key: `activity-${index}` }))
    : [];

  const categoryChartItems = categoryPerformance
    .map((category) => ({
      key: category.id,
      label: category.name,
      value: toNumber(category[categoryMetric]),
      meta: `${formatCount(category.active_listings)} active · ${formatCount(category.archived_listings)} archived`,
      tone: categoryMetric === "active_listings" ? "accent" : "info",
    }))
    .filter((category) => category.value > 0)
    .sort((left, right) => right.value - left.value)
    .slice(0, 6);

  const topProductItems = topProducts
    .filter((product) => toNumber(product.units_sold) > 0)
    .slice(0, 6)
    .map((product, index) => ({
      key: product.product_id ?? product.id ?? product.name ?? index,
      label: product.name || "Product",
      value: toNumber(product.units_sold),
      meta: `${formatMoney(product.sales)} sales · ${product.category || "Uncategorized"}`,
      tone: index === 0 ? "primary" : "info",
    }));

  const rangeLabel = RANGE_OPTIONS.find((option) => option.value === trendPeriod)?.label
    || RANGE_OPTIONS[2].label;

  const attentionItems = [
    { label: "listing approvals", value: numberStat("pending_products"), to: "/admin/product-moderation" },
    { label: "open complaints", value: numberStat("open_complaints"), to: "/admin/complaints" },
    { label: "pending orders", value: numberStat("pending_orders"), to: "/admin/transactions?status=pending" },
    { label: "staff applications", value: numberStat("pending_staff_applications"), to: "/admin/staff?status=pending" },
  ];
  const nextAction = attentionItems.find((item) => item.value > 0);

  const kpiCards = [
    {
      label: "Student accounts",
      value: formatCount(stats?.total_students),
      subtitle: `${formatCount(stats?.active_students)} active · ${formatCount(stats?.student_sellers)} sellers`,
      icon: Users,
      tone: "info",
      to: "/admin/users",
    },
    {
      label: "Active listings",
      value: formatCount(stats?.active_products),
      subtitle: `${formatCount(stats?.pending_products)} awaiting review`,
      icon: Package,
      tone: "success",
      to: "/admin/products",
    },
    {
      label: "Pending orders",
      value: formatCount(stats?.pending_orders),
      subtitle: `${formatMoney(stats?.pending_order_value)} in open value`,
      icon: ShoppingCart,
      tone: "warning",
      to: "/admin/transactions?status=pending",
    },
    {
      label: "Completed sales",
      value: formatCount(stats?.completed_orders),
      subtitle: "Orders successfully fulfilled",
      icon: CircleCheck,
      tone: "success",
      to: "/admin/transactions?status=completed",
    },
    {
      label: "Items sold",
      value: formatCount(stats?.total_items_sold),
      subtitle: "Units across completed orders",
      icon: Receipt,
      tone: "info",
      to: "/admin/transactions",
    },
    {
      label: "Total sales",
      value: formatMoney(stats?.total_sales),
      subtitle: `Average order ${formatMoney(stats?.average_order_value)}`,
      icon: Wallet,
      tone: "primary",
      to: "/admin/analytics",
    },
    {
      label: "Open complaints",
      value: formatCount(stats?.open_complaints),
      subtitle: `${formatCount(stats?.pending_complaints)} pending · ${formatCount(stats?.under_review_complaints)} in review`,
      icon: MessageSquare,
      tone: "danger",
      to: "/admin/complaints",
    },
  ];

  const userColumns = [
    {
      key: "name",
      label: "Account",
      render: (row) => (
        <span className="dash-cell-stack">
          <strong>{row.name || "—"}</strong>
          <small>{row.email || "—"}</small>
        </span>
      ),
      sortValue: (row) => String(row.name || "").toLowerCase(),
    },
    {
      key: "role",
      label: "Role",
      width: "150px",
      render: (row) => roleLabel(row.role),
      sortValue: (row) => roleLabel(row.role),
    },
    {
      key: "status",
      label: "Status",
      width: "140px",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "created_at",
      label: "Joined",
      width: "170px",
      render: (row) => formatShortDate(row.created_at),
    },
  ];

  const orderColumns = [
    {
      key: "order_number",
      label: "Order",
      render: (row) => (
        <span className="dash-cell-stack">
          <strong>{row.order_number || "—"}</strong>
          <small>{formatCount(row.item_count)} {toNumber(row.item_count) === 1 ? "item" : "items"}</small>
        </span>
      ),
      sortValue: (row) => String(row.order_number || ""),
    },
    {
      key: "buyer",
      label: "Buyer / seller",
      render: (row) => (
        <span className="dash-cell-stack">
          <strong>{row.buyer || "—"}</strong>
          <small>Seller: {row.seller || "—"}</small>
        </span>
      ),
      sortValue: (row) => String(row.buyer || "").toLowerCase(),
    },
    {
      key: "total_amount",
      label: "Total",
      width: "130px",
      align: "right",
      render: (row) => formatMoney(row.total_amount),
    },
    {
      key: "payment_status",
      label: "Payment",
      width: "130px",
      render: (row) => <StatusBadge status={row.payment_status} />,
    },
    {
      key: "status",
      label: "Status",
      width: "160px",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "created_at",
      label: "Placed",
      width: "150px",
      render: (row) => formatShortDate(row.created_at),
    },
  ];

  const activityColumns = [
    {
      key: "user",
      label: "User",
      render: (row) => (
        <span className="dash-cell-stack">
          <strong>{row.user || "—"}</strong>
          <small>{roleLabel(row.role)}</small>
        </span>
      ),
      sortValue: (row) => String(row.user || "").toLowerCase(),
    },
    {
      key: "action",
      label: "Action",
      render: (row) => (
        <span className="dash-cell-stack">
          <strong>{row.action || "—"}</strong>
          <small>{row.target || "—"}</small>
        </span>
      ),
      sortValue: (row) => String(row.action || "").toLowerCase(),
    },
    {
      key: "type",
      label: "Type",
      width: "140px",
      render: (row) => activityTypeLabel(row.type),
    },
    {
      key: "date_time",
      label: "When",
      width: "170px",
      render: (row) => formatDateTime(row.date_time),
    },
    {
      key: "status",
      label: "Status",
      width: "150px",
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  const recentPanels = {
    orders: {
      label: "Orders",
      title: "Recent orders",
      subtitle: "Latest purchases and their payment and fulfilment status.",
      to: "/admin/transactions",
      action: "View all orders",
      columns: orderColumns,
      rows: recentOrders,
      searchPlaceholder: "Search orders, buyers, or sellers",
      getSearchText: (row) => [row.order_number, row.buyer, row.seller, row.status, row.payment_status].join(" "),
      filters: [
        { key: "status", label: "Order status", options: ORDER_STATUS_OPTIONS },
        {
          key: "payment_status",
          label: "Payment",
          options: [
            { value: "paid", label: "Paid" },
            { value: "unpaid", label: "Unpaid" },
          ],
        },
      ],
      emptyTitle: "No orders yet",
      emptySubtitle: "Student purchases will appear here when an order is placed.",
      rowKey: (row) => "order-" + row.id,
      sort: { key: "created_at", direction: "desc" },
    },
    accounts: {
      label: "Accounts",
      title: "Recent accounts",
      subtitle: "Newest student, staff, and administrator accounts.",
      to: "/admin/users",
      action: "View all accounts",
      columns: userColumns,
      rows: recentUsers,
      searchPlaceholder: "Search accounts by name, email, or role",
      getSearchText: (row) => [row.name, row.email, row.role, row.status].join(" "),
      filters: [
        { key: "status", label: "Status", options: USER_STATUS_OPTIONS },
        {
          key: "role",
          label: "Role",
          options: [
            { value: "student", label: "Student" },
            { value: "staff", label: "Staff" },
            { value: "admin", label: "Administrator" },
          ],
        },
      ],
      emptyTitle: "No accounts yet",
      emptySubtitle: "New marketplace accounts will appear here after registration.",
      rowKey: (row) => "user-" + row.id,
      sort: { key: "created_at", direction: "desc" },
    },
    activity: {
      label: "Activity",
      title: "Latest activity",
      subtitle: "Recent account, listing, order, and moderation actions.",
      to: "/admin/activity-logs",
      action: "View activity logs",
      columns: activityColumns,
      rows: recentActivity,
      searchPlaceholder: "Search activity by user, action, or target",
      getSearchText: (row) => [row.user, row.action, row.target, row.type, row.status].join(" "),
      filters: [],
      emptyTitle: "No recent activity",
      emptySubtitle: "Marketplace actions will appear here as they happen.",
      rowKey: (row) => row.__key,
      sort: { key: "date_time", direction: "desc" },
    },
  };
  const activeRecentPanel = recentPanels[recentView] || recentPanels.orders;

  if (loading && !stats) {
    return (
      <AdminLayout title="Dashboard" subtitle="Marketplace analytics, sales, and administrative activity.">
        <AdminPageHero
          title="Dashboard"
          description="Review marketplace performance, student activity, orders, and support metrics."
          icon={LayoutDashboard}
          onRefresh={refreshStats}
          refreshing={refreshing}
        />
        <DashboardSkeleton />
      </AdminLayout>
    );
  }

  if (error && !stats) {
    return (
      <AdminLayout title="Dashboard" subtitle="Marketplace analytics, sales, and administrative activity.">
        <AdminPageHero
          title="Dashboard"
          description="Review marketplace performance, student activity, orders, and support metrics."
          icon={LayoutDashboard}
          onRefresh={refreshStats}
          refreshing={refreshing}
        />
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
    <AdminLayout title="Dashboard" subtitle="Marketplace analytics, sales, and administrative activity.">
      <div className="admin-dashboard-page">
        {error && (
          <div className="dashboard-error" role="alert">
            <div className="dashboard-error-body">
              <TriangleAlert size={18} aria-hidden="true" />
              <span><strong>Showing cached data.</strong> {error}</span>
            </div>
            <Button variant="outline" size="sm" loading={refreshing} onClick={refreshStats}>
              Try again
            </Button>
          </div>
        )}

        <AdminPageHero
          title="Dashboard"
          description="Review marketplace performance, student activity, orders, and support metrics."
          icon={LayoutDashboard}
          onRefresh={refreshStats}
          refreshing={refreshing}
          actions={(
            <>
              <Link className="admin-page-hero-link" to={nextAction?.to ?? "/admin/products"}>
                {nextAction ? `Review ${nextAction.label}` : "Browse listings"}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link className="admin-page-hero-secondary" to="/admin/analytics">Open analytics</Link>
            </>
          )}
        />

        <section className="dashboard-section" aria-labelledby="dashboard-kpi-title">
          <SectionHeading
            eyebrow="Marketplace overview"
            title="At a glance"
            subtitle="Live totals from student accounts, listings, orders, sales, and support."
            id="dashboard-kpi-title"
            action={(
              <label className="dash-range">
                <span>Date range</span>
                <select value={trendPeriod} onChange={(event) => setTrendPeriod(event.target.value)}>
                  {RANGE_OPTIONS.map((option) => (
                    <option value={option.value} key={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            )}
          />
          <div className="metrics-grid dash-kpi-grid">
            {kpiCards.map((item) => (
              <StatCard
                key={item.label}
                label={item.label}
                value={item.value}
                icon={item.icon}
                tone={item.tone}
                subtitle={item.subtitle}
                href={item.to}
              />
            ))}
          </div>
        </section>

        <section className="dashboard-section" aria-labelledby="dashboard-sales-title">
          <SectionHeading
            eyebrow="Sales and orders"
            title="Marketplace activity over time"
            subtitle={"Revenue and order volume for " + rangeLabel.toLowerCase() + "."}
            id="dashboard-sales-title"
          />
          <div className="dash-grid dash-grid--wide">
            <ChartCard
              title={trendView === "sales" ? "Sales over time" : "Orders over time"}
              subtitle={trendView === "sales" ? "Completed sales value in the selected range" : "New orders created in the selected range"}
              icon={trendView === "sales" ? TrendingUp : ChartColumn}
              id="dashboard-trend-card-title"
              className="dash-card--wide"
            >
              <div className="dash-segmented" role="group" aria-label="Choose trend metric">
                <button type="button" aria-pressed={trendView === "sales"} onClick={() => setTrendView("sales")}>Sales</button>
                <button type="button" aria-pressed={trendView === "orders"} onClick={() => setTrendView("orders")}>Orders</button>
              </div>
              <div className="dash-mini-grid dash-mini-grid--compact">
                <div className="dash-mini">
                  <span>Completed sales</span>
                  <strong>{formatMoney(stats?.total_sales)}</strong>
                </div>
                <div className="dash-mini">
                  <span>Pending order value</span>
                  <strong>{formatMoney(stats?.pending_order_value)}</strong>
                </div>
                <div className="dash-mini">
                  <span>Orders in range</span>
                  <strong>{formatCount(ordersSeries.reduce((accumulator, item) => accumulator + toNumber(item.orders), 0))}</strong>
                </div>
                <div className="dash-mini">
                  <span>Average order</span>
                  <strong>{formatMoney(stats?.average_order_value)}</strong>
                </div>
              </div>
              {trendView === "sales" ? (
                <TrendChart
                  data={salesSeries}
                  valueKey="sales"
                  title="Sales over time"
                  unitLabel="sales"
                  formatValue={formatMoney}
                  tone="success"
                  emptyMessage="No completed sales were recorded in this range."
                />
              ) : (
                <TrendChart
                  data={ordersSeries}
                  valueKey="orders"
                  title="Orders over time"
                  unitLabel="orders"
                  tone="info"
                  emptyMessage="No orders were recorded in this range."
                />
              )}
            </ChartCard>
            <ChartCard
              title="Orders by status"
              subtitle={formatCount(orderTotal) + " total orders"}
              icon={ChartPie}
              id="dashboard-order-status-title"
            >
              <DonutChart
                items={orderStatusItems}
                total={orderTotal}
                centerValue={formatCount(orderTotal)}
                centerLabel="orders"
                ariaLabel={"Orders by status: " + orderStatusItems.map((item) => item.label + " " + formatCount(item.value)).join(", ")}
                emptyMessage="No orders have been placed yet."
              />
            </ChartCard>
          </div>
        </section>

        <section className="dashboard-section" aria-labelledby="dashboard-marketplace-title">
          <SectionHeading
            eyebrow="Marketplace performance"
            title="Listings, categories, and student concerns"
            subtitle="Compare category activity, inventory health, and open complaints."
            id="dashboard-marketplace-title"
            action={(
              <Link className="dashboard-section-link" to="/admin/products">
                Review listings <ArrowRight size={15} aria-hidden="true" />
              </Link>
            )}
          />
          <div className="dash-grid dash-grid--three dash-marketplace-grid">
            <ChartCard
              title={marketplaceView === "products" ? "Top selling products" : "Category performance"}
              subtitle={marketplaceView === "products" ? "Units and sales from completed orders" : "Compare orders, completed sales, items, or active listings"}
              icon={marketplaceView === "products" ? Package : ChartColumn}
              id="dashboard-performance-chart-title"
            >
              <div className="dash-chart-controls">
                <div className="dash-segmented dash-segmented--small" role="group" aria-label="Choose marketplace performance">
                  <button type="button" aria-pressed={marketplaceView === "categories"} onClick={() => setMarketplaceView("categories")}>Categories</button>
                  <button type="button" aria-pressed={marketplaceView === "products"} onClick={() => setMarketplaceView("products")}>Products</button>
                </div>
                {marketplaceView === "categories" && (
                  <label className="dash-metric-control">
                    <span>Metric</span>
                    <select value={categoryMetric} onChange={(event) => setCategoryMetric(event.target.value)}>
                      <option value="sales">Completed sales</option>
                      <option value="orders">Orders</option>
                      <option value="items_sold">Items sold</option>
                      <option value="active_listings">Active listings</option>
                    </select>
                  </label>
                )}
              </div>
              <BarChart
                items={marketplaceView === "products" ? topProductItems : categoryChartItems}
                formatValue={marketplaceView !== "products" && categoryMetric === "sales" ? formatMoney : formatCount}
                ariaLabel={marketplaceView === "products" ? "Top selling products by units sold" : "Category performance by " + categoryMetric.replace("_", " ")}
                emptyMessage={marketplaceView === "products" ? "No completed product sales yet." : "No category activity for this metric yet."}
                tone="primary"
              />
              <p className="dash-chart-note">
                {marketplaceView === "products"
                  ? "Only products with completed sales are shown."
                  : "Archived listings stay separate and are excluded from active listing counts."}
              </p>
            </ChartCard>

            <ChartCard
              title="Listings by status"
              subtitle={formatCount(numberStat("active_products")) + " active · " + formatCount(numberStat("archived_products")) + " archived"}
              icon={Package}
              id="dashboard-listing-status-title"
            >
              <DonutChart
                items={listingStatusItems}
                total={productTotal}
                centerValue={formatCount(productTotal)}
                centerLabel="listings"
                ariaLabel={"Listings by status: " + listingStatusItems.map((item) => item.label + " " + formatCount(item.value)).join(", ")}
                emptyMessage="No listings have been submitted yet."
              />
              <p className="dash-chart-note">Archived listings are tracked separately from active listings.</p>
            </ChartCard>

            <ChartCard
              title="Student concerns"
              subtitle={formatCount(complaintTotal) + " total complaints"}
              icon={MessageSquare}
              id="dashboard-complaints-status-title"
            >
              <div className="dash-complaint-highlight">
                <span>
                  <small>Open complaints</small>
                  <strong>{formatCount(numberStat("open_complaints"))}</strong>
                </span>
                <Link to="/admin/complaints" aria-label="Review student complaints">
                  Review <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
              <DonutChart
                items={complaintStatusItems}
                total={complaintTotal}
                centerValue={formatCount(complaintTotal)}
                centerLabel="complaints"
                ariaLabel={"Complaints by status: " + complaintStatusItems.map((item) => item.label + " " + formatCount(item.value)).join(", ")}
                emptyMessage="No complaints yet. Student complaints will appear here."
              />
            </ChartCard>
          </div>
        </section>

        <section className="dashboard-section" aria-labelledby="dashboard-audience-title">
          <SectionHeading
            eyebrow="Students and payments"
            title="Audience and payment coverage"
            subtitle="Track new student accounts, role mix, and recorded payment states."
            id="dashboard-audience-title"
          />
          <div className="dash-grid dash-grid--wide">
            <ChartCard
              title="Student growth and account mix"
              subtitle={formatCount(totalUsers) + " total accounts"}
              icon={Users}
              id="dashboard-audience-card-title"
              className="dash-card--wide"
            >
              <div className="dash-audience-combined">
                <div className="dash-audience-chart">
                  <h4>New student accounts</h4>
                  <TrendChart
                    data={studentsSeries}
                    valueKey="students"
                    title="Student growth"
                    unitLabel="students"
                    tone="primary"
                    emptyMessage="No student accounts were created in this range."
                  />
                </div>
                <div className="dash-audience-chart">
                  <h4>Users by role</h4>
                  <DonutChart
                    items={roleItems}
                    total={totalUsers}
                    centerValue={formatCount(totalUsers)}
                    centerLabel="accounts"
                    ariaLabel={"Users by role: " + roleItems.map((item) => item.label + " " + formatCount(item.value)).join(", ")}
                    emptyMessage="No user accounts have been created yet."
                  />
                </div>
              </div>
              <div className="dash-participation dash-participation--compact">
                <div><span><UserCheck size={14} aria-hidden="true" /> Student sellers</span><strong>{formatCount(stats?.student_sellers)}</strong></div>
                <div><span>Students with orders</span><strong>{formatCount(stats?.students_with_orders)}</strong></div>
                <div><span>Suspended accounts</span><strong>{formatCount(stats?.suspended_accounts)}</strong></div>
              </div>
            </ChartCard>
            <ChartCard
              title="Payment status"
              subtitle={formatCount(paidCount + unpaidCount) + " orders with payment records"}
              icon={CreditCard}
              id="dashboard-payment-title"
            >
              <DonutChart
                items={paymentItems}
                total={paidCount + unpaidCount}
                centerValue={formatCount(paidCount + unpaidCount)}
                centerLabel="orders"
                ariaLabel={"Payment status: Paid " + formatCount(paidCount) + ", Unpaid " + formatCount(unpaidCount)}
                emptyMessage="No payment records are available yet."
              />
              <div className="dash-payment-summary">
                <div className="dash-payment-summary-row">
                  <span>Paid value</span>
                  <strong>{formatMoney(paidAmount)}</strong>
                </div>
                <div className="dash-payment-summary-row">
                  <span>Unpaid value</span>
                  <strong>{formatMoney(unpaidAmount)}</strong>
                </div>
              </div>
            </ChartCard>
          </div>
        </section>

        <section className="dashboard-section" aria-labelledby="dashboard-recent-title">
          <SectionHeading
            eyebrow="Recent records"
            title="Recent marketplace activity"
            subtitle="Switch between the latest orders, accounts, and audit activity."
            id="dashboard-recent-title"
            action={(
              <Link className="dashboard-section-link" to={activeRecentPanel.to}>
                {activeRecentPanel.action} <ArrowRight size={15} aria-hidden="true" />
              </Link>
            )}
          />
          <div className="dash-card dash-card--recent">
            <div className="dash-recent-tabs" role="tablist" aria-label="Recent marketplace records">
              {Object.entries(recentPanels).map(([key, panel]) => (
                <button
                  type="button"
                  role="tab"
                  id={"recent-tab-" + key}
                  aria-selected={recentView === key}
                  aria-controls="dashboard-recent-panel"
                  key={key}
                  onClick={() => setRecentView(key)}
                >
                  {panel.label}
                  <span>{formatCount(panel.rows.length)}</span>
                </button>
              ))}
            </div>
            <div id="dashboard-recent-panel" role="tabpanel" aria-labelledby={"recent-tab-" + recentView}>
              <DashboardTable
                key={recentView}
                columns={activeRecentPanel.columns}
                rows={activeRecentPanel.rows}
                initialSort={activeRecentPanel.sort}
                getSearchText={activeRecentPanel.getSearchText}
                searchPlaceholder={activeRecentPanel.searchPlaceholder}
                filters={activeRecentPanel.filters}
                pageSize={4}
                emptyTitle={activeRecentPanel.emptyTitle}
                emptySubtitle={activeRecentPanel.emptySubtitle}
                rowKey={activeRecentPanel.rowKey}
              />
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
