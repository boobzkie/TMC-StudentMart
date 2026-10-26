import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Eye,
  AlertTriangle,
  Clock3,
  Package,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import AdminLayout from "./components/AdminLayout";
import AdminPageHero from "./components/AdminPageHero";
import { API_URL, SERVER_URL } from "./utils/api";

import "./AdminProductModeration.css";


function getToken() {
  return localStorage.getItem("token");
}

function getImageUrl(image) {
  if (!image) {
    return null;
  }

  if (
    image.startsWith("http://") ||
    image.startsWith("https://")
  ) {
    return image;
  }

  const cleanPath = image
    .replace(/^\/+/, "")
    .replace(/^storage\//, "");

  return `${SERVER_URL.replace(/\/+$/, "")}/storage/${cleanPath}`;
}

function ModerationPhotoGallery({ productName, imageUrls, initialImageUrl, status = "pending" }) {
  const primaryUrl = imageUrls.includes(initialImageUrl)
    ? initialImageUrl
    : imageUrls[0] || null;
  const [selectedUrl, setSelectedUrl] = useState(primaryUrl);
  const activeUrl = imageUrls.includes(selectedUrl) ? selectedUrl : primaryUrl;
  const activeIndex = Math.max(imageUrls.indexOf(activeUrl), 0);
  const accessibleName = productName || "Product";

  return (
    <>
      <div className="moderation-image-wrapper">
        {activeUrl ? (
          <img
            src={activeUrl}
            alt={
              imageUrls.length > 1
                ? `${accessibleName}, photo ${activeIndex + 1} of ${imageUrls.length}`
                : accessibleName
            }
            className="moderation-image"
          />
        ) : (
          <div className="moderation-image-placeholder">
            <Package size={36} aria-hidden="true" />
          </div>
        )}

        <span className="moderation-status">{status}</span>
      </div>

      {imageUrls.length > 1 && (
        <div className="moderation-photo-strip" role="group" aria-label={`${accessibleName} photos`}>
          {imageUrls.map((imageUrl, index) => (
            <button
              className="moderation-photo-button"
              key={imageUrl}
              type="button"
              aria-label={`Show photo ${index + 1} of ${imageUrls.length} for ${accessibleName}`}
              aria-pressed={imageUrl === activeUrl}
              onClick={() => setSelectedUrl(imageUrl)}
            >
              <img src={imageUrl} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </>
  );
}
function formatPrice(price) {
  const amount = Number(price);

  if (Number.isNaN(amount)) {
    return "₱0.00";
  }

  return amount.toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
  });
}

function formatDate(date) {
  if (!date) {
    return "—";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminProductModeration() {
  const navigate = useNavigate();
  const isStaff = String(localStorage.getItem("role") || "").toLowerCase() === "staff";
  const productsEndpoint = isStaff ? "staff/products" : "admin/products";

  const [products, setProducts] = useState([]);
  const [queueCounts, setQueueCounts] = useState({ pending: 0, approved: 0, rejected: 0, suspended: 0 });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sellerFilter, setSellerFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [processingId, setProcessingId] = useState(null);

  const [selectedProduct, setSelectedProduct] =
    useState(null);

  const [rejectModalOpen, setRejectModalOpen] =
    useState(false);

  const [rejectingProduct, setRejectingProduct] =
    useState(null);

  const moderationTrend = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      return { key, label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }), submitted: 0, approved: 0, rejected: 0 };
    });
    const byDay = new Map(days.map((day) => [day.key, day]));
    const reviewDurations = [];

    products.forEach((product) => {
      const submittedAt = new Date(product.created_at);
      if (!Number.isNaN(submittedAt.getTime())) {
        const key = `${submittedAt.getFullYear()}-${String(submittedAt.getMonth() + 1).padStart(2, "0")}-${String(submittedAt.getDate()).padStart(2, "0")}`;
        const day = byDay.get(key);
        if (day) day.submitted += 1;
      }

      const events = Array.isArray(product.moderation_events) ? product.moderation_events : [];
      const decisions = events
        .filter((event) => ["active", "approved", "rejected", "suspended"].includes(String(event.to_status || "").toLowerCase()))
        .sort((left, right) => new Date(left.created_at) - new Date(right.created_at));
      const firstDecision = decisions[0];
      if (firstDecision && !Number.isNaN(submittedAt.getTime())) {
        const decidedAt = new Date(firstDecision.created_at);
        const duration = (decidedAt.getTime() - submittedAt.getTime()) / 3600000;
        if (Number.isFinite(duration) && duration >= 0) reviewDurations.push(duration);
      }

      events.forEach((event) => {
        const decidedAt = new Date(event.created_at);
        if (Number.isNaN(decidedAt.getTime())) return;
        const key = `${decidedAt.getFullYear()}-${String(decidedAt.getMonth() + 1).padStart(2, "0")}-${String(decidedAt.getDate()).padStart(2, "0")}`;
        const day = byDay.get(key);
        if (!day) return;
        const status = String(event.to_status || "").toLowerCase();
        if (status === "active" || status === "approved") day.approved += 1;
        if (status === "rejected") day.rejected += 1;
      });
    });

    return {
      days,
      averageReviewHours: reviewDurations.length
        ? reviewDurations.reduce((total, duration) => total + duration, 0) / reviewDurations.length
        : null,
    };
  }, [products]);

  const moderationTrendMax = Math.max(1, ...moderationTrend.days.flatMap((day) => [day.submitted, day.approved, day.rejected]));
  const moderationTotal = queueCounts.pending + queueCounts.approved + queueCounts.rejected + queueCounts.suspended;
  const moderationDistribution = [
    { label: "Approved", value: queueCounts.approved, tone: "approved" },
    { label: "Rejected", value: queueCounts.rejected, tone: "rejected" },
    { label: "Suspended", value: queueCounts.suspended, tone: "suspended" },
    { label: "Pending", value: queueCounts.pending, tone: "pending" },
  ];

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");

    navigate("/login", {
      replace: true,
    });
  }, [navigate]);

  const loadPendingProducts = useCallback(
    async (isRefresh = false) => {
      const token = getToken();

      if (!token) {
        handleUnauthorized();
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const params = new URLSearchParams();

        if (statusFilter !== "all") {
          params.set("status", statusFilter);
        }

        if (search.trim()) {
          params.set("search", search.trim());
        }
        if (categoryFilter.trim()) params.set("category", categoryFilter.trim());
        if (sellerFilter.trim()) params.set("seller", sellerFilter.trim());
        if (dateFrom) params.set("date_from", dateFrom);
        if (dateTo) params.set("date_to", dateTo);

        const response = await fetch(
          `${API_URL}/${productsEndpoint}?${params.toString()}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (
          response.status === 401
        ) {
          handleUnauthorized();
          return;
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.message ||
              "Failed to load pending products."
          );
        }

        const productRecords = Array.isArray(data.products) ? data.products : [];
        setProducts(productRecords);
        const counts = data.status_counts;
        setQueueCounts(counts ? {
          pending: Number(counts.pending) || 0,
          approved: Number(counts.approved) || 0,
          rejected: Number(counts.rejected) || 0,
          suspended: Number(counts.suspended) || 0,
        } : productRecords.reduce((summary, product) => {
          const status = product.status === "active" ? "approved" : product.status;
          if (Object.hasOwn(summary, status)) summary[status] += 1;
          return summary;
        }, { pending: 0, approved: 0, rejected: 0, suspended: 0 }));
      } catch (err) {
        setError(
          err.message ||
            "Unable to load pending products."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [search, statusFilter, categoryFilter, sellerFilter, dateFrom, dateTo, productsEndpoint, handleUnauthorized]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPendingProducts();
    }, 250);

    return () => clearTimeout(timer);
  }, [loadPendingProducts]);

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const handleApprove = async (product) => {
    clearMessages();

    const token = getToken();

    if (!token) {
      handleUnauthorized();
      return;
    }

    const confirmed = window.confirm(
      `Approve "${product.name}"?`
    );

    if (!confirmed) {
      return;
    }

    setProcessingId(product.id);

    try {
      const response = await fetch(
        `${API_URL}/${productsEndpoint}/${product.id}/approve`,
        {
          method: "PUT",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (
        response.status === 401
      ) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "Failed to approve product."
        );
      }

      setSuccess(
        data.message ||
          "Product approved successfully."
      );

      setSelectedProduct(null);

      await loadPendingProducts(true);
    } catch (err) {
      setError(
        err.message ||
          "Unable to approve product."
      );
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectModal = (product) => {
    clearMessages();
    setRejectionReason("");
    setRejectingProduct(product);
    setRejectModalOpen(true);
  };

  const closeRejectModal = () => {
    if (processingId !== null) {
      return;
    }

    setRejectModalOpen(false);
    setRejectingProduct(null);
    setRejectionReason("");
  };

  const handleReject = async () => {
    if (!rejectingProduct) {
      return;
    }
    if (rejectionReason.trim().length < 5) {
      setError("Enter a rejection reason of at least 5 characters.");
      return;
    }

    clearMessages();

    const token = getToken();

    if (!token) {
      handleUnauthorized();
      return;
    }

    const confirmed = window.confirm(
      `Reject "${rejectingProduct.name}"?`
    );

    if (!confirmed) {
      return;
    }

    setProcessingId(
      rejectingProduct.id
    );

    try {
      const response = await fetch(
        `${API_URL}/${productsEndpoint}/${rejectingProduct.id}/reject`,
        {
          method: "PUT",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reason: rejectionReason.trim() }),
        }
      );

      if (
        response.status === 401
      ) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "Failed to reject product."
        );
      }

      setSuccess(
        data.message ||
          "Product rejected successfully."
      );

      setRejectModalOpen(false);
      setRejectingProduct(null);
      setSelectedProduct(null);

      await loadPendingProducts(true);
    } catch (err) {
      setError(
        err.message ||
          "Unable to reject product."
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleWarningOrSuspension = async (product, action) => {
    clearMessages();
    const reason = window.prompt(action === "warn"
      ? `Enter the warning for the seller of “${product.name}”:`
      : `Enter the reason to suspend “${product.name}”:`);
    if (reason === null) return;
    if (reason.trim().length < 5) {
      setError("Enter a reason of at least five characters.");
      return;
    }
    if (action === "suspend" && !window.confirm(`Suspend “${product.name}”? The listing will no longer be visible in the marketplace.`)) return;

    const token = getToken();
    if (!token) {
      handleUnauthorized();
      return;
    }
    setProcessingId(product.id);
    try {
      const response = await fetch(`${API_URL}/${productsEndpoint}/${product.id}/${action === "warn" ? "warn" : "suspend"}`, {
        method: action === "warn" ? "POST" : "PUT",
        headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "The moderation action could not be completed.");
      setSuccess(data.message || (action === "warn" ? "Warning sent to seller." : "Listing suspended."));
      if (action === "suspend") setSelectedProduct(null);
      else if (data.product) setSelectedProduct(data.product);
      await loadPendingProducts(true);
    } catch (err) {
      setError(err.message || "The moderation action could not be completed.");
    } finally {
      setProcessingId(null);
    }
  };


  return (
    <AdminLayout
      title="Product Moderation"
      subtitle={isStaff ? "Review student product listings assigned to your Staff account." : "Review and moderate products submitted by students."}
    >
      <div className="moderation-page">

        <AdminPageHero
          title="Product Moderation"
          description={isStaff
            ? "Review student listings assigned to your Staff account and record clear moderation decisions."
            : "Review submitted listings, inspect their history, and record clear decisions for sellers."}
          icon={ShieldAlert}
          onRefresh={() => loadPendingProducts(true)}
          refreshing={loading || refreshing}
          meta={`${products.length} products shown`}
        />

        <section className="moderation-queue-summary" aria-label="Listing status counts" aria-live="polite">
          <article className="moderation-queue-card pending">
            <span className="moderation-queue-icon"><ShieldAlert size={19} aria-hidden="true" /></span>
            <div><span>Pending review</span><strong>{queueCounts.pending}</strong><small>Waiting for a decision</small></div>
          </article>
          <article className="moderation-queue-card approved">
            <span className="moderation-queue-icon"><CheckCircle2 size={19} aria-hidden="true" /></span>
            <div><span>Approved</span><strong>{queueCounts.approved}</strong><small>Available listings</small></div>
          </article>
          <article className="moderation-queue-card rejected">
            <span className="moderation-queue-icon"><XCircle size={19} aria-hidden="true" /></span>
            <div><span>Rejected</span><strong>{queueCounts.rejected}</strong><small>Returned to sellers</small></div>
          </article>
          <article className="moderation-queue-card suspended">
            <span className="moderation-queue-icon"><AlertTriangle size={19} aria-hidden="true" /></span>
            <div><span>Suspended</span><strong>{queueCounts.suspended}</strong><small>Not visible in marketplace</small></div>
          </article>
        </section>

        <section className="moderation-insights-grid" aria-label="Moderation trends and status overview">
          <article className="moderation-insight-card moderation-trend-card">
            <div className="moderation-insight-heading">
              <span className="moderation-insight-icon"><Package size={18} aria-hidden="true" /></span>
              <div><h2>Submissions &amp; Decisions Trend</h2><p>Last 7 days · current product results</p></div>
            </div>
            <div className="moderation-trend-legend" aria-hidden="true">
              <span className="submitted">Submitted</span><span className="approved">Approved</span><span className="rejected">Rejected</span>
            </div>
            <div className="moderation-trend-chart" role="img" aria-label={`Daily submissions and moderation decisions: ${moderationTrend.days.map((day) => `${day.label}: ${day.submitted} submitted, ${day.approved} approved, ${day.rejected} rejected`).join("; ")}`}>
              {moderationTrend.days.map((day) => (
                <div className="moderation-trend-day" key={day.key}>
                  <div className="moderation-trend-bars">
                    <span className="submitted" style={{ height: `${day.submitted ? Math.max(6, (day.submitted / moderationTrendMax) * 100) : 0}%` }} />
                    <span className="approved" style={{ height: `${day.approved ? Math.max(6, (day.approved / moderationTrendMax) * 100) : 0}%` }} />
                    <span className="rejected" style={{ height: `${day.rejected ? Math.max(6, (day.rejected / moderationTrendMax) * 100) : 0}%` }} />
                  </div>
                  <small>{day.label}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="moderation-insight-card moderation-distribution-card">
            <div className="moderation-insight-heading">
              <span className="moderation-insight-icon"><CheckCircle2 size={18} aria-hidden="true" /></span>
              <div><h2>Moderation Decisions</h2><p>{moderationTotal} listings across tracked statuses</p></div>
            </div>
            <div className="moderation-distribution-list">
              {moderationDistribution.map((item) => (
                <div className="moderation-distribution-row" key={item.label}>
                  <span>{item.label}</span>
                  <div className="moderation-distribution-track" aria-hidden="true"><span className={item.tone} style={{ width: `${moderationTotal ? (item.value / moderationTotal) * 100 : 0}%` }} /></div>
                  <strong>{item.value}</strong>
                  <small>{moderationTotal ? Math.round((item.value / moderationTotal) * 100) : 0}%</small>
                </div>
              ))}
            </div>
          </article>

          <article className="moderation-insight-card moderation-review-time-card">
            <div className="moderation-insight-heading">
              <span className="moderation-insight-icon"><Clock3 size={18} aria-hidden="true" /></span>
              <div><h2>Average Review Time</h2><p>From available moderation history</p></div>
            </div>
            <strong className="moderation-review-time-value">
              {moderationTrend.averageReviewHours === null ? "—" : `${moderationTrend.averageReviewHours.toFixed(1)} hours`}
            </strong>
            <p className="moderation-review-time-note">
              {moderationTrend.averageReviewHours === null
                ? "Review history is not available for the current results."
                : "Calculated from the first recorded decision for each listing."}
            </p>
          </article>
        </section>

        {/* ALERTS */}
        {error && (
          <div className="moderation-alert moderation-alert-error">
            <XCircle size={19} />

            <span>
              {error}
            </span>

            <button
              type="button"
              onClick={() =>
                setError("")
              }
              aria-label="Close error"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {success && (
          <div className="moderation-alert moderation-alert-success">
            <CheckCircle2 size={19} />

            <span>
              {success}
            </span>

            <button
              type="button"
              onClick={() =>
                setSuccess("")
              }
              aria-label="Close success"
            >
              <X size={17} />
            </button>
          </div>
        )}

        {/* TOOLBAR */}
        <section className="moderation-panel">

          <div className="moderation-toolbar">

            <div className="moderation-search">

              <Search size={18} />

              <input
                type="search"
                placeholder="Search products or sellers..."
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
              />

              {search && (
                <button
                  type="button"
                  className="moderation-clear-search"
                  onClick={() =>
                    setSearch("")
                  }
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}

            </div>

          </div>

          <div className="moderation-filters" role="group" aria-label="Product filters">
            <label>
              <span>Status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="pending">Pending</option>
                <option value="active">Available / approved</option>
                <option value="archived">Archived</option>
                <option value="suspended">Suspended</option>
                <option value="rejected">Rejected</option>
                <option value="inactive">Inactive</option>
                <option value="all">All statuses</option>
              </select>
            </label>
            <label>
              <span>Category</span>
              <input type="search" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} placeholder="Any category" />
            </label>
            <label>
              <span>Seller</span>
              <input type="search" value={sellerFilter} onChange={(event) => setSellerFilter(event.target.value)} placeholder="Name, email, or student ID" />
            </label>
            <label>
              <span>Submitted from</span>
              <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </label>
            <label>
              <span>Submitted through</span>
              <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </label>
            <button type="button" className="moderation-reset-filters" onClick={() => { setSearch(""); setStatusFilter("pending"); setCategoryFilter(""); setSellerFilter(""); setDateFrom(""); setDateTo(""); }}>Reset filters</button>
          </div>

          {/* CONTENT */}
          {loading ? (
            <ModerationSkeleton />
          ) : products.length === 0 ? (
            <div className="moderation-empty">

              <div className="moderation-empty-icon">
                <CheckCircle2 size={31} />
              </div>

              <h3>
                {statusFilter === "pending" ? "No Pending Products" : "No Products Found"}
              </h3>

              <p>
                {statusFilter === "pending"
                  ? queueCounts.pending > 0
                    ? `${queueCounts.pending} pending ${queueCounts.pending === 1 ? "listing is" : "listings are"} in the queue, but none match the current filters.`
                    : "There are no new listings waiting for moderation."
                  : "No products match the selected search and filters."}
              </p>

            </div>
          ) : (
            <div className="moderation-grid">

              {products.map((product) => {
                const productImages = Array.isArray(product.images)
                  ? product.images
                  : [];
                const galleryUrls = productImages
                  .map((image) => getImageUrl(image?.path))
                  .filter(Boolean);
                const primaryImage = productImages.find((image) => image?.is_primary);
                const imageUrl =
                  getImageUrl(product.image) ||
                  getImageUrl(primaryImage?.path) ||
                  galleryUrls[0] ||
                  null;
                const imageUrls = Array.from(
                  new Set([imageUrl, ...galleryUrls].filter(Boolean))
                );

                const seller =
                  product.user?.name ||
                  "Unknown Seller";

                const isProcessing =
                  processingId ===
                  product.id;

                return (
                  <article
                    className="moderation-card"
                    key={product.id}
                  >

                    <ModerationPhotoGallery
                      productName={product.name}
                      imageUrls={imageUrls}
                      initialImageUrl={imageUrl}
                      status={product.status}
                    />
                    <div className="moderation-card-content">

                      <div className="moderation-card-top">

                        <div>
                          <h3>
                            {
                              product.name
                            }
                          </h3>

                          <span className="moderation-category">
                            {product.category_record?.name || product.category ||
                              "Other"}
                          </span>
                        </div>

                        <strong className="moderation-price">
                          {formatPrice(
                            product.price
                          )}
                        </strong>

                      </div>

                      <p className="moderation-description">
                        {product.description ||
                          "No product description provided."}
                      </p>

                      <div className="moderation-seller">

                        <span>
                          Seller
                        </span>

                        <strong>
                          {seller}
                        </strong>

                        {product.user?.student_id && <small>Student ID {product.user.student_id}</small>}

                      </div>

                      <div className="moderation-stock">
                        <Package size={14} aria-hidden="true" />
                        <span>Stock</span>
                        <strong>{Number(product.stock_quantity) || 0}</strong>
                      </div>

                      <div className="moderation-date">
                        Submitted{" "}
                        {formatDate(
                          product.created_at
                        )}
                      </div>

                      <div className="moderation-actions">

                        <button
                          type="button"
                          className="moderation-view"
                          onClick={() =>
                            setSelectedProduct(
                              product
                            )
                          }
                          disabled={
                            isProcessing
                          }
                        >
                          <Eye size={16} />
                          Review
                        </button>

                        {product.status === "pending" && (
                          <>
                        <button
                          type="button"
                          className="moderation-reject"
                          onClick={() =>
                            openRejectModal(
                              product
                            )
                          }
                          disabled={
                            isProcessing
                          }
                        >
                          <XCircle
                            size={16}
                          />
                          Reject
                        </button>

                        <button
                          type="button"
                          className="moderation-approve"
                          onClick={() =>
                            handleApprove(
                              product
                            )
                          }
                          disabled={
                            isProcessing
                          }
                        >
                          <CheckCircle2
                            size={16}
                          />
                          Approve
                        </button>
                          </>
                        )}

                        {product.status === "active" && <>
                          <button type="button" className="moderation-reject" onClick={() => handleWarningOrSuspension(product, "warn")} disabled={isProcessing}><AlertTriangle size={16} />Issue warning</button>
                          {!isStaff && <button type="button" className="moderation-reject" onClick={() => handleWarningOrSuspension(product, "suspend")} disabled={isProcessing}><XCircle size={16} />Suspend</button>}
                        </>}

                      </div>

                    </div>

                  </article>
                );
              })}

            </div>
          )}

        </section>

      </div>

      {/* REVIEW MODAL */}
      {selectedProduct && (
        <div
          className="moderation-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedProduct(null);
            }
          }}
        >
          <div className="moderation-modal">

            <div className="moderation-modal-header">

              <div>
                <span>
                  PRODUCT REVIEW
                </span>

                <h3>
                  {selectedProduct.name}
                </h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedProduct(null)
                }
                aria-label="Close review"
              >
                <X size={20} />
              </button>

            </div>

            <div className="review-content">

              {getImageUrl(
                selectedProduct.image
              ) ? (
                <img
                  src={getImageUrl(
                    selectedProduct.image
                  )}
                  alt={
                    selectedProduct.name
                  }
                  className="review-image"
                />
              ) : (
                <div className="review-image-placeholder">
                  <Package size={42} />
                </div>
              )}

              <div className="review-details">

                <div className="review-detail">
                  <span>
                    Product
                  </span>

                  <strong>
                    {
                      selectedProduct.name
                    }
                  </strong>
                </div>

                <div className="review-detail">
                  <span>
                    Category
                  </span>

                  <strong>
                    {selectedProduct.category ||
                      "Other"}
                  </strong>
                </div>

                <div className="review-detail">
                  <span>
                    Price
                  </span>

                  <strong>
                    {formatPrice(
                      selectedProduct.price
                    )}
                  </strong>
                </div>

                <div className="review-detail">
                  <span>
                    Seller
                  </span>

                  <strong>
                    {selectedProduct.user
                      ?.name ||
                      "Unknown Seller"}
                  </strong>
                </div>

                <div className="review-detail full">
                  <span>
                    Description
                  </span>

                  <p>
                    {selectedProduct.description ||
                      "No description provided."}
                  </p>
                </div>

              </div>

            </div>

            {Array.isArray(selectedProduct.moderation_events) && selectedProduct.moderation_events.length > 0 && (
              <section className="moderation-history" aria-label="Moderation history">
                <h4>Review history</h4>
                <ol>
                  {selectedProduct.moderation_events.map((event) => (
                    <li key={event.id}>
                      <strong>{event.to_status === "active" ? "Approved" : "Rejected"}</strong>
                      <span>{event.actor?.name || "Former moderator"} · {formatDate(event.created_at)}</span>
                      {event.reason && <p>{event.reason}</p>}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {Array.isArray(selectedProduct.warnings) && selectedProduct.warnings.length > 0 && (
              <section className="moderation-history" aria-label="Product warning history">
                <h4>Warning history</h4>
                <ol>{selectedProduct.warnings.map((warning) => <li key={warning.id}>
                  <strong>Seller warning issued</strong>
                  <span>{warning.actor?.name || "Former moderator"} · {formatDate(warning.created_at)}</span>
                  <p>{warning.reason}</p>
                </li>)}</ol>
              </section>
            )}

            {selectedProduct.status === "active" && <div className="review-actions">
              <button type="button" className="moderation-reject" disabled={processingId === selectedProduct.id} onClick={() => handleWarningOrSuspension(selectedProduct, "warn")}><AlertTriangle size={17} />Issue seller warning</button>
              {!isStaff && <button type="button" className="moderation-reject" disabled={processingId === selectedProduct.id} onClick={() => handleWarningOrSuspension(selectedProduct, "suspend")}><XCircle size={17} />Suspend listing</button>}
            </div>}

            {selectedProduct.status === "pending" && (
            <div className="review-actions">

              <button
                type="button"
                className="moderation-reject"
                disabled={selectedProduct.status !== "pending"}
                onClick={() => {
                  openRejectModal(
                    selectedProduct
                  );
                }}
              >
                <XCircle size={17} />
                Reject
              </button>

              <button
                type="button"
                className="moderation-approve"
                onClick={() =>
                  handleApprove(
                    selectedProduct
                  )
                }
                disabled={
                  selectedProduct.status !== "pending" ||
                  processingId === selectedProduct.id
                }
              >
                <CheckCircle2
                  size={17}
                />
                Approve Product
              </button>

            </div>
            )}

          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectModalOpen &&
        rejectingProduct && (
          <div className="moderation-modal-overlay">
            <div className="reject-modal">

              <div className="reject-icon">
                <XCircle size={25} />
              </div>

              <h3>
                Reject Product?
              </h3>

              <p>
                Are you sure you want to
                reject{" "}
                <strong>
                  "{rejectingProduct.name}"
                </strong>
                ?
              </p>

              <label className="moderation-reason-field" htmlFor="moderation-rejection-reason">
                <span>Reason for the seller</span>
                <textarea id="moderation-rejection-reason" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={4} maxLength={2000} placeholder="Explain what needs to be corrected before the listing can be approved." />
                <small>This reason is saved in the review history and shown to the seller.</small>
              </label>

              <div className="reject-actions">

                <button
                  type="button"
                  className="moderation-cancel"
                  onClick={
                    closeRejectModal
                  }
                  disabled={
                    processingId !== null
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="moderation-reject"
                  onClick={
                    handleReject
                  }
                  disabled={
                    processingId !== null || rejectionReason.trim().length < 5
                  }
                >
                  {processingId !==
                  null ? (
                    <>
                      <RefreshCw
                        size={16}
                        className="moderation-spin"
                      />
                      Rejecting...
                    </>
                  ) : (
                    <>
                      <XCircle
                        size={16}
                      />
                      Reject Product
                    </>
                  )}
                </button>

              </div>

            </div>
          </div>
        )}

    </AdminLayout>
  );
}

function ModerationSkeleton() {
  return (
    <div className="moderation-grid">

      {[1, 2, 3].map((item) => (
        <div
          className="moderation-skeleton-card"
          key={item}
        >
          <div className="skeleton-image" />

          <div className="skeleton-line large" />
          <div className="skeleton-line" />
          <div className="skeleton-line short" />

          <div className="skeleton-actions">
            <span />
            <span />
            <span />
          </div>
        </div>
      ))}

    </div>
  );
}
