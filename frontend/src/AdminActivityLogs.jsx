import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
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

const PAGE_SIZE = 5;
const FEED_LIMIT = 12;
const CATEGORY_DEFS = [
  { key: "user", label: "Account", color: "var(--tmc-admin-primary)" },
  { key: "product", label: "Product", color: "var(--tmc-admin-success)" },
  { key: "order", label: "Order", color: "var(--tmc-admin-warning)" },
  { key: "moderation", label: "Moderation", color: "var(--tmc-admin-info)" },
  { key: "complaint", label: "Complaint", color: "var(--tmc-admin-danger)" },
];

const PERIODS = [
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
  { value: "all", label: "All loaded events", days: null },
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

const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

function ActivityTrendChart({ events }) {
  const days = useMemo(() => {
    const byDay = new Map();
    events.forEach((event) => {
      const date = safeDate(event.date_time);
      if (!date) return;
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const day = byDay.get(key) || { key, date, label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }), counts: {} };
      const category = categoryFor(event.type).key;
      day.counts[category] = (day.counts[category] || 0) + 1;
      byDay.set(key, day);
    });
    return [...byDay.values()].sort((left, right) => left.date - right.date);
  }, [events]);
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

function CategoryDistribution({ events }) {
  const counts = CATEGORY_DEFS.map((category) => ({ ...category, count: events.filter((event) => categoryFor(event.type).key === category.key).length }));
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
        <div><h2>Events by Category</h2><p>Category counts from the loaded activity feed.</p></div>
      </div>
      <div className="activity-category-content">
        <div className="activity-category-ring" style={{ background: ring }} role="img" aria-label={`Distribution of ${total} loaded events by category`}>
          <div><strong>{total}</strong><span>Events shown</span></div>
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
  const [asOfTime, setAsOfTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("30d");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [sortBy, setSortBy] = useState("date_time");
  const [sortDirection, setSortDirection] = useState("desc");
  const [page, setPage] = useState(1);
  const [expandedKey, setExpandedKey] = useState("");

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
    return Array.isArray(data.stats && data.stats.recent_activity)
      ? data.stats.recent_activity.filter((item) => item && typeof item === "object").slice(0, FEED_LIMIT).map((item, index) => ({ ...item, __key: `${item.type || "event"}-${item.date_time || "undated"}-${item.user || "unknown"}-${item.action || index}-${index}` }))
      : [];
  }, []);

  const refreshLogs = async () => {
    setRefreshing(true);
    setError("");
    try {
      const nextLogs = await fetchLogs();
      if (nextLogs !== null) {
        setLogs(nextLogs);
        setAsOfTime(Date.now());
      }
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
        if (active && nextLogs !== null) {
          setLogs(nextLogs);
          setAsOfTime(Date.now());
        }
      })
      .catch((err) => {
        if (active) setError(err.message || "We could not load activity logs. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [fetchLogs]);

  const periodLabel = PERIODS.find((option) => option.value === period)?.label || "Last 30 days";
  const dateFilteredLogs = useMemo(() => {
    const days = PERIODS.find((option) => option.value === period)?.days;
    if (days == null) return logs;
    const end = asOfTime;
    if (!end) return [];
    const start = end - (days * 24 * 60 * 60 * 1000);
    return logs.filter((item) => {
      const date = safeDate(item.date_time);
      return date && date.getTime() >= start && date.getTime() <= end;
    });
  }, [asOfTime, logs, period]);

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = dateFilteredLogs.filter((item) => {
      const category = categoryFor(item.type);
      const haystack = [item.user, item.role, category.label, item.type, item.action, item.target, item.status, item.date_time].join(" ").toLowerCase();
      return (!query || haystack.includes(query))
        && (!categoryFilter || category.key === categoryFilter)
        && (!statusFilter || String(item.status || "unknown") === statusFilter)
        && (!actorFilter || String(item.user || "System") === actorFilter)
        && (!actionFilter || String(item.action || "Unknown action") === actionFilter);
    });
    const direction = sortDirection === "asc" ? 1 : -1;
    return filtered.map((item, index) => ({ item, index })).sort((left, right) => {
      const leftValue = sortBy === "date_time"
        ? (safeDate(left.item.date_time)?.getTime() || 0)
        : sortBy === "category"
          ? categoryFor(left.item.type).label
          : String(left.item[sortBy] || "").toLowerCase();
      const rightValue = sortBy === "date_time"
        ? (safeDate(right.item.date_time)?.getTime() || 0)
        : sortBy === "category"
          ? categoryFor(right.item.type).label
          : String(right.item[sortBy] || "").toLowerCase();
      const comparison = typeof leftValue === "number" ? leftValue - rightValue : leftValue.localeCompare(rightValue);
      return comparison ? comparison * direction : left.index - right.index;
    }).map(({ item }) => item);
  }, [actionFilter, actorFilter, categoryFilter, dateFilteredLogs, search, sortBy, sortDirection, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleLogs = filteredLogs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const categories = CATEGORY_DEFS.filter((category) => dateFilteredLogs.some((item) => categoryFor(item.type).key === category.key));
  const actors = [...new Set(dateFilteredLogs.map((item) => String(item.user || "System")))].sort((a, b) => a.localeCompare(b));
  const statuses = [...new Set(dateFilteredLogs.map((item) => String(item.status || "unknown")))].sort((a, b) => a.localeCompare(b));
  const actions = [...new Set(dateFilteredLogs.map((item) => String(item.action || "Unknown action")))].sort((a, b) => a.localeCompare(b));
  const countType = (types) => dateFilteredLogs.filter((item) => types.includes(categoryFor(item.type).key)).length;

  const clearFilters = () => {
    setPeriod("30d");
    setSearch("");
    setCategoryFilter("");
    setStatusFilter("");
    setActorFilter("");
    setActionFilter("");
    setSortBy("date_time");
    setSortDirection("desc");
    setPage(1);
    setExpandedKey("");
  };

  const changeSort = (key) => {
    if (sortBy === key) setSortDirection((direction) => direction === "asc" ? "desc" : "asc");
    else {
      setSortBy(key);
      setSortDirection(key === "date_time" ? "desc" : "asc");
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
    { label: "Events in feed", value: dateFilteredLogs.length, description: `Selected range · ${logs.length} max loaded`, icon: FileClock, color: "blue" },
    { label: "Account events", value: countType(["user"]), description: "Registrations in the loaded feed", icon: Users, color: "green" },
    { label: "Product events", value: countType(["product", "moderation"]), description: "Listings and moderation actions", icon: Package, color: "purple" },
    { label: "Order & complaint events", value: countType(["order", "complaint"]), description: "Orders and submitted complaints", icon: ShoppingBag, color: "orange" },
  ];

  return (
    <AdminLayout title="Activity Logs" subtitle="Review recent marketplace account, listing, order, and moderation activity.">
      <div className="activity-logs-page">
        <AdminPageHero
          title="Activity Logs"
          description="Review recorded account, product, order, moderation, and support activity across StudentMart."
          icon={FileClock}
          onRefresh={refreshLogs}
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
            <ActivityTrendChart events={dateFilteredLogs} />
            <CategoryDistribution events={dateFilteredLogs} />
          </section>

          <section className="activity-audit-panel" aria-labelledby="activity-audit-title">
            <div className="activity-audit-heading">
              <div><h2 id="activity-audit-title">Audit Log</h2><p>Read-only view of recent recorded events. The current API returns up to {FEED_LIMIT} latest entries.</p></div>
              <button type="button" className="activity-export-button" onClick={exportCsv} disabled={!filteredLogs.length}><Download size={15} />Export CSV</button>
            </div>

            <div className="activity-filter-toolbar">
              <label className="activity-search-control"><Search size={15} /><span className="activity-sr-only">Search actors, actions, or descriptions</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search actors, actions, or descriptions…" /></label>
              <label><span className="activity-sr-only">Filter by category</span><select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); }}><option value="">All categories</option>{categories.map((category) => <option value={category.key} key={category.key}>{category.label}</option>)}</select></label>
              <label><span className="activity-sr-only">Filter by record status</span><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}><option value="">All record statuses</option>{statuses.map((status) => <option value={status} key={status}>{readableStatus(status)}</option>)}</select></label>
              <label><span className="activity-sr-only">Filter by actor</span><select value={actorFilter} onChange={(event) => { setActorFilter(event.target.value); setPage(1); }}><option value="">All actors</option>{actors.map((actor) => <option value={actor} key={actor}>{actor}</option>)}</select></label>
              <label><span className="activity-sr-only">Filter by action</span><select value={actionFilter} onChange={(event) => { setActionFilter(event.target.value); setPage(1); }}><option value="">All actions</option>{actions.map((action) => <option value={action} key={action}>{action}</option>)}</select></label>
              <button type="button" className="activity-clear-button" onClick={clearFilters}><RotateCcw size={14} />Clear filters</button>
            </div>

            <div className="activity-table-wrap">
              <table className="activity-table">
                <thead><tr>
                  <th scope="col" aria-sort={sortBy === "user" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}><button type="button" onClick={() => changeSort("user")}>Actor <ArrowUpDown size={12} /></button></th>
                  <th scope="col" aria-sort={sortBy === "category" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}><button type="button" onClick={() => changeSort("category")}>Category <ArrowUpDown size={12} /></button></th>
                  <th scope="col" aria-sort={sortBy === "action" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}><button type="button" onClick={() => changeSort("action")}>Action / Description <ArrowUpDown size={12} /></button></th>
                  <th scope="col" aria-sort={sortBy === "date_time" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}><button type="button" onClick={() => changeSort("date_time")}>Date &amp; Time <ArrowUpDown size={12} /></button></th>
                  <th scope="col">Record Status</th><th scope="col">Actions</th>
                </tr></thead>
                <tbody>
                  {!loading && visibleLogs.length === 0 && <tr><td colSpan={6} className="activity-table-empty">{logs.length ? "No activity matches these filters." : error ? "Activity could not be loaded. Try refreshing the feed." : "No activity was returned by the current feed."}</td></tr>}
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
                      {isExpanded && <tr className="activity-details-row" key={`${item.__key}-details`}><td colSpan={6}><div className="activity-details-grid"><div><span>Actor role</span><strong>{readableStatus(item.role || "Unknown actor")}</strong></div><div><span>Category</span><strong>{category.label}</strong></div><div><span>Related record</span><strong>{item.target || "Not provided"}</strong></div><div><span>Record status</span><strong>{readableStatus(item.status)}</strong></div><div><span>Recorded at</span><strong>{formatDate(item.date_time)}</strong></div></div></td></tr>}
                    </Fragment>;
                  })}
                </tbody>
              </table>
            </div>

            <div className="activity-table-footer"><span>Showing {filteredLogs.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(currentPage * PAGE_SIZE, filteredLogs.length)} of {filteredLogs.length} loaded events{dateFilteredLogs.length < logs.length ? ` · ${periodLabel}` : ""}</span><div><button type="button" onClick={() => { setPage((value) => Math.max(1, value - 1)); setExpandedKey(""); }} disabled={currentPage <= 1} aria-label="Previous activity page"><ChevronLeft size={16} /></button><span>{currentPage} / {pageCount}</span><button type="button" onClick={() => { setPage((value) => Math.min(pageCount, value + 1)); setExpandedKey(""); }} disabled={currentPage >= pageCount} aria-label="Next activity page"><ChevronRight size={16} /></button></div></div>
            <p className="activity-feed-note"><Clock3 size={14} />Counts and charts reflect this latest activity feed, which is limited to {FEED_LIMIT} entries by the existing API. A complete historical audit trail would require a dedicated backend log source.</p>
          </section>
        </>}
      </div>
    </AdminLayout>
  );
}

