import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  ChevronDown,
  ChevronLeft,
  CreditCard,
  ChevronRight,
  FileClock,
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

function readSidebarCollapsed() {
  try {
    return localStorage.getItem("portal-sidebar-collapsed-v2") === "true";
  } catch {
    return false;
  }
}


const marketplaceLinks = [
  { to: "/admin/products", label: "Product Management", icon: Package },
  { to: "/admin/categories", label: "Product Categories", icon: Tags },
  { to: "/admin/product-moderation", label: "Product Moderation", icon: ShieldAlert },
  { to: "/admin/sellers", label: "Sellers", icon: Store },
  { to: "/admin/transactions", label: "Order Management", icon: CreditCard },
  { to: "/admin/order-options", label: "Payment & pickup setup", icon: SlidersHorizontal },
];

const insightLinks = [
  { to: "/admin/reports", label: "Marketplace Insights", icon: BarChart3 },
  { to: "/admin/activity-logs", label: "Activity Logs", icon: FileClock },
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
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const [storedUser, setStoredUser] = useState(readStoredUser);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const profileMenuRef = useRef(null);
  const presenceStoppedRef = useRef(false);
  const { theme, toggleTheme } = usePortalTheme();
  const role = String(storedUser.role || localStorage.getItem("role") || "").toLowerCase();
  const isStaff = role === "staff";

  useEffect(() => {
    let active = true;
    let requestInFlight = false;
    const refreshUnreadCount = async () => {
      if (requestInFlight || !localStorage.getItem("token")) return;
      requestInFlight = true;
      try {
        const response = await fetch(`${API_URL}/notifications`, { headers: getAuthHeaders() });
        if (!response.ok) return;
        const data = await response.json();
        if (active) {
          const count = Number(data.unread_count);
          setUnreadNotificationCount(Number.isFinite(count) ? Math.max(0, count) : 0);
        }
      } catch {
        // A notification count refresh should never interrupt navigation.
      } finally {
        requestInFlight = false;
      }
    };
    const refreshOnVisibility = () => {
      if (document.visibilityState === "visible") void refreshUnreadCount();
    };
    void refreshUnreadCount();
    const interval = window.setInterval(refreshUnreadCount, 60_000);
    window.addEventListener("focus", refreshUnreadCount);
    window.addEventListener("tmc-notifications-updated", refreshUnreadCount);
    document.addEventListener("visibilitychange", refreshOnVisibility);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshUnreadCount);
      window.removeEventListener("tmc-notifications-updated", refreshUnreadCount);
      document.removeEventListener("visibilitychange", refreshOnVisibility);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("portal-sidebar-collapsed-v2", String(sidebarCollapsed));
    } catch {
      // The sidebar remains usable for this session if storage is unavailable.
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

  const marketplaceItems = isStaff
    ? (staffCanModerateProducts
        ? [{ to: "/staff/product-moderation", label: "Product Moderation", icon: ShieldAlert }]
        : [])
    : marketplaceLinks;
  const insightItems = isStaff
    ? [
        ...(staffCanViewReports ? [{ to: "/staff/reports", label: "Reports", icon: FileBarChart }] : []),
        ...(staffCanViewAnalytics ? [{ to: "/staff/analytics", label: "Analytics", icon: BarChart3 }] : []),
      ]
    : insightLinks;
  const accountItems = isStaff
    ? (staffCanManageStudents
        ? [{ to: "/staff/users", label: "Student Accounts", icon: Users }]
        : [])
    : [
        { to: "/admin/users", label: "User Management", icon: Users },
        { to: "/admin/staff", label: "Staff Management", icon: UserRoundCog },
      ];

  const navSections = [
    {
      id: "dashboard",
      label: "Dashboard",
      heading: "OVERVIEW",
      icon: LayoutDashboard,
      items: [{
        to: dashboardPath,
        matchPaths: [isStaff ? "/staff" : "/admin"],
        label: "Dashboard",
        icon: LayoutDashboard,
      }],
    },
    ...(marketplaceItems.length
      ? [{ id: "marketplace", label: "Marketplace", heading: "MARKETPLACE", icon: Store, items: marketplaceItems }]
      : []),
    ...(insightItems.length
      ? [{ id: "insights", label: isStaff ? "Insights & Oversight" : "Marketplace Insights", heading: "INSIGHTS & OVERSIGHT", icon: BarChart3, items: insightItems }]
      : []),
    ...(isStaff && staffCanManageComplaints
      ? [{
          id: "support",
          label: "Complaints Management",
          heading: "COMPLAINTS MANAGEMENT",
          icon: MessageSquareWarning,
          items: [{ to: "/staff/complaints", label: "Complaints", icon: MessageSquareWarning }],
        }]
      : []),
    ...(accountItems.length
      ? [{ id: "accounts", label: isStaff ? "Student Accounts" : "Account Management", heading: isStaff ? "STUDENT ACCOUNTS" : "ACCOUNT MANAGEMENT", icon: UserRoundCog, items: accountItems }]
      : []),
    {
      id: "settings",
      label: isStaff ? "My Profile" : "Settings",
      heading: isStaff ? "MY PROFILE" : "SETTINGS",
      icon: Settings,
      items: [{ to: settingsPath, label: "My Profile", icon: Settings }],
    },
  ];
  const routeMatchesItem = (item) => (
    location.pathname === item.to ||
    item.matchPaths?.includes(location.pathname) ||
    location.pathname.startsWith(`${item.to}/`)
  );
  const notificationItem = {
    to: isStaff ? "/staff/notifications" : "/admin/notifications",
    label: "Notifications",
    icon: Bell,
  };
  const directNavigationItems = navSections.flatMap((section) => section.items);
  const routeSection = navSections.find((section) => section.items.some(routeMatchesItem));
  const [sectionSelection, setSectionSelection] = useState(null);
  const selectedSection = navSections.find((section) => (
    section.id === sectionSelection?.id && sectionSelection.locationKey === location.key
  ))
    || routeSection
    || (routeMatchesItem(notificationItem) ? null : navSections[0]);

  useEffect(() => {
    const clearManualSectionOnHistoryNavigation = () => setSectionSelection(null);
    window.addEventListener("popstate", clearManualSectionOnHistoryNavigation);
    return () => window.removeEventListener("popstate", clearManualSectionOnHistoryNavigation);
  }, []);

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
    const isActive = routeMatchesItem(item);
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end
        onClick={() => {
          setSectionSelection(null);
          closeMobile();
        }}
        title={item.label}
        aria-label={item.label}
        aria-current={isActive ? "page" : undefined}
        className={"admin-nav-link" + (isActive ? " active" : "")}
      >
        <Icon size={19} aria-hidden="true" />
        <span>{item.label}</span>
      </NavLink>
    );
  };

  const renderRailLink = (item) => {
    const Icon = item.icon;
    const isActive = routeMatchesItem(item);

    return (
      <NavLink
        key={item.to}
        to={item.to}
        end
        onClick={() => {
          setSectionSelection(null);
          closeMobile();
        }}
        className={`admin-rail-link admin-rail-route${isActive ? " active" : ""}`}
        title={item.label}
        aria-label={item.label}
        aria-current={isActive ? "page" : undefined}
      >
        <Icon size={20} aria-hidden="true" />
      </NavLink>
    );
  };

  return (
    <div
      className="admin-layout"
      data-theme={theme}
      data-role={isStaff ? "staff" : "admin"}
      data-sidebar-collapsed={sidebarCollapsed ? "true" : "false"}
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
        <nav className="admin-icon-navigation" aria-label={sidebarCollapsed ? "Quick links" : "Navigation sections"}>
          {sidebarCollapsed
            ? directNavigationItems.map(renderRailLink)
            : navSections.map((section) => {
            const Icon = section.icon;
            const isSelected = selectedSection?.id === section.id;
            return (
              <button
                key={section.id}
                type="button"
                className={"admin-rail-link" + (isSelected ? " active" : "")}
                title={section.label}
                aria-label={section.label}
                aria-pressed={isSelected}
                onClick={() => setSectionSelection({ locationKey: location.key, id: section.id })}
              >
                <Icon size={20} aria-hidden="true" />
              </button>
            );
          })}
        </nav>
        <div className="admin-rail-footer">
          <button
            type="button"
            className="admin-rail-link admin-rail-toggle"
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!sidebarCollapsed}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed
              ? <ChevronRight size={19} aria-hidden="true" />
              : <ChevronLeft size={19} aria-hidden="true" />}
          </button>
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

        <nav className="admin-mobile-sections" aria-label="Navigation sections">
          {navSections.map((section) => {
            const Icon = section.icon;
            const isSelected = selectedSection?.id === section.id;
            return (
              <button
                key={section.id}
                type="button"
                className={"admin-mobile-section-button" + (isSelected ? " active" : "")}
                aria-pressed={isSelected}
                onClick={() => setSectionSelection({ locationKey: location.key, id: section.id })}
              >
                <Icon size={15} aria-hidden="true" />
                <span>{section.label}</span>
              </button>
            );
          })}
        </nav>

        <nav className="admin-navigation" id="admin-navigation" aria-label="Main navigation">
          {selectedSection && (
            <div className="admin-nav-section">
              <span className="admin-nav-label">{selectedSection.heading}</span>
              {selectedSection.items.map(renderLink)}
            </div>
          )}
        </nav>
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
            <div className="admin-page-heading">
              <nav className="admin-breadcrumbs" aria-label="Breadcrumb">
                <Link to={dashboardPath}>{isStaff ? "Staff workspace" : "TMC StudentMart"}</Link>
                <ChevronRight size={13} aria-hidden="true" />
                <span aria-current="page">{title}</span>
              </nav>
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

            <NavLink
              to={notificationItem.to}
              end
              className="admin-header-notifications"
              aria-label={unreadNotificationCount > 0 ? `Notifications, ${unreadNotificationCount} unread` : "Notifications"}
              title={unreadNotificationCount > 0 ? `Notifications, ${unreadNotificationCount} unread` : "Notifications"}
              aria-current={routeMatchesItem(notificationItem) ? "page" : undefined}
            >
              <Bell size={18} aria-hidden="true" />
              {unreadNotificationCount > 0 && (
                <span className="admin-notification-badge" aria-hidden="true">
                  {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                </span>
              )}
            </NavLink>

            <div className="admin-profile-control" ref={profileMenuRef}>
              <button
                type="button"
                className="admin-account"
                aria-label={`${displayName} account menu`}
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
