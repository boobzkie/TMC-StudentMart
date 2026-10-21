import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Edit3,
  Loader2,
  Plus,
  Power,
  RefreshCw,
  Search,
  Tags,
  X,
  XCircle,
} from "lucide-react";

import AdminLayout from "./components/AdminLayout";
import { API_URL } from "./utils/api";

import { Badge, Button, SectionHeader } from "./ui";

import "./AdminCategories.css";

const emptyForm = {
  name: "",
  description: "",
  status: "active",
};

function getToken() {
  return localStorage.getItem("token");
}

function formatDate(date) {
  if (!date) {
    return "—";
  }
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return parsed.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    window.location.href = "/login";
  }, []);

  const loadCategories = useCallback(
    async (isRefresh = false) => {
      const token = getToken();

      if (!token) {
        handleUnauthorized();
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const params = new URLSearchParams();

        if (search.trim()) {
          params.set("search", search.trim());
        }

        if (statusFilter !== "all") {
          params.set("status", statusFilter);
        }

        const queryString = params.toString();

        const response = await fetch(
          `${API_URL}/admin/categories${
            queryString ? `?${queryString}` : ""
          }`,
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
          handleUnauthorized();
          return;
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.message ||
              "Failed to load categories."
          );
        }

        setCategories(
          Array.isArray(data.categories)
            ? data.categories
            : []
        );
      } catch (err) {
        setError(
          err.message ||
            "Unable to load categories."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      search,
      statusFilter,
      handleUnauthorized,
    ]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCategories();
    }, 250);

    return () => clearTimeout(timer);
  }, [loadCategories]);

  const openCreateModal = () => {
    clearMessages();

    setEditingCategory(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEditModal = (category) => {
    clearMessages();

    setEditingCategory(category);

    setForm({
      name: category.name || "",
      description:
        category.description || "",
      status: category.status || "active",
    });

    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setEditingCategory(null);
    setForm(emptyForm);
  };

  const handleFormChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    clearMessages();

    const name = form.name.trim();

    if (!name) {
      setError(
        "Category name is required."
      );
      return;
    }

    if (name.length > 100) {
      setError(
        "Category name must not exceed 100 characters."
      );
      return;
    }

    const token = getToken();

    if (!token) {
      handleUnauthorized();
      return;
    }

    setSaving(true);

    try {
      const isEditing =
        Boolean(editingCategory);

      const url = isEditing
        ? `${API_URL}/admin/categories/${editingCategory.id}`
        : `${API_URL}/admin/categories`;

      const response = await fetch(
        url,
        {
          method: isEditing
            ? "PUT"
            : "POST",
          headers: {
            Accept: "application/json",
            "Content-Type":
              "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name,
            description:
              form.description.trim() ||
              null,
            status: form.status,
          }),
        }
      );

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        if (
          response.status === 422 &&
          data?.errors
        ) {
          const firstError = Object.values(
            data.errors
          )
            .flat()
            .find(Boolean);

          throw new Error(
            firstError ||
              data.message ||
              "Please check the form."
          );
        }

        throw new Error(
          data?.message ||
            "Failed to save category."
        );
      }

      setSuccess(
        data.message ||
          (isEditing
            ? "Category updated successfully."
            : "Category created successfully.")
      );

      closeModal();

      await loadCategories(true);
    } catch (err) {
      setError(
        err.message ||
          "Unable to save category."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (
    category
  ) => {
    clearMessages();

    const token = getToken();

    if (!token) {
      handleUnauthorized();
      return;
    }

    const action =
      category.status === "active"
        ? "deactivate"
        : "activate";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} "${category.name}"?`
    );

    if (!confirmed) return;

    setTogglingId(category.id);

    try {
      const response = await fetch(
        `${API_URL}/admin/categories/${category.id}/toggle-status`,
        {
          method: "PUT",
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
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "Failed to change category status."
        );
      }

      setSuccess(
        data.message ||
          "Category status updated."
      );

      await loadCategories(true);
    } catch (err) {
      setError(
        err.message ||
          "Unable to update category status."
      );
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (
    category
  ) => {
    clearMessages();

    const token = getToken();

    if (!token) {
      handleUnauthorized();
      return;
    }

    const productCount =
      Number(
        category.products_count
      ) || 0;

    if (productCount > 0) {
      setError(
        `"${category.name}" cannot be deleted because it is being used by ${productCount} product${
          productCount === 1
            ? ""
            : "s"
        }. Deactivate it instead.`
      );
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${category.name}"?`
    );

    if (!confirmed) return;

    setDeletingId(category.id);

    try {
      const response = await fetch(
        `${API_URL}/admin/categories/${category.id}`,
        {
          method: "DELETE",
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
        handleUnauthorized();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "Failed to delete category."
        );
      }

      setSuccess(
        data.message ||
          "Category deleted successfully."
      );

      await loadCategories(true);
    } catch (err) {
      setError(
        err.message ||
          "Unable to delete category."
      );
    } finally {
      setDeletingId(null);
    }
  };

  const activeCount = categories.filter(
    (category) =>
      category.status === "active"
  ).length;

  const inactiveCount = categories.filter(
    (category) =>
      category.status === "inactive"
  ).length;

  const totalListings = categories.reduce(
    (total, category) =>
      total +
      (Number(
        category.listings_count
      ) || 0),
    0
  );

  return (
    <AdminLayout
      title="Categories"
      subtitle="Manage marketplace product categories."
    >
      <div className="categories-page">

        {/* HEADER */}
        <SectionHeader
          title="Categories"
          subtitle="Marketplace Categories"
          action={openCreateModal}
          actionLabel="Add Category"
          actionVariant="primary"
        />

        {/* ALERTS */}
        {error && (
          <div className="category-alert category-alert-error" role="alert">
            <XCircle size={19} aria-hidden="true" />
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Close error"
            >
              <X size={17} aria-hidden="true" />
            </button>
          </div>
        )}

        {success && (
          <div className="category-alert category-alert-success" role="status">
            <CheckCircle2 size={19} aria-hidden="true" />
            <span>{success}</span>
            <button
              type="button"
              onClick={() => setSuccess("")}
              aria-label="Close success"
            >
              <X size={17} aria-hidden="true" />
            </button>
          </div>
        )}

        {/* SUMMARY */}
        <section className="category-summary">
          <div className="category-summary-card">
            <div className="summary-icon">
              <Tags size={20} aria-hidden="true" />
            </div>
            <div>
              <span>Total Categories</span>
              <strong>{categories.length}</strong>
            </div>
          </div>
          <div className="category-summary-card">
            <div className="summary-icon summary-icon-success">
              <CheckCircle2 size={20} aria-hidden="true" />
            </div>
            <div>
              <span>Active</span>
              <strong>{activeCount}</strong>
            </div>
          </div>
          <div className="category-summary-card">
            <div className="summary-icon summary-icon-warning">
              <Power size={20} aria-hidden="true" />
            </div>
            <div>
              <span>Inactive</span>
              <strong>{inactiveCount}</strong>
            </div>
          </div>
          <div className="category-summary-card">
            <div className="summary-icon summary-icon-products">
              <Tags size={20} aria-hidden="true" />
            </div>
            <div>
              <span>Active Listings</span>
              <strong>{totalListings}</strong>
            </div>
          </div>
        </section>

        {/* TOOLBAR */}
        <section className="categories-panel">

          <div className="categories-toolbar">

            <div className="category-search">
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                placeholder="Search categories…"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
              />
              {search && (
                <button
                  type="button"
                  className="clear-search"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="category-toolbar-actions">
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
                aria-label="Filter by status"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => loadCategories(true)}
                disabled={loading || refreshing}
                aria-label="Refresh categories"
              >
                {refreshing ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <RefreshCw size={14} className="spin" aria-hidden="true" />
                    Refreshing…
                  </span>
                ) : (
                  <><RefreshCw size={15} aria-hidden="true" /> Refresh</>
                )}
              </Button>
            </div>

          </div>

          {/* TABLE */}
          <div className="categories-table-wrapper">

            {loading ? (
              <div className="category-skeleton">
                {[1, 2, 3, 4, 5].map(
                  (item) => (
                    <div
                      className="category-skeleton-row"
                      key={item}
                    >
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  )
                )}
              </div>
            ) : categories.length === 0 ? (
              <div className="category-empty">
                <div className="category-empty-icon">
                  <Tags size={30} aria-hidden="true" />
                </div>
                <h3>No categories found</h3>
                <p>
                  {search ||
                  statusFilter !== "all"
                    ? "Try changing your search or filter."
                    : "Create your first marketplace category."}
                </p>
                {!search &&
                  statusFilter ===
                  "all" && (
                  <Button variant="primary" size="sm" onClick={openCreateModal}>
                    <Plus size={18} aria-hidden="true" /> Add Category
                  </Button>
                )}
              </div>
            ) : (
              <table className="categories-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Listings</th>
                    <th>Archived</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th className="actions-column">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map(
                    (category) => (
                      <tr key={category.id}>
                        <td>
                          <div className="category-name-cell">
                            <div className="category-table-icon">
                              <Tags size={17} aria-hidden="true" />
                            </div>
                            <div>
                              <strong>{category.name}</strong>
                              <small>ID #{category.id}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="category-description">
                            {category.description ||
                              "No description"}
                          </div>
                        </td>
                        <td>
                          <span className="product-count-badge">
                            {category.listings_count ?? 0}
                          </span>
                        </td>
                        <td>
                          <span className="product-count-badge product-count-badge-archived">
                            {category.archived_count ?? 0}
                          </span>
                        </td>
                        <td>
                          <Badge
                            variant={
                              category.status === "active"
                                ? "success"
                                : "neutral"
                            }
                            size="sm"
                          >
                            {category.status === "active" ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td>
                          <span className="category-date">
                            {formatDate(category.updated_at)}
                          </span>
                        </td>
                        <td>
                          <div className="category-actions">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditModal(category)}
                              title="Edit category"
                            >
                              <Edit3 size={16} aria-hidden="true" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className={`category-action toggle ${
                                category.status ===
                                "active"
                                  ? "deactivate"
                                  : "activate"
                              }`}
                              onClick={() =>
                                handleToggleStatus(category)
                              }
                              disabled={
                                togglingId ===
                                category.id
                              }
                              title={
                                category.status ===
                                "active"
                                  ? "Deactivate category"
                                  : "Activate category"
                              }
                            >
                              {togglingId ===
                              category.id ? (
                                <Loader2
                                  size={16}
                                  className="spin"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Power size={16} aria-hidden="true" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="category-action delete"
                              onClick={() =>
                                handleDelete(category)
                              }
                              disabled={
                                deletingId ===
                                category.id ||
                                Number(
                                  category.products_count
                                ) > 0
                              }
                              title={
                                Number(
                                  category.products_count
                                ) > 0
                                  ? "Cannot delete a category with products"
                                  : "Delete category"
                              }
                            >
                              {deletingId ===
                              category.id ? (
                                <Loader2
                                  size={16}
                                  className="spin"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Trash2Icon />
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            )}

          </div>

        </section>

      </div>

      {/* MODAL */}
      {modalOpen && (
        <div
          className="category-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeModal();
            }
          }}
        >
          <div className="category-modal">

            <div className="category-modal-header">

              <div>
                <span className="modal-eyebrow">
                  CATEGORY MANAGEMENT
                </span>

                <h3>
                  {editingCategory
                    ? "Edit Category"
                    : "Add Category"}
                </h3>

                <p>
                  {editingCategory
                    ? "Update the category information."
                    : "Create a new marketplace category."}
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close modal"
              >
                <X size={20} aria-hidden="true" />
              </button>

            </div>

            <form
              className="category-form"
              onSubmit={handleSubmit}
            >

              <div className="form-field">

                <label htmlFor="category-name">
                  Category Name
                  <span>*</span>
                </label>

                <input
                  id="category-name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={
                    handleFormChange
                  }
                  placeholder="e.g. Electronics"
                  maxLength={100}
                  required
                  autoFocus
                />

              </div>

              <div className="form-field">

                <label htmlFor="category-description">
                  Description
                </label>

                <textarea
                  id="category-description"
                  name="description"
                  value={
                    form.description
                  }
                  onChange={
                    handleFormChange
                  }
                  placeholder="Describe the products that belong to this category…"
                  maxLength={1000}
                  rows={4}
                />

              </div>

              <div className="form-field">

                <label htmlFor="category-status">
                  Status
                </label>

                <select
                  id="category-status"
                  name="status"
                  value={form.status}
                  onChange={
                    handleFormChange
                  }
                >
                  <option value="active">
                    Active
                  </option>

                  <option value="inactive">
                    Inactive
                  </option>
                </select>

              </div>

              <div className="category-modal-footer">

                <button
                  type="button"
                  className="category-cancel-button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="category-primary-button"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2
                        size={18}
                        className="spin"
                        aria-hidden="true"
                      />

                      <span>
                        Saving…
                      </span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2
                        size={18}
                        aria-hidden="true"
                      />

                      <span>
                        {editingCategory
                          ? "Save Changes"
                          : "Create Category"}
                      </span>
                    </>
                  )}
                </button>

              </div>

            </form>

          </div>
        </div>
      )}

    </AdminLayout>
  );
}

function Trash2Icon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
