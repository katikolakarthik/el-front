import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./addassignment.css";

export default function AddAssignment() {
  const navigate = useNavigate();
  const location = useLocation();
  const [moduleName, setModuleName] = useState("");
  const [students, setStudents] = useState([]);
  const [subAssignments, setSubAssignments] = useState([
    {
      subModuleName: "",
      isDynamic: false,

      // Predefined answer fields
      answerPatientName: "",
      answerAgeOrDob: "",
      answerIcdCodes: "",
      answerCptCodes: "",
      answerPcsCodes: "",       // NEW
      answerHcpcsCodes: "",     // NEW
      answerDrgValue: "",       // NEW
      answerModifiers: "",      // NEW
      answerNotes: "",

      // Dynamic questions
      dynamicQuestions: [{ questionText: "", options: "", answer: "" }],

      assignmentPdf: null
    }
  ]);

  // Get category from URL params
  const initialCategory = new URLSearchParams(location.search).get("category") || "";
  const [category, setCategory] = useState(initialCategory);

  // Fetch all students on component mount (unchanged)
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const res = await fetch("https://el-backend-ashen.vercel.app/admin/students");
        if (!res.ok) throw new Error("Failed to fetch students");
        const data = await res.json();
        setStudents(data);
      } catch (err) {
        console.error("Error fetching students:", err);
      }
    };
    fetchStudents();
  }, []);

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
        answerPcsCodes: "",       // NEW
        answerHcpcsCodes: "",     // NEW
        answerDrgValue: "",       // NEW
        answerModifiers: "",      // NEW
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

    const formData = new FormData();
    formData.append("moduleName", moduleName);
    formData.append("category", category.trim());

    // Prepare JSON for text data
    const subDataForJson = subAssignments.map((sub) => {
      if (sub.isDynamic) {
        return {
          subModuleName: sub.subModuleName,
          isDynamic: true,
          questions: sub.dynamicQuestions.map((q) => ({
            questionText: q.questionText,
            options: q.options ? q.options.split(",").map((opt) => opt.trim()) : [],
            answer: q.answer
          }))
        };
      } else {
        return {
          subModuleName: sub.subModuleName,
          isDynamic: false,

          // These keys must match backend controller (formatPredefined)
          answerPatientName: sub.answerPatientName,
          answerAgeOrDob: sub.answerAgeOrDob,
          answerIcdCodes: sub.answerIcdCodes,     // CSV string; backend splits
          answerCptCodes: sub.answerCptCodes,     // CSV string; backend splits
          answerPcsCodes: sub.answerPcsCodes,     // NEW CSV
          answerHcpcsCodes: sub.answerHcpcsCodes, // NEW CSV
          answerDrgValue: sub.answerDrgValue,     // NEW string
          answerModifiers: sub.answerModifiers,   // NEW CSV
          answerNotes: sub.answerNotes
        };
      }
    });

    formData.append("subAssignments", JSON.stringify(subDataForJson));

    // Append PDFs
    subAssignments.forEach((sub) => {
      if (sub.assignmentPdf) {
        formData.append("assignmentPdf", sub.assignmentPdf);
      }
    });

    try {
      const res = await fetch(
        "https://el-backend-ashen.vercel.app/admin/add-assignment",
        { method: "POST", body: formData }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to save assignment");
      }

      const data = await res.json();
      console.log("✅ Assignment saved:", data);
      alert("Assignment saved successfully!");
      navigate("/admin/assignments");
    } catch (err) {
      console.error("❌ Error:", err);
      alert(`Error saving assignment: ${err.message}`);
    }
  };

  return (
    <div className="add-assignment-container">
      <h2>Add New Assignment</h2>
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
          <small>From popup: {initialCategory || "none"}. You can adjust if needed.</small>
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

                {/* NEW: PCS Codes */}
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

                {/* NEW: HCPCS Codes */}
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

                {/* NEW: DRG Value */}
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

                {/* NEW: Modifiers */}
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
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => handlePdfChange(idx, e.target.files[0])}
              />
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
              Save Assignment
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}