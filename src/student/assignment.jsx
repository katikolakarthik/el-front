import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FiBook, FiClock } from 'react-icons/fi';
import './AssignmentFlow.css';

const API_BASE = "https://el-backend-ashen.vercel.app";

const normalizeAssignment = (raw) => {
  const norm = { ...raw };
  // parent-level questions (if any)
  if (Array.isArray(norm.dynamicQuestions) && norm.dynamicQuestions.length > 0) {
    norm.questions = norm.dynamicQuestions.map(q => ({ ...q, type: 'dynamic' }));
  } else if (norm.answerKey) {
    norm.questions = [{ type: 'predefined', answerKey: norm.answerKey }];
  } else {
    norm.questions = norm.questions || [];
  }

  // sub-assignments
  norm.subAssignments = (norm.subAssignments || []).map(sub => {
    if (Array.isArray(sub.dynamicQuestions) && sub.dynamicQuestions.length > 0) {
      return {
        ...sub,
        questions: sub.dynamicQuestions.map(q => ({ ...q, type: 'dynamic' })),
      };
    } else if (sub.answerKey) {
      return {
        ...sub,
        questions: [{ type: 'predefined', answerKey: sub.answerKey }],
      };
    }
    return { ...sub, questions: sub.questions || [] };
  });

  return norm;
};

