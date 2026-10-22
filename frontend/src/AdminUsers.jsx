import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Users, UserRound, ShieldCheck, CheckCircle2, XCircle, UserX, Trash2, MoreHorizontal, ChevronLeft, ChevronRight, Pencil, BookOpen } from "lucide-react";
import AdminLayout from "./components/AdminLayout";
import AdminPageHero from "./components/AdminPageHero";
import { SortableHead } from "./ui/Table";
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
const dateLabel = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};
const courseName = (code) => COURSES.find(([value]) => value === code)?.[1] || "Course not assigned";

export default function AdminUsers() {
  const navigate = useNavigate();
  const isStaff = String(localStorage.getItem("role") || "").toLowerCase() === "staff";
  const [users, setUsers] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [course, setCourse] = useState("");
  const [sort, setSort] = useState({ key: "created_at", direction: "desc" });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_EDIT);

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

  const loadUsers = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true); else setLoading(true);
    setError("");
    const token = localStorage.getItem("token");
    if (!token) { navigate("/login", { replace: true }); return; }
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "20" });
      if (search.trim()) params.set("search", search.trim());
      if (role) params.set("role", role);
      if (status) params.set("status", status);
      if (course) params.set("course", course);
      const response = await fetch(API_URL + "/admin/users?" + params.toString(), { headers: { Accept: "application/json", Authorization: "Bearer " + token } });
      if (response.status === 401) {
        localStorage.removeItem("token"); localStorage.removeItem("role"); localStorage.removeItem("user");
        navigate("/login", { replace: true }); return;
      }
      if (response.status === 403 && isStaff) { navigate("/staff", { replace: true }); return; }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to load users.");
      setUsers(Array.isArray(data.users) ? data.users : []);
      setPagination(data.pagination || { current_page: 1, last_page: 1, total: data.total || 0 });
    } catch (err) { setError(err.message || "We couldn't load the users. Please try again."); }
    finally { setLoading(false); setRefreshing(false); }
  }, [navigate, page, search, role, status, course, isStaff]);

  useEffect(() => { const timer = setTimeout(() => loadUsers(), 0); return () => clearTimeout(timer); }, [loadUsers]);

  const handleSearch = (event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); };
  const refresh = () => loadUsers(true);
  const currentUser = (() => { try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; } })();
  const isCurrentUser = (user) => String(user.id) === String(currentUser.id);
  const isAdmin = (user) => String(user.role || "").toLowerCase() === "admin";

  const viewUser = async (user) => {
    setSelectedUser(user); setEditing(false); setDetailsLoading(true);
    try {
      const response = await fetch(API_URL + "/admin/users/" + user.id, { headers: { Accept: "application/json", Authorization: "Bearer " + localStorage.getItem("token") } });
      if (response.status === 401) { localStorage.removeItem("token"); localStorage.removeItem("role"); localStorage.removeItem("user"); navigate("/login", { replace: true }); return; }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to load student details.");
      const detail = data.user || user;
      setSelectedUser(detail);
      setEditForm({ name: detail.name || "", student_id: detail.student_id || "", email: detail.email || "", contact_number: detail.contact_number || "", course: detail.course || "" });
    } catch (err) { setError(err.message || "Unable to load student details."); setSelectedUser(null); }
    finally { setDetailsLoading(false); }
  };

  const runStatusAction = async (user, action) => {
    if (isAdmin(user)) return;
    const verb = action === "activate" ? "Activate" : "Deactivate";
    if (!window.confirm(verb + " " + user.name + "’s account?")) return;
    setActionLoading(action + "-" + user.id);
    try {
      const response = await fetch(API_URL + "/admin/users/" + user.id + "/" + action, { method: "PUT", headers: { Accept: "application/json", Authorization: "Bearer " + localStorage.getItem("token") } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to update account status.");
      await loadUsers(true);
    } catch (err) { setError(err.message || "Unable to update account status."); }
    finally { setActionLoading(null); }
  };

  const deleteUser = async (user) => {
    if (isStaff || isAdmin(user) || isCurrentUser(user)) return;
    if (!window.confirm("Permanently delete " + user.name + "’s student account? This cannot be undone.")) return;
    setActionLoading("delete-" + user.id);
    try {
      const response = await fetch(API_URL + "/admin/users/" + user.id, { method: "DELETE", headers: { Accept: "application/json", Authorization: "Bearer " + localStorage.getItem("token") } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to delete user.");
      setSelectedUser(null); await loadUsers(true);
    } catch (err) { setError(err.message || "Unable to delete user."); }
    finally { setActionLoading(null); }
  };

  const saveStudent = async (event) => {
    event.preventDefault();
    if (!selectedUser) return;
    setActionLoading("save-" + selectedUser.id);
    try {
      const response = await fetch(API_URL + "/admin/users/" + selectedUser.id, {
        method: "PUT",
        headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: "Bearer " + localStorage.getItem("token") },
        body: JSON.stringify({ ...editForm, course: editForm.course || null }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(Object.values(data.errors || {}).flat()[0] || data.message || "Unable to save student details.");
      setSelectedUser(data.user || selectedUser); setEditing(false); await loadUsers(true);
    } catch (err) { setError(err.message || "Unable to save student details."); }
    finally { setActionLoading(null); }
  };

  const statusClass = (value) => {
    const normalized = String(value || "").toLowerCase();
    if (normalized === "active") return "active";
    if (normalized === "inactive" || normalized === "suspended") return "inactive";
    return "pending";
  };

  return <AdminLayout title={isStaff ? "Student Accounts" : "User Management"} subtitle={isStaff ? "Search student records and update account status." : "Manage student accounts, courses, and administrator access."}>
    <section className={"users-page" + (isStaff ? " users-page-staff" : "") }>
      <AdminPageHero
        title={isStaff ? "Students" : "User Management"}
        description={isStaff ? "View student details and update account status." : "Review student information and keep course records current."}
        icon={Users}
        onRefresh={refresh}
        refreshing={loading || refreshing}
      />
      <form className="users-filter-card" onSubmit={handleSearch}>
        <label className="users-search-box"><Search size={18} /><input type="search" placeholder="Search name, email, or student ID" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} aria-label="Search by student name, email, or ID" /></label>
        {!isStaff && <select aria-label="Filter by role" value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }}><option value="">All roles</option><option value="student">Students</option><option value="admin">Administrators</option></select>}
        <select aria-label="Filter by status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="pending">Pending</option><option value="suspended">Suspended</option></select>
        <select aria-label="Filter by course" value={course} onChange={(event) => { setCourse(event.target.value); setPage(1); }}><option value="">All courses</option>{COURSES.map(([code, name]) => <option value={code} key={code}>{code} — {name}</option>)}</select>
        <button className="users-search-button" type="submit"><Search size={16} />Search</button>
      </form>
      {error && <div className="users-error" role="alert"><div className="users-error-icon"><XCircle size={19} /></div><div><strong>Unable to load or update users</strong><span>{error}</span></div><button type="button" onClick={refresh}>Try again</button></div>}
      <div className="users-summary"><div className="users-summary-left"><div className="users-summary-icon"><Users size={18} /></div><div><strong>{pagination.total || 0}</strong><span>{pagination.total === 1 ? "account found" : "accounts found"}</span></div></div><div className="users-summary-stats"><div><BookOpen size={15} /><span>{course ? course + " filter" : "All course records"}</span></div><div><CheckCircle2 size={15} /><span>Page {pagination.current_page || 1} of {pagination.last_page || 1}</span></div></div></div>
      <div className="users-table-card">
        {loading ? <div className="users-loading"><div className="users-loading-row">Loading student accounts…</div></div> : users.length === 0 ? <div className="users-empty"><div className="users-empty-icon"><Users size={30} /></div><h3>No users found</h3><p>Try changing your search or filter settings.</p><button type="button" onClick={() => { setSearchInput(""); setSearch(""); setRole(""); setStatus(""); setCourse(""); setPage(1); }}>Clear filters</button></div> : <div className="users-table-wrapper"><table className="users-table"><thead><tr><SortableHead field="name" sort={sort} onSort={toggleSort}>USER</SortableHead><SortableHead field="student_id" sort={sort} onSort={toggleSort}>STUDENT ID</SortableHead><SortableHead field="email" sort={sort} onSort={toggleSort}>EMAIL</SortableHead><SortableHead field="course" sort={sort} onSort={toggleSort}>COURSE / PROGRAM</SortableHead><SortableHead field="contact_number" sort={sort} onSort={toggleSort}>CONTACT</SortableHead>{!isStaff && <SortableHead field="role" sort={sort} onSort={toggleSort}>ROLE</SortableHead>}<SortableHead field="status" sort={sort} onSort={toggleSort}>STATUS</SortableHead><SortableHead field="created_at" sort={sort} onSort={toggleSort}>REGISTERED</SortableHead><th>ACTIONS</th></tr></thead><tbody>{sortedUsers.map((user) => { const admin = isAdmin(user); return <tr key={user.id}>
          <td><div className="user-cell"><div className="user-avatar">{String(user.name || "U").trim().charAt(0).toUpperCase()}</div><div className="user-info"><strong>{user.name || "Unknown User"}</strong>{isCurrentUser(user) && <span className="you-badge">You</span>}</div></div></td>
          <td><span className="student-id">{user.student_id || "—"}</span></td><td><span className="email-text">{user.email || "—"}</span></td>
          <td>{user.role === "student" ? <span className="course-badge" title={courseName(user.course)}>{user.course || "Unassigned"}</span> : <span className="course-empty">—</span>}</td>
          <td><span className="contact-text">{user.contact_number || "—"}</span></td>
          {!isStaff && <td><span className={"role-badge " + (admin ? "admin" : "student")}>{admin ? <ShieldCheck size={13} /> : <UserRound size={13} />}{admin ? "ADMIN" : "STUDENT"}</span></td>}
          <td><span className={"status-badge " + statusClass(user.status)}><span className="status-dot" />{String(user.status || "unknown").toUpperCase()}</span></td><td><span className="date-text">{dateLabel(user.created_at)}</span></td>
          <td><div className="user-actions">{!admin && <button className={String(user.status).toLowerCase() === "active" ? "action-deactivate" : "action-activate"} disabled={Boolean(actionLoading)} onClick={() => runStatusAction(user, String(user.status).toLowerCase() === "active" ? "deactivate" : "activate")} title={String(user.status).toLowerCase() === "active" ? "Deactivate student" : "Activate student"}>{String(user.status).toLowerCase() === "active" ? <UserX size={14} /> : <CheckCircle2 size={14} />}{String(user.status).toLowerCase() === "active" ? "Deactivate" : "Activate"}</button>}{!isStaff && !admin && <button className="action-delete" disabled={Boolean(actionLoading)} onClick={() => deleteUser(user)} title="Delete student"><Trash2 size={14} /></button>}<button className="action-more" type="button" title="View details" aria-label={"View details for " + user.name} onClick={() => viewUser(user)}>{!isStaff && !admin ? <Pencil size={15} /> : <MoreHorizontal size={16} />}</button></div></td>
        </tr>; })}</tbody></table></div>}
      </div>
      <div className="users-pagination"><span>{pagination.total || 0} accounts · Page {pagination.current_page || 1} of {pagination.last_page || 1}</span><div><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}><ChevronLeft size={16} />Previous</button><button type="button" onClick={() => setPage((current) => Math.min(pagination.last_page || 1, current + 1))} disabled={page >= (pagination.last_page || 1)}>Next<ChevronRight size={16} /></button></div></div>
    </section>
    {selectedUser && <div className="student-details-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedUser(null); }}><section className="student-details-modal" role="dialog" aria-modal="true" aria-labelledby="student-details-title"><div className="student-details-heading"><div><span>STUDENT ACCOUNT</span><h2 id="student-details-title">{detailsLoading ? "Loading details…" : selectedUser.name || "Student details"}</h2></div><button type="button" onClick={() => setSelectedUser(null)} aria-label="Close student details">×</button></div>
      {editing && !isStaff ? <form className="student-edit-form" onSubmit={saveStudent}><label>Student ID<input value={editForm.student_id} onChange={(event) => setEditForm((current) => ({ ...current, student_id: event.target.value }))} required /></label><label>Full name<input value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} required /></label><label>Email<input type="email" value={editForm.email} onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))} required /></label><label>Contact number<input value={editForm.contact_number} onChange={(event) => setEditForm((current) => ({ ...current, contact_number: event.target.value }))} /></label><label>Course / Program<select value={editForm.course} onChange={(event) => setEditForm((current) => ({ ...current, course: event.target.value }))}><option value="">Not assigned</option>{COURSES.map(([code, name]) => <option value={code} key={code}>{code} — {name}</option>)}</select></label><div className="student-edit-actions"><button type="button" className="student-edit-cancel" onClick={() => setEditing(false)}>Cancel</button><button type="submit" disabled={Boolean(actionLoading)}>{actionLoading?.startsWith("save-") ? "Saving…" : "Save changes"}</button></div></form> : <><dl><div><dt>Student ID</dt><dd>{selectedUser.student_id || "—"}</dd></div><div><dt>Email</dt><dd>{selectedUser.email || "—"}</dd></div><div><dt>Contact number</dt><dd>{selectedUser.contact_number || "—"}</dd></div><div><dt>Course / Program</dt><dd><strong>{selectedUser.course || "Not assigned"}</strong>{selectedUser.course && <small>{courseName(selectedUser.course)}</small>}</dd></div><div><dt>Account status</dt><dd>{selectedUser.status || "—"}</dd></div><div><dt>Registered</dt><dd>{dateLabel(selectedUser.created_at)}</dd></div><div><dt>Last updated</dt><dd>{dateLabel(selectedUser.updated_at)}</dd></div></dl>{!isStaff && selectedUser.role === "student" && <button type="button" className="student-edit-open" onClick={() => setEditing(true)}><Pencil size={15} />Edit student and course</button>}</>}
    </section></div>}
  </AdminLayout>;
}
