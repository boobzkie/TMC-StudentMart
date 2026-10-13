import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock3,
  Package,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Users,
  UserCheck,
  UserPlus,
  XCircle,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

import AdminLayout from "./components/AdminLayout";
import { API_URL } from "./utils/api";

import "./AdminAnalytics.css";


/* =========================================================
   DEFAULT ANALYTICS DATA
========================================================= */

const DEFAULT_STATS = {
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
};

/* =========================================================
   HELPERS
========================================================= */

function safeNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function getPercentage(value, total) {
  if (!total || total <= 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

/* =========================================================
   STAT CARD
========================================================= */

function AnalyticsStatCard({
  title,
  value,
  description,
  icon: Icon,
  type = "blue",
}) {
  return (
    <article
      className={`analytics-stat-card ${type}`}
    >
      <div className="analytics-stat-top">
        <div className="analytics-stat-icon">
          <Icon
            size={21}
            strokeWidth={2}
          />
        </div>

        <span className="analytics-stat-label">
          {title}
        </span>
      </div>

      <strong className="analytics-stat-value">
        {value.toLocaleString()}
      </strong>

      <span className="analytics-stat-description">
        {description}
      </span>
    </article>
  );
}

/* =========================================================
   PROGRESS ROW
========================================================= */

function AnalyticsProgressRow({
  label,
  value,
  percentage,
  type,
  icon: Icon,
}) {
  return (
    <div className="analytics-progress-row">
      <div className="analytics-progress-heading">
        <div className="analytics-progress-label">
          <span
            className={`analytics-progress-icon ${type}`}
          >
            <Icon size={16} />
          </span>

          <span>{label}</span>
        </div>

        <strong>
          {value.toLocaleString()}
        </strong>
      </div>

      <div className="analytics-progress-track">
        <div
          className={`analytics-progress-fill ${type}`}
          style={{
            width: `${Math.min(
              Math.max(percentage, 0),
              100
            )}%`,
          }}
        />
      </div>

      <span className="analytics-progress-percent">
        {percentage}%
      </span>
    </div>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */

function AdminAnalytics() {
  const navigate = useNavigate();

  const [stats, setStats] =
    useState(DEFAULT_STATS);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  /* =======================================================
     LOAD ANALYTICS
  ======================================================= */

  const loadAnalytics = useCallback(
    async (isRefresh = false) => {
      const token =
        localStorage.getItem("token");

      if (!token) {
        navigate("/login", {
          replace: true,
        });

        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const response = await fetch(
          `${API_URL}/admin/stats`,
          {
            method: "GET",

            headers: {
              Accept:
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },
          }
        );

        /* ================================================
           AUTH ERROR
        ================================================ */

        if (
          response.status === 401 ||
          response.status === 403
        ) {
          localStorage.removeItem(
            "token"
          );

          localStorage.removeItem(
            "role"
          );

          localStorage.removeItem(
            "user"
          );

          navigate("/login", {
            replace: true,
          });

          return;
        }

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Unable to load analytics."
          );
        }

        const incoming =
          data.stats || data;

        setStats({
          total_users:
            safeNumber(
              incoming.total_users
            ),

          total_students:
            safeNumber(
              incoming.total_students
            ),

          total_admins:
            safeNumber(
              incoming.total_admins
            ),
          total_staff: safeNumber(incoming.total_staff),

          total_products:
            safeNumber(
              incoming.total_products
            ),

          pending_products:
            safeNumber(
              incoming.pending_products
            ),

          approved_products:
            safeNumber(
              incoming.approved_products ??
                incoming.active_products
            ),

          active_products:
            safeNumber(
              incoming.active_products ??
                incoming.approved_products
            ),

          rejected_products:
            safeNumber(
              incoming.rejected_products
            ),

          inactive_products:
            safeNumber(
              incoming.inactive_products
            ),
        });
      } catch (err) {
        console.error(
          "Analytics error:",
          err
        );

        setError(
          err.message ||
            "We couldn't load analytics. Please try again."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [navigate]
  );

  /* =======================================================
     INITIAL LOAD

     The API request is deferred until after the effect
     has been scheduled. This avoids the synchronous
     set-state-in-effect lint warning while preserving
     the existing API-loading behavior.
  ======================================================= */

  useEffect(() => {
    const timer = setTimeout(() => {
      loadAnalytics();
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [loadAnalytics]);

  /* =======================================================
     CALCULATIONS
  ======================================================= */

  const calculated = useMemo(() => {
    const totalProducts =
      safeNumber(
        stats.total_products
      );

    const totalUsers =
      safeNumber(
        stats.total_users
      );

    const activeProducts =
      safeNumber(
        stats.active_products
      );

    const pendingProducts =
      safeNumber(
        stats.pending_products
      );

    const rejectedProducts =
      safeNumber(
        stats.rejected_products
      );

    const inactiveProducts =
      safeNumber(
        stats.inactive_products
      );

    const reviewedProducts =
      activeProducts +
      rejectedProducts;

    const approvalRate =
      getPercentage(
        activeProducts,
        reviewedProducts
      );

    const pendingRate =
      getPercentage(
        pendingProducts,
        totalProducts
      );

    const rejectedRate =
      getPercentage(
        rejectedProducts,
        totalProducts
      );

    const inactiveRate =
      getPercentage(
        inactiveProducts,
        totalProducts
      );

    const activeRate =
      getPercentage(
        activeProducts,
        totalProducts
      );

    const studentRate =
      getPercentage(
        stats.total_students,
        totalUsers
      );

    const adminRate =
      getPercentage(
        stats.total_admins,
        totalUsers
      );

    return {
      totalProducts,
      totalUsers,

      activeProducts,
      pendingProducts,
      rejectedProducts,
      inactiveProducts,

      reviewedProducts,

      approvalRate,

      pendingRate,
      rejectedRate,
      inactiveRate,
      activeRate,

      studentRate,
      adminRate,
    };
  }, [stats]);

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <AdminLayout
      title="Analytics"
      subtitle="Analyze users and marketplace activity."
    >
      <div className="analytics-page">

        {/* =================================================
            HERO
        ================================================= */}

        <section className="analytics-hero">

          <div className="analytics-hero-decoration analytics-decoration-one" />

          <div className="analytics-hero-decoration analytics-decoration-two" />

          <div className="analytics-hero-content">

            <div className="analytics-hero-icon">
              <BarChart3
                size={25}
                strokeWidth={2}
              />
            </div>

            <div>
              <span className="analytics-eyebrow">
                ADMIN ANALYTICS
              </span>

              <h1>
                Marketplace Analytics
              </h1>

              <p>
                Understand your current
                users and product activity
                using live marketplace data.
              </p>
            </div>

          </div>

          <button
            type="button"
            className="analytics-refresh-button"
            onClick={() =>
              loadAnalytics(true)
            }
            disabled={refreshing}
          >
            <RefreshCw
              size={16}
              className={
                refreshing
                  ? "analytics-spin"
                  : ""
              }
            />

            {refreshing
              ? "Refreshing..."
              : "Refresh Data"}
          </button>

        </section>

        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="analytics-error">

            <div className="analytics-error-content">

              <XCircle size={21} />

              <div>
                <strong>
                  Unable to load analytics
                </strong>

                <span>
                  {error}
                </span>
              </div>

            </div>

            <button
              type="button"
              onClick={() =>
                loadAnalytics(true)
              }
            >
              Try Again
            </button>

          </div>
        )}

        {/* =================================================
            LOADING
        ================================================= */}

        {loading ? (
          <div className="analytics-loading-grid">

            {Array.from({
              length: 4,
            }).map((_, index) => (
              <div
                className="analytics-skeleton-card"
                key={index}
              >
                <span />
                <span />
                <span />
              </div>
            ))}

          </div>
        ) : (
          <>

            {/* =============================================
                OVERVIEW
            ============================================= */}

            <section className="analytics-section">

              <div className="analytics-section-heading">

                <div>
                  <span>
                    OVERVIEW
                  </span>

                  <h2>
                    Current System Activity
                  </h2>

                  <p>
                    Live totals returned by
                    the Laravel admin API.
                  </p>
                </div>

                <div className="analytics-live-badge">
                  <span />
                  Live Data
                </div>

              </div>

              <div className="analytics-stat-grid">

                <AnalyticsStatCard
                  title="Total Users"
                  value={
                    stats.total_users
                  }
                  description="All registered accounts"
                  icon={Users}
                  type="blue"
                />

                <AnalyticsStatCard
                  title="Students"
                  value={
                    stats.total_students
                  }
                  description="Student accounts"
                  icon={UserCheck}
                  type="purple"
                />

                <AnalyticsStatCard
                  title="Staff"
                  value={stats.total_staff}
                  description="Non-archived staff accounts"
                  icon={UserPlus}
                  type="indigo"
                />

                <AnalyticsStatCard
                  title="Total Products"
                  value={
                    stats.total_products
                  }
                  description="Marketplace products"
                  icon={Package}
                  type="green"
                />

                <AnalyticsStatCard
                  title="Pending Products"
                  value={
                    stats.pending_products
                  }
                  description="Awaiting moderation"
                  icon={Clock3}
                  type="orange"
                />

              </div>

            </section>

            {/* =============================================
                PRODUCT ANALYTICS
            ============================================= */}

            <section className="analytics-panel-grid">

              <article className="analytics-panel">

                <div className="analytics-panel-header">

                  <div>
                    <span>
                      PRODUCTS
                    </span>

                    <h2>
                      Product Status
                    </h2>
                  </div>

                  <div className="analytics-panel-icon">
                    <Package size={19} />
                  </div>

                </div>

                <div className="analytics-progress-list">

                  <AnalyticsProgressRow
                    label="Active"
                    value={
                      calculated.activeProducts
                    }
                    percentage={
                      calculated.activeRate
                    }
                    type="success"
                    icon={CheckCircle2}
                  />

                  <AnalyticsProgressRow
                    label="Pending"
                    value={
                      calculated.pendingProducts
                    }
                    percentage={
                      calculated.pendingRate
                    }
                    type="warning"
                    icon={Clock3}
                  />

                  <AnalyticsProgressRow
                    label="Rejected"
                    value={
                      calculated.rejectedProducts
                    }
                    percentage={
                      calculated.rejectedRate
                    }
                    type="danger"
                    icon={XCircle}
                  />

                  <AnalyticsProgressRow
                    label="Inactive"
                    value={
                      calculated.inactiveProducts
                    }
                    percentage={
                      calculated.inactiveRate
                    }
                    type="neutral"
                    icon={ShieldCheck}
                  />

                </div>

              </article>

              {/* ===========================================
                  MODERATION ANALYTICS
              =========================================== */}

              <article className="analytics-panel">

                <div className="analytics-panel-header">

                  <div>
                    <span>
                      MODERATION
                    </span>

                    <h2>
                      Approval Overview
                    </h2>
                  </div>

                  <div className="analytics-panel-icon">
                    <TrendingUp size={19} />
                  </div>

                </div>

                <div className="analytics-approval">

                  {/* DYNAMIC APPROVAL RING */}

                  <div
                    className="analytics-ring"
                    style={{
                      "--approval-progress":
                        `${calculated.approvalRate * 3.6}deg`,
                    }}
                  >

                    <div className="analytics-ring-inner">

                      <strong>
                        {
                          calculated.approvalRate
                        }%
                      </strong>

                      <span>
                        Approval Rate
                      </span>

                    </div>

                  </div>

                  <div className="analytics-approval-details">

                    <div>
                      <span>
                        Reviewed Products
                      </span>

                      <strong>
                        {
                          calculated.reviewedProducts.toLocaleString()
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Active
                      </span>

                      <strong>
                        {
                          calculated.activeProducts.toLocaleString()
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Rejected
                      </span>

                      <strong>
                        {
                          calculated.rejectedProducts.toLocaleString()
                        }
                      </strong>
                    </div>

                  </div>

                </div>

                <div className="analytics-insight">

                  <Activity
                    size={17}
                  />

                  <p>
                    The approval rate is
                    calculated from products
                    that have already been
                    reviewed. Pending products
                    are excluded.
                  </p>

                </div>

              </article>

            </section>

            {/* =============================================
                USER DISTRIBUTION
            ============================================= */}

            <section className="analytics-panel">

              <div className="analytics-panel-header">

                <div>
                  <span>
                    USERS
                  </span>

                  <h2>
                    User Distribution
                  </h2>
                </div>

                <div className="analytics-panel-icon">
                  <Users size={19} />
                </div>

              </div>

              <div className="analytics-user-distribution">

                <div className="analytics-user-main">

                  {/* DYNAMIC STUDENT RING */}

                  <div
                    className="analytics-user-ring"
                    style={{
                      "--student-progress":
                        `${calculated.studentRate * 3.6}deg`,
                    }}
                  >

                    <div>

                      <strong>
                        {
                          calculated.studentRate
                        }%
                      </strong>

                      <span>
                        Students
                      </span>

                    </div>

                  </div>

                  <div>

                    <h3>
                      Student Accounts
                    </h3>

                    <p>
                      Students represent{" "}
                      {
                        calculated.studentRate
                      }% of all registered
                      accounts in the system.
                    </p>

                  </div>

                </div>

                <div className="analytics-user-bars">

                  <div className="analytics-user-row">

                    <div>
                      <span>
                        Students
                      </span>

                      <strong>
                        {
                          stats.total_students.toLocaleString()
                        }
                      </strong>
                    </div>

                    <div className="analytics-user-track">

                      <div
                        className="analytics-user-fill student"
                        style={{
                          width: `${Math.min(
                            Math.max(
                              calculated.studentRate,
                              0
                            ),
                            100
                          )}%`,
                        }}
                      />

                    </div>

                    <small>
                      {
                        calculated.studentRate
                      }%
                    </small>

                  </div>

                  <div className="analytics-user-row">

                    <div>
                      <span>
                        Administrators
                      </span>

                      <strong>
                        {
                          stats.total_admins.toLocaleString()
                        }
                      </strong>
                    </div>

                    <div className="analytics-user-track">

                      <div
                        className="analytics-user-fill admin"
                        style={{
                          width: `${Math.min(
                            Math.max(
                              calculated.adminRate,
                              0
                            ),
                            100
                          )}%`,
                        }}
                      />

                    </div>

                    <small>
                      {
                        calculated.adminRate
                      }%
                    </small>

                  </div>

                </div>

              </div>

              <div className="analytics-notice">

                <div className="analytics-notice-icon">
                  <Activity size={18} />
                </div>

                <div>

                  <strong>
                    Analytics Data Scope
                  </strong>

                  <p>
                    This page uses the existing
                    Laravel admin statistics
                    endpoint. Transaction,
                    payment, revenue, and
                    commission analytics are
                    intentionally not included
                    because those records are
                    not currently available in
                    the marketplace database.
                  </p>

                </div>

              </div>

            </section>

          </>
        )}

      </div>
    </AdminLayout>
  );
}

export default AdminAnalytics;