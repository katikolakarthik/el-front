import React, { useState, useEffect } from 'react';
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
  FiFileText
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

  const displayValue = (val) => {
    if (val === null || val === undefined) return "";
    if (Array.isArray(val)) return val.length > 0 ? val.join(", ") : "";
    if (typeof val === "string" && val.trim() === "") return "";
    return val;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userId = localStorage.getItem('userId');
        if (!userId) throw new Error('User ID not found');

        const profileResponse = await axios.get(
          `http://localhost:5000/student/profile/${userId}`
        );
        if (!profileResponse.data) throw new Error('No profile data received');
        setStudentData(profileResponse.data);

        const assignmentsResponse = await axios.get(
          `http://localhost:5000/assignments/student/${userId}`
        );
        if (assignmentsResponse.data?.success) {
          setAssignments(assignmentsResponse.data.assignments);
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const fetchResultData = async (studentId, assignmentId) => {
    try {
      setResultLoading(true);
              const response = await axios.post(
          'http://localhost:5000/result',
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

  const handleSubmissionClick = (submission) => {
    fetchResultData(studentData.id, submission.assignmentId);
  };

  const closeResultPopup = () => {
    setShowResultPopup(false);
    setResultData(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const renderStaticAnswers = (module) => {
    const submitted = module.submitted || {};
    const fields = [
      { key: 'patientName', label: 'Patient Name' },
      { key: 'ageOrDob', label: 'Age/DOB' },
      { key: 'icdCodes', label: 'ICD Codes' },
      { key: 'cptCodes', label: 'CPT Codes' },
      { key: 'notes', label: 'Notes' }
    ];

    const hasValues = fields.some(field => {
      const value = submitted[field.key];
      return value !== null && 
             value !== undefined && 
             (!Array.isArray(value) || value.length > 0) && 
             (typeof value !== 'string' || value.trim() !== '');
    });

    if (!hasValues) return null;

    return (
      <div className="answers-row">
        {fields.map((field) => {
          const value = submitted[field.key];
          if (value === null || 
              value === undefined || 
              (Array.isArray(value) && value.length === 0) || 
              (typeof value === 'string' && value.trim() === '')) {
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
                  <span>Your Answer:</span>{" "}
                  <strong>{displayValue(sq?.submittedAnswer)}</strong>
                </div>
                <div className="correct-answer">
                  <span>Correct Answer:</span>{" "}
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
    const hasCorrectAnswers = module.correctAnswerKey && (
      module.correctAnswerKey.patientName ||
      module.correctAnswerKey.ageOrDob ||
      (module.correctAnswerKey.icdCodes && module.correctAnswerKey.icdCodes.length > 0) ||
      (module.correctAnswerKey.cptCodes && module.correctAnswerKey.cptCodes.length > 0) ||
      module.correctAnswerKey.notes
    );

    return (
      <div key={index} className="sub-assignment">
        <div className="assignment-title">
          <h3>{module.moduleName || module.subModuleName}</h3>
          {module.assignmentPdf && (
            <a
              href={module.assignmentPdf}
              target="_blank"
              rel="noopener noreferrer"
              className="pdf-link"
            >
              <FiFileText /> View Assignment PDF
            </a>
          )}
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
                    <strong>Patient Name:</strong> {displayValue(module.correctAnswerKey.patientName)}
                  </div>
                )}
                {module.correctAnswerKey?.ageOrDob && (
                  <div>
                    <strong>Age/DOB:</strong> {displayValue(module.correctAnswerKey.ageOrDob)}
                  </div>
                )}
                {module.correctAnswerKey?.icdCodes?.length > 0 && (
                  <div>
                    <strong>ICD Codes:</strong> {displayValue(module.correctAnswerKey.icdCodes)}
                  </div>
                )}
                {module.correctAnswerKey?.cptCodes?.length > 0 && (
                  <div>
                    <strong>CPT Codes:</strong> {displayValue(module.correctAnswerKey.cptCodes)}
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

        {/* Per-assignment progress */}
        {(module.submitted?.correctCount !== undefined || 
          module.submitted?.wrongCount !== undefined || 
          module.submitted?.progressPercent !== undefined) && (
          <div className="module-progress">
            <p>
              {module.submitted?.correctCount !== undefined && (
                <><strong>Correct:</strong> {module.submitted.correctCount} |</>
              )}
              {module.submitted?.wrongCount !== undefined && (
                <><strong>Wrong:</strong> {module.submitted.wrongCount} |</>
              )}
              {module.submitted?.progressPercent !== undefined && (
                <><strong>Progress:</strong> {module.submitted.progressPercent}%</>
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
      <div className="result-popup-overlay">
        <div className="result-popup">
          <button className="close-popup" onClick={closeResultPopup}>
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

      {/* Assignments Section */}
      {/*<div className="assignments-section">
        <h2>Your Assignments</h2>
        <div className="assignments-scroll-container">
          {assignments.length > 0 ? (
            <div className="assignments-grid">
              {assignments.map((assignment, index) => (
                <div key={index} className="assignment-card">
                  <div className="assignment-icon">
                    <FiBook size={20} />
                  </div>
                  <div className="assignment-details">
                    <h3>{assignment.moduleName}</h3>
                    <p>Assigned: {formatDate(assignment.assignedDate)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-assignments">
              <FiClock size={32} />
              <p>No assignments currently assigned</p>
            </div>
          )}
        </div>
      </div>*/}

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
                      studentData.paidAmount + studentData.remainingAmount
                    })`
                  : 'Fully paid'}
              </p>
            </div>
          </div>
        </div>

        <div className="info-card">
          <h2>Submissions</h2>
          <div className="submissions-container">
            {studentData.recentSubmissions?.length > 0 ? (
              studentData.recentSubmissions.map((submission, i) => (
                <div
                  key={i}
                  className="submission-item"
                  onClick={() => handleSubmissionClick(submission)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="submission-header">
                    <FiAward className="submission-icon" />
                    <h3>{submission.moduleName}</h3>
                  </div>
                  <div className="submission-details">
                    <div className="submission-stat">
                      <span>Submitted:</span>
                      <span>{formatDate(submission.submissionDate)}</span>
                    </div>
                    <div className="submission-stat">
                      <span>Score:</span>
                      <span>
                        {submission.totalCorrect} correct, {submission.totalWrong}{' '}
                        wrong
                      </span>
                    </div>
                    <div className="submission-stat">
                      <span>Progress:</span>
                      <span>{submission.overallProgress}%</span>
                    </div>
                  </div>
                </div>
              ))
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