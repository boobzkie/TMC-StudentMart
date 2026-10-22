/* oxlint-disable react(set-state-in-effect), react-hooks(exhaustive-deps) */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  RefreshCw,
  Package,
  Trash2,
  Check,
  X,
  Clock3,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";

import AdminLayout from "./components/AdminLayout";
import AdminPageHero from "./components/AdminPageHero";
import { SortableHead } from "./ui/Table";
import { API_URL, SERVER_URL, sortRows } from "./utils/api";

import "./AdminProducts.css";


export default function AdminProducts() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [sort, setSort] = useState({ key: "created_at", direction: "desc" });

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const [actionLoading, setActionLoading] =
    useState(null);

  const toggleSort = (key) => setSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
  const sortedProducts = sortRows(products, sort, (product, key) => ({
    name: product.name,
    seller: product.seller?.name || product.seller_name || product.user?.name,
    category: product.category?.name || product.category_name || product.category,
    price: Number.parseFloat(String(product.price ?? "").replace(/[^0-9.-]/g, "")),
    quantity: Number(product.quantity),
    status: product.status,
    created_at: product.created_at,
  })[key]);

  const loadProducts = async (
    showRefresh = false
  ) => {
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

      const params = new URLSearchParams();

      if (search.trim()) {
        params.append(
          "search",
          search.trim()
        );
      }

      if (status) {
        params.append("status", status);
      }

      const query =
        params.toString();

      const response = await fetch(
        `${API_URL}/admin/products${
          query ? `?${query}` : ""
        }`,
        {
          headers: {
            Accept: "application/json",
            Authorization:
              `Bearer ${token}`,
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

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to load products."
        );
      }

      setProducts(
        Array.isArray(data.products)
          ? data.products
          : []
      );
    } catch (err) {
      console.error(err);

      setError(
        "We couldn't load the products. Please try again."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // This effect intentionally performs the initial API bootstrap once.
  // The loader is also used by manual refresh/actions.
  // oxlint-disable react(set-state-in-effect), react-hooks(exhaustive-deps)
  useEffect(() => {
  // This effect intentionally performs the initial API bootstrap.
  // It must run once when the Admin Products page opens.
  // oxlint-disable-next-line react(set-state-in-effect)
  loadProducts();
  // oxlint-disable-next-line react-hooks/exhaustive-deps
}, []);
  // oxlint-enable react(set-state-in-effect), react-hooks(exhaustive-deps)

  const handleSearch = (event) => {
    event.preventDefault();

    loadProducts();
  };

  const handleApprove = async (
    productId
  ) => {
    const confirmed =
      window.confirm(
        "Approve this product and make it visible in the student marketplace?"
      );

    if (!confirmed) return;

    try {
      setActionLoading(
        `approve-${productId}`
      );

      const token =
        localStorage.getItem("token");

      const response = await fetch(
        `${API_URL}/admin/products/${productId}/approve`,
        {
          method: "PUT",
          headers: {
            Accept: "application/json",
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      const data =
        await response.json();

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        localStorage.clear();

        navigate("/login", {
          replace: true,
        });

        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to approve product."
        );
      }

      await loadProducts(true);
    } catch (err) {
      console.error(err);
      alert(
        err.message ||
          "Unable to approve product."
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (
    productId
  ) => {
    const confirmed =
      window.confirm(
        "Reject this product?"
      );

    if (!confirmed) return;

    try {
      setActionLoading(
        `reject-${productId}`
      );

      const token =
        localStorage.getItem("token");

      const response = await fetch(
        `${API_URL}/admin/products/${productId}/reject`,
        {
          method: "PUT",
          headers: {
            Accept: "application/json",
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      const data =
        await response.json();

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        localStorage.clear();

        navigate("/login", {
          replace: true,
        });

        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to reject product."
        );
      }

      await loadProducts(true);
    } catch (err) {
      console.error(err);

      alert(
        err.message ||
          "Unable to reject product."
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (
    productId
  ) => {
    const confirmed =
      window.confirm(
        "Archive this product? It will leave the marketplace, and its order and history records will be preserved."
      );

    if (!confirmed) return;

    try {
      setActionLoading(
        `delete-${productId}`
      );

      const token =
        localStorage.getItem("token");

      const response = await fetch(
        `${API_URL}/admin/products/${productId}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      const data =
        await response.json();

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        localStorage.clear();

        navigate("/login", {
          replace: true,
        });

        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to archive product."
        );
      }

      await loadProducts(true);
    } catch (err) {
      console.error(err);

      alert(
        err.message ||
          "Unable to archive product."
      );
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusClass = (value) => {
    const normalized =
      String(value || "")
        .toLowerCase();

    if (
      normalized === "active" ||
      normalized === "approved"
    ) {
      return "status-active";
    }

    if (normalized === "pending") {
      return "status-pending";
    }

    if (normalized === "rejected") {
      return "status-rejected";
    }

    if (normalized === "sold_out") {
      return "status-sold-out";
    }

    if (normalized === "archived") {
      return "status-archived";
    }

    if (normalized === "suspended") {
      return "status-suspended";
    }

    return "status-inactive";
  };

  const getStatusIcon = (value) => {
    const normalized =
      String(value || "")
        .toLowerCase();

    if (
      normalized === "active" ||
      normalized === "approved"
    ) {
      return <CheckCircle2 size={14} />;
    }

    if (normalized === "pending") {
      return <Clock3 size={14} />;
    }

    if (normalized === "rejected") {
      return <XCircle size={14} />;
    }

    return <AlertCircle size={14} />;
  };

  const formatDate = (date) => {
    if (!date) return "—";

    return new Date(
      date
    ).toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
      }
    );
  };

  const formatPrice = (price) => {
    const amount =
      Number(price || 0);

    return `₱${amount.toLocaleString(
      "en-PH",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;
  };

  const getImageUrl = (image) => {
    if (!image) return null;

    if (
      image.startsWith("http://") ||
      image.startsWith("https://")
    ) {
      return image;
    }

    return `${SERVER_URL.replace(/\/+$/, "")}/storage/${image.replace(
      /^\/?storage\//,
      ""
    )}`;
  };

  return (
    <AdminLayout
      title="Product Management"
      subtitle="Review and manage products submitted by students."
    >

      {/* TOOLBAR */}
      <div className="products-toolbar">

        <form
          className="products-search"
          onSubmit={handleSearch}
        >
          <Search size={18} />

          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search product..."
          />

        </form>

        <select
          className="products-filter"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
          }}
        >
          <option value="">
            All Status
          </option>

          <option value="pending">
            Pending
          </option>

          <option value="active">
            Available
          </option>

          <option value="rejected">
            Rejected
          </option>

          <option value="inactive">
            Inactive
          </option>

          <option value="sold_out">
            Sold Out
          </option>

          <option value="archived">
            Archived
          </option>
        </select>

        <button
          type="button"
          className="products-search-button"
          onClick={() =>
            loadProducts()
          }
        >
          <Search size={16} />
          Search
        </button>

      </div>

      <AdminPageHero
        title="Product Management"
        description="Review marketplace listings, manage product information, and maintain accurate inventory records."
        icon={Package}
        onRefresh={() => loadProducts(true)}
        refreshing={refreshing}
        meta={`${products.length} products found`}
      />

      {/* ERROR */}
      {error && (
        <div className="products-error">
          <AlertCircle size={18} />

          <span>{error}</span>

          <button
            type="button"
            onClick={() =>
              loadProducts(true)
            }
          >
            Try Again
          </button>
        </div>
      )}

      {/* TABLE */}
      <div className="products-table-card">

        {loading ? (
          <div className="products-loading">

            {[1, 2, 3, 4].map(
              (item) => (
                <div
                  className="product-skeleton"
                  key={item}
                />
              )
            )}

          </div>
        ) : products.length === 0 ? (
          <div className="products-empty">

            <div className="products-empty-icon">
              <Package size={28} />
            </div>

            <h3>
              No products found
            </h3>

            <p>
              There are no products matching
              your current search or filter.
            </p>

          </div>
        ) : (
          <div className="products-table-wrapper">

            <table className="products-table">

              <thead>
                <tr>
                  <SortableHead field="name" sort={sort} onSort={toggleSort}>PRODUCT</SortableHead>
                  <SortableHead field="seller" sort={sort} onSort={toggleSort}>SELLER</SortableHead>
                  <SortableHead field="category" sort={sort} onSort={toggleSort}>CATEGORY</SortableHead>
                  <SortableHead field="price" sort={sort} onSort={toggleSort}>PRICE</SortableHead>
                  <SortableHead field="quantity" sort={sort} onSort={toggleSort}>QUANTITY</SortableHead>
                  <SortableHead field="status" sort={sort} onSort={toggleSort}>STATUS</SortableHead>
                  <SortableHead field="created_at" sort={sort} onSort={toggleSort}>DATE</SortableHead>
                  <th>ACTIONS</th>
                </tr>
              </thead>

              <tbody>

                {sortedProducts.map(
                  (product) => {
                    const imageUrl =
                      getImageUrl(
                        product.image
                      );

                    const productStatus =
                      String(
                        product.status ||
                          ""
                      ).toLowerCase();

                    return (
                      <tr
                        key={
                          product.id
                        }
                      >

                        {/* PRODUCT */}
                        <td>

                          <div className="product-cell">

                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={
                                  product.name
                                }
                                className="product-image"
                              />
                            ) : (
                              <div className="product-image-placeholder">
                                <Package
                                  size={20}
                                />
                              </div>
                            )}

                            <div className="product-information">

                              <strong>
                                {
                                  product.name
                                }
                              </strong>

                              <span>
                                #
                                {
                                  product.id
                                }
                              </span>

                            </div>

                          </div>

                        </td>

                        {/* SELLER */}
                        <td>

                          <div className="seller-cell">

                            <strong>
                              {
                                product
                                  .user
                                  ?.name ||
                                "Unknown Student"
                              }
                            </strong>

                            <span>
                              {
                                product
                                  .user
                                  ?.student_id ||
                                "—"
                              }
                            </span>

                          </div>

                        </td>

                        {/* CATEGORY */}
                        <td>
                          <span className="category-badge">
                            {
                              product.category ||
                              "Other"
                            }
                          </span>
                        </td>

                        {/* PRICE */}
                        <td>
                          <strong className="product-price">
                            {formatPrice(
                              product.price
                            )}
                          </strong>
                        </td>

                        {/* QUANTITY */}
                        <td>
                          <span className="product-quantity">
                            {Number(
                              product?.stock_quantity ?? 0
                            )}
                          </span>
                        </td>

                        {/* STATUS */}
                        <td>

                          <span
                            className={`product-status ${getStatusClass(
                              productStatus
                            )}`}
                          >
                            {getStatusIcon(
                              productStatus
                            )}

                            {productStatus ===
                            "active"
                              ? "AVAILABLE"
                              : productStatus ===
                                "archived"
                              ? "ARCHIVED"
                              : productStatus ===
                                "sold_out"
                              ? "SOLD OUT"
                              : productStatus ===
                                "pending"
                              ? "PENDING"
                              : productStatus ===
                                "rejected"
                              ? "REJECTED"
                              : productStatus ===
                                "inactive"
                              ? "INACTIVE"
                              : productStatus ===
                                "suspended"
                              ? "SUSPENDED"
                              : (productStatus ||
                                "unknown").toUpperCase()}
                          </span>

                        </td>

                        {/* DATE */}
                        <td>
                          <span className="product-date">
                            {formatDate(
                              product.created_at
                            )}
                          </span>
                        </td>

                        {/* ACTIONS */}
                        <td>

                          <div className="product-actions">

                            {productStatus ===
                              "pending" && (
                              <>
                                <button
                                  type="button"
                                  className="action-button approve"
                                  title="Approve product"
                                  disabled={
                                    actionLoading !==
                                      null
                                  }
                                  onClick={() =>
                                    handleApprove(
                                      product.id
                                    )
                                  }
                                >
                                  {actionLoading ===
                                  `approve-${product.id}` ? (
                                    <RefreshCw
                                      size={15}
                                      className="products-spin"
                                    />
                                  ) : (
                                    <Check
                                      size={15}
                                    />
                                  )}
                                </button>

                                <button
                                  type="button"
                                  className="action-button reject"
                                  title="Reject product"
                                  disabled={
                                    actionLoading !==
                                      null
                                  }
                                  onClick={() =>
                                    handleReject(
                                      product.id
                                    )
                                  }
                                >
                                  <X
                                    size={15}
                                  />
                                </button>
                              </>
                            )}

                            <button
                              type="button"
                              className="action-button delete"
                              title="Archive product"
                              disabled={
                                actionLoading !==
                                  null
                              }
                              onClick={() =>
                                handleDelete(
                                  product.id
                                )
                              }
                            >
                              {actionLoading ===
                              `delete-${product.id}` ? (
                                <RefreshCw
                                  size={15}
                                  className="products-spin"
                                />
                              ) : (
                                <Trash2
                                  size={15}
                                />
                              )}
                            </button>

                          </div>

                        </td>

                      </tr>
                    );
                  }
                )}

              </tbody>

            </table>

          </div>
        )}

      </div>

    </AdminLayout>
  );
}
