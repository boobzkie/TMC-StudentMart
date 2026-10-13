/* oxlint-disable react(set-state-in-effect), react-hooks(exhaustive-deps) */
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import "./MyProducts.css";

const API_URL = "http://127.0.0.1:8000/api";
const SERVER_URL = "http://127.0.0.1:8000";


function MyProducts() {

    const navigate = useNavigate();

    const [products, setProducts] = useState([]);

    const [loading, setLoading] = useState(true);

    const [error, setError] = useState("");

    const [success, setSuccess] = useState("");

    const [deletingId, setDeletingId] = useState(null);


    /*
    |--------------------------------------------------------------------------
    | TOKEN
    |--------------------------------------------------------------------------
    */

    const getToken = () => {
        return localStorage.getItem("token");
    };


    /*
    |--------------------------------------------------------------------------
    | HANDLE UNAUTHORIZED
    |--------------------------------------------------------------------------
    */

    const handleUnauthorized = useCallback(() => {

        localStorage.removeItem("token");
        localStorage.removeItem("role");

        navigate(
            "/login",
            {
                replace: true,
            }
        );
    }, [navigate]);


    /*
    |--------------------------------------------------------------------------
    | GET MY PRODUCTS
    |--------------------------------------------------------------------------
    */

    const fetchMyProducts = useCallback(async () => {

        const token = getToken();

        if (!token) {
            handleUnauthorized();
            return;
        }


        try {

            setLoading(true);
            setError("");

            const response = await fetch(
                `${API_URL}/my-products`,
                {
                    method: "GET",

                    headers: {
                        Accept: "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                }
            );


            /*
            | 401
            */

            if (response.status === 401) {

                handleUnauthorized();

                return;
            }


            /*
            | 403
            */

            if (response.status === 403) {

                setError(
                    "You do not have permission to access your products."
                );

                return;
            }


            /*
            | OTHER ERROR
            */

            if (!response.ok) {

                throw new Error(
                    `Server error: ${response.status}`
                );
            }


            const data = await response.json();


            setProducts(
                Array.isArray(data)
                    ? data
                    : []
            );

        } catch (err) {

            console.error(
                "My products error:",
                err
            );

            setError(
                "Unable to load your products. Please make sure Laravel is running."
            );

        } finally {

            setLoading(false);
        }
    }, [handleUnauthorized]);


    /*
    |--------------------------------------------------------------------------
    | LOAD PRODUCTS
    |--------------------------------------------------------------------------
    */

    useEffect(() => {

        // Intentional one-time API bootstrap.
        // oxlint-disable-next-line react(set-state-in-effect)
        fetchMyProducts();

    // oxlint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    /*
    |--------------------------------------------------------------------------
    | EDIT PRODUCT
    |--------------------------------------------------------------------------
    */

    const handleEdit = (productId) => {

        if (!productId) {

            setError(
                "Product ID is missing."
            );

            return;
        }


        navigate(
            `/sell?edit=${productId}`
        );
    };


    /*
    |--------------------------------------------------------------------------
    | DELETE PRODUCT
    |--------------------------------------------------------------------------
    */

    const handleDelete = async (productId) => {

        if (!productId) {

            setError(
                "Product ID is missing."
            );

            return;
        }


        const confirmed = window.confirm(
            "Are you sure you want to delete this product?\n\nThis action cannot be undone."
        );


        if (!confirmed) {
            return;
        }


        const token = getToken();


        if (!token) {

            handleUnauthorized();

            return;
        }


        try {

            setDeletingId(productId);

            setError("");

            setSuccess("");


            const response = await fetch(
                `${API_URL}/products/${productId}`,
                {
                    method: "DELETE",

                    headers: {
                        Accept: "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                }
            );


            /*
            | 401
            */

            if (response.status === 401) {

                handleUnauthorized();

                return;
            }


            /*
            | 403
            */

            if (response.status === 403) {

                setError(
                    "You are not authorized to delete this product."
                );

                return;
            }


            /*
            | 404
            */

            if (response.status === 404) {

                setProducts(
                    currentProducts =>
                        currentProducts.filter(
                            product =>
                                product.id !== productId
                        )
                );

                setError(
                    "The product was not found. It may have already been deleted."
                );

                return;
            }


            /*
            | OTHER ERROR
            */

            if (!response.ok) {

                throw new Error(
                    `Delete failed: ${response.status}`
                );
            }


            /*
            |--------------------------------------------------------------------------
            | UPDATE UI IMMEDIATELY
            |--------------------------------------------------------------------------
            */

            setProducts(
                currentProducts =>
                    currentProducts.filter(
                        product =>
                            product.id !== productId
                    )
            );


            setSuccess(
                "Product deleted successfully!"
            );

        } catch (err) {

            console.error(
                "Delete error:",
                err
            );

            setError(
                "Unable to delete the product. Please check your connection and try again."
            );

        } finally {

            setDeletingId(null);
        }
    };


    /*
    |--------------------------------------------------------------------------
    | IMAGE URL
    |--------------------------------------------------------------------------
    */

    const getImageUrl = (image) => {

        if (!image) {
            return null;
        }


        /*
        | Base64 image
        */

        if (
            image.startsWith("data:image")
        ) {

            return image;
        }


        /*
        | Full URL
        */

        if (
            image.startsWith("http://") ||
            image.startsWith("https://")
        ) {

            return image;
        }


        /*
        | Laravel storage path
        */

        if (
            image.startsWith("/")
        ) {

            return `${SERVER_URL}${image}`;
        }


        return `${SERVER_URL}/storage/${image}`;
    };


    /*
    |--------------------------------------------------------------------------
    | PRICE
    |--------------------------------------------------------------------------
    */

    const formatPrice = (price) => {

        const amount = Number(price);


        if (Number.isNaN(amount)) {

            return "₱0.00";
        }


        return new Intl.NumberFormat(
            "en-PH",
            {
                style: "currency",
                currency: "PHP",
            }
        ).format(amount);
    };


    /*
    |--------------------------------------------------------------------------
    | STATUS
    |--------------------------------------------------------------------------
    */

    const getStatusClass = (status) => {

        if (!status) {
            return "status-default";
        }


        return `status-${status
            .toLowerCase()
            .replace(/\s+/g, "-")}`;
    };


    /*
    |--------------------------------------------------------------------------
    | LOADING
    |--------------------------------------------------------------------------
    */

    if (loading) {

        return (
            <div className="my-products-page">

                <div className="my-products-container">

                    <div className="my-products-loading">

                        <div className="loading-spinner">
                        </div>

                        <h2>
                            Loading My Products
                        </h2>

                        <p>
                            Please wait...
                        </p>

                    </div>

                </div>

            </div>
        );
    }


    /*
    |--------------------------------------------------------------------------
    | PAGE
    |--------------------------------------------------------------------------
    */

    return (
        <div className="my-products-page">

            <div className="my-products-container">


                {/* =====================================================
                    HEADER
                ===================================================== */}

                <header className="my-products-header">

                    <div>

                        <button
                            type="button"
                            className="back-button"
                            onClick={() =>
                                navigate(
                                    "/marketplace"
                                )
                            }
                        >
                            ← Marketplace
                        </button>


                        <h1>
                            My Products
                        </h1>


                        <p>
                            Manage the products you have posted.
                        </p>

                    </div>


                    <button
                        type="button"
                        className="add-product-button"
                        onClick={() =>
                            navigate("/sell")
                        }
                    >
                        + Add Product
                    </button>

                </header>


                {/* =====================================================
                    ERROR
                ===================================================== */}

                {error && (

                    <div className="message error-message">

                        <span>
                            ⚠️
                        </span>

                        <span>
                            {error}
                        </span>

                        <button
                            type="button"
                            onClick={() =>
                                setError("")
                            }
                        >
                            ×
                        </button>

                    </div>

                )}


                {/* =====================================================
                    SUCCESS
                ===================================================== */}

                {success && (

                    <div className="message success-message">

                        <span>
                            ✓
                        </span>

                        <span>
                            {success}
                        </span>

                        <button
                            type="button"
                            onClick={() =>
                                setSuccess("")
                            }
                        >
                            ×
                        </button>

                    </div>

                )}


                {/* =====================================================
                    SUMMARY
                ===================================================== */}

                <div className="products-summary">

                    <div>

                        <strong>
                            {products.length}
                        </strong>

                        <span>
                            {products.length === 1
                                ? " Product"
                                : " Products"}
                        </span>

                    </div>


                    <button
                        type="button"
                        className="refresh-button"
                        onClick={
                            fetchMyProducts
                        }
                    >
                        ↻ Refresh
                    </button>

                </div>


                {/* =====================================================
                    EMPTY
                ===================================================== */}

                {products.length === 0 ? (

                    <div className="empty-products">

                        <div className="empty-icon">
                            📦
                        </div>


                        <h2>
                            No Products Yet
                        </h2>


                        <p>
                            You haven't posted any products yet.
                        </p>


                        <button
                            type="button"
                            className="add-first-product"
                            onClick={() =>
                                navigate("/sell")
                            }
                        >
                            + Post Your First Product
                        </button>

                    </div>

                ) : (


                    /* =================================================
                       PRODUCT GRID
                    ================================================= */

                    <div className="my-products-grid">

                        {products.map(
                            product => {

                                const imageUrl =
                                    getImageUrl(
                                        product.image
                                    );


                                return (

                                    <article
                                        className="my-product-card"
                                        key={product.id}
                                    >


                                        {/* IMAGE */}

                                        <div className="product-image-container">

                                            {imageUrl ? (

                                                <img
                                                    src={imageUrl}
                                                    alt={
                                                        product.name ||
                                                        "Product"
                                                    }
                                                    className="product-image"
                                                />

                                            ) : (

                                                <div className="no-product-image">
                                                    📦
                                                </div>

                                            )}


                                            <span
                                                className={`product-status ${getStatusClass(
                                                    product.status
                                                )}`}
                                            >
                                                {product.status ||
                                                    "Active"}
                                            </span>

                                        </div>


                                        {/* CONTENT */}

                                        <div className="product-card-content">

                                            <h2>
                                                {product.name}
                                            </h2>


                                            <div className="product-price">
                                                {formatPrice(
                                                    product.price
                                                )}
                                            </div>


                                            {product.category && (

                                                <div className="product-category">

                                                    {product.category}

                                                </div>

                                            )}


                                            <p className="product-description">

                                                {product.description ||
                                                    "No description provided."}

                                            </p>


                                            {/* ACTIONS */}

                                            <div className="product-actions">

                                                <button
                                                    type="button"
                                                    className="view-button"
                                                    onClick={() =>
                                                        navigate(
                                                            `/products/${product.id}`
                                                        )
                                                    }
                                                >
                                                    View
                                                </button>


                                                <button
                                                    type="button"
                                                    className="edit-button"
                                                    onClick={() =>
                                                        handleEdit(
                                                            product.id
                                                        )
                                                    }
                                                >
                                                    Edit
                                                </button>


                                                <button
                                                    type="button"
                                                    className="delete-button"
                                                    disabled={
                                                        deletingId ===
                                                        product.id
                                                    }
                                                    onClick={() =>
                                                        handleDelete(
                                                            product.id
                                                        )
                                                    }
                                                >
                                                    {deletingId ===
                                                    product.id
                                                        ? "Deleting..."
                                                        : "Delete"}
                                                </button>

                                            </div>

                                        </div>

                                    </article>
                                );
                            }
                        )}

                    </div>

                )}

            </div>

        </div>
    );
}


export default MyProducts;
