// ProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";

const getHomeForRole = (role) =>
  role === "user" ? "/student/dashboard" : "/admin/dashboard";

const ProtectedRoute = ({ children, allowed = [] }) => {
  const user = JSON.parse(localStorage.getItem("user"));

  if (!user) return <Navigate to="/login" replace />;

  // If an allowed list is provided, enforce it
  if (allowed.length && !allowed.includes(user.role)) {
    return <Navigate to={getHomeForRole(user.role)} replace />;
  }

  return children;
};

export default ProtectedRoute;