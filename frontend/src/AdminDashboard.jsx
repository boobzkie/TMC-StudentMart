import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Package,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Users,
  UserRound,
  XCircle,
} from "lucide-react";

import AdminLayout from "./components/AdminLayout";
import { API_URL } from "./utils/api";

import "./AdminDashboard.css";

const PROGRAMS = [
  ["BSIT", "BSIT — Information Technology"],
  ["BSOA", "BSOA — Office Administration"],
  ["BSCRIM", "BSCRIM — Criminology"],
  ["BSED", "BSED — Secondary Education"],
  ["CAS", "CAS — Arts and Sciences"],
];

const STATUS_ROWS = [
  {
    key: "active_products",
    label: "Active listings",
    description: "Approved and visible in the marketplace",
    icon: CheckCircle2,
    tone: "success",
  },
  {
    key: "pending_products",
    label: "Pending approvals",
    description: "Waiting for an administrator decision",
    icon: Clock3,
    tone: "warning",
  },
  {
    key: "rejected_products",
    label: "Rejected listings",
    description: "Not approved by moderation",
    icon: XCircle,
    tone: "danger",
  },
  {
    key: "inactive_products",
    label: "Inactive listings",
    description: "Temporarily unavailable",
    icon: Activity,
    tone: "neutral",
  },
  {
    key: "sold_out_products",
    label: "Sold out listings",
    description: "Fully reserved by buyers",
    icon: Package,
    tone: "warning",
  },
  {
    key: "archived_products",
    label: "Archived listings",
    description: "Retained for order and audit history",
    icon: Package,
    tone: "neutral",
  },
];

const SUMMARY_CARDS = [
  {
    key: "total_users",
    title: "Registered Accounts",
    description: "All accounts in the system",
    icon: Users,
    tone: "blue",
    to: "/admin/users",
  },
  {
    key: "total_students",
    title: "Student Accounts",
    description: "Registered student users",
    icon: UserRound,
    tone: "purple",
    to: "/admin/users",
  },
  {
    key: "total_admins",
    title: "Administrator Accounts",
    description: "System administrator users",
    icon: ShieldCheck,
    tone: "blue",
    to: "/admin/users",
  },
  {
    key: "total_staff",
    title: "Staff Accounts",
    description: "Non-archived staff users",
    icon: UserPlus,
    tone: "teal",
    to: "/admin/staff",
  },
  {
    key: "total_products",
    title: "Marketplace Listings",
    description: "Products submitted by sellers",
    icon: Package,
    tone: "orange",
    to: "/admin/products",
  },
  {
    key: "pending_products",
    title: "Pending Approvals",
    description: "Listings awaiting moderation",
    icon: Clock3,
    tone: "yellow",
    to: "/admin/products",
  },
  {
    key: "active_products",
    title: "Approved Listings",
    description: "Active marketplace products",
    icon: CheckCircle2,
    tone: "green",
    to: "/admin/products",
  },
];

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function percentOf(value, total) {
  if (!total || total <= 0) {
    return 0;
  }

  return Math.round((value / total) * 100);
}

function formatValue(value) {
  return toNumber(value).toLocaleString();
}

