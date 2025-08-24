import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import "./addassignment.css";

export default function EditAssignment() {
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [moduleName, setModuleName] = useState("");
  const [category, setCategory] = useState("");
  const [students, setStudents] = useState([]);
  const [subAssignments, setSubAssignments] = useState([]);

  // Fetch assignment data and students on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch assignment data
        const assignmentRes = await axios.get(`https://el-backend-ashen.vercel.app/admin/assignments/edit/${id}`);
        const assignment = assignmentRes.data;
        
        // Fetch students
        const studentsRes = await axios.get("https://el-backend-ashen.vercel.app/admin/students");
        const studentsData = studentsRes.data;
        
        // Set assignment data
        setModuleName(assignment.moduleName || "");
        setCategory(assignment.category || "");
        setStudents(studentsData);
        
                 // Format sub-assignments for the form
         if (assignment.subAssignments && assignment.subAssignments.length > 0) {
           // Multiple sub-assignments
           const formattedSubs = assignment.subAssignments.map(sub => ({
             _id: sub._id,
             subModuleName: sub.subModuleName || "",
             isDynamic: !!(sub.dynamicQuestions && sub.dynamicQuestions.length > 0),
             
             // Predefined answer fields (convert arrays to CSV strings)
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
             dynamicQuestions: sub.dynamicQuestions && sub.dynamicQuestions.length > 0 
               ? sub.dynamicQuestions.map(q => ({
                   _id: q._id,
                   questionText: q.questionText || "",
                   options: Array.isArray(q.options) ? q.options.join(", ") : "",
                   answer: q.answer || ""
                 }))
               : [{ questionText: "", options: "", answer: "" }],
             
             existingPdf: sub.assignmentPdf || null, // Store existing PDF path
             assignmentPdf: null // New PDF file (if any)
           }));
           setSubAssignments(formattedSubs);
                 } else if (assignment.answerKey || (assignment.dynamicQuestions && assignment.dynamicQuestions.length > 0)) {
           // Single assignment at parent level
           const formattedSub = {
             _id: null,
             subModuleName: assignment.moduleName || "",
             isDynamic: !!(assignment.dynamicQuestions && assignment.dynamicQuestions.length > 0),
             
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
             dynamicQuestions: assignment.dynamicQuestions && assignment.dynamicQuestions.length > 0 
               ? assignment.dynamicQuestions.map(q => ({
                   _id: q._id,
                   questionText: q.questionText || "",
                   options: Array.isArray(q.options) ? q.options.join(", ") : "",
                   answer: q.answer || ""
                 }))
               : [{ questionText: "", options: "", answer: "" }],
             
             existingPdf: assignment.assignmentPdf || null, // Store existing PDF path
             assignmentPdf: null // New PDF file (if any)
           };
           setSubAssignments([formattedSub]);
        } else {
          // No sub-assignments or data, start with empty form
          setSubAssignments([{
            subModuleName: "",
            isDynamic: false,
            answerPatientName: "",
            answerAgeOrDob: "",
            answerIcdCodes: "",
            answerCptCodes: "",
            answerPcsCodes: "",
            answerHcpcsCodes: "",
            answerDrgValue: "",
            answerModifiers: "",
            answerNotes: "",
            dynamicQuestions: [{ questionText: "", options: "", answer: "" }],
            assignmentPdf: null
          }]);
        }
        
      } catch (err) {
        console.error("Error fetching data:", err);
        setError(err.response?.data?.error || err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id]);

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
        answerPatientName: "",
        answerAgeOrDob: "",
        answerIcdCodes: "",
        answerCptCodes: "",
        answerPcsCodes: "",
        answerHcpcsCodes: "",
        answerDrgValue: "",
        answerModifiers: "",
        answerNotes: "",
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

    const formData = new FormData();
    formData.append("moduleName", moduleName);
    formData.append("category", category.trim());

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

    // Append PDFs (only new ones)
    subAssignments.forEach((sub) => {
      if (sub.assignmentPdf) {
        formData.append("assignmentPdf", sub.assignmentPdf);
      }
    });

    try {
      const res = await axios.put(
        `https://el-backend-ashen.vercel.app/admin/assignments/${id}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (res.data.success) {
        alert("Assignment updated successfully!");
        navigate("/admin/assignments");
      } else {
        throw new Error(res.data.message || "Failed to update assignment");
      }
    } catch (err) {
      console.error("❌ Error:", err);
      alert(`Error updating assignment: ${err.response?.data?.error || err.message}`);
    }
  };

  if (loading) return <div className="loading-text">Loading assignment data...</div>;
  if (error) return <div className="error-text">Error: {error}</div>;

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
                    <div className="question-header">
                      <h5>Question #{qIdx + 1}</h5>
                      {sub.dynamicQuestions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeDynamicQuestion(idx, qIdx)}
                          className="remove-question-btn"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    
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
              
              {/* Show existing PDF if available */}
              {sub.existingPdf && (
                <div className="existing-pdf-info">
                  <p><strong>Current PDF:</strong></p>
                  <a 
                    href={sub.existingPdf} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="existing-pdf-link"
                  >
                    📄 View Current PDF
                  </a>
                </div>
              )}
              
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => handlePdfChange(idx, e.target.files[0])}
              />
              <small>
                {sub.existingPdf 
                  ? "Choose a new file to replace the current PDF, or leave empty to keep it"
                  : "Leave empty to keep existing PDF"
                }
              </small>
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
            <button type="submit" className="submit-btn">
              Update Assignment
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
