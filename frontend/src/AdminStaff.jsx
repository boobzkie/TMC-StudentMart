import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, UserRoundCog, Clock3, CheckCircle2, XCircle, ShieldCheck, Eye, FileText, ChevronLeft, ChevronRight, UserPlus, PauseCircle, RotateCcw, BarChart3, Moon, ShieldAlert } from "lucide-react";
import AdminLayout from "./components/AdminLayout";
import AdminPageHero from "./components/AdminPageHero";
import { SortableHead } from "./ui/Table";
import Modal from "./ui/Modal";
import { API_URL, SERVER_URL, sortRows } from "./utils/api";
import "./AdminStaff.css";

const DEPARTMENTS = ["BSIT", "BSOA", "BSCRIM", "BSED", "CAS"];
const EMPLOYMENT = ["Regular", "Part-Time", "Contractual"];
const INITIAL_CREATE = { name: "", email: "", contact_number: "", password: "", password_confirmation: "", manage_students: false, moderate_products: false, manage_complaints: false, view_reports: false, view_analytics: false };

const STAFF_PERMISSION_OPTIONS = [
  { key: "manage_students", label: "Manage student accounts", description: "Look up student accounts and issue warnings or suspensions of up to 7 days." },
  { key: "moderate_products", label: "Moderate products", description: "Review pending listings and record approval or rejection decisions." },
  { key: "manage_complaints", label: "Manage complaints", description: "Review complaints and record private investigation notes." },
  { key: "view_reports", label: "View reports", description: "Access product and complaint reports for assigned responsibilities." },
  { key: "view_analytics", label: "View analytics", description: "View product and complaint activity summaries." },
];
const STAFF_PROFILE_TABS = [
  { id: "overview", label: "Overview", icon: UserRoundCog },
  { id: "employment", label: "Employment & Access", icon: FileText },
  { id: "history", label: "Activity History", icon: Clock3 },
];

