import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Package,
  RefreshCw,
  ShieldCheck,
  Users,
  UserPlus,
  XCircle,
} from "lucide-react";

import AdminLayout from "./components/AdminLayout";
import { API_URL } from "./utils/api";

import "./AdminReports.css";


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

function ReportsSkeleton() {
  return (
    <div className="reports-stats-grid">
      {[1, 2, 3, 4, 5, 6].map((item) => (
        <div
          className="reports-stat-card reports-skeleton-card"
          key={item}
        >
          <div className="reports-skeleton-icon" />

          <div className="reports-skeleton-content">
            <div className="reports-skeleton-line reports-skeleton-small" />

            <div className="reports-skeleton-line reports-skeleton-number" />

            <div className="reports-skeleton-line reports-skeleton-text" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ReportStatCard({
  icon: Icon,
  label,
  value,
  description,
  type = "blue",
}) {
  return (
    <article className={`reports-stat-card ${type}`}>
      <div className="reports-stat-icon">
        <Icon
          size={22}
          strokeWidth={2.2}
        />
      </div>

      <div className="reports-stat-content">
        <span className="reports-stat-label">
          {label}
        </span>

        <strong className="reports-stat-value">
          {Number(value).toLocaleString()}
        </strong>

        <small className="reports-stat-description">
          {description}
        </small>
      </div>
    </article>
  );
}

function ProgressRow({
  label,
  value,
  total,
  type = "blue",
}) {
  const safeValue = Number(value) || 0;
  const safeTotal = Number(total) || 0;

  const percentage =
    safeTotal > 0
      ? Math.round(
          (safeValue / safeTotal) * 100
        )
      : 0;

  return (
    <div className="reports-progress-row">
      <div className="reports-progress-heading">
        <span className="reports-progress-label">
          {label}
        </span>

        <strong>
          {safeValue.toLocaleString()}
        </strong>
      </div>

      <div
        className="reports-progress-track"
        aria-label={`${label}: ${percentage}%`}
      >
        <div
          className={`reports-progress-fill ${type}`}
          style={{
            width: `${Math.min(
              percentage,
              100
            )}%`,
          }}
        />
      </div>

      <div className="reports-progress-footer">
        <span>
          {percentage}% of total products
        </span>
      </div>
    </div>
  );
}

export default function AdminReports() {
  const navigate = useNavigate();

  const [stats, setStats] = useState(
    DEFAULT_STATS
  );

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] = useState("");

  const loadReports = useCallback(
    async (showRefresh = false) => {
      try {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const token =
          localStorage.getItem("token");

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
              "Unable to load reports."
          );
        }

        const incoming =
          data.stats || data;

        setStats({
          total_users:
            Number(
              incoming.total_users
            ) || 0,

          total_students:
            Number(
              incoming.total_students
            ) || 0,

          total_admins:
            Number(
              incoming.total_admins
            ) || 0,
          total_staff: Number(incoming.total_staff) || 0,

          total_products:
            Number(
              incoming.total_products
            ) || 0,

          pending_products:
            Number(
              incoming.pending_products
            ) || 0,

          approved_products:
            Number(
              incoming.approved_products ??
                incoming.active_products ??
                0
            ) || 0,

          active_products:
            Number(
              incoming.active_products ??
                incoming.approved_products ??
                0
            ) || 0,

          rejected_products:
            Number(
              incoming.rejected_products
            ) || 0,

          inactive_products:
            Number(
              incoming.inactive_products
            ) || 0,
        });
      } catch (err) {
        console.error(
          "Reports error:",
          err
        );

        setError(
          "We couldn't load the reports. Please try again."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [navigate]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadReports();
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [loadReports]);

  const productReviewedCount = useMemo(() => {
    return (
      stats.active_products +
      stats.rejected_products
    );
  }, [
    stats.active_products,
    stats.rejected_products,
  ]);

  const approvalRate = useMemo(() => {
    if (productReviewedCount <= 0) {
      return 0;
    }

    return Math.round(
      (stats.active_products /
        productReviewedCount) *
        100
    );
  }, [
    productReviewedCount,
    stats.active_products,
  ]);

  const studentPercentage = useMemo(() => {
    if (stats.total_users <= 0) {
      return 0;
    }

    return Math.round(
      (stats.total_students /
        stats.total_users) *
        100
    );
  }, [
    stats.total_students,
    stats.total_users,
  ]);

  return (
    <AdminLayout
      title="Reports"
      subtitle="Review marketplace activity and system statistics."
    >
      <div className="reports-page">

        {/* =================================================
            HERO
        ================================================= */}

        <section className="reports-hero">

          <div className="reports-hero-decoration reports-decoration-one" />

          <div className="reports-hero-decoration reports-decoration-two" />

          <div className="reports-hero-content">

            <div className="reports-hero-icon">
              <BarChart3
                size={27}
                strokeWidth={2.1}
              />
            </div>

            <div>

              <span className="reports-hero-label">
                ADMINISTRATIVE REPORTS
              </span>

              <h2>
                Marketplace Reports
              </h2>

              <p>
                Review current users and
                product activity using data
                from your StudentMart system.
              </p>

            </div>

          </div>

          <button
            type="button"
            className="reports-refresh-button"
            onClick={() =>
              loadReports(true)
            }
            disabled={refreshing}
          >
            <RefreshCw
              size={17}
              className={
                refreshing
                  ? "reports-spin"
                  : ""
              }
            />

            <span>
              {refreshing
                ? "Refreshing..."
                : "Refresh Reports"}
            </span>
          </button>

        </section>


        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div className="reports-error">

            <div className="reports-error-icon">
              <AlertCircle size={19} />
            </div>

            <div className="reports-error-content">

              <strong>
                Unable to load reports
              </strong>

              <p>
                {error}
              </p>

            </div>

            <button
              type="button"
              onClick={() =>
                loadReports(true)
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
          <ReportsSkeleton />
        ) : (
          <>

            {/* =============================================
                OVERVIEW
            ============================================= */}

            <section className="reports-section">

              <div className="reports-section-heading">

                <div>

                  <span>
                    SYSTEM OVERVIEW
                  </span>

                  <h3>
                    Current Statistics
                  </h3>

                  <p>
                    Live figures returned by
                    the administrator statistics
                    endpoint.
                  </p>

                </div>

              </div>

              <div className="reports-stats-grid">

                <ReportStatCard
                  icon={Users}
                  label="Total Users"
                  value={
                    stats.total_users
                  }
                  description="Registered accounts"
                  type="blue"
                />

                <ReportStatCard
                  icon={Users}
                  label="Students"
                  value={
                    stats.total_students
                  }
                  description="Student accounts"
                  type="purple"
                />

                <ReportStatCard
                  icon={ShieldCheck}
                  label="Administrators"
                  value={
                    stats.total_admins
                  }
                  description="Admin accounts"
                  type="indigo"
                />

                <ReportStatCard
                  icon={UserPlus}
                  label="Staff"
                  value={stats.total_staff}
                  description="Non-archived staff accounts"
                  type="purple"
                />

                <ReportStatCard
                  icon={Package}
                  label="Total Products"
                  value={
                    stats.total_products
                  }
                  description="Products in database"
                  type="green"
                />

                <ReportStatCard
                  icon={Clock3}
                  label="Pending Products"
                  value={
                    stats.pending_products
                  }
                  description="Awaiting moderation"
                  type="yellow"
                />

                <ReportStatCard
                  icon={XCircle}
                  label="Rejected Products"
                  value={
                    stats.rejected_products
                  }
                  description="Rejected listings"
                  type="red"
                />

              </div>

            </section>


            {/* =============================================
                PRODUCT + USER REPORT
            ============================================= */}

            <section className="reports-two-column">

              {/* PRODUCT REPORT */}

              <div className="reports-panel">

                <div className="reports-panel-header">

                  <div className="reports-panel-icon green">
                    <Package size={20} />
                  </div>

                  <div>

                    <span>
                      PRODUCT REPORT
                    </span>

                    <h3>
                      Product Status
                    </h3>

                  </div>

                </div>


                <div className="reports-product-summary">

                  <div>

                    <strong>
                      {stats.total_products.toLocaleString()}
                    </strong>

                    <span>
                      Total products
                    </span>

                  </div>

                  <div>

                    <strong>
                      {productReviewedCount.toLocaleString()}
                    </strong>

                    <span>
                      Reviewed products
                    </span>

                  </div>

                  <div>

                    <strong>
                      {approvalRate}%
                    </strong>

                    <span>
                      Approval rate
                    </span>

                  </div>

                </div>


                <div className="reports-progress-list">

                  <ProgressRow
                    label="Active Products"
                    value={
                      stats.active_products
                    }
                    total={
                      stats.total_products
                    }
                    type="green"
                  />

                  <ProgressRow
                    label="Pending Products"
                    value={
                      stats.pending_products
                    }
                    total={
                      stats.total_products
                    }
                    type="yellow"
                  />

                  <ProgressRow
                    label="Rejected Products"
                    value={
                      stats.rejected_products
                    }
                    total={
                      stats.total_products
                    }
                    type="red"
                  />

                  <ProgressRow
                    label="Inactive Products"
                    value={
                      stats.inactive_products
                    }
                    total={
                      stats.total_products
                    }
                    type="gray"
                  />

                </div>

              </div>


              {/* USER REPORT */}

              <div className="reports-panel">

                <div className="reports-panel-header">

                  <div className="reports-panel-icon blue">
                    <Users size={20} />
                  </div>

                  <div>

                    <span>
                      USER REPORT
                    </span>

                    <h3>
                      Account Overview
                    </h3>

                  </div>

                </div>


                <div className="reports-user-main">

                  <div className="reports-user-total">

                    <span>
                      Registered Users
                    </span>

                    <strong>
                      {stats.total_users.toLocaleString()}
                    </strong>

                  </div>


                  <div className="reports-user-ring">

                    <div
                      className="reports-ring"
                      style={{
                        background: `conic-gradient(
                          var(--tmc-ui-blue) ${studentPercentage}%,
                          var(--tmc-admin-bg-muted) ${studentPercentage}% 100%
                        )`,
                      }}
                    >

                      <div className="reports-ring-inner">

                        <strong>
                          {studentPercentage}%
                        </strong>

                        <span>
                          Students
                        </span>

                      </div>

                    </div>

                  </div>

                </div>


                <div className="reports-user-breakdown">

                  <div className="reports-breakdown-item">

                    <div className="reports-breakdown-dot blue" />

                    <div>

                      <span>
                        Students
                      </span>

                      <strong>
                        {stats.total_students.toLocaleString()}
                      </strong>

                    </div>

                  </div>


                  <div className="reports-breakdown-item">

                    <div className="reports-breakdown-dot purple" />

                    <div>

                      <span>
                        Administrators
                      </span>

                      <strong>
                        {stats.total_admins.toLocaleString()}
                      </strong>

                    </div>

                  </div>

                </div>

              </div>

            </section>


            {/* =============================================
                REPORT SUMMARY
            ============================================= */}

            <section className="reports-panel reports-summary-panel">

              <div className="reports-panel-header">

                <div className="reports-panel-icon purple">
                  <Activity size={20} />
                </div>

                <div>

                  <span>
                    REPORT SUMMARY
                  </span>

                  <h3>
                    Marketplace Health Overview
                  </h3>

                </div>

              </div>


              <div className="reports-summary-grid">

                <div className="reports-summary-item">

                  <div className="reports-summary-item-icon blue">
                    <Users size={18} />
                  </div>

                  <div>

                    <span>
                      User Accounts
                    </span>

                    <strong>
                      {stats.total_users.toLocaleString()}
                    </strong>

                    <small>
                      Total registered accounts
                    </small>

                  </div>

                </div>


                <div className="reports-summary-item">

                  <div className="reports-summary-item-icon green">
                    <CheckCircle2 size={18} />
                  </div>

                  <div>

                    <span>
                      Active Products
                    </span>

                    <strong>
                      {stats.active_products.toLocaleString()}
                    </strong>

                    <small>
                      Currently active listings
                    </small>

                  </div>

                </div>


                <div className="reports-summary-item">

                  <div className="reports-summary-item-icon yellow">
                    <Clock3 size={18} />
                  </div>

                  <div>

                    <span>
                      Pending Review
                    </span>

                    <strong>
                      {stats.pending_products.toLocaleString()}
                    </strong>

                    <small>
                      Listings awaiting moderation
                    </small>

                  </div>

                </div>


                <div className="reports-summary-item">

                  <div className="reports-summary-item-icon red">
                    <XCircle size={18} />
                  </div>

                  <div>

                    <span>
                      Rejected Products
                    </span>

                    <strong>
                      {stats.rejected_products.toLocaleString()}
                    </strong>

                    <small>
                      Listings rejected by admin
                    </small>

                  </div>

                </div>

              </div>

            </section>


            {/* =============================================
                DATA LIMITATION NOTE
            ============================================= */}

            <section className="reports-note">

              <div className="reports-note-icon">
                <AlertCircle size={19} />
              </div>

              <div>

                <strong>
                  Report data availability
                </strong>

                <p>
                  These reports currently use
                  the statistics available from
                  the existing StudentMart
                  database. Transaction,
                  payment, revenue, and
                  commission reports are not
                  calculated here because the
                  transaction database has not
                  been implemented yet.
                </p>

              </div>

            </section>

          </>
        )}

      </div>
    </AdminLayout>
  );
}