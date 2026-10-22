import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Search, Eye, MessageSquareWarning, ShieldAlert, CheckCircle2, XCircle } from "lucide-react";

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

export default function AdminComplaints() {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    in_review: 0,
    resolved: 0,
    rejected: 0,
  });

  const [complaints, setComplaints] = useState([]);
  const [sort, setSort] = useState({ key: "created_at", direction: "desc" });
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    total: 0,
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [statusDraft, setStatusDraft] = useState("pending");
  const [adminResponse, setAdminResponse] = useState("");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const toggleSort = (key) => setSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
  const sortedComplaints = sortRows(complaints, sort, (complaint, key) => ({
    id: complaint.id,
    student: complaint.student_name || complaint.student?.name,
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
    const response = await request("/admin/complaints/stats");
    setStats({
      total: Number(response?.stats?.total || 0),
      pending: Number(response?.stats?.pending || 0),
      in_review: Number(response?.stats?.in_review || 0),
      resolved: Number(response?.stats?.resolved || 0),
      rejected: Number(response?.stats?.rejected || 0),
    });
  }, [request]);

  const loadComplaints = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("per_page", "10");
      params.set("page", String(page));
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter) params.set("status", statusFilter);
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
  }, [page, request, search, statusFilter]);

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
      loadComplaints(true);
      loadStats();
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

  const handleRefresh = async () => {
    await loadData();
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
    if (saving || deleting) return;
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

  const handleDelete = async () => {
    if (!selectedComplaint) return;
    const confirmed = window.confirm("Are you sure you want to permanently delete this complaint?");
    if (!confirmed) return;
    setDeleting(true);
    setError("");
    try {
      await request(`/admin/complaints/${selectedComplaint.id}`, { method: "DELETE" });
      setSelectedComplaint(null);
      await Promise.all([loadStats(), loadComplaints(false)]);
    } catch (err) {
      setError(err.message || "Unable to delete the complaint.");
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return "—";
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return "—";
    return parsedDate.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
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

  return (
    <AdminLayout title="Complaints" subtitle="Review and manage marketplace complaints.">
      <div className="complaints-page">
        <AdminPageHero
          title="Complaints"
          description="Review student reports, manage investigations, and track complaint outcomes."
          icon={MessageSquareWarning}
          onRefresh={handleRefresh}
          refreshing={loading || refreshing}
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

        <section className="complaints-status-grid">
          {[
            { label: "Total Complaints", value: stats.total, icon: MessageSquareWarning, tone: "primary", subtitle: "All complaint records" },
            { label: "Pending", value: stats.pending, icon: AlertCircle, tone: "warning", subtitle: "Waiting for review" },
            { label: "In Review", value: stats.in_review, icon: ShieldAlert, tone: "info", subtitle: "Being reviewed now" },
            { label: "Resolved", value: stats.resolved, icon: CheckCircle2, tone: "success", subtitle: "Successfully resolved" },
            { label: "Rejected", value: stats.rejected, icon: XCircle, tone: "danger", subtitle: "Rejected complaints" },
          ].map((card, idx) => (
            <StatCard
              key={idx}
              label={card.label}
              value={card.value}
              icon={card.icon}
              tone={card.tone}
              subtitle={card.subtitle}
            />
          ))}
        </section>

        <section className="complaints-table-section">
          <div className="complaints-toolbar">
            <div className="complaints-search">
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={handleSearchChange}
                placeholder="Search complaints…"
                aria-label="Search complaints"
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
                subtitle={search || statusFilter ? "Try changing your search or filter." : "There are no complaints to review."}
              />
            ) : (
              <table className="complaints-table">
                <thead>
                  <tr>
                    <SortableHead field="id" sort={sort} onSort={toggleSort}>ID</SortableHead>
                    <SortableHead field="student" sort={sort} onSort={toggleSort}>Student</SortableHead>
                    <SortableHead field="subject" sort={sort} onSort={toggleSort}>Subject</SortableHead>
                    <SortableHead field="status" sort={sort} onSort={toggleSort}>Status</SortableHead>
                    <SortableHead field="created_at" sort={sort} onSort={toggleSort}>Submitted</SortableHead>
                    <th className="actions-column">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedComplaints.map((complaint) => (
                    <tr key={complaint.id}>
                      <td>#{complaint.id}</td>
                      <td className="complaint-student-cell">
                        <strong>{complaint.student_name || complaint.student?.name || "Unknown"}</strong>
                        <span>{complaint.student_email || complaint.student?.email || "—"}</span>
                      </td>
                      <td>
                        <div className="complaint-subject">
                          <strong>{complaint.subject || "No subject"}</strong>
                          <span>{complaint.description ? complaint.description.slice(0, 80) : ""}</span>
                        </div>
                      </td>
                      <td>
                        <Badge variant={badgeVariantForStatus(complaint.status)} size="sm">
                          {STATUS_LABELS[complaint.status] || complaint.status}
                        </Badge>
                      </td>
                      <td>{formatDate(complaint.created_at)}</td>
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
            <span>{pagination.total || 0} complaints · Page {pagination.current_page || 1} of {pagination.last_page || 1}</span>
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
                      <strong>{selectedComplaint.student_name || selectedComplaint.student?.name || "—"}</strong>
                    </div>
                    <div>
                      <span>Email</span>
                      <strong>{selectedComplaint.student_email || selectedComplaint.student?.email || "—"}</strong>
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

                    <div className="complaint-danger-actions">
                      <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleting}>
                        {deleting ? "Deleting…" : <><Trash2Icon size={16} aria-hidden="true" /> Delete Complaint</>}
                      </Button>
                    </div>
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

function Trash2Icon({ size = 16, ...props }) {
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
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
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
