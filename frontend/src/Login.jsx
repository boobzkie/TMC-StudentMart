import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_URL } from "./utils/api";
import { ArrowRight, ChartColumn, Eye, EyeOff, LockKeyhole, Mail, Package, ShieldCheck, UsersRound } from "lucide-react";
import "./Login.css";

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const handleLogin = async (event) => {
    event.preventDefault();
    if (loading) return;

    setError("");
    const normalizedEmail = email.trim();
    const nextFieldErrors = {};

    if (!normalizedEmail) {
      nextFieldErrors.email = "Please enter your email address.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      nextFieldErrors.email = "Enter a valid email address.";
    }

    if (!password) {
      nextFieldErrors.password = "Please enter your password.";
    }

    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) return;

    const loginUrl = API_URL.replace(/\/+$/, "") + "/login";

    try {
      setLoading(true);
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("user");

      const response = await fetch(loginUrl, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const validationMessages = Object.values(data?.errors || {}).flat();
        const hasCredentialError = [data?.message, ...validationMessages].some(
          (message) =>
            typeof message === "string" &&
            /provided credentials are incorrect|invalid email or password/i.test(message)
        );

        let message = "Unable to sign in. Check your details and try again.";

        if (response.status === 401 || hasCredentialError) {
          message = "Email or password is incorrect.";
        } else if (response.status === 422) {
          message = "Please check your email and password, then try again.";
        } else if (response.status === 403) {
          const accountStatus = String(data?.status || "").toLowerCase();
          const statusMessages = {
            pending: "Your Staff application is waiting for administrator approval.",
            rejected: "Your Staff application was not approved. Check your application status for details.",
            suspended: "Your Staff access has been suspended. Please contact the TMC Administrator.",
            archived: "This Staff account is archived and cannot sign in.",
          };
          message = statusMessages[accountStatus] || "This account cannot access the administrator and staff portal.";
        } else if (response.status === 404) {
          message = "The sign-in service is unavailable. Please try again later.";
        } else if (response.status === 419) {
          message = "Your sign-in session expired. Refresh the page and try again.";
        } else if (response.status === 429) {
          message = "Too many sign-in attempts. Please wait a minute and try again.";
        } else if (response.status >= 500) {
          message = "Sign in is temporarily unavailable. Please try again.";
        }

        setError(message);
        return;
      }

      const loggedInUser = data?.user;
      if (!data?.token || !loggedInUser) {
        setError("We couldn't complete sign in. Please try again.");
        return;
      }

      const userRole = String(loggedInUser.role || data.role || "").toLowerCase();
      if (userRole !== "admin" && userRole !== "staff") {
        setError("This web portal is for administrators and approved staff. Students should use the Flutter app.");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("role", userRole);
      localStorage.setItem("user", JSON.stringify(loggedInUser));
      navigate(userRole === "staff" ? "/staff" : "/admin", { replace: true });
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? "Unable to connect to StudentMart. Check your connection and try again."
          : "Sign in is temporarily unavailable. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const clearEmailError = () => {
    if (fieldErrors.email) {
      setFieldErrors((current) => ({ ...current, email: "" }));
    }
    if (error) setError("");
  };

  const clearPasswordError = () => {
    if (fieldErrors.password) {
      setFieldErrors((current) => ({ ...current, password: "" }));
    }
    if (error) setError("");
  };

  return (
    <main className="login-page" data-theme="light">
      <section className="auth-shell" aria-label="TMC StudentMart sign in">
        <header className="auth-topbar">
          <Link className="auth-topbar-brand" to="/" aria-label="TMC StudentMart home">
            <img src="/assets/tmc-logo.png" alt="" />
            <span><strong>TMC <em>StudentMart</em></strong><small>ADMIN &amp; STAFF PORTAL</small></span>
          </Link>
        </header>

        <aside className="auth-promo-panel" aria-labelledby="brand-heading">
          <div className="auth-promo-copy">
            <span className="auth-promo-eyebrow">
              <ShieldCheck size={16} aria-hidden="true" /> SECURE PORTAL
            </span>
            <span className="auth-promo-kicker">ADMIN &amp; STAFF PORTAL</span>
            <h2 id="brand-heading">Marketplace<br />management,<br /><span>all in one place.</span></h2>
            <p>
              Manage student listings, orders, sellers, users, and marketplace activity from one secure workspace.
            </p>
            <ul className="auth-promo-features" aria-label="Portal capabilities">
              <li><Package size={19} aria-hidden="true" /><span><strong>Marketplace management</strong><small>Review products, listings, and orders.</small></span></li>
              <li><UsersRound size={19} aria-hidden="true" /><span><strong>Account oversight</strong><small>Support student, seller, and staff accounts.</small></span></li>
              <li><ChartColumn size={19} aria-hidden="true" /><span><strong>Reports and insights</strong><small>Understand activity across the marketplace.</small></span></li>
            </ul>
          </div>

        </aside>

        <section className="auth-form-panel login-card" aria-labelledby="login-heading">
          <div className="login-title">
            <h1 id="login-heading">Welcome back.</h1>
            <p>Sign in to your TMC StudentMart workspace.</p>
          </div>

          {error && <div className="login-error" id="login-error" role="alert">{error}</div>}

          <form className="login-form" onSubmit={handleLogin} noValidate aria-busy={loading}>
            <div className={fieldErrors.email ? "login-field has-error" : "login-field"}>
              <label htmlFor="email">Email address</label>
              <span className="login-input-wrap">
                <Mail size={18} aria-hidden="true" />
                <input
                  id="email"
                  type="email"
                  placeholder="Enter your staff email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    clearEmailError();
                  }}
                  autoComplete="username"
                  inputMode="email"
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? "email-error" : undefined}
                  disabled={loading}
                  required
                />
              </span>
              {fieldErrors.email && <span className="login-field-error" id="email-error" role="alert">{fieldErrors.email}</span>}
            </div>

            <div className={fieldErrors.password ? "login-field has-error" : "login-field"}>
              <label htmlFor="password">Password</label>
              <span className="login-input-wrap">
                <LockKeyhole size={18} aria-hidden="true" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    clearPasswordError();
                  }}
                  autoComplete="current-password"
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? "password-error" : undefined}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  aria-controls="password"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </span>
              {fieldErrors.password && <span className="login-field-error" id="password-error" role="alert">{fieldErrors.password}</span>}
            </div>

            <div className="login-forgot-row">
              <Link to="/forgot-password">Forgot password?</Link>
            </div>

            <button type="submit" className="login-button" disabled={loading}>
              {loading ? (
                <>
                  <span className="button-spinner" aria-hidden="true" />
                  Signing in...
                </>
              ) : <>Sign in <ArrowRight size={19} aria-hidden="true" /></>}
            </button>
          </form>

          <p className="login-register-link">
            <span>Need a staff account?</span> <Link to="/staff/register">Register as Staff</Link>
          </p>
          <p className="login-student-note">
            Student accounts are managed in the TMC StudentMart mobile application.
          </p>
        </section>
      </section>
    </main>
  );
}

export default Login;
