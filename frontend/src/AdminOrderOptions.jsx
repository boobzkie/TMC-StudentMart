import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Coins, Edit3, Info, Loader2, MapPin, Plus, Search, SlidersHorizontal, WalletCards, X } from "lucide-react";

import AdminLayout from "./components/AdminLayout";
import AdminPageHero from "./components/AdminPageHero";
import { API_URL, getAuthHeaders, sortRows } from "./utils/api";

import "./AdminOrderOptions.css";

const EMPTY_FORM = {
  name: "",
  instructions: "",
  building_room: "",
  campus_area: "",
  operating_hours: "",
  is_active: true,
  sort_order: 0,
};

function clearAuthAndRedirect() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("user");
  window.location.href = "/login";
}

function validatePosition(value) {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/.test(raw)) {
    return "Display order must be a whole number from 0 to 65535.";
  }
  const number = Number(raw);
  if (number > 65535) {
    return "Display order must be a whole number from 0 to 65535.";
  }
  return null;
}

const PAGE_SIZE = 5;
const EMPTY_COMMISSION_SUMMARY = {
  total_earned: "0.00",
  total_collected: "0.00",
  total_uncollected: "0.00",
  completed_orders: 0,
  unconfigured_orders: 0,
};

function formatCurrency(value) {
  const amount = Number(value);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function toLocalDateInput(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getAnalyticsDateRange(days) {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(end.getDate() - Number(days) + 1);
  return { fromDate: toLocalDateInput(start), toDate: toLocalDateInput(end) };
}

function isCodMethodName(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "cod" || normalized.includes("cash on delivery") || normalized === "cash at pickup";
}

function sortOptionRecords(records, sort) {
  const [field, direction] = sort.split(":");
  const key = field === "orders" ? "orders_count" : field === "updated" ? "updated_at" : "name";
  return sortRows(records, { key, direction }, (record, sortKey) => record?.[sortKey]);
}

function buildOrderBuckets(orders, days) {
  const range = getAnalyticsDateRange(days);
  const start = new Date(`${range.fromDate}T00:00:00`);
  const bucketCount = 7;
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = new Date(start);
    bucketStart.setDate(start.getDate() + Math.round(((Number(days) - 1) * index) / (bucketCount - 1)));
    return {
      label: bucketStart.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      count: 0,
    };
  });

  orders.forEach((order) => {
    if (!isCodMethodName(order.payment_method?.name)) return;
    const date = new Date(order.created_at);
    if (Number.isNaN(date.getTime())) return;
    const dayOffset = Math.floor((date.setHours(0, 0, 0, 0) - start.getTime()) / 86400000);
    if (dayOffset < 0 || dayOffset >= Number(days)) return;
    const index = Math.min(bucketCount - 1, Math.round((dayOffset * (bucketCount - 1)) / (Number(days) - 1)));
    buckets[index].count += 1;
  });

  return buckets;
}