const NewAssignments = () => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeAssignment, setActiveAssignment] = useState(null);
  const [activeSubAssignment, setActiveSubAssignment] = useState(null);
  const [answers, setAnswers] = useState({});

  // Fetch assignments list (cards view)
  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const userId = localStorage.getItem('userId');
        if (!userId) throw new Error('User ID not found');

        const response = await axios.get(`${API_BASE}/assignments/student/${userId}`);
        if (response.data?.success) {
          const assignmentsData = Array.isArray(response.data.assignments)
            ? response.data.assignments
            : [response.data.assignment].filter(Boolean);
          setAssignments(assignmentsData);
        } else {
          throw new Error('Failed to fetch assignments');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAssignments();
  }, []);

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  // Start assignment or sub-assignment (detail view)
  const handleStart = async (assignmentId, subAssignmentId = null) => {
    try {
      const userId = localStorage.getItem('userId');
      setLoading(true);

      const response = await axios.get(`${API_BASE}/assignments/${assignmentId}/student/${userId}`);
      if (!response.data?.success) throw new Error('Failed to fetch assignment details');

      // Normalize the fetched assignment
      let assignmentData = normalizeAssignment(response.data.assignment);

      // 🔁 Merge isCompleted flags from the list view (source of truth for completion)
      const listCopy = assignments.find(a => a._id === assignmentId);
      if (listCopy && Array.isArray(listCopy.subAssignments)) {
        const completeMap = new Map(listCopy.subAssignments.map(s => [String(s._id), !!s.isCompleted]));
        assignmentData.subAssignments = (assignmentData.subAssignments || []).map(sub => ({
          ...sub,
          isCompleted: typeof sub.isCompleted === 'boolean'
            ? sub.isCompleted
            : (completeMap.get(String(sub._id)) ?? false),
        }));
      }

      setActiveAssignment(assignmentData);

      if (subAssignmentId) {
        const sub = assignmentData.subAssignments.find(s => s._id === subAssignmentId);
        setActiveSubAssignment(sub || null);
      } else {
        setActiveSubAssignment(null);
      }

      setAnswers({});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Submit assignment/sub-assignment
  const handleSubmit = async () => {
    try {
      const userId = localStorage.getItem("userId");
      if (!userId) throw new Error("User ID not found");

      const payload = {
        studentId: userId,
        assignmentId: activeAssignment._id,
        submittedAnswers: []
      };

      const buildDynamic = (qs, prefix = 'dynamic') =>
        qs.map((q, idx) => ({
          questionText: q.questionText,
          submittedAnswer: answers[`${prefix}-${idx}`] || ""
        }));

      if (activeSubAssignment) {
        if (activeSubAssignment.questions.some(q => q.type === "dynamic")) {
          payload.submittedAnswers.push({
            subAssignmentId: activeSubAssignment._id,
            dynamicQuestions: buildDynamic(activeSubAssignment.questions, 'dynamic'),
          });
        } else {
          payload.submittedAnswers.push({
            subAssignmentId: activeSubAssignment._id,
            patientName: answers.patientName || "",
            ageOrDob: answers.ageOrDob || "",
            icdCodes: (answers.icdCodes || "").split(",").map(s => s.trim()).filter(Boolean),
            cptCodes: (answers.cptCodes || "").split(",").map(s => s.trim()).filter(Boolean),
            notes: answers.notes || ""
          });
        }
      } else {
        if (activeAssignment.questions.some(q => q.type === "dynamic")) {
          payload.submittedAnswers.push({
            dynamicQuestions: buildDynamic(activeAssignment.questions, 'dynamic'),
          });
        } else {
          payload.submittedAnswers.push({
            patientName: answers.patientName || "",
            ageOrDob: answers.ageOrDob || "",
            icdCodes: (answers.icdCodes || "").split(",").map(s => s.trim()).filter(Boolean),
            cptCodes: (answers.cptCodes || "").split(",").map(s => s.trim()).filter(Boolean),
            notes: answers.notes || ""
          });
        }
      }

      const res = await axios.post(`${API_BASE}/student/submit-assignment`, payload);
      if (!res.data?.success) {
        alert("Failed to submit assignment");
        return;
      }

      // ✅ Instant local flip to Completed (no wait)
      if (activeSubAssignment) {
        setActiveAssignment(prev => {
          if (!prev) return prev;
          const updatedSubs = (prev.subAssignments || []).map(s =>
            s._id === activeSubAssignment._id ? { ...s, isCompleted: true } : s
          );
          return { ...prev, subAssignments: updatedSubs };
        });
        setActiveSubAssignment(prev => prev ? { ...prev, isCompleted: true } : prev);
      } else {
        setActiveAssignment(prev => (prev ? { ...prev, isCompleted: true } : prev));
      }

      // 🔄 Also refresh the top-level list so cards view stays in sync
      const refresh = await axios.get(`${API_BASE}/assignments/student/${userId}`);
      if (refresh.data?.success) {
        const refreshedData = Array.isArray(refresh.data.assignments)
          ? refresh.data.assignments
          : [refresh.data.assignment].filter(Boolean);
        setAssignments(refreshedData);
      }

      // Navigation behavior after submit
      if (activeSubAssignment && activeAssignment.subAssignments?.length > 0) {
        const currentIndex = activeAssignment.subAssignments.findIndex(
          (sub) => sub._id === activeSubAssignment._id
        );
        if (currentIndex < activeAssignment.subAssignments.length - 1) {
          alert("Assignment submitted successfully..wait for next");
          const nextSub = activeAssignment.subAssignments[currentIndex + 1];
          setActiveSubAssignment(nextSub);
        } else {
          alert("Assignment completed successfully!");
          setActiveSubAssignment(null);
        }
      } else {
        alert("Assignment submitted successfully!");
        setActiveAssignment(null);
      }

      setAnswers({});
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handleAnswerChange = (key, value) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
  };

  const renderQuestions = (target) => {
    if (!target) return null;

    const qs = target.questions || [];
    const dynamicQs = qs.filter(q => q.type === "dynamic");

    if (dynamicQs.length > 0) {
      return dynamicQs.map((q, idx) => {
        const key = `dynamic-${idx}`;
        return (
          <div key={idx} className="question-block">
            <p><strong>{q.questionText}</strong></p>
            {q.options && q.options.length > 0 ? (
              q.options.map((opt, i) => (
                <label key={i}>
                  <input
                    type="radio"
                    name={`q${idx}`}
                    value={opt}
                    checked={answers[key] === opt}
                    onChange={(e) => handleAnswerChange(key, e.target.value)}
                  /> {opt}
                </label>
              ))
            ) : (
              <input
                type="text"
                placeholder="Enter your answer"
                value={answers[key] || ""}
                onChange={(e) => handleAnswerChange(key, e.target.value)}
              />
            )}
          </div>
        );
      });
    }

    // Predefined
    const predefined = qs.find(q => q.type === 'predefined');
    if (predefined && predefined.answerKey) {
      return (
        <>
          <div className="question-block">
            <label>Patient Name:</label>
            <input
              type="text"
              value={answers.patientName || ""}
              onChange={(e) => handleAnswerChange("patientName", e.target.value)}
            />
          </div>
          <div className="question-block">
            <label>Age / DOB:</label>
            <input
              type="text"
              value={answers.ageOrDob || ""}
              onChange={(e) => handleAnswerChange("ageOrDob", e.target.value)}
            />
          </div>
          <div className="question-block">
            <label>ICD Codes:</label>
            <input
              type="text"
              value={answers.icdCodes || ""}
              onChange={(e) => handleAnswerChange("icdCodes", e.target.value)}
              placeholder="Enter ICD codes (comma separated)"
            />
          </div>
          <div className="question-block">
            <label>CPT Codes:</label>
            <input
              type="text"
              value={answers.cptCodes || ""}
              onChange={(e) => handleAnswerChange("cptCodes", e.target.value)}
              placeholder="Enter CPT codes (comma separated)"
            />
          </div>
          <div className="question-block">
            <label>Notes:</label>
            <textarea
              value={answers.notes || ""}
              onChange={(e) => handleAnswerChange("notes", e.target.value)}
            />
          </div>
        </>
      );
    }

    return <p>No questions available for this assignment.</p>;
  };

  if (loading) {
    return <div className="assignments-loading"><p>Loading assignments...</p></div>;
  }

  if (error) {
    return <div className="assignments-error"><p>Error: {error}</p></div>;
  }

  // Detail view
  if (activeAssignment) {
    // List of sub-assignments
    if (!activeSubAssignment && activeAssignment.subAssignments?.length > 0) {
      return (
        <div className="assignment-detail">
          <button onClick={() => setActiveAssignment(null)}>Back</button>
          <h3>{activeAssignment.moduleName}</h3>

          <div className="subassignments-list">
            {activeAssignment.subAssignments.map((sub, idx) => (
              <div key={idx} className="subassignment-item">
                <div className="subassignment-content">
                  <h4>{sub.subModuleName}</h4>
                  {sub.assignmentPdf && (
                    <a href={sub.assignmentPdf} target="_blank" rel="noopener noreferrer">View PDF</a>
                  )}
                </div>
                <button
                  onClick={() => handleStart(activeAssignment._id, sub._id)}
                  disabled={Boolean(sub.isCompleted)}
                >
                  {sub.isCompleted ? "Completed" : "Start"}
                </button>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Specific assignment/sub-assignment
    const pdfUrl = activeSubAssignment?.assignmentPdf || activeAssignment.assignmentPdf;
    const questionSource = activeSubAssignment || activeAssignment;

    return (
      <div className="assignment-detail">
        <button onClick={() => {
          if (activeSubAssignment) {
            setActiveSubAssignment(null);
          } else {
            setActiveAssignment(null);
          }
        }}>Back</button>
        <h3>{activeSubAssignment?.subModuleName || activeAssignment.moduleName}</h3>

        {pdfUrl && (
          <iframe
            src={`https://docs.google.com/gview?url=${encodeURIComponent(pdfUrl)}&embedded=true`}
            width="100%" height="500px" frameBorder="0" title="Assignment PDF"
          ></iframe>
        )}

        <div className="questions-section">
          <h4>Questions</h4>
          {renderQuestions(questionSource)}
        </div>

        <button
          className="submit-button"
          onClick={handleSubmit}
          disabled={Boolean(activeSubAssignment?.isCompleted || activeAssignment?.isCompleted)}
        >
          {activeSubAssignment?.isCompleted || activeAssignment?.isCompleted
            ? "Already Submitted"
            : "Submit Assignment"}
        </button>
      </div>
    );
  }

  // Cards view
  return (
    <div className="new-assignments-container">
      <h2 className="assignments-header"><FiBook /> New Assignments</h2>

      {assignments.length > 0 ? (
        <div className="assignments-list">
          {assignments.map((assignment, index) => (
            <div key={index} className="assignment-item">
              <div className="assignment-content">
                <h3>{assignment.moduleName}</h3>
                <p>Assigned on: {formatDate(assignment.assignedDate)}</p>
                {assignment.assignmentPdf && (
                  <a href={assignment.assignmentPdf} target="_blank" rel="noopener noreferrer">View PDF</a>
                )}
              </div>

              <button
                onClick={() => handleStart(assignment._id)}
                disabled={Boolean(assignment.isCompleted)}
              >
                {assignment.isCompleted
                  ? "Completed"
                  : assignment.subAssignments?.length > 0
                    ? "View Sections"
                    : "Start"}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="no-assignments"><FiClock /><p>No new assignments available</p></div>
      )}
    </div>
  );
};

export default NewAssignments;