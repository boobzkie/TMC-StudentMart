import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, AlertCircle, BarChart3, FileBarChart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "./components/AdminLayout";
import AdminPageHero from "./components/AdminPageHero";
import { API_URL } from "./utils/api";
import "./StaffInsights.css";

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function initialFrom() {
  const date = new Date();
  date.setDate(date.getDate() - 29);
  return isoDate(date);
}

function formatHours(value) {
  if (value == null || !Number.isFinite(Number(value))) return "Not available";
  const hours = Number(value);
  return hours < 24 ? hours + " hrs" : (hours / 24).toFixed(1) + " days";
}

export default function StaffInsights({ mode = "reports" }) {
  const navigate = useNavigate();
  const isAnalytics = mode === "analytics";
  const endpoint = isAnalytics ? "/staff/analytics" : "/staff/reports";
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(isoDate(new Date()));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtersFocused, setFiltersFocused] = useState(false);
  const requestSequenceRef = useRef(0);

  const load = useCallback(async (showLoading = true, signal) => {
    if (signal?.aborted) return;
    const requestSequence = ++requestSequenceRef.current;
    if (showLoading) setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams({ from, to });
      const response = await fetch(API_URL + endpoint + "?" + params, {
        headers: { Accept: "application/json", Authorization: "Bearer " + token },
        ...(signal ? { signal } : {}),
      });
      if (signal?.aborted || requestSequence !== requestSequenceRef.current) return;
      const body = await response.json().catch(() => ({}));
      if (signal?.aborted || requestSequence !== requestSequenceRef.current) return;
      if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("user");
        navigate("/login", { replace: true });
        return;
      }
      if (!response.ok) throw new Error(body.message || "Unable to load this workspace.");
      setData(body.data || null);
    } catch (err) {
      if (!signal?.aborted && err?.name !== "AbortError" && requestSequence === requestSequenceRef.current) {
        setError(err.message || "Unable to load this workspace.");
      }
    } finally {
      if (!signal?.aborted && requestSequence === requestSequenceRef.current) setLoading(false);
    }
  }, [endpoint, from, navigate, to]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => load(true, controller.signal), 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  const summary = data?.summary || {};
  const cards = [
    ["Products submitted", summary.products_submitted, "In selected period"],
    ["Listings awaiting review", summary.products_pending, "Pending submissions in period"],
    ["Products approved", summary.products_approved, "Recorded review decisions"],
    ["Products rejected", summary.products_rejected, "Recorded review decisions"],
    ["Complaints submitted", summary.complaints_submitted, "In selected period"],
    ["Complaints pending", summary.complaints_pending, "Submitted in selected period"],
    ["Complaints under review", summary.complaints_in_review, "Submitted in selected period"],
    ["Complaints resolved", summary.complaints_resolved, "Submitted in selected period"],
    ["Average resolution time", formatHours(summary.average_resolution_hours), "Based on resolved complaints"],
  ];

  const activity = Array.isArray(data?.daily_activity) ? data.daily_activity : [];
  const hasActivity = activity.some((day) => Object.entries(day).some(([key, value]) => key !== "date" && Number(value) > 0));

  return (
    <AdminLayout title={isAnalytics ? "Staff Analytics" : "Staff Reports"} subtitle="Product review and student complaint activity">
      <main className="staff-insights-page">
        <AdminPageHero
          title={isAnalytics ? "Product and complaint analytics" : "Product and complaint report"}
          description="Review product and complaint activity from the selected date range."
          icon={isAnalytics ? BarChart3 : FileBarChart}
          onRefresh={(signal) => load(false, signal)}
          refreshing={loading}
          autoRefreshIntervalMs={120_000}
          autoRefreshKey={`${endpoint}|${from}|${to}`}
          autoRefreshPaused={filtersFocused}
        />

        <form className="staff-insights-filters" onFocusCapture={() => setFiltersFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFiltersFocused(false); }} onSubmit={(event) => { event.preventDefault(); load(); }}>
          <label>From<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} required /></label>
          <label>To<input type="date" value={to} min={from} max={isoDate(new Date())} onChange={(event) => setTo(event.target.value)} required /></label>
          <button type="submit">Apply date range</button>
          {data?.period && <span>Showing {data.period.from} through {data.period.to}</span>}
        </form>

        {error && <div className="staff-insights-error" role="alert"><AlertCircle size={17} />{error}<button type="button" onClick={load}>Try again</button></div>}
        {loading && !data && <div className="staff-insights-state">Loading real StudentMart activity…</div>}

        {data && <>
          <section className="staff-insights-cards">
            {cards.map(([label, value, hint]) => <article key={label}><span>{label}</span><strong>{value ?? 0}</strong><small>{hint}</small></article>)}
          </section>
          <section className="staff-insights-panel">
            <header><div><Activity size={18} /><h3>Daily activity</h3></div><span>{activity.length} days</span></header>
            {!hasActivity ? <div className="staff-insights-state">No product or complaint activity was recorded in this date range.</div>
              : <div className="staff-insights-table-wrap"><table><thead><tr><th>Date</th><th>Submissions</th><th>Approved</th><th>Rejected</th><th>Complaints</th><th>Resolved</th></tr></thead><tbody>
                {activity.filter((day) => Object.entries(day).some(([key, value]) => key !== "date" && Number(value) > 0)).map((day) => <tr key={day.date}><td>{new Date(day.date + "T00:00:00").toLocaleDateString(undefined, { dateStyle: "medium" })}</td><td>{day.product_submissions}</td><td>{day.products_approved}</td><td>{day.products_rejected}</td><td>{day.complaints_submitted}</td><td>{day.complaints_resolved}</td></tr>)}
              </tbody></table></div>}
          </section>
        </>}
      </main>
    </AdminLayout>
  );
}
