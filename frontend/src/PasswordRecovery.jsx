import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, LockKeyhole, Mail, Moon, ShieldCheck, Sun } from "lucide-react";
import { API_URL } from "./utils/api";
import usePortalTheme from "./utils/usePortalTheme";
import "./PasswordRecovery.css";

function PasswordRecovery() {
  const [searchParams] = useSearchParams();
  const { theme, toggleTheme } = usePortalTheme();
  const token = searchParams.get("token") || "";
  const emailFromLink = searchParams.get("email") || "";
  const isReset = Boolean(token);
  const [email, setEmail] = useState(emailFromLink);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!email.trim()) {
      setError("Enter the email address for your TMC StudentMart account.");
      return;
    }
    if (isReset && password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (isReset && password !== passwordConfirmation) {
      setError("The password confirmation does not match.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/${isReset ? "reset-password" : "forgot-password"}`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(isReset
          ? { token, email: email.trim(), password, password_confirmation: passwordConfirmation }
          : { email: email.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const firstError = Object.values(data.errors || {}).flat()[0];
        throw new Error(firstError || data.message || "The request could not be completed. Please try again.");
      }

      setSuccess(data.message || (isReset
        ? "Your password has been reset. You can sign in now."
        : "If an account matches that email, password-reset instructions have been sent."));
      if (isReset) {
        setPassword("");
        setPasswordConfirmation("");
      }
    } catch (requestError) {
      setError(requestError.message || "Unable to connect to the Laravel server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page password-recovery-page" data-theme={theme}>
      <button
        type="button"
        className="portal-auth-theme-toggle"
        onClick={toggleTheme}
        aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
        aria-pressed={theme === "dark"}
      >
        {theme === "light" ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
        <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>
      </button>

      <section className="auth-shell password-recovery-shell" aria-label="TMC StudentMart password recovery">
        <aside className="auth-promo-panel">
          <div className="auth-promo-brand">
            <img src="/assets/tmc-logo.png" alt="" />
            <div><strong>TMC StudentMart</strong><span>ACCOUNT RECOVERY</span></div>
          </div>
          <div className="auth-promo-copy">
            <span className="auth-promo-eyebrow"><ShieldCheck size={15} /> SECURE ACCOUNT ACCESS</span>
            <h2>Get back to your <span>StudentMart account.</span></h2>
            <p>Use the email address linked to your account. Password reset links expire for your protection.</p>
          </div>
          <div className="auth-promo-bottom">
            <div className="auth-promo-note">
              <ShieldCheck size={19} aria-hidden="true" />
              <div><strong>Protected reset process</strong><span>Only someone with access to your registered email can complete a password reset.</span></div>
            </div>
            <div className="auth-promo-footer"><span>Trinidad Municipal College</span><span>StudentMart</span></div>
          </div>
        </aside>

        <section className="auth-form-panel login-card" aria-labelledby="recovery-heading">
          <div className="auth-form-brand">
            <img src="/assets/tmc-logo.png" alt="Trinidad Municipal College seal" />
            <span>ACCOUNT RECOVERY</span>
          </div>
          <div className="login-title">
            <h1 id="recovery-heading">{isReset ? "Choose a new password" : "Forgot your password?"}</h1>
            <p>{isReset ? "Set a new password for your TMC StudentMart account." : "We will email a secure reset link if an account matches the address."}</p>
          </div>

          {error && <div className="login-error" role="alert">{error}</div>}
          {success && <div className="password-recovery-success" role="status">{success}</div>}

          {!success || !isReset ? (
            <form className="login-form" onSubmit={handleSubmit}>
              <div className="login-field">
                <label htmlFor="recovery-email">Email address</label>
                <span className="login-input-wrap">
                  <Mail size={18} aria-hidden="true" />
                  <input id="recovery-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={loading || (isReset && Boolean(emailFromLink))} required />
                </span>
              </div>

              {isReset && <>
                <div className="login-field">
                  <label htmlFor="new-password">New password</label>
                  <span className="login-input-wrap">
                    <LockKeyhole size={18} aria-hidden="true" />
                    <input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} disabled={loading} required />
                  </span>
                </div>
                <div className="login-field">
                  <label htmlFor="password-confirmation">Confirm new password</label>
                  <span className="login-input-wrap">
                    <LockKeyhole size={18} aria-hidden="true" />
                    <input id="password-confirmation" type="password" autoComplete="new-password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} minLength={8} disabled={loading} required />
                  </span>
                </div>
              </>}

              <button type="submit" className="login-button" disabled={loading}>
                {loading ? <><span className="button-spinner" aria-hidden="true" />Please wait…</> : (isReset ? "Reset password" : "Send reset link")}
              </button>
            </form>
          ) : null}

          {success && isReset ? <Link className="login-button password-recovery-continue" to="/login">Sign in</Link> : null}
          {isReset && error.includes("invalid or expired") && <p className="login-register-link"><Link to="/forgot-password">Request a new reset link</Link></p>}
          <p className="login-register-link"><Link to="/login"><ArrowLeft size={14} aria-hidden="true" /> Back to sign in</Link></p>
          <p className="login-student-note">If you do not receive an email, check your spam folder or contact the TMC StudentMart administrator.</p>
        </section>
      </section>
    </main>
  );
}

export default PasswordRecovery;
