import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowUpDown,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  FileClock,
  ListFilter,
  Package,
  RotateCcw,
  Search,
  ShoppingBag,
  Users,
  XCircle,
} from "lucide-react";
import AdminLayout from "./components/AdminLayout";
import AdminPageHero from "./components/AdminPageHero";
import { API_URL } from "./utils/api";
import "./AdminActivityLogs.css";

const PAGE_SIZE = 25;
const CATEGORY_DEFS = [
  { key: "account", label: "Account", color: "var(--tmc-admin-primary)" },
  { key: "product", label: "Product", color: "var(--tmc-admin-success)" },
  { key: "order", label: "Order", color: "var(--tmc-admin-warning)" },
  { key: "moderation", label: "Moderation", color: "var(--tmc-admin-info)" },
  { key: "complaint", label: "Complaint", color: "var(--tmc-admin-danger)" },
];

const PERIODS = [
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
  { value: "all", label: "All recorded events", days: null },
];

const safeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value) => {
  const date = safeDate(value);
  return date
    ? date.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
};

const categoryFor = (type) => CATEGORY_DEFS.find((category) => category.key === String(type || "").toLowerCase()) || { key: "other", label: "Other", color: "var(--tmc-admin-secondary)" };

const readableStatus = (status) => String(status || "unknown").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const statusTone = (status) => {
  if (["active", "resolved", "completed", "confirmed", "ready_for_pickup"].includes(String(status || "").toLowerCase())) return "success";
  if (["pending", "open", "in_review", "under_review"].includes(String(status || "").toLowerCase())) return "warning";
  if (["rejected", "declined", "cancelled", "suspended"].includes(String(status || "").toLowerCase())) return "danger";
  return "neutral";
};

const csvCell = (value) => {
  const text = String(value ?? "");
  const safeText = /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
};

function describeDetails(details = {}) {
  const lines = [];
  if (details.status_change) {
    lines.push(`Status: ${readableStatus(details.status_change.from)} → ${readableStatus(details.status_change.to)}`);
  }
  if (details.payment_status_change) {
    lines.push(`Payment status: ${readableStatus(details.payment_status_change.from)} → ${readableStatus(details.payment_status_change.to)}`);
  }
  if (details.stock_before != null || details.stock_after != null) {
    lines.push(`Stock: ${details.stock_before ?? "—"} → ${details.stock_after ?? "—"} units`);
  }
  if (details.changed_fields?.length) {
    lines.push(`Changed fields: ${details.changed_fields.map(readableStatus).join(", ")}`);
  }
  if (details.duration_days != null) {
    lines.push(`Suspension duration: ${details.duration_days} days`);
  }
  if (details.suspended_until) {
    lines.push(`Suspended until: ${formatDate(details.suspended_until)}`);
  }
  return lines;
}

