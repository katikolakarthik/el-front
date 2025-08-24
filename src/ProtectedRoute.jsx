// ProtectedRoute.jsx
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import axios from "axios";

const getHomeForRole = (role) =>
  role === "user" ? "/student/dashboard" : "/admin/dashboard";

const ProtectedRoute = ({ children, allowed = [] }) => {
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const validateSession = async () => {
      try {
        const sessionId = localStorage.getItem('sessionId');
        const storedUser = localStorage.getItem('user');
        
        if (!sessionId || !storedUser) {
          setIsValid(false);
          setIsValidating(false);
          return;
        }

        const response = await axios.get('https://el-backend-ashen.vercel.app/validate-session', {
          headers: {
            'x-session-id': sessionId
          }
        });

        if (response.data.success) {
          setUser(response.data.user);
          setIsValid(true);
        } else {
          setIsValid(false);
        }
      } catch (error) {
        console.error('Session validation error:', error);
        setIsValid(false);
      } finally {
        setIsValidating(false);
      }
    };

    validateSession();
  }, []);

  if (isValidating) {
    return <div>Loading...</div>; // You can replace this with a proper loading component
  }

  if (!isValid || !user) {
    // Clear invalid data
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    localStorage.removeItem('sessionId');
    return <Navigate to="/login" replace />;
  }

  // If an allowed list is provided, enforce it
  if (allowed.length && !allowed.includes(user.role)) {
    return <Navigate to={getHomeForRole(user.role)} replace />;
  }

  return children;
};

export default ProtectedRoute;