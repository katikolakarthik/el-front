import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./assignment.css";

// API base URL
const API_BASE = "https://el-backend-ashen.vercel.app/admin";

// --- Reusable Button Component ---
const Button = ({ onClick, disabled, children, variant = "primary", className = "" }) => {
  const [isHovered, setIsHovered] = useState(false);

  let baseClass = "button";
  if (variant === "danger") baseClass += " button-danger";
  if (variant === "primary") baseClass += " button-primary";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClass} ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={isHovered && !disabled ? { filter: "brightness(0.9)" } : {}}
    >
      {children}
    </button>
  );
};

// --- Refactored Modal Component ---
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <>
      <div onClick={onClose} className="modal-overlay" />
      <div role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1} className="modal-content">
        <div className="modal-header">
          <h3 id="modal-title" className="modal-title">{title}</h3>
          <button onClick={onClose} aria-label="Close modal" className="modal-close-button">&times;</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </>
  );
};

// --- Enhanced Student Summary View ---
const StudentSummaryView = ({ summary, onBack, loading, error }) => {
  if (loading) return <p className="loading-text">Loading student summary...</p>;
  if (error) return <p className="error-text">Error: {error}</p>;
  if (!summary) return <p className="no-data-text">No summary data available.</p>;

  const renderDynamicQuestions = (questions, answerKeyQuestions) => {
    if (!questions || questions.length === 0) {
      return <p className="no-data-text">No questions answered</p>;
    }

    return (
      <div className="questions-container">
        {questions.map((q, index) => {
          const answerKeyQuestion = answerKeyQuestions?.find(aq => 
            aq.questionText === q.questionText || aq._id === q._id
          );
          
          return (
            <div
              key={index}
              className={`question-card ${q.isCorrect ? 'correct' : 'incorrect'}`}
            >
              <p><strong>Question:</strong> {q.questionText}</p>
              {q.options?.length > 0 && (
                <p><strong>Options:</strong> {q.options.join(', ')}</p>
              )}
              <p><strong>Submitted Answer:</strong> {q.submittedAnswer}</p>
              <p><strong>Correct Answer:</strong> {answerKeyQuestion?.answer || answerKeyQuestion?.correctAnswer || q.correctAnswer}</p>
              <p><strong>Status:</strong> {q.isCorrect ? '✓ Correct' : '✗ Incorrect'}</p>
            </div>
          );
        })}
      </div>
    );
  };

  const renderPatientInfo = (values, answerKey = null) => {
    return (
      <div className="field-group">
        <h4>Patient Details</h4>
        <div className="comparison-row">
          <div className="comparison-col">
            <p><strong>Name:</strong> {values.patientName || '-'}</p>
            <p><strong>Age/DOB:</strong> {values.ageOrDob || '-'}</p>
            <p><strong>ICD Codes:</strong> {values.icdCodes?.join(', ') || '-'}</p>
            <p><strong>CPT Codes:</strong> {values.cptCodes?.join(', ') || '-'}</p>
            <p><strong>Notes:</strong> {values.notes || '-'}</p>
          </div>
          {answerKey && (
            <div className="comparison-col answer-key">
              <h5>Answer Key</h5>
              <p><strong>Name:</strong> {answerKey.patientName || '-'}</p>
              <p><strong>Age/DOB:</strong> {answerKey.ageOrDob || '-'}</p>
              <p><strong>ICD Codes:</strong> {answerKey.icdCodes?.join(', ') || '-'}</p>
              <p><strong>CPT Codes:</strong> {answerKey.cptCodes?.join(', ') || '-'}</p>
              <p><strong>Notes:</strong> {answerKey.notes || '-'}</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSubmission = (enteredValues, answerKey, correctCount, wrongCount, progressPercent) => {
    if (!enteredValues) {
      return <p className="no-data-text">No answers submitted</p>;
    }

    return (
      <>
        {(enteredValues.patientName ||
          enteredValues.icdCodes?.length > 0 ||
          enteredValues.cptCodes?.length > 0) &&
          renderPatientInfo(enteredValues, answerKey)}

        {enteredValues.dynamicQuestions?.length > 0 && (
          <div className="field-group">
            <h4>Dynamic Questions</h4>
            {renderDynamicQuestions(enteredValues.dynamicQuestions, answerKey?.dynamicQuestions)}
          </div>
        )}

        <div className="progress-info">
          <p><strong>Correct:</strong> {correctCount}</p>
          <p><strong>Wrong:</strong> {wrongCount}</p>
          <p><strong>Progress:</strong> {progressPercent}%</p>
        </div>
      </>
    );
  };

  return (
    <div className="student-summary-container">
      <Button onClick={onBack} variant="primary" className="mb-1">
        ← Back to Students
      </Button>

      <div className="summary-stats">
        <div className="stat-card">
          <h4>Total Correct</h4>
          <p className="stat-value">{summary.totalCorrect}</p>
        </div>
        <div className="stat-card">
          <h4>Total Wrong</h4>
          <p className="stat-value">{summary.totalWrong}</p>
        </div>
        <div className="stat-card">
          <h4>Overall Progress</h4>
          <p className="stat-value">{summary.overallProgress}%</p>
        </div>
      </div>

      {summary.parentSummary && (
        <div className="parent-summary-section">
          <h3>Main Assignment Answers</h3>
          {renderSubmission(
            summary.parentSummary.enteredValues,
            summary.parentSummary.answerKey,
            summary.parentSummary.correctCount,
            summary.parentSummary.wrongCount,
            summary.parentSummary.progressPercent
          )}
        </div>
      )}

      <div className="submodules-section">
        <h3>Sub-Modules</h3>
        {summary.subModulesSummary.length === 0 ? (
          <p className="no-data-text">No sub-modules in this assignment</p>
        ) : (
          summary.subModulesSummary.map((sub, index) => (
            <div key={index} className="submodule-card">
              <h4>{sub.subModuleName}</h4>
              {renderSubmission(
                sub.enteredValues,
                sub.answerKey,
                sub.correctCount,
                sub.wrongCount,
                sub.progressPercent
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// --- Students Modal ---
const StudentsModal = ({ module, studentSummaryProps }) => {
  const { assignedStudents } = module;
  const { selectedStudent, studentSummary, summaryLoading, summaryError, onSelectStudent, onBack } = studentSummaryProps;

  const StudentListItem = ({ student, onClick }) => (
    <li
      className="student-list-item"
      onClick={onClick}
    >
      <strong>{student.name}</strong> ({student.courseName}) — Enrolled: {new Date(student.enrolledDate).toLocaleDateString()}
    </li>
  );

  if (selectedStudent) {
    return (
      <StudentSummaryView
        summary={studentSummary}
        onBack={onBack}
        loading={summaryLoading}
        error={summaryError}
      />
    );
  }

  if (assignedStudents.length === 0) {
    return <p className="no-data-text">No students have been assigned to this module.</p>;
  }

  return (
    <ul className="student-list">
      {assignedStudents.map(stu => (
        <StudentListItem key={stu._id} student={stu} onClick={() => onSelectStudent(stu, module._id)} />
      ))}
    </ul>
  );
};

// --- Simplified Assignment Card ---
const AssignmentCard = ({ assignment, onDeleteModule, onDeleteSubAssignment, onOpenStudentsModal, deleting }) => {
  const { _id: moduleId, moduleName, assignedDate, subAssignments, assignmentPdf } = assignment;

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">{moduleName}</h3>
        <div className="card-actions">
          <Button
            onClick={() => onDeleteModule(moduleId)}
            disabled={deleting[moduleId]}
            variant="danger"
          >
            {deleting[moduleId] ? "Deleting..." : "Delete Module"}
          </Button>
          <Button
            onClick={onOpenStudentsModal}
            variant="primary"
          >
            View Students ({assignment.assignedStudents.length})
          </Button>
        </div>
      </div>
      <div className="card-meta">
        <span>Assigned on: {new Date(assignedDate).toLocaleDateString()}</span>
      </div>
      <div className="card-body">
        {subAssignments.length === 0 && assignmentPdf && (
          <div className="parent-pdf-view">
            <a 
              href={assignmentPdf} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="pdf-link"
            >
              View Assignment PDF
            </a>
          </div>
        )}

        {subAssignments.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  {["Sub-Module Name", "PDF", "Actions"]
                    .map(h => <th key={h} className="th">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {subAssignments.map(sub => {
                  const { _id: subId, subModuleName, assignmentPdf } = sub;
                  return (
                    <tr key={subId} className="tr">
                      <td className="td">{subModuleName}</td>
                      <td className="td">
                        {assignmentPdf ? (
                          <a 
                            href={assignmentPdf} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="pdf-link"
                          >
                            View PDF
                          </a>
                        ) : "No PDF"}
                      </td>
                      <td className="td">
                        <Button
                          onClick={() => onDeleteSubAssignment(moduleId, subId)}
                          disabled={deleting[subId]}
                          variant="danger"
                        >
                          {deleting[subId] ? "..." : "Delete"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Main Component ---
export default function AssignmentsManager() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState({});

  const [activeModule, setActiveModule] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentSummary, setStudentSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API_BASE}/assignments`);
      setAssignments(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const openStudentsModal = (module) => setActiveModule(module);
  const closeStudentsModal = () => {
    setActiveModule(null);
    setSelectedStudent(null);
    setStudentSummary(null);
    setSummaryError(null);
  };

  const handleSelectStudent = async (student, moduleId) => {
    setSelectedStudent(student);
    setSummaryLoading(true);
    setSummaryError(null);
    setStudentSummary(null);

    try {
      const res = await axios.post(`${API_BASE.replace('/admin', '')}/student/submithistory`, {
        studentId: student._id,
        assignmentId: moduleId,
      });
      setStudentSummary(res.data);
    } catch {
      setSummaryError("Failed to fetch student summary");
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleBackToStudentList = () => {
    setSelectedStudent(null);
    setStudentSummary(null);
    setSummaryError(null);
  };

  const handleDeleteModule = async (moduleId) => {
    if (!window.confirm("Are you sure you want to delete this entire module?")) return;
    setDeleting(prev => ({ ...prev, [moduleId]: true }));
    try {
      await axios.delete(`${API_BASE}/assignments/${moduleId}`);
      setAssignments(prev => prev.filter(mod => mod._id !== moduleId));
    } finally {
      setDeleting(prev => ({ ...prev, [moduleId]: false }));
    }
  };

  const handleDeleteSubAssignment = async (moduleId, subId) => {
    if (!window.confirm("Are you sure you want to delete this sub-assignment?")) return;
    setDeleting(prev => ({ ...prev, [subId]: true }));
    try {
      await axios.delete(`${API_BASE}/assignments/${moduleId}/sub/${subId}`);
      setAssignments(prev =>
        prev.map(mod =>
          mod._id === moduleId
            ? { ...mod, subAssignments: mod.subAssignments.filter(sub => sub._id !== subId) }
            : mod
        )
      );
    } finally {
      setDeleting(prev => ({ ...prev, [subId]: false }));
    }
  };

  const handleAddAssignment = () => {
    navigate('/assignment/add');
  };

  if (loading) return <p className="loading-text">Loading assignments...</p>;
  if (error) return <p className="error-text">Error: {error}</p>;

  return (
    <div className="container">
      <div className="header-container">
        <h2 className="header">Assignments Overview</h2>
        <Button 
          onClick={handleAddAssignment}
          variant="primary"
          className="add-assignment-btn"
        >
          + Add Assignment
        </Button>
      </div>

      {assignments.length === 0 ? (
        <div className="no-assignments">
          <p>No assignments found.</p>
          <Button 
            onClick={handleAddAssignment}
            variant="primary"
          >
            Create Your First Assignment
          </Button>
        </div>
      ) : (
        assignments.map(assignment => (
          <AssignmentCard
            key={assignment._id}
            assignment={assignment}
            deleting={deleting}
            onDeleteModule={handleDeleteModule}
            onDeleteSubAssignment={handleDeleteSubAssignment}
            onOpenStudentsModal={() => openStudentsModal(assignment)}
          />
        ))
      )}

      {activeModule && (
        <Modal
          isOpen={!!activeModule}
          onClose={closeStudentsModal}
          title={`Students in ${activeModule.moduleName}`}
        >
          <StudentsModal
            module={activeModule}
            studentSummaryProps={{
              selectedStudent,
              studentSummary,
              summaryLoading,
              summaryError,
              onSelectStudent: handleSelectStudent,
              onBack: handleBackToStudentList,
            }}
          />
        </Modal>
      )}
    </div>
  );
}