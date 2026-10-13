import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Clock3,
  Package,
  RefreshCw,
  Search,
  ShoppingBag,
  XCircle,
} from "lucide-react";

import AdminLayout from "./components/AdminLayout";
import { API_URL } from "./utils/api";

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
  { key: "total_orders", label: "Total orders", icon: Package, tone: "blue" },
  { key: "pending", label: "Placed", icon: Clock3, tone: "amber" },
  { key: "confirmed", label: "Accepted", icon: CheckCircle2, tone: "green" },
  { key: "ready_for_pickup", label: "Ready for pickup", icon: ShoppingBag, tone: "purple" },
  { key: "completed", label: "Completed", icon: CheckCircle2, tone: "green" },
  { key: "declined", label: "Declined", icon: XCircle, tone: "red" },
  { key: "cancelled", label: "Cancelled", icon: XCircle, tone: "red" },
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

function AdminTransactions() {
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

  return (
    <AdminLayout title="Order Requests">
      <div className="transactions-page">
        <section className="transactions-hero">
          <div className="transactions-hero-content">
            <div className="transactions-hero-icon"><ShoppingBag size={27} /></div>
            <div>
              <span className="transactions-eyebrow">MARKETPLACE</span>
              <h2>Order Requests</h2>
              <p>Review order status and the payment and pickup arrangements selected at checkout. Payment is not collected here.</p>
            </div>
          </div>
          <button
            type="button"
            className="transactions-refresh-button"
            onClick={() => void loadOrders(true)}
            disabled={loading || refreshing}
          >
            <RefreshCw size={17} className={refreshing ? "is-spinning" : ""} />
            <span>{refreshing ? "Refreshing" : "Refresh"}</span>
          </button>
        </section>

        <section className="transactions-status-grid" aria-label="Order totals">
          {STATUS_CARDS.map(({ key, label, icon, tone }) => (
            <StatusCard
              key={key}
              icon={icon}
              tone={tone}
              label={label}
              value={summary[key] ?? 0}
            />
          ))}
        </section>

        <section className="transactions-directory">
          <form className="transactions-filters" onSubmit={submitSearch}>
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
              <XCircle size={17} />
              <span>{error}</span>
              <button type="button" onClick={() => void loadOrders(true)}>Try again</button>
            </div>
          )}

          {loading ? (
            <div className="transactions-loading" role="status">
              <span className="transactions-spinner" />
              <span>Loading order requests…</span>
            </div>
          ) : orders.length === 0 ? (
            <section className="transactions-empty-card">
              <div className="transactions-empty-icon"><ShoppingBag size={32} /></div>
              <span className="transactions-empty-label">ORDER DIRECTORY</span>
              <h3>No order requests found</h3>
              <p>Try adjusting your search, status, or date range.</p>
              <div className="transactions-info-box">
                <CheckCircle2 size={18} />
                <span>Orders record requests and status changes only. This portal does not collect or verify payment.</span>
              </div>
            </section>
          ) : (
            <div className="transactions-table-wrap">
              <table className="transactions-table">
                <thead>
                  <tr><th>Order</th><th>Buyer</th><th>Seller</th><th>Items</th><th>Total</th><th>Payment method</th><th>Pickup location</th><th>Status</th><th>Placed</th></tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const buyer = order.buyer || {};
                    const seller = order.seller || {};
                    const items = Array.isArray(order.items) ? order.items : [];
                    const orderStatus = String(order.status || "").toLowerCase();
                    return (
                      <tr key={order.id}>
                        <td><strong>{order.order_number || "—"}</strong></td>
                        <td><span>{buyer.name || "Account unavailable"}</span><small>{buyer.student_id || "—"}</small></td>
                        <td><span>{seller.name || "Account unavailable"}</span><small>{seller.student_id || "—"}</small></td>
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
                          {[order.pickup_location?.details, order.pickup_location?.area].filter(Boolean).length > 0 && <small>{[order.pickup_location?.details, order.pickup_location?.area].filter(Boolean).join(" · ")}</small>}
                        </td>
                        <td>
                          <span className={"transactions-order-status status-" + orderStatus}>
                            {statusLabel(orderStatus)}
                          </span>
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
      </div>
    </AdminLayout>
  );
}

function StatusCard({ icon: Icon, tone, label, value }) {
  return (
    <article className="transactions-status-card">
      <div className={"transactions-status-icon " + tone}><Icon size={21} /></div>
      <div><span>{label}</span><strong>{value}</strong></div>
    </article>
  );
}

export default AdminTransactions;