function ActivityTrendChart({ trend }) {
  const days = useMemo(() => {
    return trend.map((point) => {
      const date = safeDate(`${point.date}T00:00:00`);
      return date ? {
        key: point.date,
        date,
        label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        counts: point.counts || {},
      } : null;
    }).filter(Boolean);
  }, [trend]);
  const categories = CATEGORY_DEFS.filter((category) => days.some((day) => day.counts[category.key]));
  const maxCount = Math.max(1, ...days.map((day) => Object.values(day.counts).reduce((sum, count) => sum + count, 0)));
  const plot = { left: 38, right: 680, top: 18, bottom: 166 };
  const step = days.length ? (plot.right - plot.left) / days.length : 0;
  const barWidth = Math.min(34, Math.max(10, step * 0.58));
  const tickValues = [...new Set([0, Math.ceil(maxCount / 2), maxCount])];
  const labelEvery = Math.max(1, Math.ceil(days.length / 7));

  return (
    <article className="activity-panel activity-trend-panel">
      <div className="activity-panel-heading">
        <span className="activity-panel-icon"><Activity size={18} /></span>
        <div><h2>Activity Over Time</h2><p>Recorded events by day in the selected range.</p></div>
      </div>
      {days.length ? <>
        <svg className="activity-trend-chart" viewBox="0 0 700 200" role="img" aria-label="Stacked activity counts by day and event category">
          {tickValues.map((value) => {
            const y = plot.bottom - (value / maxCount) * (plot.bottom - plot.top);
            return <g key={value}><line x1={plot.left} y1={y} x2={plot.right} y2={y} className="activity-chart-gridline" /><text x={plot.left - 9} y={y + 4} textAnchor="end" className="activity-chart-axis-label">{value}</text></g>;
          })}
          {days.map((day, index) => {
            const center = plot.left + (index + 0.5) * step;
            let accumulated = 0;
            return <g key={day.key}>
              {categories.map((category) => {
                const count = day.counts[category.key] || 0;
                if (!count) return null;
                const height = (count / maxCount) * (plot.bottom - plot.top);
                const y = plot.bottom - accumulated - height;
                accumulated += height;
                return <rect key={category.key} x={center - barWidth / 2} y={y} width={barWidth} height={Math.max(height, 1)} rx="2" fill={category.color}><title>{`${day.label}: ${count} ${category.label.toLowerCase()} event${count === 1 ? "" : "s"}`}</title></rect>;
              })}
              {(index === 0 || index === days.length - 1 || index % labelEvery === 0) && <text x={center} y="190" textAnchor="middle" className="activity-chart-axis-label">{day.label}</text>}
            </g>;
          })}
        </svg>
        <div className="activity-chart-legend">{categories.map((category) => <span key={category.key}><i style={{ background: category.color }} />{category.label}</span>)}</div>
      </> : <div className="activity-chart-empty">No dated activity was returned for this range.</div>}
    </article>
  );
}

function CategoryDistribution({ eventCounts }) {
  const counts = CATEGORY_DEFS.map((category) => ({ ...category, count: Number(eventCounts?.[category.key] || 0) }));
  const total = counts.reduce((sum, category) => sum + category.count, 0);
  let stop = 0;
  const ring = total
    ? `conic-gradient(${counts.filter((category) => category.count).map((category) => {
      const start = stop;
      stop += (category.count / total) * 100;
      return `${category.color} ${start}% ${stop}%`;
    }).join(", ")})`
    : "var(--tmc-admin-bg-muted)";

  return (
    <article className="activity-panel activity-category-panel">
      <div className="activity-panel-heading">
        <span className="activity-panel-icon"><ListFilter size={18} /></span>
        <div><h2>Events by Category</h2><p>Recorded event counts in the selected range.</p></div>
      </div>
      <div className="activity-category-content">
        <div className="activity-category-ring" style={{ background: ring }} role="img" aria-label={`Distribution of ${total} events in the selected range`}>
          <div><strong>{total}</strong><span>Events in range</span></div>
        </div>
        <div className="activity-category-list">
          {counts.filter((category) => category.count > 0).map((category) => (
            <div className="activity-category-row" key={category.key}>
              <i style={{ background: category.color }} />
              <span>{category.label}</span>
              <strong>{category.count}</strong>
              <small>{total ? Math.round((category.count / total) * 100) : 0}%</small>
            </div>
          ))}
          {!total && <span className="activity-category-empty">No events in this range.</span>}
        </div>
      </div>
    </article>
  );
}

