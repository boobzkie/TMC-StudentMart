import { useEffect, useState } from "react";
import {
    Link,
    useNavigate,
    useSearchParams,
} from "react-router-dom";
import "./SellProduct.css";

const API_URL = "http://127.0.0.1:8000/api";
const SERVER_URL = "http://127.0.0.1:8000";

function SellProduct() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const token = localStorage.getItem("token");

    const editId = searchParams.get("edit");
    const isEditMode = Boolean(editId);

    const [user, setUser] = useState(null);

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        price: "",
        category: "",
        image: "",
    });

    const [imagePreview, setImagePreview] = useState("");

    const [loadingUser, setLoadingUser] = useState(true);
    const [loadingProduct, setLoadingProduct] =
        useState(isEditMode);

    const [submitting, setSubmitting] = useState(false);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const categories = [
        "Books",
        "Uniform",
        "Gadgets",
        "School Supplies",
        "Electronics",
        "Clothing",
        "Accessories",
        "Others",
    ];

    useEffect(() => {
        if (!token) {
            navigate("/login", {
                replace: true,
            });

            return;
        }

        fetchUser();
    }, [token, navigate]);

    const fetchUser = async () => {
        try {
            setLoadingUser(true);

            const response = await fetch(
                `${API_URL}/user`,
                {
                    method: "GET",
                    headers: {
                        Accept: "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (response.status === 401) {
                handleLogout();
                return;
            }

            if (!response.ok) {
                throw new Error(
                    "Unable to load your account."
                );
            }

            const data = await response.json();

            setUser(data);

            localStorage.setItem(
                "user",
                JSON.stringify(data)
            );

            localStorage.setItem(
                "role",
                data.role || "student"
            );

            if (isEditMode) {
                await fetchProduct(data);
            }
        } catch (err) {
            console.error(
                "Fetch user error:",
                err
            );

            setError(
                err.message ||
                    "Unable to load your account."
            );

            setLoadingProduct(false);
        } finally {
            setLoadingUser(false);
        }
    };

    const fetchProduct = async (currentUser) => {
        try {
            setLoadingProduct(true);
            setError("");

            const response = await fetch(
                `${API_URL}/products/${editId}`,
                {
                    method: "GET",
                    headers: {
                        Accept: "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (response.status === 401) {
                handleLogout();
                return;
            }

            if (response.status === 403) {
                throw new Error(
                    "You are not allowed to edit this product."
                );
            }

            if (response.status === 404) {
                throw new Error(
                    "The product could not be found."
                );
            }

            if (!response.ok) {
                throw new Error(
                    "Unable to load the product."
                );
            }

            const data = await response.json();

            const product =
                data.product || data;

            if (
                product.user_id &&
                currentUser?.id &&
                Number(product.user_id) !==
                    Number(currentUser.id)
            ) {
                throw new Error(
                    "You can only edit your own products."
                );
            }

            setFormData({
                name: product.name || "",
                description:
                    product.description || "",
                price:
                    product.price !== null &&
                    product.price !== undefined
                        ? String(product.price)
                        : "",
                category:
                    product.category || "",
                image:
                    product.image || "",
            });

            if (product.image) {
                setImagePreview(
                    getImageUrl(product.image)
                );
            } else {
                setImagePreview("");
            }
        } catch (err) {
            console.error(
                "Fetch product error:",
                err
            );

            setError(
                err.message ||
                    "Unable to load the product."
            );
        } finally {
            setLoadingProduct(false);
        }
    };

    const getImageUrl = (image) => {
        if (!image) {
            return "";
        }

        if (
            image.startsWith("data:image/")
        ) {
            return image;
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

    const handleLogout = async () => {
        try {
            if (token) {
                await fetch(
                    `${API_URL}/logout`,
                    {
                        method: "POST",
                        headers: {
                            Accept:
                                "application/json",
                            Authorization:
                                `Bearer ${token}`,
                        },
                    }
                );
            }
        } catch (err) {
            console.error(
                "Logout error:",
                err
            );
        }

        localStorage.removeItem("token");
        localStorage.removeItem("user");
        localStorage.removeItem("role");

        navigate("/login", {
            replace: true,
        });
    };

    const handleChange = (e) => {
        const {
            name,
            value,
        } = e.target;

        setFormData((previous) => ({
            ...previous,
            [name]: value,
        }));

        setError("");
        setSuccess("");
    };

    const handleImageChange = (e) => {
        const file = e.target.files?.[0];

        if (!file) {
            return;
        }

        const allowedTypes = [
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/webp",
        ];

        if (!allowedTypes.includes(file.type)) {
            setError(
                "Please select a JPG, JPEG, PNG, or WEBP image."
            );

            e.target.value = "";

            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            setError(
                "Image size must not exceed 2MB."
            );

            e.target.value = "";

            return;
        }

        const reader = new FileReader();

        reader.onloadend = () => {
            const result =
                reader.result;

            setFormData((previous) => ({
                ...previous,
                image: result,
            }));

            setImagePreview(result);
        };

        reader.readAsDataURL(file);

        setError("");
        setSuccess("");
    };

    const removeImage = () => {
        setFormData((previous) => ({
            ...previous,
            image: "",
        }));

        setImagePreview("");

        const fileInput =
            document.getElementById(
                "product-image"
            );

        if (fileInput) {
            fileInput.value = "";
        }
    };

    const validateForm = () => {
        if (!formData.name.trim()) {
            return "Product name is required.";
        }

        if (
            formData.name.trim().length < 3
        ) {
            return "Product name must be at least 3 characters.";
        }

        if (!formData.price) {
            return "Price is required.";
        }

        const price =
            Number(formData.price);

        if (
            Number.isNaN(price) ||
            price < 0
        ) {
            return "Please enter a valid price.";
        }

        if (!formData.category) {
            return "Please select a category.";
        }

        if (
            formData.description.trim() &&
            formData.description
                .trim()
                .length < 5
        ) {
            return "Description must be at least 5 characters.";
        }

        return "";
    };

    const getApiError = (
        data,
        defaultMessage
    ) => {
        if (data?.errors) {
            const firstError =
                Object.values(
                    data.errors
                )[0];

            if (
                Array.isArray(firstError) &&
                firstError.length > 0
            ) {
                return firstError[0];
            }

            if (
                typeof firstError ===
                "string"
            ) {
                return firstError;
            }
        }

        return (
            data?.message ||
            defaultMessage
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        setError("");
        setSuccess("");

        const validationError =
            validateForm();

        if (validationError) {
            setError(validationError);
            return;
        }

        if (!token) {
            navigate("/login", {
                replace: true,
            });

            return;
        }

        try {
            setSubmitting(true);

            const method =
                isEditMode
                    ? "PUT"
                    : "POST";

            const endpoint =
                isEditMode
                    ? `${API_URL}/products/${editId}`
                    : `${API_URL}/products`;

            /*
             * IMPORTANT:
             * Do NOT send "status".
             *
             * Laravel will automatically
             * set the product to PENDING.
             */
            const body = {
                name:
                    formData.name.trim(),

                description:
                    formData.description.trim(),

                price:
                    Number(
                        formData.price
                    ),

                category:
                    formData.category,

                image:
                    formData.image || null,
            };

            const response =
                await fetch(
                    endpoint,
                    {
                        method,

                        headers: {
                            Accept:
                                "application/json",

                            "Content-Type":
                                "application/json",

                            Authorization:
                                `Bearer ${token}`,
                        },

                        body:
                            JSON.stringify(
                                body
                            ),
                    }
                );

            let data = {};

            try {
                data =
                    await response.json();
            } catch {
                data = {};
            }

            if (
                response.status === 401
            ) {
                handleLogout();
                return;
            }

            if (
                response.status === 403
            ) {
                throw new Error(
                    data.message ||
                        "You are not allowed to submit this product."
                );
            }

            if (
                response.status === 422
            ) {
                throw new Error(
                    getApiError(
                        data,
                        "Please check your product information."
                    )
                );
            }

            if (!response.ok) {
                throw new Error(
                    getApiError(
                        data,
                        isEditMode
                            ? "Failed to update product."
                            : "Failed to submit product."
                    )
                );
            }

            if (isEditMode) {
                setSuccess(
                    "Product updated successfully and submitted for Admin approval."
                );
            } else {
                setSuccess(
                    "Product submitted successfully! Waiting for Admin approval."
                );
            }

            setTimeout(() => {
                navigate(
                    "/my-products",
                    {
                        replace: true,
                    }
                );
            }, 1200);
        } catch (err) {
            console.error(
                "Product submit error:",
                err
            );

            setError(
                err.message ||
                    "Something went wrong while submitting the product."
            );
        } finally {
            setSubmitting(false);
        }
    };

    if (
        loadingUser ||
        loadingProduct
    ) {
        return (
            <div className="sell-product-page">
                <div className="sell-loading">
                    <div className="sell-spinner"></div>

                    <h3>
                        {loadingProduct
                            ? "Loading product..."
                            : "Loading your account..."}
                    </h3>
                </div>
            </div>
        );
    }

    return (
        <div className="sell-product-page">

            <header className="sell-header">

                <div className="sell-header-inner">

                    <Link
                        to="/marketplace"
                        className="sell-brand"
                    >
                        <div className="sell-brand-logo">
                            SM
                        </div>

                        <div>
                            <h1>
                                TMC StudentMart
                            </h1>

                            <span>
                                Trinidad Municipal College
                            </span>
                        </div>
                    </Link>

                    <nav className="sell-navigation">

                        <Link to="/dashboard">
                            Dashboard
                        </Link>

                        <Link to="/marketplace">
                            Marketplace
                        </Link>

                        <Link
                            to="/my-products"
                            className={
                                isEditMode
                                    ? "active"
                                    : ""
                            }
                        >
                            My Products
                        </Link>

                        <Link
                            to="/sell"
                            className={
                                !isEditMode
                                    ? "active"
                                    : ""
                            }
                        >
                            Sell Product
                        </Link>

                    </nav>

                    <div className="sell-user">

                        <div className="sell-user-avatar">
                            {user?.name
                                ? user.name
                                      .charAt(0)
                                      .toUpperCase()
                                : "U"}
                        </div>

                        <div className="sell-user-info">

                            <strong>
                                {user?.name ||
                                    "Student"}
                            </strong>

                            <span>
                                {user?.student_id ||
                                    ""}
                            </span>

                        </div>

                        <button
                            type="button"
                            onClick={
                                handleLogout
                            }
                            className="sell-logout"
                        >
                            Logout
                        </button>

                    </div>

                </div>

            </header>

            <main className="sell-main">

                <div className="sell-page-heading">

                    <Link
                        to={
                            isEditMode
                                ? "/my-products"
                                : "/marketplace"
                        }
                        className="back-marketplace"
                    >
                        ←{" "}
                        {isEditMode
                            ? "Back to My Products"
                            : "Back to Marketplace"}
                    </Link>

                    <span className="sell-label">
                        {isEditMode
                            ? "EDIT YOUR ITEM"
                            : "SELL AN ITEM"}
                    </span>

                    <h2>
                        {isEditMode
                            ? "Edit Your Product"
                            : "Post Your Product"}
                    </h2>

                    <p>
                        {isEditMode
                            ? "Update your product information. Your changes will require Admin approval."
                            : "Sell your school items to fellow TMC students."}
                    </p>

                </div>

                <section className="sell-card">

                    <div className="sell-card-header">

                        <div>
                            <h3>
                                Product Information
                            </h3>

                            <p>
                                {isEditMode
                                    ? "Update your product details and submit them for approval."
                                    : "Provide accurate details about the item you want to sell."}
                            </p>
                        </div>

                        <div className="required-note">
                            * Required
                        </div>

                    </div>

                    {error && (
                        <div
                            className="sell-message error-message"
                            role="alert"
                        >
                            <span>⚠️</span>

                            <p>
                                {error}
                            </p>
                        </div>
                    )}

                    {success && (
                        <div
                            className="sell-message success-message"
                            role="status"
                        >
                            <span>✓</span>

                            <p>
                                {success}
                            </p>
                        </div>
                    )}

                    <form
                        onSubmit={
                            handleSubmit
                        }
                        className="sell-form"
                    >

                        <div className="form-field full-width">

                            <label htmlFor="product-name">
                                Product Name
                                <span>*</span>
                            </label>

                            <input
                                id="product-name"
                                type="text"
                                name="name"
                                value={
                                    formData.name
                                }
                                onChange={
                                    handleChange
                                }
                                placeholder="e.g. Programming Book"
                                maxLength={255}
                                disabled={
                                    submitting
                                }
                                required
                            />

                            <small>
                                Give your product a clear and specific name.
                            </small>

                        </div>

                        <div className="form-field">

                            <label htmlFor="category">
                                Category
                                <span>*</span>
                            </label>

                            <select
                                id="category"
                                name="category"
                                value={
                                    formData.category
                                }
                                onChange={
                                    handleChange
                                }
                                disabled={
                                    submitting
                                }
                                required
                            >
                                <option value="">
                                    Select category
                                </option>

                                {categories.map(
                                    (category) => (
                                        <option
                                            key={
                                                category
                                            }
                                            value={
                                                category
                                            }
                                        >
                                            {category}
                                        </option>
                                    )
                                )}
                            </select>

                        </div>

                        <div className="form-field">

                            <label htmlFor="price">
                                Price
                                <span>*</span>
                            </label>

                            <div className="price-input">

                                <span>₱</span>

                                <input
                                    id="price"
                                    type="number"
                                    name="price"
                                    value={
                                        formData.price
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    placeholder="0.00"
                                    min="0"
                                    step="0.01"
                                    disabled={
                                        submitting
                                    }
                                    required
                                />

                            </div>

                        </div>

                        <div className="form-field full-width">

                            <label htmlFor="description">
                                Description
                            </label>

                            <textarea
                                id="description"
                                name="description"
                                value={
                                    formData.description
                                }
                                onChange={
                                    handleChange
                                }
                                placeholder="Describe the condition, features, or other important details about your item..."
                                rows="6"
                                disabled={
                                    submitting
                                }
                            />

                            <div className="character-count">
                                {
                                    formData
                                        .description
                                        .length
                                }{" "}
                                characters
                            </div>

                        </div>

                        <div className="form-field full-width">

                            <label htmlFor="product-image">
                                Product Image
                            </label>

                            <div className="image-upload-area">

                                {!imagePreview ? (

                                    <label
                                        htmlFor="product-image"
                                        className="image-upload-box"
                                    >

                                        <div className="upload-icon">
                                            📷
                                        </div>

                                        <strong>
                                            Add Product Image
                                        </strong>

                                        <span>
                                            Click to choose an image
                                        </span>

                                        <small>
                                            JPG, JPEG, PNG or WEBP • Maximum 2MB
                                        </small>

                                    </label>

                                ) : (

                                    <div className="image-preview-box">

                                        <img
                                            src={
                                                imagePreview
                                            }
                                            alt="Product preview"
                                        />

                                        <div className="image-preview-actions">

                                            <label
                                                htmlFor="product-image"
                                                className="change-image-button"
                                            >
                                                Change Image
                                            </label>

                                            <button
                                                type="button"
                                                onClick={
                                                    removeImage
                                                }
                                                className="remove-image-button"
                                                disabled={
                                                    submitting
                                                }
                                            >
                                                Remove
                                            </button>

                                        </div>

                                    </div>

                                )}

                                <input
                                    id="product-image"
                                    type="file"
                                    accept="image/jpeg,image/jpg,image/png,image/webp"
                                    onChange={
                                        handleImageChange
                                    }
                                    disabled={
                                        submitting
                                    }
                                    hidden
                                />

                            </div>

                            <small>
                                Use a clear photo so other students can easily identify the item.
                            </small>

                        </div>

                        <div className="seller-preview">

                            <div className="seller-preview-icon">
                                👤
                            </div>

                            <div>

                                <span>
                                    {isEditMode
                                        ? "Editing as"
                                        : "Selling as"}
                                </span>

                                <strong>
                                    {user?.name ||
                                        "Student"}
                                </strong>

                                <small>
                                    Student ID:{" "}
                                    {user?.student_id ||
                                        "N/A"}
                                </small>

                            </div>

                        </div>

                        <div
                            style={{
                                padding:
                                    "16px 18px",
                                background:
                                    "#fff8e1",
                                border:
                                    "1px solid #f5d77a",
                                borderRadius:
                                    "10px",
                                display:
                                    "flex",
                                alignItems:
                                    "center",
                                gap:
                                    "12px",
                            }}
                        >

                            <span
                                style={{
                                    fontSize:
                                        "22px",
                                }}
                            >
                                ⏳
                            </span>

                            <div>

                                <strong
                                    style={{
                                        display:
                                            "block",
                                    }}
                                >
                                    Product Status: Pending
                                </strong>

                                <small>
                                    The Admin must approve this product before it becomes Active.
                                </small>

                            </div>

                        </div>

                        <div className="sell-form-actions">

                            <Link
                                to={
                                    isEditMode
                                        ? "/my-products"
                                        : "/marketplace"
                                }
                                className="cancel-sell-button"
                            >
                                Cancel
                            </Link>

                            <button
                                type="submit"
                                className="post-product-button"
                                disabled={
                                    submitting
                                }
                            >

                                {submitting ? (
                                    <>
                                        <span className="button-spinner"></span>

                                        {isEditMode
                                            ? "Submitting..."
                                            : "Submitting..."}
                                    </>
                                ) : (
                                    isEditMode
                                        ? "Submit Changes for Approval"
                                        : "Submit for Approval"
                                )}

                            </button>

                        </div>

                    </form>

                </section>

            </main>

        </div>
    );
}

export default SellProduct;