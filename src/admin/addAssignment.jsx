import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./addassignment.css";

export default function AddAssignment() {
  const navigate = useNavigate();
  const location = useLocation();
  const [moduleName, setModuleName] = useState("");
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false); // global loading
  const abortRef = useRef(null); // cancel fetch on unmount

  // ---- NEW: optional timer states (both optional) ----
  // Use <input type="datetime-local"> compatible values: "YYYY-MM-DDTHH:mm"
  const [windowStart, setWindowStart] = useState(""); // empty = not set
  const [windowEnd, setWindowEnd] = useState("");     // empty = not set

  // Helper to convert datetime-local -> ISO string (server expects date-parsable)
  const toIsoOrNull = (val) => {
    if (!val || !val.trim()) return null;
    // val like "2025-09-05T13:30"
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
  };

  const [subAssignments, setSubAssignments] = useState([
    {
      subModuleName: "",
      isDynamic: false,
      // Predefined fields:
      answerPatientName: "",
      answerAgeOrDob: "",
      answerIcdCodes: "",
      answerCptCodes: "",
      answerPcsCodes: "",
      answerHcpcsCodes: "",
      answerDrgValue: "",
      answerModifiers: "",
      answerNotes: "",
      // ---- NEW: Adx field (predefined answer key) ----
      answerAdx: "",
      // Dynamic:
      dynamicQuestions: [{ questionText: "", options: "", answer: "" }],
      assignmentPdf: null
    }
  ]);

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

    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const initialCategory = new URLSearchParams(location.search).get("category") || "";
  const [category, setCategory] = useState(initialCategory);

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

  const handlePdfChange = (index, file) => {
    const updated = [...subAssignments];
    updated[index].assignmentPdf = file;
    setSubAssignments(updated);
  };

  const addSubAssignment = () => {
    setSubAssignments((prev) => [
      ...prev,
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
        answerAdx: "", // NEW
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
    if (loading) return;
    if (!category || !category.trim()) {
      alert("Category is required");
      return;
    }

    // Optional: basic client-side validation for timer
    if (windowStart && windowEnd) {
      const start = new Date(windowStart).getTime();
      const end = new Date(windowEnd).getTime();
      if (!isNaN(start) && !isNaN(end) && end < start) {
        alert("End time should be greater than or equal to Start time");
        return;
      }
    }

    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const formData = new FormData();
    formData.append("moduleName", moduleName);
    formData.append("category", category.trim());

    // ---- NEW: append optional timer values if present ----
    const wsISO = toIsoOrNull(windowStart);
    const weISO = toIsoOrNull(windowEnd);
    if (wsISO) formData.append("windowStart", wsISO);
    if (weISO) formData.append("windowEnd", weISO);

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
          answerPatientName: sub.answerPatientName,
          answerAgeOrDob: sub.answerAgeOrDob,
          answerIcdCodes: sub.answerIcdCodes,
          answerCptCodes: sub.answerCptCodes,
          answerPcsCodes: sub.answerPcsCodes,
          answerHcpcsCodes: sub.answerHcpcsCodes,
          answerDrgValue: sub.answerDrgValue,
          answerModifiers: sub.answerModifiers,
          answerNotes: sub.answerNotes,
          // ---- NEW: Adx goes to predefined answerKey as "answerAdx" ----
          answerAdx: sub.answerAdx
        };
      }
    });

    formData.append("subAssignments", JSON.stringify(subDataForJson));

    subAssignments.forEach((sub) => {
      if (sub.assignmentPdf) {
        formData.append("assignmentPdf", sub.assignmentPdf);
      }
    });

    try {
      const res = await fetch("https://el-backend-ashen.vercel.app/admin/add-assignment", {
        method: "POST",
        body: formData,
        signal: controller.signal
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to save assignment");
      }

      const data = await res.json();
      console.log("✅ Assignment saved:", data);
      navigate("/admin/assignments");
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("❌ Error:", err);
        alert(`Error saving assignment: ${err.message}`);
        setLoading(false);
      }
    } finally {
      abortRef.current = null;
    }
  };

  return (
    <div className={`add-assignment-container ${loading ? "is-loading" : ""}`}>
      {/* LOADING OVERLAY */}
      {loading && (
        <div className="loading-overlay" role="alert" aria-live="assertive" aria-busy="true">
          <div className="loader" aria-hidden="true" />
          <div className="loading-text">Processing…</div>
          <div className="loading-sub">Please wait while we save your assignment.</div>
        </div>
      )}

      <h2>Add New Assignment</h2>

      <form onSubmit={handleSubmit} className="assignment-form" aria-disabled={loading}>
        <fieldset disabled={loading} style={{ border: "none", padding: 0, margin: 0 }}>
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

          {/* ---------- NEW: Timer (optional) ---------- */}
          <div className="timer-grid">
            <div className="form-group">
              <label htmlFor="windowStart">Start Time (optional)</label>
              <input
                id="windowStart"
                type="datetime-local"
                value={windowStart}
                onChange={(e) => setWindowStart(e.target.value)}
              />
              <small>When this assignment becomes available.</small>
            </div>
            <div className="form-group">
              <label htmlFor="windowEnd">End Time (optional)</label>
              <input
                id="windowEnd"
                type="datetime-local"
                value={windowEnd}
                onChange={(e) => setWindowEnd(e.target.value)}
              />
              <small>When this assignment closes.</small>
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
                    disabled={loading}
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

                  {/* ---- NEW: Adx field ---- */}
                  <div className="form-group">
                    <label htmlFor={`answerAdx-${idx}`}>Adx</label>
                    <input
                      id={`answerAdx-${idx}`}
                      type="text"
                      placeholder="Adx (e.g. principal dx or free text)"
                      value={sub.answerAdx}
                      onChange={(e) => handleSubChange(idx, "answerAdx", e.target.value)}
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
                    disabled={loading}
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
                  disabled={loading}
                />
              </div>
            </div>
          ))}

          <div className="form-actions">
            <button type="button" onClick={addSubAssignment} className="add-sub-btn" disabled={loading}>
              + Add Sub-Assignment
            </button>

            <div className="submit-actions">
              <button
                type="button"
                onClick={() => navigate("/admin/assignments")}
                className="cancel-btn"
                disabled={loading}
              >
                Cancel
              </button>
              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? "Saving…" : "Save Assignment"}
              </button>
            </div>
          </div>
        </fieldset>
      </form>
    </div>
  );
}