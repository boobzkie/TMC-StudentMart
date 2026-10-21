import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  CreditCard,
  FileBarChart,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareWarning,
  Moon,
  Package,
  ShieldAlert,
  Settings,
  SlidersHorizontal,
  Store,
  Sun,
  Tags,
  UserRound,
  UserRoundCog,
  Users,
  X,
  Bell,
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

function profilePhotoUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return (
    SERVER_URL.replace(/\/+$/, "") +
    "/storage/" +
    String(path).replace(/^\/+/, "")
  );
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

const adminSections = [
  { label: "OVERVIEW", items: [{ to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "MARKETPLACE",
    items: [
      { to: "/admin/products", label: "Products & Listings", icon: Package },
      { to: "/admin/categories", label: "Categories", icon: Tags },
      { to: "/admin/product-moderation", label: "Product Moderation", icon: ShieldAlert },
      { to: "/admin/sellers", label: "Sellers", icon: Store },
    ],
  },
  {
    label: "ORDERS",
    items: [
      { to: "/admin/transactions", label: "Orders", icon: CreditCard },
      { to: "/admin/order-options", label: "Payments & Pickup", icon: SlidersHorizontal },
    ],
  },
  {
    label: "USERS & ACCESS",
    items: [
      { to: "/admin/users", label: "Students", icon: UserRound },
      { to: "/admin/staff", label: "Staff", icon: UserRoundCog },
    ],
  },
  {
    label: "SUPPORT",
    items: [
      { to: "/admin/complaints", label: "Complaints", icon: MessageSquareWarning },
      { to: "/admin/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "REPORTS",
    items: [
      { to: "/admin/reports", label: "Reports", icon: FileBarChart },
      { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { to: "/admin/activity-logs", label: "Activity Logs", icon: FileText },
      { to: "/admin/settings", label: "Settings & Security", icon: Settings },
    ],
  },
];

function staffSections(permissions) {
  const sections = [
    { label: "OVERVIEW", items: [{ to: "/staff/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  ];
  if (permissions.includes("manage_students")) {
    sections.push({ label: "STUDENT ACCOUNTS", items: [{ to: "/staff/users", label: "Student Accounts", icon: Users }] });
  }
  if (permissions.includes("moderate_products")) {
    sections.push({ label: "MARKETPLACE", items: [{ to: "/staff/product-moderation", label: "Product Moderation", icon: ShieldAlert }] });
  }
  if (permissions.includes("manage_complaints")) {
    sections.push({ label: "STUDENT SUPPORT", items: [{ to: "/staff/complaints", label: "Complaints", icon: MessageSquareWarning }] });
  }
  if (permissions.includes("view_reports") || permissions.includes("view_analytics")) {
    const reportItems = [];
    if (permissions.includes("view_reports")) reportItems.push({ to: "/staff/reports", label: "Reports", icon: FileBarChart });
    if (permissions.includes("view_analytics")) reportItems.push({ to: "/staff/analytics", label: "Analytics", icon: BarChart3 });
    sections.push({ label: "REPORTS & ANALYTICS", items: reportItems });
  }
  sections.push({ label: "YOUR ACCOUNT", items: [{ to: "/staff/settings", label: "My Profile", icon: Settings }] });
  return sections;
}

const BREADCRUMB_LABELS: Record<string, string> = {
  "/admin/dashboard": "Dashboard",
  "/admin/products": "Products & Listings",
  "/admin/categories": "Categories",
  "/admin/product-moderation": "Product Moderation",
  "/admin/sellers": "Sellers",
  "/admin/transactions": "Orders",
  "/admin/order-options": "Payments & Pickup",
  "/admin/users": "Students",
  "/admin/staff": "Staff",
  "/admin/complaints": "Complaints",
  "/admin/notifications": "Notifications",
  "/admin/reports": "Reports",
  "/admin/analytics": "Analytics",
  "/admin/activity-logs": "Activity Logs",
  "/admin/settings": "Settings & Security",
  "/staff/dashboard": "Dashboard",
  "/staff/users": "Student Accounts",
  "/staff/product-moderation": "Product Moderation",
  "/staff/complaints": "Complaints",
  "/staff/reports": "Reports",
  "/staff/analytics": "Analytics",
  "/staff/settings": "My Profile",
};

function getBreadcrumbs(pathname: string) {
  const label = BREADCRUMB_LABELS[pathname];
  if (!label) return [];
  const isStaff = pathname.startsWith("/staff");
  const sectionLabel = isStaff ? "Staff Workspace" : "Admin Portal";
  return [
    { label: sectionLabel, to: isStaff ? "/staff/dashboard" : "/admin/dashboard" },
    { label },
  ];
}

export default function AdminLayout({
  children,
  title = "Dashboard",
  subtitle = "TMC StudentMart Administration",
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("portal-sidebar-collapsed-v2") === "true";
    } catch {
      return false;
    }
  });

  const [storedUser, setStoredUser] = useState(readStoredUser);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const profileMenuRef = useRef(null);
  const [liquidRect, setLiquidRect] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const navRef = useRef(null);
  const presenceStoppedRef = useRef(false);
  const { theme, toggleTheme } = usePortalTheme();
  const role = String(storedUser.role || localStorage.getItem("role") || "").toLowerCase();
  const isStaff = role === "staff";
  const permissions = Array.isArray(storedUser.staff_permissions) ? storedUser.staff_permissions : [];

  useEffect(() => {
    try {
      localStorage.setItem("portal-sidebar-collapsed-v2", String(sidebarCollapsed));
    } catch {
      // Ignore storage quota or browser privacy restrictions.
    }
  }, [sidebarCollapsed]);

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

  // Liquid navigation indicator: measure the active nav link and position the soft capsule behind it.
  useEffect(() => {
    const updateLiquid = () => {
      if (!navRef.current) return;
      const activeLink = navRef.current.querySelector(".admin-nav-link.active");
      if (!activeLink) return;
      const linkRect = activeLink.getBoundingClientRect();
      const navRect = navRef.current.getBoundingClientRect();
      setLiquidRect({
        top: linkRect.top - navRect.top,
        left: linkRect.left - navRect.left,
        width: linkRect.width,
        height: linkRect.height,
      });
    };

    updateLiquid();
    const raf = requestAnimationFrame(updateLiquid);
    return () => cancelAnimationFrame(raf);
  }, [location.pathname, sidebarCollapsed]);

  const settingsPath = isStaff ? "/staff/settings" : "/admin/settings";
  const dashboardPath = isStaff ? "/staff/dashboard" : "/admin/dashboard";
  const displayName = storedUser.name || (isStaff ? "Staff Member" : "Administrator");
  const displayRole = isStaff ? "Staff account" : "Administrator";

  const avatarUrl = profilePhotoUrl(storedUser.profile_picture);
  const initials = userInitials(displayName);

  const breadcrumbs = getBreadcrumbs(location.pathname);
  const roleBadge = role.charAt(0).toUpperCase() + role.slice(1);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      if (localStorage.getItem("token")) {
        await fetch(`${API_URL}/logout`, { method: "POST", headers: getAuthHeaders() });
      }
    } catch (error) {
      console.error("Portal logout request failed:", error);
    } finally {
      clearAuth();
      navigate("/login", { replace: true });
      setLoggingOut(false);
    }
  }

  const closeMobile = useCallback(() => {
    setMobileOpen(false);
  }, []);

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

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") closeMobile();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen, closeMobile]);

  const sections = isStaff ? staffSections(permissions) : adminSections;

  const liquidStyle = {
    top: liquidRect.top,
    left: liquidRect.left,
    width: liquidRect.width,
    height: liquidRect.height,
    opacity: liquidRect.width > 0 && liquidRect.height > 0 ? 1 : 0,
  };

  const renderLink = (item) => {
    const Icon = item.icon;
    // Exact destination matching: only one link may be active at a time.
    // Use the raw pathname (query strings are ignored by NavLink) so
    // /admin/users and /admin/users?role=admin do not both highlight.
    const isCurrentDashboard =
      item.to === dashboardPath && (location.pathname === dashboardPath || location.pathname === (isStaff ? "/staff" : "/admin"));
    const isActive = location.pathname === item.to || isCurrentDashboard;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end
        title={item.label}
        aria-label={item.label}
        aria-current={isActive ? "page" : undefined}
        onClick={closeMobile}
        className={() => "admin-nav-link" + (isActive ? " active" : "")}
        data-tooltip={sidebarCollapsed ? item.label : undefined}
      >
        <Icon size={19} aria-hidden="true" />
        <span>{item.label}</span>
      </NavLink>
    );
  };

  return (
    <div
      className="admin-layout"
      data-theme={theme}
      data-role={isStaff ? "staff" : "admin"}
      data-sidebar-collapsed={sidebarCollapsed ? "true" : "false"}
      data-mobile-open={mobileOpen ? "true" : "false"}
    >
      {mobileOpen && (
        <button
          type="button"
          className="admin-mobile-overlay"
          aria-label="Close navigation"
          onClick={closeMobile}
        />
      )}
      <aside className="admin-sidebar" aria-label="Main navigation">
      <div className="admin-sidebar-header">
        <div className="admin-sidebar-header">
          <Link to={dashboardPath} className="admin-brand" onClick={closeMobile}>
            <img className="admin-brand-logo" src="/assets/tmc-logo.png" alt="TMC seal" />
            <span className="admin-brand-text">
              <strong>TMC StudentMart</strong>
              <span>{isStaff ? "STAFF WORKSPACE" : "ADMIN PORTAL"}</span>
            </span>
          </Link>
          <button
            type="button"
            className="admin-sidebar-collapse-toggle"
            onClick={() => setSidebarCollapsed((open) => !open)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!sidebarCollapsed}
            aria-controls="admin-navigation"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <ChevronsRight size={16} aria-hidden="true" /> : <ChevronsLeft size={16} aria-hidden="true" />}
          </button>
          <button type="button" className="admin-mobile-close" onClick={closeMobile} aria-label="Close navigation">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="admin-sidebar-profile">
          <div className="admin-sidebar-avatar">
            {initials}
            {avatarUrl && (
              <img src={avatarUrl} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />
            )}
          </div>
          <div className="admin-sidebar-profile-info">
            <strong>{displayName}</strong>
            <span>{displayRole}</span>
          </div>
        </div>

        <nav className="admin-navigation" id="admin-navigation" ref={navRef} aria-label="Main navigation">
          <div className="admin-nav-liquid" style={liquidStyle} aria-hidden="true" />
          {sections.map((section) => (
            <div key={section.label} className="admin-nav-section">
              <span className="admin-nav-label">{section.label}</span>
              {section.items.map(renderLink)}
            </div>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <button
            type="button"
            className="admin-logout-button"
            title="Sign out"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <LogOut size={18} aria-hidden="true" />
            <span>{loggingOut ? "Signing out\u2026" : "Sign Out"}</span>
          </button>
        </div>
      </aside>


      <div className="admin-main">
        <header className="admin-header">
          <div className="admin-header-left">
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
              <span className="admin-page-eyebrow">
                {isStaff ? "TMC StudentMart \u00b7 Staff workspace" : "TMC StudentMart \u00b7 Admin portal"}
              </span>
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
                  {initials}
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
                  <Link role="menuitem" to={settingsPath} onClick={() => setProfileMenuOpen(false)}>
                    <Settings size={16} aria-hidden="true" /> Account settings
                  </Link>
                  <button role="menuitem" type="button" onClick={handleLogout} disabled={loggingOut}>
                    <LogOut size={16} aria-hidden="true" />
                    {loggingOut ? "Signing out\u2026" : "Sign out"}
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


