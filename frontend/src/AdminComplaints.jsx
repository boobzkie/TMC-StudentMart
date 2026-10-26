import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, AlertCircle, CalendarDays, CheckCircle2, Eye, Info, ListFilter, MessageSquareWarning, RotateCcw, Search, ShieldAlert } from "lucide-react";

import AdminLayout from "./components/AdminLayout";
import AdminPageHero from "./components/AdminPageHero";
import { SortableHead } from "./ui/Table";
import { API_URL, sortRows } from "./utils/api";

import { Badge, Button, EmptyState, LoadingSpinner, StatCard } from "./ui";

import "./AdminComplaints.css";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "in_review", label: "In Review" },
  { value: "resolved", label: "Resolved" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_LABELS = {
  pending: "Pending",
  in_review: "In Review",
  resolved: "Resolved",
  rejected: "Rejected",
};

const PERIOD_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "6m", label: "Last 6 months" },
  { value: "12m", label: "Last 12 months" },
];

const COMPLAINT_STATUSES = [
  { key: "pending", label: "Pending", color: "var(--tmc-admin-warning)" },
  { key: "in_review", label: "In Review", color: "var(--tmc-admin-info)" },
  { key: "resolved", label: "Resolved", color: "var(--tmc-admin-success)" },
  { key: "rejected", label: "Rejected", color: "var(--tmc-admin-danger)" },
];

function ComplaintTrendChart({ points = [], periodLabel }) {
  const data = Array.isArray(points) ? points : [];
  const maxValue = Math.max(1, ...data.map((point) => Number(point.count) || 0));
  const xAt = (index) => data.length > 1 ? 42 + (index * 620) / (data.length - 1) : 352;
  const yAt = (value) => 162 - ((Number(value) || 0) / maxValue) * 124;
  const polyline = data.map((point, index) => `${xAt(index)},${yAt(point.count)}`).join(" ");
  const labelEvery = Math.max(1, Math.ceil(data.length / 7));
  const axisValues = [...new Set([0, Math.ceil(maxValue / 2), maxValue])];

  return (
    <article className="complaints-panel complaints-trend-panel">
      <div className="complaints-panel-heading">
        <span className="complaints-panel-icon"><Activity size={18} /></span>
        <div><h2>Complaints Over Time</h2><p>Complaint submissions recorded during {periodLabel.toLowerCase()}.</p></div>
      </div>
      {data.length ? <>
        <svg className="complaints-trend-chart" viewBox="0 0 700 190" role="img" aria-label={`Complaint submissions over ${periodLabel}`}>
          {axisValues.map((value) => {
            const y = yAt(value);
            return <g key={value}><line x1="42" y1={y} x2="662" y2={y} className="complaints-chart-gridline" /><text x="31" y={y + 4} textAnchor="end" className="complaints-chart-axis-label">{value}</text></g>;
          })}
          <polyline points={polyline} className="complaints-trend-line" />
          {data.map((point, index) => <g key={point.key || `${point.label}-${index}`}>
            <circle cx={xAt(index)} cy={yAt(point.count)} r="3.5" className="complaints-trend-point"><title>{`${point.label}: ${point.count} complaint${Number(point.count) === 1 ? "" : "s"}`}</title></circle>
            {(index === 0 || index === data.length - 1 || index % labelEvery === 0) && <text x={xAt(index)} y="184" textAnchor="middle" className="complaints-chart-axis-label">{point.label}</text>}
          </g>)}
        </svg>
      </> : <div className="complaints-chart-empty">No complaint submissions were recorded in this range.</div>}
    </article>
  );
}

function ComplaintStatusChart({ counts = {} }) {
  const total = Number(counts.total) || 0;
  let stop = 0;
  const ring = total > 0
    ? `conic-gradient(${COMPLAINT_STATUSES.map((status) => {
      const value = Number(counts[status.key]) || 0;
      const start = stop;
      stop += (value / total) * 100;
      return `${status.color} ${start}% ${stop}%`;
    }).join(", ")})`
    : "var(--tmc-admin-bg-muted)";

  return (
    <article className="complaints-panel complaints-status-chart-panel">
      <div className="complaints-panel-heading">
        <span className="complaints-panel-icon"><ListFilter size={18} /></span>
        <div><h2>Status Distribution</h2><p>Current statuses of complaints filed in this range.</p></div>
      </div>
      <div className="complaints-status-chart-content">
        <div className="complaints-status-ring" style={{ background: ring }} role="img" aria-label={`Status distribution across ${total} complaints`}>
          <div><strong>{total.toLocaleString()}</strong><span>Complaints</span></div>
        </div>
        <div className="complaints-status-legend">
          {COMPLAINT_STATUSES.map((status) => {
            const value = Number(counts[status.key]) || 0;
            const percentage = total ? Math.round((value / total) * 100) : 0;
            return <div key={status.key}><i style={{ background: status.color }} /><span>{status.label}</span><strong>{value.toLocaleString()}</strong><small>{percentage}%</small></div>;
          })}
        </div>
      </div>
    </article>
  );
}

