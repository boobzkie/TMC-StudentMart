/* oxlint-disable react(set-state-in-effect), react-hooks/exhaustive-deps */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle, Archive, CalendarDays, ChartNoAxesColumn, Check, CheckCircle2,
  ChevronLeft, ChevronRight, Clock3, Download, Eye, Filter, Package, RefreshCw,
  RotateCcw, Search, X, XCircle,
} from "lucide-react";
import AdminLayout from "./components/AdminLayout";
import AdminPageHero from "./components/AdminPageHero";
import { SortableHead } from "./ui/Table";
import { API_URL, SERVER_URL, getAuthHeaders, sortRows } from "./utils/api";
import "./AdminProducts.css";

const PAGE_SIZE = 10;
const COLORS = ["#167f88", "#3157a4", "#5c79c7", "#50a6ad", "#96a5bd"];
const COLUMNS = ["product", "seller", "category", "price", "quantity", "status", "date"];
const LABELS = { product: "Product", seller: "Seller", category: "Category", price: "Price", quantity: "Quantity", status: "Status", date: "Date" };
const value = (input) => Number.isFinite(Number(input)) ? Number(input) : 0;
const categoryName = (product) => product.categoryRecord?.name || product.category?.name || product.category_name || product.category || "Other";
const sellerName = (product) => product.user?.name || product.seller?.name || product.seller_name || "Unknown Student";
const formatDate = (input) => input ? new Date(input).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
const formatPrice = (input) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value(input));
const statusLabel = (status) => ({ active: "Available", approved: "Available", pending: "Pending", rejected: "Declined", archived: "Archived", sold_out: "Sold out", suspended: "Suspended", inactive: "Inactive" }[String(status || "").toLowerCase()] || String(status || "Unknown"));
const statusClass = (status) => String(status || "").toLowerCase().replaceAll("_", "-");
const imageUrl = (image) => !image ? "" : /^https?:\/\//i.test(image) ? image : `${SERVER_URL.replace(/\/+$/, "")}/storage/${String(image).replace(/^\/?storage\//, "")}`;

