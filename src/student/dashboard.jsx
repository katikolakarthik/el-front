import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../utils/api';
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
  const [statsData, setStatsData] = useState(null);
  const [paymentData, setPaymentData] = useState(null);

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
  const fetchStats = useCallback(async (userId, courseName) => {
    const res = await api.get(
      `/stats/${encodeURIComponent(courseName)}/${encodeURIComponent(userId)}`
    );
    if (!res.data) throw new Error('No stats data received');
    return res.data;
  }, []);

  const fetchPaymentDetails = useCallback(async (userId) => {
    const res = await api.get(
      `/payment-details?studentId=${encodeURIComponent(userId)}`
    );
    if (!res.data) throw new Error('No payment data received');
    return res.data;
  }, []);

  const fetchAssignments = useCallback(async (userId) => {
    const res = await api.get(
      `/submitted-assignments?studentId=${encodeURIComponent(userId)}`
    );
    if (res.data?.assignments) {
      return res.data.assignments || [];
    }
    return [];
  }, []);

  const refreshDashboard = useCallback(async () => {
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) throw new Error('User ID not found');

      // Get course name from localStorage
      const userDataStr = localStorage.getItem('userData');
      const userData = userDataStr ? JSON.parse(userDataStr) : {};
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
        enrolledDate: payment.enrolledDate,
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
        const userId = localStorage.getItem('userId');
        if (!userId) throw new Error('User ID not found');

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
      const response = await api.post(
        '/result',
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            <div key={i} className="dynamic-question">
              <div className="question-text">
                <strong>Q{i + 1}:</strong> {cq.questionText}
              </div>
              <div className="question-answers">
                <div className="submitted-answer">
                  <span>Your Answer:</span>{' '}
                  <strong>{displayValue(sq?.submittedAnswer)}</strong>
                </div>
                <div className="correct-answer">
                  <span>Correct Answer:</span>{' '}
                  <strong>{displayValue(cq.answer || cq.correctAnswer)}</strong>
                </div>
              </div>
              {cq.options?.length > 0 && (
                <div className="question-options">
                  <span>Options:</span> {displayValue(cq.options)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderModule = (module, index) => {
    // include new fields in the "has correct answers" gate
    const hasCorrectAnswers =
      module.correctAnswerKey &&
      (
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
          {/* No PDF link shown in popup */}
        </div>

        {/* Static fields */}
        <div className="answers-comparison">
          <div className="answers-section">
            <h4>Your Answers</h4>
            {renderStaticAnswers({ submitted: module.submitted })}
          </div>

          {hasCorrectAnswers && (
            <div className="answers-section">
              <h4>Correct Answers</h4>
              <div className="answers-row">
                {module.correctAnswerKey?.patientName && (
                  <div>
                    <strong>Patient Name:</strong>{' '}
                    {displayValue(module.correctAnswerKey.patientName)}
                  </div>
                )}
                {module.correctAnswerKey?.ageOrDob && (
                  <div>
                    <strong>Age/DOB:</strong>{' '}
                    {displayValue(module.correctAnswerKey.ageOrDob)}
                  </div>
                )}
                {module.correctAnswerKey?.icdCodes?.length > 0 && (
                  <div>
                    <strong>ICD Codes:</strong>{' '}
                    {displayValue(module.correctAnswerKey.icdCodes)}
                  </div>
                )}
                {module.correctAnswerKey?.cptCodes?.length > 0 && (
                  <div>
                    <strong>CPT Codes:</strong>{' '}
                    {displayValue(module.correctAnswerKey.cptCodes)}
                  </div>
                )}
                {/* NEW: PCS/HCPCS/DRG/Modifiers */}
                {module.correctAnswerKey?.pcsCodes?.length > 0 && (
                  <div>
                    <strong>PCS Codes:</strong>{' '}
                    {displayValue(module.correctAnswerKey.pcsCodes)}
                  </div>
                )}
                {module.correctAnswerKey?.hcpcsCodes?.length > 0 && (
                  <div>
                    <strong>HCPCS Codes:</strong>{' '}
                    {displayValue(module.correctAnswerKey.hcpcsCodes)}
                  </div>
                )}
                {module.correctAnswerKey?.drgValue && (
                  <div>
                    <strong>DRG Value:</strong>{' '}
                    {displayValue(module.correctAnswerKey.drgValue)}
                  </div>
                )}
                {module.correctAnswerKey?.modifiers?.length > 0 && (
                  <div>
                    <strong>Modifiers:</strong>{' '}
                    {displayValue(module.correctAnswerKey.modifiers)}
                  </div>
                )}
                {module.correctAnswerKey?.notes && (
                  <div>
                    <strong>Notes:</strong> {displayValue(module.correctAnswerKey.notes)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Dynamic questions */}
        {renderDynamicQuestions(
          module.submitted?.dynamicQuestions,
          module.correctDynamicQuestions
        )}

        {/* Per-module progress (optional) */}
        {(module.submitted?.correctCount !== undefined ||
          module.submitted?.wrongCount !== undefined ||
          module.submitted?.progressPercent !== undefined) && (
          <div className="module-progress">
            <p>
              {module.submitted?.correctCount !== undefined && (
                <>
                  <strong>Correct:</strong> {module.submitted.correctCount} |
                </>
              )}
              {module.submitted?.wrongCount !== undefined && (
                <>
                  <strong>Wrong:</strong> {module.submitted.wrongCount} |
                </>
              )}
              {module.submitted?.progressPercent !== undefined && (
                <>
                  <strong>Progress:</strong> {module.submitted.progressPercent}%
                </>
              )}
            </p>
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

          <div className="multi-assignment-result">
            {modules.map((m, i) => renderModule(m, i))}
          </div>
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
      <header className="dashboard-header"></header>

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
            <p className="stat-label">Successfully submitted</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <FiTrendingUp size={24} />
          </div>
          <div className="stat-content">
            <h3>Average Score</h3>
            <p className="stat-value">{studentData.averageScore || 0}%</p>
            <p className="stat-label">Your performance</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <FiAlertCircle size={24} />
          </div>
          <div className="stat-content">
            <h3>Pending</h3>
            <p className="stat-value">{studentData.pendingCount || 0}</p>
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
