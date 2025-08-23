// AssignmentsManager.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./assignment.css";

// =======================
// API base URLs
// =======================
const API_BASE = "https://el-backend-ashen.vercel.app/admin"; // existing admin APIs
const API_SUBMISSIONS_BASE = "https://el-backend-ashen.vercel.app/assignments"; // new submissions API

// =======================
// Reusable Button
// =======================
const Button = ({ onClick, disabled, children, variant = "primary", className = "" }) => {
  const [isHovered, setIsHovered] = useState(false);

  let baseClass = "button";
  if (variant === "danger") baseClass += " button-danger";
  if (variant === "primary") baseClass += " button-primary";
  if (variant === "secondary") baseClass += " button-secondary";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClass} ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={isHovered && !disabled ? { filter: "brightness(0.9)" } : {}}
      type="button"
    >
      {children}
    </button>
  );
};

// =======================
// Modal
// =======================
const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <>
      <div onClick={onClose} className="modal-overlay" />
      <div role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1} className="modal-content">
        <div className="modal-header">
          <h3 id="modal-title" className="modal-title">{title}</h3>
          <button onClick={onClose} aria-label="Close modal" className="modal-close-button" type="button">&times;</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </>
  );
};

// =======================
// Small helpers (display)
// =======================
const Field = ({ label, children }) => (
  <p><strong>{label}:</strong> {children ?? "-"}</p>
);

const ListOrDash = (arr) => (Array.isArray(arr) && arr.length ? arr.join(", ") : "-");