function staffProfileDraft(staff) {
  const profile = staff?.profile || {};
  return {
    contact_number: staff?.contact_number || "",
    employee_id: profile.employee_id || "",
    department: profile.department || "",
    position: profile.position || "",
    employment_status: profile.employment_status || "",
    employment_start_date: profile.employment_start_date || "",
    campus: profile.campus || "",
  };
}
function displayValue(value, fallback = "Not provided") {
  return value === null || value === undefined || String(value).trim() === "" ? fallback : value;
}
function profileStatusTone(status) {
  const normalized = statusClass(status);
  if (normalized === "active" || normalized === "approved") return "is-success";
  if (normalized === "pending") return "is-warning";
  if (["rejected", "suspended", "archived"].includes(normalized)) return "is-danger";
  return "is-neutral";
}
function formatTimestamp(value) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
function permissionKey(values) {
  return Array.isArray(values) ? [...new Set(values)].sort().join("|") : "";
}

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
  const [status, setStatus] = useState(() => new URLSearchParams(window.location.search).get("status") || "");
  const [employmentStatus, setEmploymentStatus] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: "created_at", direction: "desc" });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [profileTab, setProfileTab] = useState("overview");
  const [detailLoading, setDetailLoading] = useState(false);
  const [permissions, setPermissions] = useState([]);
  const [draft, setDraft] = useState({});
  const [rejectReason, setRejectReason] = useState("");
  const [enforcementAction, setEnforcementAction] = useState("warning");
  const [enforcementReason, setEnforcementReason] = useState("");
  const [durationDays, setDurationDays] = useState("1");
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(INITIAL_CREATE);
  const createTriggerRef = useRef(null);
  const profileTriggerRef = useRef(null);
  const staffDetailRequestRef = useRef(0);

  const profileBaseline = staffProfileDraft(selectedStaff);
  const hasUnsavedChanges = Boolean(selectedStaff && (
    Object.entries(draft).some(([key, value]) => String(value ?? "") !== String(profileBaseline[key] ?? ""))
    || permissionKey(permissions) !== permissionKey(selectedStaff.staff_permissions)
  ));

  const closeStaffProfile = () => {
    if (actionLoading) return;
    if (hasUnsavedChanges && !window.confirm("You have unsaved staff profile changes. Close and discard them?")) return;
    staffDetailRequestRef.current += 1;
    setSelectedStaff(null);
  };

  const closeCreateModal = () => {
    if (actionLoading === "create") return;
    setShowCreate(false);
  };

  const toggleSort = (key) => setSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
  const sortedStaff = sortRows(staff, sort, (item, key) => ({
    name: item.name,
    department: item.profile?.department,
    position: item.profile?.position,
    employment_status: item.profile?.employment_status,
    role: item.role,
    approval_status: item.approval_status,
    account_status: item.account_status,
    presence: item.presence,
    last_seen_at: item.last_seen_at,
    created_at: item.created_at,
  })[key]);
  const backgroundLoadRef = useRef(false);
  const loadSequenceRef = useRef(0);

  const loadStaff = useCallback(async (showRefresh = false, background = false, signal) => {
    if (signal?.aborted) return;
    if (background && backgroundLoadRef.current) return;
    if (background) backgroundLoadRef.current = true;
    const loadSequence = ++loadSequenceRef.current;
    try {
      if (showRefresh) setRefreshing(true); else if (!background) setLoading(true);
      setError("");
      const params = new URLSearchParams({ page: String(page), per_page: "15" });
      if (search.trim()) params.set("search", search.trim());
      if (department) params.set("department", department);
      if (status) params.set("status", status);
      if (employmentStatus) params.set("employment_status", employmentStatus);
      const response = await fetch(API_URL + "/admin/staff?" + params.toString(), { headers: authHeaders(), ...(signal ? { signal } : {}) });
      if (signal?.aborted || loadSequence !== loadSequenceRef.current) return;
      if (response.status === 401) { localStorage.removeItem("token"); localStorage.removeItem("role"); localStorage.removeItem("user"); navigate("/login", { replace: true }); return; }
      const data = await response.json().catch(() => ({}));
      if (signal?.aborted || loadSequence !== loadSequenceRef.current) return;
      if (!response.ok) throw new Error(data.message || "Unable to load Staff applications.");
      setStaff(Array.isArray(data.staff) ? data.staff : []);
      setStats(data.stats || { total: 0, pending: 0, active: 0, rejected: 0, suspended: 0 });
      setPagination(data.pagination || { current_page: 1, last_page: 1, total: 0 });
    } catch (err) {
      if (!signal?.aborted && err?.name !== "AbortError" && loadSequence === loadSequenceRef.current) {
        setError(err.message || "Unable to load Staff applications.");
      }
    }
    finally {
      if (background) backgroundLoadRef.current = false;
      if (!background && loadSequence === loadSequenceRef.current && !signal?.aborted) { setLoading(false); setRefreshing(false); }
    }
  }, [navigate, page, search, department, status, employmentStatus]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void loadStaff(false, false, controller.signal); }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [loadStaff]);
  const viewStaff = async (item) => {
    const requestId = ++staffDetailRequestRef.current;
    setDetailLoading(true);
    setProfileTab("overview");
    setEnforcementAction("warning");
    setEnforcementReason("");
    setDurationDays("1");
    setSelectedStaff(item);
    setDraft(staffProfileDraft(item));
    setPermissions(Array.isArray(item.staff_permissions) ? item.staff_permissions : []);
    try {
      const response = await fetch(API_URL + "/admin/staff/" + item.id, { headers: authHeaders() });
      if (requestId !== staffDetailRequestRef.current) return;
      const data = await response.json().catch(() => ({}));
      if (requestId !== staffDetailRequestRef.current) return;
      if (!response.ok) throw new Error(data.message || "Unable to load Staff details.");
      const detail = data.staff || item;
      setSelectedStaff(detail);
      setDraft(staffProfileDraft(detail));
      setPermissions(Array.isArray(detail.staff_permissions) ? detail.staff_permissions : []);
      setRejectReason("");
    } catch (err) { if (requestId === staffDetailRequestRef.current) { setError(err.message || "Unable to load Staff details."); setSelectedStaff(null); } }
    finally { if (requestId === staffDetailRequestRef.current) setDetailLoading(false); }
  };

  const performAction = async (item, action, payload = {}) => {
    if (action !== "suspend" && hasUnsavedChanges && !window.confirm("This action will close the profile. Any changes not included in the action will be discarded. Continue?")) return;
    setActionLoading(action + "-" + item.id);
    setError(""); setNotice("");
    try {
      const response = await fetch(API_URL + "/admin/staff/" + item.id + "/" + action, { method: "PUT", headers: authHeaders(true), body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(Object.values(data.errors || {}).flat()[0] || data.message || "Unable to update the Staff account.");
      setNotice(data.message || "Staff account updated.");
      if (action === "suspend") {
        setSelectedStaff(data.staff || item);
        setProfileTab("history");
      } else {
        staffDetailRequestRef.current += 1;
        setSelectedStaff(null);
      }
      await loadStaff(true);
    } catch (err) { setError(err.message || "Unable to update the Staff account."); }
    finally { setActionLoading(null); }
  };

  const submitStaffEnforcement = (event) => {
    event.preventDefault();
    if (!selectedStaff || enforcementReason.trim().length < 5) return;
    const days = Number(durationDays);
    const actionLabel = enforcementAction === "warning" ? "issue a warning" : enforcementAction === "suspension" ? `suspend this account for ${days} day(s)` : `issue a warning and suspend this account for ${days} day(s)`;
    if (!window.confirm(`Confirm: ${actionLabel}?\n\nReason: ${enforcementReason.trim()}`)) return;
    void performAction(selectedStaff, "suspend", {
      action: enforcementAction,
      reason: enforcementReason.trim(),
      ...(enforcementAction === "warning" ? {} : { duration_days: days }),
    });
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
      const updatedStaff = data.staff || {
        ...selectedStaff,
        contact_number: draft.contact_number || null,
        profile: { ...selectedStaff.profile, ...draft },
        staff_permissions: permissions,
      };
      setSelectedStaff(updatedStaff);
      setDraft(staffProfileDraft(updatedStaff));
      setPermissions(Array.isArray(updatedStaff.staff_permissions) ? updatedStaff.staff_permissions : permissions);
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
    { label: "Total Staff", value: stats.total, icon: UserRoundCog, tone: "blue" },
    { label: "Pending applications", value: stats.pending, icon: Clock3, tone: "amber" },
    { label: "Approved / active", value: stats.active, icon: CheckCircle2, tone: "green" },
    { label: "Rejected", value: stats.rejected, icon: XCircle, tone: "red" },
    { label: "Suspended", value: stats.suspended, icon: PauseCircle, tone: "purple" },
  ];
  const statusBreakdown = [
    { label: "Active", value: Number(stats.active) || 0, tone: "active" },
    { label: "Pending", value: Number(stats.pending) || 0, tone: "pending" },
    { label: "Rejected", value: Number(stats.rejected) || 0, tone: "rejected" },
    { label: "Suspended", value: Number(stats.suspended) || 0, tone: "suspended" },
    { label: "Inactive", value: Math.max(0, (Number(stats.total) || 0) - [stats.active, stats.pending, stats.rejected, stats.suspended].reduce((sum, value) => sum + (Number(value) || 0), 0)), tone: "inactive" },
  ];
  const statusTotal = Number(stats.total) || 0;
  const statusGradient = (() => {
    if (!statusTotal) return "conic-gradient(#e5edf6 0% 100%)";
    const colors = { active: "#2bb981", pending: "#f3b63f", rejected: "#db3e8a", suspended: "#9567e8", inactive: "#9aa9bb" };
    let stop = 0;
    return `conic-gradient(${statusBreakdown.map((item) => {
      const start = stop;
      stop += item.value / statusTotal * 100;
      return `${colors[item.tone]} ${start}% ${stop}%`;
    }).join(", ")})`;
  })();
  const resetFilters = () => {
    setSearch(""); setDepartment(""); setStatus(""); setEmploymentStatus(""); setPage(1);
    window.history.replaceState({}, "", window.location.pathname);
  };

  return <AdminLayout title="Manage Staff" subtitle="Review applications and manage approved Staff access">
    <section className="staff-management-page">
      <AdminPageHero
        title="Staff applications and accounts"
        description="Review submitted employment details, grant specific access, and keep an audit trail."
        icon={UserRoundCog}
        onRefresh={(signal) => loadStaff(false, true, signal)}
        autoRefreshIntervalMs={60_000}
        autoRefreshPaused={Boolean(selectedStaff || showCreate || actionLoading)}
        refreshing={loading || refreshing}
        actions={<button type="button" className="admin-page-hero-primary" onClick={(event) => { createTriggerRef.current = event.currentTarget; setShowCreate(true); }}><UserPlus size={17} aria-hidden="true" />Create Staff account</button>}
      />
      {notice && <div className="staff-notice" role="status">{notice}<button type="button" onClick={() => setNotice("")} aria-label="Dismiss message">×</button></div>}
      {error && <div className="staff-error" role="alert">{error}<button type="button" onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}
      <div className="staff-overview-grid">{cards.map((card) => { const Icon = card.icon; return <article className={"staff-overview-card " + card.tone} key={card.label}><span className="staff-overview-icon"><Icon size={19} /></span><span>{card.label}</span><strong>{card.value ?? 0}</strong><small>{card.label === "Total Staff" ? "All staff accounts" : card.label === "Pending applications" ? "Awaiting review" : card.label === "Approved / active" ? "Active staff accounts" : card.label === "Rejected" ? "Rejected applications" : "Suspended accounts"}</small></article>; })}</div>
      <section className="staff-analytics-grid" aria-label="Current staff status overview">
        <article className="staff-analytics-card staff-distribution-card">
          <header><BarChart3 size={21} aria-hidden="true" /><div><h3>Staff overview</h3><p>Distribution of staff accounts by status.</p></div></header>
          <div className="staff-status-bar" role="img" aria-label={statusTotal ? statusBreakdown.map((item) => `${item.label}: ${item.value}`).join(", ") : "No staff accounts"}>
            {statusBreakdown.filter((item) => item.value > 0).map((item) => <span key={item.tone} className={"staff-status-bar-segment " + item.tone} style={{ flex: item.value }} />)}
          </div>
          <div className="staff-status-legend">{statusBreakdown.map((item) => <span key={item.tone}><i className={item.tone} />{item.label}<b>{item.value} ({statusTotal ? Math.round(item.value / statusTotal * 100) : 0}%)</b></span>)}</div>
        </article>
        <article className="staff-analytics-card staff-current-status-card">
          <header><Moon size={21} aria-hidden="true" /><div><h3>Current account status</h3><p>Overview of staff account status.</p></div></header>
          <div className="staff-status-chart-content"><div className="staff-status-donut" style={{ background: statusGradient }} role="img" aria-label={statusTotal ? `${statusTotal} total staff accounts` : "No staff accounts"}><span><strong>{statusTotal}</strong><small>Total Staff</small></span></div><div className="staff-status-detail-list">{statusBreakdown.map((item) => <div key={item.tone}><i className={item.tone} /><span>{item.label}</span><b>{item.value} <small>({statusTotal ? Math.round(item.value / statusTotal * 100) : 0}%)</small></b></div>)}</div></div>
        </article>
      </section>
      <form className="staff-filter-bar" onSubmit={(event) => { event.preventDefault(); setPage(1); loadStaff(true); }}>
        <label className="staff-search-control"><Search size={17} /><input value={search} onChange={(event) => setFilter(setSearch, event.target.value)} placeholder="Search name, employee ID, or email" aria-label="Search Staff" /></label>
        <select aria-label="Filter by department" value={department} onChange={(event) => setFilter(setDepartment, event.target.value)}><option value="">All departments</option>{DEPARTMENTS.map((item) => <option key={item}>{item}</option>)}</select>
        <select aria-label="Filter by application status" value={status} onChange={(event) => setFilter(setStatus, event.target.value)}><option value="">All statuses</option><option value="pending">Pending</option><option value="active">Approved / Active</option><option value="rejected">Rejected</option><option value="suspended">Suspended</option><option value="archived">Archived</option></select>
        <select aria-label="Filter by employment status" value={employmentStatus} onChange={(event) => setFilter(setEmploymentStatus, event.target.value)}><option value="">All employment types</option>{EMPLOYMENT.map((item) => <option key={item}>{item}</option>)}</select>
        <button type="button" className="staff-reset-button" onClick={resetFilters}><RotateCcw size={15} />Reset filters</button>
      </form>
      <div className="staff-table-card">
        {loading ? <div className="staff-table-state">Loading Staff records…</div> : staff.length === 0 ? <div className="staff-table-state"><UserRoundCog size={31} /><h3>No Staff records found</h3><p>Try changing your search or filters.</p></div> : <div className="staff-table-wrap"><table className="staff-table"><thead><tr><SortableHead field="name" sort={sort} onSort={toggleSort}>STAFF MEMBER</SortableHead><SortableHead field="department" sort={sort} onSort={toggleSort}>DEPARTMENT</SortableHead><SortableHead field="position" sort={sort} onSort={toggleSort}>POSITION</SortableHead><SortableHead field="employment_status" sort={sort} onSort={toggleSort}>EMPLOYMENT</SortableHead><SortableHead field="role" sort={sort} onSort={toggleSort}>ROLE</SortableHead><SortableHead field="approval_status" sort={sort} onSort={toggleSort}>APPROVAL</SortableHead><SortableHead field="account_status" sort={sort} onSort={toggleSort}>ACCOUNT</SortableHead><SortableHead field="presence" sort={sort} onSort={toggleSort}>PRESENCE</SortableHead><SortableHead field="last_seen_at" sort={sort} onSort={toggleSort}>LAST SEEN</SortableHead><SortableHead field="created_at" sort={sort} onSort={toggleSort}>REGISTERED</SortableHead><th>ACTIONS</th></tr></thead><tbody>{sortedStaff.map((item) => <tr key={item.id}><td><div className="staff-identity"><span className="staff-avatar" aria-hidden="true"><span>{userInitials(item.name)}</span>{item.profile_picture && <img src={profilePhotoUrl(item.profile_picture)} alt="" onError={(event) => { event.currentTarget.hidden = true; }} />}</span><div><strong>{item.name || "—"}</strong><small>{item.email}</small></div></div></td><td>{item.profile?.department || "—"}</td><td>{item.profile?.position || "—"}</td><td>{item.profile?.employment_status || "—"}</td><td>{statusLabel(item.role || "staff")}</td><td><span className={"staff-status-pill " + statusClass(item.approval_status)}>{statusLabel(item.approval_status)}</span></td><td><span className={"staff-status-pill account-status " + statusClass(item.account_status)}>{statusLabel(item.account_status)}</span></td><td><span className={"staff-presence-pill " + (item.presence === "online" ? "online" : "offline")} aria-label={"Presence: " + (item.presence === "online" ? "Online" : "Offline")}><span className="staff-presence-dot" aria-hidden="true" />{item.presence === "online" ? "Online" : "Offline"}</span></td><td><time dateTime={item.last_seen_at || undefined}>{formatLastSeen(item.last_seen_at)}</time></td><td>{formatDate(item.created_at)}</td><td><button type="button" className="staff-row-action" onClick={(event) => { profileTriggerRef.current = event.currentTarget; viewStaff(item); }} aria-label={"View " + item.name}><Eye size={16} />Details</button></td></tr>)}</tbody></table></div>}
      </div>
      <div className="staff-pagination"><span>{pagination.total || 0} records · Page {pagination.current_page || 1} of {pagination.last_page || 1}</span><div><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}><ChevronLeft size={16} />Previous</button><button type="button" onClick={() => setPage((current) => Math.min(pagination.last_page || 1, current + 1))} disabled={page >= (pagination.last_page || 1)}>Next<ChevronRight size={16} /></button></div></div>
    </section>

    {showCreate && <Modal
          isOpen
          onClose={closeCreateModal}
          className="staff-details-modal"
          overlayClassName="staff-modal-backdrop"
          titleId="staff-create-title"
          descriptionId="staff-create-description"
          loading={actionLoading === "create"}
          triggerRef={createTriggerRef}
          initialFocusSelector="[data-modal-initial-focus]"
          closeOnBackdrop={actionLoading !== "create"}
          unstyled
        ><header className="staff-modal-heading"><div><span>ADMIN-ISSUED ACCOUNT</span><h2 id="staff-create-title">Create Staff account</h2></div><button type="button" data-modal-close onClick={closeCreateModal} aria-label="Close create Staff account" disabled={actionLoading === "create"}>×</button></header><p className="staff-modal-note" id="staff-create-description">This creates an active account. Grant only the permissions needed for the Staff member’s duties.</p><form className="staff-create-form" onSubmit={createStaff}><label>Full name<input data-modal-initial-focus value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} required maxLength="255" /></label><label>Email<input type="email" value={createForm.email} onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))} required /></label><label>Contact number<input value={createForm.contact_number} onChange={(event) => setCreateForm((current) => ({ ...current, contact_number: event.target.value }))} /></label><label>Password<input type="password" minLength="8" value={createForm.password} onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))} required /></label><label>Confirm password<input type="password" minLength="8" value={createForm.password_confirmation} onChange={(event) => setCreateForm((current) => ({ ...current, password_confirmation: event.target.value }))} required /></label><label className="staff-permission-option"><input type="checkbox" checked={createForm.manage_students} onChange={(event) => setCreateForm((current) => ({ ...current, manage_students: event.target.checked }))} /><span><strong>Manage student accounts</strong><small>Allows student account lookup and warnings or suspensions of up to 7 days.</small></span></label><label className="staff-permission-option"><input type="checkbox" checked={createForm.moderate_products} onChange={(event) => setCreateForm((current) => ({ ...current, moderate_products: event.target.checked }))} /><span><strong>Moderate products</strong><small>Review pending listings and record approval or rejection decisions.</small></span></label><label className="staff-permission-option"><input type="checkbox" checked={createForm.manage_complaints} onChange={(event) => setCreateForm((current) => ({ ...current, manage_complaints: event.target.checked }))} /><span><strong>Manage complaints</strong><small>Review complaints and record private investigation notes.</small></span></label><label className="staff-permission-option"><input type="checkbox" checked={createForm.view_reports} onChange={(event) => setCreateForm((current) => ({ ...current, view_reports: event.target.checked }))} /><span><strong>View reports</strong><small>Access product and complaint reports for permitted responsibilities.</small></span></label><label className="staff-permission-option"><input type="checkbox" checked={createForm.view_analytics} onChange={(event) => setCreateForm((current) => ({ ...current, view_analytics: event.target.checked }))} /><span><strong>View analytics</strong><small>View product and complaint activity summaries.</small></span></label><div className="staff-modal-actions"><button type="button" className="staff-secondary-button" onClick={closeCreateModal} disabled={actionLoading === "create"}>Cancel</button><button className="staff-create-button" type="submit" disabled={actionLoading === "create"}>{actionLoading === "create" ? "Creating…" : "Create account"}</button></div></form></Modal>}

    {selectedStaff && (
      <Modal
        isOpen
        className="staff-details-modal staff-profile-modal"
        overlayClassName="staff-modal-backdrop"
        titleId="staff-details-title"
        loading={detailLoading}
        onClose={closeStaffProfile}
        triggerRef={profileTriggerRef}
        fallbackFocusSelector=".staff-table .staff-row-action"
        closeOnBackdrop={!actionLoading}
        unstyled
      >
          <header className="staff-profile-header">
            <div className="staff-profile-heading-copy">
              <div className="staff-profile-breadcrumb" aria-label="Breadcrumb">
                <span>Admin Portal</span><span aria-hidden="true">/</span><span>Staff Management</span><span aria-hidden="true">/</span><strong>Staff Profile</strong>
              </div>
              <div className="staff-profile-identity">
                <span className="staff-profile-avatar" aria-hidden="true">
                  {selectedStaff.profile_picture && <img src={profilePhotoUrl(selectedStaff.profile_picture)} alt="" onError={(event) => { event.currentTarget.hidden = true; }} />}
                  <span>{userInitials(selectedStaff.name)}</span>
                </span>
                <div className="staff-profile-name-wrap">
                  <h2 id="staff-details-title">{detailLoading ? "Loading staff profile…" : displayValue(selectedStaff.name, "Staff profile")}</h2>
                  <div className="staff-profile-badges">
                    <span className={"staff-profile-badge " + profileStatusTone(selectedStaff.account_status || selectedStaff.status)}>{statusLabel(selectedStaff.account_status || selectedStaff.status)}</span>
                    <span className={"staff-profile-badge " + profileStatusTone(selectedStaff.approval_status)}>{statusLabel(selectedStaff.approval_status)}</span>
                  </div>
                  <p className="staff-profile-meta">
                    <span>{displayValue(selectedStaff.profile?.department, "Department not assigned")}</span>
                    <span>{displayValue(selectedStaff.profile?.position, "Position not assigned")}</span>
                    {selectedStaff.profile?.employee_id && <span>Employee ID {selectedStaff.profile.employee_id}</span>}
                  </p>
                </div>
              </div>
            </div>
            <button type="button" className="staff-profile-close" data-modal-close onClick={closeStaffProfile} aria-label="Close staff profile">×</button>
          </header>

          <nav className="staff-profile-tabs" role="tablist" aria-label="Staff profile sections">
            {STAFF_PROFILE_TABS.map((tab, index) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  id={"staff-profile-tab-" + tab.id}
                  type="button"
                  role="tab"
                  aria-selected={profileTab === tab.id}
                  aria-controls="staff-profile-tab-panel"
                  tabIndex={profileTab === tab.id ? 0 : -1}
                  onClick={() => setProfileTab(tab.id)}
                  onKeyDown={(event) => {
                    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                    event.preventDefault();
                    const nextIndex = (index + (event.key === "ArrowRight" ? 1 : STAFF_PROFILE_TABS.length - 1)) % STAFF_PROFILE_TABS.length;
                    const nextTab = STAFF_PROFILE_TABS[nextIndex];
                    setProfileTab(nextTab.id);
                    document.getElementById("staff-profile-tab-" + nextTab.id)?.focus();
                  }}
                >
                  <Icon size={16} aria-hidden="true" />{tab.label}
                </button>
              );
            })}
          </nav>

          <div className="staff-profile-content" id="staff-profile-tab-panel" role="tabpanel" aria-labelledby={"staff-profile-tab-" + profileTab} tabIndex="0">
            {profileTab === "overview" && (
              <div className="staff-profile-overview-grid">
                <div className="staff-profile-main-column">
                  <section className="staff-profile-card">
                    <header className="staff-profile-section-heading"><div><h3>Personal information</h3><p>Contact and identity details for this staff account.</p></div></header>
                    <dl className="staff-profile-facts">
                      <div><dt>Email</dt><dd>{displayValue(selectedStaff.email)}</dd></div>
                      <div><dt>Contact number</dt><dd>{displayValue(selectedStaff.contact_number)}</dd></div>
                      <div><dt>Date of birth</dt><dd>{displayValue(formatDate(selectedStaff.profile?.date_of_birth), "Not provided")}</dd></div>
                      <div><dt>Employee ID</dt><dd>{displayValue(selectedStaff.profile?.employee_id, "Not assigned")}</dd></div>
                    </dl>
                  </section>

                  <section className="staff-profile-card">
                    <header className="staff-profile-section-heading"><div><h3>Employment information</h3><p>Current assignment and application review details.</p></div></header>
                    <dl className="staff-profile-facts">
                      <div><dt>Department</dt><dd>{displayValue(selectedStaff.profile?.department, "Not assigned")}</dd></div>
                      <div><dt>Position</dt><dd>{displayValue(selectedStaff.profile?.position, "Not assigned")}</dd></div>
                      <div><dt>Employment type</dt><dd>{displayValue(selectedStaff.profile?.employment_status, "Not assigned")}</dd></div>
                      <div><dt>Start date</dt><dd>{displayValue(formatDate(selectedStaff.profile?.employment_start_date), "Not provided")}</dd></div>
                      <div><dt>Campus / office</dt><dd>{displayValue(selectedStaff.profile?.campus, "Not assigned")}</dd></div>
                      <div><dt>Application submitted</dt><dd>{formatTimestamp(selectedStaff.created_at)}</dd></div>
                      <div><dt>Reviewed by</dt><dd>{displayValue(selectedStaff.profile?.reviewer_name, "Not reviewed")}</dd></div>
                      <div><dt>Reviewed at</dt><dd>{formatTimestamp(selectedStaff.profile?.reviewed_at)}</dd></div>
                      {selectedStaff.status === "suspended" && <div><dt>Suspension ends</dt><dd>{selectedStaff.suspended_until ? formatTimestamp(selectedStaff.suspended_until) : "No end date recorded for this legacy suspension"}</dd></div>}
                    </dl>
                  </section>
                </div>

                <aside className="staff-profile-aside">
                  <section className="staff-profile-card staff-profile-activity-card">
                    <header className="staff-profile-section-heading"><div><h3>Staff account activity</h3><p>Recent access information available for this account.</p></div><BarChart3 size={18} aria-hidden="true" /></header>
                    <div className="staff-login-empty">
                      <span className="staff-login-empty-icon"><Clock3 size={19} aria-hidden="true" /></span>
                      <div><strong>Historical login activity is unavailable</strong><p>This account records current presence and its most recent activity timestamp.</p></div>
                    </div>
                    <dl className="staff-profile-activity-facts">
                      <div><dt>Presence</dt><dd><span className={"staff-profile-presence " + (statusClass(selectedStaff.presence) === "online" ? "is-online" : "")}>{statusLabel(selectedStaff.presence)}</span></dd></div>
                      <div><dt>Last seen</dt><dd>{formatTimestamp(selectedStaff.last_seen_at)}</dd></div>
                    </dl>
                  </section>

                  <section className="staff-profile-card staff-profile-permission-summary">
                    <header className="staff-profile-section-heading"><div><h3>Permission summary</h3><p>Current access granted to this staff account.</p></div><ShieldCheck size={18} aria-hidden="true" /></header>
                    <div className="staff-permission-count"><strong>{permissions.length} of {STAFF_PERMISSION_OPTIONS.length}</strong><span>permissions enabled</span></div>
                    <div className="staff-permission-progress" role="progressbar" aria-label="Enabled staff permissions" aria-valuemin="0" aria-valuemax={STAFF_PERMISSION_OPTIONS.length} aria-valuenow={Math.min(permissions.length, STAFF_PERMISSION_OPTIONS.length)}><span style={{ width: `${Math.min(100, (permissions.length / STAFF_PERMISSION_OPTIONS.length) * 100)}%` }} /></div>
                    {permissions.length > 0 ? <ul>{STAFF_PERMISSION_OPTIONS.filter((permission) => permissions.includes(permission.key)).map((permission) => <li key={permission.key}><CheckCircle2 size={14} aria-hidden="true" />{permission.label}</li>)}</ul> : <p className="staff-profile-muted">No permissions are currently assigned.</p>}
                  </section>
                </aside>
              </div>
            )}

            {profileTab === "employment" && (
              <div className="staff-profile-access-layout">
                <section className="staff-profile-card">
                  <header className="staff-profile-section-heading"><div><h3>Employment profile</h3><p>Update the staff member’s work and contact information.</p></div></header>
                  <div className="staff-edit-grid">
                    <label>Employee ID<input value={draft.employee_id || ""} onChange={(event) => setDraft((current) => ({ ...current, employee_id: event.target.value }))} /></label>
                    <label>Department<select value={draft.department || ""} onChange={(event) => setDraft((current) => ({ ...current, department: event.target.value }))}><option value="">Not assigned</option>{DEPARTMENTS.map((item) => <option key={item}>{item}</option>)}</select></label>
                    <label>Position<input value={draft.position || ""} onChange={(event) => setDraft((current) => ({ ...current, position: event.target.value }))} /></label>
                    <label>Employment status<select value={draft.employment_status || ""} onChange={(event) => setDraft((current) => ({ ...current, employment_status: event.target.value }))}><option value="">Not assigned</option>{EMPLOYMENT.map((item) => <option key={item}>{item}</option>)}</select></label>
                    <label>Employment start<input type="date" value={draft.employment_start_date || ""} onChange={(event) => setDraft((current) => ({ ...current, employment_start_date: event.target.value }))} /></label>
                    <label>Campus / office<input value={draft.campus || ""} onChange={(event) => setDraft((current) => ({ ...current, campus: event.target.value }))} /></label>
                    <label>Contact number<input value={draft.contact_number || ""} onChange={(event) => setDraft((current) => ({ ...current, contact_number: event.target.value }))} /></label>
                  </div>
                </section>

                <section className="staff-profile-card">
                  <header className="staff-profile-section-heading"><div><h3>Permissions and responsibilities</h3><p>Enable only the access required for the staff member’s duties.</p></div></header>
                  <div className="staff-permissions-table-wrap">
                    <table className="staff-permissions-table"><thead><tr><th scope="col">Permission</th><th scope="col">Access</th></tr></thead><tbody>
                      {STAFF_PERMISSION_OPTIONS.map((permission) => {
                        const enabled = permissions.includes(permission.key);
                        return <tr key={permission.key}><th scope="row"><label className="staff-permission-control"><input type="checkbox" checked={enabled} aria-label={`${permission.label} permission`} onChange={(event) => setPermissions((current) => event.target.checked ? Array.from(new Set([...current, permission.key])) : current.filter((item) => item !== permission.key))} /><span><strong>{permission.label}</strong><small>{permission.description}</small></span></label></th><td><span className={"staff-access-state " + (enabled ? "is-enabled" : "is-disabled")}>{enabled ? "Enabled" : "Disabled"}</span></td></tr>;
                      })}
                    </tbody></table>
                  </div>
                </section>

                <div className="staff-profile-savebar">
                  <span role="status">{hasUnsavedChanges ? "Unsaved changes" : "All changes saved"}</span>
                  <div>
                    <button type="button" className="staff-secondary-button" disabled={!hasUnsavedChanges || Boolean(actionLoading)} onClick={() => { if (window.confirm("Discard your unsaved staff profile changes?")) { setDraft(staffProfileDraft(selectedStaff)); setPermissions(Array.isArray(selectedStaff.staff_permissions) ? selectedStaff.staff_permissions : []); } }}>Discard changes</button>
                    <button type="button" className="staff-save-button" onClick={saveProfile} disabled={Boolean(actionLoading) || !hasUnsavedChanges}>{actionLoading?.startsWith("save-") ? "Saving…" : "Save changes"}</button>
                  </div>
                </div>

                {selectedStaff.status === "pending" && <div className="staff-review-actions"><label>Decision note (required to reject)<textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} rows="3" placeholder="Explain the decision to the applicant" /></label><div className="staff-action-row"><button type="button" className="staff-approve-button" disabled={Boolean(actionLoading)} onClick={() => { if (window.confirm("Approve this Staff application and grant only the selected permission?")) performAction(selectedStaff, "approve", { permissions }); }}><CheckCircle2 size={16} />Approve</button><button type="button" className="staff-reject-button" disabled={Boolean(actionLoading) || rejectReason.trim().length < 5} onClick={() => { if (window.confirm("Reject this Staff application? The applicant will be able to see this decision note.")) performAction(selectedStaff, "reject", { reason: rejectReason.trim() }); }}><XCircle size={16} />Reject</button></div></div>}
                {selectedStaff.status === "rejected" && <div className="staff-action-row"><button type="button" className="staff-approve-button" disabled={Boolean(actionLoading)} onClick={() => { if (window.confirm("Return this rejected application to pending review? This will not approve the applicant or grant Staff access.")) performAction(selectedStaff, "reopen"); }}><RotateCcw size={16} />Reopen Application</button></div>}
                {selectedStaff.status === "active" && <form className="staff-enforcement-form" onSubmit={submitStaffEnforcement}>
                  <header><div><h3><ShieldAlert size={17} aria-hidden="true" />Warnings and suspensions</h3><p>Consider violation severity and prior history when choosing a proportionate action and duration.</p></div></header>
                  <label>Action<select value={enforcementAction} onChange={(event) => setEnforcementAction(event.target.value)} disabled={Boolean(actionLoading)}><option value="warning">Issue a warning</option><option value="suspension">Suspend account</option><option value="warning_and_suspension">Issue a warning and suspend</option></select></label>
                  {enforcementAction !== "warning" && <label>Suspension length<select value={durationDays} onChange={(event) => setDurationDays(event.target.value)} disabled={Boolean(actionLoading)}>{[1, 2, 3, 4, 5, 6, 7].map((days) => <option value={days} key={days}>{days} day{days === 1 ? "" : "s"}</option>)}</select></label>}
                  <label className="staff-enforcement-reason">Reason<textarea value={enforcementReason} onChange={(event) => setEnforcementReason(event.target.value)} minLength={5} maxLength={2000} rows="3" required disabled={Boolean(actionLoading)} placeholder="Describe the rule violation and relevant context." /></label>
                  <button type="submit" className="staff-suspend-button" disabled={Boolean(actionLoading) || enforcementReason.trim().length < 5}>{actionLoading === `suspend-${selectedStaff.id}` ? "Applying…" : "Apply enforcement"}</button>
                </form>}
                {["suspended", "inactive"].includes(selectedStaff.status) && <div className="staff-action-row"><button type="button" className="staff-approve-button" disabled={Boolean(actionLoading)} onClick={() => { if (window.confirm("Restore access to this previously approved Staff account?")) performAction(selectedStaff, "activate"); }}><RotateCcw size={16} />Restore account access</button></div>}
                {selectedStaff.status === "archived" && <div className="staff-action-row"><button type="button" className="staff-approve-button" disabled={Boolean(actionLoading)} onClick={() => { if (window.confirm("Return this archived Staff record to pending review? This will not grant Staff access.")) performAction(selectedStaff, "restore"); }}><RotateCcw size={16} />Return to application review</button></div>}
              </div>
            )}

            {profileTab === "history" && (
              <section className="staff-profile-card staff-profile-history-card">
                <header className="staff-profile-section-heading"><div><h3>Application and enforcement history</h3><p>Recorded application decisions, warnings, suspensions, and restorations with actor and timestamp.</p></div><ShieldCheck size={18} aria-hidden="true" /></header>
                {selectedStaff.history?.length ? (
                  <div className="staff-history-table-wrap">
                    <table className="staff-history-table"><thead><tr><th scope="col">Action</th><th scope="col">Performed by</th><th scope="col">Date and time</th><th scope="col">Details</th></tr></thead><tbody>
                      {[...selectedStaff.history].sort((first, second) => Date.parse(second.created_at) - Date.parse(first.created_at)).map((entry) => <tr key={entry.id}><th scope="row">{statusLabel(entry.event)}</th><td>{displayValue(entry.actor_name, "System")}</td><td>{formatTimestamp(entry.created_at)}</td><td>{displayValue(entry.note || (entry.from_status || entry.to_status ? `${statusLabel(entry.from_status || "Unknown")} → ${statusLabel(entry.to_status || "Unknown")}` : ""), "No additional details recorded")}{entry.metadata?.duration_days ? <small>{entry.metadata.duration_days} day suspension{entry.metadata.suspended_until ? ` · until ${formatTimestamp(entry.metadata.suspended_until)}` : ""}</small> : null}</td></tr>)}
                    </tbody></table>
                  </div>
                ) : <div className="staff-profile-empty-history"><ShieldCheck size={22} aria-hidden="true" /><strong>No application or access events recorded</strong><p>History will appear here after staff application or account changes are recorded.</p></div>}
              </section>
            )}
          </div>

          {profileTab === "overview" && selectedStaff.profile?.has_verification_document && <div className="staff-profile-document-row"><button type="button" className="staff-document-button" onClick={openDocument}><FileText size={17} aria-hidden="true" />View verification document</button><span>Private staff document</span></div>}
      </Modal>
    )}  </AdminLayout>;
}
