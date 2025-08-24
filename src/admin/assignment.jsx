// AssignmentsManager.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./assignment.css";

// =======================
// API base URLs
// =======================
const API_BASE = "https://el-backend-ashen.vercel.app/admin"; // existing admin APIs
const API_SUBMISSIONS_BASE = "https://el-backend-ashen.vercel.app/assignments"; // submissions API

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
// Display helpers
// =======================
const Field = ({ label, children }) => (
  <p><strong>{label}:</strong> {children ?? "-"}</p>
);

const ListOrDash = (arr) => (Array.isArray(arr) && arr.length ? arr.join(", ") : "-");

const hasStaticData = (obj = {}) => {
  const hasStr = (v) => typeof v === "string" && v.trim() !== "";
  const hasArr = (v) => Array.isArray(v) && v.length > 0;
  return (
    hasStr(obj.patientName) ||
    hasStr(obj.ageOrDob) ||
    hasArr(obj.icdCodes) ||
    hasArr(obj.cptCodes) ||
    hasArr(obj.pcsCodes) ||      // NEW
    hasArr(obj.hcpcsCodes) ||    // NEW
    hasArr(obj.modifiers) ||     // NEW
    hasStr(obj.drgValue) ||      // NEW
    hasStr(obj.notes)
  );
};

// =======================
// "Assignment Results" header
// =======================
const ResultsHeader = ({ totalCorrect, totalWrong, overallProgress }) => (
  <div className="results-header card">
    <h2 className="results-title">Assignment Results</h2>
    <div className="results-stats">
      <div><span>Correct Answers:</span> <strong className="text-success">{totalCorrect ?? 0}</strong></div>
      <div><span>Wrong Answers:</span> <strong className="text-danger">{totalWrong ?? 0}</strong></div>
      <div><span>Overall Progress:</span> <strong className="text-primary">{(overallProgress ?? 0)}%</strong></div>
    </div>
  </div>
);