export default function AdminActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("30d");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [sortBy, setSortBy] = useState("occurred_at");
  const [sortDirection, setSortDirection] = useState("desc");
  const [page, setPage] = useState(1);
  const [expandedKey, setExpandedKey] = useState("");
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, per_page: PAGE_SIZE, total: 0 });
  const [summary, setSummary] = useState({ total: 0, by_category: {} });
  const [trend, setTrend] = useState([]);
  const [filterOptions, setFilterOptions] = useState({ statuses: [], actors: [], actions: [] });
  const logsLoadSequenceRef = useRef(0);

  const fetchLogs = useCallback(async (signal) => {
    const token = localStorage.getItem("token");
    const params = new URLSearchParams({
      period,
      page: String(page),
      per_page: String(PAGE_SIZE),
      sort_by: sortBy,
      sort_direction: sortDirection,
    });
    if (search) params.set("search", search);
    if (categoryFilter) params.set("category", categoryFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (actorFilter) params.set("actor", actorFilter);
    if (actionFilter) params.set("action", actionFilter);
    const response = await fetch(`${API_URL}/admin/activity-logs?${params}`, {
      headers: { Accept: "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
      ...(signal ? { signal } : {}),
    });
    if (signal?.aborted) return null;
    if (response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("role");
      window.location.replace("/login");
      return null;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Unable to load activity logs.");
    return {
      logs: Array.isArray(data.events) ? data.events.map((item) => ({ ...item, __key: String(item.id) })) : [],
      pagination: data.pagination || { current_page: 1, last_page: 1, per_page: PAGE_SIZE, total: 0 },
      summary: data.summary || { total: 0, by_category: {} },
      trend: Array.isArray(data.trend) ? data.trend : [],
      filterOptions: data.filter_options || { statuses: [], actors: [], actions: [] },
    };
  }, [actionFilter, actorFilter, categoryFilter, page, period, search, sortBy, sortDirection, statusFilter]);

  useEffect(() => {
    const normalized = searchInput.trim();
    if (normalized === search) return undefined;
    const timer = window.setTimeout(() => {
      setSearch(normalized);
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search, searchInput]);

  const applyPayload = useCallback((payload) => {
    setLogs(payload.logs);
    setPagination(payload.pagination);
    setSummary(payload.summary);
    setTrend(payload.trend);
    setFilterOptions(payload.filterOptions);
  }, []);

  const refreshLogs = async (signal) => {
    const loadSequence = ++logsLoadSequenceRef.current;
    if (!signal) setRefreshing(true);
    setError("");
    try {
      const payload = await fetchLogs(signal);
      if (!signal?.aborted && loadSequence === logsLoadSequenceRef.current && payload !== null) {
        applyPayload(payload);
      }
    } catch (err) {
      if (!signal?.aborted && err?.name !== "AbortError" && loadSequence === logsLoadSequenceRef.current) {
        setError(err.message || "We could not refresh activity logs. Please try again.");
      }
    } finally {
      if (!signal?.aborted && loadSequence === logsLoadSequenceRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const loadSequence = ++logsLoadSequenceRef.current;
    fetchLogs(controller.signal)
      .then((payload) => {
        if (active && !controller.signal.aborted && loadSequence === logsLoadSequenceRef.current && payload !== null) {
          applyPayload(payload);
        }
      })
      .catch((err) => {
        if (active && !controller.signal.aborted && err?.name !== "AbortError" && loadSequence === logsLoadSequenceRef.current) {
          setError(err.message || "We could not load activity logs. Please try again.");
        }
      })
      .finally(() => {
        if (active && loadSequence === logsLoadSequenceRef.current) setLoading(false);
      });
    return () => { active = false; controller.abort(); };
  }, [applyPayload, fetchLogs]);

  const currentPage = pagination.current_page || 1;
  const pageCount = pagination.last_page || 1;
  const filteredLogs = logs;
  const visibleLogs = logs;
  const categories = CATEGORY_DEFS;
  const actors = filterOptions.actors || [];
  const statuses = filterOptions.statuses || [];
  const actions = filterOptions.actions || [];
  const countType = (types) => types.reduce((total, type) => total + Number(summary.by_category?.[type] || 0), 0);

  const clearFilters = () => {
    setPeriod("30d");
    setSearch("");
    setSearchInput("");
    setCategoryFilter("");
    setStatusFilter("");
    setActorFilter("");
    setActionFilter("");
    setSortBy("occurred_at");
    setSortDirection("desc");
    setPage(1);
    setExpandedKey("");
  };

  const changeSort = (key) => {
    if (sortBy === key) setSortDirection((direction) => direction === "asc" ? "desc" : "asc");
    else {
      setSortBy(key);
      setSortDirection(key === "occurred_at" ? "desc" : "asc");
    }
    setPage(1);
  };

  const exportCsv = () => {
    const rows = [
      ["Actor", "Role", "Category", "Action", "Related record", "Record status", "Date and time"],
      ...filteredLogs.map((item) => [item.user || "System", item.role || "Unknown", categoryFor(item.type).label, item.action || "Unknown action", item.target || "—", readableStatus(item.status), item.date_time || ""]),
    ];
    const blob = new Blob(["\uFEFF", rows.map((row) => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `studentmart-activity-logs-${period}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const summaryCards = [
    { label: "Events in range", value: summary.total.toLocaleString(), description: PERIODS.find((option) => option.value === period)?.label || "Selected range", icon: FileClock, color: "blue" },
    { label: "Account events", value: countType(["account"]).toLocaleString(), description: "Account and Staff application history", icon: Users, color: "green" },
    { label: "Product events", value: countType(["product", "moderation"]).toLocaleString(), description: "Listings, stock, and moderation", icon: Package, color: "purple" },
    { label: "Order & complaint events", value: countType(["order", "complaint"]).toLocaleString(), description: "Order and support history", icon: ShoppingBag, color: "orange" },
  ];

  return (
    <AdminLayout title="Activity Logs" subtitle="Review recent marketplace account, listing, order, and moderation activity.">
      <div className="activity-logs-page">
        <AdminPageHero
          title="Activity Logs"
          description="Review recorded account, product, order, moderation, and support activity across StudentMart."
          icon={FileClock}
          onRefresh={refreshLogs}
          autoRefreshIntervalMs={120_000}
          refreshing={loading || refreshing}
          sideContent={(
            <label className="activity-period-select">
              <CalendarDays size={16} aria-hidden="true" />
              <span className="activity-sr-only">Activity date range</span>
              <select value={period} onChange={(event) => { setPeriod(event.target.value); setPage(1); setExpandedKey(""); }} aria-label="Activity date range">
                {PERIODS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
              </select>
            </label>
          )}
        />

        {error && <div className="activity-error" role="alert"><XCircle size={19} /><div><strong>Unable to load activity logs</strong><span>{error}</span></div><button type="button" onClick={refreshLogs}>Try again</button></div>}

        {loading ? <div className="activity-summary-grid" aria-label="Loading activity summary">{[1, 2, 3, 4].map((item) => <div className="activity-summary-card activity-skeleton" key={item}><span /><strong /><small /></div>)}</div> : <>
          <section className="activity-summary-grid" aria-label="Activity summary">
            {summaryCards.map(({ label, value, description, icon: Icon, color }) => <article className={`activity-summary-card ${color}`} key={label}>
              <span className="activity-summary-icon"><Icon size={20} /></span><div><span className="activity-summary-label">{label}</span><strong>{value.toLocaleString()}</strong><small>{description}</small></div>
            </article>)}
          </section>

          <section className="activity-analytics-grid" aria-label="Activity analytics">
            <ActivityTrendChart trend={trend} />
            <CategoryDistribution eventCounts={summary.by_category} />
          </section>

          <section className="activity-audit-panel" aria-labelledby="activity-audit-title">
            <div className="activity-audit-heading">
              <div><h2 id="activity-audit-title">Audit Log</h2><p>Search and filter recorded events across the selected date range.</p></div>
              <button type="button" className="activity-export-button" onClick={exportCsv} disabled={!filteredLogs.length}><Download size={15} />Export current page</button>
            </div>

            <div className="activity-filter-toolbar">
              <label className="activity-search-control"><Search size={15} /><span className="activity-sr-only">Search actors, actions, or records</span><input value={searchInput} onChange={(event) => { setSearchInput(event.target.value); setPage(1); }} placeholder="Search actors, actions, and records…" /></label>
              <label><span className="activity-sr-only">Filter by category</span><select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); setExpandedKey(""); }}><option value="">All categories</option>{categories.map((category) => <option value={category.key} key={category.key}>{category.label}</option>)}</select></label>
              <label><span className="activity-sr-only">Filter by record status</span><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); setExpandedKey(""); }}><option value="">All record statuses</option>{statuses.map((status) => <option value={status} key={status}>{readableStatus(status)}</option>)}</select></label>
              <label><span className="activity-sr-only">Filter by actor</span><select value={actorFilter} onChange={(event) => { setActorFilter(event.target.value); setPage(1); setExpandedKey(""); }}><option value="">All actors</option>{actors.map((actor) => <option value={actor} key={actor}>{actor}</option>)}</select></label>
              <label><span className="activity-sr-only">Filter by action</span><select value={actionFilter} onChange={(event) => { setActionFilter(event.target.value); setPage(1); setExpandedKey(""); }}><option value="">All actions</option>{actions.map((action) => <option value={action} key={action}>{readableStatus(action)}</option>)}</select></label>
              <button type="button" className="activity-clear-button" onClick={clearFilters}><RotateCcw size={14} />Clear filters</button>
            </div>

            <div className="activity-table-wrap">
              <table className="activity-table">
                <thead><tr>
                  <th scope="col" aria-sort={sortBy === "actor_name" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}><button type="button" onClick={() => changeSort("actor_name")}>Actor <ArrowUpDown size={12} /></button></th>
                  <th scope="col" aria-sort={sortBy === "event_type" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}><button type="button" onClick={() => changeSort("event_type")}>Category <ArrowUpDown size={12} /></button></th>
                  <th scope="col" aria-sort={sortBy === "action" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}><button type="button" onClick={() => changeSort("action")}>Action / Description <ArrowUpDown size={12} /></button></th>
                  <th scope="col" aria-sort={sortBy === "occurred_at" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}><button type="button" onClick={() => changeSort("occurred_at")}>Date &amp; Time <ArrowUpDown size={12} /></button></th>
                  <th scope="col">Record Status</th><th scope="col">Actions</th>
                </tr></thead>
                <tbody>
                  {!loading && visibleLogs.length === 0 && <tr><td colSpan={6} className="activity-table-empty">{error ? "Activity could not be loaded. Try refreshing the page." : "No activity matches these filters."}</td></tr>}
                  {visibleLogs.map((item) => {
                    const category = categoryFor(item.type);
                    const isExpanded = expandedKey === item.__key;
                    return <Fragment key={item.__key}>
                      <tr key={item.__key}>
                        <td><strong className="activity-actor-name">{item.user || "System"}</strong><small className="activity-actor-role">{readableStatus(item.role || "Unknown actor")}</small></td>
                        <td><span className={`activity-category-badge ${category.key}`}>{category.label}</span></td>
                        <td><strong className="activity-action-name">{item.action || "Unknown action"}</strong><small className="activity-action-target">{item.target || "Related record not provided"}</small></td>
                        <td className="activity-date-cell">{formatDate(item.date_time)}</td>
                        <td><span className={`activity-record-status ${statusTone(item.status)}`}>{readableStatus(item.status)}</span></td>
                        <td><button className="activity-view-button" type="button" onClick={() => setExpandedKey(isExpanded ? "" : item.__key)} aria-expanded={isExpanded} aria-label={`${isExpanded ? "Hide" : "View"} details for ${item.action || "activity"}`}><Eye size={15} />{isExpanded ? "Hide" : "View"}</button></td>
                      </tr>
                      {isExpanded && <tr className="activity-details-row" key={`${item.__key}-details`}><td colSpan={6}><div className="activity-details-grid"><div><span>Actor role</span><strong>{readableStatus(item.role || "Unknown actor")}</strong></div><div><span>Category</span><strong>{category.label}</strong></div><div><span>Related record</span><strong>{item.target || "Not provided"}</strong></div><div><span>Record status</span><strong>{readableStatus(item.status)}</strong></div><div><span>Recorded at</span><strong>{formatDate(item.date_time)}</strong></div>{describeDetails(item.details).length > 0 && <div><span>Recorded changes</span><strong>{describeDetails(item.details).join(" · ")}</strong></div>}</div></td></tr>}
                    </Fragment>;
                  })}
                </tbody>
              </table>
            </div>

            <div className="activity-table-footer"><span>Showing {pagination.total ? (currentPage - 1) * pagination.per_page + 1 : 0}–{Math.min(currentPage * pagination.per_page, pagination.total)} of {pagination.total.toLocaleString()} matching events</span><div><button type="button" onClick={() => { setPage((value) => Math.max(1, value - 1)); setExpandedKey(""); }} disabled={currentPage <= 1} aria-label="Previous activity page"><ChevronLeft size={16} /></button><span>{currentPage} / {pageCount}</span><button type="button" onClick={() => { setPage((value) => Math.min(pageCount, value + 1)); setExpandedKey(""); }} disabled={currentPage >= pageCount} aria-label="Next activity page"><ChevronRight size={16} /></button></div></div>
            <p className="activity-feed-note"><Clock3 size={14} />Reconstructable creation records and existing moderation, stock, enforcement, and Staff application events are included. Earlier status changes without a stored event cannot be recovered; supported changes are recorded going forward.</p>
          </section>
        </>}
      </div>
    </AdminLayout>
  );
}

