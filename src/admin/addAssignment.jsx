import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./addassignment.css";
import { useLocation } from "react-router-dom";

export default function AddAssignment() {
  const navigate = useNavigate();
  const [moduleName, setModuleName] = useState("");
  const [students, setStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [subAssignments, setSubAssignments] = useState([
    {
      subModuleName: "",
      isDynamic: false,
      answerPatientName: "",
      answerAgeOrDob: "",
      answerIcdCodes: "",
      answerCptCodes: "",
      answerNotes: "",
      dynamicQuestions: [{ questionText: "", options: "", answer: "" }],
      assignmentPdf: null
    }
  ]);

const location = useLocation();
const initialCategory =
  new URLSearchParams(location.search).get("category") || ""; // from pop
const [category, setCategory] = useState(initialCategory);




  // Fetch all students on component mount
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const res = await fetch("https://el-backend-ashen.vercel.app/admin/students");
        if (!res.ok) {
          throw new Error("Failed to fetch students");
        }
        const data = await res.json();
        setStudents(data);
      } catch (err) {
        console.error("Error fetching students:", err);
        alert(`Error fetching students: ${err.message}`);
      }
    };
    
    fetchStudents();
  }, []);

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

  const formData = new FormData();
  formData.append("moduleName", moduleName);
  formData.append("category", category);

  // Prepare JSON for text data
  const subDataForJson = subAssignments.map(sub => {
    if (sub.isDynamic) {
      return {
        subModuleName: sub.subModuleName,
        isDynamic: true,
        questions: sub.dynamicQuestions.map(q => ({
          questionText: q.questionText,
          options: q.options ? q.options.split(",").map(opt => opt.trim()) : [],
          answer: q.answer
        }))
      };
    } else {
      return {
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
      formData.append("assignmentPdf", sub.assignmentPdf);
    }
  });

  try {
    const res = await fetch(
      "https://el-backend-ashen.vercel.app/admin/add-assignment",
      { method: "POST", body: formData }
    );

    if (!res.ok) throw new Error(await res.text());

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
    placeholder="Pick from popup or type"
    required
  />
  <small>
    From popup: {initialCategory || "none"}. You can adjust if needed.
  </small>
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
          <label>Assign to Students</label>
          <div className="student-selection-controls">
            <button 
              type="button" 
              onClick={() => toggleAllStudents(true)}
              className="small-btn"
            >
              Select All
            </button>
            <button 
              type="button" 
              onClick={() => toggleAllStudents(false)}
              className="small-btn"
            >
              Deselect All
            </button>
          </div>
          <div className="student-checkbox-container">
            {students.map(student => (
              <div key={student._id} className="student-checkbox-item">
                <input
                  type="checkbox"
                  id={`student-${student._id}`}
                  checked={selectedStudents.includes(student._id)}
                  onChange={() => handleStudentSelection(student._id)}
                />
                <label htmlFor={`student-${student._id}`}>
                  {student.name} ({student.courseName})
                </label>
              </div>
            ))}
          </div>
          <small>Selected: {selectedStudents.length} students</small>
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
                onChange={(e) =>
                  handleSubChange(idx, "subModuleName", e.target.value)
                }
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
                    onChange={(e) =>
                      handleSubChange(idx, "answerPatientName", e.target.value)
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor={`answerAgeOrDob-${idx}`}>Age or Date of Birth</label>
                  <input
                    id={`answerAgeOrDob-${idx}`}
                    type="text"
                    placeholder="e.g. 35 or 01/01/1990"
                    value={sub.answerAgeOrDob}
                    onChange={(e) =>
                      handleSubChange(idx, "answerAgeOrDob", e.target.value)
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor={`answerIcdCodes-${idx}`}>ICD Codes</label>
                  <input
                    id={`answerIcdCodes-${idx}`}
                    type="text"
                    placeholder="Comma separated ICD codes"
                    value={sub.answerIcdCodes}
                    onChange={(e) =>
                      handleSubChange(idx, "answerIcdCodes", e.target.value)
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor={`answerCptCodes-${idx}`}>CPT Codes</label>
                  <input
                    id={`answerCptCodes-${idx}`}
                    type="text"
                    placeholder="Comma separated CPT codes"
                    value={sub.answerCptCodes}
                    onChange={(e) =>
                      handleSubChange(idx, "answerCptCodes", e.target.value)
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor={`answerNotes-${idx}`}>Notes</label>
                  <textarea
                    id={`answerNotes-${idx}`}
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
                      <label htmlFor={`options-${idx}-${qIdx}`}>
                        Options (for MCQ, comma separated)
                      </label>
                      <input
                        id={`options-${idx}-${qIdx}`}
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
                      <label htmlFor={`answer-${idx}-${qIdx}`}>Correct Answer*</label>
                      <input
                        id={`answer-${idx}-${qIdx}`}
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
          <button
            type="button"
            onClick={addSubAssignment}
            className="add-sub-btn"
          >
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