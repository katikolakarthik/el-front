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

  // New state for filtered assignments view
  const [filteredView, setFilteredView] = useState(null); // 'total', 'completed', 'pending', 'avgScore'
  const [filteredAssignments, setFilteredAssignments] = useState([]);

  // --- Helpers ---
  const displayValue = (val) => {
    if (val === null || val === undefined) return '';
    if (Array.isArray(val)) return val.length > 0 ? val.join(', ') : '';
    if (typeof val === 'string' && val.trim() === '') return '';
    return val;
  };

  const hasNonEmpty = (val) => {
    if (val === null || val === undefined) return false;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === 'string') return val.trim() !== '';
    return true;
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
      `https://el-backend-ashen.vercel.app/stats/${encodeURIComponent(courseName)}/${encodeURIComponent(userId)}`
    );
    if (!res.data) throw new Error('No stats data received');
    return res.data;
  }, []);

  const fetchCourseInfo = useCallback(async (userId) => {
    const res = await axios.get(
      `https://el-backend-ashen.vercel.app/payment-details?studentId=${encodeURIComponent(userId)}`
    );
    if (!res.data) throw new Error('No course info received');
    return res.data;
  }, []);

  const fetchSubmissions = useCallback(async (userId) => {
    const res = await axios.get(
      `https://el-backend-ashen.vercel.app/submitted-assignments?studentId=${encodeURIComponent(userId)}`
    );
    return res.data?.assignments || [];
  }, []);

  const fetchAllAssignments = useCallback(async (userId, courseName) => {
    const res = await axios.get(
      `https://el-backend-ashen.vercel.app/category/${encodeURIComponent(courseName)}?studentId=${encodeURIComponent(userId)}`
    );
    
    let assignmentsData = [];
    if (res?.data?.success && Array.isArray(res.data.assignments)) {
      assignmentsData = res.data.assignments;
    } else if (Array.isArray(res?.data)) {
      assignmentsData = res.data;
    } else if (Array.isArray(res?.data?.data)) {
      assignmentsData = res.data.data;
    } else if (res?.data?.assignment) {
      assignmentsData = [res.data.assignment];
    }
    
    return assignmentsData;
  }, []);

  const refreshDashboard = useCallback(async () => {
    const userId = localStorage.getItem('userId');
    const courseName = localStorage.getItem('courseName');
    if (!userId) throw new Error('User ID not found in localStorage');
    if (!courseName) throw new Error('Course name not found in localStorage');

    const [stats, courseInfo, submissions, allAssignments] = await Promise.all([
      fetchDashboardStats(userId, courseName),
      fetchCourseInfo(userId),
      fetchSubmissions(userId),
      fetchAllAssignments(userId, courseName),
    ]);

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
      studentId: courseInfo.studentId,
      name: courseInfo.name,
      courseName: courseInfo.courseName || courseName,
      enrolledDate: courseInfo.enrolledDate,
      paidAmount: courseInfo.paidAmount ?? 0,
      remainingAmount: courseInfo.remainingAmount ?? 0,

      totalAssignments: totalAssigned,
      completedCount: completed,
      averageScore: avgScoreNumber,
      pendingCount: pendingCalculated,
      courseProgress: Math.round((completed / (totalAssigned || 1)) * 100),
      assignmentCompletion: `${completed}/${totalAssigned}`,
    });

    setAssignments(allAssignments);
  }, [fetchCourseInfo, fetchDashboardStats, fetchSubmissions, fetchAllAssignments]);

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

  // Build submissions list from new API
  const submissions = useMemo(() => {
    if (!Array.isArray(assignments)) return [];

    return assignments.map((a) => {
      if (!a.assignmentId) return null;

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
        moduleName: (a.assignmentName || '').trim(),
        isCompleted: a.isCompleted === true,
        submissionDate: a.assignedDate,
        totalCorrect: a.totalCorrect ?? 0,
        totalWrong: a.totalWrong ?? 0,
        overallProgress: a.progressPercent ?? fallbackProgress,
      };
    }).filter(Boolean);
  }, [assignments]);

  // --- Assignment Filtering Logic ---
  const filterAssignments = useCallback((filterType) => {
    if (!Array.isArray(assignments)) return [];

    switch (filterType) {
      case 'total':
        return assignments;
      case 'completed':
        return assignments.filter(assignment => {
          // Check if assignment is completed (either directly or all sub-assignments completed)
          if (assignment.isCompleted === true) return true;
          if (assignment.subAssignments?.length > 0) {
            return assignment.subAssignments.every(sub => sub.isCompleted === true);
          }
          return false;
        });
      case 'pending':
        return assignments.filter(assignment => {
          // Check if assignment is pending (not completed)
          if (assignment.isCompleted === true) return false;
          if (assignment.subAssignments?.length > 0) {
            return !assignment.subAssignments.every(sub => sub.isCompleted === true);
          }
          return true;
        });
      case 'avgScore':
        // For average score, we'll show all assignments with their scores
        return assignments;
      default:
        return assignments;
    }
  }, [assignments]);

  // --- Card Click Handlers ---
  const handleCardClick = (cardType) => {
    const filtered = filterAssignments(cardType);
    setFilteredAssignments(filtered);
    setFilteredView(cardType);
  };

  const clearFilter = () => {
    setFilteredView(null);
    setFilteredAssignments([]);
  };

  // --- Handlers ---
  const handleSubmissionClick = (submission) => {
    if (!submission || submission.isCompleted !== true) return;

    const studentId = studentData?.studentId;
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

  // Popup UX: lock scroll, close on Esc
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

  /* -------------------- RESULT POPUP RENDER HELPERS -------------------- */

  // All supported fields (we will show only if non-empty)
  const FIELD_DEFS = [
    { key: 'patientName', label: 'Patient Name' },
    { key: 'ageOrDob', label: 'Age/DOB' },
    { key: 'icdCodes', label: 'ICD Codes' },
    { key: 'cptCodes', label: 'CPT Codes' },
    { key: 'pcsCodes', label: 'PCS Codes' },
    { key: 'hcpcsCodes', label: 'HCPCS Codes' },
    { key: 'drgValue', label: 'DRG Value' },
    { key: 'modifiers', label: 'Modifiers' },
    { key: 'adx', label: 'Adx' },
    { key: 'notes', label: 'Notes' },
  ];

  const renderStaticAnswers = (module) => {
    const submitted = module.submitted || {};
    const items = FIELD_DEFS
      .map((f) => ({ ...f, value: submitted[f.key] }))
      .filter((f) => hasNonEmpty(f.value));

    if (items.length === 0) return null;

    return (
      <div className="answers-row">
        {items.map((f) => (
          <div key={f.key}>
            <strong>{f.label}:</strong> {displayValue(f.value)}
          </div>
        ))}
      </div>
    );
  };

  const renderCorrectAnswers = (correctAnswerKey = {}) => {
    const items = FIELD_DEFS
      .map((f) => ({ ...f, value: correctAnswerKey[f.key] }))
      .filter((f) => hasNonEmpty(f.value));

    if (items.length === 0) return null;

    return (
      <div className="answers-row">
        {items.map((f) => (
          <div key={f.key}>
            <strong>{f.label}:</strong> {displayValue(f.value)}
          </div>
        ))}
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
    const hasCorrectAnswers =
      module.correctAnswerKey &&
      FIELD_DEFS.some((f) => hasNonEmpty(module.correctAnswerKey[f.key]));

    return (
      <div key={index} className="sub-assignment">
        <div className="assignment-title">
          <h3>{module.moduleName || module.subModuleName || 'Result'}</h3>
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
              {renderCorrectAnswers(module.correctAnswerKey)}
            </div>
          )}
        </div>

        {/* Dynamic questions */}
        {renderDynamicQuestions(
          module.submitted?.dynamicQuestions,
          module.correctDynamicQuestions
        )}

        {/* Optional per-module progress display */}
        {(module.submitted?.correctCount !== undefined ||
          module.submitted?.wrongCount !== undefined ||
          module.submitted?.progressPercent !== undefined) && (
          <div className="module-progress">
            <p>
              {module.submitted?.correctCount !== undefined && (
                <>
                  <strong>Correct:</strong> {module.submitted.correctCount} |
                </>
              )}{' '}
              {module.submitted?.wrongCount !== undefined && (
                <>
                  <strong>Wrong:</strong> {module.submitted.wrongCount} |
                </>
              )}{' '}
              {module.submitted?.progressPercent !== undefined && (
                <>
                  <strong>Progress:</strong>{' '}
                  {module.submitted.progressPercent}%
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

    const modules = Array.isArray(resultData.data)
      ? resultData.data
      : [resultData.data];

    return (
      <div className="result-popup-overlay" onClick={closeResultPopup}>
        <div
          className="result-popup"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="close-popup"
            onClick={closeResultPopup}
            aria-label="Close results"
          >
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
                <strong className="progress">
                  {resultData.overallProgress}%
                </strong>
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
      <header className="dashboard-header">
        <h1>Welcome back, {studentData.name}!</h1>
      </header>

      {/* Stats Section */}
      <div className="stats-grid">
        <div 
          className="stat-card clickable-card" 
          onClick={() => handleCardClick('total')}
          title="Click to view all assignments"
        >
          <div className="stat-icon">
            <FiBook size={24} />
          </div>
          <div className="stat-content">
            <h3>Total Assignments</h3>
            <p className="stat-value">{studentData.totalAssignments}</p>
            <p className="stat-label">Assigned to you</p>
          </div>
        </div>

        <div 
          className="stat-card clickable-card" 
          onClick={() => handleCardClick('completed')}
          title="Click to view completed assignments"
        >
          <div className="stat-icon">
            <FiCheckCircle size={24} />
          </div>
          <div className="stat-content">
            <h3>Completed</h3>
            <p className="stat-value">{studentData.completedCount}</p>
            <p className="stat-label">Successfully submitted</p>
          </div>
        </div>

        <div 
          className="stat-card clickable-card" 
          onClick={() => handleCardClick('avgScore')}
          title="Click to view assignments with scores"
        >
          <div className="stat-icon">
            <FiTrendingUp size={24} />
          </div>
          <div className="stat-content">
            <h3>Average Score</h3>
            <p className="stat-value">{studentData.averageScore}%</p>
            <p className="stat-label">Your performance</p>
          </div>
        </div>

        <div 
          className="stat-card clickable-card" 
          onClick={() => handleCardClick('pending')}
          title="Click to view pending assignments"
        >
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

      {/* Filtered Assignments Section */}
      {filteredView && (
        <div className="filtered-assignments-section">
          <div className="filtered-header">
            <h2>
              {filteredView === 'total' && 'All Assignments'}
              {filteredView === 'completed' && 'Completed Assignments'}
              {filteredView === 'pending' && 'Pending Assignments'}
              {filteredView === 'avgScore' && 'Assignments with Scores'}
            </h2>
            <button 
              className="clear-filter-btn" 
              onClick={clearFilter}
              title="Clear filter and return to dashboard"
            >
              <FiX size={16} />
              Clear Filter
            </button>
          </div>
          
          <div className="filtered-assignments-container">
            {filteredAssignments.length > 0 ? (
              filteredAssignments.map((assignment, index) => {
                const isCompleted = assignment.isCompleted === true || 
                  (assignment.subAssignments?.length > 0 && 
                   assignment.subAssignments.every(sub => sub.isCompleted === true));
                
                const submission = submissions.find(s => s.assignmentId === assignment._id);
                
                return (
                  <div
                    key={`${assignment._id || 'a'}-${index}`}
                    className={`filtered-assignment-item ${
                      isCompleted ? '' : 'filtered-assignment-item--disabled'
                    }`}
                    onClick={() =>
                      isCompleted && submission ? handleSubmissionClick(submission) : null
                    }
                    title={
                      isCompleted
                        ? 'Click to view result'
                        : 'Result available after completion'
                    }
                    style={{
                      cursor: isCompleted ? 'pointer' : 'not-allowed',
                      opacity: isCompleted ? 1 : 0.6,
                    }}
                  >
                    <div className="filtered-assignment-header">
                      <FiAward className="filtered-assignment-icon" />
                      <h3>
                        {assignment.moduleName || assignment.assignmentName || 'Assignment'}
                      </h3>
                      <span
                        className={`status-badge ${
                          isCompleted
                            ? 'status-badge--completed'
                            : 'status-badge--pending'
                        }`}
                      >
                        {isCompleted ? 'Completed' : 'Pending'}
                      </span>
                    </div>
                    
                    {assignment.subAssignments?.length > 0 && (
                      <div className="assignment-progress">
                        <span>
                          Progress: {assignment.subAssignments.filter(sub => sub.isCompleted).length} / {assignment.subAssignments.length} sections completed
                        </span>
                      </div>
                    )}
                    
                    {filteredView === 'avgScore' && submission && (
                      <div className="assignment-score">
                        <span>Score: {submission.overallProgress || 0}%</span>
                        <span>Correct: {submission.totalCorrect || 0}</span>
                        <span>Wrong: {submission.totalWrong || 0}</span>
                      </div>
                    )}
                    
                    <div className="assignment-details">
                      <span>Assigned: {formatDate(assignment.assignedDate)}</span>
                      {assignment.dueDate && (
                        <span>Due: {formatDate(assignment.dueDate)}</span>
                      )}
                      {assignment.category && (
                        <span>Category: {assignment.category}</span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="no-filtered-assignments">
                <FiClock size={32} />
                <p>
                  {filteredView === 'completed' && 'No completed assignments yet.'}
                  {filteredView === 'pending' && 'No pending assignments.'}
                  {filteredView === 'total' && 'No assignments found.'}
                  {filteredView === 'avgScore' && 'No assignments with scores available.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

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
        <div className="info-card">
          <h2>Submissions</h2>

          <div className="submissions-container">
            {submissions.length > 0 ? (
              submissions.map((submission, i) => {
                const completed = submission.isCompleted === true;
                return (
                  <div
                    key={`${submission.assignmentId || 'a'}-${i}`}
                    className={`submission-item ${
                      completed ? '' : 'submission-item--disabled'
                    }`}
                    onClick={() =>
                      completed ? handleSubmissionClick(submission) : null
                    }
                    title={
                      completed
                        ? 'Click to view result'
                        : 'Result available after completion'
                    }
                    style={{
                      cursor: completed ? 'pointer' : 'not-allowed',
                      opacity: completed ? 1 : 0.6,
                    }}
                  >
                    <div className="submission-header">
                      <FiAward className="submission-icon" />
                      <h3>
                        {submission.moduleName || ' '}
                      </h3>
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
                    <div className="submission-details"></div>
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

      {showResultPopup && renderResultPopup()}
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
