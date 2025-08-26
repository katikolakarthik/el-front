import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { 
  FiBook, FiCheckCircle, FiTrendingUp, FiAlertCircle, FiClock, 
  FiCalendar, FiDollarSign, FiAward, FiX 
} from 'react-icons/fi';
import './StudentDashboard.css';

const StudentDashboard = () => {
  const [studentData, setStudentData] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [showResultPopup, setShowResultPopup] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [resultLoading, setResultLoading] = useState(false);

  // API base URL
  const API_BASE_URL = 'https://el-backend-ashen.vercel.app';

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
  const fetchStats = useCallback(async (userId, courseName) => {
    const res = await axios.get(
      `${API_BASE_URL}/stats/${encodeURIComponent(courseName)}/${encodeURIComponent(userId)}`
    );
    if (!res.data) throw new Error('No stats data received');
    return res.data;
  }, []);

  const fetchPaymentDetails = useCallback(async (userId) => {
    const res = await axios.get(
      `${API_BASE_URL}/payment-details?studentId=${encodeURIComponent(userId)}`
    );
    if (!res.data) throw new Error('No payment data received');
    return res.data;
  }, []);

  const fetchAssignments = useCallback(async (userId) => {
    const res = await axios.get(
      `${API_BASE_URL}/submitted-assignments?studentId=${encodeURIComponent(userId)}`
    );
    if (res.data?.assignments) {
      return res.data.assignments || [];
    }
    return [];
  }, []);

  const refreshDashboard = useCallback(async () => {
    try {
      // Get userId and user data from localStorage
      const userId = localStorage.getItem('userId');
      if (!userId) throw new Error('User ID not found');

      // Get user data from localStorage
      const userDataStr = localStorage.getItem('user');
      if (!userDataStr) throw new Error('User data not found');
      
      const userData = JSON.parse(userDataStr);
      const courseName = userData.courseName || 'CCS'; // Fallback to 'CCS'

      const [stats, payment, assigns] = await Promise.all([
        fetchStats(userId, courseName),
        fetchPaymentDetails(userId),
        fetchAssignments(userId),
      ]);

      setStatsData(stats);
      setPaymentData(payment);
      setAssignments(assigns);

      // Combine data for studentData
      setStudentData({
        ...userData,
        totalAssignments: stats.totalAssigned,
        completedCount: stats.completed,
        averageScore: stats.averageScore ? stats.averageScore.replace('%', '') : '0',
        pendingCount: stats.pending,
        courseName: payment.courseName || courseName,
        enrolledDate: payment.enrolledDate || userData.enrolledDate,
        paidAmount: payment.paidAmount,
        remainingAmount: payment.remainingAmount,
        courseProgress: Math.round((stats.completed / stats.totalAssigned) * 100) || 0,
        assignmentCompletion: `${stats.completed}/${stats.totalAssigned}`,
      });
    } catch (err) {
      setError(err.message || 'Failed to refresh data');
    }
  }, [fetchStats, fetchPaymentDetails, fetchAssignments]);

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
      const response = await axios.post(`${API_BASE_URL}/result`, {
        studentId,
        assignmentId
      });
      setResultData(response.data);
      setShowResultPopup(true);
    } catch (err) {
      console.error('Error fetching result:', err);
      alert('Failed to fetch result details');
    } finally {
      setResultLoading(false);
    }
  };

  // ✅ Build the submissions list from the parent assignments API
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
        assignmentId: a.assignmentId, // parent assignment id to send to /result
        moduleName: a.assignmentName || 'Assignment', // Use assignmentName if available
        isCompleted: a.isCompleted === true, // gate by parent assignment completion
        submissionDate: new Date().toISOString(), // Default since API may not provide date
        totalCorrect: 0, // Defaults
        totalWrong: 0,
        overallProgress: fallbackProgress,
      };
    });
  }, [assignments]);

  // --- Handlers ---
  const handleSubmissionClick = (submission) => {
    // Only allow results when parent assignment is completed
    if (!submission || submission.isCompleted !== true) return;

    const studentId = localStorage.getItem('userId');
    const assignmentId = submission.assignmentId; // parent assignment id
    if (!studentId || !assignmentId) {
      console.warn('Missing studentId or assignmentId for result fetch.');
      return;
    }
    fetchResultData(studentId, assignmentId);
  };

  const closeResultPopup = async () => {
    // Close popup
    setShowResultPopup(false);
    setResultData(null);

    // 🔄 Optional refresh after closing
    await refreshDashboard();
  };

  // --- Popup UX: close on overlay click & Escape; lock scroll while open ---
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

  // --- Render helpers for popup content ---
  const renderStaticAnswers = (module) => {
    const submitted = module.submitted || {};

    // ⬇️ Now includes PCS/HCPCS/DRG/Modifiers
    const fields = [
      { key: 'patientName', label: 'Patient Name' },
      { key: 'ageOrDob', label: 'Age/DOB' },
      { key: 'icdCodes', label: 'ICD Codes' },
      { key: 'cptCodes', label: 'CPT Codes' },
      { key: 'pcsCodes', label: 'PCS Codes' },           // NEW
      { key: 'hcpcsCodes', label: 'HCPCS Codes' },       // NEW
      { key: 'drgValue', label: 'DRG Value' },           // NEW
      { key: 'modifiers', label: 'Modifiers' },          // NEW
      { key: 'notes', label: 'Notes' },
    ];

    const hasValues = fields.some((field) => {
      const value = submitted[field.key];
      return (
        value !== null &&
        value !== undefined &&
        (!Array.isArray(value) || value.length > 0) &&
        (typeof value !== 'string' || value.trim() !== '')
      );
    });

    if (!hasValues) return null;

    return (
      <div className="answers-row">
        {fields.map((field) => {
          const value = submitted[field.key];
          if (
            value === null ||
            value === undefined ||
            (Array.isArray(value) && value.length === 0) ||
            (typeof value === 'string' && value.trim() === '')
          ) {
            return null;
          }
          return (
            <div key={field.key}>
              <strong>{field.label}:</strong> {displayValue(value)}
            </div>
          );
        })}
      </div>
    );
  };

  const renderDynamicQuestions = (submittedQuestions, correctQuestions) => {
    if (!correctQuestions || correctQuestions.length === 0) return null;

    return (
      <div className="dynamic-questions-container">
        {correctQuestions.map((cq, i) => {
          const sq = submittedQuestions?.[i];
          if (!cq.questionText) return null;
          return (
            <div key={i} className="question-item">
              <p><strong>Q:</strong> {cq.questionText}</p>
              <p><strong>Your Answer:</strong> {sq?.answer || 'Not answered'}</p>
              <p><strong>Correct Answer:</strong> {cq.correctAnswer}</p>
              <p className={sq?.answer === cq.correctAnswer ? 'correct-answer' : 'wrong-answer'}>
                {sq?.answer === cq.correctAnswer ? '✓ Correct' : '✗ Incorrect'}
              </p>
            </div>
          );
        })}
      </div>
    );
  };

  const renderModule = (module, index) => {
    // Include new fields in the "has correct answers" gate
    const hasCorrectAnswers = module.correctAnswerKey && (
      module.correctAnswerKey.patientName ||
      module.correctAnswerKey.ageOrDob ||
      (module.correctAnswerKey.icdCodes && module.correctAnswerKey.icdCodes.length > 0) ||
      (module.correctAnswerKey.cptCodes && module.correctAnswerKey.cptCodes.length > 0) ||
      (module.correctAnswerKey.pcsCodes && module.correctAnswerKey.pcsCodes.length > 0) ||    // NEW
      (module.correctAnswerKey.hcpcsCodes && module.correctAnswerKey.hcpcsCodes.length > 0) ||// NEW
      module.correctAnswerKey.drgValue ||                                                     // NEW
      (module.correctAnswerKey.modifiers && module.correctAnswerKey.modifiers.length > 0) ||  // NEW
      module.correctAnswerKey.notes
    );

    return (
      <div key={index} className="sub-assignment">
        <div className="assignment-title">
          <h3>{module.moduleName || module.subModuleName}</h3>
        </div>
        {hasCorrectAnswers && (
          <div className="correct-answers">
            <h4>Correct Answers:</h4>
            {renderStaticAnswers(module)}
          </div>
        )}
        {module.correctQuestions && module.correctQuestions.length > 0 && (
          <div className="correct-questions">
            <h4>Questions & Answers:</h4>
            {renderDynamicQuestions(module.submittedQuestions, module.correctQuestions)}
          </div>
        )}
      </div>
    );
  };

  const renderResultPopup = () => {
    if (!resultData) return null;

    const modules = Array.isArray(resultData.data) ? resultData.data : [resultData.data];

    return (
      <div
        className="result-popup-overlay"
        onClick={closeResultPopup}
      >
        <div
          className="result-popup"
          onClick={(e) => e.stopPropagation()}
        >
          <button className="close-popup" onClick={closeResultPopup} aria-label="Close results">
            <FiX size={24} />
          </button>
          <h2>Assignment Results</h2>
          {resultLoading ? (
            <div className="loading-spinner"></div>
          ) : (
            <div className="results-content">
              {modules.map((module, index) => renderModule(module, index))}
            </div>
          )}
        </div>
      </div>
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
        <h1>Welcome, {studentData.name}!</h1>
        <p>Your {studentData.courseName} Course Dashboard</p>
      </header>

      {/* Stats Section */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <FiBook size={24} />
          </div>
          <div className="stat-content">
            <h3>Total Assignments</h3>
            <p className="stat-value">{studentData.totalAssignments || 0}</p>
            <p className="stat-label">Assigned to you</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <FiCheckCircle size={24} />
          </div>
          <div className="stat-content">
            <h3>Completed</h3>
            <p className="stat-value">{studentData.completedCount || 0}</p>
            <p className="stat-label">Assignments done</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <FiTrendingUp size={24} />
          </div>
          <div className="stat-content">
            <h3>Average Score</h3>
            <p className="stat-value">{studentData.averageScore || 0}%</p>
            <p className="stat-label">Overall performance</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <FiAlertCircle size={24} />
          </div>
          <div className="stat-content">
            <h3>Pending</h3>
            <p className="stat-value">{studentData.pendingCount || 0}</p>
            <p className="stat-label">Assignments remaining</p>
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
              style={{ width: `${studentData.courseProgress || 0}%` }}
            ></div>
          </div>
          <div className="progress-details">
            <span>Course Progress {studentData.courseProgress || 0}%</span>
            <span>Assignment Completion {studentData.assignmentCompletion || '0/0'}</span>
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
              <p className="info-value">{studentData.courseName || 'N/A'}</p>
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
                  ? `Partially paid (₹${studentData.paidAmount || 0}/₹${
                      (studentData.paidAmount || 0) + (studentData.remainingAmount || 0)
                    })`
                  : 'Fully paid'}
              </p>
            </div>
          </div>
        </div>

        <div className="assignments-card">
          <h2>Recent Submissions</h2>
          {submissions.length === 0 ? (
            <p className="no-submissions">No submissions yet</p>
          ) : (
            <div className="submissions-list">
              {submissions.map((submission, index) => (
                <div
                  key={index}
                  className={`submission-item ${submission.isCompleted ? 'completed' : 'pending'}`}
                  onClick={() => handleSubmissionClick(submission)}
                >
                  <div className="submission-info">
                    <h3>{submission.moduleName}</h3>
                    <p>Submitted on: {formatDate(submission.submissionDate)}</p>
                  </div>
                  <div className="submission-status">
                    <span className={`status-badge ${submission.isCompleted ? 'completed' : 'pending'}`}>
                      {submission.isCompleted ? 'Completed' : 'Pending'}
                    </span>
                    <div className="progress-circle">
                      <span>{submission.overallProgress}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showResultPopup && renderResultPopup()}
    </div>
  );
};

export default StudentDashboard;