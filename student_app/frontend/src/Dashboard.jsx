import "./Dashboard.css";

import {
    useEffect,
    useState,
} from "react";

import {
    useNavigate,
} from "react-router-dom";


const API_URL = "http://127.0.0.1:8000/api";


function Dashboard() {

    const navigate = useNavigate();


    /*
    |--------------------------------------------------------------------------
    | STATE
    |--------------------------------------------------------------------------
    */

    const [user, setUser] = useState(null);

    const [stats, setStats] = useState({
        total_users: 0,
        total_products: 0,
        pending_products: 0,
        total_transactions: 0,
    });

    const [users, setUsers] = useState([]);

    const [products, setProducts] = useState([]);

    const [activeMenu, setActiveMenu] =
        useState("Dashboard");

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    const [search, setSearch] =
        useState("");

    const [mobileMenu, setMobileMenu] =
        useState(false);


    /*
    |--------------------------------------------------------------------------
    | LOAD DASHBOARD
    |--------------------------------------------------------------------------
    */

    useEffect(() => {

        const token =
            localStorage.getItem("token");

        if (!token) {
            navigate("/login");
            return;
        }


        const loadDashboard = async () => {

            try {

                setLoading(true);
                setError("");


                /*
                |--------------------------------------------------------------------------
                | USER
                |--------------------------------------------------------------------------
                */

                const userResponse =
                    await fetch(
                        `${API_URL}/user`,
                        {
                            method: "GET",

                            headers: {
                                Accept:
                                    "application/json",

                                Authorization:
                                    `Bearer ${token}`,
                            },
                        }
                    );


                const userData =
                    await userResponse.json();


                if (!userResponse.ok) {

                    localStorage.removeItem(
                        "token"
                    );

                    localStorage.removeItem(
                        "user"
                    );

                    localStorage.removeItem(
                        "role"
                    );

                    navigate("/login");

                    return;
                }


                setUser(userData);

                localStorage.setItem(
                    "user",
                    JSON.stringify(userData)
                );


                /*
                |--------------------------------------------------------------------------
                | ADMIN STATS
                |--------------------------------------------------------------------------
                */

                const statsResponse =
                    await fetch(
                        `${API_URL}/admin/stats`,
                        {
                            headers: {
                                Accept:
                                    "application/json",

                                Authorization:
                                    `Bearer ${token}`,
                            },
                        }
                    );


                if (statsResponse.ok) {

                    const statsData =
                        await statsResponse.json();

                    setStats(
                        statsData
                    );
                }


                /*
                |--------------------------------------------------------------------------
                | USERS
                |--------------------------------------------------------------------------
                */

                const usersResponse =
                    await fetch(
                        `${API_URL}/admin/users`,
                        {
                            headers: {
                                Accept:
                                    "application/json",

                                Authorization:
                                    `Bearer ${token}`,
                            },
                        }
                    );


                if (usersResponse.ok) {

                    const usersData =
                        await usersResponse.json();


                    setUsers(
                        Array.isArray(usersData)
                            ? usersData
                            : []
                    );
                }


                /*
                |--------------------------------------------------------------------------
                | PRODUCTS
                |--------------------------------------------------------------------------
                */

                const productsResponse =
                    await fetch(
                        `${API_URL}/products`,
                        {
                            headers: {
                                Accept:
                                    "application/json",

                                Authorization:
                                    `Bearer ${token}`,
                            },
                        }
                    );


                if (productsResponse.ok) {

                    const productsData =
                        await productsResponse.json();


                    if (
                        Array.isArray(
                            productsData
                        )
                    ) {

                        setProducts(
                            productsData
                        );

                    } else if (
                        Array.isArray(
                            productsData.data
                        )
                    ) {

                        setProducts(
                            productsData.data
                        );

                    } else {

                        setProducts([]);
                    }
                }


            } catch (err) {

                console.error(
                    "Dashboard connection error:",
                    err
                );

                setError(
                    "Unable to connect to the server."
                );

            } finally {

                setLoading(false);
            }
        };


        loadDashboard();

    }, [navigate]);


    /*
    |--------------------------------------------------------------------------
    | LOGOUT
    |--------------------------------------------------------------------------
    */

    const logout = async () => {

        const token =
            localStorage.getItem("token");


        try {

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

        } catch (error) {

            console.error(error);
        }


        localStorage.removeItem(
            "token"
        );

        localStorage.removeItem(
            "user"
        );

        localStorage.removeItem(
            "role"
        );


        navigate(
            "/login",
            { replace: true }
        );
    };


    /*
    |--------------------------------------------------------------------------
    | SIDEBAR
    |--------------------------------------------------------------------------
    */

    const menuItems = [

        {
            name: "Dashboard",
            icon: "📊",
        },

        {
            name: "Users",
            icon: "👥",
        },

        {
            name: "Products",
            icon: "📦",
        },

        {
            name: "Transactions",
            icon: "💳",
        },

        {
            name: "Reports",
            icon: "📈",
        },

        {
            name: "Settings",
            icon: "⚙️",
        },

    ];


    /*
    |--------------------------------------------------------------------------
    | FILTER USERS
    |--------------------------------------------------------------------------
    */

    const filteredUsers =
        users.filter((item) => {

            const value =
                `${item.name || ""} ${item.student_id || ""} ${item.email || ""}`
                    .toLowerCase();

            return value.includes(
                search.toLowerCase()
            );
        });


    /*
    |--------------------------------------------------------------------------
    | FILTER PRODUCTS
    |--------------------------------------------------------------------------
    */

    const filteredProducts =
        products.filter((item) => {

            const value =
                `${item.name || ""} ${item.category || ""}`
                    .toLowerCase();

            return value.includes(
                search.toLowerCase()
            );
        });


    /*
    |--------------------------------------------------------------------------
    | PENDING PRODUCTS
    |--------------------------------------------------------------------------
    */

    const pendingProducts =
        products.filter(
            (product) =>
                !product.status ||
                String(
                    product.status
                ).toLowerCase() === "pending"
        );


    /*
    |--------------------------------------------------------------------------
    | MENU SELECT
    |--------------------------------------------------------------------------
    */

    const selectMenu = (name) => {

        setActiveMenu(name);

        setSearch("");

        setMobileMenu(false);
    };


    /*
    |--------------------------------------------------------------------------
    | LOADING
    |--------------------------------------------------------------------------
    */

    if (loading) {

        return (

            <div className="admin-loading">

                <div className="loading-box">

                    <div className="loading-icon">
                        📊
                    </div>

                    <div className="loading-spinner"></div>

                    <h2>
                        Loading StudentMart
                    </h2>

                    <p>
                        Preparing administrator dashboard...
                    </p>

                </div>

            </div>
        );
    }


    /*
    |--------------------------------------------------------------------------
    | ADMIN DASHBOARD
    |--------------------------------------------------------------------------
    */

    return (

        <div className="admin-dashboard">


            {/* =====================================================
                HEADER
            ===================================================== */}

            <header className="admin-header">

                <div className="header-brand">

                    <button
                        className="mobile-menu-button"
                        onClick={() =>
                            setMobileMenu(
                                !mobileMenu
                            )
                        }
                    >
                        ☰
                    </button>


                    <div className="header-logo">
                        🎓
                    </div>


                    <div>

                        <h1>
                            TMC StudentMart
                        </h1>

                        <p>
                            Administrator Panel
                        </p>

                    </div>

                </div>


                <div className="header-right">


                    <div className="admin-profile">

                        <div className="admin-avatar">

                            {user?.profile_picture ? (

                                <img
                                    src={
                                        user.profile_picture
                                    }
                                    alt="Admin"
                                />

                            ) : (
                                "👤"
                            )}

                        </div>


                        <div>

                            <strong>
                                {user?.name ||
                                    "Administrator"}
                            </strong>

                            <span>
                                Administrator
                            </span>

                        </div>

                    </div>


                    <button
                        className="header-logout"
                        onClick={logout}
                    >
                        🚪 Logout
                    </button>

                </div>

            </header>


            {/* =====================================================
                SIDEBAR
            ===================================================== */}

            <aside
                className={
                    mobileMenu
                        ? "admin-sidebar mobile-open"
                        : "admin-sidebar"
                }
            >

                <div className="sidebar-title">
                    ADMIN MENU
                </div>


                <div className="admin-menu-list">

                    {menuItems.map(
                        (item) => (

                            <button
                                key={item.name}
                                className={
                                    activeMenu ===
                                    item.name
                                        ? "admin-menu active"
                                        : "admin-menu"
                                }
                                onClick={() =>
                                    selectMenu(
                                        item.name
                                    )
                                }
                            >

                                <span className="menu-icon">
                                    {item.icon}
                                </span>

                                <span>
                                    {item.name}
                                </span>

                            </button>

                        )
                    )}


                    <button
                        className="admin-menu logout-menu"
                        onClick={logout}
                    >

                        <span className="menu-icon">
                            🚪
                        </span>

                        <span>
                            Logout
                        </span>

                    </button>

                </div>

            </aside>


            {/* =====================================================
                MAIN CONTENT
            ===================================================== */}

            <main className="admin-content">


                {error && (

                    <div className="dashboard-error">
                        ⚠️ {error}
                    </div>

                )}


                {/* =================================================
                    DASHBOARD
                ================================================= */}

                {activeMenu === "Dashboard" && (

                    <section className="dashboard-page">

                        <div className="page-heading">

                            <div>

                                <span className="page-label">
                                    ADMINISTRATOR
                                </span>

                                <h2>
                                    Dashboard Overview
                                </h2>

                                <p>
                                    Monitor your Student Marketplace System.
                                </p>

                            </div>


                            <div className="admin-badge">
                                ADMIN
                            </div>

                        </div>


                        {/* STATISTICS */}

                        <div className="stats-grid">


                            <div className="stat-card">

                                <div className="stat-icon blue">
                                    👥
                                </div>

                                <div>

                                    <span>
                                        Total Users
                                    </span>

                                    <strong>
                                        {stats.total_users}
                                    </strong>

                                    <small>
                                        Registered students
                                    </small>

                                </div>

                            </div>


                            <div className="stat-card">

                                <div className="stat-icon purple">
                                    📦
                                </div>

                                <div>

                                    <span>
                                        Total Products
                                    </span>

                                    <strong>
                                        {stats.total_products}
                                    </strong>

                                    <small>
                                        Products posted
                                    </small>

                                </div>

                            </div>


                            <div className="stat-card">

                                <div className="stat-icon yellow">
                                    ⏳
                                </div>

                                <div>

                                    <span>
                                        Pending Products
                                    </span>

                                    <strong>
                                        {stats.pending_products}
                                    </strong>

                                    <small>
                                        Need moderation
                                    </small>

                                </div>

                            </div>


                            <div className="stat-card">

                                <div className="stat-icon red">
                                    💳
                                </div>

                                <div>

                                    <span>
                                        Transactions
                                    </span>

                                    <strong>
                                        {stats.total_transactions}
                                    </strong>

                                    <small>
                                        Not available yet
                                    </small>

                                </div>

                            </div>

                        </div>


                        {/* LOWER DASHBOARD */}

                        <div className="dashboard-bottom">


                            <div className="activity-card">

                                <div className="section-header">

                                    <div>

                                        <h3>
                                            Recent Activities
                                        </h3>

                                        <p>
                                            Latest system activity
                                        </p>

                                    </div>

                                </div>


                                <div className="activity-list">


                                    <div className="activity-item">

                                        <span className="activity-dot blue-dot"></span>

                                        <div>

                                            <strong>
                                                Registered Users
                                            </strong>

                                            <p>
                                                {stats.total_users}
                                                {" "}
                                                user(s) currently registered.
                                            </p>

                                        </div>

                                    </div>


                                    <div className="activity-item">

                                        <span className="activity-dot green-dot"></span>

                                        <div>

                                            <strong>
                                                Products Posted
                                            </strong>

                                            <p>
                                                {stats.total_products}
                                                {" "}
                                                product(s) currently in database.
                                            </p>

                                        </div>

                                    </div>


                                    <div className="activity-item">

                                        <span className="activity-dot yellow-dot"></span>

                                        <div>

                                            <strong>
                                                Products Awaiting Moderation
                                            </strong>

                                            <p>
                                                {stats.pending_products}
                                                {" "}
                                                product(s) need review.
                                            </p>

                                        </div>

                                    </div>


                                    <div className="activity-item">

                                        <span className="activity-dot red-dot"></span>

                                        <div>

                                            <strong>
                                                Transactions
                                            </strong>

                                            <p>
                                                Transaction database is not available yet.
                                            </p>

                                        </div>

                                    </div>

                                </div>

                            </div>


                            <div className="summary-card">

                                <h3>
                                    System Summary
                                </h3>


                                <div className="summary-row">

                                    <span>
                                        Users
                                    </span>

                                    <strong>
                                        {stats.total_users}
                                    </strong>

                                </div>


                                <div className="summary-row">

                                    <span>
                                        Products
                                    </span>

                                    <strong>
                                        {stats.total_products}
                                    </strong>

                                </div>


                                <div className="summary-row">

                                    <span>
                                        Pending
                                    </span>

                                    <strong>
                                        {stats.pending_products}
                                    </strong>

                                </div>


                                <div className="summary-row">

                                    <span>
                                        Transactions
                                    </span>

                                    <strong>
                                        {stats.total_transactions}
                                    </strong>

                                </div>

                            </div>

                        </div>

                    </section>
                )}


                {/* =================================================
                    USERS
                ================================================= */}

                {activeMenu === "Users" && (

                    <section>

                        <div className="page-heading">

                            <div>

                                <span className="page-label">
                                    MANAGEMENT
                                </span>

                                <h2>
                                    Manage Users
                                </h2>

                                <p>
                                    Registered users from the database.
                                </p>

                            </div>

                        </div>


                        <div className="table-card">

                            <div className="table-top">

                                <div>

                                    <h3>
                                        User List
                                    </h3>

                                    <span>
                                        {filteredUsers.length} users
                                    </span>

                                </div>


                                <input
                                    className="table-search"
                                    type="text"
                                    placeholder="Search users..."
                                    value={search}
                                    onChange={(e) =>
                                        setSearch(
                                            e.target.value
                                        )
                                    }
                                />

                            </div>


                            <div className="table-wrapper">

                                <table>

                                    <thead>

                                        <tr>

                                            <th>ID</th>
                                            <th>Name</th>
                                            <th>Student ID</th>
                                            <th>Email</th>
                                            <th>Contact</th>
                                            <th>Role</th>
                                            <th>Status</th>

                                        </tr>

                                    </thead>


                                    <tbody>

                                        {filteredUsers.length >
                                        0 ? (

                                            filteredUsers.map(
                                                (item) => (

                                                    <tr
                                                        key={
                                                            item.id
                                                        }
                                                    >

                                                        <td>
                                                            {item.id}
                                                        </td>

                                                        <td>
                                                            <strong>
                                                                {
                                                                    item.name
                                                                }
                                                            </strong>
                                                        </td>

                                                        <td>
                                                            {
                                                                item.student_id ||
                                                                "—"
                                                            }
                                                        </td>

                                                        <td>
                                                            {
                                                                item.email
                                                            }
                                                        </td>

                                                        <td>
                                                            {
                                                                item.contact_number ||
                                                                "—"
                                                            }
                                                        </td>

                                                        <td>

                                                            <span className="role-badge">

                                                                {
                                                                    item.role ||
                                                                    "student"
                                                                }

                                                            </span>

                                                        </td>

                                                        <td>

                                                            <span
                                                                className={
                                                                    String(
                                                                        item.status ||
                                                                        "active"
                                                                    ).toLowerCase() ===
                                                                    "active"
                                                                        ? "status approved"
                                                                        : "status suspended"
                                                                }
                                                            >

                                                                {
                                                                    item.status ||
                                                                    "active"
                                                                }

                                                            </span>

                                                        </td>

                                                    </tr>

                                                )
                                            )

                                        ) : (

                                            <tr>

                                                <td
                                                    colSpan="7"
                                                    className="empty-table"
                                                >
                                                    No users found.
                                                </td>

                                            </tr>

                                        )}

                                    </tbody>

                                </table>

                            </div>

                        </div>

                    </section>
                )}


                {/* =================================================
                    PRODUCTS
                ================================================= */}

                {activeMenu === "Products" && (

                    <section>

                        <div className="page-heading">

                            <div>

                                <span className="page-label">
                                    MARKETPLACE
                                </span>

                                <h2>
                                    Manage Products
                                </h2>

                                <p>
                                    View products currently posted in StudentMart.
                                </p>

                            </div>

                        </div>


                        <div className="table-card">

                            <div className="table-top">

                                <div>

                                    <h3>
                                        Product List
                                    </h3>

                                    <span>
                                        {filteredProducts.length} products
                                    </span>

                                </div>


                                <input
                                    className="table-search"
                                    type="text"
                                    placeholder="Search products..."
                                    value={search}
                                    onChange={(e) =>
                                        setSearch(
                                            e.target.value
                                        )
                                    }
                                />

                            </div>


                            <div className="table-wrapper">

                                <table>

                                    <thead>

                                        <tr>

                                            <th>ID</th>
                                            <th>Product</th>
                                            <th>Category</th>
                                            <th>Price</th>
                                            <th>Status</th>
                                            <th>Action</th>

                                        </tr>

                                    </thead>


                                    <tbody>

                                        {filteredProducts.length >
                                        0 ? (

                                            filteredProducts.map(
                                                (product) => {

                                                    const status =
                                                        product.status ||
                                                        "pending";

                                                    return (

                                                        <tr
                                                            key={
                                                                product.id
                                                            }
                                                        >

                                                            <td>
                                                                {
                                                                    product.id
                                                                }
                                                            </td>

                                                            <td>
                                                                <strong>
                                                                    {
                                                                        product.name
                                                                    }
                                                                </strong>
                                                            </td>

                                                            <td>
                                                                {
                                                                    product.category ||
                                                                    "—"
                                                                }
                                                            </td>

                                                            <td>
                                                                ₱
                                                                {Number(
                                                                    product.price ||
                                                                    0
                                                                ).toLocaleString()}
                                                            </td>

                                                            <td>

                                                                <span
                                                                    className={
                                                                        String(
                                                                            status
                                                                        ).toLowerCase() ===
                                                                        "approved"
                                                                            ? "status approved"
                                                                            : "status pending"
                                                                    }
                                                                >
                                                                    {
                                                                        status
                                                                    }
                                                                </span>

                                                            </td>

                                                            <td>

                                                                <button
                                                                    className="view-btn"
                                                                    onClick={() =>
                                                                        alert(
                                                                            `Product ID: ${product.id}\nProduct: ${product.name}`
                                                                        )
                                                                    }
                                                                >
                                                                    View
                                                                </button>

                                                            </td>

                                                        </tr>

                                                    );
                                                }
                                            )

                                        ) : (

                                            <tr>

                                                <td
                                                    colSpan="6"
                                                    className="empty-table"
                                                >
                                                    No products found.
                                                </td>

                                            </tr>

                                        )}

                                    </tbody>

                                </table>

                            </div>

                        </div>

                    </section>
                )}


                {/* =================================================
                    TRANSACTIONS
                ================================================= */}

                {activeMenu === "Transactions" && (

                    <section>

                        <div className="page-heading">

                            <div>

                                <span className="page-label">
                                    TRANSACTIONS
                                </span>

                                <h2>
                                    Transactions
                                </h2>

                                <p>
                                    Transaction management.
                                </p>

                            </div>

                        </div>


                        <div className="empty-section">

                            <div>
                                💳
                            </div>

                            <h3>
                                Transactions Database Not Available Yet
                            </h3>

                            <p>
                                There is currently no transactions table
                                in the database, so no fake transaction
                                records are displayed.
                            </p>

                        </div>

                    </section>
                )}


                {/* =================================================
                    REPORTS
                ================================================= */}

                {activeMenu === "Reports" && (

                    <section>

                        <div className="page-heading">

                            <div>

                                <span className="page-label">
                                    ANALYTICS
                                </span>

                                <h2>
                                    Reports & Analytics
                                </h2>

                                <p>
                                    Current statistics from the database.
                                </p>

                            </div>

                        </div>


                        <div className="report-grid">


                            <div className="report-card">

                                <span>
                                    Registered Users
                                </span>

                                <strong>
                                    {stats.total_users}
                                </strong>

                                <p>
                                    Total records in users table
                                </p>

                            </div>


                            <div className="report-card">

                                <span>
                                    Products
                                </span>

                                <strong>
                                    {stats.total_products}
                                </strong>

                                <p>
                                    Total records in products table
                                </p>

                            </div>


                            <div className="report-card">

                                <span>
                                    Pending Products
                                </span>

                                <strong>
                                    {stats.pending_products}
                                </strong>

                                <p>
                                    Products currently pending
                                </p>

                            </div>


                        </div>

                    </section>
                )}


                {/* =================================================
                    SETTINGS
                ================================================= */}

                {activeMenu === "Settings" && (

                    <section>

                        <div className="page-heading">

                            <div>

                                <span className="page-label">
                                    SYSTEM
                                </span>

                                <h2>
                                    Settings
                                </h2>

                                <p>
                                    Manage administrator settings.
                                </p>

                            </div>

                        </div>


                        <div className="settings-card">


                            <div className="setting-item">

                                <div>

                                    <strong>
                                        Administrator Profile
                                    </strong>

                                    <p>
                                        {user?.name ||
                                            "Administrator"}
                                    </p>

                                </div>

                                <span>
                                    👤
                                </span>

                            </div>


                            <div className="setting-item">

                                <div>

                                    <strong>
                                        Email
                                    </strong>

                                    <p>
                                        {user?.email ||
                                            "Not available"}
                                    </p>

                                </div>

                                <span>
                                    ✉️
                                </span>

                            </div>


                            <div className="setting-item">

                                <div>

                                    <strong>
                                        Account Status
                                    </strong>

                                    <p>
                                        Active administrator account
                                    </p>

                                </div>

                                <span>
                                    🟢
                                </span>

                            </div>


                            <div className="setting-item">

                                <div>

                                    <strong>
                                        Security
                                    </strong>

                                    <p>
                                        Your account is protected by authentication.
                                    </p>

                                </div>

                                <span>
                                    🔐
                                </span>

                            </div>


                            <div className="setting-item">

                                <div>

                                    <strong>
                                        Language
                                    </strong>

                                    <p>
                                        English
                                    </p>

                                </div>

                                <span>
                                    🌐
                                </span>

                            </div>


                        </div>

                    </section>
                )}

            </main>

        </div>
    );
}


export default Dashboard;