// =======================
// Student Summary (one student's detailed result)
// Supports both new shape (parentSummary/subModulesSummary) and legacy (submittedAnswers)
// =======================
const StudentSummaryView = ({ result, onBack }) => {
  if (!result) return null;

  const {
    studentName,
    courseName,
    totalCorrect,
    totalWrong,
    overallProgress,
    submissionDate,
    // New shape:
    parentSummary,
    subModulesSummary,
    // Legacy fallback:
    submittedAnswers
  } = result;

  const hasNewShape = Array.isArray(subModulesSummary) || parentSummary;
  const hasLegacy = Array.isArray(submittedAnswers);

  // Render dynamic questions list (enteredValues shape)
  const DynamicQuestions = ({ dq = [] }) => {
    if (!Array.isArray(dq) || dq.length === 0) return null;
    return (
      <div className="mt-1">
        <h5>Dynamic Questions</h5>
        <ul className="dq-list">
          {dq.map((q, idx) => (
            <li key={q._id || idx} className="dq-item">
              <Field label={`Q${idx + 1}`}>{q.questionText || "-"}</Field>
              <Field label="Options">{ListOrDash(q.options)}</Field>
              <Field label="Correct Answer">{q.correctAnswer ?? q.answer ?? "-"}</Field>
              <Field label="Submitted Answer">{q.submittedAnswer ?? "-"}</Field>
              <Field label="Is Correct?">{q.isCorrect ? "Yes" : "No"}</Field>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  // One block rendering for an "enteredValues + scores" section
  const EnteredValuesBlock = ({ title, enteredValues, correctCount, wrongCount, progressPercent }) => {
    if (!enteredValues) return null;
    const { patientName, ageOrDob, icdCodes, cptCodes, notes, dynamicQuestions } = enteredValues;
    return (
      <div className="subassignment-block">
        <h4 className="sub-title">{title}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <Field label="Patient Name">{patientName || "-"}</Field>
            <Field label="Age/DOB">{ageOrDob || "-"}</Field>
            <Field label="ICD Codes">{ListOrDash(icdCodes)}</Field>
            <Field label="CPT Codes">{ListOrDash(cptCodes)}</Field>
            <Field label="Notes">{notes || "-"}</Field>
          </div>
          <div>
            <Field label="Correct">{correctCount ?? "-"}</Field>
            <Field label="Wrong">{wrongCount ?? "-"}</Field>
            <Field label="Progress">{progressPercent ?? 0}%</Field>
          </div>
        </div>
        <DynamicQuestions dq={dynamicQuestions} />
        <hr className="divider" />
      </div>
    );
  };

  // Sub-module row renderer for new shape
  const SubModuleRow = ({ sub }) => {
    const ev = sub?.enteredValues || {};
    return (
      <div className="subassignment-block">
        <h4 className="sub-title">
          {sub?.subModuleName ? `Sub-Module: ${sub.subModuleName}` : "Sub-Module"}
          {sub?.subAssignmentId ? ` — ${sub.subAssignmentId}` : ""}
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <Field label="Patient Name">{ev.patientName || "-"}</Field>
            <Field label="Age/DOB">{ev.ageOrDob || "-"}</Field>
            <Field label="ICD Codes">{ListOrDash(ev.icdCodes)}</Field>
            <Field label="CPT Codes">{ListOrDash(ev.cptCodes)}</Field>
            <Field label="Notes">{ev.notes || "-"}</Field>
          </div>
          <div>
            <Field label="Correct">{sub?.correctCount ?? "-"}</Field>
            <Field label="Wrong">{sub?.wrongCount ?? "-"}</Field>
            <Field label="Progress">{sub?.progressPercent ?? 0}%</Field>
          </div>
        </div>

        <DynamicQuestions dq={ev.dynamicQuestions} />
        <hr className="divider" />
      </div>
    );
  };

  return (
    <div className="student-summary-container">
      <Button onClick={onBack} variant="primary" className="mb-1">← Back to Students</Button>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">{studentName} {courseName ? `— ${courseName}` : ""}</h3>
          <div className="card-meta">
            <span>Submitted: {submissionDate ? new Date(submissionDate).toLocaleString() : "-"}</span>
            <span className="ml-1">Overall Progress: {overallProgress ?? 0}%</span>
            <span className="ml-1">Correct: {totalCorrect ?? 0}</span>
            <span className="ml-1">Wrong: {totalWrong ?? 0}</span>
          </div>
        </div>

        <div className="card-body">
          {/* New shape: parent + sub modules */}
          {hasNewShape && (
            <>
              {/* Parent-level (if exists) */}
              {parentSummary?.enteredValues ? (
                <EnteredValuesBlock
                  title="Parent Assignment (Overall Entry)"
                  enteredValues={parentSummary.enteredValues}
                  correctCount={parentSummary.correctCount}
                  wrongCount={parentSummary.wrongCount}
                  progressPercent={parentSummary.progressPercent}
                />
              ) : null}

              {/* Sub-modules */}
              {Array.isArray(subModulesSummary) && subModulesSummary.length > 0 ? (
                subModulesSummary.map((sa, idx) => <SubModuleRow key={sa.subAssignmentId || idx} sub={sa} />)
              ) : !parentSummary?.enteredValues ? (
                <p className="no-data-text">No sub-assignment details found.</p>
              ) : null}
            </>
          )}

          {/* Legacy shape: submittedAnswers */}
          {!hasNewShape && hasLegacy && (
            <>
              {submittedAnswers.length === 0 && <p className="no-data-text">No sub-assignment details found.</p>}
              {submittedAnswers.map((sa, idx) => (
                <div key={sa._id || idx} className="subassignment-block">
                  <h4 className="sub-title">Sub-Assignment: {sa.subAssignmentId || "-"}</h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <Field label="Patient Name">{sa.patientName || "-"}</Field>
                      <Field label="Age/DOB">{sa.ageOrDob || "-"}</Field>
                      <Field label="ICD Codes">{ListOrDash(sa.icdCodes)}</Field>
                      <Field label="CPT Codes">{ListOrDash(sa.cptCodes)}</Field>
                      <Field label="Notes">{sa.notes || "-"}</Field>
                    </div>
                    <div>
                      <Field label="Correct">{sa.correctCount ?? "-"}</Field>
                      <Field label="Wrong">{sa.wrongCount ?? "-"}</Field>
                      <Field label="Progress">{sa.progressPercent ?? 0}%</Field>
                    </div>
                  </div>

                  {Array.isArray(sa.dynamicQuestions) && sa.dynamicQuestions.length > 0 && (
                    <div className="mt-1">
                      <h5>Dynamic Questions</h5>
                      <ul className="dq-list">
                        {sa.dynamicQuestions.map((q, qIdx) => (
                          <li key={qIdx} className="dq-item">
                            <Field label={`Q${qIdx + 1}`}>{q.questionText || "-"}</Field>
                            <Field label="Correct Answer">{q.correctAnswer ?? "-"}</Field>
                            <Field label="Submitted Answer">{q.submittedAnswer ?? "-"}</Field>
                            <Field label="Is Correct?">{q.isCorrect ? "Yes" : "No"}</Field>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <hr className="divider" />
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// =======================
// Students Modal: lists names pulled from submissions API
// =======================
const StudentsModal = ({
  module,
  submissionsLoading,
  submissionsError,
  submissions,
  selectedStudentResult,
  onBackToList,
  onSelectStudent
}) => {
  if (!module) return null;

  if (selectedStudentResult) {
    return (
      <StudentSummaryView
        result={selectedStudentResult}
        onBack={onBackToList}
      />
    );
  }

  if (submissionsLoading) return <p className="loading-text">Loading students...</p>;
  if (submissionsError) return <p className="error-text">Error: {submissionsError}</p>;

  const results = submissions?.results || [];

  if (results.length === 0) {
    return <p className="no-data-text">No submissions found for this module.</p>;
  }

  return (
    <ul className="student-list">
      {results.map((r) => (
        <li
          key={r.studentId}
          className="student-list-item"
          onClick={() => onSelectStudent(r)}
          title="View result"
        >
          <strong>{r.studentName || "Unnamed Student"}</strong>
          {r.courseName ? ` (${r.courseName})` : ""} — Submitted:{" "}
          {r.submissionDate ? new Date(r.submissionDate).toLocaleDateString() : "-"}
        </li>
      ))}
    </ul>
  );
};

// =======================
// Assignment Card (shows each module)
// =======================
const AssignmentCard = ({
  assignment,
  onDeleteModule,
  onDeleteSubAssignment,
  onOpenStudentsModal,
  deleting
}) => {
  const { _id: moduleId, moduleName, assignedDate, subAssignments = [], assignmentPdf } = assignment;

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">{moduleName}</h3>
        <div className="card-actions">
          <Button
            onClick={() => onDeleteModule(moduleId)}
            disabled={!!deleting[moduleId]}
            variant="danger"
          >
            {deleting[moduleId] ? "Deleting..." : "Delete Module"}
          </Button>

          <Button onClick={() => onOpenStudentsModal(assignment)} variant="primary">
            View Students ({assignment.assignedStudents?.length ?? 0})
          </Button>
        </div>
      </div>

      <div className="card-meta">
        <span>Assigned on: {assignedDate ? new Date(assignedDate).toLocaleDateString() : "-"}</span>
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
          <div className="table-container">
            <table className="table">
              <thead>
                <tr className="tr">
                  <th className="th">Sub-Module</th>
                  <th className="th">PDF</th>
                  <th className="th">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subAssignments.map((sub) => {
                  const { _id: subId, subModuleName, assignmentPdf: subPdf } = sub;
                  return (
                    <tr key={subId} className="tr">
                      <td className="td">{subModuleName}</td>
                      <td className="td">
                        {subPdf ? (
                          <a
                            href={subPdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="pdf-link"
                          >
                            View PDF
                          </a>
                        ) : "No PDF"}
                      </td>
                      <td className="td">
                        <div className="action-buttons">
                          <Button
                            onClick={() => onDeleteSubAssignment(moduleId, subId)}
                            disabled={!!deleting[subId]}
                            variant="danger"
                          >
                            {deleting[subId] ? "..." : "Delete"}
                          </Button>
                        </div>
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

// =======================
// Main Component
// =======================
export default function AssignmentsManager() {
  const navigate = useNavigate();

  // If you still need category selection to add new assignments
  const CATEGORY_OPTIONS = ["CPC", "CCS", "IP-DRG", "SURGERY", "Denials", "ED", "E and M"];

  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState({});

  // Students Modal state
  const [activeModule, setActiveModule] = useState(null);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState(null);
  const [moduleSubmissions, setModuleSubmissions] = useState(null);
  const [selectedStudentResult, setSelectedStudentResult] = useState(null);

  // Optional: students list, if still used elsewhere
  const [students, setStudents] = useState([]);

  // Category modal (for Add Assignment flow)
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  useEffect(() => {
    fetchAssignments();
    fetchStudents(); // safe to keep; not required for the new View Students flow
  }, []);

  const fetchStudents = async () => {
    try {
      const res = await axios.get(`${API_BASE}/students`);
      setStudents(res.data);
    } catch (err) {
      console.error("Error fetching students:", err);
    }
  };

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

  // =======================
  // View Students — NEW FLOW
  // =======================
  const openStudentsModal = async (module) => {
    setActiveModule(module);
    setSelectedStudentResult(null);
    setModuleSubmissions(null);
    setSubmissionsError(null);
    setSubmissionsLoading(true);

    try {
      // Fetch submissions for this assignment/module
      const { data } = await axios.get(`${API_SUBMISSIONS_BASE}/${module._id}/submissions`);
      // Expected shape:
      // {
      //   assignmentId: "...",
      //   moduleName: "...",
      //   results: [ { studentId, studentName, courseName, parentSummary, subModulesSummary, totalCorrect, totalWrong, overallProgress, submissionDate } ]
      // }
      setModuleSubmissions(data);
    } catch (err) {
      setSubmissionsError(err.response?.data?.error || err.message);
    } finally {
      setSubmissionsLoading(false);
    }
  };

  const closeStudentsModal = () => {
    setActiveModule(null);
    setModuleSubmissions(null);
    setSelectedStudentResult(null);
    setSubmissionsError(null);
  };

  const handleSelectStudentFromList = (studentResult) => {
    setSelectedStudentResult(studentResult);
  };

  const handleBackToStudentList = () => {
    setSelectedStudentResult(null);
  };

  // =======================
  // Delete handlers
  // =======================
  const handleDeleteModule = async (moduleId) => {
    if (!window.confirm("Are you sure you want to delete this entire module?")) return;
    setDeleting(prev => ({ ...prev, [moduleId]: true }));
    try {
      await axios.delete(`${API_BASE}/assignments/${moduleId}`);
      setAssignments(prev => prev.filter(mod => mod._id !== moduleId));
    } catch (err) {
      alert(err.response?.data?.error || err.message);
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
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    } finally {
      setDeleting(prev => ({ ...prev, [subId]: false }));
    }
  };

  // =======================
  // Add Assignment flow (optional)
  // =======================
  const handleAddAssignment = () => {
    setShowCategoryModal(true);
  };

  const goToAddWithCategory = (cat) => {
    setShowCategoryModal(false);
    navigate(`/assignment/add?category=${encodeURIComponent(cat)}`);
  };

  // =======================
  // Render
  // =======================
  if (loading) return <p className="loading-text">Loading assignments...</p>;
  if (error) return <p className="error-text">Error: {error}</p>;

  return (
    <div className="container">
      <div className="header-container">
        <h2 className="header">Assignments Overview</h2>
        <Button onClick={handleAddAssignment} variant="primary" className="add-assignment-btn">
          + Add Assignment
        </Button>
      </div>

      {assignments.length === 0 && (
        <p className="no-data-text">No assignments found.</p>
      )}

      <div className="cards-grid">
        {assignments.map((assignment) => (
          <AssignmentCard
            key={assignment._id}
            assignment={assignment}
            onDeleteModule={handleDeleteModule}
            onDeleteSubAssignment={handleDeleteSubAssignment}
            onOpenStudentsModal={openStudentsModal}
            deleting={deleting}
          />
        ))}
      </div>

      {/* Students Modal */}
      {activeModule && (
        <Modal
          isOpen={!!activeModule}
          onClose={closeStudentsModal}
          title={`Students — ${activeModule.moduleName}`}
        >
          <StudentsModal
            module={activeModule}
            submissionsLoading={submissionsLoading}
            submissionsError={submissionsError}
            submissions={moduleSubmissions}
            selectedStudentResult={selectedStudentResult}
            onBackToList={handleBackToStudentList}
            onSelectStudent={handleSelectStudentFromList}
          />
        </Modal>
      )}

      {/* Category Picker Modal (optional) */}
      {showCategoryModal && (
        <Modal
          isOpen={showCategoryModal}
          onClose={() => setShowCategoryModal(false)}
          title="Choose Category"
        >
          <div className="category-grid">
            {CATEGORY_OPTIONS.map((cat) => (
              <Button key={cat} className="category-btn" onClick={() => goToAddWithCategory(cat)}>
                {cat}
              </Button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}