// =======================
// Student Summary (one student's detailed result)
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

    // New shape from backend
    parentSummary,
    subModulesSummary,

    // Legacy fallback
    submittedAnswers
  } = result;

  const hasNewShape = Array.isArray(subModulesSummary) || parentSummary;
  const hasLegacy = Array.isArray(submittedAnswers);

  // Dynamic questions section (enteredValues shape)
  const DynamicQuestions = ({ dq = [] }) => {
    if (!Array.isArray(dq) || dq.length === 0) return null;
    return (
      <div className="mt-1">
        {dq.map((q, idx) => (
          <div key={q._id || idx} className="dq-card">
            <h5 className="dq-title">Q{idx + 1}: {q.questionText || "-"}</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <Field label="Submitted Answer">{q.submittedAnswer ?? "-"}</Field>
              </div>
              <div>
                <Field label="Correct Answer">{q.correctAnswer ?? q.answer ?? "-"}</Field>
              </div>
            </div>
            {Array.isArray(q.options) && q.options.length > 0 && (
              <Field label="Options">{q.options.join(", ")}</Field>
            )}
          </div>
        ))}
      </div>
    );
  };

  // Static two-column panel with conditional side rendering
  const StaticTwoColumn = ({ submitted, correct }) => {
    const showSubmitted = hasStaticData(submitted);
    const showCorrect = hasStaticData(correct);

    if (!showSubmitted && !showCorrect) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {showSubmitted && (
          <div className="panel panel-left">
            <h5 className="panel-title">Submitted Answers</h5>
            <Field label="Patient Name">{submitted.patientName || "-"}</Field>
            <Field label="Age/DOB">{submitted.ageOrDob || "-"}</Field>
            <Field label="ICD Codes">{ListOrDash(submitted.icdCodes)}</Field>
            <Field label="CPT Codes">{ListOrDash(submitted.cptCodes)}</Field>
            <Field label="PCS Codes">{ListOrDash(submitted.pcsCodes)}</Field>         {/* NEW */}
            <Field label="HCPCS Codes">{ListOrDash(submitted.hcpcsCodes)}</Field>     {/* NEW */}
            <Field label="DRG Value">{submitted.drgValue || "-"}</Field>              {/* NEW */}
            <Field label="Modifiers">{ListOrDash(submitted.modifiers)}</Field>        {/* NEW */}
            <Field label="Notes">{submitted.notes || "-"}</Field>
          </div>
        )}

        {showCorrect && (
          <div className="panel panel-right">
            <h5 className="panel-title">Correct Answers</h5>
            <Field label="Patient Name">{correct.patientName || "-"}</Field>
            <Field label="Age/DOB">{correct.ageOrDob || "-"}</Field>
            <Field label="ICD Codes">{ListOrDash(correct.icdCodes)}</Field>
            <Field label="CPT Codes">{ListOrDash(correct.cptCodes)}</Field>
            <Field label="PCS Codes">{ListOrDash(correct.pcsCodes)}</Field>           {/* NEW */}
            <Field label="HCPCS Codes">{ListOrDash(correct.hcpcsCodes)}</Field>       {/* NEW */}
            <Field label="DRG Value">{correct.drgValue || "-"}</Field>                {/* NEW */}
            <Field label="Modifiers">{ListOrDash(correct.modifiers)}</Field>          {/* NEW */}
            <Field label="Notes">{correct.notes || "-"}</Field>
          </div>
        )}
      </div>
    );
  };

  // Sub-module section (matches your screenshot structure)
  const SubModuleSection = ({ title, enteredValues = {}, answerKey = {}, correctCount, wrongCount, progressPercent }) => {
    const showStaticBlock = hasStaticData(enteredValues) || hasStaticData(answerKey);
    const hasDq = Array.isArray(enteredValues.dynamicQuestions) && enteredValues.dynamicQuestions.length > 0;

    // If nothing at all to show, skip the section entirely
    if (!showStaticBlock && !hasDq) return null;

    return (
      <div className="submodule card">
        <h3 className="submodule-title">{title}</h3>

        {/* Static block only if there is static data on at least one side */}
        {showStaticBlock && (
          <StaticTwoColumn submitted={enteredValues} correct={answerKey} />
        )}

        {/* Dynamic questions (if any) */}
        {hasDq && <DynamicQuestions dq={enteredValues.dynamicQuestions} />}

        <div className="submodule-footer">
          <span>Correct: <strong>{correctCount ?? 0}</strong></span>
          <span>Wrong: <strong>{wrongCount ?? 0}</strong></span>
          <span>Progress: <strong>{progressPercent ?? 0}%</strong></span>
        </div>
      </div>
    );
  };

  return (
    <div className="student-summary-container">
      <Button onClick={onBack} variant="primary" className="mb-1">← Back to Submissions</Button>

      {/* Top header with totals */}
      <ResultsHeader
        totalCorrect={totalCorrect}
        totalWrong={totalWrong}
        overallProgress={overallProgress}
      />

      {/* Student meta */}
      <div className="card student-meta">
        <div className="card-header">
          <h4 className="card-title">{studentName}{courseName ? ` — ${courseName}` : ""}</h4>
          <div className="card-meta">
            <span>Submitted: {submissionDate ? new Date(submissionDate).toLocaleString() : "-"}</span>
          </div>
        </div>
      </div>

      {/* New shape rendering */}
      {hasNewShape && (
        <>
          {/* Parent-level (only if it actually has data) */}
          {parentSummary?.enteredValues && (
            <SubModuleSection
              title="Parent"
              enteredValues={parentSummary.enteredValues}
              answerKey={parentSummary.answerKey || {}}
              correctCount={parentSummary.correctCount}
              wrongCount={parentSummary.wrongCount}
              progressPercent={parentSummary.progressPercent}
            />
          )}

          {/* Sub-modules (render only those that actually have data) */}
          {Array.isArray(subModulesSummary) && subModulesSummary.length > 0 ? (
            subModulesSummary.map((sa, idx) => (
              <SubModuleSection
                key={sa.subAssignmentId || idx}
                title={sa.subModuleName || `Sub-Module ${idx + 1}`}
                enteredValues={sa.enteredValues || {}}
                answerKey={sa.answerKey || {}}
                correctCount={sa.correctCount}
                wrongCount={sa.wrongCount}
                progressPercent={sa.progressPercent}
              />
            ))
          ) : !parentSummary?.enteredValues ? (
            <p className="no-data-text">No sub-assignment details found.</p>
          ) : null}
        </>
      )}

      {/* Legacy shape fallback */}
      {!hasNewShape && hasLegacy && (
        <>
          {submittedAnswers.length === 0 && <p className="no-data-text">No sub-assignment details found.</p>}
          {submittedAnswers.map((sa, idx) => {
            const hasLegacyStatic = hasStaticData(sa);
            const hasLegacyDQ = Array.isArray(sa.dynamicQuestions) && sa.dynamicQuestions.length > 0;
            if (!hasLegacyStatic && !hasLegacyDQ) return null;

            return (
              <div key={sa._id || idx} className="submodule card">
                <h3 className="submodule-title">Sub-Module {sa.subAssignmentId || idx + 1}</h3>

                {hasLegacyStatic && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="panel panel-left">
                      <h5 className="panel-title">Submitted Answers</h5>
                      <Field label="Patient Name">{sa.patientName || "-"}</Field>
                      <Field label="Age/DOB">{sa.ageOrDob || "-"}</Field>
                      <Field label="ICD Codes">{ListOrDash(sa.icdCodes)}</Field>
                      <Field label="CPT Codes">{ListOrDash(sa.cptCodes)}</Field>
                      <Field label="PCS Codes">{ListOrDash(sa.pcsCodes)}</Field>         {/* NEW */}
                      <Field label="HCPCS Codes">{ListOrDash(sa.hcpcsCodes)}</Field>     {/* NEW */}
                      <Field label="DRG Value">{sa.drgValue || "-"}</Field>              {/* NEW */}
                      <Field label="Modifiers">{ListOrDash(sa.modifiers)}</Field>        {/* NEW */}
                      <Field label="Notes">{sa.notes || "-"}</Field>
                    </div>
                    {/* Legacy view didn't include an explicit correct panel */}
                  </div>
                )}

                {hasLegacyDQ && (
                  <div className="mt-1">
                    {sa.dynamicQuestions.map((q, qIdx) => (
                      <div key={qIdx} className="dq-card">
                        <h5 className="dq-title">Q{qIdx + 1}: {q.questionText || "-"}</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div><Field label="Submitted Answer">{q.submittedAnswer ?? "-"}</Field></div>
                          <div><Field label="Correct Answer">{q.correctAnswer ?? "-"}</Field></div>
                        </div>
                        {Array.isArray(q.options) && q.options.length > 0 && (
                          <Field label="Options">{q.options.join(", ")}</Field>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="submodule-footer">
                  <span>Correct: <strong>{sa.correctCount ?? 0}</strong></span>
                  <span>Wrong: <strong>{sa.wrongCount ?? 0}</strong></span>
                  <span>Progress: <strong>{sa.progressPercent ?? 0}%</strong></span>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};

// =======================
// Submissions Modal: lists students pulled from submissions API
// =======================
const SubmissionsModal = ({
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

  if (submissionsLoading) return <p className="loading-text">Loading submissions...</p>;
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
          title="View student result"
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
// Assignment Card
// =======================
const AssignmentCard = ({
  assignment,
  onDeleteModule,
  onDeleteSubAssignment,
  onOpenSubmissionsModal,
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

          <Button onClick={() => onOpenSubmissionsModal(assignment)} variant="primary">
            View Submissions ({assignment.assignedStudents?.length ?? 0})
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

  const CATEGORY_OPTIONS = ["CPC", "CCS", "IP-DRG", "SURGERY", "Denials", "ED", "E and M"];

  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState({});

  // Submissions Modal state
  const [activeModule, setActiveModule] = useState(null);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState(null);
  const [moduleSubmissions, setModuleSubmissions] = useState(null);
  const [selectedStudentResult, setSelectedStudentResult] = useState(null);

  // Optional: students list (not required for submissions flow)
  const [students, setStudents] = useState([]);

  const [showCategoryModal, setShowCategoryModal] = useState(false);

  useEffect(() => {
    fetchAssignments();
    fetchStudents();
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
  // View Submissions
  // =======================
  const openSubmissionsModal = async (module) => {
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
      //   assignmentId, moduleName,
      //   results: [{ studentId, studentName, courseName, totalCorrect, totalWrong, overallProgress, submissionDate, parentSummary, subModulesSummary }]
      // }
      setModuleSubmissions(data);
    } catch (err) {
      setSubmissionsError(err.response?.data?.error || err.message);
    } finally {
      setSubmissionsLoading(false);
    }
  };

  const closeSubmissionsModal = () => {
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
            onOpenSubmissionsModal={openSubmissionsModal}
            deleting={deleting}
          />
        ))}
      </div>

      {/* Submissions Modal */}
      {activeModule && (
        <Modal
          isOpen={!!activeModule}
          onClose={closeSubmissionsModal}
          title={`Submissions — ${activeModule.moduleName}`}
        >
          <SubmissionsModal
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
