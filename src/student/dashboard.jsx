import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  FiX,
} from 'react-icons/fi';
import './StudentDashboard.css';

const StudentDashboard = () => {
  const [studentData, setStudentData] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showResultPopup, setShowResultPopup] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [resultLoading, setResultLoading] = useState(false);

  // --- Helpers ---
  const displayValue = (val) => {
    if (val === null || val === undefined) return '';
    if (Array.isArray(val)) return val.length > 0 ? val.join(', ') : '';
    if (typeof val === 'string' && val.trim() === '') return '';
    return val;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // --- Fetchers ---
  const fetchDashboardStats = useCallback(async (userId, courseName) => {
    const res = await axios.get(
      `https://el-backend-ashen.vercel.app/stats/${courseName}/${userId}`
    );
    if (!res.data) throw new Error('No stats data received');
    return res.data;
  }, []);

  const fetchCourseInfo = useCallback(async (userId) => {
    const res = await axios.get(
      `https://el-backend-ashen.vercel.app/payment-details?studentId=${userId}`
    );
    if (!res.data) throw new Error('No course info received');
    return res.data;
  }, []);

  const fetchAssignments = useCallback(async (userId) => {
    const res = await axios.get(
      `https://el-backend-ashen.vercel.app/submitted-assignments?studentId=${userId}`
    );
    return res.data?.assignments || [];
  }, []);

  const refreshDashboard = useCallback(async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      if (!user?.id || !user?.courseName) throw new Error('User not found');

      const [stats, courseInfo, assigns] = await Promise.all([
        fetchDashboardStats(user.id, user.courseName),
        fetchCourseInfo(user.id),
        fetchAssignments(user.id),
      ]);

      setStudentData({
        id: courseInfo.studentId,
        name: courseInfo.name,
        courseName: courseInfo.courseName,
        enrolledDate: courseInfo.enrolledDate,
        paidAmount: courseInfo.paidAmount,
        remainingAmount: courseInfo.remainingAmount,
        totalAssignments: stats.totalAssigned,
        completedCount: stats.completed,
        averageScore: stats.averageScore,
        pendingCount: stats.pending,
        courseProgress: Math.round(
          (stats.completed / (stats.totalAssigned || 1)) * 100
        ),
        assignmentCompletion: `${stats.completed}/${stats.totalAssigned}`,
      });
      setAssignments(assigns);
    } catch (err) {
      setError(err.message || 'Failed to refresh data');
    }
  }, [fetchDashboardStats, fetchCourseInfo, fetchAssignments]);

  // Initial load
  useEffect(() => {
    const bootstrap = async () => {
      try {
        await refreshDashboard();
      } catch (err) {
        setError(err.message || 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, [refreshDashboard]);

  // --- Results fetching ---
  const fetchResultData = async (studentId, assignmentId) => {
    try {
      setResultLoading(true);
      const response = await axios.post(
        'https://el-backend-ashen.vercel.app/result',
        { studentId, assignmentId }
      );
      setResultData(response.data);
      setShowResultPopup(true);
    } catch (err) {
      console.error('Error fetching result:', err);
      alert('Failed to fetch result details');
    } finally {
      setResultLoading(false);
    }
  };

  // ✅ Build the submissions list
  const submissions = useMemo(() => {
    if (!Array.isArray(assignments)) return [];
    return assignments.map((a) => {
      const totalSub = a.subAssignments?.length ?? 0;
      const doneSub = a.subAssignments?.filter((s) => s.isCompleted)?.length ?? 0;
      const fallbackProgress =
        totalSub > 0
          ? Math.round((doneSub / totalSub) * 100)
          : a.isCompleted
          ? 100
          : 0;

      return {
        assignmentId: a.assignmentId,
        moduleName: a.assignmentId,
        isCompleted: a.isCompleted === true,
        submissionDate: a.assignedDate,
        totalCorrect: a.totalCorrect ?? 0,
        totalWrong: a.totalWrong ?? 0,
        overallProgress: a.progressPercent ?? fallbackProgress,
      };
    });
  }, [assignments]);

  // --- Handlers ---
  const handleSubmissionClick = (submission) => {
    if (!submission || submission.isCompleted !== true) return;

    const studentId = studentData?.id;
    const assignmentId = submission.assignmentId;
    if (!studentId || !assignmentId) {
      console.warn('Missing studentId or assignmentId for result fetch.');
      return;
    }
    fetchResultData(studentId, assignmentId);
  };

  const closeResultPopup = async () => {
    setShowResultPopup(false);
    setResultData(null);
    await refreshDashboard();
  };

  // --- Popup UX
  useEffect(() => {
    if (!showResultPopup) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleEsc = (e) => {
      if (e.key === 'Escape') closeResultPopup();
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = originalOverflow;
    };
  }, [showResultPopup]);

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
          <div className="stat-icon"><FiBook size={24} /></div>
          <div className="stat-content">
            <h3>Total Assignments</h3>
            <p className="stat-value">{studentData.totalAssignments}</p>
            <p className="stat-label">Assigned to you</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><FiCheckCircle size={24} /></div>
          <div className="stat-content">
            <h3>Completed</h3>
            <p className="stat-value">{studentData.completedCount}</p>
            <p className="stat-label">Successfully submitted</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><FiTrendingUp size={24} /></div>
          <div className="stat-content">
            <h3>Average Score</h3>
            <p className="stat-value">{studentData.averageScore}%</p>
            <p className="stat-label">Your performance</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><FiAlertCircle size={24} /></div>
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
                  ? `Partially paid (₹${studentData.paidAmount}/₹${(studentData.paidAmount ?? 0) +
                      (studentData.remainingAmount ?? 0)})`
                  : 'Fully paid'}
              </p>
            </div>
          </div>
        </div>

        <div className="info-card">
          <h2>Submissions</h2>
          <div className="submissions-container">
            {submissions.length > 0 ? (
              submissions.map((submission, i) => {
                const completed = submission.isCompleted === true;
                return (
                  <div
                    key={i}
                    className={`submission-item ${completed ? '' : 'submission-item--disabled'}`}
                    onClick={() => (completed ? handleSubmissionClick(submission) : null)}
                    title={completed ? 'Click to view result' : 'Result available after completion'}
                    style={{
                      cursor: completed ? 'pointer' : 'not-allowed',
                      opacity: completed ? 1 : 0.6,
                    }}
                  >
                    <div className="submission-header">
                      <FiAward className="submission-icon" />
                      <h3>{submission.moduleName}</h3>
                      <span
                        className={`status-badge ${
                          completed ? 'status-badge--completed' : 'status-badge--pending'
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
                      <div className="submission-stat">
                        <span>Score:</span>
                        <span>
                          {submission.totalCorrect} correct, {submission.totalWrong} wrong
                        </span>
                      </div>
                      <div className="submission-stat">
                        <span>Progress:</span>
                        <span>{submission.overallProgress}%</span>
                      </div>
                    </div>
                  </div>
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

      {showResultPopup && (
        <div className="result-popup-overlay" onClick={closeResultPopup}>
          <div className="result-popup" onClick={(e) => e.stopPropagation()}>
            <button className="close-popup" onClick={closeResultPopup} aria-label="Close results">
              <FiX size={24} />
            </button>
            {resultData && (
              <>
                <div className="result-header">
                  <h2>Assignment Results</h2>
                  <div className="result-summary">
                    <div className="summary-item">
                      <span>Correct Answers:</span>
                      <strong className="correct">{resultData.totalCorrect}</strong>
                    </div>
                    <div className="summary-item">
                      <span>Wrong Answers:</span>
                      <strong className="incorrect">{resultData.totalWrong}</strong>
                    </div>
                    <div className="summary-item">
                      <span>Overall Progress:</span>
                      <strong className="progress">{resultData.overallProgress}%</strong>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {resultLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Loading result details...</p>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;