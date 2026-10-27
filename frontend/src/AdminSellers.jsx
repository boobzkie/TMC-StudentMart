import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Search,
  Store,
  Package,
  CheckCircle2,
  Clock3,
  XCircle,
  Mail,
  GraduationCap,
  AlertCircle,
} from "lucide-react";

import AdminLayout from "./components/AdminLayout";
import AdminPageHero from "./components/AdminPageHero";
import { API_URL, SERVER_URL } from "./utils/api";

import "./AdminSellers.css";


export default function AdminSellers() {
  const navigate = useNavigate();

  const [sellers, setSellers] = useState([]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const sellersRequestSequenceRef = useRef(0);

  const loadSellers = useCallback(
    async (showRefresh = false, signal) => {
      if (signal?.aborted) return;
      const requestSequence = ++sellersRequestSequenceRef.current;
      try {
        if (showRefresh && !signal) {
          setRefreshing(true);
        } else if (!showRefresh) {
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

        const params = new URLSearchParams();

        if (search.trim()) {
          params.append(
            "search",
            search.trim()
          );
        }

        if (status) {
          params.append(
            "status",
            status
          );
        }

        const query = params.toString();

        const response = await fetch(
          `${API_URL}/admin/sellers${
            query ? `?${query}` : ""
          }`,
          {
            method: "GET",
            ...(signal ? { signal } : {}),

            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (signal?.aborted || requestSequence !== sellersRequestSequenceRef.current) return;

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
        if (signal?.aborted || requestSequence !== sellersRequestSequenceRef.current) return;

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Unable to load sellers."
          );
        }

        setSellers(
          Array.isArray(data.sellers)
            ? data.sellers
            : []
        );
      } catch (err) {
        if (signal?.aborted || err?.name === "AbortError" || requestSequence !== sellersRequestSequenceRef.current) return;
        console.error(
          "Seller loading error:",
          err
        );

        setError(
          err.message ||
            "Unable to load sellers. Please try again."
        );
      } finally {
        if (!signal?.aborted && requestSequence === sellersRequestSequenceRef.current) {
          setLoading(false);
          if (!signal) setRefreshing(false);
        }
      }
    },
    [navigate, search, status]
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      loadSellers(false, controller.signal);
    }, 0);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [loadSellers]);

  const handleSearch = (event) => {
    event.preventDefault();

    loadSellers(true);
  };

  const statistics = useMemo(() => {
    return sellers.reduce(
      (result, seller) => {
        result.total += 1;

        if (String(seller.status || "").toLowerCase() === "active") {
          result.activeSellers += 1;
        }

        result.products += Number(
          seller.total_products || 0
        );

        result.active += Number(
          seller.active_products || 0
        );

        result.pending += Number(
          seller.pending_products || 0
        );

        result.rejected += Number(
          seller.rejected_products || 0
        );

        result.inactive += Number(
          seller.inactive_products || 0
        );

        result.other += Math.max(
          0,
          Number(seller.total_products || 0)
            - Number(seller.active_products || 0)
            - Number(seller.pending_products || 0)
            - Number(seller.rejected_products || 0)
            - Number(seller.inactive_products || 0)
        );

        return result;
      },
      {
        total: 0,
        activeSellers: 0,
        products: 0,
        active: 0,
        pending: 0,
        rejected: 0,
        inactive: 0,
        other: 0,
      }
    );
  }, [sellers]);

  const sellerGrowth = useMemo(() => {
    const today = new Date();
    const firstMonth = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    return Array.from({ length: 6 }, (_, index) => {
      const month = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + index, 1);
      const count = sellers.filter((seller) => {
        const joined = new Date(seller.created_at);
        return !Number.isNaN(joined.getTime())
          && joined.getFullYear() === month.getFullYear()
          && joined.getMonth() === month.getMonth();
      }).length;
      return {
        key: `${month.getFullYear()}-${month.getMonth()}`,
        label: month.toLocaleDateString(undefined, { month: "short" }),
        count,
      };
    });
  }, [sellers]);

  const sellerGrowthMax = Math.max(1, ...sellerGrowth.map((month) => month.count));
  const listingDistribution = [
    { label: "Active", value: statistics.active, tone: "active" },
    { label: "Pending", value: statistics.pending, tone: "pending" },
    { label: "Rejected", value: statistics.rejected, tone: "rejected" },
    { label: "Inactive", value: statistics.inactive, tone: "inactive" },
    { label: "Other statuses", value: statistics.other, tone: "other" },
  ];
  const listingTotal = listingDistribution.reduce((total, item) => total + item.value, 0);

  const getInitial = (name) => {
    const value = String(
      name || "S"
    ).trim();

    return (
      value.charAt(0).toUpperCase() ||
      "S"
    );
  };

  const getStatusClass = (value) => {
    return String(
      value || "unknown"
    ).toLowerCase();
  };

  const getStatusLabel = (value) => {
    const statusValue = String(
      value || "unknown"
    ).toLowerCase();

    return (
      statusValue.charAt(0).toUpperCase() +
      statusValue.slice(1)
    );
  };

  return (
    <AdminLayout
      title="Sellers"
      subtitle="Manage students who are actively selling products on TMC StudentMart."
    >
      <div className="sellers-page">

        <AdminPageHero
          title="Seller Management"
          description="View student sellers, monitor their product activity, and check marketplace status."
          icon={Store}
          onRefresh={(signal) => loadSellers(true, signal)}
          refreshing={refreshing}
          autoRefreshIntervalMs={120_000}
          autoRefreshKey={`${search}|${status}`}
          autoRefreshPaused={searchFocused}
        />

        {/* =====================================================
            ERROR
        ===================================================== */}

        {error && (
          <div className="sellers-error">

            <div>
              <AlertCircle size={19} />

              <span>
                {error}
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                loadSellers(true)
              }
            >
              Try Again
            </button>

          </div>
        )}

        {/* =====================================================
            STATISTICS
        ===================================================== */}

        <section className="sellers-stat-grid">

          <div className="seller-stat-card">

            <div className="seller-stat-icon blue">
              <Store size={20} />
            </div>

            <div>
              <span>
                Accounts
              </span>

              <strong>
                {statistics.total}
              </strong>
            </div>

          </div>

          <div className="seller-stat-card">

            <div className="seller-stat-icon purple">
              <Package size={20} />
            </div>

            <div>
              <span>
                Total Products
              </span>

              <strong>
                {statistics.products}
              </strong>
            </div>

          </div>

          <div className="seller-stat-card">
            <div className="seller-stat-icon green"><CheckCircle2 size={20} aria-hidden="true" /></div>
            <div><span>Active Sellers</span><strong>{statistics.activeSellers}</strong></div>
          </div>

          <div className="seller-stat-card">
            <div className="seller-stat-icon orange"><Clock3 size={20} aria-hidden="true" /></div>
            <div><span>Pending Listings</span><strong>{statistics.pending}</strong></div>
          </div>

        </section>

        <section className="sellers-insights-grid" aria-label="Seller growth and listing status">
          <article className="sellers-insight-card sellers-growth-card">
            <div className="sellers-insight-heading">
              <span className="sellers-insight-icon"><Store size={18} aria-hidden="true" /></span>
              <div><h2>Seller Growth</h2><p>Seller accounts joined over the last 6 months</p></div>
            </div>
            <div className="sellers-growth-chart" role="img" aria-label={`Seller accounts joined by month: ${sellerGrowth.map((month) => `${month.label}: ${month.count}`).join(", ")}`}>
              {sellerGrowth.map((month) => (
                <div className="sellers-growth-month" key={month.key}>
                  <strong>{month.count}</strong>
                  <div className="sellers-growth-track"><span style={{ height: `${month.count ? Math.max(8, (month.count / sellerGrowthMax) * 100) : 0}%` }} /></div>
                  <small>{month.label}</small>
                </div>
              ))}
            </div>
            <p className="sellers-chart-note">Based on the current seller results.</p>
          </article>

          <article className="sellers-insight-card sellers-distribution-card">
            <div className="sellers-insight-heading">
              <span className="sellers-insight-icon"><Package size={18} aria-hidden="true" /></span>
              <div><h2>Listing Status Distribution</h2><p>Current listing totals for these sellers</p></div>
            </div>
            <div className="sellers-distribution-list">
              {listingDistribution.map((item) => (
                <div className="sellers-distribution-row" key={item.label}>
                  <span>{item.label}</span>
                  <div className="sellers-distribution-track" aria-hidden="true"><span className={item.tone} style={{ width: `${listingTotal ? (item.value / listingTotal) * 100 : 0}%` }} /></div>
                  <strong>{item.value}</strong>
                  <small>{listingTotal ? Math.round((item.value / listingTotal) * 100) : 0}%</small>
                </div>
              ))}
            </div>
          </article>
        </section>

        {/* =====================================================
            FILTERS
        ===================================================== */}

        <section className="sellers-filter-card">

          <form
            className="sellers-search-form"
            onSubmit={handleSearch}
          >

            <div className="sellers-search-box">

              <Search size={18} />

              <input
                type="text"
                value={search}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search seller name, student ID, or email..."
                aria-label="Search sellers"
              />

            </div>

            <button
              type="submit"
              className="sellers-search-button"
            >
              Search
            </button>

          </form>

          <div className="sellers-status-filter">

            <label htmlFor="seller-status">
              Account Status
            </label>

            <select
              id="seller-status"
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target.value
                )
              }
            >
              <option value="">
                All Statuses
              </option>

              <option value="active">
                Active
              </option>

              <option value="suspended">
                Suspended
              </option>
            </select>

          </div>

        </section>

        {/* =====================================================
            SELLER CONTENT
        ===================================================== */}

        <section className="sellers-content-card">

          <div className="sellers-content-header">

            <div>

              <span>
                SELLER DIRECTORY
              </span>

              <h3>
                Student Sellers
              </h3>

            </div>

            <div className="sellers-count">
              {sellers.length}{" "}
              {sellers.length === 1
                ? "seller"
                : "sellers"}
            </div>

          </div>

          {/* ===================================================
              LOADING
          =================================================== */}

          {loading && (
            <div className="sellers-loading">

              {[1, 2, 3, 4].map(
                (item) => (
                  <div
                    key={item}
                    className="seller-skeleton"
                  >
                    <div className="seller-skeleton-avatar" />

                    <div className="seller-skeleton-lines">

                      <span />
                      <span />
                      <span />

                    </div>

                    <div className="seller-skeleton-stat" />
                    <div className="seller-skeleton-stat" />

                  </div>
                )
              )}

            </div>
          )}

          {/* ===================================================
              EMPTY
          =================================================== */}

          {!loading &&
            !error &&
            sellers.length === 0 && (
              <div className="sellers-empty">

                <div className="sellers-empty-icon">
                  <Store size={34} />
                </div>

                <h3>
                  No sellers found
                </h3>

                <p>
                  No student sellers match
                  your current search or
                  filter.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setStatus("");
                  }}
                >
                  Clear Filters
                </button>

              </div>
            )}

          {/* ===================================================
              SELLER LIST
          =================================================== */}

          {!loading &&
            !error &&
            sellers.length > 0 && (
              <div className="sellers-list">

                {sellers.map(
                  (seller) => (
                    <article
                      className="seller-card"
                      key={seller.id}
                    >

                      {/* SELLER PROFILE */}

                      <div className="seller-profile">

                        <div className="seller-avatar">

                          {seller.profile_picture ? (
                            <img
                              src={
                                seller.profile_picture.startsWith(
                                  "http"
                                )
                                  ? seller.profile_picture
                                  : `${SERVER_URL.replace(/\/+$/, "")}/storage/${seller.profile_picture}`
                              }
                              alt={
                                seller.name ||
                                "Seller"
                              }
                              onError={(
                                event
                              ) => {
                                event.currentTarget.style.display =
                                  "none";
                              }}
                            />
                          ) : (
                            getInitial(
                              seller.name
                            )
                          )}

                        </div>

                        <div className="seller-profile-info">

                          <h4>
                            {seller.name ||
                              "Unknown Seller"}
                          </h4>

                          <span>
                            <GraduationCap
                              size={13}
                            />

                            {seller.student_id ||
                              "No Student ID"}
                          </span>

                          <span>
                            <Mail
                              size={13}
                            />

                            {seller.email ||
                              "No email"}
                          </span>

                        </div>

                      </div>

                      {/* ACCOUNT STATUS */}

                      <div className="seller-account-status">

                        <span>
                          ACCOUNT
                        </span>

                        <strong
                          className={`seller-status ${getStatusClass(
                            seller.status
                          )}`}
                        >
                          {seller.status ===
                            "active" && (
                            <CheckCircle2
                              size={13}
                            />
                          )}

                          {seller.status ===
                            "suspended" && (
                            <XCircle
                              size={13}
                            />
                          )}

                          {getStatusLabel(
                            seller.status
                          )}
                        </strong>

                      </div>

                      {/* PRODUCT TOTAL */}

                      <div className="seller-product-total">

                        <span>
                          TOTAL PRODUCTS
                        </span>

                        <strong>
                          {seller.total_products ||
                            0}
                        </strong>

                      </div>

                      {/* PRODUCT STATUS */}

                      <div className="seller-product-stats">

                        <div className="seller-product-stat active">

                          <CheckCircle2
                            size={15}
                          />

                          <div>
                            <strong>
                              {seller.active_products ||
                                0}
                            </strong>

                            <span>
                              Active
                            </span>
                          </div>

                        </div>

                        <div className="seller-product-stat pending">

                          <Clock3
                            size={15}
                          />

                          <div>
                            <strong>
                              {seller.pending_products ||
                                0}
                            </strong>

                            <span>
                              Pending
                            </span>
                          </div>

                        </div>

                        <div className="seller-product-stat rejected">

                          <XCircle
                            size={15}
                          />

                          <div>
                            <strong>
                              {seller.rejected_products ||
                                0}
                            </strong>

                            <span>
                              Rejected
                            </span>
                          </div>

                        </div>

                      </div>

                    </article>
                  )
                )}

              </div>
            )}

        </section>

      </div>
    </AdminLayout>
  );
}
