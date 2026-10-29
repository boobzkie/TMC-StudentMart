import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Eye, Pencil, RotateCcw, Search, ShieldCheck, UserRound, Users, X, XCircle, BookOpen, ShieldAlert } from "lucide-react";
import AdminLayout from "./components/AdminLayout";
import AdminPageHero from "./components/AdminPageHero";
import { SortableHead } from "./ui/Table";
import Modal from "./ui/Modal";
import { API_URL, sortRows } from "./utils/api";
import "./AdminUsers.css";

const COURSES = [
  ["BSIT", "Bachelor of Science in Information Technology"],
  ["BSOA", "Bachelor of Science in Office Administration"],
  ["BSCRIM", "Bachelor of Science in Criminology"],
  ["BSED", "Bachelor of Secondary Education"],
  ["CAS", "College of Arts and Sciences"],
];
const EMPTY_EDIT = { name: "", student_id: "", email: "", contact_number: "", course: "" };
const studentEditForm = (user = {}) => ({
  name: user.name || "",
  student_id: user.student_id || "",
  email: user.email || "",
  contact_number: user.contact_number || "",
  course: user.course || "",
});
const hasStudentEditChanges = (user, form) => Object.keys(EMPTY_EDIT).some((key) => String(form?.[key] ?? "") !== String(user?.[key] ?? ""));
const detailValue = (value, fallback = "Not provided") => String(value ?? "").trim() || fallback;
const statusLabel = (value) => String(value || "Unknown").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const statusTone = (value) => {
  const status = String(value || "").toLowerCase();
  if (status === "active") return "is-success";
  if (status === "pending") return "is-warning";
  if (["inactive", "suspended", "rejected"].includes(status)) return "is-danger";
  return "";
};
function userInitials(name) {
  const parts = String(name || "User").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase();
}
const dateLabel = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};
const courseName = (code) => COURSES.find(([value]) => value === code)?.[1] || "Course not assigned";
const USER_PERIOD_OPTIONS = [
  ["today", "Today"],
  ["7d", "Last 7 days"],
  ["30d", "Last 30 days"],
  ["90d", "Last 3 months"],
  ["6m", "Last 6 months"],
  ["12m", "Last 12 months"],
];
const formatCount = (value) => new Intl.NumberFormat().format(Number(value) || 0);

