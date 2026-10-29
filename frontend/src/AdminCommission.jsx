import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgePercent,
  CheckCircle2,
  Clock3,
  Coins,
  Pencil,
  Power,
  Save,
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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
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

        <section className="commission-overview-grid" aria-label="Commission summary">
          <MetricCard icon={Coins} label="Commission earned" value={formatCurrency(summary.total_earned)} />
          <MetricCard icon={CheckCircle2} label="Commission collected" value={formatCurrency(summary.total_collected)} />
          <MetricCard icon={Clock3} label="Awaiting collection" value={formatCurrency(summary.total_uncollected)} />
          <MetricCard icon={BadgePercent} label="Active rate" value={currentRate ? formatRate(currentRate.rate_percent) : "Not configured"} />
        </section>

        <section className="commission-panel commission-config-panel">
          <div className="commission-section-heading">
            <div>
              <span className="commission-eyebrow">ADMIN POLICY</span>
              <h3>Commission rate</h3>
            </div>
            <span className="commission-current-rate">{currentRate ? `Current: ${formatRate(currentRate.rate_percent)}` : "No rate active"}</span>
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
          <div className="commission-history-heading"><strong>Rate history</strong><span>Updates add a version; deactivation preserves history.</span></div>
          {rates.length > 0 ? (
            <div className="commission-rate-list">
              {rates.map((rate) => (
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
                        aria-label={`Deactivate active commission rate ${formatRate(rate.rate_percent)}`}
                        title="Deactivate active rate"
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
        </section>

        <section className="commission-panel commission-tax-notice" aria-label="Tax configuration status">
          <AlertTriangle size={21} />
          <div>
            <strong>Tax treatment is unresolved</strong>
            <p>{tax.message} No tax is added to orders, withheld, or reported as collected. Configure tax only after the applicable rule and responsible party are approved.</p>
          </div>
          <span className="commission-status-badge status-unconfigured">Not configured</span>
        </section>

        <section className="commission-panel commission-records-panel">
          <div className="commission-section-heading">
            <div>
              <span className="commission-eyebrow">ORDER LEDGER</span>
              <h3>Completed order commissions</h3>
            </div>
            <span className="commission-current-rate">{summary.completed_orders} completed orders</span>
          </div>
          <p className="commission-muted-copy">Mark a commission collected only after the amount has actually been received. The collector and timestamp are saved for audit.</p>

          {loading ? (
            <div className="commission-table-message" role="status">Loading commission records…</div>
          ) : records.length === 0 ? (
            <div className="commission-table-message">No completed orders yet. Commission records will appear after an order is completed.</div>
          ) : (
            <div className="commission-table-wrap">
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
                  {records.map((record) => (
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

function MetricCard({ icon: Icon, label, value }) {
  return (
    <article className="commission-overview-card">
      <div className="commission-overview-icon blue"><Icon size={20} /></div>
      <div><span>{label}</span><strong>{value}</strong></div>
    </article>
  );
}

export default AdminCommission;
