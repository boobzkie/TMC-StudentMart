import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Login.css";

function Login() {
    const navigate = useNavigate();

    const [form, setForm] = useState({
        email: "",
        password: "",
    });

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    /*
    |--------------------------------------------------------------------------
    | INPUT CHANGE
    |--------------------------------------------------------------------------
    */

    const handleChange = (e) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value,
        });

        // Clear error while user is typing
        if (error) {
            setError("");
        }
    };


    /*
    |--------------------------------------------------------------------------
    | LOGIN
    |--------------------------------------------------------------------------
    */

    const handleSubmit = async (e) => {
        e.preventDefault();

        setError("");
        setLoading(true);

        if (!form.email.trim() || !form.password) {
            setError(
                "Please enter your Student ID/Email and password."
            );

            setLoading(false);
            return;
        }

        try {
            const response = await fetch(
                "http://127.0.0.1:8000/api/login",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                    },

                    body: JSON.stringify({
                        email: form.email,
                        password: form.password,
                    }),
                }
            );

            const data = await response.json();


            /*
            |--------------------------------------------------------------------------
            | LOGIN ERROR
            |--------------------------------------------------------------------------
            */

            if (!response.ok) {
                setError(
                    data.message ||
                    "Invalid email, Student ID, or password."
                );

                setLoading(false);
                return;
            }


            /*
            |--------------------------------------------------------------------------
            | SAVE AUTHENTICATION
            |--------------------------------------------------------------------------
            */

            localStorage.setItem(
                "token",
                data.token
            );

            localStorage.setItem(
                "user",
                JSON.stringify(data.user)
            );

            localStorage.setItem(
                "role",
                data.role
            );


            /*
            |--------------------------------------------------------------------------
            | REMEMBER ME
            |--------------------------------------------------------------------------
            */

            if (rememberMe) {
                localStorage.setItem(
                    "rememberedEmail",
                    form.email
                );
            } else {
                localStorage.removeItem(
                    "rememberedEmail"
                );
            }


            /*
            |--------------------------------------------------------------------------
            | ROLE-BASED REDIRECT
            |--------------------------------------------------------------------------
            */

            if (data.role === "admin") {
                navigate(
                    "/admin/dashboard",
                    {
                        replace: true,
                    }
                );
            } else {
                navigate(
                    "/dashboard",
                    {
                        replace: true,
                    }
                );
            }

        } catch (error) {

            console.error(
                "Login error:",
                error
            );

            setError(
                "Cannot connect to Laravel server. Make sure Laravel is running."
            );

        } finally {

            setLoading(false);

        }
    };


    /*
    |--------------------------------------------------------------------------
    | LOAD REMEMBERED EMAIL
    |--------------------------------------------------------------------------
    */

    useState(() => {
        const savedEmail =
            localStorage.getItem(
                "rememberedEmail"
            );

        if (savedEmail) {
            setForm((previous) => ({
                ...previous,
                email: savedEmail,
            }));

            setRememberMe(true);
        }
    });


    return (
        <div className="login-page">

            {/* =====================================================
                LEFT BRANDING
            ===================================================== */}

            <section
                className="login-left"
                aria-label="TMC StudentMart information"
            >

                {/* Decorative circle */}
                <div
                    className="login-decoration"
                    aria-hidden="true"
                ></div>


                {/* Brand */}
                <div className="login-branding">

                    <div
                        className="login-logo"
                        aria-hidden="true"
                    >
                        🛒
                    </div>

                    <div>
                        <h1>
                            TMC StudentMart
                        </h1>

                        <p>
                            Buy • Sell • Connect
                        </p>
                    </div>

                </div>


                {/* Welcome */}
                <h2 className="login-welcome">
                    Welcome Back!
                </h2>

                <p className="login-description">
                    Your student marketplace for buying
                    and selling books, uniforms, gadgets,
                    and other school-related items.
                </p>


                {/* Features */}
                <div className="login-features">

                    <div className="login-feature">

                        <div
                            className="feature-icon"
                            aria-hidden="true"
                        >
                            🛍️
                        </div>

                        <div>
                            <h3>
                                Buy &amp; Sell
                            </h3>

                            <p>
                                Easily buy and sell
                                items with other students.
                            </p>
                        </div>

                    </div>


                    <div className="login-feature">

                        <div
                            className="feature-icon"
                            aria-hidden="true"
                        >
                            🔎
                        </div>

                        <div>
                            <h3>
                                Easy Search
                            </h3>

                            <p>
                                Find products quickly
                                using categories and search.
                            </p>
                        </div>

                    </div>


                    <div className="login-feature">

                        <div
                            className="feature-icon"
                            aria-hidden="true"
                        >
                            👥
                        </div>

                        <div>
                            <h3>
                                Student Community
                            </h3>

                            <p>
                                Connect with other
                                students through the marketplace.
                            </p>
                        </div>

                    </div>


                    <div className="login-feature">

                        <div
                            className="feature-icon"
                            aria-hidden="true"
                        >
                            🔐
                        </div>

                        <div>
                            <h3>
                                Secure Access
                            </h3>

                            <p>
                                Your account and marketplace
                                activities are protected.
                            </p>
                        </div>

                    </div>

                </div>

            </section>


            {/* =====================================================
                RIGHT LOGIN SECTION
            ===================================================== */}

            <section
                className="login-right"
                aria-label="Login"
            >

                <div className="auth-card login-card">

                    {/* Brand */}
                    <div className="login-brand">

                        <div
                            className="login-logo"
                            aria-hidden="true"
                        >
                            🛒
                        </div>

                        <div>
                            <h1>
                                STUDENT MARKETPLACE
                            </h1>

                            <p>
                                Buy • Sell • Connect
                            </p>
                        </div>

                    </div>


                    {/* Heading */}
                    <div className="login-heading">

                        <h2>
                            Welcome Back!
                        </h2>

                        <p>
                            Login to continue to your account
                        </p>

                    </div>


                    {/* Error */}
                    {error && (
                        <div
                            className="login-error"
                            role="alert"
                            aria-live="polite"
                        >
                            {error}
                        </div>
                    )}


                    {/* Form */}
                    <form
                        onSubmit={handleSubmit}
                    >

                        {/* Student ID / Email */}
                        <div className="form-group">

                            <label htmlFor="login-email">
                                Student ID or Email
                            </label>

                            <input
                                id="login-email"
                                type="text"
                                name="email"
                                value={form.email}
                                onChange={handleChange}
                                placeholder="Enter Student ID or Email"
                                autoComplete="username"
                                required
                            />

                        </div>


                        {/* Password */}
                        <div className="form-group">

                            <label htmlFor="login-password">
                                Password
                            </label>

                            <input
                                id="login-password"
                                type="password"
                                name="password"
                                value={form.password}
                                onChange={handleChange}
                                placeholder="Enter your password"
                                autoComplete="current-password"
                                required
                            />

                        </div>


                        {/* Remember + Forgot */}
                        <div className="login-options">

                            <label
                                htmlFor="remember-me"
                                className="remember-me"
                            >

                                <input
                                    id="remember-me"
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) =>
                                        setRememberMe(
                                            e.target.checked
                                        )
                                    }
                                />

                                <span>
                                    Remember Me
                                </span>

                            </label>


                            <button
                                type="button"
                                className="forgot-button"
                                onClick={() =>
                                    setError(
                                        "Password recovery will be implemented in a later phase."
                                    )
                                }
                            >
                                Forgot Password?
                            </button>

                        </div>


                        {/* Login button */}
                        <button
                            type="submit"
                            className="login-button"
                            disabled={loading}
                        >
                            {loading
                                ? "Logging in..."
                                : "LOGIN"}
                        </button>


                        {/* Register */}
                        <p className="register-link">

                            Don't have an account?

                            {" "}

                            <Link to="/register">
                                Create Account
                            </Link>

                        </p>

                    </form>

                </div>

            </section>

        </div>
    );
}

export default Login;