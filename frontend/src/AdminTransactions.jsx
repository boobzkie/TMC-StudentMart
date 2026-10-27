import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Clock3,
  Package,
  CreditCard,
  Search,
  ShoppingBag,
  XCircle,
} from "lucide-react";

import AdminLayout from "./components/AdminLayout";
import AdminPageHero from "./components/AdminPageHero";
import { SortableHead } from "./ui/Table";
import { API_URL, sortRows } from "./utils/api";

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
  { key: "closed", label: "Cancelled / declined", icon: XCircle, tone: "red" },
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
  const [sort, setSort] = useState({ key: "created_at", direction: "desc" });
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
  const [status, setStatus] = useState(() => new URLSearchParams(window.location.search).get("status") || "");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [pickupLocationId, setPickupLocationId] = useState(
    new URLSearchParams(window.location.search).get("pickup_location_id") || "",
  );
  const [pickupLocations, setPickupLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const ordersRequestSequenceRef = useRef(0);

  const toggleSort = (key) => setSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
  const sortedOrders = sortRows(orders, sort, (order, key) => ({
    order_number: order.order_number,
    buyer: order.buyer?.name,
    seller: order.seller?.name,
    items: Array.isArray(order.items) ? order.items.map((item) => item.product_name).join(" ") : "",
    total_amount: Number(order.total_amount),
    payment_method: order.payment_method?.name,
    pickup_location: order.pickup_location?.name,
    status: order.status,
    created_at: order.created_at,
  })[key]);

  const loadOrders = useCallback(async (showRefresh = false, signal) => {
    if (signal?.aborted) return;
    const requestSequence = ++ordersRequestSequenceRef.current;
    if (showRefresh && !signal) setRefreshing(true);
    else if (!showRefresh) setLoading(true);
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
          ...(signal ? { signal } : {}),
          headers: {
            Accept: "application/json",
            Authorization: "Bearer " + token,
          },
        }),
        fetch(API_URL + "/admin/order-options", {
          ...(signal ? { signal } : {}),
          headers: {
            Accept: "application/json",
            Authorization: "Bearer " + token,
          },
        }),
      ]);

      if (signal?.aborted || requestSequence !== ordersRequestSequenceRef.current) return;

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
        return;
      }

      const payload = await response.json();
      if (signal?.aborted || requestSequence !== ordersRequestSequenceRef.current) return;
      if (!response.ok) {
        throw new Error(payload.message || "Unable to load order requests.");
      }
      setOrders(Array.isArray(payload.orders) ? payload.orders : []);
      setMatchingTotal(Number(payload.total) || 0);
      setSummary((current) => ({ ...current, ...(payload.summary || {}) }));
      const optionsPayload = await optionsResponse.json().catch(() => ({}));
      if (signal?.aborted || requestSequence !== ordersRequestSequenceRef.current) return;
      if (optionsResponse.ok) {
        setPickupLocations(Array.isArray(optionsPayload.pickup_locations) ? optionsPayload.pickup_locations : []);
      }
    } catch (loadError) {
      if (!signal?.aborted && loadError?.name !== "AbortError" && requestSequence === ordersRequestSequenceRef.current) {
        setError(loadError.message || "Unable to load order requests.");
      }
    } finally {
      if (!signal?.aborted && requestSequence === ordersRequestSequenceRef.current) {
        setLoading(false);
        if (!signal) setRefreshing(false);
      }
    }
  }, [fromDate, navigate, pickupLocationId, search, status, toDate]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void loadOrders(false, controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
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
  const orderTrend = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      return { key, label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }), count: 0 };
    });
    const byDay = new Map(days.map((day) => [day.key, day]));

    orders.forEach((order) => {
      const date = new Date(order.created_at);
      if (Number.isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const day = byDay.get(key);
      if (day) day.count += 1;
    });

    return days;
  }, [orders]);

  const orderDistribution = useMemo(() => [
    { label: "Placed", value: Number(summary.pending) || 0, tone: "amber" },
    { label: "Accepted", value: Number(summary.confirmed) || 0, tone: "green" },
    { label: "Ready for pickup", value: Number(summary.ready_for_pickup) || 0, tone: "purple" },
    { label: "Completed", value: Number(summary.completed) || 0, tone: "teal" },
    { label: "Cancelled / declined", value: (Number(summary.cancelled) || 0) + (Number(summary.declined) || 0), tone: "red" },
  ], [summary]);

  const orderTrendMax = Math.max(1, ...orderTrend.map((day) => day.count));
  const orderDistributionTotal = orderDistribution.reduce((total, item) => total + item.value, 0);

  return (
    <AdminLayout title="Order Requests">
      <div className="transactions-page">
        <AdminPageHero
          title="Order Requests"
          description="Review order status and the payment and pickup arrangements selected at checkout. Payment is not collected here."
          icon={CreditCard}
          onRefresh={(signal) => loadOrders(true, signal)}
          refreshing={loading || refreshing}
          autoRefreshIntervalMs={120_000}
          autoRefreshKey={`${search}|${status}|${fromDate}|${toDate}|${pickupLocationId}`}
          autoRefreshPaused={searchDraft !== search}
        />

        <section className="transactions-status-grid" aria-label="Order totals">
          {STATUS_CARDS.map(({ key, label, icon, tone }) => (
            <StatusCard
              key={key}
              icon={icon}
              tone={tone}
              label={label}
              value={key === "closed" ? (Number(summary.declined) || 0) + (Number(summary.cancelled) || 0) : summary[key] ?? 0}
            />
          ))}
        </section>

        <section className="transactions-insights-grid" aria-label="Order trends and status distribution">
          <article className="transactions-insight-card transactions-volume-card">
            <div className="transactions-insight-heading">
              <span className="transactions-insight-icon"><Package size={18} aria-hidden="true" /></span>
              <div><h2>Order Volume Trend</h2><p>Orders placed over the last 7 days</p></div>
            </div>
            <div className="transactions-volume-chart" role="img" aria-label={`Daily order counts over the last seven days: ${orderTrend.map((day) => `${day.label}: ${day.count}`).join(", ")}`}>
              {orderTrend.map((day) => (
                <div className="transactions-volume-day" key={day.key}>
                  <strong>{day.count}</strong>
                  <div className="transactions-volume-track"><span style={{ height: `${day.count ? Math.max(8, (day.count / orderTrendMax) * 100) : 0}%` }} /></div>
                  <small>{day.label}</small>
                </div>
              ))}
            </div>
            {matchingTotal > orders.length && <p className="transactions-chart-note">Trend uses the latest {orders.length} matching records. Status totals include all orders.</p>}
          </article>

          <article className="transactions-insight-card transactions-distribution-card">
            <div className="transactions-insight-heading">
              <span className="transactions-insight-icon"><CheckCircle2 size={18} aria-hidden="true" /></span>
              <div><h2>Order Status Distribution</h2><p>Current status of all orders</p></div>
            </div>
            <div className="transactions-distribution-list">
              {orderDistribution.map((item) => (
                <div className="transactions-distribution-row" key={item.label}>
                  <span>{item.label}</span>
                  <div className="transactions-distribution-track" aria-hidden="true"><span className={item.tone} style={{ width: `${orderDistributionTotal ? (item.value / orderDistributionTotal) * 100 : 0}%` }} /></div>
                  <strong>{item.value}</strong>
                  <small>{orderDistributionTotal ? Math.round((item.value / orderDistributionTotal) * 100) : 0}%</small>
                </div>
              ))}
            </div>
          </article>
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
                  <tr><SortableHead field="order_number" sort={sort} onSort={toggleSort}>Order</SortableHead><SortableHead field="buyer" sort={sort} onSort={toggleSort}>Buyer</SortableHead><SortableHead field="seller" sort={sort} onSort={toggleSort}>Seller</SortableHead><SortableHead field="items" sort={sort} onSort={toggleSort}>Items</SortableHead><SortableHead field="total_amount" sort={sort} onSort={toggleSort}>Total</SortableHead><SortableHead field="payment_method" sort={sort} onSort={toggleSort}>Payment method</SortableHead><SortableHead field="pickup_location" sort={sort} onSort={toggleSort}>Pickup location</SortableHead><SortableHead field="status" sort={sort} onSort={toggleSort}>Status</SortableHead><SortableHead field="created_at" sort={sort} onSort={toggleSort}>Placed</SortableHead></tr>
                </thead>
                <tbody>
                  {sortedOrders.map((order) => {
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
