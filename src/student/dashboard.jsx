import React, { useState, useEffect, useMemo, useCallback } from 'react';
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

/** Direct API base URL */
const BASE_URL = 'https://el-backend-ashen.vercel.app';

/** Safe getter for localStorage user */
const getStoredUser = () => {
  try {
    const raw = localStorage.getItem('userData');
    return raw ? JSON.parse(raw) : null; // { id, name, courseName, enrolledDate, ... }
  } catch {
    return null;
  }
};

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
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // --- Fetchers (direct API calls) ---
  const fetchJSON = async (url, options) => {
    const res = await fetch(url, options);
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${txt || res.statusText}`);
    }
    return res.json();
  };

  const fetchStats = useCallback(async (userId, courseName) => {
    return fetchJSON(
      `${BASE_URL}/stats/${encodeURIComponent(courseName)}/${encodeURIComponent(userId)}`
    );
  }, []);

  const fetchPaymentDetails = useCallback(async (userId) => {
    return fetchJSON(`${BASE_URL}/payment-details?studentId=${encodeURIComponent(userId)}`);
  }, []);

  const fetchAssignments = useCallback(async (userId) => {
    const data = await fetchJSON(
      `${BASE_URL}/submitted-assignments?studentId=${encodeURIComponent(userId)}`
    );
    return data?.assignments || [];
  }, []);

  const refreshDashboard = useCallback(async () => {
    try {
      // 🔑 userId & courseName from localStorage.userData (login response shape)
      const user = getStoredUser();
      if (!user?.id) throw new Error('User not logged in');

      const userId = user.id;
      const courseName = user.courseName || 'CCS';

      const [stats, payment, assigns] = await Promise.all([
        fetchStats(userId, courseName),
        fetchPaymentDetails(userId),
        fetchAssignments(userId),
      ]);

      setStatsData(stats);
      setPaymentData(payment);
      setAssignments(assigns);

      setStudentData({
        // prefer API data where present, else fallback to login payload
        name: user.name,
        profileImage: user.profileImage,
        courseName: payment?.courseName || user.courseName || courseName,
        enrolledDate: payment?.enrolledDate || user.enrolledDate,
        paidAmount: payment?.paidAmount ?? 0,
        remainingAmount: payment?.remainingAmount ?? 0,

        totalAssignments: stats?.totalAssigned ?? 0,
        completedCount: stats?.completed ?? 0,
        averageScore: stats?.averageScore
          ? String(stats.averageScore).replace('%', '')
          : '0',
        pendingCount: stats?.pending ?? 0,
        courseProgress:
          Math.round(((stats?.completed ?? 0) / (stats?.totalAssigned || 1)) * 100) || 0,
        assignmentCompletion: `${stats?.completed ?? 0}/${stats?.totalAssigned ?? 0}`,
      });
    } catch (err) {
      setError(err.message || 'Failed to refresh data');
    }
  }, [fetchStats, fetchPaymentDetails, fetchAssignments]);

  // Initial load
  useEffect(() => {
    (async () => {
      try {
        const user = getStoredUser();
        if (!user?.id) throw new Error('User not logged in');
        await refreshDashboard();
      } catch (err) {
        setError(err.message || 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshDashboard]);

  // --- Results fetching ---
  const fetchResultData = async (studentId, assignmentId) => {
    try {
      setResultLoading(true);
      const data = await fetchJSON(`${BASE_URL}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, assignmentId }),
      });
      setResultData(data);
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
      const totalSub = a?.subAssignments?.length ?? 0;
      const doneSub = a?.subAssignments?.filter((s) => s?.isCompleted)?.length ?? 0;
      const fallbackProgress =
        totalSub > 0 ? Math.round((doneSub / totalSub) * 100) : a?.isCompleted ? 100 : 0;

      return {
        assignmentId: a?.assignmentId,
        moduleName: a?.assignmentName || 'Assignment',
        isCompleted: a?.isCompleted === true, // gate by parent assignment completion
        submissionDate: new Date().toISOString(),
        totalCorrect: 0,
        totalWrong: 0,
        overallProgress: fallbackProgress,
      };
    });
  }, [assignments]);

  // --- Handlers ---
  const handleSubmissionClick = (submission) => {
    if (!submission || submission.isCompleted !== true) return; // only if parent completed
    const user = getStoredUser();
    const studentId = user?.id;
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
    const submitted = module?.submitted || {};

    // Includes PCS/HCPCS/DRG/Modifiers
    const fields = [
      { key: 'patientName', label: 'Patient Name' },
      { key: 'ageOrDob', label: 'Age/DOB' },
      { key: 'icdCodes', label: 'ICD Codes' },
      { key: 'cptCodes', label: 'CPT Codes' },
      { key: 'pcsCodes', label: 'PCS Codes' },
      { key: 'hcpcsCodes', label: 'HCPCS Codes' },
      { key: 'drgValue', label: 'DRG Value' },
      { key: 'modifiers', label: 'Modifiers' },
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
            <div key={field.key} className="answer-chip">
              <strong>{field.label}:</strong> {displayValue(value)}
            </div>
          );
        })}
      </div>
    );
  };

  const renderDynamicQuestions = (submittedQuestions, correctQuestions) => {
    if (!Array.isArray(correctQuestions) || correctQuestions.length === 0) return null;

    return (
      <div className="dynamic-questions-container">
        {correctQuestions.map((cq, i) => {
          const sq = Array.isArray(submittedQuestions) ? submittedQuestions[i] : undefined;
          const qText =
            cq?.questionText ||
            cq?.text ||
            cq?.q ||
            (typeof cq === 'string' ? cq : 'Question');

          const submittedAns =
            sq?.answerText ??
            sq?.selected ??
            sq?.answer ??
            sq?.value ??
            (typeof sq === 'string' ? sq : undefined);

          const correctAns =
            cq?.correctAnswer ??
            cq?.answer ??
            cq?.expectedAnswer ??
            cq?.correct ??
            (typeof cq === 'string' ? cq : undefined);

          const explanation = cq?.explanation || cq?.why || '';

          return (
            <div key={i} className="dynamic-question">
              <div className="dq-header">
                <span className="dq-number">Q{i + 1}.</span>
                <span className="dq-text">{displayValue(qText)}</span>
              </div>
              <div className="dq-row">
                <div className="dq-col">
                  <span className="dq-label">Your Answer:</span>{' '}
                  <span className="dq-value">{displayValue(submittedAns) || '—'}</span>
                </div>
                <div className="dq-col">
                  <span className="dq-label">Correct Answer:</span>{' '}
                  <span className="dq-value">{displayValue(correctAns) || '—'}</span>
                </div>
              </div>
              {explanation ? (
                <div className="dq-explanation">
                  <em>Explanation:</em> {displayValue(explanation)}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };

  const renderModule = (module, index) => {
    const hasCorrectAnswers =
      module?.correctAnswerKey &&
      (module.correctAnswerKey.patientName ||
        module.correctAnswerKey.ageOrDob ||
        (Array.isArray(module.correctAnswerKey.icdCodes) &&
          module.correctAnswerKey.icdCodes.length > 0) ||
        (Array.isArray(module.correctAnswerKey.cptCodes) &&
          module.correctAnswerKey.cptCodes.length > 0) ||
        (Array.isArray(module.correctAnswerKey.pcsCodes) &&
          module.correctAnswerKey.pcsCodes.length > 0) ||
        (Array.isArray(module.correctAnswerKey.hcpcsCodes) &&
          module.correctAnswerKey.hcpcsCodes.length > 0) ||
        module.correctAnswerKey.drgValue ||
        (Array.isArray(module.correctAnswerKey.modifiers) &&
          module.correctAnswerKey.modifiers.length > 0) ||
        module.correctAnswerKey.notes);

    const hasDynamic = Array.isArray(module?.correctQuestions) && module.correctQuestions.length > 0;

    return (
      <div key={index} className="sub-assignment">
        <div className="assignment-title">
          <h3>{module?.moduleName || module?.subModuleName || `Module ${index + 1}`}</h3>
        </div>

        {/* Static (keyed) answers */}
        {hasCorrectAnswers ? (
          <div className="module-block">
            <h4 className="block-heading">
              <FiCheckCircle className="mr-6" /> Keyed Answers
            </h4>
            {renderStaticAnswers(module)}
            {module?.correctAnswerKey ? (
              <div className="correct-key">
                <details>
                  <summary>View Correct Key</summary>
                  <pre className="code-block">
                    {JSON.stringify(module.correctAnswerKey, null, 2)}
                  </pre>
                </details>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Dynamic Q&A */}
        {hasDynamic ? (
          <div className="module-block">
            <h4 className="block-heading">
              <FiTrendingUp className="mr-6" /> Question-wise Results
            </h4>
            {renderDynamicQuestions(module?.submittedQuestions, module?.correctQuestions)}
          </div>
        ) : null}

        {!hasCorrectAnswers && !hasDynamic ? (
          <div className="module-block empty">
            <FiAlertCircle /> No detailed answers available for this module.
          </div>
        ) : null}
      </div>
    );
  };

  const renderResultPopup = () => {
    if (!resultData) return null;

    const modules = Array.isArray(resultData?.data)
      ? resultData.data
      : [resultData?.data].filter(Boolean);

    return (
      <div className="result-popup-overlay" onClick={closeResultPopup}>
        <div className="result-popup" onClick={(e) => e.stopPropagation()}>
          <button className="close-popup" onClick={closeResultPopup} aria-label="Close results">
            <FiX size={24} />
          </button>

          <div className="result-header">
            <h2>
              <FiAward className="mr-8" />
              Assignment Result
            </h2>
            {resultLoading ? <p className="muted">Loading detailed results…</p> : null}
          </div>

          {resultData?.summary ? (
            <div className="result-summary">
              <div className="summary-item">
                <span>Total</span>
                <strong>{displayValue(resultData.summary.total)}</strong>
              </div>
              <div className="summary-item">
                <span>Correct</span>
                <strong>{displayValue(resultData.summary.correct)}</strong>
              </div>
              <div className="summary-item">
                <span>Wrong</span>
                <strong>{displayValue(resultData.summary.wrong)}</strong>
              </div>
              <div className="summary-item">
                <span>Score</span>
                <strong>{displayValue(resultData.summary.score)}%</strong>
              </div>
            </div>
          ) : null}

          <div className="modules-wrapper">
            {modules.length === 0 ? (
              <div className="module-block empty">
                <FiAlertCircle /> No module data returned.
              </div>
            ) : (
              modules.map((m, idx) => renderModule(m, idx))
            )}
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
      <header className="dashboard-header">
        <h1>
          <FiBook className="mr-8" />
          Student Dashboard
        </h1>
        {studentData?.name ? <p className="muted">Welcome, {studentData.name} 👋</p> : null}
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
            <p className="stat-label">So far</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <FiTrendingUp size={24} />
          </div>
          <div className="stat-content">
            <h3>Average Score</h3>
            <p className="stat-value">
              {studentData.averageScore ? `${studentData.averageScore}%` : '0%'}
            </p>
            <p className="stat-label">Across completed</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <FiClock size={24} />
          </div>
          <div className="stat-content">
            <h3>Pending</h3>
            <p className="stat-value">{studentData.pendingCount || 0}</p>
            <p className="stat-label">Assignments</p>
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
      </div>

      {/* Submissions / Assignments List */}
      <div className="submissions-section">
        <h2>
          <FiAward className="mr-8" />
          Your Assignments
        </h2>
        <div className="submissions-grid">
          {submissions.length === 0 ? (
            <div className="submission-card empty">
              <FiAlertCircle /> No submissions yet.
            </div>
          ) : (
            submissions.map((s, idx) => (
              <div
                key={`${s.assignmentId || idx}`}
                className={`submission-card ${s.isCompleted ? 'clickable' : 'disabled'}`}
                onClick={() => handleSubmissionClick(s)}
                role={s.isCompleted ? 'button' : 'article'}
                tabIndex={s.isCompleted ? 0 : -1}
                onKeyDown={(e) => {
                  if (s.isCompleted && (e.key === 'Enter' || e.key === ' ')) {
                    handleSubmissionClick(s);
                  }
                }}
                title={
                  s.isCompleted
                    ? 'View result'
                    : 'Complete the assignment to view result'
                }
              >
                <div className="submission-header">
                  <h3>{s.moduleName}</h3>
                  <span className={`badge ${s.isCompleted ? 'success' : 'pending'}`}>
                    {s.isCompleted ? 'Completed' : 'Pending'}
                  </span>
                </div>
                <div className="submission-body">
                  <div className="submission-row">
                    <span className="label">Progress</span>
                    <span className="value">{s.overallProgress}%</span>
                  </div>
                  <div className="submission-row">
                    <span className="label">Submitted</span>
                    <span className="value">{formatDate(s.submissionDate)}</span>
                  </div>
                </div>
                <div className="submission-footer">
                  {s.isCompleted ? 'Click to view result' : 'Finish to unlock result'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Result Popup */}
      {showResultPopup && renderResultPopup()}
    </div>
  );
};

export default StudentDashboard;