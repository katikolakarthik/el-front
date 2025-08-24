// Layout.jsx
import React, { useState, useEffect } from "react";
import { FaBars, FaTimes, FaGraduationCap, FaUserFriends, FaClipboardList, FaSignOutAlt } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import AIAssistance from "./components/AIAssistance";
import CRSWidget from "./components/CRSWidget";
import useSessionValidation from "./hooks/useSessionValidation";
import "./layout.css";

const Layout = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  
  // Use session validation hook
  useSessionValidation();

  useEffect(() => {
  const storedUser = JSON.parse(localStorage.getItem("user"));
  if (storedUser) {
    setUser(storedUser);
  }
}, []); // ✅ no navigate here

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

  const handleLogout = async () => {
    try {
      const sessionId = localStorage.getItem("sessionId");
      if (sessionId) {
        // Call logout endpoint to invalidate session
        await axios.post("https://el-backend-ashen.vercel.app/logout", {}, {
          headers: {
            'x-session-id': sessionId
          }
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // Clear local storage and redirect
      localStorage.removeItem("user");
      localStorage.removeItem("userId");
      localStorage.removeItem("sessionId");
      navigate("/login");
    }
  };

  // Sidebar links based on role
  const renderLinks = () => {
    if (!user) return null;

    if (user.role === "admin") {
      return (
        <>
          <Link to="/admin/dashboard" className="sidebar-link" onClick={closeSidebar}>
            <FaClipboardList /> <span>Dashboard</span>
          </Link>
          <Link to="/admin/student" className="sidebar-link" onClick={closeSidebar}>
            <FaUserFriends /> <span>Students</span>
          </Link>
          <Link to="/admin/assignments" className="sidebar-link" onClick={closeSidebar}>
            <FaClipboardList /> <span>Assignments</span>
          </Link>


 <Link to="/admin/credentials" className="sidebar-link" onClick={closeSidebar}>
            <FaUserFriends /> <span>Student Credentials</span>
          </Link>
<Link to="/admin/subadmins" className="sidebar-link" onClick={closeSidebar}>
            <FaUserFriends /> <span>Subadmin Credentials</span>
          </Link>






        </>
      );
    }

    if (user.role === "user") {
      return (
        <>
          <Link to="/student/dashboard" className="sidebar-link" onClick={closeSidebar}>
            <FaClipboardList /> <span>My Dashboard</span>
          </Link>
          <Link to="/student/assignments" className="sidebar-link" onClick={closeSidebar}>
            <FaClipboardList /> <span>My Assignments</span>
          </Link>
        </>
      );
    }

    return null;
  };

  return (
    <div className="layout">
      {/* Sidebar - Desktop */}
      <aside className="sidebar-desktop">
        <div className="sidebar-header">
          <FaGraduationCap className="sidebar-icon" />
          <span>Medical Coding</span>
        </div>
        <nav className="sidebar-nav">
          {renderLinks()}
          <button onClick={handleLogout} className="sidebar-link logout-btn">
            <FaSignOutAlt /> <span>Logout</span>
          </button>
        </nav>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={closeSidebar}>
          <aside className="sidebar-mobile" onClick={(e) => e.stopPropagation()}>
            <div className="sidebar-header">
              <button className="close-btn" onClick={closeSidebar}>
                <FaTimes />
              </button>
              <FaGraduationCap className="sidebar-icon" />
              <span>Medical Coding</span>
            </div>
            <nav className="sidebar-nav">
              {renderLinks()}
              <button onClick={handleLogout} className="sidebar-link logout-btn">
                <FaSignOutAlt /> <span>Logout</span>
              </button>
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="main-content">
        {/* Top Navigation */}
        <header className="top-nav">
          <div className="nav-left">
            <button className="menu-btn" onClick={toggleSidebar}>
              <FaBars />
            </button>
            <h1 className="nav-title">{user?.role === "admin" ? "Admin Panel" : "Student Panel"}</h1>
          </div>
          <div className="nav-right">
            <span className="welcome-text">Welcome, {user?.name}</span>
            <button onClick={handleLogout} className="logout-btn top-logout">
              <FaSignOutAlt /> Logout
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="content">{children}</main>
      </div>
      
      {/* CRS Widget - Only for Students */}
      {user?.role === "user" && <CRSWidget />}
      
      {/* AI Assistance Widget - Only for Students */}
      {user?.role === "user" && <AIAssistance />}
    </div>
  );
};

export default Layout;