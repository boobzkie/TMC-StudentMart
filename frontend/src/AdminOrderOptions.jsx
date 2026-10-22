import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Edit3, Loader2, MapPin, Plus, SlidersHorizontal, WalletCards, X } from "lucide-react";

import AdminLayout from "./components/AdminLayout";
import AdminPageHero from "./components/AdminPageHero";
import { API_URL, getAuthHeaders } from "./utils/api";

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

export default function AdminOrderOptions() {
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [pickupLocations, setPickupLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [modalType, setModalType] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

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

  const formTitle = modalType === "payment" ? "Payment method" : "Pickup location";

  return (
    <AdminLayout title="Payment & pickup setup" subtitle="Configure the manual order options students can choose.">
      <main className="order-options-page">
        <AdminPageHero
          title="Payment & pickup setup"
          description="Configure the manual order options students can choose. Saved orders keep their selected details as a snapshot."
          icon={SlidersHorizontal}
          onRefresh={() => loadOptions(true)}
          refreshing={loading || refreshing}
        />

        <div className="order-options-notice">
          <WalletCards size={19} />
          <p>Payments are arranged manually between buyer and seller. This portal does not collect payment or verify external wallet transfers. Never enter a PIN, password, or banking credential here.</p>
        </div>

        {error && <div className="order-options-alert error" role="alert">{error}<button type="button" onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button></div>}
        {success && <div className="order-options-alert success" role="status">{success}<button type="button" onClick={() => setSuccess("")} aria-label="Dismiss message"><X size={16} /></button></div>}

        {loading ? (
          <div className="order-options-loading" role="status"><Loader2 className="order-options-spin" size={22} />Loading configured options…</div>
        ) : (
          <div className="order-options-grid">
            <section className="order-options-panel">
              <div className="order-options-panel-heading">
                <div><span className="order-options-eyebrow">MANUAL METHODS</span><h2>Payment methods</h2><p>Configure only methods approved for your marketplace.</p></div>
                <button type="button" className="order-options-primary" onClick={() => openCreate("payment")}><Plus size={17} />Add method</button>
              </div>
              {paymentMethods.length === 0 ? <div className="order-options-empty"><WalletCards size={23} /><strong>No methods configured</strong><span>Add an approved method before students can submit orders.</span></div> : (
                <div className="order-options-list">
                  {paymentMethods.map((item) => (
                    <article className="order-option-card" key={item.id}>
                      <div className="order-option-icon"><WalletCards size={19} /></div>
                      <div className="order-option-copy"><div className="order-option-title"><h3>{item.name}</h3><span className={item.is_active ? "order-option-status active" : "order-option-status inactive"}>{item.is_active ? "Active" : "Inactive"}</span></div><p>{item.instructions || "No additional instructions."}</p><small>{item.orders_count || 0} saved order{Number(item.orders_count) === 1 ? "" : "s"}</small></div>
                      <div className="order-option-actions"><button type="button" onClick={() => openEdit("payment", item)} aria-label={`Edit ${item.name}`}><Edit3 size={16} /></button><button type="button" onClick={() => void toggleActive("payment", item)} disabled={busyKey === `payment-${item.id}`} aria-label={`${item.is_active ? "Deactivate" : "Activate"} ${item.name}`}>{busyKey === `payment-${item.id}` ? <Loader2 size={16} className="order-options-spin" /> : <span>{item.is_active ? "Deactivate" : "Activate"}</span>}</button></div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="order-options-panel">
              <div className="order-options-panel-heading">
                <div><span className="order-options-eyebrow">ADMIN-APPROVED</span><h2>Pickup locations</h2><p>Enter real approved campus or meetup locations; none are prefilled.</p></div>
                <button type="button" className="order-options-primary" onClick={() => openCreate("pickup")}><Plus size={17} />Add location</button>
              </div>
              {pickupLocations.length === 0 ? <div className="order-options-empty"><MapPin size={23} /><strong>No pickup locations configured</strong><span>Students cannot select a pickup point until Admin adds one.</span></div> : (
                <div className="order-options-list">
                  {pickupLocations.map((item) => (
                    <article className="order-option-card" key={item.id}>
                      <div className="order-option-icon"><MapPin size={19} /></div>
                      <div className="order-option-copy"><div className="order-option-title"><h3>{item.name}</h3><span className={item.is_active ? "order-option-status active" : "order-option-status inactive"}>{item.is_active ? "Active" : "Inactive"}</span></div><p>{[item.building_room, item.campus_area].filter(Boolean).join(" · ") || "No area details entered."}</p>{item.instructions && <p>{item.instructions}</p>}<small>{item.operating_hours || "Hours not specified"} · {item.orders_count || 0} saved order{Number(item.orders_count) === 1 ? "" : "s"}</small></div>
                      <div className="order-option-actions"><Link to={`/admin/transactions?pickup_location_id=${item.id}`} title="View associated order requests"><CheckCircle2 size={16} /><span>View orders</span></Link><button type="button" onClick={() => openEdit("pickup", item)} aria-label={`Edit ${item.name}`}><Edit3 size={16} /></button><button type="button" onClick={() => void toggleActive("pickup", item)} disabled={busyKey === `pickup-${item.id}`} aria-label={`${item.is_active ? "Deactivate" : "Activate"} ${item.name}`}>{busyKey === `pickup-${item.id}` ? <Loader2 size={16} className="order-options-spin" /> : <span>{item.is_active ? "Deactivate" : "Activate"}</span>}</button></div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {modalType && <div className="order-options-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}><section className="order-options-modal" role="dialog" aria-modal="true" aria-labelledby="order-option-modal-title"><header><div><span className="order-options-eyebrow">ORDER CONFIGURATION</span><h2 id="order-option-modal-title">{editing ? "Edit" : "Add"} {formTitle.toLowerCase()}</h2></div><button type="button" onClick={closeModal} aria-label="Close dialog"><X size={19} /></button></header><form onSubmit={submitForm}><label>Name<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} maxLength={modalType === "payment" ? 100 : 120} required /></label>{modalType === "pickup" && <div className="order-options-form-row"><label>Building / room<input value={form.building_room} onChange={(event) => setForm((current) => ({ ...current, building_room: event.target.value }))} maxLength="120" /></label><label>Campus / area<input value={form.campus_area} onChange={(event) => setForm((current) => ({ ...current, campus_area: event.target.value }))} maxLength="120" /></label></div>}{modalType === "pickup" && <label>Operating hours<input value={form.operating_hours} onChange={(event) => setForm((current) => ({ ...current, operating_hours: event.target.value }))} maxLength="120" placeholder="Optional" /></label>}<label>{modalType === "payment" ? "Manual payment instructions" : "Handover instructions"}<textarea value={form.instructions} onChange={(event) => setForm((current) => ({ ...current, instructions: event.target.value }))} rows="3" maxLength="2000" placeholder={modalType === "payment" ? "Explain how buyer and seller arrange this method. Do not request credentials." : "Optional directions or handover notes."} /></label><label>Display order<input type="number" min="0" max="65535" value={form.sort_order} onChange={(event) => setForm((current) => ({ ...current, sort_order: event.target.value }))} /></label><label className="order-options-active-toggle"><input type="checkbox" checked={Boolean(form.is_active)} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} /><span>Available for new orders</span></label>{error && <div className="order-options-inline-error" role="alert">{error}</div>}<footer><button type="button" className="order-options-secondary" onClick={closeModal} disabled={saving}>Cancel</button><button type="submit" className="order-options-primary" disabled={saving}>{saving ? <Loader2 size={16} className="order-options-spin" /> : <CheckCircle2 size={16} />}{saving ? "Saving…" : "Save option"}</button></footer></form></section></div>}
    </AdminLayout>
  );
}
