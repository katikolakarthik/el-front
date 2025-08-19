// App.jsx
import { Route, Routes, Navigate } from "react-router-dom";
import Login from "./login/login.jsx";
import AdminDash from "./admin/dashboard.jsx";
import StudentDashboard from "./student/dashboard.jsx";
import Layout from "./layout.jsx";
import Student from "./admin/student.jsx";
import Assignment from "./admin/assignment.jsx";
import Addassignment from "./admin/addAssignment.jsx";
import StudentAssignment from "./student/assignment.jsx";
import ProtectedRoute from "./ProtectedRoute.jsx";
import Credential from "./admin/credential.jsx";
import Subadmin from "./admin/subadmin.jsx";

function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/login" element={<Login />} />

      {/* Admin + Subadmin (share pages) */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute allowed={["admin", "subadmin"]}>
            <Layout><AdminDash /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/student"
        element={
          <ProtectedRoute allowed={["admin", "subadmin"]}>
            <Layout><Student /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/credentials"
        element={
          <ProtectedRoute allowed={["admin", "subadmin"]}>
            <Layout><Credential /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/subadmins"
        element={
          <ProtectedRoute allowed={["admin", "subadmin"]}>
            <Layout><Subadmin /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/assignments"
        element={
          <ProtectedRoute allowed={["admin", "subadmin"]}>
            <Layout><Assignment /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/assignment/add"
        element={
          <ProtectedRoute allowed={["admin", "subadmin"]}>
            <Layout><Addassignment /></Layout>
          </ProtectedRoute>
        }
      />

      {/* User-only */}
      <Route
        path="/student/dashboard"
        element={
          <ProtectedRoute allowed={["user"]}>
            <Layout><StudentDashboard /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/assignments"
        element={
          <ProtectedRoute allowed={["user"]}>
            <Layout><StudentAssignment /></Layout>
          </ProtectedRoute>
        }
      />

      {/* (Optional) Fallback: send logged-in users to their home */}
      <Route
        path="*"
        element={
          <ProtectedRoute>
            {/* If someone hits an unknown route, bounce based on their role */}
            <RoleRedirect />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

// Helper component for wildcard fallback
const RoleRedirect = () => {
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) return <Navigate to="/login" replace />;
  return (
    <Navigate
      to={user.role === "user" ? "/student/dashboard" : "/admin/dashboard"}
      replace
    />
  );
};

export default App;