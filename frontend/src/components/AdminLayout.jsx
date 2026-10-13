import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Calculator,
  ChevronDown,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareWarning,
  Moon,
  Package,
  ShieldAlert,
  Store,
  Settings,
  Sun,
  Tags,
  SlidersHorizontal,
  UserRoundCog,
  Users,
  X,
} from "lucide-react";
import { API_URL, SERVER_URL, getAuthHeaders } from "../utils/api";
import { clearAuth } from "../utils/auth";
import usePortalTheme from "../utils/usePortalTheme";
import "./AdminLayout.css";

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
}

const marketplaceLinks = [
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/categories", label: "Categories", icon: Tags },
  { to: "/admin/product-moderation", label: "Product Moderation", icon: ShieldAlert },
  { to: "/admin/sellers", label: "Sellers", icon: Store },
  { to: "/admin/transactions", label: "Transactions", icon: CreditCard },
  { to: "/admin/order-options", label: "Payment & pickup setup", icon: SlidersHorizontal },
  { to: "/admin/commission", label: "Commission", icon: Calculator },
];

const insightLinks = [
  { to: "/admin/reports", label: "Reports", icon: FileBarChart },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/complaints", label: "Complaints", icon: MessageSquareWarning },
];

function profilePhotoUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${SERVER_URL.replace(/\/+$/, "")}/storage/${String(path).replace(/^\/+/, "")}`;
}

function userInitials(name) {
  return String(name || "TMC")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function AdminLayout({
  children,
  title = "Dashboard",
  subtitle = "TMC StudentMart Administration",
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [storedUser, setStoredUser] = useState(readStoredUser);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const profileMenuRef = useRef(null);
  const presenceStoppedRef = useRef(false);
  const { theme, toggleTheme } = usePortalTheme();
  const role = String(storedUser.role || localStorage.getItem("role") || "").toLowerCase();
  const isStaff = role === "staff";
  useEffect(() => {
    const syncStoredUser = () => setStoredUser(readStoredUser());
    window.addEventListener("tmc-user-updated", syncStoredUser);
    return () => window.removeEventListener("tmc-user-updated", syncStoredUser);
  }, []);

  useEffect(() => {
    if (!isStaff) return undefined;

    let disposed = false;
    let requestInFlight = false;
    let lastActivityAt = Date.now();
    const idleWindowMs = 4 * 60 * 1000;
    presenceStoppedRef.current = false;

    const sendHeartbeat = async () => {
      if (
        disposed ||
        presenceStoppedRef.current ||
        requestInFlight ||
        document.visibilityState !== "visible" ||
        Date.now() - lastActivityAt > idleWindowMs ||
        !localStorage.getItem("token")
      ) {
        return;
      }

      requestInFlight = true;
      try {
        const response = await fetch(`${API_URL}/staff/presence`, {
          method: "POST",
          headers: getAuthHeaders(),
          keepalive: true,
        });
        if ((response.status === 401 || response.status === 403) && !disposed) {
          presenceStoppedRef.current = true;
          clearAuth();
          navigate("/login", { replace: true });
        }
      } catch {
        // A temporary network issue should not sign the Staff member out.
      } finally {
        requestInFlight = false;
      }
    };

    const interval = window.setInterval(() => {
      void sendHeartbeat();
    }, 120_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        lastActivityAt = Date.now();
        void sendHeartbeat();
      }
    };
    const onUserActivity = () => {
      const wasIdle = Date.now() - lastActivityAt > idleWindowMs;
      lastActivityAt = Date.now();
      if (wasIdle) void sendHeartbeat();
    };
    const activityEvents = ["pointerdown", "pointermove", "keydown", "touchstart", "scroll"];

    document.addEventListener("visibilitychange", onVisibilityChange);
    activityEvents.forEach((eventName) => window.addEventListener(eventName, onUserActivity, { passive: true }));
    void sendHeartbeat();

    return () => {
      disposed = true;
      presenceStoppedRef.current = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, onUserActivity));
    };
  }, [isStaff, navigate]);
  const staffCanManageStudents =
    Array.isArray(storedUser.staff_permissions) &&
    storedUser.staff_permissions.includes("manage_students");
  const staffCanModerateProducts =
    Array.isArray(storedUser.staff_permissions) &&
    storedUser.staff_permissions.includes("moderate_products");
  const staffCanManageComplaints = Array.isArray(storedUser.staff_permissions) && storedUser.staff_permissions.includes("manage_complaints");
  const staffCanViewReports = Array.isArray(storedUser.staff_permissions) && storedUser.staff_permissions.includes("view_reports");
  const staffCanViewAnalytics = Array.isArray(storedUser.staff_permissions) && storedUser.staff_permissions.includes("view_analytics");
  const settingsPath = isStaff ? "/staff/settings" : "/admin/settings";
  const dashboardPath = isStaff ? "/staff/dashboard" : "/admin/dashboard";
  const displayName = storedUser.name || (isStaff ? "Staff Member" : "Administrator");
  const displayRole = isStaff ? "Staff account" : "Administrator";
  const avatarUrl = profilePhotoUrl(storedUser.profile_picture);
  const initials = userInitials(displayName);

  const closeMobile = () => setMobileOpen(false);
  const handleLogout = async () => {
    if (loggingOut) return;
    presenceStoppedRef.current = true;
    setLoggingOut(true);
    closeMobile();
    setProfileMenuOpen(false);
    try {
      if (localStorage.getItem("token")) {
        await fetch(`${API_URL}/logout`, {
          method: "POST",
          headers: getAuthHeaders(),
        });
      }
    } catch (error) {
      console.error("Portal logout request failed:", error);
    } finally {
      clearAuth();
      navigate("/login", { replace: true });
      setLoggingOut(false);
    }
  };

  useEffect(() => {
    if (!profileMenuOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) setProfileMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setProfileMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [profileMenuOpen]);

  const renderLink = (item) => {
    const Icon = item.icon;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        onClick={closeMobile}
        title={item.label}
        className={({ isActive }) => {
          const isCurrentDashboard = item.to === dashboardPath &&
            location.pathname === (isStaff ? "/staff" : "/admin");
          return "admin-nav-link" + (isActive || isCurrentDashboard ? " active" : "");
        }}
      >
        <Icon size={19} aria-hidden="true" />
        <span>{item.label}</span>
      </NavLink>
    );
  };

  const railLinks = isStaff
    ? [
        { to: dashboardPath, label: "Dashboard", icon: LayoutDashboard },
        ...(staffCanManageStudents ? [{ to: "/staff/users", label: "Manage students", icon: Users }] : []),
        ...(staffCanModerateProducts ? [{ to: "/staff/product-moderation", label: "Product moderation", icon: ShieldAlert }] : []),
        ...(staffCanManageComplaints ? [{ to: "/staff/complaints", label: "Complaints", icon: MessageSquareWarning }] : []),
        ...(staffCanViewReports ? [{ to: "/staff/reports", label: "Reports", icon: FileBarChart }] : []),
        ...(staffCanViewAnalytics ? [{ to: "/staff/analytics", label: "Analytics", icon: BarChart3 }] : []),
      ]
    : [
        { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/admin/products", label: "Products", icon: Package },
        { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
        { to: "/admin/users", label: "Users", icon: Users },
      ];

  return (
    <div
      className="admin-layout"
      data-theme={theme}
      data-sidebar-collapsed={sidebarCollapsed}
      data-role={isStaff ? "staff" : "admin"}
    >
      {mobileOpen && (
        <button
          type="button"
          className="admin-mobile-overlay"
          aria-label="Close navigation"
          onClick={closeMobile}
        />
      )}

      <aside className="admin-icon-rail" aria-label="Quick navigation">
        <Link
          to={dashboardPath}
          className="admin-rail-brand"
          onClick={closeMobile}
          title="TMC StudentMart dashboard"
          aria-label="TMC StudentMart dashboard"
        >
          <img src="/assets/tmc-logo.png" alt="" />
        </Link>
        <nav className="admin-icon-navigation" aria-label="Quick links">
          {railLinks.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={item.label}
                aria-label={item.label}
                onClick={closeMobile}
                className={({ isActive }) => {
                  const isCurrentDashboard = item.to === dashboardPath &&
                    location.pathname === (isStaff ? "/staff" : "/admin");
                  return "admin-rail-link" + (isActive || isCurrentDashboard ? " active" : "");
                }}
              >
                <Icon size={20} aria-hidden="true" />
              </NavLink>
            );
          })}
        </nav>
        <div className="admin-rail-footer">
          <Link
            to={settingsPath}
            className="admin-rail-link"
            title="Account settings"
            aria-label="Account settings"
            onClick={closeMobile}
          >
            <Settings size={19} aria-hidden="true" />
          </Link>
        </div>
      </aside>

      <aside className={"admin-sidebar" + (mobileOpen ? " mobile-open" : "")}>
        <div className="admin-sidebar-header">
          <Link to={dashboardPath} className="admin-brand" onClick={closeMobile}>
            <img
              className="admin-brand-logo"
              src="/assets/tmc-logo.png"
              alt="Trinidad Municipal College seal"
            />
            <span className="admin-brand-text">
              <strong>TMC StudentMart</strong>
              <span>{isStaff ? "STAFF WORKSPACE" : "ADMIN PORTAL"}</span>
            </span>
          </Link>
          <button
            type="button"
            className="admin-mobile-close"
            onClick={closeMobile}
            aria-label="Close navigation"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="admin-sidebar-profile">
          <div className="admin-sidebar-avatar">
            <span>{initials}</span>
            {avatarUrl && (
              <img
                src={avatarUrl}
                alt=""
                onError={(event) => { event.currentTarget.style.display = "none"; }}
              />
            )}
          </div>
          <div className="admin-sidebar-profile-info">
            <strong>{displayName}</strong>
            <span>{displayRole}</span>
          </div>
        </div>

        <nav className="admin-navigation" id="admin-navigation" aria-label="Main navigation">
          <div className="admin-nav-section">
            <span className="admin-nav-label">OVERVIEW</span>
            {renderLink({ to: dashboardPath, label: "Dashboard", icon: LayoutDashboard })}
          </div>

          {isStaff ? (
            <>
              {staffCanManageStudents && (
                <div className="admin-nav-section">
                  <span className="admin-nav-label">STUDENT ACCOUNTS</span>
                  {renderLink({ to: "/staff/users", label: "Manage Students", icon: Users })}
                </div>
              )}
              {staffCanModerateProducts && (
                <div className="admin-nav-section">
                  <span className="admin-nav-label">MARKETPLACE</span>
                  {renderLink({ to: "/staff/product-moderation", label: "Product Moderation", icon: ShieldAlert })}
                </div>
              )}
              {staffCanManageComplaints && (
                <div className="admin-nav-section">
                  <span className="admin-nav-label">STUDENT SUPPORT</span>
                  {renderLink({ to: "/staff/complaints", label: "Complaints", icon: MessageSquareWarning })}
                </div>
              )}
              {(staffCanViewReports || staffCanViewAnalytics) && (
                <div className="admin-nav-section">
                  <span className="admin-nav-label">INSIGHTS</span>
                  {staffCanViewReports && renderLink({ to: "/staff/reports", label: "Reports", icon: FileBarChart })}
                  {staffCanViewAnalytics && renderLink({ to: "/staff/analytics", label: "Analytics", icon: BarChart3 })}
                </div>
              )}
              <div className="admin-nav-section">
                <span className="admin-nav-label">YOUR ACCOUNT</span>
                {renderLink({ to: settingsPath, label: "Account Settings", icon: Settings })}
              </div>
            </>
          ) : (
            <>
              <div className="admin-nav-section">
                <span className="admin-nav-label">MARKETPLACE</span>
                {marketplaceLinks.map(renderLink)}
              </div>
              <div className="admin-nav-section">
                <span className="admin-nav-label">REPORTS &amp; SUPPORT</span>
                {insightLinks.map(renderLink)}</div>
              <div className="admin-nav-section">
                <span className="admin-nav-label">ACCOUNT MANAGEMENT</span>
                {renderLink({ to: "/admin/users", label: "Users", icon: Users })}
                {renderLink({ to: "/admin/staff", label: "Manage Staff", icon: UserRoundCog })}
                {renderLink({ to: settingsPath, label: "Account Settings", icon: Settings })}
              </div>
            </>
          )}
        </nav>

        <div className="admin-sidebar-footer">
          <button
            type="button"
            className="admin-logout-button"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <LogOut size={18} aria-hidden="true" />
            <span>{loggingOut ? "Signing out…" : "Logout"}</span>
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-header">
          <div className="admin-header-left">
            <button
              type="button"
              className="admin-sidebar-collapse"
              onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
              aria-label={sidebarCollapsed ? "Expand navigation panel" : "Collapse navigation panel"}
              aria-expanded={!sidebarCollapsed}
              title={sidebarCollapsed ? "Expand navigation panel" : "Collapse navigation panel"}
            >
              {sidebarCollapsed ? (
                <ChevronRight size={19} aria-hidden="true" />
              ) : (
                <ChevronLeft size={19} aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              className="admin-mobile-menu"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              aria-controls="admin-navigation"
              aria-expanded={mobileOpen}
            >
              <Menu size={21} aria-hidden="true" />
            </button>
            <img className="admin-header-logo" src="/assets/tmc-logo.png" alt="" aria-hidden="true" />
            <div className="admin-page-heading">
              <nav className="admin-breadcrumbs" aria-label="Breadcrumb">
                <Link to={dashboardPath}>{isStaff ? "Staff workspace" : "TMC StudentMart"}</Link>
                <ChevronRight size={13} aria-hidden="true" />
                <span aria-current="page">{title}</span>
              </nav>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
          </div>

          <div className="admin-header-actions">
            <button
              type="button"
              className="admin-theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
              aria-pressed={theme === "dark"}
              title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
            >
              {theme === "light" ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
              <span>{theme === "light" ? "Dark" : "Light"}</span>
            </button>

            <div className="admin-profile-control" ref={profileMenuRef}>
              <button
                type="button"
                className="admin-account"
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                aria-controls="admin-profile-menu"
                onClick={() => setProfileMenuOpen((open) => !open)}
              >
                <span className="admin-account-avatar">
                  <span>{initials}</span>
                  {avatarUrl && (
                    <img
                      src={avatarUrl}
                      alt=""
                      onError={(event) => { event.currentTarget.style.display = "none"; }}
                    />
                  )}
                </span>
                <span className="admin-account-info">
                  <strong>{displayName}</strong>
                  <span>{displayRole}</span>
                </span>
                <ChevronDown size={15} aria-hidden="true" />
              </button>
              {profileMenuOpen && (
                <div className="admin-profile-menu" id="admin-profile-menu" role="menu">
                  <div className="admin-profile-menu-heading">
                    <strong>{displayName}</strong>
                    <span>{storedUser.email || displayRole}</span>
                  </div>
                  <Link
                    role="menuitem"
                    to={settingsPath}
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    <Settings size={16} aria-hidden="true" />
                    Account settings
                  </Link>
                  <button
                    role="menuitem"
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                  >
                    <LogOut size={16} aria-hidden="true" />
                    {loggingOut ? "Signing out…" : "Sign out"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}
