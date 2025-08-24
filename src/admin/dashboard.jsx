import React, { useEffect, useState } from "react";
import {
  FaUsers,
  FaClipboardList,
  FaCheckCircle,
  FaChartLine,
  FaUserCircle,
  FaStar,
} from "react-icons/fa";
import { MdAssignment } from "react-icons/md";
import axios from "axios";
import "./dashboard.css"; // optional for styling

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentStudents, setRecentStudents] = useState([]);
  const [recentAssignments, setRecentAssignments] = useState([]);
  const [loading, setLoading] = useState(true); // ✅ loading state

  useEffect(() => {
    const fetchData = async () => {
      try {
                const [statsRes, studentsRes, assignmentsRes] = await Promise.all([
                                                   axios.get("http://localhost:5000/admin/dashboard"),
        axios.get("http://localhost:5000/admin/studentslist"),
        axios.get("http://localhost:5000/admin/recentassignments"),
        ]);

        setStats(statsRes.data);
        setRecentStudents(studentsRes.data);
        setRecentAssignments(assignmentsRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false); // ✅ stop loading
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="dashboard loading">
        <h2>Loading Dashboard...</h2>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <h2>Admin Dashboard</h2>

      {/* Summary Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <FaUsers className="stat-icon" />
          <div>
            <p>Total Students</p>
            <h3>{stats.totalStudents}</h3>
          </div>
        </div>

        <div className="stat-card">
          <FaClipboardList className="stat-icon pink" />
          <div>
            <p>Total Assignments</p>
            <h3>{stats.totalAssignments}</h3>
          </div>
        </div>

        <div className="stat-card">
          <FaCheckCircle className="stat-icon green" />
          <div>
            <p>Students Submitted</p>
            <h3>
              {stats.studentsSubmittedCount}/{stats.totalStudents}
            </h3>
          </div>
        </div>

        <div className="stat-card">
          <FaChartLine className="stat-icon blue" />
          <div>
            <p>Avg Progress</p>
            <h3>{stats.averageProgress}%</h3>
          </div>
        </div>

        <div className="stat-card">
          <FaStar className="stat-icon orange" />
          <div>
            <p>Avg Score</p>
            <h3>{stats.averageScore}%</h3>
          </div>
        </div>
      </div>

      {/* Recent Students & Assignments */}
      <div className="recent-container">
        {/* Recent Students */}
        <div className="recent-box">
          <h3>Recent Students</h3>
          {recentStudents.length === 0 ? (
            <p>No recent students</p>
          ) : (
            recentStudents.map((student, idx) => (
              <div key={idx} className="recent-item">
                <FaUserCircle className="avatar" />
                <div>
                  <p className="name">{student.name}</p>
                  <small>{student.courseName || "No Course"}</small>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Recent Assignments */}
        <div className="recent-box">
          <h3>Recent Assignments</h3>
          {recentAssignments.length === 0 ? (
            <p>No recent assignments</p>
          ) : (
            recentAssignments.map((assignment, idx) => (
              <div key={idx} className="recent-item">
                <MdAssignment className="avatar blue" />
                <div>
                  <p className="name">{assignment.moduleName}</p>
                  <small>
                    {new Date(assignment.assignedDate).toLocaleDateString()}
                  </small>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}