function UserRoleChart({ stats }) {
  const items = [
    { label: "Students", value: Number(stats.total_students) || 0, tone: "students" },
    { label: "Administrators", value: Number(stats.total_admins) || 0, tone: "admins" },
    { label: "Staff", value: Number(stats.total_staff) || 0, tone: "staff" },
  ];
  const total = items.reduce((sum, item) => sum + item.value, 0);

  if (!total) {
    return <div className="users-chart-empty" role="status">No account role data is available yet.</div>;
  }

  let offset = 0;
  const stops = items.filter((item) => item.value > 0).map((item) => {
    const start = offset;
    offset += (item.value / total) * 100;
    return "var(--users-role-" + item.tone + ") " + start.toFixed(2) + "% " + offset.toFixed(2) + "%";
  });

  return (
    <div className="users-role-chart">
      <div
        className="users-role-donut"
        role="img"
        aria-label={"User roles: " + items.map((item) => item.label + " " + formatCount(item.value)).join(", ")}
        style={{ background: "conic-gradient(" + stops.join(", ") + ")" }}
      >
        <span className="users-role-donut-center">
          <strong>{formatCount(total)}</strong>
          <small>Tracked roles</small>
        </span>
      </div>
      <ul className="users-role-legend">
        {items.map((item) => (
          <li key={item.label}>
            <span className={"users-role-dot users-role-dot--" + item.tone} aria-hidden="true" />
            <span>{item.label}</span>
            <strong>{formatCount(item.value)}</strong>
            <small>{Math.round((item.value / total) * 100)}%</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StudentTrendChart({ data }) {
  const points = Array.isArray(data) ? data : [];
  const values = points.map((point) => Math.max(0, Number(point.students) || 0));
  const maxValue = Math.max(0, ...values);

  if (!points.length || maxValue === 0) {
    return <div className="users-chart-empty" role="status">No student registrations were recorded in this range.</div>;
  }

  const width = 600;
  const height = 220;
  const padding = { top: 18, right: 16, bottom: 34, left: 38 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const scaleMax = Math.max(1, Math.ceil(maxValue * 1.15));
  const coordinates = points.map((point, index) => ({
    key: point.key || point.label || String(index),
    label: point.label || "",
    value: values[index],
    x: points.length > 1 ? padding.left + (index * plotWidth) / (points.length - 1) : padding.left + plotWidth / 2,
    y: padding.top + plotHeight - (values[index] / scaleMax) * plotHeight,
  }));
  const line = coordinates.map((point, index) => (
    (index === 0 ? "M " : "L ") + point.x.toFixed(2) + " " + point.y.toFixed(2)
  )).join(" ");
  const baseline = padding.top + plotHeight;
  const area = line + " L " + coordinates[coordinates.length - 1].x.toFixed(2) + " " + baseline + " L " + coordinates[0].x.toFixed(2) + " " + baseline + " Z";
  const tickValues = [...new Set([0, Math.round(scaleMax / 3), Math.round((scaleMax * 2) / 3), scaleMax])];
  const labelIndexes = [...new Set([0, Math.round((points.length - 1) / 2), points.length - 1])];

  return (
    <div className="users-trend-chart">
      <svg
        viewBox={"0 0 " + width + " " + height}
        role="img"
        aria-label={"Student registration trend. " + formatCount(values.reduce((sum, value) => sum + value, 0)) + " registrations in the selected range."}
        preserveAspectRatio="none"
      >
        <title>Student registrations over time</title>
        <desc>Daily, weekly, or monthly student account registrations based on the selected range.</desc>
        {tickValues.map((tick, index) => {
          const y = padding.top + plotHeight - (tick / scaleMax) * plotHeight;
          return (
            <g key={"tick-" + index}>
              <line className="users-trend-gridline" x1={padding.left} x2={width - padding.right} y1={y} y2={y} />
              <text className="users-trend-axis-label" x={padding.left - 8} y={y + 4} textAnchor="end">{Math.round(tick)}</text>
            </g>
          );
        })}
        <path className="users-trend-area" d={area} />
        <path className="users-trend-line" d={line} />
        {coordinates.map((point, index) => (
          <circle key={point.key + "-" + index} className="users-trend-point" cx={point.x} cy={point.y} r="3.5">
            <title>{point.label + ": " + formatCount(point.value) + " student registrations"}</title>
          </circle>
        ))}
        {labelIndexes.map((index) => (
          <text
            key={"label-" + index}
            className="users-trend-axis-label"
            x={coordinates[index].x}
            y={height - 8}
            textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
          >
            {coordinates[index].label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function StudentDetailsModal({
  user,
  triggerRef,
  loading,
  error,
  editing,
  isStaff,
  editForm,
  actionLoading,
  onClose,
  onCancelEdit,
  onSave,
  onEditFormChange,
  onStartEdit,
  onReinstate,
  onEnforce,
}) {
  const [enforcementAction, setEnforcementAction] = useState("warning");
  const [enforcementReason, setEnforcementReason] = useState("");
  const [durationDays, setDurationDays] = useState("1");
  const [enforcementFeedback, setEnforcementFeedback] = useState("");

  const submitEnforcement = async (event) => {
    event.preventDefault();
    const reason = enforcementReason.trim();
    if (reason.length < 5) return;
    const duration = Number(durationDays);
    const needsDuration = enforcementAction !== "warning";
    const actionLabel = enforcementAction === "warning" ? "issue a warning" : enforcementAction === "suspension" ? `suspend this account for ${duration} day(s)` : `issue a warning and suspend this account for ${duration} day(s)`;
    if (!window.confirm(`Confirm: ${actionLabel}?\n\nReason: ${reason}`)) return;
    setEnforcementFeedback("");
    const succeeded = await onEnforce(user, {
      action: enforcementAction,
      reason,
      ...(needsDuration ? { duration_days: duration } : {}),
    });
    if (succeeded) {
      setEnforcementReason("");
      setEnforcementFeedback("The enforcement action was recorded successfully.");
    }
  };

  return (
    <Modal
      isOpen
      className="student-details-modal"
      overlayClassName="student-details-backdrop"
      titleId="student-details-title"
      descriptionId="student-details-description"
      loading={loading}
      onClose={onClose}
      triggerRef={triggerRef}
      fallbackFocusSelector=".users-filter-card input"
      closeOnBackdrop={!actionLoading}
      unstyled
    >
        <header className="student-details-header">
          <div className="student-details-header-copy">
            <nav className="student-details-breadcrumb" aria-label="Breadcrumb"><span>User Management</span><span aria-hidden="true">/</span><strong>{user.role === "student" ? "Student Account" : "Account Profile"}</strong></nav>
            <div className="student-details-identity">
              <span className="student-details-avatar" aria-hidden="true">{userInitials(user.name)}</span>
              <div className="student-details-name-wrap">
                <h2 id="student-details-title">{loading ? "Loading account…" : detailValue(user.name, "Student account")}</h2>
                <div className="student-details-badges">
                  <span className={"student-details-status " + statusTone(user.status)}>{detailValue(user.status, "Status unavailable")}</span>
                  {user.role && <span className="student-details-role">{user.role === "admin" ? "Administrator" : user.role === "staff" ? "Staff" : "Student"}</span>}
                </div>
                <p className="student-details-meta"><span>{user.student_id ? "Student ID " + user.student_id : "Student ID not assigned"}</span>{user.role === "student" && <span>{user.course ? courseName(user.course) : "Course not assigned"}</span>}</p>
              </div>
            </div>
          </div>
          <button className="student-details-close" type="button" data-modal-close onClick={onClose} aria-label="Close student account details"><X size={19} aria-hidden="true" /></button>
        </header>
        <p className="student-details-description" id="student-details-description">Review account information and available account actions.</p>
        <div className="student-details-body">
          {error && <div className="student-details-error" role="alert"><XCircle size={17} aria-hidden="true" /><span>{error}</span></div>}
          {loading ? <div className="student-details-loading" role="status">Loading account details…</div> : editing && !isStaff ? (
            <form id="student-edit-form" className="student-edit-form student-details-edit-form" onSubmit={onSave}>
              <section className="student-details-section">
                <header><h3>Edit student information</h3><p>Update the student’s account and course details.</p></header>
                <div className="student-edit-grid">
                  <label>Full name<input value={editForm.name} onChange={(event) => onEditFormChange((current) => ({ ...current, name: event.target.value }))} required /></label>
                  <label>Student ID<input value={editForm.student_id} onChange={(event) => onEditFormChange((current) => ({ ...current, student_id: event.target.value }))} required /></label>
                  <label>Email address<input type="email" value={editForm.email} onChange={(event) => onEditFormChange((current) => ({ ...current, email: event.target.value }))} required /></label>
                  <label>Contact number<input value={editForm.contact_number} onChange={(event) => onEditFormChange((current) => ({ ...current, contact_number: event.target.value }))} /></label>
                  <label>Course or program<select value={editForm.course} onChange={(event) => onEditFormChange((current) => ({ ...current, course: event.target.value }))}><option value="">Not assigned</option>{COURSES.map(([code, name]) => <option value={code} key={code}>{code} — {name}</option>)}</select></label>
                </div>
              </section>
            </form>
          ) : (
            <div className={"student-details-grid" + (user.role === "student" ? " has-academic" : "")}>
              <section className="student-details-section">
                <header><h3>Personal and account information</h3><p>Contact and account details for this user.</p></header>
                <dl className="student-details-facts">
                  <div><dt>Full name</dt><dd>{detailValue(user.name)}</dd></div>
                  <div><dt>Email address</dt><dd>{detailValue(user.email)}</dd></div>
                  <div><dt>Contact number</dt><dd>{detailValue(user.contact_number)}</dd></div>
                  <div><dt>Account status</dt><dd><span className={"student-details-status " + statusTone(user.status)}>{detailValue(user.status, "Status unavailable")}</span></dd></div>
                  <div><dt>Registered</dt><dd>{user.created_at ? dateLabel(user.created_at) : "Not provided"}</dd></div>
                  <div><dt>Last updated</dt><dd>{user.updated_at ? dateLabel(user.updated_at) : "Not provided"}</dd></div>
                </dl>
              </section>
              {user.role === "student" && <section className="student-details-section">
                <header><h3>Academic information</h3><p>Student identification and program placement.</p></header>
                <dl className="student-details-facts student-details-academic-facts">
                  <div><dt>Student ID</dt><dd>{detailValue(user.student_id, "Not assigned")}</dd></div>
                  <div><dt>Course / program code</dt><dd>{detailValue(user.course, "Not assigned")}</dd></div>
                  <div><dt>Course / program name</dt><dd>{user.course ? courseName(user.course) : "Not assigned"}</dd></div>
                </dl>
              </section>}
            </div>
          )}
          {user.role === "student" && !loading && !editing && <section className="student-enforcement-panel" aria-labelledby="student-enforcement-title">
            <header><div><h3 id="student-enforcement-title">Warnings and suspensions</h3><p>Consider violation severity and prior history when choosing a proportionate action and duration.</p></div><ShieldAlert size={19} aria-hidden="true" /></header>
            {String(user.status).toLowerCase() === "suspended" && <p className="student-enforcement-current" role="status">{user.suspended_until ? `Suspended until ${dateLabel(user.suspended_until)}.` : "Legacy suspension has no recorded end date; review and restore access manually."}</p>}
            {String(user.status).toLowerCase() === "active" && <form className="student-enforcement-form" onSubmit={submitEnforcement}>
              <label>Action<select value={enforcementAction} onChange={(event) => setEnforcementAction(event.target.value)} disabled={Boolean(actionLoading)}><option value="warning">Issue a warning</option><option value="suspension">Suspend account</option><option value="warning_and_suspension">Issue a warning and suspend</option></select></label>
              {enforcementAction !== "warning" && <label>Suspension length<select value={durationDays} onChange={(event) => setDurationDays(event.target.value)} disabled={Boolean(actionLoading)}>{[1, 2, 3, 4, 5, 6, 7].map((days) => <option value={days} key={days}>{days} day{days === 1 ? "" : "s"}</option>)}</select></label>}
              <label className="student-enforcement-reason">Reason<textarea value={enforcementReason} onChange={(event) => setEnforcementReason(event.target.value)} minLength={5} maxLength={2000} rows={3} required disabled={Boolean(actionLoading)} placeholder="Describe the rule violation and relevant context." /></label>
              <button type="submit" className="student-enforcement-submit" disabled={Boolean(actionLoading) || enforcementReason.trim().length < 5}>{actionLoading?.startsWith("enforcement-") ? "Applying…" : "Apply enforcement"}</button>
              {enforcementFeedback && <p className="student-enforcement-feedback" role="status">{enforcementFeedback}</p>}
            </form>}
            {Array.isArray(user.enforcement_history) && user.enforcement_history.length > 0 ? <ol className="student-enforcement-history">{user.enforcement_history.map((entry) => <li key={entry.id}><div><strong>{statusLabel(entry.event)}</strong><time>{entry.created_at ? dateLabel(entry.created_at) : "Date unavailable"}</time></div><p>{detailValue(entry.reason, "No reason recorded")}</p><small>By {detailValue(entry.actor_name, "System")}{entry.duration_days ? ` · ${entry.duration_days} day suspension` : ""}{entry.suspended_until ? ` · until ${dateLabel(entry.suspended_until)}` : ""}</small></li>)}</ol> : <p className="student-enforcement-empty">No account warnings or suspensions are recorded.</p>}
          </section>}
        </div>
        <footer className="student-details-footer">
          {editing && !isStaff ? <>
            <button type="button" className="student-modal-secondary" onClick={onCancelEdit}>Cancel</button>
            <button type="submit" className="student-modal-primary" form="student-edit-form" disabled={Boolean(actionLoading)}>{actionLoading?.startsWith("save-") ? "Saving changes…" : "Save changes"}</button>
          </> : <>
            {user.role === "student" && !loading && !isStaff && <button type="button" className="student-modal-primary" onClick={onStartEdit}><Pencil size={15} aria-hidden="true" />Edit student and course</button>}
            {user.role === "student" && !loading && !isStaff && ["suspended", "inactive"].includes(String(user.status).toLowerCase()) && <button type="button" className="student-modal-secondary student-modal-status is-activate" disabled={Boolean(actionLoading)} onClick={() => onReinstate(user)}><CheckCircle2 size={15} aria-hidden="true" />Restore account access</button>}
            <button type="button" className="student-modal-secondary student-modal-close-action" onClick={onClose}>Close</button>
          </>}
        </footer>
    </Modal>
  );
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const isStaff = String(localStorage.getItem("role") || "").toLowerCase() === "staff";
  const [users, setUsers] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [course, setCourse] = useState("");
  const [period, setPeriod] = useState("30d");
  const [pageSize, setPageSize] = useState(20);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(!isStaff);
  const [statsError, setStatsError] = useState("");
  const [sort, setSort] = useState({ key: "created_at", direction: "desc" });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, per_page: 20, total: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_EDIT);
  const detailsTriggerRef = useRef(null);
  const detailRequestRef = useRef(0);
  const usersRequestSequenceRef = useRef(0);
  const statsRequestSequenceRef = useRef(0);
  const modalStateRef = useRef({ selectedUser: null, editing: false, editForm: EMPTY_EDIT });
  const modalOpen = Boolean(selectedUser);

  const toggleSort = (key) => setSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
  const sortedUsers = sortRows(users, sort, (user, key) => ({
    name: user.name,
    student_id: user.student_id,
    email: user.email,
    course: user.course,
    contact_number: user.contact_number,
    role: user.role,
    status: user.status,
    created_at: user.created_at,
  })[key]);

  const loadUsers = useCallback(async (showRefresh = false, signal) => {
    if (signal?.aborted) return;
    const requestSequence = ++usersRequestSequenceRef.current;
    if (showRefresh && !signal) setRefreshing(true);
    else if (!showRefresh) setLoading(true);
    setError("");
    const token = localStorage.getItem("token");
    if (!token) { navigate("/login", { replace: true }); return; }
    try {
      const params = new URLSearchParams({ page: String(page), per_page: String(pageSize) });
      if (search.trim()) params.set("search", search.trim());
      if (role) params.set("role", role);
      if (status) params.set("status", status);
      if (course) params.set("course", course);
      const response = await fetch(API_URL + "/admin/users?" + params.toString(), { headers: { Accept: "application/json", Authorization: "Bearer " + token }, ...(signal ? { signal } : {}) });
      if (signal?.aborted || requestSequence !== usersRequestSequenceRef.current) return;
      if (response.status === 401) {
        localStorage.removeItem("token"); localStorage.removeItem("role"); localStorage.removeItem("user");
        navigate("/login", { replace: true }); return;
      }
      if (response.status === 403 && isStaff) { navigate("/staff", { replace: true }); return; }
      const data = await response.json().catch(() => ({}));
      if (signal?.aborted || requestSequence !== usersRequestSequenceRef.current) return;
      if (!response.ok) throw new Error(data.message || "Unable to load users.");
      setUsers(Array.isArray(data.users) ? data.users : []);
      setPagination(data.pagination || { current_page: 1, last_page: 1, total: data.total || 0 });
    } catch (err) {
      if (!signal?.aborted && err?.name !== "AbortError" && requestSequence === usersRequestSequenceRef.current) {
        setError(err.message || "We couldn't load the users. Please try again.");
      }
    } finally {
      if (!signal?.aborted && requestSequence === usersRequestSequenceRef.current) {
        setLoading(false);
        if (!signal) setRefreshing(false);
      }
    }
  }, [navigate, page, pageSize, search, role, status, course, isStaff]);

  const loadStats = useCallback(async (signal, background = false) => {
    if (isStaff) return;
    if (signal?.aborted) return;
    const requestSequence = ++statsRequestSequenceRef.current;
    if (!background) setStatsLoading(true);
    setStatsError("");
    const token = localStorage.getItem("token");
    if (!token) {
      if (!background) setStatsLoading(false);
      navigate("/login", { replace: true });
      return;
    }

    try {
      const response = await fetch(API_URL + "/admin/stats?period=" + encodeURIComponent(period), {
        headers: { Accept: "application/json", Authorization: "Bearer " + token },
        ...(signal ? { signal } : {}),
      });
      if (signal?.aborted || requestSequence !== statsRequestSequenceRef.current) return;
      if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (signal?.aborted || requestSequence !== statsRequestSequenceRef.current) return;
      if (!response.ok) throw new Error(data.message || "Unable to load account insights.");
      if (!data.stats || typeof data.stats !== "object") throw new Error("The account insights response was incomplete.");
      setStats(data.stats);
    } catch (err) {
      if (!signal?.aborted && err?.name !== "AbortError" && requestSequence === statsRequestSequenceRef.current) {
        setStatsError(err.message || "We couldn't load account insights. Please try again.");
      }
    } finally {
      if (!signal?.aborted && requestSequence === statsRequestSequenceRef.current && !background) setStatsLoading(false);
    }
  }, [isStaff, navigate, period]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => loadUsers(false, controller.signal), 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [loadUsers]);
  useEffect(() => {
    if (isStaff) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => loadStats(controller.signal), 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [isStaff, loadStats]);

  const handleSearch = (event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); };
  const refresh = async (signal) => {
    await Promise.all([loadUsers(true, signal), isStaff ? Promise.resolve() : loadStats(signal, Boolean(signal))]);
  };
  const currentUser = (() => { try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; } })();
  const isCurrentUser = (user) => String(user.id) === String(currentUser.id);
  const isAdmin = (user) => String(user.role || "").toLowerCase() === "admin";

  const closeUserDetails = useCallback(() => {
    if (actionLoading) return;
    const current = modalStateRef.current;
    if (current.editing && hasStudentEditChanges(current.selectedUser, current.editForm) && !window.confirm("You have unsaved student changes. Close and discard them?")) return;
    detailRequestRef.current += 1;
    setSelectedUser(null);
    setEditing(false);
    setDetailsError("");
  }, [actionLoading]);

  useEffect(() => {
    modalStateRef.current = { selectedUser, editing, editForm };
  }, [selectedUser, editing, editForm]);

  const cancelStudentEdit = () => {
    if (hasStudentEditChanges(selectedUser, editForm) && !window.confirm("Discard your unsaved student changes?")) return;
    setEditForm(studentEditForm(selectedUser));
    setDetailsError("");
    setEditing(false);
  };

  const viewUser = async (user) => {
    const requestId = ++detailRequestRef.current;
    setSelectedUser(user); setEditing(false); setDetailsError(""); setDetailsLoading(true);
    try {
      const response = await fetch(API_URL + "/admin/users/" + user.id, { headers: { Accept: "application/json", Authorization: "Bearer " + localStorage.getItem("token") } });
      if (requestId !== detailRequestRef.current) return;
      if (response.status === 401) { localStorage.removeItem("token"); localStorage.removeItem("role"); localStorage.removeItem("user"); setSelectedUser(null); navigate("/login", { replace: true }); return; }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to load student details.");
      const detail = data.user || user;
      if (requestId !== detailRequestRef.current) return;
      setSelectedUser(detail);
      setEditForm(studentEditForm(detail));
    } catch (err) {
      if (requestId === detailRequestRef.current) setDetailsError(err.message || "Unable to load student details. Showing the available account information.");
    } finally { if (requestId === detailRequestRef.current) setDetailsLoading(false); }
  };

  const runStatusAction = async (user) => {
    if (isAdmin(user)) return;
    if (!window.confirm("Restore access to " + user.name + "’s account?")) return;
    setActionLoading("activate-" + user.id);
    try {
      const response = await fetch(API_URL + "/admin/users/" + user.id + "/activate", { method: "PUT", headers: { Accept: "application/json", Authorization: "Bearer " + localStorage.getItem("token") } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to restore account access.");
      await loadUsers(true);
      if (String(selectedUser?.id) === String(user.id)) setSelectedUser(data.user || { ...selectedUser, status: "active", suspended_until: null });
    } catch (err) {
      const message = err.message || "Unable to restore account access.";
      setError(message);
      if (String(selectedUser?.id) === String(user.id)) setDetailsError(message);
    }
    finally { setActionLoading(null); }
  };

  const applyEnforcement = async (user, payload) => {
    setActionLoading("enforcement-" + user.id);
    setDetailsError("");
    try {
      const response = await fetch(API_URL + "/admin/users/" + user.id + "/deactivate", { method: "PUT", headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("token") }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(Object.values(data.errors || {}).flat()[0] || data.message || "Unable to apply account enforcement.");
      if (String(selectedUser?.id) === String(user.id)) setSelectedUser(data.user || selectedUser);
      await loadUsers(true);
      return true;
    } catch (err) {
      const message = err.message || "Unable to apply account enforcement.";
      setError(message);
      if (String(selectedUser?.id) === String(user.id)) setDetailsError(message);
      return false;
    }
    finally { setActionLoading(null); }
  };

  const saveStudent = async (event) => {
    event.preventDefault();
    if (!selectedUser) return;
    setActionLoading("save-" + selectedUser.id);
    setDetailsError("");
    try {
      const response = await fetch(API_URL + "/admin/users/" + selectedUser.id, {
        method: "PUT",
        headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("token") },
        body: JSON.stringify({ ...editForm, course: editForm.course || null }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(Object.values(data.errors || {}).flat()[0] || data.message || "Unable to save student details.");
      const updatedUser = data.user || { ...selectedUser, ...editForm };
      setSelectedUser(updatedUser); setEditForm(studentEditForm(updatedUser)); setEditing(false); setDetailsError(""); await loadUsers(true);
    } catch (err) { setDetailsError(err.message || "Unable to save student details."); }
    finally { setActionLoading(null); }
  };

  const statusClass = (value) => {
    const normalized = String(value || "").toLowerCase();
    if (normalized === "active") return "active";
    if (normalized === "inactive" || normalized === "suspended") return "inactive";
    return "pending";
  };
  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setRole("");
    setStatus("");
    setCourse("");
    setPage(1);
    setSort({ key: "created_at", direction: "desc" });
  };
  const hasActiveFilters = Boolean(searchInput || search || role || status || course);
  const currentPage = Number(pagination.current_page) || 1;
  const resultPageSize = Number(pagination.per_page) || pageSize;
  const totalResults = Number(pagination.total) || 0;
  const resultStart = totalResults ? ((currentPage - 1) * resultPageSize) + 1 : 0;
  const resultEnd = Math.min(currentPage * resultPageSize, totalResults);
  const userMetrics = [
    { key: "total_users", label: "Total users", detail: "All registered accounts", icon: Users, tone: "primary" },
    { key: "total_students", label: "Students", detail: "Student accounts", icon: BookOpen, tone: "info" },
    { key: "total_admins", label: "Administrators", detail: "Admin accounts", icon: ShieldCheck, tone: "accent" },
    { key: "total_staff", label: "Staff", detail: "Non-archived staff accounts", icon: UserRound, tone: "success" },
    { key: "active_students", label: "Active students", detail: "Currently active student accounts", icon: CheckCircle2, tone: "success" },
  ];
  const accountSignals = [
    { label: "Active students", key: "active_students", tone: "success" },
    { label: "Pending staff applications", key: "pending_staff_applications", tone: "warning" },
    { label: "Suspended accounts", key: "suspended_accounts", tone: "danger" },
    { label: "Active, unverified accounts", key: "unverified_accounts", tone: "info" },
  ];

  return <AdminLayout title={isStaff ? "Student Accounts" : "User Management"} subtitle={isStaff ? "Review student records, warnings, and time-limited suspensions." : "Manage student accounts, courses, warnings, and suspensions."}>
    <section className={"users-page" + (isStaff ? " users-page-staff" : "") }>
      <AdminPageHero
        title={isStaff ? "Students" : "User Management"}
        description={isStaff ? "View student details and update account status." : "Review accounts, role distribution, and student registration activity."}
        icon={Users}
        actions={!isStaff && <label className="users-period-control"><CalendarDays size={16} aria-hidden="true" /><span>Registration trend</span><select aria-label="Student registration trend range" value={period} onChange={(event) => setPeriod(event.target.value)}>{USER_PERIOD_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>}
        onRefresh={refresh}
        refreshing={loading || refreshing || (!isStaff && statsLoading)}
        autoRefreshIntervalMs={120_000}
        autoRefreshKey={`${page}|${pageSize}|${search}|${role}|${status}|${course}|${period}`}
        autoRefreshPaused={modalOpen || Boolean(actionLoading) || searchInput.trim() !== search}
      />
      {!isStaff && <section className="users-overview" aria-label="User account overview" aria-busy={statsLoading}>
        {statsError && <div className="users-overview-error" role="alert"><span>{statsError}</span><button type="button" onClick={loadStats}>Retry insights</button></div>}
        <div className="users-metrics-grid">
          {userMetrics.map(({ key, label, detail, icon: Icon, tone }) => (
            <article className={"users-metric-card users-metric-card--" + tone} key={key}>
              <span className="users-metric-icon" aria-hidden="true"><Icon size={20} /></span>
              <span className="users-metric-copy"><span className="users-metric-label">{label}</span><strong>{stats ? formatCount(stats[key]) : statsLoading ? "…" : "—"}</strong><small>{detail}</small></span>
            </article>
          ))}
        </div>
        <div className="users-insights-grid">
          <article className="users-insight-card">
            <header><span className="users-insight-icon" aria-hidden="true"><Users size={18} /></span><div><h3>Users by role</h3><p>Current role totals from marketplace accounts.</p></div></header>
            {stats ? <UserRoleChart stats={stats} /> : <div className="users-chart-empty" role="status">{statsLoading ? "Loading role totals…" : "Role totals are unavailable."}</div>}
          </article>
          <article className="users-insight-card users-insight-card--trend">
            <header><span className="users-insight-icon" aria-hidden="true"><CalendarDays size={18} /></span><div><h3>Student registration trend</h3><p>New student accounts over the selected period.</p></div></header>
            {stats ? <StudentTrendChart data={stats.students_over_time} /> : <div className="users-chart-empty" role="status">{statsLoading ? "Loading registration activity…" : "Registration activity is unavailable."}</div>}
          </article>
          <article className="users-insight-card">
            <header><span className="users-insight-icon" aria-hidden="true"><ShieldCheck size={18} /></span><div><h3>Account status snapshot</h3><p>Current status signals from the admin summary.</p></div></header>
            {stats ? <ul className="users-status-list">{accountSignals.map((item) => <li key={item.key}><span className={"users-status-dot users-status-dot--" + item.tone} aria-hidden="true" /><span>{item.label}</span><strong>{formatCount(stats[item.key])}</strong></li>)}</ul> : <div className="users-chart-empty" role="status">{statsLoading ? "Loading account status…" : "Account status is unavailable."}</div>}
            <p className="users-status-note">Status signals may overlap; values are not combined into a percentage.</p>
          </article>
        </div>
      </section>}
      <form className="users-filter-card" onSubmit={handleSearch}>
        <label className="users-search-box"><Search size={18} /><input type="search" placeholder="Search name, email, or student ID" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} aria-label="Search by student name, email, or ID" /></label>
        {!isStaff && <select aria-label="Filter by role" value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }}><option value="">All roles</option><option value="student">Students</option><option value="admin">Administrators</option></select>}
        <select aria-label="Filter by status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="pending">Pending</option><option value="suspended">Suspended</option></select>
        <select aria-label="Filter by course" value={course} onChange={(event) => { setCourse(event.target.value); setPage(1); }}><option value="">All courses</option>{COURSES.map(([code, name]) => <option value={code} key={code}>{code} — {name}</option>)}</select>
        <button className="users-search-button" type="submit"><Search size={16} />Search</button>
        <label className="users-page-size"><span>Rows per page</span><select aria-label="Rows per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select></label>
        {hasActiveFilters && <button className="users-clear-button" type="button" onClick={clearFilters}><RotateCcw size={15} />Clear filters</button>}
      </form>
      {error && <div className="users-error" role="alert"><div className="users-error-icon"><XCircle size={19} /></div><div><strong>Unable to load or update users</strong><span>{error}</span></div><button type="button" onClick={refresh}>Try again</button></div>}
      <div className="users-summary"><div className="users-summary-left"><div className="users-summary-icon"><Users size={18} /></div><div><strong>{formatCount(totalResults)}</strong><span>{totalResults === 1 ? "account found" : "accounts found"}</span></div></div>{course && <div className="users-summary-stats"><div><BookOpen size={15} /><span>Filtered by {courseName(course)}</span></div></div>}</div>
      <div className="users-table-card">
        {loading ? <div className="users-loading"><div className="users-loading-row">Loading student accounts…</div></div> : users.length === 0 ? <div className="users-empty"><div className="users-empty-icon"><Users size={30} /></div><h3>No users found</h3><p>Try changing your search or filter settings.</p><button type="button" onClick={clearFilters}>Clear filters</button></div> : <div className="users-table-wrapper"><table className="users-table"><thead><tr><SortableHead field="name" sort={sort} onSort={toggleSort}>USER</SortableHead><SortableHead field="student_id" sort={sort} onSort={toggleSort}>STUDENT ID</SortableHead><SortableHead field="email" sort={sort} onSort={toggleSort}>EMAIL</SortableHead><SortableHead field="course" sort={sort} onSort={toggleSort}>COURSE / PROGRAM</SortableHead><SortableHead field="contact_number" sort={sort} onSort={toggleSort}>CONTACT</SortableHead>{!isStaff && <SortableHead field="role" sort={sort} onSort={toggleSort}>ROLE</SortableHead>}<SortableHead field="status" sort={sort} onSort={toggleSort}>STATUS</SortableHead><SortableHead field="created_at" sort={sort} onSort={toggleSort}>REGISTERED</SortableHead><th>ACTIONS</th></tr></thead><tbody>{sortedUsers.map((user) => { const admin = isAdmin(user); return <tr key={user.id}>
          <td><div className="user-cell"><div className="user-avatar" aria-hidden="true">{userInitials(user.name)}</div><div className="user-info"><strong>{user.name || "Unknown User"}</strong>{isCurrentUser(user) && <span className="you-badge">You</span>}</div></div></td>
          <td><span className="student-id">{user.student_id || "—"}</span></td><td><span className="email-text">{user.email || "—"}</span></td>
          <td>{user.role === "student" ? <span className="course-badge" title={courseName(user.course)}>{user.course || "Unassigned"}</span> : <span className="course-empty">—</span>}</td>
          <td><span className="contact-text">{user.contact_number || "—"}</span></td>
          {!isStaff && <td><span className={"role-badge " + (admin ? "admin" : "student")}>{admin ? <ShieldCheck size={13} /> : <UserRound size={13} />}{admin ? "ADMIN" : "STUDENT"}</span></td>}
          <td><span className={"status-badge " + statusClass(user.status)}><span className="status-dot" />{String(user.status || "unknown").toUpperCase()}</span></td><td><span className="date-text">{dateLabel(user.created_at)}</span></td>
          <td><div className="user-actions"><button className="user-manage-button" type="button" onClick={(event) => { detailsTriggerRef.current = event.currentTarget; viewUser(user); }} aria-label={"Manage " + (user.name || "user") }><Eye size={15} aria-hidden="true" />Details</button></div></td>
        </tr>; })}</tbody></table></div>}
      </div>
      <div className="users-pagination"><span>Showing {resultStart}–{resultEnd} of {formatCount(totalResults)} accounts</span><div><span className="users-pagination-page">Page {currentPage} of {pagination.last_page || 1}</span><button type="button" aria-label="Previous page" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}><ChevronLeft size={16} />Previous</button><button type="button" aria-label="Next page" onClick={() => setPage((current) => Math.min(pagination.last_page || 1, current + 1))} disabled={page >= (pagination.last_page || 1)}>Next<ChevronRight size={16} /></button></div></div>
    </section>
    {selectedUser && <StudentDetailsModal
      key={selectedUser.id}
      user={selectedUser}
      triggerRef={detailsTriggerRef}
      loading={detailsLoading}
      error={detailsError}
      editing={editing}
      isStaff={isStaff}
      editForm={editForm}
      actionLoading={actionLoading}
      onClose={closeUserDetails}
      onCancelEdit={cancelStudentEdit}
      onSave={saveStudent}
      onEditFormChange={setEditForm}
      onStartEdit={() => { setDetailsError(""); setEditing(true); }}
      onReinstate={runStatusAction}
      onEnforce={applyEnforcement}
    />}
  </AdminLayout>;
}