function getLastUpdatedLabel(timestamp) {
  if (!timestamp) {
    return "Not updated yet";
  }

  const time = new Date(timestamp);
  return `Updated at ${time.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function DashboardSkeleton() {
  return (
    <>
      {Array.from({ length: 7 }).map((_, index) => (
        <div
          className="dashboard-skeleton-card"
          key={index}
        />
      ))}
    </>
  );
}

function ChartSkeleton() {
  return (
    <div className="dashboard-chart-skeleton">
      <span />
      <span />
      <span />
    </div>
  );
}

function ChartRow({ label, value, max, tone, hint }) {
  const safeValue = toNumber(value);
  const safeMax = Math.max(1, toNumber(max));
  const width = Math.min(Math.round((safeValue / safeMax) * 100), 100);

  return (
    <div className="dashboard-chart-row">
      <div className="dashboard-chart-row-top">
        <span className="dashboard-chart-label">
          {label}
        </span>

        <strong>
          {safeValue.toLocaleString()}
        </strong>
      </div>

      <div
        className="dashboard-chart-track"
        aria-label={`${label}: ${safeValue.toLocaleString()}`}
      >
        <div
          className={`dashboard-chart-fill ${tone}`}
          style={{ width: `${width}%` }}
          title={`${label}: ${safeValue.toLocaleString()}`}
        />
      </div>

      {hint ? (
        <small>
          {hint}
        </small>
      ) : null}
    </div>
  );
}

function EmptyChartState({ title, text }) {
  return (
    <div className="dashboard-empty-state">
      <BarChart3 size={22} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

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
    sold_out_products: 0,
    archived_products: 0,
    course_stats: {},
  });

  const [categories, setCategories] = useState([]);
  const [categoryError, setCategoryError] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const loadDashboard = useCallback(
    async (showRefresh = false) => {
      const token = localStorage.getItem("token");

      if (!token) {
        navigate("/login", { replace: true });
        return;
      }

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");
      setCategoryError("");

      try {
        const headers = {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        };

        const [statsResponse, categoriesResponse] = await Promise.all([
          fetch(`${API_URL}/admin/stats`, { headers }),
          fetch(`${API_URL}/admin/categories`, { headers }),
        ]);

        if (
          statsResponse.status === 401 ||
          statsResponse.status === 403 ||
          categoriesResponse.status === 401 ||
          categoriesResponse.status === 403
        ) {
          localStorage.removeItem("token");
          localStorage.removeItem("role");
          localStorage.removeItem("user");

          navigate("/login", { replace: true });
          return;
        }

        let statsErrorMessage = "";

        if (!statsResponse.ok) {
          try {
            const data = await statsResponse.json();
            statsErrorMessage =
              data.message || "Unable to load marketplace overview.";
          } catch {
            statsErrorMessage = "Unable to load marketplace overview.";
          }
        }

        const categoriesJson = await categoriesResponse
          .json()
          .catch(() => ({}));

        if (!categoriesResponse.ok) {
          setCategoryError(
            categoriesJson.message ||
              "Category chart data could not be loaded."
          );
        } else {
          setCategories(
            Array.isArray(categoriesJson.categories)
              ? categoriesJson.categories
              : []
          );
        }

        if (statsErrorMessage) {
          setError(statsErrorMessage);
          return;
        }

        const statsJson = await statsResponse.json();
        const incoming = statsJson.stats || statsJson;

        setStats({
          total_users: toNumber(incoming.total_users),
          total_students: toNumber(incoming.total_students),
          total_admins: toNumber(incoming.total_admins),
          total_staff: toNumber(incoming.total_staff),
          total_products: toNumber(incoming.total_products),
          pending_products: toNumber(incoming.pending_products),
          approved_products: toNumber(
            incoming.approved_products ?? incoming.active_products
          ),
          active_products: toNumber(
            incoming.active_products ?? incoming.approved_products
          ),
          rejected_products: toNumber(incoming.rejected_products),
          inactive_products: toNumber(incoming.inactive_products),
          sold_out_products: toNumber(incoming.sold_out_products),
          archived_products: toNumber(incoming.archived_products),
          course_stats: incoming.course_stats || {},
        });

        setLastUpdatedAt(Date.now());
      } catch (err) {
        console.error("Marketplace overview error:", err);
        setError("We couldn't load the dashboard. Please try again.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [navigate]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDashboard();
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [loadDashboard]);

  const statusData = useMemo(
    () =>
      STATUS_ROWS.map((row) => ({
        ...row,
        value: toNumber(stats[row.key]),
      })),
    [stats]
  );

  const activeCount = statusData.find(
    (item) => item.key === "active_products"
  ).value;
  const pendingCount = statusData.find(
    (item) => item.key === "pending_products"
  ).value;
  const rejectedCount = statusData.find(
    (item) => item.key === "rejected_products"
  ).value;
  const reviewedProducts = activeCount + rejectedCount;
  const approvalRate =
    reviewedProducts > 0
      ? Math.round((activeCount / reviewedProducts) * 100)
      : 0;
  const productStatusTotal = statusData.reduce(
    (sum, item) => sum + item.value,
    0
  );

  const programMetrics = useMemo(
    () =>
      PROGRAMS.map(([code, title]) => ({
        code,
        title,
        count: toNumber(stats.course_stats?.[code]),
      })),
    [stats.course_stats]
  );
  const programMaximum = Math.max(
    1,
    ...programMetrics.map((item) => item.count)
  );

  const categoryMetrics = useMemo(() => {
    const rows = categories.map((category) => ({
      code: category.id,
      label: category.name,
      value: toNumber(category.products_count),
    }));

    return rows
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [categories]);
  const categoryTotal = useMemo(
    () =>
      categories.reduce(
        (sum, category) => sum + toNumber(category.products_count),
        0
      ),
    [categories]
  );
  const categoryMaximum = Math.max(
    1,
    ...categoryMetrics.map((item) => item.value)
  );

  const hasProgramData = programMetrics.some(
    (item) => item.count > 0
  );
  const hasStatusData = productStatusTotal > 0;
  const hasCategoryData = categoryMetrics.length > 0;

  const dataStatusText = loading
    ? "Loading marketplace data"
    : refreshing
      ? "Updating marketplace data"
      : error
        ? "Update failed"
        : getLastUpdatedLabel(lastUpdatedAt);

  return (
    <AdminLayout
      title="Marketplace Overview"
      subtitle="Monitor accounts, listings, approvals, and moderation status."
    >
      <div className="dashboard-page">
        <section className="dashboard-hero">
          <div className="dashboard-hero-content">
            <div className="dashboard-hero-icon">
              <Activity size={25} strokeWidth={2} aria-hidden="true" />
            </div>

            <div>
              <span className="dashboard-eyebrow">
                MARKETPLACE OVERVIEW
              </span>

              <h2>Welcome back, Administrator</h2>

              <p>
                Review account activity, marketplace listings, and moderation
                status from one professional workspace.
              </p>
            </div>
          </div>

          <div className="dashboard-hero-status">
            <span className="dashboard-status-dot" />
            <span>{dataStatusText}</span>
          </div>

          <button
            type="button"
            className="dashboard-refresh-button"
            onClick={() => {
              if (!refreshing) {
                loadDashboard(true);
              }
            }}
            disabled={refreshing || loading}
          >
            <RefreshCw
              size={16}
              className={refreshing ? "dashboard-refresh-spin" : ""}
              aria-hidden="true"
            />
            {refreshing ? "Updating..." : "Refresh Data"}
          </button>
        </section>

        {error ? (
          <div
            className="dashboard-error"
            role="alert"
          >
            <div className="dashboard-error-content">
              <XCircle size={20} aria-hidden="true" />

              <div>
                <strong>
                  Unable to load marketplace overview
                </strong>

                <span>{error}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => loadDashboard(true)}
            >
              Try Again
            </button>
          </div>
        ) : null}

        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div>
              <span>ACCOUNT AND LISTING SUMMARY</span>
              <h2>Marketplace Statistics</h2>
              <p>
                Real totals returned by the Laravel administrator API.
              </p>
            </div>
          </div>

          <div className="dashboard-card-grid">
            {loading ? (
              <DashboardSkeleton />
            ) : (
              SUMMARY_CARDS.map((card) => {
                const Icon = card.icon;
                const ButtonTag = card.to ? "button" : "div";

                return (
                  <ButtonTag
                    className={`dashboard-stat-card tone-${card.tone}`}
                    key={card.key}
                    type={card.to ? "button" : undefined}
                    onClick={
                      card.to
                        ? () => navigate(card.to)
                        : undefined
                    }
                    aria-label={
                      card.to
                        ? `${card.title}: ${formatValue(stats[card.key])}`
                        : undefined
                    }
                  >
                    <div className="dashboard-stat-card-top">
                      <div className="dashboard-stat-icon">
                        <Icon size={21} strokeWidth={2.2} aria-hidden="true" />
                      </div>

                      {card.to ? (
                        <ArrowRight
                          className="dashboard-stat-arrow"
                          size={17}
                          aria-hidden="true"
                        />
                      ) : null}
                    </div>

                    <strong className="dashboard-stat-value">
                      {formatValue(stats[card.key])}
                    </strong>

                    <span className="dashboard-stat-title">
                      {card.title}
                    </span>

                    <span className="dashboard-stat-description">
                      {card.description}
                    </span>
                  </ButtonTag>
                );
              })
            )}
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div>
              <span>MARKETPLACE ANALYTICS</span>
              <h2>Marketplace Analytics</h2>
              <p>
                Charts use actual marketplace records. No estimated trends are
                included.
              </p>
            </div>
          </div>

          <div className="dashboard-analytics-grid">
            <article className="dashboard-chart-card">
              <div className="dashboard-chart-header">
                <div>
                  <h3>Product Approval Status</h3>
                  <p>Current listing counts grouped by moderation status.</p>
                </div>
                <span className="dashboard-chart-total">
                  {formatValue(productStatusTotal)} total
                </span>
              </div>

              {loading ? (
                <ChartSkeleton />
              ) : hasStatusData ? (
                <>
                  <div
                    className="dashboard-chart-block"
                    role="img"
                    aria-label="Bar chart of product approval status"
                  >
                    {statusData.map((item) => (
                      <ChartRow
                        key={item.key}
                        label={item.label}
                        value={item.value}
                        max={productStatusTotal}
                        tone={item.tone}
                        hint={`${percentOf(item.value, productStatusTotal)}% of listings`}
                      />
                    ))}
                  </div>

                  <div className="dashboard-mini-stat-row">
                    <div>
                      <span>Reviewed listings</span>
                      <strong>{formatValue(reviewedProducts)}</strong>
                    </div>

                    <div>
                      <span>Approval rate</span>
                      <strong>{approvalRate}%</strong>
                    </div>

                    <div>
                      <span>Pending share</span>
                      <strong>{percentOf(pendingCount, productStatusTotal)}%</strong>
                    </div>
                  </div>
                </>
              ) : (
                <EmptyChartState
                  title="No product status data"
                  text="Approved, pending, rejected, and inactive listings will appear here."
                />
              )}
            </article>

            <article className="dashboard-chart-card">
              <div className="dashboard-chart-header">
                <div>
                  <h3>Student Accounts by Program</h3>
                  <p>Registered student accounts grouped by academic program.</p>
                </div>
                <span className="dashboard-chart-total">
                  {formatValue(stats.total_students)} students
                </span>
              </div>

              {loading ? (
                <ChartSkeleton />
              ) : hasProgramData ? (
                <div
                  className="dashboard-chart-block"
                  role="img"
                  aria-label="Bar chart of student accounts by program"
                >
                  {programMetrics.map((item) => (
                    <ChartRow
                      key={item.code}
                      label={item.code}
                      value={item.count}
                      max={programMaximum}
                      tone="blue"
                      hint={item.title}
                    />
                  ))}
                </div>
              ) : (
                <EmptyChartState
                  title="No program data"
                  text="Student account records by program will appear here."
                />
              )}
            </article>

            <article className="dashboard-chart-card">
              <div className="dashboard-chart-header">
                <div>
                  <h3>Marketplace Listings by Category</h3>
                  <p>Current product counts for each category.</p>
                </div>
                <span className="dashboard-chart-total">
                  {formatValue(categoryTotal)} listed
                </span>
              </div>

              {loading ? (
                <ChartSkeleton />
              ) : categoryError ? (
                <EmptyChartState
                  title="Category chart unavailable"
                  text={categoryError}
                />
              ) : hasCategoryData ? (
                <div
                  className="dashboard-chart-block"
                  role="img"
                  aria-label="Bar chart of marketplace listings by category"
                >
                  {categoryMetrics.map((item) => (
                    <ChartRow
                      key={item.code}
                      label={item.label}
                      value={item.value}
                      max={categoryMaximum}
                      tone="teal"
                      hint={`${percentOf(item.value, categoryTotal)}% of category listings`}
                    />
                  ))}
                </div>
              ) : (
                <EmptyChartState
                  title="No category listings"
                  text="Categories with products will appear here."
                />
              )}
            </article>
          </div>

          <div className="dashboard-note">
            <Activity size={18} aria-hidden="true" />
            <p>
              Trend charts require timestamped historical backend data, which is
              not currently available to this admin endpoint. Only actual
              available counts are shown above; the existing staff insights API is
              documented separately if historical trends are approved later.
            </p>
          </div>
        </section>

        <section className="dashboard-bottom-grid">
          <article className="dashboard-panel">
            <div className="dashboard-panel-header">
              <div>
                <span>MARKETPLACE</span>
                <h2>Pending Approvals</h2>
                <p>Products that require administrator action.</p>
              </div>

              <div className="dashboard-panel-icon">
                <Clock3 size={20} aria-hidden="true" />
              </div>
            </div>

            <div className="dashboard-approval-summary">
              <strong>{formatValue(stats.pending_products)}</strong>
              <span>Listings awaiting review</span>
              <p>
                Use Product Management to review, approve, or reject submitted
                listings.
              </p>
            </div>

            <button
              type="button"
              className="dashboard-primary-action"
              onClick={() => navigate("/admin/products")}
            >
              <Package size={17} aria-hidden="true" />
              Open Product Management
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </article>

          <article className="dashboard-panel">
            <div className="dashboard-panel-header">
              <div>
                <span>SYSTEM</span>
                <h2>Administration</h2>
                <p>Core marketplace administration status.</p>
              </div>

              <div className="dashboard-panel-icon">
                <ShieldCheck size={20} aria-hidden="true" />
              </div>
            </div>

            <div className="dashboard-system-status">
              <div className="dashboard-online-indicator">
                <span />
                API connected
              </div>

              <p>
                TMC StudentMart is connected to the Laravel backend and is
                showing authorized administrative data.
              </p>
            </div>

            <div className="dashboard-mini-stats">
              <div>
                <span>Accounts</span>
                <strong>{formatValue(stats.total_users)}</strong>
              </div>

              <div>
                <span>Students</span>
                <strong>{formatValue(stats.total_students)}</strong>
              </div>

              <div>
                <span>Listings</span>
                <strong>{formatValue(stats.total_products)}</strong>
              </div>
            </div>

            <div className="dashboard-quick-actions">
              <button
                type="button"
                onClick={() => navigate("/admin/users")}
              >
                <Users size={17} aria-hidden="true" />
                <span>Manage Users</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => navigate("/admin/staff")}
              >
                <UserPlus size={17} aria-hidden="true" />
                <span>Manage Staff</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </article>
        </section>

        <div className="dashboard-footer">
          <div>
            <Activity size={15} aria-hidden="true" />
            <span>TMC StudentMart Administration</span>
          </div>

          <span>{dataStatusText}</span>
        </div>
      </div>
    </AdminLayout>
  );
}
