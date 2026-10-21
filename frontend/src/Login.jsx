import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_URL } from "./utils/api";
import { Eye, EyeOff, Mail, LockKeyhole, Moon, ShieldCheck, Sun } from "lucide-react";
import usePortalTheme from "./utils/usePortalTheme";
import "./Login.css";

function Login() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = usePortalTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");
    if (!email.trim()) return setError("Please enter your email.");
    if (!password) return setError("Please enter your password.");
    const loginUrl = API_URL.replace(/\/+$/, "") + "/login";

    try {
      setLoading(true);
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("user");
      const response = await fetch(loginUrl, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
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
          message = data?.message || "This account is not allowed to sign in.";
        } else if (response.status === 404) {
          message = "The sign-in service was not found. Check that the Laravel API is running.";
        } else if (response.status === 429) {
          message = "Too many sign-in attempts. Please wait a minute and try again.";
        } else if (response.status >= 500) {
          message = "Something went wrong on the server. Please try again later.";
        }

        console.error("[Admin sign-in] API request failed.", {
          endpoint: loginUrl,
          status: response.status,
        });
        throw new Error(message);
      }
      const loggedInUser = data.user;
      if (!data.token || !loggedInUser) throw new Error("Login response is missing the token or user information.");
      const userRole = String(loggedInUser.role || data.role || "").toLowerCase();
      if (userRole !== "admin" && userRole !== "staff") {
        setError("This web portal is for administrators and approved staff. Students should use the Flutter app.");
        return;
      }
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", userRole);
      localStorage.setItem("user", JSON.stringify(loggedInUser));
      navigate(userRole === "staff" ? "/staff" : "/admin", { replace: true });
    } catch (err) {
      if (err instanceof TypeError) {
        console.error("[Admin sign-in] Network request failed.", { endpoint: loginUrl });
        setError("Unable to connect to the server. Check that Laravel is running, then try again.");
      } else {
        console.error("[Admin sign-in] Client-side sign-in error.", {
          name: err instanceof Error ? err.name : "UnknownError",
        });
        setError(err.message || "Sign-in could not be completed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page" data-theme={theme}>
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

      <section className="auth-shell" aria-label="TMC StudentMart sign in">
        <aside className="auth-promo-panel">
          <div className="auth-promo-brand">
            <img src="/assets/tmc-logo.png" alt="" />
            <div>
              <strong>TMC StudentMart</strong>
              <span>ADMIN &amp; STAFF PORTAL</span>
            </div>
          </div>
          <div className="auth-promo-copy">
            <span className="auth-promo-eyebrow">
              <ShieldCheck size={15} aria-hidden="true" /> SECURE PORTAL
            </span>
            <h2>Marketplace management, <span>all in one place.</span></h2>
            <p>
              Sign in with your approved TMC account to manage the student marketplace and staff workspace.
            </p>
          </div>
          <div className="auth-promo-bottom">
            <div className="auth-promo-note">
              <ShieldCheck size={19} aria-hidden="true" />
              <div>
                <strong>Access protected by your role</strong>
                <span>Administrators and approved staff see only the tools allowed for their account.</span>
              </div>
            </div>
            <div className="auth-promo-footer">
              <span>Trinidad Municipal College</span>
              <span>StudentMart</span>
            </div>
          </div>
        </aside>

        <section className="auth-form-panel login-card" aria-labelledby="login-heading">
          <div className="auth-form-brand">
            <img src="/assets/tmc-logo.png" alt="Trinidad Municipal College seal" />
            <span>ADMINISTRATOR &amp; STAFF ACCESS</span>
          </div>
          <div className="login-title">
            <h1 id="login-heading">Welcome back</h1>
            <p>Sign in to continue to your TMC StudentMart workspace.</p>
          </div>
          {error && <div className="login-error" role="alert">{error}</div>}
          <form className="login-form" onSubmit={handleLogin} noValidate>
            <div className="login-field">
              <label htmlFor="email">Email address</label>
              <span className="login-input-wrap">
                <Mail size={18} aria-hidden="true" />
                <input
                  id="email"
                  type="email"
                  placeholder="Enter your official email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="username"
                  disabled={loading}
                  required
                />
              </span>
            </div>
            <div className="login-field">
              <label htmlFor="password">Password</label>
              <span className="login-input-wrap">
                <LockKeyhole size={18} aria-hidden="true" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </span>
            </div>
            <div className="login-forgot-row"><Link to="/forgot-password">Forgot password?</Link></div>
            <button type="submit" className="login-button" disabled={loading}>
              {loading ? (
                <>
                  <span className="button-spinner" aria-hidden="true" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>
          <div className="login-info">
            <strong>Admin and staff access</strong>
            <p>Administrators manage the portal. Staff access is available after approval and limited to permissions assigned by an administrator.</p>
          </div>
          <p className="login-register-link">Need a staff account? <Link to="/staff/register">Register as Staff</Link></p>
          <p className="login-student-note">Student accounts are managed in the TMC StudentMart mobile application.</p>
        </section>
      </section>
    </main>
  );
}

export default Login;

