import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Marketplace.css";

const API_URL = "http://127.0.0.1:8000/api";
const SERVER_URL = "http://127.0.0.1:8000";

function Marketplace() {
    const navigate = useNavigate();

    const [products, setProducts] = useState([]);
    const [user, setUser] = useState(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Search and filter states
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [sortOption, setSortOption] = useState("newest");

    const token = localStorage.getItem("token");

    const handleLogout = useCallback(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("role");

        navigate("/login", { replace: true });
    }, [navigate]);


    const fetchUser = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/user`, {
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${token}`,
                },
            });

            if (response.status === 401) {
                handleLogout();
                return;
            }

            if (!response.ok) {
                throw new Error("Failed to load user information.");
            }

            const data = await response.json();

            setUser(data);
            localStorage.setItem("user", JSON.stringify(data));
            localStorage.setItem("role", data.role || "student");
        } catch (err) {
            console.error("User loading error:", err);
        }
    }, [token, handleLogout]);

    const fetchProducts = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const response = await fetch(`${API_URL}/products`, {
                headers: {
                    Accept: "application/json",
                },
            });

            if (!response.ok) {
                throw new Error("Failed to load products.");
            }

            const data = await response.json();

            setProducts(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("Product loading error:", err);
            setError(
                "Unable to load products. Please make sure the Laravel server is running."
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!token) {
            navigate("/login", { replace: true });
            return;
        }

        const timer = setTimeout(() => {
            fetchUser();
            fetchProducts();
        }, 0);

        return () => clearTimeout(timer);
    }, [token, navigate, fetchUser, fetchProducts]);

    // Create category list from products
    const categories = useMemo(() => {
        const categorySet = new Set();

        products.forEach((product) => {
            if (product.category && product.category.trim() !== "") {
                categorySet.add(product.category.trim());
            }
        });

        return ["All", ...Array.from(categorySet).sort()];
    }, [products]);

    // Search + category + sorting
    const filteredProducts = useMemo(() => {
        let result = [...products];

        const search = searchTerm.trim().toLowerCase();

        // Search
        if (search) {
            result = result.filter((product) => {
                const name = product.name?.toLowerCase() || "";
                const description =
                    product.description?.toLowerCase() || "";
                const category = product.category?.toLowerCase() || "";

                const sellerName =
                    product.user?.name?.toLowerCase() || "";

                const studentId =
                    product.user?.student_id?.toLowerCase() || "";

                return (
                    name.includes(search) ||
                    description.includes(search) ||
                    category.includes(search) ||
                    sellerName.includes(search) ||
                    studentId.includes(search)
                );
            });
        }

        // Category
        if (selectedCategory !== "All") {
            result = result.filter(
                (product) =>
                    product.category?.toLowerCase() ===
                    selectedCategory.toLowerCase()
            );
        }

        // Sorting
        switch (sortOption) {
            case "price-low":
                result.sort(
                    (a, b) =>
                        Number(a.price || 0) - Number(b.price || 0)
                );
                break;

            case "price-high":
                result.sort(
                    (a, b) =>
                        Number(b.price || 0) - Number(a.price || 0)
                );
                break;

            case "name":
                result.sort((a, b) =>
                    (a.name || "").localeCompare(b.name || "")
                );
                break;

            case "newest":
            default:
                result.sort((a, b) => {
                    const dateA = new Date(
                        a.created_at || 0
                    ).getTime();

                    const dateB = new Date(
                        b.created_at || 0
                    ).getTime();

                    return dateB - dateA;
                });
                break;
        }

        return result;
    }, [
        products,
        searchTerm,
        selectedCategory,
        sortOption,
    ]);

    const clearFilters = () => {
        setSearchTerm("");
        setSelectedCategory("All");
        setSortOption("newest");
    };

    const formatPrice = (price) => {
        const numericPrice = Number(price || 0);

        return new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
        }).format(numericPrice);
    };

    const getImageUrl = (image) => {
        if (!image) {
            return null;
        }

        if (
            image.startsWith("http://") ||
            image.startsWith("https://")
        ) {
            return image;
        }

        if (image.startsWith("/")) {
            return `${SERVER_URL}${image}`;
        }

        return `${SERVER_URL}/storage/${image}`;
    };

    const getSellerName = (product) => {
        return (
            product.user?.name ||
            product.seller?.name ||
            "Unknown Seller"
        );
    };

    const getSellerInitial = (product) => {
        const name = getSellerName(product);

        return name.charAt(0).toUpperCase();
    };

    return (
        <div className="marketplace-page">

            {/* ================= HEADER ================= */}
            <header className="marketplace-header">
                <div className="marketplace-header-inner">

                    <Link
                        to="/marketplace"
                        className="marketplace-brand"
                    >
                        <div className="brand-logo">
                            SM
                        </div>

                        <div className="brand-text">
                            <h1>TMC StudentMart</h1>
                            <span>
                                Trinidad Municipal College
                            </span>
                        </div>
                    </Link>

                    <nav className="marketplace-nav">
                        <Link to="/dashboard">
                            Dashboard
                        </Link>

                        <Link
                            to="/marketplace"
                            className="active"
                        >
                            Marketplace
                        </Link>

                        <Link to="/dashboard">
                            My Products
                        </Link>
                    </nav>

                    <div className="marketplace-user">

                        <div className="user-avatar">
                            {user?.name
                                ? user.name
                                      .charAt(0)
                                      .toUpperCase()
                                : "U"}
                        </div>

                        <div className="user-info">
                            <strong>
                                {user?.name || "Student"}
                            </strong>

                            <span>
                                {user?.student_id || ""}
                            </span>
                        </div>

                        <button
                            type="button"
                            className="logout-button"
                            onClick={handleLogout}
                        >
                            Logout
                        </button>

                    </div>
                </div>
            </header>

            {/* ================= MAIN ================= */}
            <main className="marketplace-main">

                <section className="marketplace-intro">
                    <div>
                        <span className="section-label">
                            STUDENT MARKETPLACE
                        </span>

                        <h2>
                            Find What You Need
                        </h2>

                        <p>
                            Browse products posted by
                            fellow TMC students.
                        </p>
                    </div>
                </section>

                {/* ================= SEARCH ================= */}
                <section className="marketplace-controls">

                    <div className="search-container">

                        <span className="search-icon">
                            🔎
                        </span>

                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) =>
                                setSearchTerm(
                                    e.target.value
                                )
                            }
                            placeholder="Search products, categories, or sellers..."
                            aria-label="Search products"
                        />

                        {searchTerm && (
                            <button
                                type="button"
                                className="clear-search"
                                onClick={() =>
                                    setSearchTerm("")
                                }
                                aria-label="Clear search"
                            >
                                ×
                            </button>
                        )}
                    </div>

                    {/* ================= CATEGORY ================= */}
                    <div className="filter-group">

                        <label htmlFor="category-filter">
                            Category
                        </label>

                        <select
                            id="category-filter"
                            value={selectedCategory}
                            onChange={(e) =>
                                setSelectedCategory(
                                    e.target.value
                                )
                            }
                        >
                            {categories.map(
                                (category) => (
                                    <option
                                        key={category}
                                        value={category}
                                    >
                                        {category}
                                    </option>
                                )
                            )}
                        </select>

                    </div>

                    {/* ================= SORT ================= */}
                    <div className="filter-group">

                        <label htmlFor="sort-filter">
                            Sort By
                        </label>

                        <select
                            id="sort-filter"
                            value={sortOption}
                            onChange={(e) =>
                                setSortOption(
                                    e.target.value
                                )
                            }
                        >
                            <option value="newest">
                                Newest
                            </option>

                            <option value="price-low">
                                Price: Low to High
                            </option>

                            <option value="price-high">
                                Price: High to Low
                            </option>

                            <option value="name">
                                Name: A to Z
                            </option>
                        </select>

                    </div>

                    <button
                        type="button"
                        className="clear-filters-button"
                        onClick={clearFilters}
                    >
                        Clear Filters
                    </button>

                </section>

                {/* ================= RESULTS INFO ================= */}
                <section className="marketplace-results-bar">

                    <div className="results-count">

                        <strong>
                            {filteredProducts.length}
                        </strong>

                        <span>
                            {filteredProducts.length === 1
                                ? " product"
                                : " products"}{" "}
                            found
                        </span>

                    </div>

                    {(searchTerm ||
                        selectedCategory !== "All" ||
                        sortOption !== "newest") && (
                        <div className="active-filters">

                            {searchTerm && (
                                <span className="filter-tag">
                                    Search: "{searchTerm}"
                                </span>
                            )}

                            {selectedCategory !== "All" && (
                                <span className="filter-tag">
                                    Category:{" "}
                                    {selectedCategory}
                                </span>
                            )}

                        </div>
                    )}

                </section>

                {/* ================= LOADING ================= */}
                {loading && (
                    <section className="marketplace-state">

                        <div className="loading-spinner"></div>

                        <h3>
                            Loading products...
                        </h3>

                        <p>
                            Please wait while we load
                            the marketplace.
                        </p>

                    </section>
                )}

                {/* ================= ERROR ================= */}
                {!loading && error && (
                    <section className="marketplace-state error-state">

                        <div className="state-icon">
                            ⚠️
                        </div>

                        <h3>
                            Something went wrong
                        </h3>

                        <p>{error}</p>

                        <button
                            type="button"
                            onClick={fetchProducts}
                            className="retry-button"
                        >
                            Try Again
                        </button>

                    </section>
                )}

                {/* ================= EMPTY ================= */}
                {!loading &&
                    !error &&
                    filteredProducts.length === 0 && (
                        <section className="marketplace-state">

                            <div className="state-icon">
                                🔍
                            </div>

                            <h3>
                                No products found
                            </h3>

                            <p>
                                We couldn't find any
                                products matching your
                                search or filters.
                            </p>

                            <button
                                type="button"
                                className="retry-button"
                                onClick={clearFilters}
                            >
                                Clear Filters
                            </button>

                        </section>
                    )}

                {/* ================= PRODUCTS ================= */}
                {!loading &&
                    !error &&
                    filteredProducts.length > 0 && (
                        <section className="product-grid">

                            {filteredProducts.map(
                                (product) => {
                                    const imageUrl =
                                        getImageUrl(
                                            product.image
                                        );

                                    return (
                                        <article
                                            className="product-card"
                                            key={product.id}
                                        >

                                            {/* Image */}
                                            <div className="product-image-wrapper">

                                                {imageUrl ? (
                                                    <img
                                                        src={
                                                            imageUrl
                                                        }
                                                        alt={
                                                            product.name
                                                        }
                                                        className="product-image"
                                                        onError={(
                                                            e
                                                        ) => {
                                                            e.currentTarget.style.display =
                                                                "none";
                                                            e.currentTarget.parentElement.classList.add(
                                                                "image-failed"
                                                            );
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="product-image-placeholder">
                                                        <span>
                                                            📦
                                                        </span>
                                                        <small>
                                                            No Image
                                                        </small>
                                                    </div>
                                                )}

                                                <span className="available-badge">
                                                    Available
                                                </span>

                                            </div>

                                            {/* Product information */}
                                            <div className="product-content">

                                                <div className="product-category">
                                                    {product.category ||
                                                        "Other"}
                                                </div>

                                                <h3 className="product-name">
                                                    {product.name}
                                                </h3>

                                                <p className="product-description">
                                                    {product.description ||
                                                        "No description available."}
                                                </p>

                                                <div className="product-price">
                                                    {formatPrice(
                                                        product.price
                                                    )}
                                                </div>

                                                {/* Seller */}
                                                <div className="product-seller">

                                                    <div className="seller-avatar">
                                                        {getSellerInitial(
                                                            product
                                                        )}
                                                    </div>

                                                    <div className="seller-details">

                                                        <span>
                                                            Seller
                                                        </span>

                                                        <strong>
                                                            {getSellerName(
                                                                product
                                                            )}
                                                        </strong>

                                                    </div>

                                                </div>

                                                <Link
                                                    to={`/products/${product.id}`}
                                                    className="view-product-button"
                                                >
                                                    View Product
                                                </Link>

                                            </div>

                                        </article>
                                    );
                                }
                            )}

                        </section>
                    )}

            </main>
        </div>
    );
}

export default Marketplace;
