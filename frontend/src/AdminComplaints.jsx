import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  Loader2,
  MessageSquareWarning,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import AdminLayout from "./components/AdminLayout";
import { API_URL } from "./utils/api";
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

function AdminComplaints() {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    in_review: 0,
    resolved: 0,
    rejected: 0,
  });

  const [complaints, setComplaints] = useState([]);
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

  const [selectedComplaint, setSelectedComplaint] =
    useState(null);

  const [detailsLoading, setDetailsLoading] =
    useState(false);

  const [statusDraft, setStatusDraft] =
    useState("pending");

  const [adminResponse, setAdminResponse] =
    useState("");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const getToken = () => {
    return localStorage.getItem("token");
  };

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");

    navigate("/login", {
      replace: true,
    });
  }, [navigate]);

  const request = useCallback(
    async (url, options = {}) => {
      const token = getToken();

      if (!token) {
        handleUnauthorized();
        throw new Error("Authentication required.");
      }

      const response = await fetch(
        `${API_URL}${url}`,
        {
          ...options,
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
            ...(options.body
              ? {
                  "Content-Type":
                    "application/json",
                }
              : {}),
            ...(options.headers || {}),
          },
        }
      );

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        handleUnauthorized();

        throw new Error(
          "You are not authorized to access this page."
        );
      }

      let data = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            "The server could not complete the request."
        );
      }

      return data;
    },
    [handleUnauthorized]
  );

  const loadStats = useCallback(async () => {
    const response = await request(
      "/admin/complaints/stats"
    );

    setStats({
      total: Number(response?.stats?.total || 0),
      pending: Number(response?.stats?.pending || 0),
      in_review: Number(
        response?.stats?.in_review || 0
      ),
      resolved: Number(
        response?.stats?.resolved || 0
      ),
      rejected: Number(
        response?.stats?.rejected || 0
      ),
    });
  }, [request]);

  const loadComplaints = useCallback(
    async (showLoader = true) => {
      if (showLoader) {
        setLoading(true);
      }

      setError("");

      try {
        const params = new URLSearchParams();

        params.set("per_page", "10");
        params.set("page", String(page));

        if (search.trim()) {
          params.set(
            "search",
            search.trim()
          );
        }

        if (statusFilter) {
          params.set(
            "status",
            statusFilter
          );
        }

        const response = await request(
          `/admin/complaints?${params.toString()}`
        );

        const paginatedData = response?.data;

        setComplaints(
          Array.isArray(
            paginatedData?.data
          )
            ? paginatedData.data
            : []
        );

        setPagination({
          current_page: Number(
            paginatedData?.current_page || 1
          ),
          last_page: Number(
            paginatedData?.last_page || 1
          ),
          total: Number(
            paginatedData?.total || 0
          ),
        });
      } catch (err) {
        setError(
          err.message ||
            "Unable to load complaint records."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      page,
      request,
      search,
      statusFilter,
    ]
  );

  const loadData = useCallback(async () => {
    setRefreshing(true);
    setError("");

    try {
      await Promise.all([
        loadStats(),
        loadComplaints(false),
      ]);
    } catch (err) {
      setError(
        err.message ||
          "Unable to load complaint information."
      );
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

    return () => {
      clearTimeout(timer);
    };
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

    setStatusDraft(
      complaint.status || "pending"
    );

    setAdminResponse(
      complaint.admin_response || ""
    );

    setDetailsLoading(true);
    setError("");

    try {
      const response = await request(
        `/admin/complaints/${complaint.id}`
      );

      let details = response?.data || complaint;
      if (details.status === "pending") {
        const reviewResponse = await request(
          `/admin/complaints/${details.id}`,
          { method: "PUT", body: JSON.stringify({ status: "in_review" }) }
        );
        details = reviewResponse?.data || { ...details, status: "in_review" };
      }

      setSelectedComplaint(details);

      setStatusDraft(
        details.status || "pending"
      );

      setAdminResponse(
        details.admin_response || ""
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to load complaint details."
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeComplaint = () => {
    if (saving || deleting) {
      return;
    }

    setSelectedComplaint(null);
    setDetailsLoading(false);
  };

  const handleSave = async () => {
    if (!selectedComplaint) {
      return;
    }
    if (statusDraft === "rejected" && adminResponse.trim().length < 5) {
      setError("Enter a response of at least five characters before rejecting a complaint.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await request(
        `/admin/complaints/${selectedComplaint.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            status: statusDraft,
            admin_response:
              adminResponse.trim() || null,
          }),
        }
      );

      const updatedComplaint =
        response?.data || {
          ...selectedComplaint,
          status: statusDraft,
          admin_response:
            adminResponse.trim() || null,
        };

      setSelectedComplaint(
        updatedComplaint
      );

      await Promise.all([
        loadStats(),
        loadComplaints(false),
      ]);
    } catch (err) {
      setError(
        err.message ||
          "Unable to update the complaint."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedComplaint) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this complaint?"
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError("");

    try {
      await request(
        `/admin/complaints/${selectedComplaint.id}`,
        {
          method: "DELETE",
        }
      );

      setSelectedComplaint(null);

      await Promise.all([
        loadStats(),
        loadComplaints(false),
      ]);
    } catch (err) {
      setError(
        err.message ||
          "Unable to delete the complaint."
      );
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (date) => {
    if (!date) {
      return "—";
    }

    const parsedDate = new Date(date);

    if (
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {
      return "—";
    }

    return parsedDate.toLocaleDateString(
      undefined,
      {
        year: "numeric",
        month: "short",
        day: "numeric",
      }
    );
  };

  const formatDateTime = (date) => {
    if (!date) {
      return "—";
    }

    const parsedDate = new Date(date);

    if (
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {
      return "—";
    }

    return parsedDate.toLocaleString(
      undefined,
      {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }
    );
  };

  const getStatusClass = (status) => {
    return `status-${status || "pending"}`;
  };

  return (
    <AdminLayout
      title="Complaints"
      subtitle="Review and manage marketplace complaints."
    >
      <div className="complaints-page">
        <section className="complaints-hero">
          <div className="complaints-hero-icon">
            <MessageSquareWarning
              size={25}
            />
          </div>

          <div className="complaints-hero-content">
            <span>ADMIN MANAGEMENT</span>

            <h1>
              Complaints Management
            </h1>

            <p>
              Review student complaints and
              marketplace issues from one
              centralized administration page.
            </p>
          </div>

          <button
            type="button"
            className="complaints-refresh-button"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              size={16}
              className={
                refreshing
                  ? "complaints-spin"
                  : ""
              }
            />

            {refreshing
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </section>

        {error && (
          <div className="complaints-error">
            <AlertCircle size={18} />

            <span>{error}</span>
          </div>
        )}

        <section className="complaints-status-grid">
          <article className="complaints-status-card">
            <div className="complaints-status-icon blue">
              <MessageSquareWarning
                size={20}
              />
            </div>

            <span>Total Complaints</span>

            <strong>{stats.total}</strong>

            <small>
              All complaint records
            </small>
          </article>

          <article className="complaints-status-card">
            <div className="complaints-status-icon orange">
              <AlertCircle size={20} />
            </div>

            <span>Pending</span>

            <strong>
              {stats.pending}
            </strong>

            <small>
              Waiting for review
            </small>
          </article>

          <article className="complaints-status-card">
            <div className="complaints-status-icon purple">
              <ShieldAlert size={20} />
            </div>

            <span>In Review</span>

            <strong>
              {stats.in_review}
            </strong>

            <small>
              Currently being investigated
            </small>
          </article>

          <article className="complaints-status-card">
            <div className="complaints-status-icon green">
              <CheckCircle2 size={20} />
            </div>

            <span>Resolved</span>

            <strong>
              {stats.resolved}
            </strong>

            <small>
              Successfully resolved
            </small>
          </article>
        </section>

        <section className="complaints-panel">
          <div className="complaints-panel-header">
            <div>
              <span>
                COMPLAINT DATABASE
              </span>

              <h2>
                Complaint Records
              </h2>

              <p>
                Search, review, update, and
                manage actual complaint records
                from the database.
              </p>
            </div>

            <div className="complaints-panel-icon">
              <MessageSquareWarning
                size={19}
              />
            </div>
          </div>

          <div className="complaints-toolbar">
            <div className="complaints-search">
              <Search size={18} />

              <input
                type="text"
                value={search}
                onChange={
                  handleSearchChange
                }
                placeholder="Search complaints, students, or products..."
              />
            </div>

            <select
              className="complaints-filter"
              value={statusFilter}
              onChange={
                handleStatusChange
              }
              aria-label="Filter complaints by status"
            >
              {STATUS_OPTIONS.map(
                (option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>
          </div>

          {loading ? (
            <div className="complaints-loading">
              <Loader2
                size={30}
                className="complaints-spin"
              />

              <span>
                Loading complaint records...
              </span>
            </div>
          ) : complaints.length === 0 ? (
            <div className="complaints-empty">
              <div className="complaints-empty-icon">
                <ShieldAlert
                  size={32}
                />
              </div>

              <h3>
                No Complaint Records Found
              </h3>

              <p>
                There are no complaint records
                matching your current search
                or filter.
              </p>
            </div>
          ) : (
            <>
              <div className="complaints-table-wrapper">
                <table className="complaints-table">
                  <thead>
                    <tr>
                      <th>
                        Complaint
                      </th>

                      <th>
                        Student
                      </th>

                      <th>
                        Product
                      </th>

                      <th>
                        Status
                      </th>

                      <th>
                        Date
                      </th>

                      <th>
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {complaints.map(
                      (complaint) => (
                        <tr
                          key={
                            complaint.id
                          }
                        >
                          <td>
                            <div className="complaint-title-cell">
                              <strong>
                                {complaint.subject ||
                                  "Untitled Complaint"}
                              </strong>

                              <span>
                                #
                                {
                                  complaint.id
                                }
                              </span>
                            </div>
                          </td>

                          <td>
                            <div className="complaint-person-cell">
                              <strong>
                                {complaint
                                  .user
                                  ?.name ||
                                  "Unknown Student"}
                              </strong>

                              <span>
                                {complaint
                                  .user
                                  ?.student_id ||
                                  complaint
                                    .user
                                    ?.email ||
                                  "—"}
                              </span>
                            </div>
                          </td>

                          <td>
                            {complaint
                              .product
                              ?.name ||
                              "General Complaint"}
                          </td>

                          <td>
                            <span
                              className={`complaint-status ${getStatusClass(
                                complaint.status
                              )}`}
                            >
                              {STATUS_LABELS[
                                complaint
                                  .status
                              ] ||
                                complaint.status ||
                                "Pending"}
                            </span>
                          </td>

                          <td>
                            {formatDate(
                              complaint.created_at
                            )}
                          </td>

                          <td>
                            <button
                              type="button"
                              className="complaint-view-button"
                              onClick={() =>
                                openComplaint(
                                  complaint
                                )
                              }
                            >
                              <Eye size={16} />
                              View
                            </button>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              <div className="complaints-pagination">
                <span>
                  Showing{" "}
                  {complaints.length} of{" "}
                  {pagination.total}{" "}
                  complaints
                </span>

                <div className="complaints-pagination-buttons">
                  <button
                    type="button"
                    onClick={() =>
                      setPage(
                        (current) =>
                          Math.max(
                            1,
                            current - 1
                          )
                      )
                    }
                    disabled={
                      pagination.current_page <=
                      1
                    }
                  >
                    Previous
                  </button>

                  <span>
                    Page{" "}
                    {
                      pagination.current_page
                    }{" "}
                    of{" "}
                    {
                      pagination.last_page
                    }
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setPage(
                        (current) =>
                          Math.min(
                            pagination.last_page,
                            current + 1
                          )
                      )
                    }
                    disabled={
                      pagination.current_page >=
                      pagination.last_page
                    }
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        {selectedComplaint && (
          <div
            className="complaint-modal-backdrop"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeComplaint();
              }
            }}
          >
            <div
              className="complaint-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="complaint-modal-title"
            >
              <div className="complaint-modal-header">
                <div>
                  <span>
                    COMPLAINT #
                    {
                      selectedComplaint.id
                    }
                  </span>

                  <h2 id="complaint-modal-title">
                    Complaint Details
                  </h2>
                </div>

                <button
                  type="button"
                  className="complaint-modal-close"
                  onClick={
                    closeComplaint
                  }
                  disabled={
                    saving || deleting
                  }
                  aria-label="Close complaint details"
                >
                  <X size={19} />
                </button>
              </div>

              {detailsLoading ? (
                <div className="complaint-modal-loading">
                  <Loader2
                    size={28}
                    className="complaints-spin"
                  />

                  <span>
                    Loading complaint details...
                  </span>
                </div>
              ) : (
                <div className="complaint-modal-body">
                  <div className="complaint-detail-grid">
                    <div className="complaint-detail-item">
                      <span>
                        Subject
                      </span>

                      <strong>
                        {
                          selectedComplaint.subject ||
                          "—"
                        }
                      </strong>
                    </div>

                    <div className="complaint-detail-item">
                      <span>
                        Submitted
                      </span>

                      <strong>
                        {formatDateTime(
                          selectedComplaint.created_at
                        )}
                      </strong>
                    </div>

                    <div className="complaint-detail-item">
                      <span>
                        Student
                      </span>

                      <strong>
                        {selectedComplaint
                          .user?.name ||
                          "Unknown Student"}
                      </strong>
                    </div>

                    <div className="complaint-detail-item">
                      <span>
                        Student ID
                      </span>

                      <strong>
                        {selectedComplaint
                          .user
                          ?.student_id ||
                          "—"}
                      </strong>
                    </div>

                    <div className="complaint-detail-item">
                      <span>
                        Email
                      </span>

                      <strong>
                        {selectedComplaint
                          .user?.email ||
                          "—"}
                      </strong>
                    </div>

                    <div className="complaint-detail-item">
                      <span>
                        Product
                      </span>

                      <strong>
                        {selectedComplaint
                          .product?.name ||
                          "General Complaint"}
                      </strong>
                    </div>
                  </div>

                  <div className="complaint-description">
                    <span>
                      Description
                    </span>

                    <p>
                      {selectedComplaint.description ||
                        "No description provided."}
                    </p>
                  </div>

                  <div className="complaint-form-grid">
                    <label className="complaint-field">
                      <span>
                        Complaint Status
                      </span>

                      <select
                        value={
                          statusDraft
                        }
                        onChange={(
                          event
                        ) =>
                          setStatusDraft(
                            event.target
                              .value
                          )
                        }
                        disabled={saving}
                      >
                        {STATUS_OPTIONS.filter(
                          (option) =>
                            option.value !== "" &&
                            (option.value === selectedComplaint.status ||
                              (selectedComplaint.status === "pending" && option.value === "in_review") ||
                              (selectedComplaint.status === "in_review" && ["resolved", "rejected"].includes(option.value)))
                        ).map(
                          (option) => (
                            <option
                              key={
                                option.value
                              }
                              value={
                                option.value
                              }
                            >
                              {
                                option.label
                              }
                            </option>
                          )
                        )}
                      </select>
                    </label>

                    <div className="complaint-current-status">
                      <span>
                        Current Status
                      </span>

                      <strong
                        className={`complaint-status ${getStatusClass(
                          selectedComplaint.status
                        )}`}
                      >
                        {STATUS_LABELS[
                          selectedComplaint
                            .status
                        ] ||
                          selectedComplaint.status ||
                          "Pending"}
                      </strong>
                    </div>
                  </div>

                  <label className="complaint-field">
                    <span>
                      Administrator Response
                    </span>

                    <textarea
                      value={
                        adminResponse
                      }
                      onChange={(
                        event
                      ) =>
                        setAdminResponse(
                          event.target
                            .value
                        )
                      }
                      placeholder="Enter a response for the student..."
                      maxLength={5000}
                      disabled={saving}
                      rows={5}
                    />

                    <small>
                      {
                        adminResponse.length
                      }
                      /5000
                    </small>
                  </label>

                  {selectedComplaint.resolved_at && (
                    <div className="complaint-resolved-note">
                      <CheckCircle2
                        size={17}
                      />

                      <span>
                        Resolved on{" "}
                        {formatDateTime(
                          selectedComplaint.resolved_at
                        )}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {!detailsLoading && (
                <div className="complaint-modal-footer">
                  <button
                    type="button"
                    className="complaint-delete-button"
                    onClick={
                      handleDelete
                    }
                    disabled={
                      saving ||
                      deleting
                    }
                  >
                    {deleting ? (
                      <Loader2
                        size={16}
                        className="complaints-spin"
                      />
                    ) : (
                      <Trash2
                        size={16}
                      />
                    )}

                    Delete
                  </button>

                  <div className="complaint-modal-actions">
                    <button
                      type="button"
                      className="complaint-cancel-button"
                      onClick={
                        closeComplaint
                      }
                      disabled={
                        saving ||
                        deleting
                      }
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      className="complaint-save-button"
                      onClick={
                        handleSave
                      }
                      disabled={
                        saving ||
                        deleting
                      }
                    >
                      {saving ? (
                        <Loader2
                          size={16}
                          className="complaints-spin"
                        />
                      ) : (
                        <CheckCircle2
                          size={16}
                        />
                      )}

                      {saving
                        ? "Saving..."
                        : "Save Changes"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default AdminComplaints;
