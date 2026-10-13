import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import "./ProductDetails.css";

const API_URL = "http://127.0.0.1:8000/api";
const SERVER_URL = "http://127.0.0.1:8000";

function ProductDetails() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const token = localStorage.getItem("token");

        if (!token) {
            navigate("/login", { replace: true });
            return;
        }

        const fetchProduct = async () => {
            try {
                setLoading(true);
                setError("");

                const response = await fetch(
                    `${API_URL}/products/${id}`,
                    {
                        method: "GET",
                        headers: {
                            Accept: "application/json",
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                if (!response.ok) {
                    if (response.status === 404) {
                        throw new Error("Product not found.");
                    }

                    throw new Error(
                        "Unable to load product details."
                    );
                }

                const data = await response.json();

                setProduct(data);
            } catch (err) {
                console.error("Product details error:", err);

                setError(
                    err.message ||
                    "Something went wrong while loading the product."
                );
            } finally {
                setLoading(false);
            }
        };

        fetchProduct();
    }, [id, navigate]);

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

    const formatPrice = (price) => {
        const amount = Number(price);

        if (Number.isNaN(amount)) {
            return "₱0.00";
        }

        return new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
        }).format(amount);
    };

    const getSellerName = () => {
        if (!product?.user) {
            return "Unknown Seller";
        }

        return (
            product.user.name ||
            product.user.student_id ||
            "Unknown Seller"
        );
    };

    const getInitial = () => {
        const name = getSellerName();

        return name
            .charAt(0)
            .toUpperCase();
    };

    if (loading) {
        return (
            <div className="product-details-loading">
                <div className="product-details-loading-card">
                    <div className="product-details-loading-icon">
                        🛍️
                    </div>

                    <h2>
                        Loading Product
                    </h2>

                    <p>
                        Please wait while we get the product details.
                    </p>
                </div>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className="product-details-page">
                <main className="product-details-content">

                    <div className="product-details-error">
                        <div className="product-details-error-icon">
                            ⚠️
                        </div>

                        <h2>
                            Product Not Available
                        </h2>

                        <p>
                            {error ||
                                "The product could not be found."}
                        </p>

                        <button
                            type="button"
                            onClick={() =>
                                navigate("/marketplace")
                            }
                            className="product-details-back-button"
                        >
                            ← Back to Marketplace
                        </button>
                    </div>

                </main>
            </div>
        );
    }

    const imageUrl = getImageUrl(product.image);

    const status =
        product.status || "active";

    const seller = product.user || {};

    return (
        <div className="product-details-page">

            {/* HEADER */}

            <header className="product-details-header">
                <div className="product-details-header-inner">

                    <Link
                        to="/marketplace"
                        className="product-details-brand"
                    >
                        <div className="product-details-logo">
                            🛍️
                        </div>

                        <div>
                            <h1>
                                TMC StudentMart
                            </h1>

                            <p>
                                Trinidad Municipal College
                            </p>
                        </div>
                    </Link>

                    <Link
                        to="/marketplace"
                        className="product-details-header-back"
                    >
                        ← Marketplace
                    </Link>

                </div>
            </header>


            {/* CONTENT */}

            <main className="product-details-content">

                <button
                    type="button"
                    className="product-details-back-link"
                    onClick={() =>
                        navigate("/marketplace")
                    }
                >
                    ← Back to Marketplace
                </button>


                <section className="product-details-card">

                    {/* PRODUCT IMAGE */}

                    <div className="product-details-image-section">

                        <div className="product-details-image">

                            {imageUrl ? (
                                <img
                                    src={imageUrl}
                                    alt={product.name}
                                />
                            ) : (
                                <div className="product-details-image-placeholder">
                                    🛍️
                                </div>
                            )}

                            <span className="product-details-status">
                                {status.toLowerCase() === "active"
                                    ? "Available"
                                    : status}
                            </span>

                        </div>

                    </div>


                    {/* PRODUCT INFORMATION */}

                    <div className="product-details-info">

                        {product.category && (
                            <span className="product-details-category">
                                {product.category}
                            </span>
                        )}

                        <h2>
                            {product.name}
                        </h2>

                        <div className="product-details-price">
                            {formatPrice(product.price)}
                        </div>


                        <div className="product-details-divider" />


                        <div className="product-details-section">

                            <h3>
                                Product Description
                            </h3>

                            <p>
                                {product.description ||
                                    "No description provided by the seller."}
                            </p>

                        </div>


                        {/* SELLER */}

                        <div className="product-details-seller-section">

                            <h3>
                                Seller Information
                            </h3>

                            <div className="product-details-seller">

                                <div className="product-details-seller-avatar">
                                    {getInitial()}
                                </div>

                                <div className="product-details-seller-info">

                                    <strong>
                                        {getSellerName()}
                                    </strong>

                                    <span>
                                        Seller
                                    </span>

                                </div>

                            </div>


                            <div className="product-details-seller-data">

                                {seller.student_id && (
                                    <div>
                                        <span>
                                            Student ID
                                        </span>

                                        <strong>
                                            {seller.student_id}
                                        </strong>
                                    </div>
                                )}

                                {seller.email && (
                                    <div>
                                        <span>
                                            Email
                                        </span>

                                        <strong>
                                            {seller.email}
                                        </strong>
                                    </div>
                                )}

                                {seller.contact_number && (
                                    <div>
                                        <span>
                                            Contact Number
                                        </span>

                                        <strong>
                                            {seller.contact_number}
                                        </strong>
                                    </div>
                                )}

                            </div>

                        </div>


                        {/* ACTION */}

                        <div className="product-details-actions">

                            <button
                                type="button"
                                className="product-details-primary-button"
                                onClick={() => {
                                    alert(
                                        "Messaging and purchasing will be added in the upcoming phases."
                                    );
                                }}
                            >
                                Contact Seller
                            </button>

                            <button
                                type="button"
                                className="product-details-secondary-button"
                                onClick={() =>
                                    navigate("/marketplace")
                                }
                            >
                                Continue Shopping
                            </button>

                        </div>

                    </div>

                </section>

            </main>

        </div>
    );
}

export default ProductDetails;