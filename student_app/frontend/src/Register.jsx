import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./register.css";

function Register() {

    const navigate = useNavigate();

    const [form, setForm] = useState({
        name: "",
        student_id: "",
        email: "",
        contact_number: "",
        password: "",
        password_confirmation: "",
    });

    const [photo, setPhoto] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);

    const [agree, setAgree] = useState(false);

    const [error, setError] = useState("");

    const [success, setSuccess] = useState("");

    const [loading, setLoading] = useState(false);


    /*
    |--------------------------------------------------------------------------
    | INPUT CHANGE
    |--------------------------------------------------------------------------
    */

    const handleChange = (e) => {

        const { name, value } = e.target;

        setForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    };


    /*
    |--------------------------------------------------------------------------
    | PROFILE PHOTO
    |--------------------------------------------------------------------------
    */

    const handlePhoto = (e) => {

        const file = e.target.files?.[0];

        if (!file) {
            return;
        }

        /*
        |--------------------------------------------------------------------------
        | CLIENT-SIDE VALIDATION
        |--------------------------------------------------------------------------
        */

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
        ];

        if (!allowedTypes.includes(file.type)) {

            setError(
                "Please select a JPG, PNG, or WEBP image."
            );

            return;
        }

        if (file.size > 2 * 1024 * 1024) {

            setError(
                "Profile picture must not exceed 2MB."
            );

            return;
        }

        setPhoto(file);

        setPhotoPreview(
            URL.createObjectURL(file)
        );
    };


    /*
    |--------------------------------------------------------------------------
    | REGISTER
    |--------------------------------------------------------------------------
    */

    const handleSubmit = async (e) => {

        e.preventDefault();

        setError("");

        setSuccess("");


        /*
        |--------------------------------------------------------------------------
        | TERMS
        |--------------------------------------------------------------------------
        */

        if (!agree) {

            setError(
                "Please agree to the Terms and Conditions."
            );

            return;
        }


        /*
        |--------------------------------------------------------------------------
        | PASSWORD
        |--------------------------------------------------------------------------
        */

        if (
            form.password !==
            form.password_confirmation
        ) {

            setError(
                "Passwords do not match."
            );

            return;
        }


        /*
        |--------------------------------------------------------------------------
        | PASSWORD LENGTH
        |--------------------------------------------------------------------------
        */

        if (form.password.length < 8) {

            setError(
                "Password must contain at least 8 characters."
            );

            return;
        }


        setLoading(true);


        try {

            const formData = new FormData();

            formData.append(
                "name",
                form.name
            );

            formData.append(
                "student_id",
                form.student_id
            );

            formData.append(
                "email",
                form.email
            );

            formData.append(
                "contact_number",
                form.contact_number
            );

            formData.append(
                "password",
                form.password
            );

            formData.append(
                "password_confirmation",
                form.password_confirmation
            );


            if (photo) {

                formData.append(
                    "profile_picture",
                    photo
                );
            }


            const response = await fetch(
                "http://127.0.0.1:8000/api/register",
                {
                    method: "POST",

                    headers: {
                        Accept:
                            "application/json",
                    },

                    body: formData,
                }
            );


            const data =
                await response.json();


            /*
            |--------------------------------------------------------------------------
            | ERROR
            |--------------------------------------------------------------------------
            */

            if (!response.ok) {

                if (data.errors) {

                    const errors =
                        Object.values(
                            data.errors
                        );

                    const firstError =
                        errors[0];

                    setError(
                        Array.isArray(firstError)
                            ? firstError[0]
                            : firstError
                    );

                } else {

                    setError(
                        data.message ||
                        "Registration failed."
                    );
                }

                setLoading(false);

                return;
            }


            /*
            |--------------------------------------------------------------------------
            | SUCCESS
            |--------------------------------------------------------------------------
            */

            setSuccess(
                "Registration successful! Redirecting to login..."
            );


            setTimeout(() => {

                navigate("/login");

            }, 1500);


        } catch (error) {

            console.error(
                "Registration error:",
                error
            );

            setError(
                "Cannot connect to Laravel server. Make sure Laravel is running."
            );

        } finally {

            setLoading(false);
        }
    };


    return (

        <div className="register-page">

            {/* LEFT SIDE */}

            <div className="register-left">

                <div className="register-brand">

                    <div className="brand-logo">
                        🛒
                    </div>

                    <div>

                        <div className="brand-title">
                            STUDENT MARKETPLACE
                        </div>

                        <div className="brand-subtitle">
                            Buy • Sell • Connect
                        </div>

                    </div>

                </div>


                <div className="register-badge">
                    🎓
                    <span>
                        Built For Students, By Students
                    </span>
                </div>


                <div className="register-hero">

                    <h1>
                        Join the Student
                        <br />
                        <span>Marketplace</span>
                    </h1>

                    <p>
                        Create your account and become
                        part of a growing community where
                        students buy, sell, and connect.
                    </p>

                </div>


                <div className="register-features">

                    <div className="register-feature">

                        <div className="register-feature-icon">
                            🛒
                        </div>

                        <div>

                            <h3>
                                Buy & Sell Easily
                            </h3>

                            <p>
                                Find great deals or sell
                                your items to fellow students.
                            </p>

                        </div>

                    </div>


                    <div className="register-feature">

                        <div className="register-feature-icon">
                            👥
                        </div>

                        <div>

                            <h3>
                                Student Community
                            </h3>

                            <p>
                                Connect with other students
                                and trade useful school items.
                            </p>

                        </div>

                    </div>


                    <div className="register-feature">

                        <div className="register-feature-icon">
                            🔒
                        </div>

                        <div>

                            <h3>
                                Safe Marketplace
                            </h3>

                            <p>
                                Your account and transactions
                                are protected.
                            </p>

                        </div>

                    </div>

                </div>

            </div>


            {/* RIGHT SIDE */}

            <div className="register-right">

                <div className="auth-card register-card">

                    <div className="card-brand">

                        <span className="card-cart">
                            🛒
                        </span>

                        <span>
                            Student Marketplace
                        </span>

                    </div>


                    <div className="account-icon">
                        👤
                    </div>


                    <h2 className="register-title">
                        Create <span>Account</span>
                    </h2>


                    <p className="register-subtitle">
                        Join our student marketplace
                        and get started today!
                    </p>


                    {error && (

                        <div className="register-error">
                            {error}
                        </div>

                    )}


                    {success && (

                        <div className="register-success">
                            {success}
                        </div>

                    )}


                    <form
                        onSubmit={handleSubmit}
                    >

                        <div className="form-grid">


                            {/* FULL NAME */}

                            <div className="form-group">

                                <label>
                                    Full Name
                                </label>

                                <input
                                    type="text"
                                    name="name"
                                    value={form.name}
                                    onChange={handleChange}
                                    placeholder="Enter your full name"
                                    required
                                />

                            </div>


                            {/* STUDENT ID */}

                            <div className="form-group">

                                <label>
                                    Student ID
                                </label>

                                <input
                                    type="text"
                                    name="student_id"
                                    value={form.student_id}
                                    onChange={handleChange}
                                    placeholder="Enter your student ID"
                                    required
                                />

                            </div>


                            {/* EMAIL */}

                            <div className="form-group">

                                <label>
                                    Email Address
                                </label>

                                <input
                                    type="email"
                                    name="email"
                                    value={form.email}
                                    onChange={handleChange}
                                    placeholder="Enter your email"
                                    required
                                />

                            </div>


                            {/* CONTACT */}

                            <div className="form-group">

                                <label>
                                    Contact Number
                                </label>

                                <input
                                    type="text"
                                    name="contact_number"
                                    value={form.contact_number}
                                    onChange={handleChange}
                                    placeholder="Enter your contact number"
                                    required
                                />

                            </div>


                            {/* PASSWORD */}

                            <div className="form-group">

                                <label>
                                    Password
                                </label>

                                <input
                                    type="password"
                                    name="password"
                                    value={form.password}
                                    onChange={handleChange}
                                    placeholder="Enter your password"
                                    minLength={8}
                                    required
                                />

                            </div>


                            {/* CONFIRM PASSWORD */}

                            <div className="form-group">

                                <label>
                                    Confirm Password
                                </label>

                                <input
                                    type="password"
                                    name="password_confirmation"
                                    value={
                                        form.password_confirmation
                                    }
                                    onChange={handleChange}
                                    placeholder="Confirm your password"
                                    minLength={8}
                                    required
                                />

                            </div>

                        </div>


                        {/* PROFILE PHOTO */}

                        <div className="photo-group">

                            <label>
                                Profile Photo
                            </label>

                            <div className="photo-upload">

                                {photoPreview && (

                                    <img
                                        src={photoPreview}
                                        alt="Profile Preview"
                                        className="photo-preview"
                                    />

                                )}

                                <label
                                    htmlFor="profile-photo"
                                    className="choose-photo"
                                >
                                    📷 Choose Photo
                                </label>

                                <input
                                    id="profile-photo"
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={handlePhoto}
                                />

                            </div>

                        </div>


                        {/* TERMS */}

                        <div className="terms-row">

                            <input
                                type="checkbox"
                                id="terms"
                                checked={agree}
                                onChange={(e) =>
                                    setAgree(
                                        e.target.checked
                                    )
                                }
                            />

                            <label htmlFor="terms">
                                I agree to the Terms
                                and Conditions.
                            </label>

                        </div>


                        {/* REGISTER BUTTON */}

                        <button
                            type="submit"
                            className="register-button"
                            disabled={loading}
                        >

                            {loading
                                ? "Creating Account..."
                                : "Register"}

                        </button>


                        <p className="login-link">

                            Already have an account?

                            {" "}

                            <Link to="/login">
                                Login
                            </Link>

                        </p>

                    </form>

                </div>

            </div>

        </div>
    );
}

export default Register;