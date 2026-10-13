import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import {
  Users,
  UserRound,
  ShieldCheck,
  Package,
  Clock3,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RefreshCw,
  Activity,
  ListChecks,
  TrendingUp,
  UserPlus,
  Bell,
} from "lucide-react";

import AdminLayout from "./components/AdminLayout";
import { API_URL } from "./utils/api";

import "./AdminDashboard.css";

const COURSE_OPTIONS = [["BSIT", "Bachelor of Science in Information Technology"], ["BSOA", "Bachelor of Science in Office Administration"], ["BSCRIM", "Bachelor of Science in Criminology"], ["BSED", "Bachelor of Secondary Education"], ["CAS", "College of Arts and Sciences"]];

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  title,
  value,
  icon: Icon,
  type,
  description,
}) {
  return (
    <div className={`dashboard-stat-card stat-${type}`}>
      <div className="stat-card-header">
        <div className={`stat-icon ${type}`}>
          <Icon
            size={21}
            strokeWidth={2.2}
          />
        </div>

        <ArrowRight
          className="stat-arrow"
          size={17}
        />
      </div>

      <div className="stat-card-value">
        {value}
      </div>

      <div className="stat-card-title">
        {title}
      </div>

      <div className="stat-card-description">
        {description}
      </div>
    </div>
  );
}

/* =========================================================
   SECONDARY STAT
========================================================= */

function SecondaryStat({
  icon: Icon,
  title,
  value,
  description,
  type,
}) {
  return (
    <div className="secondary-stat">
      <div className={`secondary-icon ${type}`}>
        <Icon size={19} />
      </div>

      <div className="secondary-content">
        <span>{title}</span>

        <strong>{value}</strong>

        <small>{description}</small>
      </div>
    </div>
  );
}

/* =========================================================
   SKELETON
========================================================= */

function DashboardSkeleton() {
  return (
    <>
      {[1, 2, 3, 4, 5, 6, 7].map((item) => (
        <div
          className="dashboard-stat-skeleton"
          key={item}
        >
          <div className="skeleton-icon" />

          <div className="skeleton-number" />

          <div className="skeleton-line" />

          <div className="skeleton-small" />
        </div>
      ))}
    </>
  );
}