export default function AdminComplaints() {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    in_review: 0,
    resolved: 0,
    rejected: 0,
    period: { counts: { total: 0, pending: 0, in_review: 0, resolved: 0, rejected: 0 }, previous_counts: {} },
    over_time: [],
  });

  const [period, setPeriod] = useState("30d");

  const [complaints, setComplaints] = useState([]);
  const [sort, setSort] = useState({ key: "created_at", direction: "desc" });
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    total: 0,
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [relatedProductFilter, setRelatedProductFilter] = useState("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [statusDraft, setStatusDraft] = useState("pending");
  const [adminResponse, setAdminResponse] = useState("");

  const [saving, setSaving] = useState(false);

  const toggleSort = (key) => setSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
  const sortedComplaints = sortRows(complaints, sort, (complaint, key) => ({
    id: complaint.id,
    student: complaint.user?.name || complaint.student_name,
    subject: complaint.subject,
    status: complaint.status,
    created_at: complaint.created_at,
  })[key]);

  const getToken = () => {
    return localStorage.getItem("token");
  };

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  }, [navigate]);

  const request = useCallback(
    async (url, options = {}) => {
      const token = getToken();

      if (!token) {
        handleUnauthorized();
        throw new Error("Authentication required.");
      }

      const response = await fetch(`${API_URL}${url}`, {
        ...options,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...(options.headers || {}),
        },
      });

      if (response.status === 401 || response.status === 403) {
        handleUnauthorized();
        throw new Error("You are not authorized to access this page.");
      }

      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(data?.message || data?.error || "The server could not complete the request.");
      }

      return data;
    },
    [handleUnauthorized]
  );

  const loadStats = useCallback(async () => {
    const response = await request(`/admin/complaints/stats?period=${encodeURIComponent(period)}`);
    setStats({
      total: Number(response?.stats?.total || 0),
      pending: Number(response?.stats?.pending || 0),
      in_review: Number(response?.stats?.in_review || 0),
      resolved: Number(response?.stats?.resolved || 0),
      rejected: Number(response?.stats?.rejected || 0),
      period: response?.stats?.period || { counts: { total: 0, pending: 0, in_review: 0, resolved: 0, rejected: 0 }, previous_counts: {} },
      over_time: Array.isArray(response?.stats?.over_time) ? response.stats.over_time : [],
    });
  }, [period, request]);

  const loadComplaints = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("per_page", "10");
      params.set("page", String(page));
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter) params.set("status", statusFilter);
      params.set("period", period);
      if (relatedProductFilter) params.set("related_product", relatedProductFilter);
      params.set("sort_by", sort.key);
      params.set("sort_direction", sort.direction);
      const response = await request(`/admin/complaints?${params.toString()}`);
      const paginatedData = response?.data;
      setComplaints(Array.isArray(paginatedData?.data) ? paginatedData.data : []);
      setPagination({
        current_page: Number(paginatedData?.current_page || 1),
        last_page: Number(paginatedData?.last_page || 1),
        total: Number(paginatedData?.total || 0),
      });
    } catch (err) {
      setError(err.message || "Unable to load complaint records.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, period, relatedProductFilter, request, search, sort, statusFilter]);

  const loadData = useCallback(async () => {
    setRefreshing(true);
    setError("");
    try {
      await Promise.all([loadStats(), loadComplaints(false)]);
    } catch (err) {
      setError(err.message || "Unable to load complaint information.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadComplaints, loadStats]);

  useEffect(() => {
    const timer = setTimeout(() => {
      Promise.all([loadComplaints(true), loadStats()]).catch((err) => {
        setError(err.message || "Unable to load complaint information.");
        setLoading(false);
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [loadComplaints, loadStats]);

  const handleSearchChange = (event) => {
    setPage(1);
    setSearch(event.target.value);
  };

  const handleStatusChange = (event) => {
    setPage(1);
    setStatusFilter(event.target.value);
  };

  const handleRelatedProductChange = (event) => {
    setPage(1);
    setRelatedProductFilter(event.target.value);
  };

  const handleRefresh = async () => {
    await loadData();
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setRelatedProductFilter("");
    setPeriod("30d");
    setSort({ key: "created_at", direction: "desc" });
    setPage(1);
  };

  const openComplaint = async (complaint) => {
    setSelectedComplaint(complaint);
    setStatusDraft(complaint.status || "pending");
    setAdminResponse(complaint.admin_response || "");
    setDetailsLoading(true);
    setError("");
    try {
      const response = await request(`/admin/complaints/${complaint.id}`);
      let details = response?.data || complaint;
      if (details.status === "pending") {
        const reviewResponse = await request(`/admin/complaints/${details.id}`, {
          method: "PUT",
          body: JSON.stringify({ status: "in_review" }),
        });
        details = reviewResponse?.data || { ...details, status: "in_review" };
      }
      setSelectedComplaint(details);
      setStatusDraft(details.status || "pending");
      setAdminResponse(details.admin_response || "");
    } catch (err) {
      setError(err.message || "Unable to load complaint details.");
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeComplaint = () => {
    if (saving) return;
    setSelectedComplaint(null);
    setDetailsLoading(false);
  };

  const handleSave = async () => {
    if (!selectedComplaint) return;
    if (statusDraft === "rejected" && adminResponse.trim().length < 5) {
      setError("Enter a response of at least five characters before rejecting a complaint.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await request(`/admin/complaints/${selectedComplaint.id}`, {
        method: "PUT",
        body: JSON.stringify({
          status: statusDraft,
          admin_response: adminResponse.trim() || null,
        }),
      });
      const updatedComplaint = response?.data || {
        ...selectedComplaint,
        status: statusDraft,
        admin_response: adminResponse.trim() || null,
      };
      setSelectedComplaint(updatedComplaint);
      await Promise.all([loadStats(), loadComplaints(false)]);
    } catch (err) {
      setError(err.message || "Unable to update the complaint.");
    } finally {
      setSaving(false);
    }
  };

  const formatDateTime = (date) => {
    if (!date) return "—";
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return "—";
    return parsedDate.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  };

  const badgeVariantForStatus = (status) => {
    const variants = {
      pending: "warning",
      in_review: "info",
      resolved: "success",
      rejected: "danger",
    };
    return variants[status] || "neutral";
  };

  const periodLabel = PERIOD_OPTIONS.find((option) => option.value === period)?.label || "Last 30 days";
  const periodCounts = stats.period?.counts || { total: 0, pending: 0, in_review: 0, resolved: 0, rejected: 0 };
  const previousCounts = stats.period?.previous_counts || {};
  const compareWithPrevious = (key) => {
    const current = Number(periodCounts[key]) || 0;
    const previous = Number(previousCounts[key]) || 0;
    if (previous === 0) return current === 0 ? "No records in prior period" : "New in this period";
    const change = Math.round(((current - previous) / previous) * 100);
    return `${change > 0 ? "+" : ""}${change}% vs previous period`;
  };
  const summaryCards = [
    { label: "Total Complaints", key: "total", icon: MessageSquareWarning, tone: "primary", subtitle: `Submitted ${periodLabel.toLowerCase()}` },
    { label: "Needs Attention", key: "pending", icon: AlertCircle, tone: "warning", subtitle: "Pending complaints in range" },
    { label: "Under Investigation", key: "in_review", icon: ShieldAlert, tone: "info", subtitle: "Currently in review" },
    { label: "Resolved", key: "resolved", icon: CheckCircle2, tone: "success", subtitle: "Successfully closed" },
  ];

  return (
    <AdminLayout title="Complaints" subtitle="Review reports, manage investigations, and track complaint outcomes.">
      <div className="complaints-page">
        <AdminPageHero
          title="Complaints"
          description="Review reports, investigate concerns, and track complaint outcomes."
          icon={MessageSquareWarning}
          onRefresh={handleRefresh}
          refreshing={loading || refreshing}
          sideContent={(
            <label className="complaints-period-select">
              <CalendarDays size={16} aria-hidden="true" />
              <span className="complaints-sr-only">Complaint submission date range</span>
              <select value={period} onChange={(event) => { setPeriod(event.target.value); setPage(1); }} aria-label="Complaint submission date range">
                {PERIOD_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
              </select>
            </label>
          )}
        />

        {error && (
          <div className="complaints-error" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <div>
              <strong>Unable to load complaints</strong>
              <span>{error}</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              Try again
            </Button>
          </div>
        )}

        <div className="complaints-management-banner">
          <span><MessageSquareWarning size={22} /></span>
          <div><strong>Complaint Management</strong><p>Review reports, investigate concerns, and track resolution outcomes.</p></div>
        </div>

        <section className="complaints-status-grid" aria-label={`Complaint summary for ${periodLabel}`}>
          {summaryCards.map((card) => (
            <StatCard
              key={card.key}
              label={card.label}
              value={Number(periodCounts[card.key] || 0).toLocaleString()}
              icon={card.icon}
              tone={card.tone}
              subtitle={<>{card.subtitle}<span className="complaints-period-delta">{compareWithPrevious(card.key)}</span></>}
            />
          ))}
        </section>

        <section className="complaints-analytics-grid" aria-label="Complaint analytics">
          <ComplaintTrendChart points={stats.over_time} periodLabel={periodLabel} />
          <ComplaintStatusChart counts={periodCounts} />
        </section>

        <section className="complaints-table-section">
          <div className="complaints-table-heading">
            <div><h2>Complaint Records</h2><p>Search and review complaints submitted in the selected range.</p></div>
            <Button variant="outline" size="sm" onClick={clearFilters}><RotateCcw size={14} aria-hidden="true" /> Clear filters</Button>
          </div>
          <div className="complaints-toolbar">
            <div className="complaints-search">
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={handleSearchChange}
                placeholder="Search by ID, reporter, subject, or product…"
                aria-label="Search by complaint ID, reporter, subject, or product"
              />
            </div>
            <select
              className="complaints-filter-select"
              value={statusFilter}
              onChange={handleStatusChange}
              aria-label="Filter by status"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select className="complaints-filter-select" value={relatedProductFilter} onChange={handleRelatedProductChange} aria-label="Filter by product association">
              <option value="">Any product association</option>
              <option value="linked">Linked product</option>
              <option value="unlinked">No linked product</option>
            </select>
            <select className="complaints-filter-select" value={`${sort.key}:${sort.direction}`} onChange={(event) => {
              const [key, direction] = event.target.value.split(":");
              setSort({ key, direction });
              setPage(1);
            }} aria-label="Sort complaints">
              <option value="created_at:desc">Newest first</option>
              <option value="created_at:asc">Oldest first</option>
              <option value="subject:asc">Subject A–Z</option>
              <option value="status:asc">Status A–Z</option>
            </select>
          </div>

          <div className="complaints-table-wrap">
            {loading ? (
              <div className="complaints-loading">
                <LoadingSpinner size="sm" />
                <p>Loading complaints…</p>
              </div>
            ) : complaints.length === 0 ? (
              <EmptyState
                icon={() => null}
                title="No complaints found"
                subtitle={search || statusFilter || relatedProductFilter ? "Try changing your search or filters." : `There are no complaints for ${periodLabel.toLowerCase()}.`}
              />
            ) : (
              <table className="complaints-table">
                <thead>
                  <tr>
                    <SortableHead field="id" sort={sort} onSort={toggleSort}>Case ID</SortableHead>
                    <SortableHead field="subject" sort={sort} onSort={toggleSort}>Complaint</SortableHead>
                    <SortableHead field="student" sort={sort} onSort={toggleSort}>Reported by</SortableHead>
                    <th>Related product</th>
                    <SortableHead field="created_at" sort={sort} onSort={toggleSort}>Submitted</SortableHead>
                    <SortableHead field="status" sort={sort} onSort={toggleSort}>Status</SortableHead>
                    <th className="actions-column">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedComplaints.map((complaint) => (
                    <tr key={complaint.id}>
                      <td className="complaint-case-id">CMP-{String(complaint.id).padStart(6, "0")}</td>
                      <td>
                        <div className="complaint-subject">
                          <strong>{complaint.subject || "No subject"}</strong>
                          <span>{complaint.description ? complaint.description.slice(0, 80) : ""}</span>
                        </div>
                      </td>
                      <td className="complaint-student-cell">
                        <strong>{complaint.user?.name || complaint.student_name || "Unknown reporter"}</strong>
                        <span>{complaint.user?.student_id || complaint.user?.email || "—"}</span>
                      </td>
                      <td>{complaint.product?.name || "No linked product"}</td>
                      <td>{formatDateTime(complaint.created_at)}</td>
                      <td>
                        <Badge variant={badgeVariantForStatus(complaint.status)} size="sm">
                          {STATUS_LABELS[complaint.status] || complaint.status}
                        </Badge>
                      </td>
                      <td className="actions-cell">
                        <Button variant="outline" size="sm" onClick={() => openComplaint(complaint)} aria-label={`View complaint #${complaint.id}`}>
                          <Eye size={14} aria-hidden="true" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="complaints-pagination">
            <span>Showing {pagination.total ? ((pagination.current_page - 1) * 10) + 1 : 0}–{Math.min(pagination.current_page * 10, pagination.total || 0)} of {pagination.total || 0} complaints</span>
            <div>
              <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>
                <ChevronLeftIcon size={15} aria-hidden="true" /> Previous
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(pagination.last_page || 1, current + 1))} disabled={page >= (pagination.last_page || 1)}>
                Next <ChevronRightIcon size={15} aria-hidden="true" />
              </Button>
            </div>
          </div>
        </section>

        <div className="complaints-data-note" role="note">
          <Info size={16} aria-hidden="true" />
          <span>Metrics and charts use complaint submission dates and the current record statuses. The complaint data has no category or priority field, so the dashboard shows its actual status distribution instead.</span>
        </div>

        {selectedComplaint && (
          <div className="complaint-detail-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeComplaint(); }}>
            <section className="complaint-detail-modal" role="dialog" aria-modal="true" aria-labelledby="complaint-detail-title">
              <header className="complaint-modal-header">
                <div>
                  <span className="complaint-modal-eyebrow">Complaint Details</span>
                  <h2 id="complaint-detail-title">{selectedComplaint.subject || "Complaint"}</h2>
                  <Badge variant={badgeVariantForStatus(selectedComplaint.status)} size="sm">
                    {STATUS_LABELS[selectedComplaint.status] || selectedComplaint.status}
                  </Badge>
                </div>
                <button type="button" onClick={closeComplaint} aria-label="Close details">×</button>
              </header>

              {detailsLoading && (
                <div className="complaint-loading-state">
                  <LoadingSpinner size="sm" />
                  <p>Loading complaint details…</p>
                </div>
              )}

              {!detailsLoading && (
                <>
                  <div className="complaint-detail-grid">
                    <div>
                      <span>Student</span>
                      <strong>{selectedComplaint.user?.name || selectedComplaint.student_name || "—"}</strong>
                    </div>
                    <div>
                      <span>Email</span>
                      <strong>{selectedComplaint.user?.email || selectedComplaint.student_email || "—"}</strong>
                    </div>
                    <div>
                      <span>Related product</span>
                      <strong>{selectedComplaint.product?.name || "No linked product"}</strong>
                    </div>
                    <div>
                      <span>Subject</span>
                      <strong>{selectedComplaint.subject || "—"}</strong>
                    </div>
                    <div>
                      <span>Status</span>
                      <strong>{STATUS_LABELS[selectedComplaint.status] || selectedComplaint.status}</strong>
                    </div>
                    <div>
                      <span>Submitted</span>
                      <strong>{formatDateTime(selectedComplaint.created_at)}</strong>
                    </div>
                    <div>
                      <span>Updated</span>
                      <strong>{formatDateTime(selectedComplaint.updated_at)}</strong>
                    </div>
                  </div>

                  <div className="complaint-description-section">
                    <h3>Description</h3>
                    <p>{selectedComplaint.description || "No description provided."}</p>
                  </div>

                  <div className="complaint-action-section">
                    <h3>Update Status &amp; Response</h3>
                    <div className="complaint-action-form">
                      <label>
                        Status
                        <select
                          value={statusDraft}
                          onChange={(event) => setStatusDraft(event.target.value)}
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Admin Response
                        <textarea
                          value={adminResponse}
                          onChange={(event) => setAdminResponse(event.target.value)}
                          placeholder="Enter your response to the student…"
                          rows={4}
                        />
                      </label>
                      {statusDraft === "rejected" && (
                        <p className="complaint-reject-note">A response of at least 5 characters is required when rejecting.</p>
                      )}
                      <div className="complaint-action-buttons">
                        <Button variant="outline" size="sm" onClick={closeComplaint} disabled={saving}>
                          Cancel
                        </Button>
                        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
                          {saving ? "Saving…" : "Save Changes"}
                        </Button>
                      </div>
                    </div>

                    {selectedComplaint.admin_response && (
                      <div className="complaint-admin-response">
                        <h3>Admin Response</h3>
                        <p>{selectedComplaint.admin_response}</p>
                      </div>
                    )}

                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function ChevronLeftIcon({ size = 15, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon({ size = 15, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
