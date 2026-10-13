import React from "react";
import {
    Routes,
    Route,
    Navigate,
} from "react-router-dom";

import Login from "./Login";
import Register from "./Register";

import AdminDashboard from "./AdminDashboard";
import AdminUsers from "./AdminUsers";
import AdminProducts from "./AdminProducts";

import Dashboard from "./Dashboard";
import Marketplace from "./Marketplace";
import ProductDetails from "./ProductDetails";
import SellProduct from "./SellProduct";
import MyProducts from "./MyProducts";


/*
|--------------------------------------------------------------------------
| Admin Route
|--------------------------------------------------------------------------
*/

function AdminRoute({ children }) {
    const token =
        localStorage.getItem("token");

    const role =
        localStorage.getItem("role");

    if (!token) {
        return (
            <Navigate
                to="/login"
                replace
            />
        );
    }

    if (role !== "admin") {
        return (
            <Navigate
                to="/login"
                replace
            />
        );
    }

    return children;
}


/*
|--------------------------------------------------------------------------
| Student Route
|--------------------------------------------------------------------------
*/

function StudentRoute({ children }) {
    const token =
        localStorage.getItem("token");

    const role =
        localStorage.getItem("role");

    if (!token) {
        return (
            <Navigate
                to="/login"
                replace
            />
        );
    }

    if (role !== "student") {
        return (
            <Navigate
                to="/admin/dashboard"
                replace
            />
        );
    }

    return children;
}


/*
|--------------------------------------------------------------------------
| App
|--------------------------------------------------------------------------
*/

function App() {
    return (
        <Routes>

            {/* Public */}

            <Route
                path="/login"
                element={<Login />}
            />

            <Route
                path="/register"
                element={<Register />}
            />


            {/* =========================================================
                ADMIN WEB
            ========================================================= */}

            <Route
                path="/admin/dashboard"
                element={
                    <AdminRoute>
                        <AdminDashboard />
                    </AdminRoute>
                }
            />

            <Route
                path="/admin/users"
                element={
                    <AdminRoute>
                        <AdminUsers />
                    </AdminRoute>
                }
            />

            <Route
                path="/admin/products"
                element={
                    <AdminRoute>
                        <AdminProducts />
                    </AdminRoute>
                }
            />


            {/* =========================================================
                TEMPORARY STUDENT WEB ROUTES
                These can remain while Flutter is being developed.
            ========================================================= */}

            <Route
                path="/dashboard"
                element={
                    <StudentRoute>
                        <Dashboard />
                    </StudentRoute>
                }
            />

            <Route
                path="/marketplace"
                element={
                    <StudentRoute>
                        <Marketplace />
                    </StudentRoute>
                }
            />

            <Route
                path="/products/:id"
                element={
                    <StudentRoute>
                        <ProductDetails />
                    </StudentRoute>
                }
            />

            <Route
                path="/sell"
                element={
                    <StudentRoute>
                        <SellProduct />
                    </StudentRoute>
                }
            />

            <Route
                path="/my-products"
                element={
                    <StudentRoute>
                        <MyProducts />
                    </StudentRoute>
                }
            />


            {/* Default */}

            <Route
                path="/"
                element={
                    <Navigate
                        to="/login"
                        replace
                    />
                }
            />

            <Route
                path="*"
                element={
                    <Navigate
                        to="/login"
                        replace
                    />
                }
            />

        </Routes>
    );
}

export default App;