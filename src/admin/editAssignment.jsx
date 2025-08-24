import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import "./addassignment.css";

export default function EditAssignment() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [moduleName, setModuleName] = useState("");
  const [category, setCategory] = useState("");
  const [subAssignments, setSubAssignments] = useState([]);
  const [assignedStudents, setAssignedStudents] = useState([]);

  // Get assignment data from navigation state or fetch it
  const assignmentFromState = location.state?.assignment;

  useEffect(() => {
    // Always fetch fresh data from backend to ensure we get raw data structure
    fetchAssignmentData();
  }, [id]);

  // Debug: Log form data changes
  useEffect(() => {
    console.log("📊 Current form state:", {
      moduleName,
      category,
      subAssignments,
      assignedStudents
    });
  }, [moduleName, category, subAssignments, assignedStudents]);

  const fetchAssignmentData = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("🔍 Fetching assignment data for ID:", id);
      const res = await fetch(`https://el-backend-ashen.vercel.app/admin/assignments/${id}/edit`);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error("❌ Response not OK:", res.status, errorText);
        throw new Error(`Failed to fetch assignment: ${res.status} ${errorText}`);
      }
      
      const assignment = await res.json();
      console.log("✅ Raw assignment data received:", assignment);
      
      populateFormWithAssignment(assignment);
    } catch (err) {
      console.error("❌ Error fetching assignment:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const populateFormWithAssignment = (assignment) => {
    console.log("🔍 Populating form with assignment:", assignment);
    console.log("🔍 Raw assignment data structure:", {
      moduleName: assignment.moduleName,
      category: assignment.category,
      answerKey: assignment.answerKey,
      dynamicQuestions: assignment.dynamicQuestions,
      subAssignments: assignment.subAssignments
    });
    
    // Log the actual data values
    if (assignment.answerKey) {
      console.log("🔍 Parent answerKey data:", {
        patientName: assignment.answerKey.patientName,
        ageOrDob: assignment.answerKey.ageOrDob,
        icdCodes: assignment.answerKey.icdCodes,
        cptCodes: assignment.answerKey.cptCodes,
        pcsCodes: assignment.answerKey.pcsCodes,
        hcpcsCodes: assignment.answerKey.hcpcsCodes,
        drgValue: assignment.answerKey.drgValue,
        modifiers: assignment.answerKey.modifiers,
        notes: assignment.answerKey.notes
      });
    }
    
    if (assignment.subAssignments && assignment.subAssignments.length > 0) {
      assignment.subAssignments.forEach((sub, idx) => {
        if (sub.answerKey) {
          console.log(`🔍 Sub-assignment ${idx} answerKey data:`, {
            patientName: sub.answerKey.patientName,
            ageOrDob: sub.answerKey.ageOrDob,
            icdCodes: sub.answerKey.icdCodes,
            cptCodes: sub.answerKey.cptCodes,
            pcsCodes: sub.answerKey.pcsCodes,
            hcpcsCodes: sub.answerKey.hcpcsCodes,
            drgValue: sub.answerKey.drgValue,
            modifiers: sub.answerKey.modifiers,
            notes: sub.answerKey.notes
          });
        }
      });
    }
    
    setModuleName(assignment.moduleName || "");
    setCategory(assignment.category || "");
    setAssignedStudents(assignment.assignedStudents || []);

    // Handle sub-assignments
    if (assignment.subAssignments && assignment.subAssignments.length > 0) {
      console.log("📋 Multiple sub-assignments found:", assignment.subAssignments);
      
      // Multiple sub-assignments
      const formattedSubs = assignment.subAssignments.map(sub => {
        console.log(`📝 Sub-assignment ${sub.subModuleName}:`, {
          answerKey: sub.answerKey,
          dynamicQuestions: sub.dynamicQuestions
        });
        
        // Check if we have the raw data or the formatted data
        const hasRawData = sub.answerKey || sub.dynamicQuestions;
        const hasFormattedData = sub.questions || sub.dynamicAnswerKey;
        
        if (!hasRawData && hasFormattedData) {
          console.log("⚠️ Using formatted data from dashboard - some fields may not be editable");
        }
        
        return {
        _id: sub._id,
        subModuleName: sub.subModuleName || "",
        isDynamic: !sub.answerKey || Object.keys(sub.answerKey).every(key => !sub.answerKey[key]),
        
        // Predefined answer fields
        answerPatientName: sub.answerKey?.patientName || "",
        answerAgeOrDob: sub.answerKey?.ageOrDob || "",
        answerIcdCodes: Array.isArray(sub.answerKey?.icdCodes) ? sub.answerKey.icdCodes.join(", ") : "",
        answerCptCodes: Array.isArray(sub.answerKey?.cptCodes) ? sub.answerKey.cptCodes.join(", ") : "",
        answerPcsCodes: Array.isArray(sub.answerKey?.pcsCodes) ? sub.answerKey.pcsCodes.join(", ") : "",
        answerHcpcsCodes: Array.isArray(sub.answerKey?.hcpcsCodes) ? sub.answerKey.hcpcsCodes.join(", ") : "",
        answerDrgValue: sub.answerKey?.drgValue || "",
        answerModifiers: Array.isArray(sub.answerKey?.modifiers) ? sub.answerKey.modifiers.join(", ") : "",
        answerNotes: sub.answerKey?.notes || "",

        // Dynamic questions
        dynamicQuestions: sub.dynamicQuestions ? sub.dynamicQuestions.map(q => ({
          _id: q._id,
          questionText: q.questionText || "",
          options: Array.isArray(q.options) ? q.options.join(", ") : "",
          answer: q.answer || ""
        })) : [{ questionText: "", options: "", answer: "" }],

        assignmentPdf: sub.assignmentPdf || null // Preserve existing PDF path
      }));
      console.log("✅ Final formatted sub-assignments:", formattedSubs);
      console.log("✅ Sample sub-assignment data:", formattedSubs[0]);
      setSubAssignments(formattedSubs);
    } else {
      console.log("📋 Single assignment at parent level");
      
      // Single assignment at parent level
      const isDynamic = !assignment.answerKey || Object.keys(assignment.answerKey).every(key => !assignment.answerKey[key]);
      
      console.log("📝 Parent assignment:", {
        answerKey: assignment.answerKey,
        dynamicQuestions: assignment.dynamicQuestions,
        isDynamic
      });
      
      // Check if we have the raw data or the formatted data
      const hasRawData = assignment.answerKey || assignment.dynamicQuestions;
      const hasFormattedData = assignment.questions || assignment.dynamicAnswerKey;
      
      if (!hasRawData && hasFormattedData) {
        console.log("⚠️ Using formatted data from dashboard - some fields may not be editable");
      }
      
      setSubAssignments([{
        _id: assignment._id,
        subModuleName: assignment.moduleName || "",
        isDynamic,
        
        // Predefined answer fields
        answerPatientName: assignment.answerKey?.patientName || "",
        answerAgeOrDob: assignment.answerKey?.ageOrDob || "",
        answerIcdCodes: Array.isArray(assignment.answerKey?.icdCodes) ? assignment.answerKey.icdCodes.join(", ") : "",
        answerCptCodes: Array.isArray(assignment.answerKey?.cptCodes) ? assignment.answerKey.cptCodes.join(", ") : "",
        answerPcsCodes: Array.isArray(assignment.answerKey?.pcsCodes) ? assignment.answerKey.pcsCodes.join(", ") : "",
        answerHcpcsCodes: Array.isArray(assignment.answerKey?.hcpcsCodes) ? assignment.answerKey.hcpcsCodes.join(", ") : "",
        answerDrgValue: assignment.answerKey?.drgValue || "",
        answerModifiers: Array.isArray(assignment.answerKey?.modifiers) ? assignment.answerKey.modifiers.join(", ") : "",
        answerNotes: assignment.answerKey?.notes || "",

        // Dynamic questions
        dynamicQuestions: assignment.dynamicQuestions ? assignment.dynamicQuestions.map(q => ({
          _id: q._id,
          questionText: q.questionText || "",
          options: Array.isArray(q.options) ? q.options.join(", ") : "",
          answer: q.answer || ""
        })) : [{ questionText: "", options: "", answer: "" }],

        assignmentPdf: assignment.assignmentPdf || null // Preserve existing PDF path
      }];
      
      console.log("✅ Final formatted single assignment:", formattedSingle);
      setSubAssignments(formattedSingle);
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

  const handlePdfChange = (index, file) => {
    const updated = [...subAssignments];
    updated[index].assignmentPdf = file;
    setSubAssignments(updated);
  };

  const addSubAssignment = () => {
    setSubAssignments([
      ...subAssignments,
      {
        subModuleName: "",
        isDynamic: false,

        // Predefined answer fields
        answerPatientName: "",
        answerAgeOrDob: "",
        answerIcdCodes: "",
        answerCptCodes: "",
        answerPcsCodes: "",
        answerHcpcsCodes: "",
        answerDrgValue: "",
        answerModifiers: "",
        answerNotes: "",

        // Dynamic questions
        dynamicQuestions: [{ questionText: "", options: "", answer: "" }],
        assignmentPdf: null
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

    // Validate category
    if (!category || !category.trim()) {
      alert("Category is required");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("moduleName", moduleName);
    formData.append("category", category.trim());
    formData.append("assignedStudents", assignedStudents.map(s => s._id || s).join(","));

    // Prepare JSON for text data
    const subDataForJson = subAssignments.map((sub) => {
      if (sub.isDynamic) {
        return {
          _id: sub._id, // Preserve existing ID for updates
          subModuleName: sub.subModuleName,
          isDynamic: true,
          questions: sub.dynamicQuestions.map((q) => ({
            _id: q._id, // Preserve existing question ID
            questionText: q.questionText,
            options: q.options ? q.options.split(",").map((opt) => opt.trim()) : [],
            answer: q.answer
          }))
        };
      } else {
        return {
          _id: sub._id, // Preserve existing ID for updates
          subModuleName: sub.subModuleName,
          isDynamic: false,

          // These keys must match backend controller (formatPredefined)
          answerPatientName: sub.answerPatientName,
          answerAgeOrDob: sub.answerAgeOrDob,
          answerIcdCodes: sub.answerIcdCodes,
          answerCptCodes: sub.answerCptCodes,
          answerPcsCodes: sub.answerPcsCodes,
          answerHcpcsCodes: sub.answerHcpcsCodes,
          answerDrgValue: sub.answerDrgValue,
          answerModifiers: sub.answerModifiers,
          answerNotes: sub.answerNotes
        };
      }
    });

    formData.append("subAssignments", JSON.stringify(subDataForJson));

    // Append PDFs (only if new ones are selected)
    subAssignments.forEach((sub) => {
      if (sub.assignmentPdf && sub.assignmentPdf instanceof File) {
        formData.append("assignmentPdf", sub.assignmentPdf);
      }
    });

    try {
      const res = await fetch(
        `https://el-backend-ashen.vercel.app/admin/assignments/${id}`,
        { 
          method: "PUT", 
          body: formData 
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to update assignment");
      }

      const data = await res.json();
      console.log("✅ Assignment updated:", data);
      alert("Assignment updated successfully!");
      navigate("/admin/assignments");
    } catch (err) {
      console.error("❌ Error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="add-assignment-container">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>🔄 Loading assignment data...</p>
          <p style={{ fontSize: '0.9rem', color: '#666' }}>
            Fetching existing answers and questions from database...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="add-assignment-container">
        <p className="error-text">Error: {error}</p>
        <button onClick={() => navigate("/admin/assignments")} className="cancel-btn">
          Back to Assignments
        </button>
      </div>
    );
  }

  return (
    <div className="add-assignment-container">
      <h2>Edit Assignment</h2>
      <form onSubmit={handleSubmit} className="assignment-form">
        <div className="form-group">
          <label>Category*</label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Enter category"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="moduleName">Module Name*</label>
          <input
            id="moduleName"
            type="text"
            placeholder="Enter module name"
            value={moduleName}
            onChange={(e) => setModuleName(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Assigned Students</label>
          <div className="assigned-students-display">
            {assignedStudents.length > 0 ? (
              assignedStudents.map((student, idx) => (
                <div key={student._id || idx} className="student-tag">
                  {student.name || student.email || `Student ${idx + 1}`}
                </div>
              ))
            ) : (
              <span className="no-students">No students assigned</span>
            )}
          </div>
        </div>

        <h3>Sub-Assignments</h3>
        {subAssignments.map((sub, idx) => (
          <div key={idx} className="sub-assignment-card">
            <div className="sub-header">
              <h4>Sub-Assignment #{idx + 1}</h4>
              {subAssignments.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSubAssignment(idx)}
                  className="remove-btn"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="form-group">
              <label htmlFor={`subModuleName-${idx}`}>Sub-Module Name*</label>
              <input
                id={`subModuleName-${idx}`}
                type="text"
                placeholder="Enter sub-module name"
                value={sub.subModuleName}
                onChange={(e) => handleSubChange(idx, "subModuleName", e.target.value)}
                required
              />
            </div>

            <div className="question-type-toggle">
              <label>
                <input
                  type="radio"
                  name={`type-${idx}`}
                  checked={!sub.isDynamic}
                  onChange={() => handleSubChange(idx, "isDynamic", false)}
                />
                Predefined Questions
              </label>
              <label>
                <input
                  type="radio"
                  name={`type-${idx}`}
                  checked={sub.isDynamic}
                  onChange={() => handleSubChange(idx, "isDynamic", true)}
                />
                Dynamic Questions
              </label>
            </div>

            {/* Predefined Answer Fields */}
            {!sub.isDynamic && (
              <div className="predefined-fields">
                <h4>Predefined Answer Key</h4>

                <div className="form-group">
                  <label htmlFor={`answerPatientName-${idx}`}>Patient Name</label>
                  <input
                    id={`answerPatientName-${idx}`}
                    type="text"
                    placeholder="Patient name"
                    value={sub.answerPatientName}
                    onChange={(e) => handleSubChange(idx, "answerPatientName", e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor={`answerAgeOrDob-${idx}`}>Age or Date of Birth</label>
                  <input
                    id={`answerAgeOrDob-${idx}`}
                    type="text"
                    placeholder="e.g. 35 or 01/01/1990"
                    value={sub.answerAgeOrDob}
                    onChange={(e) => handleSubChange(idx, "answerAgeOrDob", e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor={`answerIcdCodes-${idx}`}>ICD Codes</label>
                  <input
                    id={`answerIcdCodes-${idx}`}
                    type="text"
                    placeholder="Comma separated ICD codes"
                    value={sub.answerIcdCodes}
                    onChange={(e) => handleSubChange(idx, "answerIcdCodes", e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor={`answerCptCodes-${idx}`}>CPT Codes</label>
                  <input
                    id={`answerCptCodes-${idx}`}
                    type="text"
                    placeholder="Comma separated CPT codes"
                    value={sub.answerCptCodes}
                    onChange={(e) => handleSubChange(idx, "answerCptCodes", e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor={`answerPcsCodes-${idx}`}>PCS Codes</label>
                  <input
                    id={`answerPcsCodes-${idx}`}
                    type="text"
                    placeholder="Comma separated ICD-10-PCS codes"
                    value={sub.answerPcsCodes}
                    onChange={(e) => handleSubChange(idx, "answerPcsCodes", e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor={`answerHcpcsCodes-${idx}`}>HCPCS Codes</label>
                  <input
                    id={`answerHcpcsCodes-${idx}`}
                    type="text"
                    placeholder="Comma separated HCPCS codes"
                    value={sub.answerHcpcsCodes}
                    onChange={(e) => handleSubChange(idx, "answerHcpcsCodes", e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor={`answerDrgValue-${idx}`}>DRG Value</label>
                  <input
                    id={`answerDrgValue-${idx}`}
                    type="text"
                    placeholder="e.g. 470 or 470-xx"
                    value={sub.answerDrgValue}
                    onChange={(e) => handleSubChange(idx, "answerDrgValue", e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor={`answerModifiers-${idx}`}>Modifiers</label>
                  <input
                    id={`answerModifiers-${idx}`}
                    type="text"
                    placeholder="Comma separated modifiers (e.g. 26, 59, LT)"
                    value={sub.answerModifiers}
                    onChange={(e) => handleSubChange(idx, "answerModifiers", e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor={`answerNotes-${idx}`}>Notes</label>
                  <textarea
                    id={`answerNotes-${idx}`}
                    placeholder="Additional notes"
                    value={sub.answerNotes}
                    onChange={(e) => handleSubChange(idx, "answerNotes", e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Dynamic Questions */}
            {sub.isDynamic && (
              <div className="dynamic-questions">
                <h4>Dynamic Questions</h4>
                {sub.dynamicQuestions.map((q, qIdx) => (
                  <div key={qIdx} className="question-card">
                    <div className="form-group">
                      <label htmlFor={`questionText-${idx}-${qIdx}`}>Question Text*</label>
                      <input
                        id={`questionText-${idx}-${qIdx}`}
                        type="text"
                        placeholder="Enter question text"
                        value={q.questionText}
                        onChange={(e) =>
                          handleDynamicQuestionChange(idx, qIdx, "questionText", e.target.value)
                        }
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor={`options-${idx}-${qIdx}`}>
                        Options (for MCQ, comma separated)
                      </label>
                      <input
                        id={`options-${idx}-${qIdx}`}
                        type="text"
                        placeholder="Option 1, Option 2, Option 3"
                        value={q.options}
                        onChange={(e) =>
                          handleDynamicQuestionChange(idx, qIdx, "options", e.target.value)
                        }
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor={`answer-${idx}-${qIdx}`}>Correct Answer*</label>
                      <input
                        id={`answer-${idx}-${qIdx}`}
                        type="text"
                        placeholder="Enter correct answer"
                        value={q.answer}
                        onChange={(e) =>
                          handleDynamicQuestionChange(idx, qIdx, "answer", e.target.value)
                        }
                        required
                      />
                    </div>

                    {sub.dynamicQuestions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDynamicQuestion(idx, qIdx)}
                        className="remove-btn"
                      >
                        Remove Question
                      </button>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => addDynamicQuestion(idx)}
                  className="add-question-btn"
                >
                  + Add Another Question
                </button>
              </div>
            )}

            <div className="form-group">
              <label>Assignment PDF</label>
              {sub.assignmentPdf && typeof sub.assignmentPdf === 'string' && (
                <div className="current-pdf">
                  <strong>Current PDF:</strong> 
                  <a href={sub.assignmentPdf} target="_blank" rel="noopener noreferrer" className="pdf-link">
                    View Current PDF
                  </a>
                </div>
              )}
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => handlePdfChange(idx, e.target.files[0])}
              />
              <small>Leave empty to keep existing PDF</small>
            </div>
          </div>
        ))}

        <div className="form-actions">
          <button type="button" onClick={addSubAssignment} className="add-sub-btn">
            + Add Sub-Assignment
          </button>

          <div className="submit-actions">
            <button
              type="button"
              onClick={() => navigate("/admin/assignments")}
              className="cancel-btn"
            >
              Cancel
            </button>
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? "Updating..." : "Update Assignment"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
