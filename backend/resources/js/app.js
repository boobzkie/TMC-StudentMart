//
import React from "react";

function Login() {
    return (
        <div>
            <h1>Student Marketplace</h1>

            <h2>Welcome Back!</h2>
            <p>Login to continue</p>

            <form>
                <label>Student ID or Email</label>
                <input
                    type="text"
                    placeholder="Enter Student ID or Email"
                />

                <br /><br />

                <label>Password</label>
                <input
                    type="password"
                    placeholder="Enter your password"
                />

                <br /><br />

                <label>
                    <input type="checkbox" />
                    Remember Me
                </label>

                <br /><br />

                <button type="submit">Login</button>
            </form>

            <p>
                Don't have an account? Register here
            </p>
        </div>
    );
}

export default Login;