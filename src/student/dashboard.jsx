import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  FiBook,
  FiCheckCircle,
  FiTrendingUp,
  FiAlertCircle,
  FiClock,
  FiCalendar,
  FiDollarSign,
  FiAward,
} from 'react-icons/fi';
import './StudentDashboard.css';

const StudentDashboard = () => {
  const navigate = useNavigate();

  const [studentData, setStudentData] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- Helpers ---
  const displayValue = (val) => {
    if (val === null || val === undefined) return '';
    if (Array.isArray(val)) return val.length > 0 ? val.join(', ') : '';
    if (typeof val === 'string' && val.trim() === '') return '';
    return val;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // --- Fetchers (NEW ENDPOINTS) ---
  const fetchDashboardStats = useCallback(async (userId, courseName) => {
    const res = await axios.get(
      `https://el-backend-ashen.vercel.app/stats/${encodeURIComponent(
        courseName
      )}/${encodeURIComponent(userId)}`
    );
    if (!res.data) throw new Error('No stats data received');
    return res.data;
  }, []);

  const fetchCourseInfo = useCallback(async (userId) => {
    const res = await axios.get(
      `https://el-backend-ashen.vercel.app/payment-details?studentId=${encodeURIComponent(
        userId
      )}`
    );
    if (!res.data) throw new Error('No course info received');
    return res.data; // { studentId, name, courseName, enrolledDate, paidAmount, remainingAmount }
  }, []);

  const fetchSubmissions = useCallback(async (userId) => {
    const res = await axios.get(
      `https://el-backend-ashen.vercel.app/submitted-assignments?studentId=${encodeURIComponent(
        userId
      )}`
    );
    return res.data?.assignments || [];
  }, []);

  const refreshDashboard = useCallback(async () => {
    const userId = localStorage.getItem('userId');
    const courseName = localStorage.getItem('courseName');
    if (!userId) throw new Error('User ID not found in localStorage');
    if (!courseName) throw new Error('Course name not found in localStorage');

    const [stats, courseInfo, submissions] = await Promise.all([
      fetchDashboardStats(userId, courseName),
      fetchCourseInfo(userId),
      fetchSubmissions(userId),
    ]);

    // Normalize average score
    const avgScoreRaw =
      (stats && stats.stats && stats.stats.averageScore) ??
      stats?.averageScore;
    let avgScoreNumber = 0;
    if (typeof avgScoreRaw === 'number') {
      avgScoreNumber = avgScoreRaw;
    } else if (typeof avgScoreRaw === 'string') {
      const parsed = parseFloat(avgScoreRaw.replace('%', ''));
      avgScoreNumber = isNaN(parsed) ? 0 : parsed;
    }

    const totalAssigned = Number(stats?.totalAssigned ?? 0);
    const completed = Number(stats?.completed ?? 0);
    const pendingCalculated =
      stats?.pending !== undefined && stats?.pending !== null
        ? Number(stats.pending)
        : Math.max(totalAssigned - completed, 0);

    setStudentData({
      // from payment-details:
      studentId: courseInfo.studentId,
      name: courseInfo.name,
      courseName: courseInfo.courseName || courseName,
      enrolledDate: courseInfo.enrolledDate,
      paidAmount: courseInfo.paidAmount ?? 0,
      remainingAmount: courseInfo.remainingAmount ?? 0,

      // from stats:
      totalAssignments: totalAssigned,
      completedCount: completed,
      averageScore: avgScoreNumber, // UI will append %
      pendingCount: pendingCalculated,
      courseProgress: Math.round((completed / (totalAssigned || 1)) * 100),
      assignmentCompletion: `${completed}/${totalAssigned}`,
    });

    setAssignments(submissions);
  }, [fetchCourseInfo, fetchDashboardStats, fetchSubmissions]);

  // Initial load
  useEffect(() => {
    (async () => {
      try {
        await refreshDashboard();
      } catch (err) {
        setError(err.message || 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshDashboard]);

  // Build submissions list from new API (parent assignment only)
  const submissions = useMemo(() => {
    if (!Array.isArray(assignments)) return [];
    return assignments
      .filter(a => a && (a.assignmentId || a.assignmentName)) // ignore empty shells
      .map((a) => {
        const totalSub = a.subAssignments?.length ?? 0;
        const doneSub = a.subAssignments?.filter((s) => s.isCompleted)?.length ?? 0;

        const fallbackProgress =
          totalSub > 0
            ? Math.round((doneSub / totalSub) * 100)
            : a.isCompleted ? 100 : 0;

        return {
          assignmentId: a.assignmentId ?? null,
          assignmentName: (a.assignmentName || '').trim(),
          isCompleted: a.isCompleted === true, // clickable only when true
          submissionDate: a.assignedDate || a.submittedAt || null,
          overallProgress: a.progressPercent ?? fallbackProgress,
        };
      });
  }, [assignments]);

  // --- Handlers ---
  const handleSubmissionClick = (submission) => {
    if (!submission?.isCompleted) return;
    const studentId = studentData?.studentId;
    const assignmentId = submission?.assignmentId;
    if (!studentId || !assignmentId) return;

    navigate(
      `/result?studentId=${encodeURIComponent(studentId)}&assignmentId=${encodeURIComponent(
        assignmentId
      )}`
    );
  };

  // --- Top-level renders ---
  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <p className="error-message">Error: {error}</p>
      </div>
    );
  }

  if (!studentData) {
    return (
      <div className="dashboard-error">
        <p>No student data available</p>
      </div>
    );
  }

  return (
    <div className="student-dashboard">
      <header className="dashboard-header">
        <h1>Welcome back, {studentData.name}!</h1>
      </header>

      {/* Stats Section */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <FiBook size={24} />
          </div>
          <div className="stat-content">
            <h3>Total Assignments</h3>
            <p className="stat-value">{studentData.totalAssignments}</p>
            <p className="stat-label">Assigned to you</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <FiCheckCircle size={24} />
          </div>
          <div className="stat-content">
            <h3>Completed</h3>
            <p className="stat-value">{studentData.completedCount}</p>
            <p className="stat-label">Successfully submitted</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <FiTrendingUp size={24} />
          </div>
          <div className="stat-content">
            <h3>Average Score</h3>
            <p className="stat-value">{studentData.averageScore}%</p>
            <p className="stat-label">Your performance</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <FiAlertCircle size={24} />
          </div>
          <div className="stat-content">
            <h3>Pending</h3>
            <p className="stat-value">{studentData.pendingCount}</p>
            <p className="stat-label">Need attention</p>
          </div>
        </div>
      </div>

      {/* Progress Section */}
      <div className="progress-section">
        <div className="progress-card">
          <h2>Overall Progress</h2>
          <div className="progress-bar-container">
            <div
              className="progress-bar"
              style={{ width: `${studentData.courseProgress}%` }}
            ></div>
          </div>
          <div className="progress-details">
            <span>Course Progress {studentData.courseProgress}%</span>
            <span>Assignment Completion {studentData.assignmentCompletion}</span>
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="info-grid">
        <div className="info-card">
          <h2>Course Information</h2>
          <div className="info-item">
            <FiBook className="info-icon" />
            <div>
              <p className="info-label">Course:</p>
              <p className="info-value">{studentData.courseName}</p>
            </div>
          </div>
          <div className="info-item">
            <FiCalendar className="info-icon" />
            <div>
              <p className="info-label">Enrolled:</p>
              <p className="info-value">{formatDate(studentData.enrolledDate)}</p>
            </div>
          </div>
          <div className="info-item">
            <FiDollarSign className="info-icon" />
            <div>
              <p className="info-label">Payment Status:</p>
              <p className="info-value">
                {studentData.remainingAmount > 0
                  ? `Partially paid (₹${studentData.paidAmount}/₹${
                      (studentData.paidAmount ?? 0) +
                      (studentData.remainingAmount ?? 0)
                    })`
                  : 'Fully paid'}
              </p>
            </div>
          </div>
        </div>

        {/* Submissions */}
        <div className="info-card">
          <h2>Submissions</h2>
          <div className="submissions-container">
            {submissions.length > 0 ? (
              submissions.map((submission, i) => {
                const completed = submission.isCompleted === true;
                const hasIds = Boolean(submission.assignmentId);
                const clickable = completed && hasIds;
                const title =
                  submission.assignmentName || 'Untitled Assignment';

                return (
                  <button
                    key={`${submission.assignmentId || 'a'}-${i}`}
                    className={`submission-item ${
                      clickable ? '' : 'submission-item--disabled'
                    }`}
                    onClick={() =>
                      clickable ? handleSubmissionClick(submission) : null
                    }
                    title={
                      clickable
                        ? 'View Result'
                        : completed
                        ? 'Missing assignmentId'
                        : 'Pending'
                    }
                    disabled={!clickable}
                    style={{
                      textAlign: 'left',
                      width: '100%',
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      cursor: clickable ? 'pointer' : 'not-allowed',
                      opacity: clickable ? 1 : 0.6,
                    }}
                  >
                    <div className="submission-header">
                      <FiAward className="submission-icon" />
                      <h3 style={{ margin: 0 }}>{displayValue(title)}</h3>
                      <span
                        className={`status-badge ${
                          completed
                            ? 'status-badge--completed'
                            : 'status-badge--pending'
                        }`}
                        style={{
                          marginLeft: 'auto',
                          fontSize: 12,
                          padding: '2px 8px',
                          borderRadius: 999,
                          border: '1px solid #e0e0e0',
                        }}
                      >
                        {completed ? 'Completed' : 'Pending'}
                      </span>
                    </div>

                    <div className="submission-details">
                      <div className="submission-stat">
                        <span>Submitted:</span>
                        <span>{formatDate(submission.submissionDate)}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="no-submissions">
                <FiClock size={32} />
                <p>No submissions yet. Start working on your assignments!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;