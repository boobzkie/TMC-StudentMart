import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, RefreshCw, Check, X, Trash2, AlertCircle, Package } from "lucide-react";

import AdminLayout from "./components/AdminLayout";
import { API_URL, SERVER_URL } from "./utils/api";

import { Badge, Button, SectionHeader, EmptyState } from "./ui";

import "./AdminProducts.css";

export default function AdminProducts() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  const fetchProducts = useCallback(async ({
    searchValue = "",
    statusValue = "",
  } = {}) => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login", { replace: true });
      return null;
    }

    const params = new URLSearchParams();
    if (searchValue.trim()) params.append("search", searchValue.trim());
    if (statusValue) params.append("status", statusValue);
    const query = params.toString();
    const response = await fetch(
      `${API_URL}/admin/products${query ? `?${query}` : ""}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("user");
      navigate("/login", { replace: true });
      return null;
    }

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Unable to load products.");
    return Array.isArray(data.products) ? data.products : [];
  }, [navigate]);

  const loadProducts = async ({
    showRefresh = false,
    searchValue = "",
    statusValue = "",
  } = {}) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");

      const nextProducts = await fetchProducts({ searchValue, statusValue });
      if (nextProducts !== null) setProducts(nextProducts);
    } catch (err) {
      console.error(err);
      setError("We couldn't load the products. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetchProducts()
      .then((nextProducts) => {
        if (active && nextProducts !== null) setProducts(nextProducts);
      })
      .catch((err) => {
        if (active) {
          console.error(err);
          setError("We couldn't load the products. Please try again.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [fetchProducts]);

  const handleSearch = (event) => {
    event.preventDefault();
    loadProducts({ searchValue: search, statusValue: status });
  };

  const handleApprove = async (productId) => {
    const confirmed = window.confirm(
      "Approve this product and make it visible in the student marketplace?"
    );
    if (!confirmed) return;

    try {
      setActionLoading(`approve-${productId}`);
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/admin/products/${productId}/approve`,
        {
          method: "PUT",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        localStorage.clear();
        navigate("/login", { replace: true });
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || "Unable to approve product.");
      }

      await loadProducts({ showRefresh: true, searchValue: search, statusValue: status });
    } catch (err) {
      console.error(err);
      alert(err.message || "Unable to approve product.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (productId) => {
    const confirmed = window.confirm("Reject this product?");
    if (!confirmed) return;

    try {
      setActionLoading(`reject-${productId}`);
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/admin/products/${productId}/reject`,
        {
          method: "PUT",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        localStorage.clear();
        navigate("/login", { replace: true });
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || "Unable to reject product.");
      }

      await loadProducts({ showRefresh: true, searchValue: search, statusValue: status });
    } catch (err) {
      console.error(err);
      alert(err.message || "Unable to reject product.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (productId) => {
    const confirmed = window.confirm(
      "Archive this product? It will leave the marketplace, and its order and history records will be preserved."
    );
    if (!confirmed) return;

    try {
      setActionLoading(`delete-${productId}`);
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/admin/products/${productId}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        localStorage.clear();
        navigate("/login", { replace: true });
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || "Unable to archive product.");
      }

      await loadProducts({ showRefresh: true, searchValue: search, statusValue: status });
    } catch (err) {
      console.error(err);
      alert(err.message || "Unable to archive product.");
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusConfig = (value) => {
    const normalized = String(value || "").toLowerCase();
    const configs = {
      active: { label: "Available", variant: "success" },
      approved: { label: "Available", variant: "success" },
      pending: { label: "Pending", variant: "warning" },
      rejected: { label: "Rejected", variant: "danger" },
      sold_out: { label: "Sold Out", variant: "neutral" },
      archived: { label: "Archived", variant: "neutral" },
      inactive: { label: "Inactive", variant: "neutral" },
      suspended: { label: "Suspended", variant: "neutral" },
    };
    return configs[normalized] || { label: (value || "Unknown").toUpperCase(), variant: "neutral" };
  };

  const formatDate = (date) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatPrice = (price) => {
    const amount = Number(price || 0);
    return `₱${amount.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getImageUrl = (image) => {
    if (!image) return null;
    if (image.startsWith("http://") || image.startsWith("https://")) {
      return image;
    }
    return `${SERVER_URL.replace(/\/+$/, "")}/storage/${image.replace(/^\/?storage\//, "")}`;
  };

  return (
    <AdminLayout
      title="Listing Management"
      subtitle="Review marketplace listings, seller submissions, and approval status."
    >
      <SectionHeader
        title="Products"
        subtitle="Listing Management"
        action={() => loadProducts({ showRefresh: true, searchValue: search, statusValue: status })}
        actionLabel={refreshing ? "Refreshing…" : "Refresh"}
        actionVariant="outline"
      />

      <div className="products-toolbar">
        <form className="products-search-form" onSubmit={handleSearch}>
          <div className="products-search-input">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search listings…"
              aria-label="Search products"
            />
          </div>
        </form>

        <select
          className="products-filter-select"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
          }}
          aria-label="Filter by status"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="active">Available</option>
          <option value="rejected">Rejected</option>
          <option value="inactive">Inactive</option>
          <option value="sold_out">Sold Out</option>
          <option value="archived">Archived</option>
        </select>

        <Button variant="primary" size="sm" onClick={() => loadProducts({ searchValue: search, statusValue: status })} disabled={refreshing}>
          {refreshing ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}><RefreshCw size={14} className="products-spin" aria-hidden="true" />Refreshing…</span> : <><Search size={15} aria-hidden="true" /> Search</>}
        </Button>
      </div>

      {error && (
        <div className="products-error" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <div>
            <strong>Unable to load products</strong>
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadProducts({ showRefresh: true, searchValue: search, statusValue: status })}>
            Try Again
          </Button>
        </div>
      )}

      <div className="products-table-card">
        {loading ? (
          <div className="products-loading">
            {[1, 2, 3, 4].map((item) => (
              <div className="product-skeleton" key={item} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={() => null}
            title="No products found"
            subtitle="There are no products matching your current search or filter."
          />
        ) : (
          <div className="products-table-wrapper">
            <table className="products-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Seller</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Quantity</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const imageUrl = getImageUrl(product.image);
                  const productStatus = String(product.status || "").toLowerCase();
                  const statusConfig = getStatusConfig(productStatus);

                  return (
                    <tr key={product.id}>
                      <td className="product-cell">
                        <div className="product-cell-inner">
                          {imageUrl ? (
                            <img src={imageUrl} alt={product.name} className="product-image" />
                          ) : (
                            <div className="product-image-placeholder">
                              <Package size={20} aria-hidden="true" />
                            </div>
                          )}
                          <div className="product-information">
                            <strong>{product.name}</strong>
                            <span>#{product.id}</span>
                          </div>
                        </div>
                      </td>

                      <td className="seller-cell">
                        <div className="seller-cell-inner">
                          <strong>{product.user?.name || "Unknown Student"}</strong>
                          <span>{product.user?.student_id || "—"}</span>
                        </div>
                      </td>

                      <td>
                        <span className="category-badge">{product.category || "Other"}</span>
                      </td>

                      <td>
                        <strong className="product-price">{formatPrice(product.price)}</strong>
                      </td>

                      <td>
                        <span className="product-quantity">{Number(product?.stock_quantity ?? 0)}</span>
                      </td>

                      <td>
                        <Badge variant={statusConfig.variant} size="sm">{statusConfig.label}</Badge>
                      </td>

                      <td>
                        <span className="product-date">{formatDate(product.created_at)}</span>
                      </td>

                      <td className="actions-cell">
                        <div className="product-actions">
                          {productStatus === "pending" && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="action-approve"
                                title="Approve product"
                                disabled={actionLoading !== null}
                                onClick={() => handleApprove(product.id)}
                              >
                                {actionLoading === `approve-${product.id}` ? (
                                  <RefreshCw size={13} className="products-spin" aria-hidden="true" />
                                ) : (
                                  <Check size={15} aria-hidden="true" />
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="action-reject"
                                title="Reject product"
                                disabled={actionLoading !== null}
                                onClick={() => handleReject(product.id)}
                              >
                                <X size={15} aria-hidden="true" />
                              </Button>
                            </>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            className="action-delete"
                            title="Archive product"
                            disabled={actionLoading !== null}
                            onClick={() => handleDelete(product.id)}
                          >
                            {actionLoading === `delete-${product.id}` ? (
                              <RefreshCw size={13} className="products-spin" aria-hidden="true" />
                            ) : (
                              <Trash2 size={15} aria-hidden="true" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
