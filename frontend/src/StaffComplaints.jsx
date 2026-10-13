import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Eye, Loader2, MessageSquareWarning, RefreshCw, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "./components/AdminLayout";
import { API_URL } from "./utils/api";
import "./StaffComplaints.css";

const STATUSES = [["pending", "Pending"], ["in_review", "Under review"], ["resolved", "Resolved"], ["rejected", "Rejected"]];

function formatDate(value, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(undefined, withTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" });
}

export default function StaffComplaints() {
  const navigate = useNavigate();
  const [complaints, setComplaints] = useState([]);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [statusDraft, setStatusDraft] = useState("pending");
  const [investigationNote, setInvestigationNote] = useState("");
  const [publicResponse, setPublicResponse] = useState("");
  const [saving, setSaving] = useState(false);

  const request = useCallback(async (path, options = {}) => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login", { replace: true });
      throw new Error("Please sign in again.");
    }
    const response = await fetch(API_URL + path, {
      ...options,
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + token,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("user");
      navigate("/login", { replace: true });
      throw new Error(data.message || "Please sign in again.");
    }
    if (!response.ok) throw new Error(data.message || "The request could not be completed.");
    return data;
  }, [navigate]);

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setRefreshing(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "10" });
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const statsParams = new URLSearchParams();
      if (from) statsParams.set("from", from);
      if (to) statsParams.set("to", to);
      const statsSuffix = statsParams.toString() ? "?" + statsParams.toString() : "";
      const [listResponse, statsResponse] = await Promise.all([
        request("/staff/complaints?" + params.toString()),
        request("/staff/complaints/stats" + statsSuffix),
      ]);
      const pageData = listResponse.data || {};
      setComplaints(Array.isArray(pageData.data) ? pageData.data : []);
      setPagination({
        current_page: Number(pageData.current_page || 1),
        last_page: Number(pageData.last_page || 1),
        total: Number(pageData.total || 0),
      });
      setStats(statsResponse.stats || {});
    } catch (err) {
      setError(err.message || "Unable to load complaints.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [from, page, request, search, statusFilter, to]);

  useEffect(() => {
    const timer = setTimeout(() => loadData(false), 280);
    return () => clearTimeout(timer);
  }, [loadData]);

  const openComplaint = async (item) => {
    setSelected(item);
    setStatusDraft(item.status || "pending");
    setInvestigationNote(item.staff_note || "");
    setPublicResponse(item.admin_response || "");
    setError("");
    try {
      const response = await request("/staff/complaints/" + item.id);
      let complaint = response.data || item;
      if (complaint.status === "pending") {
        const reviewResponse = await request("/staff/complaints/" + complaint.id, {
          method: "PUT",
          body: JSON.stringify({ status: "in_review" }),
        });
        complaint = reviewResponse.data || { ...complaint, status: "in_review" };
      }
      setSelected(complaint);
      setStatusDraft(complaint.status || "pending");
      setInvestigationNote(complaint.staff_note || "");
      setPublicResponse(complaint.admin_response || "");
    } catch (err) {
      setError(err.message || "Unable to load complaint details.");
    }
  };

  const saveComplaint = async (event) => {
    event.preventDefault();
    if (!selected) return;
    if (statusDraft === "rejected" && publicResponse.trim().length < 5) {
      setError("Enter a response of at least five characters before rejecting a complaint.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await request("/staff/complaints/" + selected.id, {
        method: "PUT",
        body: JSON.stringify({
          status: statusDraft,
          investigation_note: investigationNote.trim() || null,
          response_to_complainant: publicResponse.trim() || null,
        }),
      });
      setSelected(response.data || selected);
      await loadData(false);
    } catch (err) {
      setError(err.message || "Unable to save the complaint.");
    } finally {
      setSaving(false);
    }
  };

  const cardStats = [["Pending", "pending"], ["Under review", "in_review"], ["Resolved", "resolved"], ["Rejected", "rejected"]];

  return (
    <AdminLayout title="Complaints" subtitle="Review reports submitted by students">
      <main className="staff-complaints-page">
        <section className="staff-complaints-hero">
          <div className="staff-complaints-hero-icon"><MessageSquareWarning size={24} /></div>
          <div><span>STUDENT SUPPORT</span><h2>Complaint review</h2><p>Review the reported issue, keep private investigation notes, and send a response visible to the complainant.</p></div>
          <button type="button" onClick={() => loadData()} disabled={refreshing}><RefreshCw size={16} />{refreshing ? "Refreshing…" : "Refresh"}</button>
        </section>

        {error && <div className="staff-complaints-error" role="alert"><AlertCircle size={17} />{error}<button type="button" onClick={() => setError("")} aria-label="Dismiss error"><X size={16} /></button></div>}

        <section className="staff-complaint-stats">
          {cardStats.map(([label, key]) => <article key={key}><span>{label}</span><strong>{stats[key] ?? 0}</strong></article>)}
        </section>

        <form className="staff-complaint-filters" onSubmit={(event) => { event.preventDefault(); setPage(1); }}>
          <label className="staff-complaint-search"><Search size={17} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search subject, student, ID, or product" aria-label="Search complaints" /></label>
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} aria-label="Filter complaint status">
            <option value="">All statuses</option>{STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <label>From<input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /></label>
          <label>To<input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></label>
          <button type="submit">Apply filters</button>
        </form>

        <section className="staff-complaint-list">
          {loading ? <div className="staff-complaint-state"><Loader2 className="staff-complaint-spin" size={24} />Loading complaints…</div>
            : complaints.length === 0 ? <div className="staff-complaint-state"><CheckCircle2 size={28} /><h3>No complaints found</h3><p>New complaints that match the selected filters will appear here.</p></div>
              : <div className="staff-complaint-table-wrap"><table><thead><tr><th>Complaint</th><th>Student</th><th>Reported product</th><th>Status</th><th>Submitted</th><th></th></tr></thead><tbody>
                {complaints.map((item) => <tr key={item.id}>
                  <td><strong>{item.subject}</strong><small>{item.description}</small></td>
                  <td>{item.user?.name || "Unavailable"}<small>{item.user?.student_id || "—"}</small></td>
                  <td>{item.product?.name || "General report"}{item.product?.user?.name && <small>Seller: {item.product.user.name}</small>}</td>
                  <td><span className={"staff-complaint-status status-" + item.status}>{String(item.status || "pending").replaceAll("_", " ")}</span></td>
                  <td>{formatDate(item.created_at)}</td>
                  <td><button type="button" className="staff-complaint-view" onClick={() => openComplaint(item)}><Eye size={15} />Review</button></td>
                </tr>)}
              </tbody></table></div>}
          <footer className="staff-complaint-pagination"><span>{pagination.total} complaints · Page {pagination.current_page} of {pagination.last_page}</span><div><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}><ChevronLeft size={16} />Previous</button><button type="button" onClick={() => setPage((value) => Math.min(pagination.last_page, value + 1))} disabled={page >= pagination.last_page}>Next<ChevronRight size={16} /></button></div></footer>
        </section>

        {selected && <div className="staff-complaint-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setSelected(null); }}>
          <section className="staff-complaint-dialog" role="dialog" aria-modal="true" aria-labelledby="staff-complaint-title">
            <header><div><span>COMPLAINT #{selected.id}</span><h2 id="staff-complaint-title">{selected.subject}</h2></div><button type="button" aria-label="Close" onClick={() => !saving && setSelected(null)}><X size={19} /></button></header>
            <div className="staff-complaint-detail-grid"><div><span>Submitted by</span><strong>{selected.user?.name || "Unavailable"} · {selected.user?.student_id || "No student ID"}</strong></div><div><span>Product / seller</span><strong>{selected.product?.name || "General report"}{selected.product?.user?.name ? " · " + selected.product.user.name : ""}</strong></div><div><span>Submitted</span><strong>{formatDate(selected.created_at, true)}</strong></div><div><span>Last handled</span><strong>{selected.handler?.name ? selected.handler.name + " · " + formatDate(selected.handled_at, true) : "Not yet handled"}</strong></div></div>
            <div className="staff-complaint-description"><span>Student description</span><p>{selected.description}</p></div>
            <form onSubmit={saveComplaint}>
              <label>Status<select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value)} disabled={saving || ["resolved", "rejected"].includes(selected.status)}>{STATUSES.filter(([value]) => value === selected.status || (selected.status === "pending" && value === "in_review") || (selected.status === "in_review" && ["resolved", "rejected"].includes(value))).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{["resolved", "rejected"].includes(selected.status) && <small>Closed complaints cannot be reopened by Staff. You can still update the notes.</small>}</label>
              <label>Private investigation note<textarea value={investigationNote} onChange={(event) => setInvestigationNote(event.target.value)} maxLength={5000} rows={4} placeholder="Visible only to authorized Admin and Staff" /><small>This note is excluded from the student complaint API.</small></label>
              <label>Response to complainant{statusDraft === "rejected" && <em>Required to reject</em>}<textarea value={publicResponse} onChange={(event) => setPublicResponse(event.target.value)} maxLength={5000} rows={3} placeholder="This response is visible to the student" /></label>
              {error && <div className="staff-complaints-error" role="alert">{error}</div>}
              <footer><button type="button" onClick={() => setSelected(null)} disabled={saving}>Cancel</button><button type="submit" disabled={saving}>{saving ? "Saving…" : "Save complaint"}</button></footer>
            </form>
          </section>
        </div>}
      </main>
    </AdminLayout>
  );
}
