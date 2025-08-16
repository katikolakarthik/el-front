import { Route, Routes, Navigate } from "react-router-dom";
import Login from "./login/login.jsx";
import AdminDash from "./admin/dashboard.jsx";
import StudentDashboard from "./student/dashboard.jsx";
import Layout from "./layout.jsx";
import Student from "./admin/student.jsx";
import Assignment from "./admin/assignment.jsx";
import Addassignment from "./admin/addAssignment.jsx";
import StudentAssignment from './student/assignment.jsx';
import ProtectedRoute from "./ProtectedRoute.jsx";

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/login" element={<Login />} />

      {/* Admin Routes */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute>
            <Layout><AdminDash /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/student"
        element={
          <ProtectedRoute>
            <Layout><Student /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/assignments"
        element={
          <ProtectedRoute>
            <Layout><Assignment /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/assignment/add"
        element={
          <ProtectedRoute>
            <Layout><Addassignment /></Layout>
          </ProtectedRoute>
        }
      />

      {/* Student Routes */}
      <Route
        path="/student/dashboard"
        element={
          <ProtectedRoute>
            <Layout><StudentDashboard /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/assignments"
        element={
          <ProtectedRoute>
            <Layout><StudentAssignment /></Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;