export default function AdminOrderOptions() {
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [pickupLocations, setPickupLocations] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [periodDays, setPeriodDays] = useState(30);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsRefreshing, setAnalyticsRefreshing] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [paymentSort, setPaymentSort] = useState("name:asc");
  const [paymentPage, setPaymentPage] = useState(1);
  const [locationSearch, setLocationSearch] = useState("");
  const [locationStatus, setLocationStatus] = useState("");
  const [locationSort, setLocationSort] = useState("name:asc");
  const [locationPage, setLocationPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [modalType, setModalType] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadAnalytics = useCallback(async (isRefresh = false) => {
    if (isRefresh) setAnalyticsRefreshing(true);
    else {
      setAnalyticsLoading(true);
      setAnalyticsData(null);
    }
    setAnalyticsError("");

    try {
      const { fromDate, toDate } = getAnalyticsDateRange(periodDays);
      const params = new URLSearchParams({ from_date: fromDate, to_date: toDate });
      const [ordersResponse, commissionResponse] = await Promise.all([
        fetch(`${API_URL}/admin/orders?${params}`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/admin/commission`, { headers: getAuthHeaders() }),
      ]);
      if ([ordersResponse.status, commissionResponse.status].some((status) => status === 401 || status === 403)) {
        clearAuthAndRedirect();
        return;
      }

      const [ordersPayload, commissionPayload] = await Promise.all([
        ordersResponse.json().catch(() => ({})),
        commissionResponse.json().catch(() => ({})),
      ]);
      if (!ordersResponse.ok) throw new Error(ordersPayload.message || "Unable to load recent order activity.");
      if (!commissionResponse.ok) throw new Error(commissionPayload.message || "Unable to load commission totals.");

      setAnalyticsData({
        orders: Array.isArray(ordersPayload.orders) ? ordersPayload.orders : [],
        totalOrders: Number(ordersPayload.total) || 0,
        commission: { ...EMPTY_COMMISSION_SUMMARY, ...(commissionPayload.summary || {}) },
      });
    } catch (loadError) {
      setAnalyticsError(loadError.message || "Unable to load dashboard activity.");
    } finally {
      setAnalyticsLoading(false);
      setAnalyticsRefreshing(false);
    }
  }, [periodDays]);

  const loadOptions = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/admin/order-options`, {
        headers: getAuthHeaders(),
      });
      if (response.status === 401 || response.status === 403) {
        clearAuthAndRedirect();
        return;
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Unable to load order options.");
      setPaymentMethods(Array.isArray(payload.payment_methods) ? payload.payment_methods : []);
      setPickupLocations(Array.isArray(payload.pickup_locations) ? payload.pickup_locations : []);
    } catch (loadError) {
      setError(loadError.message || "Unable to load order options.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadOptions(), 0);
    return () => window.clearTimeout(timer);
  }, [loadOptions]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAnalytics(), 0);
    return () => window.clearTimeout(timer);
  }, [loadAnalytics]);

  const openCreate = (type) => {
    setError("");
    setSuccess("");
    setModalType(type);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const openEdit = (type, item) => {
    setError("");
    setSuccess("");
    setModalType(type);
    setEditing(item);
    setForm({
      ...EMPTY_FORM,
      ...item,
      name: item.name || "",
      instructions: item.instructions || "",
      building_room: item.building_room || "",
      campus_area: item.campus_area || "",
      operating_hours: item.operating_hours || "",
      is_active: Boolean(item.is_active),
      sort_order: Number(item.sort_order) || 0,
    });
  };

  const closeModal = () => {
    if (saving) return;
    setModalType("");
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const submitForm = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!form.name.trim()) {
      setError(modalType === "payment" ? "Enter a payment method name." : "Enter a pickup location name.");
      return;
    }

    const positionError = validatePosition(form.sort_order);
    if (positionError) {
      setError(positionError);
      return;
    }
    const position = Number(String(form.sort_order).trim());

    setSaving(true);
    try {
      const payment = modalType === "payment";
      const base = payment ? "/admin/payment-methods" : "/admin/pickup-locations";
      const body = payment
        ? {
            name: form.name.trim(),
            instructions: form.instructions.trim() || null,
            is_active: Boolean(form.is_active),
            sort_order: position,
          }
        : {
            name: form.name.trim(),
            building_room: form.building_room.trim() || null,
            campus_area: form.campus_area.trim() || null,
            instructions: form.instructions.trim() || null,
            operating_hours: form.operating_hours.trim() || null,
            is_active: Boolean(form.is_active),
            sort_order: position,
          };
      const response = await fetch(`${API_URL}${base}${editing ? `/${editing.id}` : ""}`, {
        method: editing ? "PUT" : "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.status === 401 || response.status === 403) {
        clearAuthAndRedirect();
        return;
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const firstError = Object.values(payload.errors || {}).flat().find(Boolean);
        throw new Error(firstError || payload.message || "Unable to save this option.");
      }
      setSuccess(payload.message || "Order option saved.");
      setModalType("");
      setEditing(null);
      await loadOptions(true);
    } catch (saveError) {
      setError(saveError.message || "Unable to save this option.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (type, item) => {
    setError("");
    setSuccess("");
    if (item.is_active && !window.confirm(`Deactivate “${item.name}”? Existing orders will keep their saved details.`)) return;
    const key = `${type}-${item.id}`;
    setBusyKey(key);
    try {
      const payment = type === "payment";
      const base = payment ? "/admin/payment-methods" : "/admin/pickup-locations";
      const body = payment
        ? { name: item.name, instructions: item.instructions || null, is_active: !item.is_active, sort_order: Number(item.sort_order) || 0 }
        : {
            name: item.name,
            building_room: item.building_room || null,
            campus_area: item.campus_area || null,
            instructions: item.instructions || null,
            operating_hours: item.operating_hours || null,
            is_active: !item.is_active,
            sort_order: Number(item.sort_order) || 0,
          };
      const response = await fetch(`${API_URL}${base}/${item.id}`, {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.status === 401 || response.status === 403) {
        clearAuthAndRedirect();
        return;
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Unable to update the option.");
      setSuccess(payload.message || "Order option updated.");
      await loadOptions(true);
    } catch (toggleError) {
      setError(toggleError.message || "Unable to update the option.");
    } finally {
      setBusyKey("");
    }
  };

  const filteredPaymentMethods = useMemo(() => {
    const query = paymentSearch.trim().toLowerCase();
    const filtered = paymentMethods.filter((item) => {
      const matchesQuery = !query || `${item.name || ""} ${item.instructions || ""}`.toLowerCase().includes(query);
      const matchesStatus = !paymentStatus || (paymentStatus === "active" ? Boolean(item.is_active) : !item.is_active);
      return matchesQuery && matchesStatus;
    });
    return sortOptionRecords(filtered, paymentSort);
  }, [paymentMethods, paymentSearch, paymentSort, paymentStatus]);

  const filteredPickupLocations = useMemo(() => {
    const query = locationSearch.trim().toLowerCase();
    const filtered = pickupLocations.filter((item) => {
      const details = [item.name, item.building_room, item.campus_area, item.operating_hours, item.instructions].filter(Boolean).join(" ").toLowerCase();
      const matchesQuery = !query || details.includes(query);
      const matchesStatus = !locationStatus || (locationStatus === "active" ? Boolean(item.is_active) : !item.is_active);
      return matchesQuery && matchesStatus;
    });
    return sortOptionRecords(filtered, locationSort);
  }, [locationSearch, locationSort, locationStatus, pickupLocations]);

  const paymentPageCount = Math.max(1, Math.ceil(filteredPaymentMethods.length / PAGE_SIZE));
  const locationPageCount = Math.max(1, Math.ceil(filteredPickupLocations.length / PAGE_SIZE));
  const visiblePaymentMethods = filteredPaymentMethods.slice((Math.min(paymentPage, paymentPageCount) - 1) * PAGE_SIZE, Math.min(paymentPage, paymentPageCount) * PAGE_SIZE);
  const visiblePickupLocations = filteredPickupLocations.slice((Math.min(locationPage, locationPageCount) - 1) * PAGE_SIZE, Math.min(locationPage, locationPageCount) * PAGE_SIZE);
  const analyticsOrders = analyticsData?.orders || [];
  const codOrders = analyticsOrders.filter((order) => isCodMethodName(order.payment_method?.name));
  const orderBuckets = buildOrderBuckets(analyticsOrders, periodDays);
  const chartMax = Math.max(1, ...orderBuckets.map((bucket) => bucket.count));
  const chartPoints = orderBuckets.map((bucket, index) => `${index * (700 / Math.max(1, orderBuckets.length - 1))},${174 - (bucket.count / chartMax) * 140}`).join(" ");
  const commission = analyticsData?.commission || EMPTY_COMMISSION_SUMMARY;
  const commissionOwed = Number(commission.total_uncollected);
  const commissionSettled = Number(commission.total_collected);
  const commissionTotal = commissionOwed + commissionSettled;
  const settledPercent = commissionTotal > 0 ? (commissionSettled / commissionTotal) * 100 : 0;
  const activeLocations = pickupLocations.filter((location) => Boolean(location.is_active)).length;
  const activePaymentMethods = paymentMethods.filter((method) => Boolean(method.is_active));
  const codOnly = activePaymentMethods.length === 1 && isCodMethodName(activePaymentMethods[0].name);
  const { fromDate: analyticsFrom, toDate: analyticsTo } = getAnalyticsDateRange(periodDays);
  const analyticsRangeLabel = `${formatDate(`${analyticsFrom}T00:00:00`)} – ${formatDate(`${analyticsTo}T00:00:00`)}`;

  const formTitle = modalType === "payment" ? "Payment method" : "Pickup location";

  return (
    <AdminLayout title="Payment & pickup setup" subtitle="Manage manual payment options, pickup points, and commission activity.">
      <main className="order-options-page">
        <AdminPageHero
          title="Payment & Pickup Setup"
          description="Manage cash on delivery settings, commission activity, and approved pickup locations for the TMC StudentMart marketplace."
          icon={SlidersHorizontal}
          sideContent={(
            <label className="order-options-period">
              <CalendarDays size={16} aria-hidden="true" />
              <span className="sr-only">Analytics date range</span>
              <select value={periodDays} onChange={(event) => setPeriodDays(Number(event.target.value))} aria-label="Analytics date range">
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </label>
          )}
          onRefresh={async () => { await Promise.all([loadOptions(true), loadAnalytics(true)]); }}
          refreshing={loading || refreshing || analyticsLoading || analyticsRefreshing}
        />

        <div className="order-options-notice">
          <Info size={19} aria-hidden="true" />
          <p>{codOnly ? "TMC StudentMart currently supports Cash on Delivery (COD) only." : "Payment options are arranged manually between buyer and seller."} This portal does not collect payment or verify external wallet transfers. Never enter a PIN, password, or banking credential here.</p>
        </div>

        {error && <div className="order-options-alert error" role="alert">{error}<button type="button" onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button></div>}
        {success && <div className="order-options-alert success" role="status">{success}<button type="button" onClick={() => setSuccess("")} aria-label="Dismiss message"><X size={16} /></button></div>}
        {analyticsError && <div className="order-options-alert error" role="alert">Dashboard analytics could not be refreshed: {analyticsError}<button type="button" onClick={() => setAnalyticsError("")} aria-label="Dismiss analytics error"><X size={16} /></button></div>}

        <section className="order-options-summary-grid" aria-label="Payment and commission summary">
          <article className="order-options-summary-card tone-blue"><span className="order-options-summary-icon"><WalletCards size={21} /></span><div><span className="order-options-summary-label">COD orders</span><strong>{analyticsData ? codOrders.length : "—"}</strong><small>{analyticsData ? `Loaded records · ${periodDays} days` : "Analytics unavailable"}</small></div></article>
          <article className="order-options-summary-card tone-purple"><span className="order-options-summary-icon"><MapPin size={21} /></span><div><span className="order-options-summary-label">Active pickup locations</span><strong>{loading ? "—" : activeLocations}</strong><small>{pickupLocations.length} configured location{pickupLocations.length === 1 ? "" : "s"}</small></div></article>
          <article className="order-options-summary-card tone-amber"><span className="order-options-summary-icon"><Coins size={21} /></span><div><span className="order-options-summary-label">Commission owed</span><strong>{analyticsData ? formatCurrency(commissionOwed) : "—"}</strong><small>All-time · not yet collected</small></div></article>
          <article className="order-options-summary-card tone-green"><span className="order-options-summary-icon"><CheckCircle2 size={21} /></span><div><span className="order-options-summary-label">Commission settled</span><strong>{analyticsData ? formatCurrency(commissionSettled) : "—"}</strong><small>All-time · collected</small></div></article>
        </section>

        <section className="order-options-analytics-grid" aria-label="Payment and commission analytics">
          <article className="order-options-panel order-options-trend-panel">
            <div className="order-options-section-heading">
              <div className="order-options-heading-icon"><Activity size={18} /></div>
              <div><h2>COD Orders Trend</h2><p>{analyticsRangeLabel} · Cash on Delivery orders</p></div>
            </div>
            {analyticsLoading && !analyticsData ? (
              <div className="order-options-loading" role="status"><Loader2 className="order-options-spin" size={20} />Loading order activity…</div>
            ) : analyticsData ? (
              <>
                <div className="order-options-chart-wrap">
                  <svg className="order-options-line-chart" viewBox="0 0 700 205" role="img" aria-label={`COD orders trend for the last ${periodDays} days`}>
                    {[34, 80, 126, 174].map((y) => <line key={y} x1="0" y1={y} x2="700" y2={y} className="order-options-chart-gridline" />)}
                    <polyline points={chartPoints} className="order-options-chart-line" />
                    {orderBuckets.map((bucket, index) => <circle key={`${bucket.label}-${index}`} cx={index * (700 / Math.max(1, orderBuckets.length - 1))} cy={174 - (bucket.count / chartMax) * 140} r="4" className="order-options-chart-point"><title>{bucket.label}: {bucket.count} COD orders</title></circle>)}
                  </svg>
                  <div className="order-options-chart-labels">{orderBuckets.map((bucket, index) => <span key={`${bucket.label}-${index}`}>{bucket.label}</span>)}</div>
                </div>
                <p className="order-options-chart-note"><span className="order-options-chart-key" />{codOrders.length} COD orders in {analyticsData.orders.length} returned record{analyticsData.orders.length === 1 ? "" : "s"}.{analyticsData.totalOrders > analyticsData.orders.length ? ` Showing ${analyticsData.orders.length} of ${analyticsData.totalOrders} matching orders (API limit: 200).` : ""}</p>
              </>
            ) : <div className="order-options-empty"><Activity size={22} /><strong>No order analytics available</strong><span>Refresh to try loading recent order activity.</span></div>}
          </article>

          <article className="order-options-panel order-options-commission-panel">
            <div className="order-options-section-heading">
              <div className="order-options-heading-icon tone-amber"><Coins size={18} /></div>
              <div><h2>Commission Status</h2><p>All-time platform commission totals</p></div>
            </div>
            {analyticsData ? (
              <div className="order-options-commission-content">
                <div className="order-options-donut" style={{ background: commissionTotal > 0 ? `conic-gradient(var(--tmc-admin-success) 0 ${settledPercent}%, var(--tmc-admin-warning) ${settledPercent}% 100%)` : "var(--tmc-admin-surface-muted)" }} role="img" aria-label={`${settledPercent.toFixed(0)} percent settled commission`}>
                  <div><strong>{formatCurrency(commissionTotal)}</strong><span>Total commission</span></div>
                </div>
                <div className="order-options-commission-legend">
                  <div><span className="legend-dot owed" /><span>Owed</span><strong>{formatCurrency(commissionOwed)}</strong><small>{commissionTotal ? `${Math.round(100 - settledPercent)}%` : "0%"}</small></div>
                  <div><span className="legend-dot settled" /><span>Settled</span><strong>{formatCurrency(commissionSettled)}</strong><small>{commissionTotal ? `${Math.round(settledPercent)}%` : "0%"}</small></div>
                </div>
              </div>
            ) : <div className="order-options-empty"><Coins size={22} /><strong>Commission totals unavailable</strong><span>Refresh to try loading commission data.</span></div>}
            <p className="order-options-chart-note">Commission figures are all-time totals returned by the existing commission service.</p>
          </article>
        </section>

        {loading ? (
          <div className="order-options-loading" role="status"><Loader2 className="order-options-spin" size={22} />Loading configured options…</div>
        ) : (
          <section className="order-options-management-grid" aria-label="Manage payment methods and pickup locations">
            <article className="order-options-panel order-options-management-panel">
              <div className="order-options-panel-heading">
                <div className="order-options-section-heading"><div className="order-options-heading-icon"><WalletCards size={18} /></div><div><h2>Payment Methods</h2><p>Configure approved manual payment options.</p></div></div>
                <button type="button" className="order-options-primary" onClick={() => openCreate("payment")}><Plus size={16} />Add method</button>
              </div>
              <div className="order-options-table-toolbar">
                <label className="order-options-search"><Search size={15} /><span className="sr-only">Search payment methods</span><input value={paymentSearch} onChange={(event) => { setPaymentSearch(event.target.value); setPaymentPage(1); }} placeholder="Search payment methods…" /></label>
                <label><span className="sr-only">Filter payment methods by status</span><select value={paymentStatus} onChange={(event) => { setPaymentStatus(event.target.value); setPaymentPage(1); }}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
                <label><span className="sr-only">Sort payment methods</span><select value={paymentSort} onChange={(event) => setPaymentSort(event.target.value)}><option value="name:asc">Name A–Z</option><option value="orders:desc">Most saved orders</option><option value="updated:desc">Recently updated</option></select></label>
                <button type="button" className="order-options-reset" onClick={() => { setPaymentSearch(""); setPaymentStatus(""); setPaymentSort("name:asc"); setPaymentPage(1); }}>Reset</button>
              </div>
              <div className="order-options-table-wrap">
                <table className="order-options-table"><thead><tr><th scope="col">Method</th><th scope="col">Status</th><th scope="col">Saved orders</th><th scope="col">Updated</th><th scope="col">Actions</th></tr></thead>
                  <tbody>{visiblePaymentMethods.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><small>{item.instructions || "Manual arrangement"}</small></td><td><span className={`order-option-status ${item.is_active ? "active" : "inactive"}`}>{item.is_active ? "Active" : "Inactive"}</span></td><td>{Number(item.orders_count) || 0}</td><td>{formatDate(item.updated_at)}</td><td><div className="order-options-row-actions"><button type="button" onClick={() => openEdit("payment", item)} aria-label={`Edit ${item.name}`}><Edit3 size={15} />Edit</button><button type="button" onClick={() => void toggleActive("payment", item)} disabled={busyKey === `payment-${item.id}`} aria-label={`${item.is_active ? "Deactivate" : "Activate"} ${item.name}`}>{busyKey === `payment-${item.id}` ? <Loader2 size={15} className="order-options-spin" /> : item.is_active ? "Deactivate" : "Activate"}</button></div></td></tr>)}</tbody>
                </table>
                {filteredPaymentMethods.length === 0 && <div className="order-options-empty order-options-table-empty"><WalletCards size={22} /><strong>{paymentMethods.length ? "No matching methods" : "No methods configured"}</strong><span>{paymentMethods.length ? "Adjust the search or filters." : "Add an approved method before students can submit orders."}</span></div>}
              </div>
              <div className="order-options-table-footer"><span>Showing {filteredPaymentMethods.length ? (Math.min(paymentPage, paymentPageCount) - 1) * PAGE_SIZE + 1 : 0}–{Math.min(Math.min(paymentPage, paymentPageCount) * PAGE_SIZE, filteredPaymentMethods.length)} of {filteredPaymentMethods.length} methods</span><div><button type="button" onClick={() => setPaymentPage((page) => Math.max(1, page - 1))} disabled={Math.min(paymentPage, paymentPageCount) <= 1} aria-label="Previous payment methods page"><ChevronLeft size={16} /></button><span>{Math.min(paymentPage, paymentPageCount)} / {paymentPageCount}</span><button type="button" onClick={() => setPaymentPage((page) => Math.min(paymentPageCount, page + 1))} disabled={Math.min(paymentPage, paymentPageCount) >= paymentPageCount} aria-label="Next payment methods page"><ChevronRight size={16} /></button></div></div>
            </article>

            <article className="order-options-panel order-options-management-panel">
              <div className="order-options-panel-heading">
                <div className="order-options-section-heading"><div className="order-options-heading-icon"><MapPin size={18} /></div><div><h2>Pickup Locations</h2><p>Manage approved campus and meetup locations.</p></div></div>
                <button type="button" className="order-options-primary" onClick={() => openCreate("pickup")}><Plus size={16} />Add location</button>
              </div>
              <div className="order-options-table-toolbar">
                <label className="order-options-search"><Search size={15} /><span className="sr-only">Search pickup locations</span><input value={locationSearch} onChange={(event) => { setLocationSearch(event.target.value); setLocationPage(1); }} placeholder="Search locations…" /></label>
                <label><span className="sr-only">Filter pickup locations by status</span><select value={locationStatus} onChange={(event) => { setLocationStatus(event.target.value); setLocationPage(1); }}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
                <label><span className="sr-only">Sort pickup locations</span><select value={locationSort} onChange={(event) => setLocationSort(event.target.value)}><option value="name:asc">Name A–Z</option><option value="orders:desc">Most saved orders</option><option value="updated:desc">Recently updated</option></select></label>
                <button type="button" className="order-options-reset" onClick={() => { setLocationSearch(""); setLocationStatus(""); setLocationSort("name:asc"); setLocationPage(1); }}>Reset</button>
              </div>
              <div className="order-options-table-wrap">
                <table className="order-options-table"><thead><tr><th scope="col">Location</th><th scope="col">Status</th><th scope="col">Saved orders</th><th scope="col">Updated</th><th scope="col">Actions</th></tr></thead>
                  <tbody>{visiblePickupLocations.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><small>{[item.building_room, item.campus_area].filter(Boolean).join(" · ") || "Area not specified"}{item.operating_hours ? ` · ${item.operating_hours}` : ""}</small></td><td><span className={`order-option-status ${item.is_active ? "active" : "inactive"}`}>{item.is_active ? "Active" : "Inactive"}</span></td><td>{Number(item.orders_count) || 0}</td><td>{formatDate(item.updated_at)}</td><td><div className="order-options-row-actions"><Link to={`/admin/transactions?pickup_location_id=${item.id}`} aria-label={`View orders for ${item.name}`}>View orders</Link><button type="button" onClick={() => openEdit("pickup", item)} aria-label={`Edit ${item.name}`}><Edit3 size={15} />Edit</button><button type="button" onClick={() => void toggleActive("pickup", item)} disabled={busyKey === `pickup-${item.id}`} aria-label={`${item.is_active ? "Deactivate" : "Activate"} ${item.name}`}>{busyKey === `pickup-${item.id}` ? <Loader2 size={15} className="order-options-spin" /> : item.is_active ? "Deactivate" : "Activate"}</button></div></td></tr>)}</tbody>
                </table>
                {filteredPickupLocations.length === 0 && <div className="order-options-empty order-options-table-empty"><MapPin size={22} /><strong>{pickupLocations.length ? "No matching locations" : "No pickup locations configured"}</strong><span>{pickupLocations.length ? "Adjust the search or filters." : "Students cannot select a pickup point until Admin adds one."}</span></div>}
              </div>
              <div className="order-options-table-footer"><span>Showing {filteredPickupLocations.length ? (Math.min(locationPage, locationPageCount) - 1) * PAGE_SIZE + 1 : 0}–{Math.min(Math.min(locationPage, locationPageCount) * PAGE_SIZE, filteredPickupLocations.length)} of {filteredPickupLocations.length} locations</span><div><button type="button" onClick={() => setLocationPage((page) => Math.max(1, page - 1))} disabled={Math.min(locationPage, locationPageCount) <= 1} aria-label="Previous pickup locations page"><ChevronLeft size={16} /></button><span>{Math.min(locationPage, locationPageCount)} / {locationPageCount}</span><button type="button" onClick={() => setLocationPage((page) => Math.min(locationPageCount, page + 1))} disabled={Math.min(locationPage, locationPageCount) >= locationPageCount} aria-label="Next pickup locations page"><ChevronRight size={16} /></button></div></div>
            </article>
          </section>
        )}
      </main>

      {modalType && <div className="order-options-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}><section className="order-options-modal" role="dialog" aria-modal="true" aria-labelledby="order-option-modal-title"><header><div><span className="order-options-eyebrow">ORDER CONFIGURATION</span><h2 id="order-option-modal-title">{editing ? "Edit" : "Add"} {formTitle.toLowerCase()}</h2></div><button type="button" onClick={closeModal} aria-label="Close dialog"><X size={19} /></button></header><form onSubmit={submitForm}><label>Name<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} maxLength={modalType === "payment" ? 100 : 120} required /></label>{modalType === "pickup" && <div className="order-options-form-row"><label>Building / room<input value={form.building_room} onChange={(event) => setForm((current) => ({ ...current, building_room: event.target.value }))} maxLength="120" /></label><label>Campus / area<input value={form.campus_area} onChange={(event) => setForm((current) => ({ ...current, campus_area: event.target.value }))} maxLength="120" /></label></div>}{modalType === "pickup" && <label>Operating hours<input value={form.operating_hours} onChange={(event) => setForm((current) => ({ ...current, operating_hours: event.target.value }))} maxLength="120" placeholder="Optional" /></label>}<label>{modalType === "payment" ? "Manual payment instructions" : "Handover instructions"}<textarea value={form.instructions} onChange={(event) => setForm((current) => ({ ...current, instructions: event.target.value }))} rows="3" maxLength="2000" placeholder={modalType === "payment" ? "Explain how buyer and seller arrange this method. Do not request credentials." : "Optional directions or handover notes."} /></label><label>Display order<input type="number" min="0" max="65535" value={form.sort_order} onChange={(event) => setForm((current) => ({ ...current, sort_order: event.target.value }))} /></label><label className="order-options-active-toggle"><input type="checkbox" checked={Boolean(form.is_active)} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} /><span>Available for new orders</span></label>{error && <div className="order-options-inline-error" role="alert">{error}</div>}<footer><button type="button" className="order-options-secondary" onClick={closeModal} disabled={saving}>Cancel</button><button type="submit" className="order-options-primary" disabled={saving}>{saving ? <Loader2 size={16} className="order-options-spin" /> : <CheckCircle2 size={16} />}{saving ? "Saving…" : "Save option"}</button></footer></form></section></div>}
    </AdminLayout>
  );
}
