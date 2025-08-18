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
  if (variant === "secondary") baseClass += " button-secondary";

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

// --- Edit Assignment Form Component ---
const EditAssignmentForm = ({ assignment, onSave, onCancel, students }) => {
  console.log("🔍 EditAssignmentForm - Received assignment:", assignment);
  
  const [moduleName, setModuleName] = useState(assignment.moduleName || "");
  const [selectedStudents, setSelectedStudents] = useState(
    assignment.assignedStudents?.map(s => s._id) || []
  );
  
  // Check if this is a parent-level assignment with questions
  const hasParentLevelQuestions = assignment.questions && assignment.questions.length > 0;
  const [subAssignments, setSubAssignments] = useState(
    assignment.subAssignments?.map(sub => {
      // Extract predefined answer data from questions array
      const predefinedQuestion = sub.questions?.find(q => q.type === "predefined");
      const answerKey = predefinedQuestion?.answerKey || {};
      console.log("🔍 Extracted answerKey:", answerKey);
      
      // Extract dynamic questions
      const dynamicQuestions = sub.questions?.filter(q => q.type === "dynamic") || [];
      console.log("🔍 Extracted dynamicQuestions:", dynamicQuestions);
      
      return {
        _id: sub._id,
        subModuleName: sub.subModuleName || "",
        isDynamic: dynamicQuestions.length > 0,
        // Map from answerKey structure to direct fields
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
      console.log("🔍 Mapped sub-assignment:", {
        _id: sub._id,
        subModuleName: sub.subModuleName,
        isDynamic: dynamicQuestions.length > 0,
        answerPatientName: answerKey.patientName,
        answerAgeOrDob: answerKey.ageOrDob,
        answerIcdCodes: answerKey.icdCodes,
        answerCptCodes: answerKey.cptCodes,
        answerNotes: answerKey.notes
      });
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

  // Handle student selection
  const handleStudentSelection = (studentId) => {
    setSelectedStudents(prev => {
      if (prev.includes(studentId)) {
        return prev.filter(id => id !== studentId);
      } else {
        return [...prev, studentId];
      }
    });
  };

  // Handle select all/none
  const toggleAllStudents = (selectAll) => {
    if (selectAll) {
      setSelectedStudents(students.map(student => student._id));
    } else {
      setSelectedStudents([]);
    }
  };

  // Handle general field changes
  const handleSubChange = (index, field, value) => {
    const updated = [...subAssignments];
    updated[index][field] = value;
    setSubAssignments(updated);
  };

  // Handle dynamic question changes
  const handleDynamicQuestionChange = (subIndex, qIndex, field, value) => {
    const updated = [...subAssignments];
    updated[subIndex].dynamicQuestions[qIndex][field] = value;
    setSubAssignments(updated);
  };

  const addDynamicQuestion = (subIndex) => {
    const updated = [...subAssignments];
    updated[subIndex].dynamicQuestions.push({ 
      questionText: "", 
      options: "", 
      answer: "" 
    });
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
    formData.append("assignedStudents", selectedStudents.join(","));

    // Prepare JSON for text data
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

    // Append PDFs
    subAssignments.forEach((sub, index) => {
      if (sub.assignmentPdf) {
        formData.append(`assignmentPdf`, sub.assignmentPdf);
      }
    });

    try {
      const res = await fetch(
        `${API_BASE}/assignments/${assignment._id}`,
        { 
          method: "PUT", 
          body: formData 
        }
      );
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error("Server response:", errorText);
        throw new Error(`Server error: ${res.status} - ${errorText}`);
      }

      const data = await res.json();
      console.log("✅ Assignment updated:", data);
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
            <Button 
              type="button" 
              onClick={() => toggleAllStudents(true)}
              variant="secondary"
              className="small-btn"
            >
              Select All
            </Button>
            <Button 
              type="button" 
              onClick={() => toggleAllStudents(false)}
              variant="secondary"
              className="small-btn"
            >
              Deselect All
            </Button>
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
              
              {/* Extract parent level predefined answers */}
              {(() => {
                const predefinedQuestion = assignment.questions?.find(q => q.type === "predefined");
                const answerKey = predefinedQuestion?.answerKey || {};
                const dynamicQuestions = assignment.questions?.filter(q => q.type === "dynamic") || [];
                
                return (
                  <>
                    {/* Question Type Toggle for Parent Level */}
                    <div className="question-type-toggle">
                      <label className={`question-type-option ${dynamicQuestions.length === 0 ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="parent-type"
                          checked={dynamicQuestions.length === 0}
                          readOnly
                        />
                        <span className="radio-custom"></span>
                        Predefined Questions
                        <span className="question-count">({Object.values(answerKey).some(v => v && (Array.isArray(v) ? v.length > 0 : true)) ? 'Has answers' : 'No answers'})</span>
                      </label>
                      <label className={`question-type-option ${dynamicQuestions.length > 0 ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="parent-type"
                          checked={dynamicQuestions.length > 0}
                          readOnly
                        />
                        <span className="radio-custom"></span>
                        Dynamic Questions
                        <span className="question-count">({dynamicQuestions.length} questions)</span>
                      </label>
                    </div>

                    {/* Parent Level Predefined Fields */}
                    {dynamicQuestions.length === 0 && (
                      <div className="predefined-fields">
                        <h4>Predefined Answer Key 
                          {Object.values(answerKey).some(v => v && (Array.isArray(v) ? v.length > 0 : true)) ? 
                            <span className="existing-data-badge">✓ Has existing answers</span> : 
                            <span className="no-data-badge">No answers yet</span>
                          }
                        </h4>
                        
                        <div className="form-group">
                          <label>Patient Name</label>
                          <input
                            type="text"
                            placeholder="Patient name"
                            value={answerKey.patientName || ""}
                            readOnly
                            className="readonly-field"
                          />
                        </div>

                        <div className="form-group">
                          <label>Age or Date of Birth</label>
                          <input
                            type="text"
                            placeholder="e.g. 35 or 01/01/1990"
                            value={answerKey.ageOrDob || ""}
                            readOnly
                            className="readonly-field"
                          />
                        </div>

                        <div className="form-group">
                          <label>ICD Codes</label>
                          <input
                            type="text"
                            placeholder="Comma separated ICD codes"
                            value={Array.isArray(answerKey.icdCodes) ? answerKey.icdCodes.join(", ") : (answerKey.icdCodes || "")}
                            readOnly
                            className="readonly-field"
                          />
                        </div>

                        <div className="form-group">
                          <label>CPT Codes</label>
                          <input
                            type="text"
                            placeholder="Comma separated CPT codes"
                            value={Array.isArray(answerKey.cptCodes) ? answerKey.cptCodes.join(", ") : (answerKey.cptCodes || "")}
                            readOnly
                            className="readonly-field"
                          />
                        </div>

                        <div className="form-group">
                          <label>Notes</label>
                          <textarea
                            placeholder="Additional notes"
                            value={answerKey.notes || ""}
                            readOnly
                            className="readonly-field"
                          />
                        </div>
                      </div>
                    )}

                    {/* Parent Level Dynamic Questions */}
                    {dynamicQuestions.length > 0 && (
                      <div className="dynamic-questions">
                        <h4>Dynamic Questions 
                          <span className="existing-data-badge">✓ {dynamicQuestions.length} question{dynamicQuestions.length !== 1 ? 's' : ''}</span>
                        </h4>
                        {dynamicQuestions.map((q, qIdx) => (
                          <div key={qIdx} className="question-card">
                            <div className="form-group">
                              <label>Question Text</label>
                              <input
                                type="text"
                                placeholder="Enter question text"
                                value={q.questionText || ""}
                                readOnly
                                className="readonly-field"
                              />
                            </div>

                            <div className="form-group">
                              <label>Options (for MCQ, comma separated)</label>
                              <input
                                type="text"
                                placeholder="Option 1, Option 2, Option 3"
                                value={Array.isArray(q.options) ? q.options.join(", ") : (q.options || "")}
                                readOnly
                                className="readonly-field"
                              />
                            </div>

                            <div className="form-group">
                              <label>Correct Answer</label>
                              <input
                                type="text"
                                placeholder="Enter correct answer"
                                value={q.answer || ""}
                                readOnly
                                className="readonly-field"
                              />
                            </div>
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
                <Button
                  type="button"
                  onClick={() => removeSubAssignment(idx)}
                  variant="danger"
                  className="remove-btn"
                >
                  Remove
                </Button>
              )}
            </div>

            <div className="form-group">
              <label htmlFor={`editSubModuleName-${idx}`}>Sub-Module Name*</label>
              <input
                id={`editSubModuleName-${idx}`}
                type="text"
                placeholder="Enter sub-module name"
                value={sub.subModuleName}
                onChange={(e) =>
                  handleSubChange(idx, "subModuleName", e.target.value)
                }
                required
              />
            </div>

            <div className="question-type-toggle">
              <label className={`question-type-option ${!sub.isDynamic ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name={`edit-type-${idx}`}
                  checked={!sub.isDynamic}
                  onChange={() => handleSubChange(idx, "isDynamic", false)}
                />
                <span className="radio-custom"></span>
                Predefined Questions
                <span className="question-count">({!sub.isDynamic ? '5 fields' : '0 fields'})</span>
              </label>
              <label className={`question-type-option ${sub.isDynamic ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name={`edit-type-${idx}`}
                  checked={sub.isDynamic}
                  onChange={() => handleSubChange(idx, "isDynamic", true)}
                />
                <span className="radio-custom"></span>
                Dynamic Questions
                <span className="question-count">({sub.isDynamic ? `${sub.dynamicQuestions.length} questions` : '0 questions'})</span>
              </label>
            </div>

            {/* Predefined Answer Fields */}
            {!sub.isDynamic && (
              <div className="predefined-fields">
                <h4>Predefined Answer Key 
                  {sub.answerPatientName || sub.answerAgeOrDob || sub.answerIcdCodes || sub.answerCptCodes || sub.answerNotes ? 
                    <span className="existing-data-badge">✓ Has existing answers</span> : 
                    <span className="no-data-badge">No answers yet</span>
                  }
                </h4>
                
                <div className="form-group">
                  <label htmlFor={`editAnswerPatientName-${idx}`}>Patient Name</label>
                  <input
                    id={`editAnswerPatientName-${idx}`}
                    type="text"
                    placeholder="Patient name"
                    value={sub.answerPatientName}
                    onChange={(e) =>
                      handleSubChange(idx, "answerPatientName", e.target.value)
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor={`editAnswerAgeOrDob-${idx}`}>Age or Date of Birth</label>
                  <input
                    id={`editAnswerAgeOrDob-${idx}`}
                    type="text"
                    placeholder="e.g. 35 or 01/01/1990"
                    value={sub.answerAgeOrDob}
                    onChange={(e) =>
                      handleSubChange(idx, "answerAgeOrDob", e.target.value)
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor={`editAnswerIcdCodes-${idx}`}>ICD Codes</label>
                  <input
                    id={`editAnswerIcdCodes-${idx}`}
                    type="text"
                    placeholder="Comma separated ICD codes"
                    value={sub.answerIcdCodes}
                    onChange={(e) =>
                      handleSubChange(idx, "answerIcdCodes", e.target.value)
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor={`editAnswerCptCodes-${idx}`}>CPT Codes</label>
                  <input
                    id={`editAnswerCptCodes-${idx}`}
                    type="text"
                    placeholder="Comma separated CPT codes"
                    value={sub.answerCptCodes}
                    onChange={(e) =>
                      handleSubChange(idx, "answerCptCodes", e.target.value)
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor={`editAnswerNotes-${idx}`}>Notes</label>
                  <textarea
                    id={`editAnswerNotes-${idx}`}
                    placeholder="Additional notes"
                    value={sub.answerNotes}
                    onChange={(e) =>
                      handleSubChange(idx, "answerNotes", e.target.value)
                    }
                  />
                </div>
              </div>
            )}

            {/* Dynamic Questions */}
            {sub.isDynamic && (
              <div className="dynamic-questions">
                <h4>Dynamic Questions 
                  {sub.dynamicQuestions && sub.dynamicQuestions.length > 0 ? 
                    <span className="existing-data-badge">✓ {sub.dynamicQuestions.length} question{sub.dynamicQuestions.length !== 1 ? 's' : ''}</span> : 
                    <span className="no-data-badge">No questions yet</span>
                  }
                </h4>
                {sub.dynamicQuestions.map((q, qIdx) => (
                  <div key={qIdx} className="question-card">
                    <div className="form-group">
                      <label htmlFor={`editQuestionText-${idx}-${qIdx}`}>Question Text*</label>
                      <input
                        id={`editQuestionText-${idx}-${qIdx}`}
                        type="text"
                        placeholder="Enter question text"
                        value={q.questionText}
                        onChange={(e) =>
                          handleDynamicQuestionChange(
                            idx,
                            qIdx,
                            "questionText",
                            e.target.value
                          )
                        }
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor={`editOptions-${idx}-${qIdx}`}>
                        Options (for MCQ, comma separated)
                      </label>
                      <input
                        id={`editOptions-${idx}-${qIdx}`}
                        type="text"
                        placeholder="Option 1, Option 2, Option 3"
                        value={q.options}
                        onChange={(e) =>
                          handleDynamicQuestionChange(
                            idx,
                            qIdx,
                            "options",
                            e.target.value
                          )
                        }
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor={`editAnswer-${idx}-${qIdx}`}>Correct Answer*</label>
                      <input
                        id={`editAnswer-${idx}-${qIdx}`}
                        type="text"
                        placeholder="Enter correct answer"
                        value={q.answer}
                        onChange={(e) =>
                          handleDynamicQuestionChange(
                            idx,
                            qIdx,
                            "answer",
                            e.target.value
                          )
                        }
                        required
                      />
                    </div>

                    {sub.dynamicQuestions.length > 1 && (
                                      <Button
                  type="button"
                  onClick={() => removeDynamicQuestion(idx, qIdx)}
                  variant="danger"
                  className="remove-question-btn"
                >
                  Remove Question
                </Button>
                    )}
                  </div>
                ))}

                <Button
                  type="button"
                  onClick={() => addDynamicQuestion(idx)}
                  variant="primary"
                  className="add-question-btn"
                >
                  + Add Another Question
                </Button>
              </div>
            )}

            <div className="form-group">
              <label>Assignment PDF</label>
              {sub.assignmentPdfUrl && (
                <div className="existing-pdf-info">
                  <p><strong>Current PDF:</strong> {sub.assignmentPdfUrl.split('/').pop()}</p>
                  <small>Upload a new file to replace the existing PDF</small>
                </div>
              )}
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => handleSubChange(idx, "assignmentPdf", e.target.files[0])}
              />
              <small>{sub.assignmentPdfUrl ? "Upload new file to replace existing PDF" : "No PDF currently assigned"}</small>
            </div>
          </div>
        ))}

        <div className="form-actions">
          <Button
            type="button"
            onClick={addSubAssignment}
            variant="primary"
            className="add-sub-btn"
          >
            + Add Sub-Assignment
          </Button>

          <div className="submit-actions">
            <Button
              type="button"
              onClick={onCancel}
              variant="secondary"
              className="cancel-btn"
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="submit-btn">
              Update Assignment
            </Button>
          </div>
        </div>
      </form>
    </div>
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
const AssignmentCard = ({ assignment, onDeleteModule, onDeleteSubAssignment, onOpenStudentsModal, onEditModule, onEditSubAssignment, deleting }) => {
  const { _id: moduleId, moduleName, assignedDate, subAssignments, assignmentPdf } = assignment;

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">{moduleName}</h3>
        <div className="card-actions">
          <Button
            onClick={() => onEditModule(assignment)}
            variant="secondary"
            className="edit-btn"
          >
            Edit Module
          </Button>
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
                        <div className="action-buttons">
                          <Button
                            onClick={() => onEditSubAssignment(assignment, sub)}
                            variant="secondary"
                            className="edit-sub-btn"
                          >
                            Edit
                          </Button>
                          <Button
                            onClick={() => onDeleteSubAssignment(moduleId, subId)}
                            disabled={deleting[subId]}
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

  // Edit functionality states
  const [editingModule, setEditingModule] = useState(null);
  const [editingSubAssignment, setEditingSubAssignment] = useState(null);
  const [students, setStudents] = useState([]);
  
  // Debug logging
  useEffect(() => {
    if (editingModule) {
      console.log("🔍 Editing Module Data:", editingModule);
      console.log("🔍 Sub-Assignments:", editingModule.subAssignments);
      console.log("🔍 Questions:", editingModule.questions);
    }
  }, [editingModule]);

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

  // Edit handlers
  const handleEditModule = (assignment) => {
    setEditingModule(assignment);
  };

  const handleEditSubAssignment = (assignment, subAssignment) => {
    setEditingSubAssignment({ assignment, subAssignment });
  };

  const handleEditSave = (updatedAssignment) => {
    // Refresh the assignments list to get the updated data
    fetchAssignments();
    setEditingModule(null);
    setEditingSubAssignment(null);
  };

  const handleEditCancel = () => {
    setEditingModule(null);
    setEditingSubAssignment(null);
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
            onEditModule={handleEditModule}
            onEditSubAssignment={handleEditSubAssignment}
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

      {/* Edit Module Modal */}
      {editingModule && (
        <Modal
          isOpen={!!editingModule}
          onClose={handleEditCancel}
          title={`Edit Module: ${editingModule.moduleName}`}
        >
          <EditAssignmentForm
            assignment={editingModule}
            students={students}
            onSave={handleEditSave}
            onCancel={handleEditCancel}
          />
        </Modal>
      )}

      {/* Edit Sub-Assignment Modal */}
      {editingSubAssignment && (
        <Modal
          isOpen={!!editingSubAssignment}
          onClose={handleEditCancel}
          title={`Edit Sub-Module: ${editingSubAssignment.subAssignment.subModuleName}`}
        >
          <EditAssignmentForm
            assignment={{
              ...editingSubAssignment.assignment,
              subAssignments: [editingSubAssignment.subAssignment]
            }}
            students={students}
            onSave={handleEditSave}
            onCancel={handleEditCancel}
          />
        </Modal>
      )}
    </div>
  );
}