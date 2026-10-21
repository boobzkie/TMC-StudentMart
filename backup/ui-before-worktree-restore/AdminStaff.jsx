import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  UserRoundCog,
  Clock3,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Eye,
  FileText,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Archive,
  PauseCircle,
  RotateCcw,
} from "lucide-react";

import AdminLayout from "./components/AdminLayout";
import { API_URL, SERVER_URL } from "./utils/api";

import { Button, SectionHeader, EmptyState, LoadingSpinner, StatCard } from "./ui";

import "./AdminStaff.css";

const DEPARTMENTS = ["BSIT", "BSOA", "BSCRIM", "BSED", "CAS"];
const EMPLOYMENT = ["Regular", "Part-Time", "Contractual"];
const INITIAL_CREATE = {
  name: "",
  email: "",
  contact_number: "",
  password: "",
  password_confirmation: "",
  manage_students: false,
  moderate_products: false,
  manage_complaints: false,
  view_reports: false,
  view_analytics: false,
};

function authHeaders(json = false) {
  const headers = { Accept: "application/json", Authorization: "Bearer " + localStorage.getItem("token") };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}
function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
function statusClass(status) { return String(status || "unknown").toLowerCase().replace(/[^a-z]+/g, "-"); }
function statusLabel(status) { return String(status || "unknown").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function profilePhotoUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${SERVER_URL.replace(/\/+$/, "")}/storage/${String(path).replace(/^\/+/, "")}`;
}
function userInitials(name) {
  return String(name || "Staff").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}
function formatLastSeen(value) {
  if (!value) return "Never";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "—";
  const minutes = Math.floor(Math.max(0, Date.now() - timestamp) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return new Date(timestamp).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminStaff() {
  const navigate = useNavigate();
  const [staff, setStaff] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, active: 0, rejected: 0, suspended: 0 });
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [permissions, setPermissions] = useState([]);
  const [draft, setDraft] = useState({});
  const [rejectReason, setRejectReason] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(INITIAL_CREATE);
  const backgroundLoadRef = useRef(false);

  const loadStaff = useCallback(async (showRefresh = false, background = false) => {
    if (background && backgroundLoadRef.current) return;
    if (background) backgroundLoadRef.current = true;
    try {
      if (showRefresh) setRefreshing(true); else if (!background) setLoading(true);
      setError("");
      const params = new URLSearchParams({ page: String(page), per_page: "15" });
      if (search.trim()) params.set("search", search.trim());
      if (department) params.set("department", department);
      if (status) params.set("status", status);
      if (employmentStatus) params.set("employment_status", employmentStatus);
      const response = await fetch(API_URL + "/admin/staff?" + params.toString(), { headers: authHeaders() });
      if (response.status === 401) { localStorage.removeItem("token"); localStorage.removeItem("role"); localStorage.removeItem("user"); navigate("/login", { replace: true }); return; }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to load Staff applications.");
      setStaff(Array.isArray(data.staff) ? data.staff : []);
      setStats(data.stats || { total: 0, pending: 0, active: 0, rejected: 0, suspended: 0 });
      setPagination(data.pagination || { current_page: 1, last_page: 1, total: 0 });
    } catch (err) { setError(err.message || "Unable to load Staff applications."); }
    finally {
      if (background) backgroundLoadRef.current = false;
      if (!background) { setLoading(false); setRefreshing(false); }
    }
  }, [navigate, page, search, department, status, employmentStatus]);

  useEffect(() => { const timer = setTimeout(() => loadStaff(), 0); return () => clearTimeout(timer); }, [loadStaff]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadStaff(false, true);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [loadStaff]);

  const viewStaff = async (item) => {
    setDetailLoading(true);
    setSelectedStaff(item);
    try {
      const response = await fetch(API_URL + "/admin/staff/" + item.id, { headers: authHeaders() });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to load Staff details.");
      const detail = data.staff || item;
      setSelectedStaff(detail);
      const profile = detail.profile || {};
      setDraft({
        contact_number: detail.contact_number || "", employee_id: profile.employee_id || "",
        department: profile.department || "", position: profile.position || "",
        employment_status: profile.employment_status || "", employment_start_date: profile.employment_start_date || "",
        campus: profile.campus || "",
      });
      setPermissions(Array.isArray(detail.staff_permissions) ? detail.staff_permissions : []);
      setRejectReason("");
    } catch (err) { setError(err.message || "Unable to load Staff details."); setSelectedStaff(null); }
    finally { setDetailLoading(false); }
  };

  const performAction = async (item, action, payload = {}) => {
    setActionLoading(action + "-" + item.id);
    setError(""); setNotice("");
    try {
      const response = await fetch(API_URL + "/admin/staff/" + item.id + "/" + action, { method: "PUT", headers: authHeaders(true), body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(Object.values(data.errors || {}).flat()[0] || data.message || "Unable to update the Staff account.");
      setNotice(data.message || "Staff account updated.");
      setSelectedStaff(null);
      await loadStaff(true);
    } catch (err) { setError(err.message || "Unable to update the Staff account."); }
    finally { setActionLoading(null); }
  };

  const openDocument = async () => {
    if (!selectedStaff) return;
    const preview = window.open("about:blank", "_blank");
    try {
      const response = await fetch(API_URL + "/admin/staff/" + selectedStaff.id + "/document", { headers: authHeaders() });
      if (!response.ok) { preview?.close(); const data = await response.json().catch(() => ({})); throw new Error(data.message || "Unable to open the verification document."); }
      const blobUrl = URL.createObjectURL(await response.blob());
      if (preview) preview.location = blobUrl;
      else { const link = document.createElement("a"); link.href = blobUrl; link.target = "_blank"; link.rel = "noopener"; link.click(); }
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (err) { preview?.close(); setError(err.message || "Unable to open the verification document."); }
  };

  const saveProfile = async () => {
    if (!selectedStaff) return;
    setActionLoading("save-" + selectedStaff.id);
    try {
      const response = await fetch(API_URL + "/admin/staff/" + selectedStaff.id, { method: "PUT", headers: authHeaders(true), body: JSON.stringify({ ...draft, employment_start_date: draft.employment_start_date || null, permissions }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(Object.values(data.errors || {}).flat()[0] || data.message || "Unable to save Staff details.");
      setNotice(data.message || "Staff details saved.");
      setSelectedStaff(data.staff || selectedStaff);
      await loadStaff(true);
    } catch (err) { setError(err.message || "Unable to save Staff details."); }
    finally { setActionLoading(null); }
  };

  const createStaff = async (event) => {
    event.preventDefault(); setError("");
    if (createForm.password !== createForm.password_confirmation) { setError("The password and confirmation do not match."); return; }
    setActionLoading("create");
    try {
      const response = await fetch(API_URL + "/admin/staff", { method: "POST", headers: authHeaders(true), body: JSON.stringify({ name: createForm.name, email: createForm.email, contact_number: createForm.contact_number || null, password: createForm.password, password_confirmation: createForm.password_confirmation, permissions: [ ...(createForm.manage_students ? ["manage_students"] : []), ...(createForm.moderate_products ? ["moderate_products"] : []), ...(createForm.manage_complaints ? ["manage_complaints"] : []), ...(createForm.view_reports ? ["view_reports"] : []), ...(createForm.view_analytics ? ["view_analytics"] : []) ] }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(Object.values(data.errors || {}).flat()[0] || data.message || "Unable to create Staff account.");
      setNotice(data.message || "Staff account created."); setShowCreate(false); setCreateForm(INITIAL_CREATE); await loadStaff(true);
    } catch (err) { setError(err.message || "Unable to create Staff account."); }
    finally { setActionLoading(null); }
  };

  const setFilter = (setter, value) => { setter(value); setPage(1); };
  const cards = [
    { label: "Total Staff", value: stats.total, icon: UserRoundCog, tone: "primary" },
    { label: "Pending applications", value: stats.pending, icon: Clock3, tone: "warning" },
    { label: "Approved / active", value: stats.active, icon: CheckCircle2, tone: "success" },
    { label: "Rejected", value: stats.rejected, icon: XCircle, tone: "danger" },
    { label: "Suspended", value: stats.suspended, icon: PauseCircle, tone: "neutral" },
  ];

  return (
    <AdminLayout title="Manage Staff" subtitle="Review applications and manage approved Staff access">
      <section className="staff-management-page">
        <SectionHeader
          title="Staff"
          subtitle="Staff Directory"
          action={showCreate ? undefined : loadStaff}
          actionLabel={refreshing ? "Refreshing…" : "Refresh"}
          actionVariant="outline"
        />
        {showCreate && (
          <Button variant="outline" size="sm" onClick={() => setShowCreate(false)} style={{ marginLeft: "auto" }}>
            Cancel
          </Button>
        )}
        {!showCreate && (
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
            <UserPlus size={15} aria-hidden="true" /> Create Staff account
          </Button>
        )}

        {notice && (
          <div className="staff-notice" role="status">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice("")} aria-label="Dismiss message">×</button>
          </div>
        )}
        {error && (
          <div className="staff-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => setError("")} aria-label="Dismiss error">×</button>
          </div>
        )}

        <div className="staff-overview-grid">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <StatCard
                key={card.label}
                label={card.label}
                value={card.value ?? 0}
                icon={Icon}
                tone={card.tone}
              />
            );
          })}
        </div>

        <form className="staff-filter-bar" onSubmit={(event) => { event.preventDefault(); setPage(1); loadStaff(true); }}>
          <label className="staff-search-control">
            <Search size={17} aria-hidden="true" />
            <input value={search} onChange={(event) => setFilter(setSearch, event.target.value)} placeholder="Search name, employee ID, or email" aria-label="Search Staff" />
          </label>
          <select aria-label="Filter by department" value={department} onChange={(event) => setFilter(setDepartment, event.target.value)}>
            <option value="">All departments</option>
            {DEPARTMENTS.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select aria-label="Filter by application status" value={status} onChange={(event) => setFilter(setStatus, event.target.value)}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="active">Approved / Active</option>
            <option value="rejected">Rejected</option>
            <option value="suspended">Suspended</option>
            <option value="archived">Archived</option>
          </select>
          <select aria-label="Filter by employment status" value={employmentStatus} onChange={(event) => setFilter(setEmploymentStatus, event.target.value)}>
            <option value="">All employment types</option>
            {EMPLOYMENT.map((item) => <option key={item}>{item}</option>)}
          </select>
          <Button variant="primary" size="sm" type="submit">
            <Search size={15} aria-hidden="true" /> Search
          </Button>
        </form>

        <div className="staff-table-card">
          {loading ? (
            <div className="staff-table-state">
              <LoadingSpinner size="sm" />
              <p>Loading Staff records…</p>
            </div>
          ) : staff.length === 0 ? (
            <EmptyState
              icon={() => null}
              title="No Staff records found"
              subtitle="Try changing your search or filters."
            />
          ) : (
            <div className="staff-table-wrap">
              <table className="staff-table">
                <thead>
                  <tr>
                    <th style={{ width: "120px" }}>Employee ID</th>
                    <th>Staff Member</th>
                    <th style={{ width: "140px" }}>Department</th>
                    <th style={{ width: "140px" }}>Position</th>
                    <th style={{ width: "120px" }}>Employment</th>
                    <th style={{ width: "100px" }}>Role</th>
                    <th style={{ width: "120px" }}>Approval</th>
                    <th style={{ width: "120px" }}>Account</th>
                    <th style={{ width: "100px" }}>Presence</th>
                    <th style={{ width: "130px" }}>Last Seen</th>
                    <th style={{ width: "130px" }}>Registered</th>
                    <th className="actions-column" style={{ width: "110px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((item) => (
                    <tr key={item.id}>
                      <td>{item.profile?.employee_id || "—"}</td>
                      <td className="staff-identity-cell">
                        <div className="staff-identity">
                          <span className="staff-avatar" aria-hidden="true">
                            {item.profile_picture ? (
                              <img src={profilePhotoUrl(item.profile_picture)} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />
                            ) : (
                              userInitials(item.name)
                            )}
                          </span>
                          <div>
                            <strong>{item.name || "—"}</strong>
                            <small>{item.email}</small>
                          </div>
                        </div>
                      </td>
                      <td>{item.profile?.department || "—"}</td>
                      <td>{item.profile?.position || "—"}</td>
                      <td>{item.profile?.employment_status || "—"}</td>
                      <td>{statusLabel(item.role || "staff")}</td>
                      <td><span className={"staff-status-pill " + statusClass(item.approval_status)}>{statusLabel(item.approval_status)}</span></td>
                      <td><span className={"staff-status-pill account-status " + statusClass(item.account_status)}>{statusLabel(item.account_status)}</span></td>
                      <td><span className={"staff-presence-pill " + (item.presence === "online" ? "online" : "offline")} aria-label={"Presence: " + (item.presence === "online" ? "Online" : "Offline")}><span className="staff-presence-dot" aria-hidden="true" />{item.presence === "online" ? "Online" : "Offline"}</span></td>
                      <td><time dateTime={item.last_seen_at || undefined}>{formatLastSeen(item.last_seen_at)}</time></td>
                      <td>{formatDate(item.created_at)}</td>
                      <td className="actions-cell">
                        <Button variant="outline" size="sm" onClick={() => viewStaff(item)} aria-label={"View " + item.name}>
                          <Eye size={14} aria-hidden="true" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="staff-pagination">
          <span>{pagination.total || 0} records · Page {pagination.current_page || 1} of {pagination.last_page || 1}</span>
          <div>
            <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>
              <ChevronLeft size={15} aria-hidden="true" /> Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(pagination.last_page || 1, current + 1))} disabled={page >= (pagination.last_page || 1)}>
              Next <ChevronRight size={15} aria-hidden="true" />
            </Button>
          </div>
        </div>
      </section>

      {showCreate && (
        <div className="staff-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCreate(false); }}>
          <section className="staff-details-modal staff-create-modal" role="dialog" aria-modal="true" aria-labelledby="staff-create-title">
            <header className="staff-modal-heading">
              <div>
                <span>Admin-Issued Account</span>
                <h2 id="staff-create-title">Create Staff account</h2>
              </div>
              <button type="button" onClick={() => setShowCreate(false)} aria-label="Close">×</button>
            </header>
            <p className="staff-modal-note">This creates an active account. Grant only the permissions needed for the Staff member's duties.</p>
            <form className="staff-create-form" onSubmit={createStaff}>
              <label>Full name<input value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} required maxLength="255" /></label>
              <label>Email<input type="email" value={createForm.email} onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))} required /></label>
              <label>Contact number<input value={createForm.contact_number} onChange={(event) => setCreateForm((current) => ({ ...current, contact_number: event.target.value }))} /></label>
              <label>Password<input type="password" minLength="8" value={createForm.password} onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))} required /></label>
              <label>Confirm password<input type="password" minLength="8" value={createForm.password_confirmation} onChange={(event) => setCreateForm((current) => ({ ...current, password_confirmation: event.target.value }))} required /></label>
              <label className="staff-permission-option">
                <input type="checkbox" checked={createForm.manage_students} onChange={(event) => setCreateForm((current) => ({ ...current, manage_students: event.target.checked }))} />
                <span>
                  <strong>Manage student accounts</strong>
                  <small>Allows approved student account lookup and status updates.</small>
                </span>
              </label>
              <label className="staff-permission-option">
                <input type="checkbox" checked={createForm.moderate_products} onChange={(event) => setCreateForm((current) => ({ ...current, moderate_products: event.target.checked }))} />
                <span>
                  <strong>Moderate products</strong>
                  <small>Allows reviewing and approving/rejecting listings.</small>
                </span>
              </label>
              <label className="staff-permission-option">
                <input type="checkbox" checked={createForm.manage_complaints} onChange={(event) => setCreateForm((current) => ({ ...current, manage_complaints: event.target.checked }))} />
                <span>
                  <strong>Manage complaints</strong>
                  <small>Allows reviewing and handling student complaints.</small>
                </span>
              </label>
              <label className="staff-permission-option">
                <input type="checkbox" checked={createForm.view_reports} onChange={(event) => setCreateForm((current) => ({ ...current, view_reports: event.target.checked }))} />
                <span>
                  <strong>View reports</strong>
                  <small>Allows viewing operational reports.</small>
                </span>
              </label>
              <label className="staff-permission-option">
                <input type="checkbox" checked={createForm.view_analytics} onChange={(event) => setCreateForm((current) => ({ ...current, view_analytics: event.target.checked }))} />
                <span>
                  <strong>View analytics</strong>
                  <small>Allows viewing marketplace analytics.</small>
                </span>
              </label>
              <div className="staff-create-actions">
                <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button variant="primary" size="sm" type="submit" disabled={Boolean(actionLoading)}>
                  {actionLoading === "create" ? "Creating…" : "Create Staff Account"}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}

      {selectedStaff && (
        <div className="staff-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedStaff(null); }}>
          <section className="staff-details-modal staff-view-modal" role="dialog" aria-modal="true" aria-labelledby="staff-details-title">
            <header className="staff-modal-heading">
              <div>
                <span>Application / Staff Profile</span>
                <h2 id="staff-details-title">{detailLoading ? "Loading details…" : selectedStaff.name}</h2>
                <span className={"staff-status-pill account-status " + statusClass(selectedStaff.account_status)}>Account: {statusLabel(selectedStaff.account_status || selectedStaff.status)}</span>
              </div>
              <button type="button" onClick={() => setSelectedStaff(null)} aria-label="Close details">×</button>
            </header>

            {detailLoading && (
              <div className="staff-loading-state">
                <LoadingSpinner size="sm" />
                <p>Loading staff details…</p>
              </div>
            )}

            {!detailLoading && (
              <>
                <div className="staff-detail-grid">
                  <div><span>Email</span><strong>{selectedStaff.email || "—"}</strong></div>
                  <div><span>Contact</span><strong>{selectedStaff.contact_number || "—"}</strong></div>
                  <div><span>Date of birth</span><strong>{formatDate(selectedStaff.profile?.date_of_birth)}</strong></div>
                  <div><span>Employee ID</span><strong>{selectedStaff.profile?.employee_id || "—"}</strong></div>
                  <div><span>Department</span><strong>{selectedStaff.profile?.department || "—"}</strong></div>
                  <div><span>Position</span><strong>{selectedStaff.profile?.position || "—"}</strong></div>
                  <div><span>Employment</span><strong>{selectedStaff.profile?.employment_status || "—"}</strong></div>
                  <div><span>Approval status</span><strong>{statusLabel(selectedStaff.approval_status)}</strong></div>
                  <div><span>Account status</span><strong>{statusLabel(selectedStaff.account_status)}</strong></div>
                  <div><span>Presence</span><strong>{statusLabel(selectedStaff.presence)}</strong></div>
                  <div><span>Last seen</span><strong>{formatLastSeen(selectedStaff.last_seen_at)}</strong></div>
                  <div><span>Start date</span><strong>{formatDate(selectedStaff.profile?.employment_start_date)}</strong></div>
                  <div><span>Campus / office</span><strong>{selectedStaff.profile?.campus || "—"}</strong></div>
                  <div><span>Submitted</span><strong>{formatDate(selectedStaff.created_at)}</strong></div>
                  <div><span>Reviewed by</span><strong>{selectedStaff.profile?.reviewer_name || "—"}</strong></div>
                  <div><span>Reviewed at</span><strong>{formatDate(selectedStaff.profile?.reviewed_at)}</strong></div>
                </div>

                {selectedStaff.profile?.has_verification_document && (
                  <Button variant="outline" size="sm" onClick={openDocument}>
                    <FileText size={16} aria-hidden="true" /> View verification document
                  </Button>
                )}

                <div className="staff-edit-section">
                  <h3>Employment profile and access</h3>
                  <div className="staff-edit-grid">
                    <label>Employee ID<input value={draft.employee_id || ""} onChange={(event) => setDraft((current) => ({ ...current, employee_id: event.target.value }))} /></label>
                    <label>Department<select value={draft.department || ""} onChange={(event) => setDraft((current) => ({ ...current, department: event.target.value }))}><option value="">Not set</option>{DEPARTMENTS.map((item) => <option key={item}>{item}</option>)}</select></label>
                    <label>Position<input value={draft.position || ""} onChange={(event) => setDraft((current) => ({ ...current, position: event.target.value }))} /></label>
                    <label>Employment status<select value={draft.employment_status || ""} onChange={(event) => setDraft((current) => ({ ...current, employment_status: event.target.value }))}><option value="">Not set</option>{EMPLOYMENT.map((item) => <option key={item}>{item}</option>)}</select></label>
                    <label>Employment start<input type="date" value={draft.employment_start_date || ""} onChange={(event) => setDraft((current) => ({ ...current, employment_start_date: event.target.value }))} /></label>
                    <label>Campus / office<input value={draft.campus || ""} onChange={(event) => setDraft((current) => ({ ...current, campus: event.target.value }))} /></label>
                    <label>Contact number<input value={draft.contact_number || ""} onChange={(event) => setDraft((current) => ({ ...current, contact_number: event.target.value }))} /></label>
                  </div>
                  <label className="staff-permission-option">
                    <input type="checkbox" checked={permissions.includes("manage_students")} onChange={(event) => setPermissions((current) => event.target.checked ? Array.from(new Set([...current, "manage_students"])) : current.filter((permission) => permission !== "manage_students"))} />
                    <span>
                      <strong>Manage student accounts</strong>
                      <small>Allows approved student account lookup and status updates.</small>
                    </span>
                  </label>
                  <label className="staff-permission-option">
                    <input type="checkbox" checked={permissions.includes("moderate_products")} onChange={(event) => setPermissions((current) => event.target.checked ? Array.from(new Set([...current, "moderate_products"])) : current.filter((permission) => permission !== "moderate_products"))} />
                    <span>
                      <strong>Moderate products</strong>
                      <small>Allows reviewing and approving/rejecting listings.</small>
                    </span>
                  </label>
                  <label className="staff-permission-option">
                    <input type="checkbox" checked={permissions.includes("manage_complaints")} onChange={(event) => setPermissions((current) => event.target.checked ? Array.from(new Set([...current, "manage_complaints"])) : current.filter((permission) => permission !== "manage_complaints"))} />
                    <span>
                      <strong>Manage complaints</strong>
                      <small>Allows reviewing and handling student complaints.</small>
                    </span>
                  </label>
                  <label className="staff-permission-option">
                    <input type="checkbox" checked={permissions.includes("view_reports")} onChange={(event) => setPermissions((current) => event.target.checked ? Array.from(new Set([...current, "view_reports"])) : current.filter((permission) => permission !== "view_reports"))} />
                    <span>
                      <strong>View reports</strong>
                      <small>Allows viewing operational reports.</small>
                    </span>
                  </label>
                  <label className="staff-permission-option">
                    <input type="checkbox" checked={permissions.includes("view_analytics")} onChange={(event) => setPermissions((current) => event.target.checked ? Array.from(new Set([...current, "view_analytics"])) : current.filter((permission) => permission !== "view_analytics"))} />
                    <span>
                      <strong>View analytics</strong>
                      <small>Allows viewing marketplace analytics.</small>
                    </span>
                  </label>
                  <div className="staff-edit-actions">
                    <Button variant="outline" size="sm" onClick={() => setSelectedStaff(null)}>Cancel</Button>
                    <Button variant="primary" size="sm" onClick={saveProfile} disabled={Boolean(actionLoading)}>
                      {actionLoading?.startsWith("save-") ? "Saving…" : "Save changes"}
                    </Button>
                  </div>
                </div>

                {selectedStaff.status === "pending" && (
                  <div className="staff-review-actions">
                    <label>Decision note (required to reject)<textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} rows="3" placeholder="Explain the decision to the applicant" /></label>
                    <div className="staff-action-row">
                      <Button variant="success" size="sm" disabled={Boolean(actionLoading)} onClick={() => { if (window.confirm("Approve this Staff application and grant only the selected permission?")) performAction(selectedStaff, "approve", { permissions }); }}>
                        <CheckCircle2 size={16} aria-hidden="true" /> Approve
                      </Button>
                      <Button variant="danger" size="sm" disabled={Boolean(actionLoading) || rejectReason.trim().length < 5} onClick={() => { if (window.confirm("Reject this Staff application? The applicant will be able to see this decision note.")) performAction(selectedStaff, "reject", { reason: rejectReason.trim() }); }}>
                        <XCircle size={16} aria-hidden="true" /> Reject
                      </Button>
                    </div>
                  </div>
                )}
                {selectedStaff.status === "rejected" && (
                  <div className="staff-action-row">
                    <Button variant="outline" size="sm" disabled={Boolean(actionLoading)} onClick={() => { if (window.confirm("Return this rejected application to pending review? This will not approve the applicant or grant Staff access.")) performAction(selectedStaff, "reopen"); }}>
                      <RotateCcw size={16} aria-hidden="true" /> Reopen Application
                    </Button>
                  </div>
                )}
                {selectedStaff.status === "active" && (
                  <div className="staff-action-row">
                    <Button variant="warning" size="sm" disabled={Boolean(actionLoading)} onClick={() => { if (window.confirm("Suspend this Staff account and revoke all existing access tokens?")) performAction(selectedStaff, "suspend"); }}>
                      <PauseCircle size={16} aria-hidden="true" /> Suspend access
                    </Button>
                  </div>
                )}
                {selectedStaff.status === "suspended" && (
                  <div className="staff-action-row">
                    <Button variant="success" size="sm" disabled={Boolean(actionLoading)} onClick={() => { if (window.confirm("Reactivate this previously approved Staff account?")) performAction(selectedStaff, "activate"); }}>
                      <RotateCcw size={16} aria-hidden="true" /> Reactivate
                    </Button>
                  </div>
                )}
                {selectedStaff.status !== "archived" && (
                  <div className="staff-archive-row">
                    <Button variant="danger" size="sm" disabled={Boolean(actionLoading)} onClick={() => { if (window.confirm("Archive this Staff account? Access will be blocked and audit history retained.")) performAction(selectedStaff, "archive"); }}>
                      <Archive size={15} aria-hidden="true" /> Archive account
                    </Button>
                  </div>
                )}

                <section className="staff-history">
                  <h3><ShieldCheck size={17} aria-hidden="true" /> Application and access history</h3>
                  {selectedStaff.history?.length ? (
                    <ol>
                      {selectedStaff.history.map((entry) => (
                        <li key={entry.id}>
                          <strong>{entry.event.replaceAll("_", " ")}</strong>
                          <span>{entry.actor_name ? " by " + entry.actor_name : ""} · {formatDate(entry.created_at)}</span>
                          {entry.note && <p>{entry.note}</p>}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p>No review history is available.</p>
                  )}
                </section>
              </>
            )}
          </section>
        </div>
      )}
    </AdminLayout>
  );
}
