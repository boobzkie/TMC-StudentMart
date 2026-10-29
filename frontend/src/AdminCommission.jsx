import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgePercent,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock3,
  Coins,
  Pencil,
  Power,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import AdminLayout from "./components/AdminLayout";
import AdminPageHero from "./components/AdminPageHero";
import { API_URL } from "./utils/api";

import "./AdminCommission.css";

const EMPTY_SUMMARY = {
  total_earned: "0.00",
  total_collected: "0.00",
  total_uncollected: "0.00",
  unconfigured_orders: 0,
  completed_orders: 0,
};

const RECORD_PAGE_SIZES = [10, 25, 50];
const RATE_HISTORY_PREVIEW_COUNT = 3;
const CHART_STATUSES = [
  "collected",
  "uncollected",
  "not_due",
  "unconfigured",
  "historical_unrated",
  "unknown",
];

function formatCurrency(value) {
  const amount = Number(value);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString();
}

function formatRate(value) {
  if (value === null || value === undefined) return "Not configured";
  return `${Number(value).toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

function statusLabel(status) {
  const labels = {
    uncollected: "Earned · not collected",
    collected: "Collected",
    not_due: "No commission due",
    unconfigured: "Rate not configured",
    historical_unrated: "Historical · no rate snapshot",
  };
  return labels[status] || "Unknown";
}

function AdminCommission() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [currentRate, setCurrentRate] = useState(null);
  const [rates, setRates] = useState([]);
  const [showAllRates, setShowAllRates] = useState(false);
  const [records, setRecords] = useState([]);
  const [tax, setTax] = useState({ status: "unconfigured", message: "Tax is not configured." });
  const [rateDraft, setRateDraft] = useState("");
  const [editingRateId, setEditingRateId] = useState(null);
  const [collectionDraft, setCollectionDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingRate, setSavingRate] = useState(false);
  const [deactivatingRateId, setDeactivatingRateId] = useState(null);
  const [savingCollection, setSavingCollection] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [recordSearch, setRecordSearch] = useState("");
  const [recordStatusFilter, setRecordStatusFilter] = useState("all");
  const [recordDateFilter, setRecordDateFilter] = useState("all");
  const [recordPageSize, setRecordPageSize] = useState(RECORD_PAGE_SIZES[0]);
  const [recordPage, setRecordPage] = useState(1);
  const [referenceTime, setReferenceTime] = useState(null);
  const requestSequenceRef = useRef(0);

  const loadData = useCallback(async (showRefresh = false, signal) => {
    if (signal?.aborted) return;
    const requestSequence = ++requestSequenceRef.current;
    if (showRefresh && !signal) setRefreshing(true);
    else if (!showRefresh) setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login", { replace: true });
        return;
      }

      const response = await fetch(API_URL + "/admin/commission", {
        ...(signal ? { signal } : {}),
        headers: {
          Accept: "application/json",
          Authorization: "Bearer " + token,
        },
      });

      if (signal?.aborted || requestSequence !== requestSequenceRef.current) return;

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
        return;
      }

      const payload = await response.json();
      if (signal?.aborted || requestSequence !== requestSequenceRef.current) return;
      if (!response.ok) {
        throw new Error(payload.message || "Unable to load commission records.");
      }

      setSummary({ ...EMPTY_SUMMARY, ...(payload.summary || {}) });
      setCurrentRate(payload.current_rate || null);
      setRates(Array.isArray(payload.rates) ? payload.rates : []);
      setRecords(Array.isArray(payload.records) ? payload.records : []);
      setTax(payload.tax || { status: "unconfigured", message: "Tax is not configured." });
      setHasLoaded(true);
    } catch (loadError) {
      if (!signal?.aborted && loadError?.name !== "AbortError" && requestSequence === requestSequenceRef.current) {
        setError(loadError.message || "Unable to load commission records.");
      }
    } finally {
      if (!signal?.aborted && requestSequence === requestSequenceRef.current) {
        setLoading(false);
        if (!signal) setRefreshing(false);
      }
    }
  }, [navigate]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void loadData(false, controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadData]);

  const saveRate = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const parsedRate = Number(rateDraft);
    if (!Number.isFinite(parsedRate) || parsedRate < 0 || parsedRate > 100) {
      setError("Enter a commission rate between 0 and 100 percent.");
      return;
    }

    const rateLabel = `${parsedRate}%`;
    const isEditing = editingRateId !== null;
    const confirmation = isEditing
      ? `Update the commission rate to ${rateLabel} now?`
      : `Activate a ${rateLabel} commission rate now?`;
    if (!window.confirm(`${confirmation} This creates a new effective version and only affects orders completed from now on. Earlier history and order snapshots remain unchanged.`)) {
      return;
    }

    setSavingRate(true);
    try {
      const response = await fetch(
        isEditing
          ? `${API_URL}/admin/commission/rates/${editingRateId}`
          : API_URL + "/admin/commission/rates",
        {
          method: isEditing ? "PUT" : "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: "Bearer " + localStorage.getItem("token"),
          },
          body: JSON.stringify({ rate_percent: parsedRate }),
        },
      );
      const payload = await response.json();
      if (!response.ok) {
        const firstError = Object.values(payload.errors || {})[0];
        throw new Error(firstError?.[0] || payload.message || "Unable to save the commission rate.");
      }

      setRateDraft("");
      setEditingRateId(null);
      setSuccess(payload.message || (isEditing ? "Commission rate updated." : "Commission rate activated."));
      await loadData(true);
    } catch (saveError) {
      setError(saveError.message || "Unable to save the commission rate.");
    } finally {
      setSavingRate(false);
    }
  };

  const editRate = (rate) => {
    setError("");
    setSuccess("");
    setRateDraft(String(Number(rate.rate_percent)));
    setEditingRateId(rate.id);
  };

  const cancelRateEdit = () => {
    setRateDraft("");
    setEditingRateId(null);
  };

  const deactivateRate = async (rate) => {
    if (!window.confirm("Deactivate the current commission rate? Orders completed from now on will have no commission due. The rate history and completed-order snapshots will be preserved.")) {
      return;
    }

    setError("");
    setSuccess("");
    setDeactivatingRateId(rate.id);
    try {
      const response = await fetch(`${API_URL}/admin/commission/rates/${rate.id}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
      });
      const payload = await response.json();
      if (!response.ok) {
        const firstError = Object.values(payload.errors || {})[0];
        throw new Error(firstError?.[0] || payload.message || "Unable to deactivate the commission rate.");
      }

      cancelRateEdit();
      setSuccess(payload.message || "Commission rate deactivated for future orders.");
      await loadData(true);
    } catch (deactivationError) {
      setError(deactivationError.message || "Unable to deactivate the commission rate.");
    } finally {
      setDeactivatingRateId(null);
    }
  };

  const saveCollection = async (event) => {
    event.preventDefault();
    if (!collectionDraft) return;

    setError("");
    setSuccess("");
    setSavingCollection(true);
    try {
      const response = await fetch(`${API_URL}/admin/order-commissions/${collectionDraft.id}/collect`, {
        method: "PUT",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: JSON.stringify({
          confirmed: true,
          collection_reference: collectionDraft.reference.trim() || null,
          collection_note: collectionDraft.note.trim() || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const firstError = Object.values(payload.errors || {})[0];
        throw new Error(firstError?.[0] || payload.message || "Unable to record commission collection.");
      }

      setCollectionDraft(null);
      setSuccess(payload.message || "Commission collection recorded.");
      await loadData(true);
    } catch (saveError) {
      setError(saveError.message || "Unable to record commission collection.");
    } finally {
      setSavingCollection(false);
    }
  };

  const metricsPending = loading && !hasLoaded;
  const metricsUnavailable = !loading && !hasLoaded;
  const taxStatusLabel = metricsPending ? "Loading" : metricsUnavailable ? "Unavailable" : "Not configured";
  const taxSummary = metricsPending
    ? "Tax information is loading."
    : metricsUnavailable
      ? "Tax information could not be loaded."
      : "No approved tax rule is active; tax is not calculated or added to orders.";
  const filteredRecords = useMemo(() => {
    const query = recordSearch.trim().toLocaleLowerCase();
    const rangeDays = Number(recordDateFilter);
    const cutoff = referenceTime !== null && Number.isFinite(rangeDays) && rangeDays > 0
      ? referenceTime - rangeDays * 24 * 60 * 60 * 1000
      : null;

    return records.filter((record) => {
      const rawStatus = typeof record.status === "string" ? record.status : "unknown";
      const status = CHART_STATUSES.includes(rawStatus) ? rawStatus : "unknown";
      if (recordStatusFilter !== "all" && status !== recordStatusFilter) return false;

      if (recordDateFilter !== "all" && cutoff === null) return false;
      if (cutoff !== null) {
        const completedAt = new Date(record.completed_at).getTime();
        if (!Number.isFinite(completedAt) || completedAt < cutoff) return false;
      }

      if (!query) return true;
      const searchable = [
        record.order_number,
        record.seller,
        record.collector,
        record.collection_reference,
      ].filter(Boolean).join(" ").toLocaleLowerCase();
      return searchable.includes(query);
    });
  }, [records, recordDateFilter, recordSearch, recordStatusFilter, referenceTime]);
  const chartData = useMemo(() => {
    const counts = Object.fromEntries(CHART_STATUSES.map((status) => [status, 0]));
    filteredRecords.forEach((record) => {
      const status = CHART_STATUSES.includes(record.status) ? record.status : "unknown";
      counts[status] += 1;
    });
    const maxCount = Math.max(1, ...Object.values(counts));
    return CHART_STATUSES.map((status) => ({
      status,
      label: status === "unknown" ? "Other / unknown" : statusLabel(status),
      count: counts[status],
      width: `${(counts[status] / maxCount) * 100}%`,
    }));
  }, [filteredRecords]);
  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / recordPageSize));
  const visiblePage = Math.min(recordPage, pageCount);
  const firstVisibleRecord = filteredRecords.length === 0
    ? 0
    : (visiblePage - 1) * recordPageSize + 1;
  const lastVisibleRecord = Math.min(visiblePage * recordPageSize, filteredRecords.length);
  const visibleRecords = filteredRecords.slice(firstVisibleRecord - 1, lastVisibleRecord);

  const clearRecordFilters = () => {
    setRecordSearch("");
    setRecordStatusFilter("all");
    setRecordDateFilter("all");
    setRecordPage(1);
  };

  return (
    <AdminLayout title="Commission">
      <div className="commission-page">
        <AdminPageHero
          title="Commission & tax tracking"
          description="Review commissions from completed orders and record manual collection."
          icon={Coins}
          onRefresh={(signal) => loadData(true, signal)}
          refreshing={loading || refreshing}
          autoRefreshIntervalMs={120_000}
          autoRefreshKey="commission"
          autoRefreshPaused={Boolean(rateDraft || editingRateId || collectionDraft || savingRate || savingCollection || deactivatingRateId)}
        />

        {error && <div className="commission-alert error" role="alert">{error}</div>}
        {success && <div className="commission-alert success" role="status">{success}</div>}

        <p className="commission-summary-note">
          The commission summary cards show all-time ledger totals. Record filters below only affect the rows and chart in this view.
        </p>
        <section className="commission-overview-grid" aria-label="All-time commission summary">
          <MetricCard
            icon={Coins}
            label="Commission earned"
            value={metricsPending ? "Loading…" : metricsUnavailable ? "Unavailable" : formatCurrency(summary.total_earned)}
            description="Recorded from completed orders"
            loading={metricsPending}
          />
          <MetricCard
            icon={CheckCircle2}
            label="Commission collected"
            value={metricsPending ? "Loading…" : metricsUnavailable ? "Unavailable" : formatCurrency(summary.total_collected)}
            description="Amounts confirmed as received"
            loading={metricsPending}
          />
          <MetricCard
            icon={Clock3}
            label="Awaiting collection"
            value={metricsPending ? "Loading…" : metricsUnavailable ? "Unavailable" : formatCurrency(summary.total_uncollected)}
            description="Recorded but not yet received"
            loading={metricsPending}
          />
          <MetricCard
            icon={BadgePercent}
            label="Active rate"
            value={metricsPending ? "Loading…" : metricsUnavailable ? "Unavailable" : currentRate ? formatRate(currentRate.rate_percent) : "Not configured"}
            description="Used for future completed orders"
            loading={metricsPending}
          />
        </section>

        <section className="commission-panel commission-config-panel">
          <div className="commission-section-heading">
            <div>
              <span className="commission-eyebrow">ADMIN POLICY</span>
              <h3>Commission rate</h3>
            </div>
            <span className="commission-current-rate">
              {metricsPending
                ? "Loading rate…"
                : metricsUnavailable
                  ? "Rate unavailable"
                  : currentRate
                    ? `Current: ${formatRate(currentRate.rate_percent)}`
                    : "No rate active"}
            </span>
          </div>
          <p className="commission-muted-copy">A new rate takes effect immediately for orders completed from that time forward. Existing rate snapshots are kept unchanged. Commission is based on the order total and is recorded when the seller completes the handover.</p>
          <form className="commission-rate-form" onSubmit={saveRate}>
            <label>
              <span>{editingRateId === null ? "New commission rate (%)" : "Updated commission rate (%)"}</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.0001"
                inputMode="decimal"
                value={rateDraft}
                onChange={(event) => setRateDraft(event.target.value)}
                placeholder={editingRateId === null ? "Enter an Admin-approved rate" : "Enter the replacement rate"}
                required
                disabled={savingRate || deactivatingRateId !== null}
              />
            </label>
            <button type="submit" className="commission-primary-button" disabled={savingRate || deactivatingRateId !== null || !rateDraft}>
              <Save size={16} />
              {savingRate ? "Saving" : editingRateId === null ? "Activate rate" : "Save new version"}
            </button>
            {editingRateId !== null && (
              <button
                type="button"
                className="commission-secondary-button"
                onClick={cancelRateEdit}
                disabled={savingRate || deactivatingRateId !== null}
              >
                <X size={16} />
                Cancel
              </button>
            )}
          </form>
          <div className="commission-rate-guidance" role="note">
            <ShieldCheck size={17} aria-hidden="true" />
            <p>
              <strong>Recommendation:</strong> Verify each rate against the
              approved TMC finance policy before activating it. A change applies
              to future completed orders only.
            </p>
          </div>
          <div className="commission-history-heading">
            <strong>Rate history</strong>
            <span>
              Audit history cannot be deleted. Only the active rate can be
              deactivated; past order snapshots remain unchanged.
            </span>
          </div>
          {metricsPending ? (
            <p className="commission-inline-empty" role="status">Loading rate history…</p>
          ) : metricsUnavailable ? (
            <p className="commission-inline-empty" role="status">Rate history is unavailable. Refresh the page to try again.</p>
          ) : rates.length > 0 ? (
            <div className="commission-rate-list">
              {rates.slice(0, showAllRates ? rates.length : RATE_HISTORY_PREVIEW_COUNT).map((rate) => (
                <div className="commission-rate-row" key={rate.id}>
                  <strong>{rate.is_deactivation ? "Deactivated" : formatRate(rate.rate_percent)}</strong>
                  <span>Effective {formatDate(rate.effective_at)}</span>
                  <small>{rate.is_deactivation ? "Deactivated by" : "Configured by"} {rate.configured_by || "Admin account"}</small>
                  {currentRate?.id === rate.id && !rate.is_deactivation && (
                    <div className="commission-rate-actions">
                      <button
                        type="button"
                        className="commission-rate-action"
                        aria-label={`Edit active commission rate ${formatRate(rate.rate_percent)}`}
                        title="Edit active rate"
                        onClick={() => editRate(rate)}
                        disabled={savingRate || deactivatingRateId !== null}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        className="commission-rate-action deactivate"
                        aria-label={`Deactivate ${formatRate(rate.rate_percent)} for future orders`}
                        title="Deactivate rate for future orders"
                        onClick={() => deactivateRate(rate)}
                        disabled={savingRate || deactivatingRateId !== null}
                      >
                        {deactivatingRateId === rate.id ? <span className="commission-action-spinner" aria-hidden="true" /> : <Power size={15} />}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : <p className="commission-inline-empty">No commission rate has been configured.</p>}
          {!metricsPending && !metricsUnavailable && rates.length > RATE_HISTORY_PREVIEW_COUNT && (
            <div className="commission-history-controls">
              <span>
                Showing {showAllRates ? rates.length : RATE_HISTORY_PREVIEW_COUNT} of {rates.length} rate-history records.
              </span>
              <button
                type="button"
                className="commission-secondary-button"
                aria-expanded={showAllRates}
                onClick={() => setShowAllRates((visible) => !visible)}
              >
                {showAllRates ? "Show recent only" : `View all ${rates.length} records`}
              </button>
            </div>
          )}
        </section>

        <details className="commission-panel commission-tax-notice">
          <summary className="commission-tax-summary">
            <span className="commission-tax-icon"><AlertTriangle size={20} aria-hidden="true" /></span>
            <span className="commission-tax-summary-copy">
              <strong>Tax configuration</strong>
              <span>{taxSummary}</span>
            </span>
            <span className={`commission-status-badge ${metricsUnavailable ? "status-unavailable" : "status-unconfigured"}`}>
              {taxStatusLabel}
            </span>
            <ChevronDown className="commission-tax-chevron" size={17} aria-hidden="true" />
          </summary>
          <div className="commission-tax-details">
            <p>
              {metricsPending
                ? "Tax information will appear when commission records finish loading."
                : metricsUnavailable
                  ? "Refresh the page to try loading the tax status again."
                  : `${tax.message || "No approved tax rule has been configured."} No tax is added to orders, withheld, or reported as collected. Configure tax only after the applicable rule and responsible party are approved.`}
            </p>
          </div>
        </details>

        <section className="commission-panel commission-records-panel">
          <div className="commission-section-heading">
            <div>
              <span className="commission-eyebrow">ORDER LEDGER</span>
              <h3>Completed order commissions</h3>
            </div>
            <span className="commission-current-rate">
              {metricsPending
                ? "Loading order count…"
                : metricsUnavailable
                  ? "Order count unavailable"
                  : `${summary.completed_orders} completed orders`}
            </span>
          </div>
          <p className="commission-muted-copy">Mark a commission collected only after the amount has actually been received. The collector and timestamp are saved for audit.</p>

          <div className="commission-record-toolbar" role="group" aria-label="Commission record filters">
            <label className="commission-filter-control commission-search-control">
              <span>Search records</span>
              <span className="commission-search-field">
                <Search size={16} aria-hidden="true" />
                <input
                  type="search"
                  value={recordSearch}
                  onChange={(event) => {
                    setRecordSearch(event.target.value);
                    setRecordPage(1);
                  }}
                  placeholder="Order, seller, collector, or reference"
                  aria-label="Search order, seller, collector, or collection reference"
                />
              </span>
            </label>
            <label className="commission-filter-control">
              <span>Collection status</span>
              <select
                value={recordStatusFilter}
                onChange={(event) => {
                  setRecordStatusFilter(event.target.value);
                  setRecordPage(1);
                }}
              >
                <option value="all">All statuses</option>
                {CHART_STATUSES.map((status) => (
                  <option key={status} value={status}>{status === "unknown" ? "Other / unknown" : statusLabel(status)}</option>
                ))}
              </select>
            </label>
            <label className="commission-filter-control">
              <span>Completion date</span>
              <select
                value={recordDateFilter}
                onChange={(event) => {
                  setRecordDateFilter(event.target.value);
                  setReferenceTime(Date.now());
                  setRecordPage(1);
                }}
              >
                <option value="all">All available dates</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">Last 12 months</option>
              </select>
            </label>
            {(recordSearch || recordStatusFilter !== "all" || recordDateFilter !== "all") && (
              <button type="button" className="commission-secondary-button commission-clear-filters" onClick={clearRecordFilters}>
                <RotateCcw size={15} aria-hidden="true" />
                Clear filters
              </button>
            )}
          </div>

          <p className="commission-record-scope">
            The API provides up to 200 of the most recent completed orders for this table. Filters and chart use those loaded records; totals above remain all-time.
          </p>

          {hasLoaded && (
            <section
              className="commission-status-chart"
              aria-label="Commission record status chart"
            >
              <div className="commission-status-chart-heading">
                <div>
                  <h4>Commission records by status</h4>
                  <p>Counts for the records matching the filters above.</p>
                </div>
                <span>{filteredRecords.length} {filteredRecords.length === 1 ? "record" : "records"}</span>
              </div>
              {filteredRecords.length === 0 ? (
                <p className="commission-chart-empty" role="status">
                  {records.length === 0
                    ? "No completed-order records are available to chart yet."
                    : "No commission records match the selected filters."}
                </p>
              ) : (
                <div
                  className="commission-status-chart-bars"
                  role="img"
                  aria-label={`Filtered commission record counts: ${chartData.map(({ label, count }) => `${label}: ${count}`).join(", ")}`}
                >
                  {chartData.filter(({ count }) => count > 0).map(({ status, label, count, width }) => (
                    <div className="commission-status-bar-row" key={status}>
                      <span>{label}</span>
                      <span className="commission-status-bar-track" aria-hidden="true">
                        <span className={`commission-status-bar-fill status-${status}`} style={{ width }} />
                      </span>
                      <strong>{count}</strong>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {loading ? (
            <div className="commission-table-message" role="status">Loading commission records…</div>
          ) : !hasLoaded ? (
            <div className="commission-table-message" role="status">Commission records are unavailable. Refresh the page to try again.</div>
          ) : records.length === 0 ? (
            <div className="commission-table-message">No completed orders yet. Commission records will appear after an order is completed.</div>
          ) : filteredRecords.length === 0 ? (
            <div className="commission-table-message">
              <span>No records match these filters.</span>
              <button type="button" className="commission-secondary-button" onClick={clearRecordFilters}>Clear filters</button>
            </div>
          ) : (
            <div className="commission-table-wrap">
              <p className="commission-table-scroll-hint">On smaller screens, scroll the table horizontally to view all columns.</p>
              <table className="commission-table">
                <thead>
                  <tr>
                    <th scope="col">Order / seller</th>
                    <th scope="col">Completed</th>
                    <th scope="col">Sale total</th>
                    <th scope="col">Rate</th>
                    <th scope="col">Commission</th>
                    <th scope="col">Collection</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRecords.map((record) => (
                    <tr key={record.order_id}>
                      <td><strong>{record.order_number}</strong><small>{record.seller}</small></td>
                      <td>{formatDate(record.completed_at)}</td>
                      <td>{formatCurrency(record.sale_amount)}</td>
                      <td>{formatRate(record.rate_percent)}</td>
                      <td>{record.commission_amount === null ? "—" : formatCurrency(record.commission_amount)}</td>
                      <td>
                        <span className={`commission-status-badge status-${record.status}`}>{statusLabel(record.status)}</span>
                        {record.collected_at && <small className="commission-cell-detail">{formatDate(record.collected_at)}{record.collector ? ` · ${record.collector}` : ""}</small>}
                        {record.collection_reference && <small className="commission-cell-detail">Ref: {record.collection_reference}</small>}
                      </td>
                      <td>
                        {record.status === "uncollected" ? (
                          <button type="button" className="commission-collect-button" aria-label={`Record commission collection for ${record.order_number}`} onClick={() => setCollectionDraft({ id: record.id, orderNumber: record.order_number, amount: record.commission_amount, reference: "", note: "" })}>
                            Record collection
                          </button>
                        ) : <span className="commission-no-action">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {hasLoaded && filteredRecords.length > 0 && (
            <div className="commission-pagination" role="group" aria-label="Commission record pagination">
              <label className="commission-page-size">
                <span>Rows per page</span>
                <select
                  value={recordPageSize}
                  onChange={(event) => {
                    setRecordPageSize(Number(event.target.value));
                    setRecordPage(1);
                  }}
                  aria-label="Rows per page"
                >
                  {RECORD_PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
              <span className="commission-pagination-count" aria-live="polite">
                Showing {firstVisibleRecord}–{lastVisibleRecord} of {filteredRecords.length} matching loaded records
              </span>
              <div className="commission-pagination-actions">
                <button
                  type="button"
                  className="commission-pagination-button"
                  aria-label="Previous commission records page"
                  onClick={() => setRecordPage((page) => Math.max(1, page - 1))}
                  disabled={visiblePage <= 1}
                >
                  <ChevronLeft size={17} aria-hidden="true" />
                </button>
                <span>Page {visiblePage} of {pageCount}</span>
                <button
                  type="button"
                  className="commission-pagination-button"
                  aria-label="Next commission records page"
                  onClick={() => setRecordPage((page) => Math.min(pageCount, page + 1))}
                  disabled={visiblePage >= pageCount}
                >
                  <ChevronRight size={17} aria-hidden="true" />
                </button>
              </div>
            </div>
          )}
          {summary.unconfigured_orders > 0 && (
            <p className="commission-history-warning"><ShieldCheck size={16} /> {summary.unconfigured_orders} completed order(s) do not have an applicable rate snapshot. No estimated commission is assigned to them.</p>
          )}
        </section>

        {collectionDraft && (
          <div className="commission-modal-backdrop" role="presentation">
            <form className="commission-modal" role="dialog" aria-modal="true" aria-labelledby="commission-collect-title" onSubmit={saveCollection}>
              <span className="commission-eyebrow">MANUAL SETTLEMENT</span>
              <h3 id="commission-collect-title">Record commission collection</h3>
              <p>Confirm that {formatCurrency(collectionDraft.amount)} for {collectionDraft.orderNumber} was actually received.</p>
              <label>
                <span>Receipt or settlement reference (optional)</span>
                <input maxLength="120" value={collectionDraft.reference} onChange={(event) => setCollectionDraft((current) => ({ ...current, reference: event.target.value }))} />
              </label>
              <label>
                <span>Note (optional)</span>
                <textarea rows="3" maxLength="1000" value={collectionDraft.note} onChange={(event) => setCollectionDraft((current) => ({ ...current, note: event.target.value }))} />
              </label>
              <div className="commission-modal-actions">
                <button type="button" className="commission-secondary-button" onClick={() => setCollectionDraft(null)} disabled={savingCollection}>Cancel</button>
                <button type="submit" className="commission-primary-button" disabled={savingCollection}>
                  <CheckCircle2 size={16} />
                  {savingCollection ? "Recording" : "Confirm collection"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function MetricCard({ icon: Icon, label, value, description, loading = false }) {
  return (
    <article className="commission-overview-card" aria-busy={loading}>
      <div className="commission-overview-icon blue"><Icon size={20} aria-hidden="true" /></div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{description}</small>
      </div>
    </article>
  );
}

export default AdminCommission;
