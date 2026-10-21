import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Clock3,
  Package,
  Search,
  ShoppingBag,
  XCircle,
} from "lucide-react";

import AdminLayout from "./components/AdminLayout";
import ConfirmModal from "./ConfirmModal";
import { API_URL, getAuthHeaders } from "./utils/api";

import { Badge, Button, SectionHeader, EmptyState, LoadingSpinner } from "./ui";

import "./AdminTransactions.css";

const STATUS_OPTIONS = [
  ["", "All statuses"],
  ["pending", "Placed"],
  ["confirmed", "Accepted"],
  ["ready_for_pickup", "Ready for pickup"],
  ["declined", "Declined"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
];

const STATUS_CARDS = [
  { key: "total_orders", label: "Total orders", icon: Package, tone: "primary" },
  { key: "pending", label: "Placed", icon: Clock3, tone: "warning" },
  { key: "confirmed", label: "Accepted", icon: CheckCircle2, tone: "success" },
  { key: "ready_for_pickup", label: "Ready for pickup", icon: ShoppingBag, tone: "info" },
  { key: "completed", label: "Completed", icon: CheckCircle2, tone: "success" },
  { key: "declined", label: "Declined", icon: XCircle, tone: "danger" },
  { key: "cancelled", label: "Cancelled", icon: XCircle, tone: "danger" },
];

function formatCurrency(value) {
  const amount = Number(value);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function statusLabel(status) {
  const labels = {
    pending: "Placed",
    confirmed: "Accepted",
    ready_for_pickup: "Ready for pickup",
    declined: "Declined",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return labels[status] || "Unknown";
}

function paymentStatusLabel(status) {
  const value = String(status || "").toLowerCase();
  return value === "paid" ? "Paid" : "Unpaid";
}

function paymentBadgeVariant(status) {
  const value = String(status || "").toLowerCase();
  return value === "paid" ? "success" : "warning";
}

function orderBadgeVariant(status) {
  const variants = {
    pending: "warning",
    confirmed: "info",
    ready_for_pickup: "info",
    completed: "success",
    declined: "danger",
    cancelled: "danger",
  };
  return variants[status] || "neutral";
}

export default function AdminTransactions() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState({
    total_orders: 0,
    pending: 0,
    confirmed: 0,
    ready_for_pickup: 0,
    declined: 0,
    completed: 0,
    cancelled: 0,
  });
  const [matchingTotal, setMatchingTotal] = useState(0);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [pickupLocationId, setPickupLocationId] = useState(
    new URLSearchParams(window.location.search).get("pickup_location_id") || "",
  );
  const [pickupLocations, setPickupLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [paymentBusyIds, setPaymentBusyIds] = useState({});
  const [pendingPaymentOrder, setPendingPaymentOrder] = useState(null);

  const loadOrders = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login", { replace: true });
        return;
      }

      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      if (fromDate) params.set("from_date", fromDate);
      if (toDate) params.set("to_date", toDate);
      if (pickupLocationId) params.set("pickup_location_id", pickupLocationId);
      const query = params.toString();
      const [response, optionsResponse] = await Promise.all([
        fetch(API_URL + "/admin/orders" + (query ? "?" + query : ""), {
          headers: {
            Accept: "application/json",
            Authorization: "Bearer " + token,
          },
        }),
        fetch(API_URL + "/admin/order-options", {
          headers: {
            Accept: "application/json",
            Authorization: "Bearer " + token,
          },
        }),
      ]);

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
        return;
      }

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "Unable to load order requests.");
      }
      setOrders(Array.isArray(payload.orders) ? payload.orders : []);
      setMatchingTotal(Number(payload.total) || 0);
      setSummary((current) => ({ ...current, ...(payload.summary || {}) }));
      const optionsPayload = await optionsResponse.json().catch(() => ({}));
      if (optionsResponse.ok) {
        setPickupLocations(Array.isArray(optionsPayload.pickup_locations) ? optionsPayload.pickup_locations : []);
      }
    } catch (loadError) {
      setError(loadError.message || "Unable to load order requests.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fromDate, navigate, pickupLocationId, search, status, toDate]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadOrders(), 0);
    return () => window.clearTimeout(timer);
  }, [loadOrders]);

  const submitSearch = (event) => {
    event.preventDefault();
    setSearch(searchDraft);
  };

  const clearFilters = () => {
    setSearchDraft("");
    setSearch("");
    setStatus("");
    setFromDate("");
    setToDate("");
    setPickupLocationId("");
    navigate("/admin/transactions", { replace: true });
  };

  const hasFilters = Boolean(search || status || fromDate || toDate || pickupLocationId);

  const markOrderPaid = async (order) => {
    const orderId = Number(order?.id);
    if (!orderId || paymentBusyIds[orderId]) {
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    setPaymentBusyIds((current) => ({ ...current, [orderId]: true }));
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_URL}/admin/orders/${orderId}/mark-paid`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
        return;
      }

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || "Unable to update payment status.");
      }

      setOrders((currentOrders) =>
        currentOrders.map((currentOrder) =>
          Number(currentOrder.id) === orderId
            ? { ...currentOrder, payment_status: "paid" }
            : currentOrder,
        ),
      );
      setSuccess(`${order.order_number || `Order #${orderId}`} payment marked as paid.`);
    } catch (markError) {
      const message = markError.message || "Unable to update payment status.";
      setError(message);
    } finally {
      setPaymentBusyIds((current) => ({ ...current, [orderId]: false }));
    }
  };

  const handleMarkPaidClick = (order) => {
    if (!order || paymentBusyIds[Number(order.id)]) {
      return;
    }

    setPendingPaymentOrder(order);
  };

  const confirmMarkPaid = async () => {
    if (!pendingPaymentOrder) {
      return;
    }

    const order = pendingPaymentOrder;
    setPendingPaymentOrder(null);
    await markOrderPaid(order);
  };

  const pendingPaymentId = pendingPaymentOrder ? Number(pendingPaymentOrder.id) : null;
  const pendingPaymentBusy = pendingPaymentId ? Boolean(paymentBusyIds[pendingPaymentId]) : false;

  return (
    <AdminLayout
      title="Order Management"
      subtitle="Review orders, payment status, and pickup arrangements."
    >
      <div className="transactions-page">
        <SectionHeader
          title="Orders"
          subtitle="Order Management"
          action={loadOrders}
          actionLabel={refreshing ? "Refreshing…" : "Refresh"}
          actionVariant="outline"
        />

        <section className="transactions-status-grid" aria-label="Order totals">
          <div className="status-metrics-grid">
            {STATUS_CARDS.map(({ key, label, icon: Icon, tone }) => (
              <StatCardKey
                key={key}
                icon={Icon}
                tone={tone}
                label={label}
                value={summary[key] ?? 0}
              />
            ))}
          </div>
        </section>

        <section className="transactions-directory">
          <form className="transactions-filters" onSubmit={submitSearch}>
            <div className="transactions-search-wrapper">
              <label className="transactions-search">
                <Search size={17} aria-hidden="true" />
                <span className="visually-hidden">Search orders</span>
                <input
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  placeholder="Search order, student, buyer, seller, or product"
                />
              </label>
              <button type="submit" className="transactions-secondary-button">Search</button>
            </div>

            <div className="transactions-filter-group">
              <label className="transactions-status-filter">
                <span>Status</span>
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                  {STATUS_OPTIONS.map(([value, label]) => (
                    <option key={value || "all"} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              <label className="transactions-pickup-filter">
                <span>Pickup location</span>
                <select
                  value={pickupLocationId}
                  onChange={(event) => {
                    const value = event.target.value;
                    setPickupLocationId(value);
                    navigate(value ? `/admin/transactions?pickup_location_id=${encodeURIComponent(value)}` : "/admin/transactions", { replace: true });
                  }}
                >
                  <option value="">All pickup locations</option>
                  {pickupLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}{location.is_active ? "" : " (inactive)"}
                    </option>
                  ))}
                </select>
              </label>

              <label className="transactions-date-filter">
                <span>From</span>
                <input
                  type="date"
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={(event) => setFromDate(event.target.value)}
                />
              </label>

              <label className="transactions-date-filter">
                <span>To</span>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(event) => setToDate(event.target.value)}
                />
              </label>

              {hasFilters && (
                <button
                  type="button"
                  className="transactions-clear-button"
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              )}
            </div>
          </form>

          <div className="transactions-results-line" aria-live="polite">
            <span>
              {loading
                ? "Loading matching orders…"
                : matchingTotal + (matchingTotal === 1 ? " matching order" : " matching orders")}
            </span>
            {!loading && matchingTotal > orders.length && (
              <span>Showing the {orders.length} most recent matches.</span>
            )}
          </div>

          {error && (
            <div className="transactions-error" role="alert">
              <XCircle size={17} aria-hidden="true" />
              <div>
                <strong>Unable to load orders</strong>
                <span>{error}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => void loadOrders(true)}>
                Try again
              </Button>
            </div>
          )}

          {success && (
            <div className="transactions-success" role="status">
              <CheckCircle2 size={17} aria-hidden="true" />
              <span>{success}</span>
            </div>
          )}

          {loading ? (
            <div className="transactions-loading" role="status">
              <LoadingSpinner size="sm" />
              <span>Loading order requests…</span>
            </div>
          ) : orders.length === 0 ? (
            <EmptyState
              icon={() => null}
              title="No order requests found"
              subtitle="Try adjusting your search, status, or date range."
            />
          ) : (
            <div className="transactions-table-wrap">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Buyer</th>
                    <th>Seller</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Payment method</th>
                    <th>Pickup location</th>
                    <th>Payment status</th>
                    <th>Order status</th>
                    <th>Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const buyer = order.buyer || {};
                    const seller = order.seller || {};
                    const items = Array.isArray(order.items) ? order.items : [];
                    const orderStatus = String(order.status || "").toLowerCase();
                    const paymentStatus = String(order.payment_status || "unpaid").toLowerCase();
                    const isPaymentPaid = paymentStatus === "paid";
                    const isPaymentBusy = Boolean(paymentBusyIds[Number(order.id)]);

                    return (
                      <tr key={order.id}>
                        <td><strong>{order.order_number || "—"}</strong></td>
                        <td>
                          <div className="transactions-buyer-cell">
                            <span>{buyer.name || "Account unavailable"}</span>
                            <small>{buyer.student_id || "—"}</small>
                          </div>
                        </td>
                        <td>
                          <div className="transactions-buyer-cell">
                            <span>{seller.name || "Account unavailable"}</span>
                            <small>{seller.student_id || "—"}</small>
                          </div>
                        </td>
                        <td>
                          <div className="transactions-item-list">
                            {items.map((item) => (
                              <span key={item.id}>{item.product_name} × {item.quantity}</span>
                            ))}
                          </div>
                        </td>
                        <td className="transactions-amount">{formatCurrency(order.total_amount)}</td>
                        <td>{order.payment_method?.name || "Not recorded"}</td>
                        <td>
                          <span>{order.pickup_location?.name || "Not recorded"}</span>
                          {[order.pickup_location?.details, order.pickup_location?.area].filter(Boolean).length > 0 && (
                            <small>{[order.pickup_location?.details, order.pickup_location?.area].filter(Boolean).join(" · ")}</small>
                          )}
                        </td>
                        <td>
                          <div className="transactions-payment-cell">
                            <Badge
                              variant={paymentBadgeVariant(paymentStatus)}
                              size="sm"
                            >
                              {paymentStatusLabel(paymentStatus)}
                            </Badge>
                            {!isPaymentPaid && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="transactions-mark-paid-button"
                                onClick={() => handleMarkPaidClick(order)}
                                disabled={isPaymentBusy}
                              >
                                {isPaymentBusy ? "Processing…" : "Mark Paid"}
                              </Button>
                            )}
                          </div>
                        </td>
                        <td>
                          <Badge variant={orderBadgeVariant(orderStatus)} size="sm">
                            {statusLabel(orderStatus)}
                          </Badge>
                        </td>
                        <td>{formatDate(order.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <ConfirmModal
          open={Boolean(pendingPaymentOrder)}
          title="Mark this order as paid?"
          message={
            pendingPaymentOrder
              ? `Mark ${pendingPaymentOrder.order_number || `Order #${pendingPaymentOrder.id}`} as paid?`
              : "Mark this order as paid?"
          }
          confirmText="Mark Paid"
          cancelText="Cancel"
          type="success"
          loading={pendingPaymentBusy}
          onConfirm={() => {
            void confirmMarkPaid();
          }}
          onCancel={() => setPendingPaymentOrder(null)}
        />
      </div>
    </AdminLayout>
  );
}

function StatCardKey({ icon: Icon, tone, label, value }) {
  const toneColors = {
    primary: { bg: "var(--tmc-admin-accent-soft)", color: "var(--tmc-admin-primary)" },
    success: { bg: "#F0FDF4", color: "#166534" },
    warning: { bg: "#FFFBEB", color: "#92400E" },
    danger: { bg: "#FEF2F2", color: "#B42326" },
    info: { bg: "#ECFEFF", color: "#0891B2" },
  };
  const toneStyle = toneColors[tone] || toneColors.primary;

  return (
    <article className="transactions-status-card">
      <div className="transactions-status-icon" style={{ background: toneStyle.bg, color: toneStyle.color }}>
        <Icon size={21} aria-hidden="true" />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}
