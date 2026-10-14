import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { API_URL } from "./utils/api";
import { Moon, ShieldCheck, Sun } from "lucide-react";
import usePortalTheme from "./utils/usePortalTheme";
import "./StaffRegistration.css";

const DEPARTMENTS = [
  ["BSIT", "Bachelor of Science in Information Technology"],
  ["BSOA", "Bachelor of Science in Office Administration"],
  ["BSCRIM", "Bachelor of Science in Criminology"],
  ["BSED", "Bachelor of Secondary Education"],
  ["CAS", "College of Arts and Sciences"],
];
const EMPTY_FORM = { first_name: "", middle_name: "", last_name: "", suffix: "", date_of_birth: "", contact_number: "", email: "", department: "", position: "", employment_status: "", employment_start_date: "", password: "", password_confirmation: "", terms_accepted: false };

function calculateAge(value) {
  if (!value) return "—";
  const birth = new Date(value + "T00:00:00");
  if (Number.isNaN(birth.getTime())) return "—";
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age -= 1;
  return age < 0 ? "—" : String(age);
}

export default function StaffRegistration() {
  const { theme, toggleTheme } = usePortalTheme();
  const formRef = useRef(null);
  const [view, setView] = useState("register");
  const [form, setForm] = useState(EMPTY_FORM);
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [application, setApplication] = useState(null);
  const [statusForm, setStatusForm] = useState({ email: "", application_reference: "" });
  const [statusResult, setStatusResult] = useState(null);
  const age = useMemo(() => calculateAge(form.date_of_birth), [form.date_of_birth]);

  const updateField = (event) => {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (form.password !== form.password_confirmation) return setError("The password and confirmation do not match.");
    if (!document) return setError("Upload an institutional ID or other TMC-approved proof of employment.");
    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (key !== "terms_accepted") payload.append(key, value);
    });
    payload.set("terms_accepted", form.terms_accepted ? "1" : "0");
    payload.append("verification_document", document);
    try {
      setLoading(true);
      const response = await fetch(API_URL + "/staff/register", { method: "POST", headers: { Accept: "application/json" }, body: payload });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(Object.values(data.errors || {}).flat()[0] || data.message || "Unable to submit the Staff application.");
      setApplication({ email: data.email, reference: data.application_reference });
      setStatusForm({ email: data.email || form.email, application_reference: data.application_reference || "" });
      setSuccess(data.message || "Your Staff application was submitted.");
      setForm(EMPTY_FORM);
      setDocument(null);
      formRef.current?.reset();
    } catch (err) {
      setError(err.message || "Unable to submit the Staff application.");
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async (event) => {
    event.preventDefault();
    setError("");
    setStatusResult(null);
    try {
      setLoading(true);
      const response = await fetch(API_URL + "/staff/application-status", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(statusForm),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to check this application.");
      setStatusResult(data);
    } catch (err) {
      setError(err.message || "Unable to check this application.");
    } finally {
      setLoading(false);
    }
  };

  return <main className="staff-registration-page" data-theme={theme}><button type="button" className="portal-auth-theme-toggle" onClick={toggleTheme} aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"} aria-pressed={theme === "dark"}>{theme === "light" ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}<span>{theme === "light" ? "Dark mode" : "Light mode"}</span></button><section className="auth-shell staff-auth-shell" aria-label="TMC staff application portal">
    <aside className="auth-promo-panel">
      <div className="auth-promo-brand">
        <img src="/assets/tmc-logo.png" alt="" />
        <div><strong>TMC StudentMart</strong><span>STAFF APPLICATION PORTAL</span></div>
      </div>
      <div className="auth-promo-copy">
        <span className="auth-promo-eyebrow"><ShieldCheck size={15} /> STAFF VERIFICATION</span>
        <h2>Support the student community <span>with a verified account.</span></h2>
        <p>Submit your institutional details and proof of employment for review by an authorized TMC administrator.</p>
      </div>
      <div className="auth-promo-bottom">
        <div className="auth-promo-note">
          <ShieldCheck size={19} aria-hidden="true" />
          <div><strong>Approval is required</strong><span>Submitting an application does not grant portal access. Your account is enabled only after administrator approval.</span></div>
        </div>
        <div className="auth-promo-footer"><span>Trinidad Municipal College</span><span>StudentMart</span></div>
      </div>
    </aside>
    <div className="auth-form-panel">
    <section className="staff-registration-card">
    <header className="staff-registration-brand"><img src="/assets/tmc-logo.png" alt="Trinidad Municipal College seal" /><div><strong>TMC StudentMart</strong><span>Staff application portal</span></div></header>
    <nav className="staff-registration-tabs" aria-label="Staff application options">
      <button type="button" className={view === "register" ? "active" : ""} onClick={() => { setView("register"); setError(""); }}>Register as Staff</button>
      <button type="button" className={view === "status" ? "active" : ""} onClick={() => { setView("status"); setError(""); }}>Check application status</button>
    </nav>
    {view === "register" ? <>
      <div className="staff-registration-heading"><span className="staff-form-eyebrow">STAFF ACCESS REQUEST</span><h1>Create a staff application</h1><p>Submit your TMC details for administrator review. Sending this form does not grant Staff access.</p></div>
      {success && <div className="staff-form-success" role="status"><strong>Application submitted</strong><p>{success}</p>{application && <><p>Save this application reference to check your status later:</p><code>{application.reference}</code><button type="button" onClick={() => { setView("status"); setSuccess(""); }}>Check status</button></>}</div>}
      {error && <div className="staff-form-error" role="alert">{error}</div>}
      <form ref={formRef} className="staff-registration-form" onSubmit={handleRegister}>
        <fieldset><legend>Personal information</legend><div className="staff-form-grid">
          <label>First name<input name="first_name" value={form.first_name} onChange={updateField} autoComplete="given-name" maxLength="100" required /></label>
          <label>Middle name <span className="optional-label">Optional</span><input name="middle_name" value={form.middle_name} onChange={updateField} autoComplete="additional-name" maxLength="100" /></label>
          <label>Last name<input name="last_name" value={form.last_name} onChange={updateField} autoComplete="family-name" maxLength="100" required /></label>
          <label>Suffix <span className="optional-label">Optional</span><input name="suffix" value={form.suffix} onChange={updateField} placeholder="Jr., III" maxLength="30" /></label>
          <label>Date of birth<input name="date_of_birth" type="date" value={form.date_of_birth} onChange={updateField} required /></label>
          <label>Age <span className="optional-label">Calculated</span><input value={age} readOnly aria-label="Age calculated from date of birth" /></label>
          <label>Contact number<input name="contact_number" type="tel" value={form.contact_number} onChange={updateField} autoComplete="tel" maxLength="30" required /></label>
          <label>Email address<input name="email" type="email" value={form.email} onChange={updateField} autoComplete="email" maxLength="255" required /></label>
        </div></fieldset>
        <fieldset><legend>Employment information</legend><div className="staff-form-grid">
          <label>Department / Program<select name="department" value={form.department} onChange={updateField} required><option value="">Choose a department</option>{DEPARTMENTS.map(([code, name]) => <option value={code} key={code}>{code} — {name}</option>)}</select></label>
          <label>Academic rank / position<input name="position" list="staff-position-options" value={form.position} onChange={updateField} maxLength="120" placeholder="Institution-approved position" required /><datalist id="staff-position-options"><option value="Instructor" /><option value="College Instructor" /></datalist></label>
          <label>Employment status<select name="employment_status" value={form.employment_status} onChange={updateField} required><option value="">Choose employment status</option><option>Regular</option><option>Part-Time</option><option>Contractual</option></select></label>
          <label>Employment start date <span className="optional-label">Optional</span><input name="employment_start_date" type="date" value={form.employment_start_date} onChange={updateField} /></label>
        </div></fieldset>
        <fieldset><legend>Account and verification</legend><div className="staff-form-grid">
          <label>Password<input name="password" type="password" value={form.password} onChange={updateField} minLength="8" autoComplete="new-password" required /></label>
          <label>Confirm password<input name="password_confirmation" type="password" value={form.password_confirmation} onChange={updateField} minLength="8" autoComplete="new-password" required /></label>
          <label className="staff-document-field">Institutional ID or approved proof of employment<input type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" onChange={(event) => setDocument(event.target.files?.[0] || null)} required /><small>JPG, PNG, or PDF. Maximum 5 MB. The file is private and viewable only by an authorized administrator.</small></label>
        </div><label className="staff-terms"><input name="terms_accepted" type="checkbox" checked={form.terms_accepted} onChange={updateField} required /><span>I confirm the information is accurate and consent to TMC administrators using these details and the uploaded document to review this Staff application.</span></label></fieldset>
        {error && <div className="staff-form-error" role="alert">{error}</div>}
        <button className="staff-submit-button" type="submit" disabled={loading}>{loading ? "Submitting application…" : "Submit staff application"}</button>
      </form>
    </> : <section className="staff-status-section">
      <div className="staff-registration-heading"><span className="staff-form-eyebrow">APPLICATION STATUS</span><h1>Check your application</h1><p>Use the email address and private reference shown after you submitted your application.</p></div>
      {error && <div className="staff-form-error" role="alert">{error}</div>}
      <form className="staff-status-form" onSubmit={checkStatus}><label>Email address<input type="email" value={statusForm.email} onChange={(event) => setStatusForm((current) => ({ ...current, email: event.target.value }))} required /></label><label>Application reference<input value={statusForm.application_reference} onChange={(event) => setStatusForm((current) => ({ ...current, application_reference: event.target.value }))} minLength="24" required /></label><button className="staff-submit-button" type="submit" disabled={loading}>{loading ? "Checking…" : "Check status"}</button></form>
      {statusResult && <div className="staff-status-result" role="status"><span className={"staff-status-pill " + String(statusResult.status).toLowerCase()}>{statusResult.status}</span><p>{statusResult.message}</p>{statusResult.decision_reason && <div><strong>Administrator note</strong><p>{statusResult.decision_reason}</p></div>}{Array.isArray(statusResult.history) && statusResult.history.length > 0 && <div className="staff-status-history"><strong>Application history</strong><ol>{statusResult.history.map((item, index) => (<li key={index}><span>{String(item.from_status || "not recorded")} to {String(item.to_status || "pending")}</span><small>{new Date(item.created_at).toLocaleString()}</small>{item.note ? <p>{item.note}</p> : null}</li>))}</ol></div>}</div>}
    </section>}
    <footer className="staff-registration-footer"><Link to="/login">← Return to login</Link><span>Students should continue to use the Flutter application.</span></footer>
  </section></div></section></main>;
}