/* =========================================================
   MAIN DASHBOARD
========================================================= */

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    total_users: 0,
    total_students: 0,
    total_admins: 0,
    total_staff: 0,
    total_products: 0,
    pending_products: 0,
    approved_products: 0,
    active_products: 0,
    rejected_products: 0,
    inactive_products: 0,
    course_stats: {},
  });

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  /* =========================================================
     LOAD DASHBOARD DATA
  ========================================================= */

  const loadStats = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const token = localStorage.getItem("token");

        if (!token) {
          navigate("/login", {
            replace: true,
          });

          return;
        }

        const response = await fetch(
          `${API_URL}/admin/stats`,
          {
            method: "GET",

            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        /* -------------------------------------------------------
           AUTH ERROR
        ------------------------------------------------------- */

        if (
          response.status === 401 ||
          response.status === 403
        ) {
          localStorage.removeItem("token");
          localStorage.removeItem("role");
          localStorage.removeItem("user");

          navigate("/login", {
            replace: true,
          });

          return;
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Unable to load dashboard."
          );
        }

        const incoming =
          data.stats || data;

        setStats({
          total_users:
            incoming.total_users || 0,

          total_students:
            incoming.total_students || 0,

          total_admins:
            incoming.total_admins || 0,
          total_staff: incoming.total_staff || 0,

          total_products:
            incoming.total_products || 0,

          pending_products:
            incoming.pending_products || 0,

          approved_products:
            incoming.approved_products ??
            incoming.active_products ??
            0,

          active_products:
            incoming.active_products ??
            incoming.approved_products ??
            0,

          rejected_products:
            incoming.rejected_products || 0,

          inactive_products:
            incoming.inactive_products || 0,
          course_stats: incoming.course_stats || {},
        });
      } catch (err) {
        console.error(
          "Dashboard error:",
          err
        );

        setError(
          "We couldn't load the dashboard. Please try again."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [navigate]
  );

  /* =========================================================
     INITIAL LOAD
  ========================================================= */

  useEffect(() => {
    const timer = setTimeout(() => {
      loadStats();
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [loadStats]);

  /* =========================================================
     CALCULATED VALUES
  ========================================================= */

  const reviewedProducts =
    stats.active_products +
    stats.rejected_products;

  const approvalRate =
    reviewedProducts > 0
      ? Math.round(
          (stats.active_products /
            reviewedProducts) *
            100
        )
      : 0;

  const courseMetrics = COURSE_OPTIONS.map(([code, title]) => ({
    code,
    title,
    count: Number(stats.course_stats?.[code] || 0),
  }));
  const courseMaximum = Math.max(1, ...courseMetrics.map((item) => item.count));

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <AdminLayout
      title="Dashboard"
      subtitle="Overview of your TMC StudentMart marketplace."
    >
      <div className="dashboard-page">

        {/* ===================================================
            HERO
        =================================================== */}

        <section className="dashboard-hero">

          <div className="hero-pattern hero-pattern-one" />

          <div className="hero-pattern hero-pattern-two" />

          <div className="hero-content">

            <div className="hero-icon">
              <Activity
                size={25}
                strokeWidth={2}
              />
            </div>

            <div className="hero-text">

              <span>
                ADMINISTRATOR OVERVIEW
              </span>

              <h2>
                Welcome back, Administrator
              </h2>

              <p>
                Monitor users, marketplace
                products, and pending
                approvals from one place.
              </p>

            </div>

          </div>

          {/* =================================================
              DASHBOARD REFRESH BUTTON

              IMPORTANT:
              This uses a unique class name so the global
              .hero-refresh CSS cannot override it.
          ================================================= */}

          <button
            type="button"
            className="dashboard-hero-refresh"
            onClick={() => {
              if (!refreshing) {
                loadStats(true);
              }
            }}
            disabled={refreshing}
          >
            <RefreshCw
              size={16}
              className={
                refreshing
                  ? "dashboard-refresh-spin"
                  : ""
              }
            />

            {refreshing
              ? "Refreshing..."
              : "Refresh Data"}
          </button>

        </section>

        {/* ===================================================
            ERROR
        =================================================== */}

        {error && (
          <div className="dashboard-error">

            <div className="error-content">

              <XCircle size={20} />

              <div>

                <strong>
                  Something went wrong
                </strong>

                <span>
                  {error}
                </span>

              </div>

            </div>

            <button
              type="button"
              onClick={() =>
                loadStats(true)
              }
            >
              Try Again
            </button>

          </div>
        )}

        {/* ===================================================
            SECTION TITLE
        =================================================== */}

        <div className="dashboard-section-heading">

          <div>

            <span>
              OVERVIEW
            </span>

            <h2>
              Marketplace Statistics
            </h2>

            <p>
              A quick summary of your
              StudentMart system.
            </p>

          </div>

          <div className="dashboard-live">

            <span />

            Live Data

          </div>

        </div>

        {/* ===================================================
            MAIN STAT CARDS
        =================================================== */}

        <section className="dashboard-stats">

          {loading ? (
            <DashboardSkeleton />
          ) : (
            <>

              <StatCard
                title="Total Users"
                value={stats.total_users}
                icon={Users}
                type="blue"
                description="All registered accounts"
              />

              <StatCard
                title="Students"
                value={stats.total_students}
                icon={UserRound}
                type="purple"
                description="Registered student accounts"
              />

              <StatCard
                title="Administrators"
                value={stats.total_admins}
                icon={ShieldCheck}
                type="slate"
                description="System administrator accounts"
              />
              <StatCard
                title="Staff"
                value={stats.total_staff}
                icon={UserPlus}
                type="purple"
                description="Non-archived staff accounts"
              />

              <StatCard
                title="Total Products"
                value={stats.total_products}
                icon={Package}
                type="orange"
                description="All marketplace listings"
              />

              <StatCard
                title="Pending Products"
                value={stats.pending_products}
                icon={Clock3}
                type="yellow"
                description="Products awaiting approval"
              />

              <StatCard
                title="Active Products"
                value={stats.active_products}
                icon={CheckCircle2}
                type="green"
                description="Approved marketplace listings"
              />

            </>
          )}

        </section>

        {/* ===================================================
            SECONDARY STATISTICS
        =================================================== */}

        {!loading && (
          <section className="secondary-stats">

            <SecondaryStat
              icon={ListChecks}
              title="Total Listings"
              value={stats.total_products}
              description="Marketplace products"
              type="blue"
            />

            <SecondaryStat
              icon={Clock3}
              title="Needs Review"
              value={stats.pending_products}
              description="Awaiting administrator action"
              type="yellow"
            />

            <SecondaryStat
              icon={TrendingUp}
              title="Approval Rate"
              value={`${approvalRate}%`}
              description="Based on reviewed products"
              type="green"
            />

            <SecondaryStat
              icon={UserPlus}
              title="Student Accounts"
              value={stats.total_students}
              description="Active marketplace users"
              type="purple"
            />

          </section>
        )}

        {/* ===================================================
            LOWER DASHBOARD
        =================================================== */}

        {!loading && (
          <section className="course-stat-section">
            <div className="course-stat-heading"><div><span>STUDENT ENROLLMENT</span><h2>Students by course / program</h2><p>Counts come from student accounts in the database.</p></div></div>
            <div className="course-stat-grid">
              {courseMetrics.map((item) => (
                <article className="course-stat-card" key={item.code}>
                  <div><strong>{item.code}</strong><span>{item.title}</span><b>{item.count}</b></div>
                  <div className="course-stat-track" aria-label={item.count + " students"}><span style={{ width: ((item.count / courseMaximum) * 100) + "%" }} /></div>
                </article>
              ))}
            </div>
          </section>
        )}
        <section className="dashboard-bottom-grid">

          {/* =================================================
              PRODUCT OVERVIEW
          ================================================= */}

          <div className="dashboard-panel product-panel">

            <div className="panel-header">

              <div>

                <span className="panel-label">
                  MARKETPLACE
                </span>

                <h2>
                  Product Overview
                </h2>

                <p>
                  Monitor the current status
                  of marketplace listings.
                </p>

              </div>

              <div className="panel-header-icon">

                <Package size={20} />

              </div>

            </div>

            <div className="overview-list">

              {/* PENDING */}

              <div className="overview-item">

                <div className="overview-left">

                  <div className="overview-icon pending">

                    <Clock3 size={18} />

                  </div>

                  <div>

                    <strong>
                      {stats.pending_products}
                    </strong>

                    <span>
                      Pending review
                    </span>

                  </div>

                </div>

                <button
                  type="button"
                  className="overview-action pending-action"
                  onClick={() =>
                    navigate(
                      "/admin/products"
                    )
                  }
                >
                  Review

                  <ArrowRight size={15} />

                </button>

              </div>

              {/* ACTIVE */}

              <div className="overview-item">

                <div className="overview-left">

                  <div className="overview-icon active">

                    <CheckCircle2
                      size={18}
                    />

                  </div>

                  <div>

                    <strong>
                      {stats.active_products}
                    </strong>

                    <span>
                      Active products
                    </span>

                  </div>

                </div>

                <button
                  type="button"
                  className="overview-action active-action"
                  onClick={() =>
                    navigate(
                      "/admin/products"
                    )
                  }
                >
                  View

                  <ArrowRight size={15} />

                </button>

              </div>

              {/* REJECTED */}

              <div className="overview-item">

                <div className="overview-left">

                  <div className="overview-icon rejected">

                    <XCircle size={18} />

                  </div>

                  <div>

                    <strong>
                      {stats.rejected_products}
                    </strong>

                    <span>
                      Rejected products
                    </span>

                  </div>

                </div>

                <button
                  type="button"
                  className="overview-action rejected-action"
                  onClick={() =>
                    navigate(
                      "/admin/products"
                    )
                  }
                >
                  View

                  <ArrowRight size={15} />

                </button>

              </div>

            </div>

            <button
              type="button"
              className="open-management"
              onClick={() =>
                navigate(
                  "/admin/products"
                )
              }
            >
              <Package size={17} />

              Open Product Management

              <ArrowRight size={16} />

            </button>

          </div>

          {/* =================================================
              ADMINISTRATION
          ================================================= */}

          <div className="dashboard-panel administration-panel">

            <div className="panel-header">

              <div>

                <span className="panel-label">
                  SYSTEM
                </span>

                <h2>
                  Administration
                </h2>

                <p>
                  Manage users and marketplace
                  operations.
                </p>

              </div>

              <div className="panel-header-icon">

                <ShieldCheck size={20} />

              </div>

            </div>

            {/* ONLINE STATUS */}

            <div className="system-status">

              <div className="online-indicator">

                <span />

                System Online

              </div>

              <p>
                TMC StudentMart administration
                services are connected to the
                Laravel API.
              </p>

            </div>

            {/* MINI STATS */}

            <div className="system-mini-stats">

              <div>

                <span>
                  Users
                </span>

                <strong>
                  {stats.total_users}
                </strong>

              </div>

              <div>

                <span>
                  Students
                </span>

                <strong>
                  {stats.total_students}
                </strong>

              </div>

              <div>

                <span>
                  Products
                </span>

                <strong>
                  {stats.total_products}
                </strong>

              </div>

            </div>

            {/* QUICK ACTIONS */}

            <div className="quick-actions">

              <button
                type="button"
                onClick={() =>
                  navigate(
                    "/admin/users"
                  )
                }
              >

                <div>

                  <Users size={17} />

                  <span>
                    Manage Users
                  </span>

                </div>

                <ArrowRight size={16} />

              </button>

              <button
                type="button"
                onClick={() =>
                  navigate(
                    "/admin/products"
                  )
                }
              >

                <div>

                  <Package size={17} />

                  <span>
                    Manage Products
                  </span>

                </div>

                <ArrowRight size={16} />

              </button>

            </div>

          </div>

        </section>

        {/* ===================================================
            FOOTER INFO
        =================================================== */}

        <div className="dashboard-footer">

          <div>

            <Bell size={15} />

            <span>
              TMC StudentMart Administration
            </span>

          </div>

          <span>
            Connected to Laravel API
          </span>

        </div>

      </div>
    </AdminLayout>
  );
}