export default function AdminProducts() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [period, setPeriod] = useState("12m");
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState("");
  const [analyticsReload, setAnalyticsReload] = useState(0);
  const [sort, setSort] = useState({ key: "created_at", direction: "desc" });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [seller, setSeller] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [columns, setColumns] = useState(Object.fromEntries(COLUMNS.map((key) => [key, true])));
  const [columnMenu, setColumnMenu] = useState(false);
  const [details, setDetails] = useState(null);

  const loadProducts = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");
      const token = localStorage.getItem("token");
      if (!token) { navigate("/login", { replace: true }); return; }
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      if (category) params.set("category", category);
      if (seller) params.set("seller", seller);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      const response = await fetch(`${API_URL}/admin/products${params.size ? `?${params}` : ""}`, { headers: getAuthHeaders() });
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("token"); localStorage.removeItem("role"); localStorage.removeItem("user");
        navigate("/login", { replace: true }); return;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to load products.");
      setProducts(Array.isArray(data.products) ? data.products : []);
    } catch (err) {
      console.error(err); setError(err.message || "We couldn't load the products. Please try again.");
    } finally { setLoading(false); setRefreshing(false); }
  }, [navigate, search, status, category, seller, dateFrom, dateTo]);

  // Loading the API data is the page's initial side effect.
  // oxlint-disable-next-line react(set-state-in-effect)
  useEffect(() => {
    const timer = window.setTimeout(() => loadProducts(), 0);
    return () => window.clearTimeout(timer);
  }, [loadProducts]);
  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/admin/stats?period=${encodeURIComponent(period)}`, { headers: getAuthHeaders() })
      .then(async (response) => {
        if (response.status === 401 || response.status === 403) { navigate("/login", { replace: true }); return null; }
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "Unable to load product analytics.");
        return data.stats || null;
      })
      .then((stats) => { if (active && stats) setAnalytics(stats); })
      .catch((err) => { if (active) setAnalyticsError(err.message || "Analytics are unavailable."); })
      .finally(() => { if (active) setAnalyticsLoading(false); });
    return () => { active = false; };
  }, [period, analyticsReload, navigate]);

  const categories = useMemo(() => [...new Set(products.map(categoryName))].sort(), [products]);
  const sellers = useMemo(() => [...new Set(products.map(sellerName))].sort(), [products]);
  const sorted = useMemo(() => sortRows(products, sort, (product, key) => ({
    name: product.name, seller: sellerName(product), category: categoryName(product), price: value(product.price),
    quantity: value(product.stock_quantity ?? product.quantity), status: product.status, created_at: product.created_at,
  })[key]), [products, sort]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageProducts = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const toggleSort = (key) => setSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
  const clearFilters = () => { setSearchInput(""); setSearch(""); setStatus(""); setCategory(""); setSeller(""); setDateFrom(""); setDateTo(""); setPage(1); };

  const runAction = async (product, action) => {
    const labels = { approve: "Approve this product and make it visible to students?", reject: "Reject this product?", archive: "Archive this product? Its order and history records will be preserved.", restore: "Restore this product for moderation review?" };
    if (!window.confirm(labels[action])) return;
    const suffix = action === "archive" ? "" : `/${action}`;
    const method = action === "archive" ? "DELETE" : "PUT";
    try {
      setActionLoading(`${action}-${product.id}`);
      const response = await fetch(`${API_URL}/admin/products/${product.id}${suffix}`, { method, headers: getAuthHeaders() });
      if (response.status === 401 || response.status === 403) { navigate("/login", { replace: true }); return; }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `Unable to ${action} product.`);
      await loadProducts(true); setAnalyticsLoading(true); setAnalyticsReload((current) => current + 1);
    } catch (err) { window.alert(err.message || `Unable to ${action} product.`); }
    finally { setActionLoading(null); }
  };

  const exportCsv = () => {
    const visible = COLUMNS.filter((key) => columns[key]);
    const rows = sorted.map((p) => ({ product: p.name, seller: sellerName(p), category: categoryName(p), price: formatPrice(p.price), quantity: value(p.stock_quantity ?? p.quantity), status: statusLabel(p.status), date: formatDate(p.created_at) }));
    const escape = (input) => `"${String(input ?? "").replaceAll('"', '""')}"`;
    const csv = [visible.map((key) => escape(LABELS[key])).join(","), ...rows.map((row) => visible.map((key) => escape(row[key])).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `tmc-products-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  const stats = analytics || {};
  const categoryData = Array.isArray(stats.category_performance) ? stats.category_performance.map((item) => ({ name: item.name, count: value(item.active_listings) })) : [];
  const categoryTotal = categoryData.reduce((sum, item) => sum + item.count, 0);
  const listingSeries = Array.isArray(stats.listings_over_time) ? stats.listings_over_time : [];
  const salesSeries = Array.isArray(stats.sales_over_time) ? stats.sales_over_time : [];
  const maxListing = Math.max(1, ...listingSeries.map((item) => value(item.listings)));
  const maxSales = Math.max(1, ...salesSeries.flatMap((item) => [value(item.sales), value(item.pending)]));
  const makeLine = (field) => salesSeries.map((item, index) => `${salesSeries.length < 2 ? 50 : index / (salesSeries.length - 1) * 100},${94 - value(item[field]) / maxSales * 84}`).join(" ");
  const refreshAll = () => { loadProducts(true); setAnalyticsLoading(true); setAnalyticsError(""); setAnalyticsReload((current) => current + 1); };

  return (
    <AdminLayout title="Product Management" subtitle="Review marketplace listings, manage product information, and maintain accurate inventory records.">
      <div className="products-page">
        <AdminPageHero title="Product Management" description="Review marketplace listings, manage product information, and maintain accurate inventory records." icon={Package} onRefresh={refreshAll} refreshing={refreshing} meta={`${value(stats.total_products) || products.length} products found`} />
        {error && <div className="products-error" role="alert"><AlertCircle size={18} /><span>{error}</span><button type="button" onClick={() => loadProducts(true)}>Try Again</button></div>}

        <section className="pm-dashboard-section" aria-label="Product analytics">
          <div className="pm-dashboard-grid">
            <article className="pm-dashboard-card pm-category-card">
              <div className="pm-dashboard-card-heading"><span className="pm-dashboard-icon"><Package size={17} /></span><div><h2>By Category</h2><p>Active marketplace listings</p></div></div>
              {analyticsLoading ? <p className="pm-data-state" role="status">Loading category data…</p> : analyticsError ? <p className="pm-data-state">Category analytics are unavailable.</p> : !categoryTotal ? <p className="pm-data-state">No active category listings yet.</p> : <div className="pm-category-content"><div className="pm-donut" style={{ background: `conic-gradient(${categoryData.filter((item) => item.count).map((item, index, arr) => { const before = arr.slice(0, index).reduce((sum, current) => sum + current.count, 0); const after = before + item.count; return `${COLORS[index % COLORS.length]} ${before / categoryTotal * 100}% ${after / categoryTotal * 100}%`; }).join(", ")})` }} role="img" aria-label={`${categoryTotal} active listings across categories`}><span><strong>{categoryTotal}</strong><small>Listings</small></span></div><ul className="pm-category-legend">{categoryData.filter((item) => item.count).slice(0, 6).map((item, index) => <li key={item.name}><i style={{ background: COLORS[index % COLORS.length] }} /><span>{item.name}</span><b>{item.count}</b><small>{Math.round(item.count / categoryTotal * 100)}%</small></li>)}</ul></div>}
            </article>
            <article className="pm-dashboard-card">
              <div className="pm-dashboard-card-heading"><span className="pm-dashboard-icon"><ChartNoAxesColumn size={17} /></span><div><h2>Listings by Date</h2><p>New product listings</p></div><select className="pm-period-select" value={period} onChange={(event) => { setAnalyticsLoading(true); setAnalyticsError(""); setPeriod(event.target.value); }} aria-label="Analytics period"><option value="30d">30 days</option><option value="90d">90 days</option><option value="6m">6 months</option><option value="12m">12 months</option></select></div>
              {analyticsLoading ? <p className="pm-data-state" role="status">Loading listing activity…</p> : !listingSeries.length ? <p className="pm-data-state">{analyticsError || "No listing activity in this period."}</p> : <div className="pm-bars" role="img" aria-label="New product listings by date">{listingSeries.map((item, index) => <div className="pm-bar-column" key={item.key || index} title={`${item.label}: ${value(item.listings)} listings`}><strong>{value(item.listings) || ""}</strong><span className="pm-bar-track"><i style={{ height: `${Math.max(2, value(item.listings) / maxListing * 100)}%` }} /></span><small>{String(item.label || "").split(" ")[0]}</small></div>)}</div>}
            </article>
            <article className="pm-dashboard-card">
              <div className="pm-dashboard-card-heading"><span className="pm-dashboard-icon"><ChartNoAxesColumn size={17} /></span><div><h2>Sales Overview</h2><p>Completed sales from orders</p></div><strong className="pm-sales-total">{formatPrice(stats.total_sales)}</strong></div>
              {analyticsLoading ? <p className="pm-data-state" role="status">Loading sales activity…</p> : !salesSeries.length ? <p className="pm-data-state">{analyticsError || "No sales activity in this period."}</p> : <><svg className="pm-line-chart" viewBox="0 0 100 112" preserveAspectRatio="none" role="img" aria-label="Completed and pending order value over time"><path d="M0 94H100M0 52H100M0 10H100" className="pm-chart-gridline" /><polyline points={makeLine("sales")} className="pm-chart-line" /><polyline points={makeLine("pending")} className="pm-chart-line pm-chart-line-pending" />{salesSeries.map((item, index) => <text key={item.key || index} x={salesSeries.length < 2 ? 50 : 3 + index / (salesSeries.length - 1) * 94} y="108">{String(item.label || "").split(" ")[0]}</text>)}</svg><div className="pm-chart-legend"><i />Completed sales<i className="pending" />Pending order value</div></>}
            </article>
          </div>
        </section>

        <section className="pm-kpi-grid" aria-label="Product summary">
          {[{ title: "Available", amount: stats.active_products, icon: CheckCircle2, tone: "green" }, { title: "Pending review", amount: stats.pending_products, icon: Clock3, tone: "amber" }, { title: "Declined", amount: stats.rejected_products, icon: XCircle, tone: "red" }, { title: "Out of stock", amount: stats.out_of_stock_products, icon: Package, tone: "blue" }].map((item) => { const percentage = stats.total_products ? Math.round(value(item.amount) / value(stats.total_products) * 100) : 0; return <article className="pm-kpi-card" key={item.title}><span className={`pm-kpi-icon ${item.tone}`}><item.icon size={18} /></span><div><span>{item.title}</span><strong>{analyticsLoading ? "—" : value(item.amount)}</strong><small>of {value(stats.total_products)} products</small></div><span className={`pm-kpi-ring ${item.tone}`} aria-label={`${percentage}% of products`}><svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="18" /><circle cx="22" cy="22" r="18" style={{ strokeDashoffset: 113.1 * (1 - percentage / 100) }} /></svg><b>{percentage}%</b></span></article>; })}
        </section>

        <section className="pm-listings" aria-label="Product listings">
          <div className="pm-listings-heading"><div><h2>Marketplace listings</h2><p>Search, filter, review, and export product records.</p></div><span className="pm-results-count">{sorted.length} results</span></div>
          <form className="pm-toolbar" onSubmit={(event) => { event.preventDefault(); setSearch(searchInput.trim()); setPage(1); }}>
            <label className="pm-search"><Search size={17} /><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search products…" aria-label="Search products" /><button type="submit">Search</button></label>
            <select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} aria-label="Filter by category"><option value="">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} aria-label="Filter by status"><option value="">All statuses</option>{[["active", "Available"], ["pending", "Pending"], ["rejected", "Declined"], ["archived", "Archived"], ["sold_out", "Sold out"], ["suspended", "Suspended"], ["inactive", "Inactive"]].map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
            <select value={seller} onChange={(event) => { setSeller(event.target.value); setPage(1); }} aria-label="Filter by seller"><option value="">All sellers</option>{sellers.map((item) => <option key={item}>{item}</option>)}</select>
            <label className="pm-date-filter"><CalendarDays size={15} /><input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} aria-label="Created from" /><span>to</span><input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} aria-label="Created to" /></label>
            <div className="pm-toolbar-actions"><div className="pm-column-control"><button type="button" onClick={() => setColumnMenu((open) => !open)} aria-expanded={columnMenu}><Filter size={15} /> Columns</button>{columnMenu && <div className="pm-column-menu">{COLUMNS.map((key) => <label key={key}><input type="checkbox" checked={columns[key]} onChange={(event) => setColumns((current) => ({ ...current, [key]: event.target.checked }))} />{LABELS[key]}</label>)}</div>}</div><button type="button" onClick={exportCsv}><Download size={15} /> Export CSV</button><button type="button" className="pm-clear" onClick={clearFilters}><X size={15} /> Clear</button></div>
          </form>
          {dateFrom && dateTo && dateTo < dateFrom && <p className="pm-filter-error" role="alert">The end date must be on or after the start date.</p>}
          <div className="products-table-card">
            {loading ? <div className="products-loading" role="status" aria-label="Loading products">{[1, 2, 3, 4].map((item) => <div className="product-skeleton" key={item} />)}</div> : error && !products.length ? <div className="products-empty"><AlertCircle size={30} /><h3>Products could not be loaded</h3><p>{error}</p><button type="button" className="pm-secondary-button" onClick={() => loadProducts(true)}>Try again</button></div> : !pageProducts.length ? <div className="products-empty"><Package size={32} /><h3>No products found</h3><p>Try changing your search or filters.</p></div> : <div className="products-table-wrapper"><table className="products-table"><thead><tr>{columns.product && <SortableHead field="name" sort={sort} onSort={toggleSort}>PRODUCT</SortableHead>}{columns.seller && <SortableHead field="seller" sort={sort} onSort={toggleSort}>SELLER</SortableHead>}{columns.category && <SortableHead field="category" sort={sort} onSort={toggleSort}>CATEGORY</SortableHead>}{columns.price && <SortableHead field="price" sort={sort} onSort={toggleSort}>PRICE</SortableHead>}{columns.quantity && <SortableHead field="quantity" sort={sort} onSort={toggleSort}>QUANTITY</SortableHead>}{columns.status && <SortableHead field="status" sort={sort} onSort={toggleSort}>STATUS</SortableHead>}{columns.date && <SortableHead field="created_at" sort={sort} onSort={toggleSort}>DATE</SortableHead>}<th>ACTIONS</th></tr></thead><tbody>{pageProducts.map((product) => { const normalized = String(product.status || "").toLowerCase(); const src = imageUrl(product.image || product.images?.[0]?.path); return <tr key={product.id}>{columns.product && <td><div className="product-cell">{src ? <img className="product-image" src={src} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} /> : <span className="product-image-placeholder"><Package size={20} /></span>}<div className="product-information"><strong>{product.name}</strong><span>#{product.id}</span></div></div></td>}{columns.seller && <td><div className="seller-cell"><strong>{sellerName(product)}</strong><span>{product.user?.student_id || product.seller?.student_id || "—"}</span></div></td>}{columns.category && <td><span className="pm-category-pill">{categoryName(product)}</span></td>}{columns.price && <td><strong className="product-price">{formatPrice(product.price)}</strong></td>}{columns.quantity && <td><span className="product-quantity">{value(product.stock_quantity ?? product.quantity)}</span></td>}{columns.status && <td><span className={`pm-status ${statusClass(normalized)}`}><i />{statusLabel(normalized)}</span></td>}{columns.date && <td><span className="product-date">{formatDate(product.created_at)}</span></td>}<td><div className="pm-row-actions"><button type="button" title="View product details" aria-label={`View ${product.name}`} onClick={() => setDetails(product)}><Eye size={16} /></button>{normalized === "pending" && <><button type="button" title="Approve" aria-label={`Approve ${product.name}`} disabled={Boolean(actionLoading)} onClick={() => runAction(product, "approve")}>{actionLoading === `approve-${product.id}` ? <RefreshCw className="products-spin" size={15} /> : <Check size={16} />}</button><button type="button" title="Decline" aria-label={`Decline ${product.name}`} disabled={Boolean(actionLoading)} onClick={() => runAction(product, "reject")}><X size={16} /></button></>}{normalized === "archived" ? <button type="button" title="Restore for review" aria-label={`Restore ${product.name} for review`} disabled={Boolean(actionLoading)} onClick={() => runAction(product, "restore")}><RotateCcw size={16} /></button> : <button type="button" title="Archive" aria-label={`Archive ${product.name}`} disabled={Boolean(actionLoading)} onClick={() => runAction(product, "archive")}><Archive size={16} /></button>}</div></td></tr>; })}</tbody></table></div>}
          </div>
          <footer className="pm-pagination"><span>Showing {sorted.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length} products</span><div><button type="button" disabled={page <= 1} aria-label="Previous page" onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={17} /></button><span>Page {page} of {totalPages}</span><button type="button" disabled={page >= totalPages} aria-label="Next page" onClick={() => setPage((current) => Math.min(totalPages, current + 1))}><ChevronRight size={17} /></button></div></footer>
        </section>
        {details && <div className="pm-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetails(null); }}><section className="pm-detail-modal" role="dialog" aria-modal="true" aria-labelledby="pm-detail-title"><header><h2 id="pm-detail-title">Product details</h2><button type="button" aria-label="Close product details" onClick={() => setDetails(null)}><X size={18} /></button></header><dl><dt>Product</dt><dd>{details.name}</dd><dt>Seller</dt><dd>{sellerName(details)} {details.user?.student_id ? `(${details.user.student_id})` : ""}</dd><dt>Category</dt><dd>{categoryName(details)}</dd><dt>Price</dt><dd>{formatPrice(details.price)}</dd><dt>Quantity</dt><dd>{value(details.stock_quantity ?? details.quantity)}</dd><dt>Status</dt><dd>{statusLabel(details.status)}</dd><dt>Created</dt><dd>{formatDate(details.created_at)}</dd><dt>Description</dt><dd>{details.description || "No description provided."}</dd></dl></section></div>}
      </div>
    </AdminLayout>
  );
}
