import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./assignment.css";


// API base URL
const API_BASE = "https://el-backend-ashen.vercel.app/admin";

// --- Reusable Button Component ---
const Button = ({ onClick, disabled, children, variant = "primary", className = "", type = "button" }) => {
  const [isHovered, setIsHovered] = useState(false);

  let baseClass = "button";
  if (variant === "danger") baseClass += " button-danger";
  if (variant === "primary") baseClass += " button-primary";
  if (variant === "secondary") baseClass += " button-secondary";

  return (
    <button
      type={type}
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

// --- Category Picker Modal (ONE POP) ---
const CATEGORIES = ["CPC","CCS","IP-DRG","SURGERY","Denials","ED","E and M"];

const CategoryPicker = ({ isOpen, onClose, onPick }) => {
  if (!isOpen) return null;
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Choose Category">
      <div className="category-grid">
        {CATEGORIES.map(cat => (
          <Button
            key={cat}
            onClick={() => onPick(cat)}
            variant="primary"
            className="category-chip"
          >
            {cat}
          </Button>
        ))}
      </div>
      <div className="category-footnote">
        <small>Assignments will be created inside the selected category.</small>
      </div>
    </Modal>
  );
};

// --- Edit Assignment Form Component ---
const EditAssignmentForm = ({ assignment, onSave, onCancel, students }) => {
  const [moduleName, setModuleName] = useState(assignment.moduleName || "");
  const [selectedStudents, setSelectedStudents] = useState(
    assignment.assignedStudents?.map(s => s._id) || []
  );

  // Check if this is a parent-level assignment with questions
  const hasParentLevelQuestions = assignment.questions && assignment.questions.length > 0;
  const [subAssignments, setSubAssignments] = useState(
    assignment.subAssignments?.map(sub => {
      const predefinedQuestion = sub.questions?.find(q => q.type === "predefined");
      const answerKey = predefinedQuestion?.answerKey || {};
      const dynamicQuestions = sub.questions?.filter(q => q.type === "dynamic") || [];

      return {
        _id: sub._id,
        subModuleName: sub.subModuleName || "",
        isDynamic: dynamicQuestions.length > 0,
        answerPatientName: answerKey.patientName || "",
        answerAgeOrDob: answerKey.ageOrDob || "",
        answerIcdCodes: Array.isArray(answerKey.icdCodes) ? answerKey.icdCodes.join(", ") : (answerKey.icdCodes || ""),
        answerCptCodes: Array.isArray(answerKey.cptCodes) ? answerKey.cptCodes.join(", ") : (answerKey.cptCodes || ""),
        answerNotes: answerKey.notes || "",
        dynamicQuestions: dynamicQuestions.map(q => ({
          _id: q._id,
          questionText: q.questionText || "",
          options: Array.isArray(q.options) ? q.options.join(", ") : (q.options || ""),
          answer: q.answer || q.correctAnswer || ""
        })) || [{ questionText: "", options: "", answer: "" }],
        assignmentPdf: null,
        assignmentPdfUrl: sub.assignmentPdf || null
      };
    }) || [{
      subModuleName: "",
      isDynamic: false,
      answerPatientName: "",
      answerAgeOrDob: "",
      answerIcdCodes: "",
      answerCptCodes: "",
      answerNotes: "",
      dynamicQuestions: [{ questionText: "", options: "", answer: "" }],
      assignmentPdf: null
    }]
  );

  // Handle student selection (kept for backward compatibility in UI)
  const handleStudentSelection = (studentId) => {
    setSelectedStudents(prev => (
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    ));
  };

  const toggleAllStudents = (selectAll) => {
    if (selectAll) {
      setSelectedStudents(students.map(student => student._id));
    } else {
      setSelectedStudents([]);
    }
  };

  const handleSubChange = (index, field, value) => {
    const updated = [...subAssignments];
    updated[index][field] = value;
    setSubAssignments(updated);
  };

  const handleDynamicQuestionChange = (subIndex, qIndex, field, value) => {
    const updated = [...subAssignments];
    updated[subIndex].dynamicQuestions[qIndex][field] = value;
    setSubAssignments(updated);
  };

  const addDynamicQuestion = (subIndex) => {
    const updated = [...subAssignments];
    updated[subIndex].dynamicQuestions.push({ questionText: "", options: "", answer: "" });
    setSubAssignments(updated);
  };

  const removeDynamicQuestion = (subIndex, qIndex) => {
    const updated = [...subAssignments];
    if (updated[subIndex].dynamicQuestions.length > 1) {
      updated[subIndex].dynamicQuestions.splice(qIndex, 1);
      setSubAssignments(updated);
    }
  };

  const addSubAssignment = () => {
    setSubAssignments([
      ...subAssignments,
      {
        subModuleName: "",
        isDynamic: false,
        answerPatientName: "",
        answerAgeOrDob: "",
        answerIcdCodes: "",
        answerCptCodes: "",
        answerNotes: "",
        dynamicQuestions: [{ questionText: "", options: "", answer: "" }],
        assignmentPdf: null,
        assignmentPdfUrl: null
      }
    ]);
  };

  const removeSubAssignment = (index) => {
    if (subAssignments.length > 1) {
      const updated = [...subAssignments];
      updated.splice(index, 1);
      setSubAssignments(updated);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("moduleName", moduleName);
    // NOTE: backend now uses category-based assignment creation; this UI keeps student field for edit
    formData.append("assignedStudents", selectedStudents.join(","));

    const subDataForJson = subAssignments.map(sub => {
      if (sub.isDynamic) {
        return {
          _id: sub._id,
          subModuleName: sub.subModuleName,
          isDynamic: true,
          questions: sub.dynamicQuestions.map(q => ({
            _id: q._id,
            questionText: q.questionText,
            options: q.options ? q.options.split(",").map(opt => opt.trim()) : [],
            answer: q.answer
          }))
        };
      } else {
        return {
          _id: sub._id,
          subModuleName: sub.subModuleName,
          isDynamic: false,
          answerPatientName: sub.answerPatientName,
          answerAgeOrDob: sub.answerAgeOrDob,
          answerIcdCodes: sub.answerIcdCodes,
          answerCptCodes: sub.answerCptCodes,
          answerNotes: sub.answerNotes
        };
      }
    });

    formData.append("subAssignments", JSON.stringify(subDataForJson));

    subAssignments.forEach((sub) => {
      if (sub.assignmentPdf) {
        formData.append(`assignmentPdf`, sub.assignmentPdf);
      }
    });

    try {
      const res = await fetch(`${API_BASE}/assignments/${assignment._id}`, { method: "PUT", body: formData });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Server error: ${res.status} - ${errorText}`);
      }
      const data = await res.json();
      alert("Assignment updated successfully!");
      onSave(data);
    } catch (err) {
      console.error("❌ Error:", err);
      alert(`Error updating assignment: ${err.message}`);
    }
  };

  return (
    <div className="edit-assignment-form">
      <div className="edit-mode-header">
        <h3>✏️ Edit Assignment: {assignment.moduleName}</h3>
        <p className="edit-mode-subtitle">All fields are pre-filled with existing data. Update only what you need to change.</p>
      </div>
      <form onSubmit={handleSubmit} className="assignment-form">
        <div className="form-group">
          <label htmlFor="editModuleName">Module Name*</label>
          <input
            id="editModuleName"
            type="text"
            placeholder="Enter module name"
            value={moduleName}
            onChange={(e) => setModuleName(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Assign to Students</label>
          <div className="student-selection-controls">
            <Button onClick={() => toggleAllStudents(true)} variant="secondary" className="small-btn">Select All</Button>
            <Button onClick={() => toggleAllStudents(false)} variant="secondary" className="small-btn">Deselect All</Button>
          </div>
          <div className="student-checkbox-container">
            {students.map(student => (
              <div key={student._id} className="student-checkbox-item">
                <input
                  type="checkbox"
                  id={`edit-student-${student._id}`}
                  checked={selectedStudents.includes(student._id)}
                  onChange={() => handleStudentSelection(student._id)}
                />
                <label htmlFor={`edit-student-${student._id}`}>
                  {student.name} ({student.courseName})
                </label>
              </div>
            ))}
          </div>
          <small>Selected: {selectedStudents.length} students {selectedStudents.length > 0 && `(${selectedStudents.length === students.length ? 'All students' : 'Partial selection'})`}</small>
        </div>

        {/* Parent Level Questions (if any) */}
        {hasParentLevelQuestions && (
          <div className="parent-level-section">
            <h3>Main Assignment Questions</h3>
            <div className="sub-assignment-card">
              <div className="sub-header">
                <h4>Main Assignment</h4>
              </div>
              {(() => {
                const predefinedQuestion = assignment.questions?.find(q => q.type === "predefined");
                const answerKey = predefinedQuestion?.answerKey || {};
                const dynamicQuestions = assignment.questions?.filter(q => q.type === "dynamic") || [];

                return (
                  <>
                    <div className="question-type-toggle">
                      <label className={`question-type-option ${dynamicQuestions.length === 0 ? 'selected' : ''}`}>
                        <input type="radio" name="parent-type" checked={dynamicQuestions.length === 0} readOnly />
                        <span className="radio-custom"></span>
                        Predefined Questions
                        <span className="question-count">({Object.values(answerKey).some(v => v && (Array.isArray(v) ? v.length > 0 : true)) ? 'Has answers' : 'No answers'})</span>
                      </label>
                      <label className={`question-type-option ${dynamicQuestions.length > 0 ? 'selected' : ''}`}>
                        <input type="radio" name="parent-type" checked={dynamicQuestions.length > 0} readOnly />
                        <span className="radio-custom"></span>
                        Dynamic Questions
                        <span className="question-count">({dynamicQuestions.length} questions)</span>
                      </label>
                    </div>

                    {dynamicQuestions.length === 0 && (
                      <div className="predefined-fields">
                        <h4>Predefined Answer Key 
                          {Object.values(answerKey).some(v => v && (Array.isArray(v) ? v.length > 0 : true)) ? 
                            <span className="existing-data-badge">✓ Has existing answers</span> : 
                            <span className="no-data-badge">No answers yet</span>
                          }
                        </h4>

                        <div className="form-group"><label>Patient Name</label><input type="text" value={answerKey.patientName || ""} readOnly className="readonly-field" /></div>
                        <div className="form-group"><label>Age or Date of Birth</label><input type="text" value={answerKey.ageOrDob || ""} readOnly className="readonly-field" /></div>
                        <div className="form-group"><label>ICD Codes</label><input type="text" value={Array.isArray(answerKey.icdCodes) ? answerKey.icdCodes.join(", ") : (answerKey.icdCodes || "")} readOnly className="readonly-field" /></div>
                        <div className="form-group"><label>CPT Codes</label><input type="text" value={Array.isArray(answerKey.cptCodes) ? answerKey.cptCodes.join(", ") : (answerKey.cptCodes || "")} readOnly className="readonly-field" /></div>
                        <div className="form-group"><label>Notes</label><textarea value={answerKey.notes || ""} readOnly className="readonly-field" /></div>
                      </div>
                    )}

                    {dynamicQuestions.length > 0 && (
                      <div className="dynamic-questions">
                        <h4>Dynamic Questions <span className="existing-data-badge">✓ {dynamicQuestions.length} question{dynamicQuestions.length !== 1 ? 's' : ''}</span></h4>
                        {dynamicQuestions.map((q, qIdx) => (
                          <div key={qIdx} className="question-card">
                            <div className="form-group"><label>Question Text</label><input type="text" value={q.questionText || ""} readOnly className="readonly-field" /></div>
                            <div className="form-group"><label>Options</label><input type="text" value={Array.isArray(q.options) ? q.options.join(", ") : (q.options || "")} readOnly className="readonly-field" /></div>
                            <div className="form-group"><label>Correct Answer</label><input type="text" value={q.answer || ""} readOnly className="readonly-field" /></div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}

        <h3>Sub-Assignments</h3>
        {subAssignments.map((sub, idx) => (
          <div key={idx} className="sub-assignment-card">
            <div className="sub-header">
              <h4>Sub-Assignment #{idx + 1}</h4>
              {subAssignments.length > 1 && (
                <Button onClick={() => removeSubAssignment(idx)} variant="danger" className="remove-btn">Remove</Button>
              )}
            </div>

            <div className="form-group">
              <label htmlFor={`editSubModuleName-${idx}`}>Sub-Module Name*</label>
              <input
                id={`editSubModuleName-${idx}`}
                type="text"
                placeholder="Enter sub-module name"
                value={sub.subModuleName}
                onChange={(e) => handleSubChange(idx, "subModuleName", e.target.value)}
                required
              />
            </div>

            <div className="question-type-toggle">
              <label className={`question-type-option ${!sub.isDynamic ? 'selected' : ''}`}>
                <input type="radio" name={`edit-type-${idx}`} checked={!sub.isDynamic} onChange={() => handleSubChange(idx, "isDynamic", false)} />
                <span className="radio-custom"></span>
                Predefined Questions
                <span className="question-count">({!sub.isDynamic ? '5 fields' : '0 fields'})</span>
              </label>
              <label className={`question-type-option ${sub.isDynamic ? 'selected' : ''}`}>
                <input type="radio" name={`edit-type-${idx}`} checked={sub.isDynamic} onChange={() => handleSubChange(idx, "isDynamic", true)} />
                <span className="radio-custom"></span>
                Dynamic Questions
                <span className="question-count">({sub.isDynamic ? `${sub.dynamicQuestions.length} questions` : '0 questions'})</span>
              </label>
            </div>

            {!sub.isDynamic && (
              <div className="predefined-fields">
                <h4>Predefined Answer Key 
                  {sub.answerPatientName || sub.answerAgeOrDob || sub.answerIcdCodes || sub.answerCptCodes || sub.answerNotes ? 
                    <span className="existing-data-badge">✓ Has existing answers</span> : 
                    <span className="no-data-badge">No answers yet</span>
                  }
                </h4>
                <div className="form-group"><label>Patient Name</label><input type="text" value={sub.answerPatientName} onChange={(e) => handleSubChange(idx, "answerPatientName", e.target.value)} /></div>
                <div className="form-group"><label>Age or Date of Birth</label><input type="text" value={sub.answerAgeOrDob} onChange={(e) => handleSubChange(idx, "answerAgeOrDob", e.target.value)} /></div>
                <div className="form-group"><label>ICD Codes</label><input type="text" value={sub.answerIcdCodes} onChange={(e) => handleSubChange(idx, "answerIcdCodes", e.target.value)} /></div>
                <div className="form-group"><label>CPT Codes</label><input type="text" value={sub.answerCptCodes} onChange={(e) => handleSubChange(idx, "answerCptCodes", e.target.value)} /></div>
                <div className="form-group"><label>Notes</label><textarea value={sub.answerNotes} onChange={(e) => handleSubChange(idx, "answerNotes", e.target.value)} /></div>
              </div>
            )}

            {sub.isDynamic && (
              <div className="dynamic-questions">
                <h4>Dynamic Questions {sub.dynamicQuestions && sub.dynamicQuestions.length > 0 ? <span className="existing-data-badge">✓ {sub.dynamicQuestions.length} question{sub.dynamicQuestions.length !== 1 ? 's' : ''}</span> : <span className="no-data-badge">No questions yet</span>}</h4>
                {sub.dynamicQuestions.map((q, qIdx) => (
                  <div key={qIdx} className="question-card">
                    <div className="form-group">
                      <label htmlFor={`editQuestionText-${idx}-${qIdx}`}>Question Text*</label>
                      <input
                        id={`editQuestionText-${idx}-${qIdx}`}
                        type="text"
                        placeholder="Enter question text"
                        value={q.questionText}
                        onChange={(e) => handleDynamicQuestionChange(idx, qIdx, "questionText", e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor={`editOptions-${idx}-${qIdx}`}>Options (for MCQ, comma separated)</label>
                      <input
                        id={`editOptions-${idx}-${qIdx}`}
                        type="text"
                        placeholder="Option 1, Option 2, Option 3"
                        value={q.options}
                        onChange={(e) => handleDynamicQuestionChange(idx, qIdx, "options", e.target.value)}
                      />
 