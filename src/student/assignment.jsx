import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { FiBook, FiClock } from 'react-icons/fi';
import './AssignmentFlow.css';

const API_BASE = 'https://el-backend-ashen.vercel.app';

const normalizeAssignment = (raw) => {
  const norm = { ...raw };

  if (Array.isArray(norm.dynamicQuestions) && norm.dynamicQuestions.length > 0) {
    norm.questions = norm.dynamicQuestions.map((q) => ({ ...q, type: 'dynamic' }));
  } else if (norm.answerKey) {
    norm.questions = [{ type: 'predefined', answerKey: norm.answerKey }];
  } else {
    norm.questions = norm.questions || [];
  }

  norm.subAssignments = (norm.subAssignments || []).map((sub) => {
    if (Array.isArray(sub.dynamicQuestions) && sub.dynamicQuestions.length > 0) {
      return {
        ...sub,
        questions: sub.dynamicQuestions.map((q) => ({ ...q, type: 'dynamic' })),
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

const sortByAssignedDesc = (arr) =>
  [...arr].sort(
    (a, b) => new Date(b?.assignedDate || 0).getTime() - new Date(a?.assignedDate || 0).getTime()
  );

const NewAssignments = () => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeAssignment, setActiveAssignment] = useState(null);
  const [activeSubAssignment, setActiveSubAssignment] = useState(null);
  const [answers, setAnswers] = useState({});

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

          setAssignments(sortByAssignedDesc(assignmentsData));
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
    dateString
      ? new Date(dateString).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : '—';

  const handleStart = async (assignmentId, subAssignmentId = null) => {
    try {
      const userId = localStorage.getItem('userId');
      setLoading(true);

      const response = await axios.get(`${API_BASE}/assignments/${assignmentId}/student/${userId}`);
      if (!response.data?.success) throw new Error('Failed to fetch assignment details');

      let assignmentData = normalizeAssignment(response.data.assignment);

      // merge completion flags from list view
      const listCopy = assignments.find((a) => a._id === assignmentId);
      if (listCopy && Array.isArray(listCopy.subAssignments)) {
        const completeMap = new Map(listCopy.subAssignments.map((s) => [String(s._id), !!s.isCompleted]));
        assignmentData.subAssignments = (assignmentData.subAssignments || []).map((sub) => ({
          ...sub,
          isCompleted:
            typeof sub.isCompleted === 'boolean' ? sub.isCompleted : completeMap.get(String(sub._id)) ?? false,
        }));
      }

      setActiveAssignment(assignmentData);

      if (subAssignmentId) {
        const sub = assignmentData.subAssignments.find((s) => s._id === subAssignmentId);
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

  const handleSubmit = async () => {
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) throw new Error('User ID not found');

      const payload = {
        studentId: userId,
        assignmentId: activeAssignment._id,
        submittedAnswers: [],
      };

      const buildDynamic = (qs, prefix = 'dynamic') =>
        qs.map((q, idx) => ({
          questionText: q.questionText,
          submittedAnswer: answers[`${prefix}-${idx}`] || '',
        }));

      if (activeSubAssignment) {
        if (activeSubAssignment.questions.some((q) => q.type === 'dynamic')) {
          payload.submittedAnswers.push({
            subAssignmentId: activeSubAssignment._id,
            dynamicQuestions: buildDynamic(activeSubAssignment.questions, 'dynamic'),
          });
        } else {
          payload.submittedAnswers.push({
            subAssignmentId: activeSubAssignment._id,
            patientName: answers.patientName || '',
            ageOrDob: answers.ageOrDob || '',
            icdCodes: (answers.icdCodes || '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
            cptCodes: (answers.cptCodes || '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
            notes: answers.notes || '',
          });
        }
      } else {
        if (activeAssignment.questions.some((q) => q.type === 'dynamic')) {
          payload.submittedAnswers.push({
            dynamicQuestions: buildDynamic(activeAssignment.questions, 'dynamic'),
          });
        } else {
          payload.submittedAnswers.push({
            patientName: answers.patientName || '',
            ageOrDob: answers.ageOrDob || '',
            icdCodes: (answers.icdCodes || '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
            cptCodes: (answers.cptCodes || '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
            notes: answers.notes || '',
          });
        }
      }

      const res = await axios.post(`${API_BASE}/student/submit-assignment`, payload);
      if (!res.data?.success) {
        alert('Failed to submit assignment');
        return;
      }

      if (activeSubAssignment) {
        setActiveAssignment((prev) => {
          if (!prev) return prev;
          const updatedSubs = (prev.subAssignments || []).map((s) =>
            s._id === activeSubAssignment._id ? { ...s, isCompleted: true } : s
          );
          return { ...prev, subAssignments: updatedSubs };
        });
        setActiveSubAssignment((prev) => (prev ? { ...prev, isCompleted: true } : prev));
      } else {
        setActiveAssignment((prev) => (prev ? { ...prev, isCompleted: true } : prev));
      }

      // refresh list + keep newest on top
      const refresh = await axios.get(`${API_BASE}/assignments/student/${userId}`);
      if (refresh.data?.success) {
        const refreshedData = Array.isArray(refresh.data.assignments)
          ? refresh.data.assignments
          : [refresh.data.assignment].filter(Boolean);
        setAssignments(sortByAssignedDesc(refreshedData));
      }

      if (activeSubAssignment && activeAssignment.subAssignments?.length > 0) {
        const currentIndex = activeAssignment.subAssignments.findIndex(
          (sub) => sub._id === activeSubAssignment._id
        );
        if (currentIndex < activeAssignment.subAssignments.length - 1) {
          alert('Assignment submitted successfully..wait for next');
          const nextSub = activeAssignment.subAssignments[currentIndex + 1];
          setActiveSubAssignment(nextSub);
        } else {
          alert('Assignment completed successfully!');
          setActiveSubAssignment(null);
        }
      } else {
        alert('Assignment submitted successfully!');
        setActiveAssignment(null);
      }

      setAnswers({});
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleAnswerChange = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const renderQuestions = (target) => {
    if (!target) return null;

    const qs = target.questions || [];
    const dynamicQs = qs.filter((q) => q.type === 'dynamic');

    if (dynamicQs.length > 0) {
      return dynamicQs.map((q, idx) => {
        const key = `dynamic-${idx}`;
        return (
          <div key={idx} className="q-block">
            <p className="q-title">{q.questionText}</p>
            {q.options && q.options.length > 0 ? (
              <div className="q-options">
                {q.options.map((opt, i) => (
                  <label key={i} className="q-option">
                    <input
                      type="radio"
                      name={`q${idx}`}
                      value={opt}
                      checked={answers[key] === opt}
                      onChange={(e) => handleAnswerChange(key, e.target.value)}
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            ) : (
              <input
                className="input"
                type="text"
                placeholder="Type your answer"
                value={answers[key] || ''}
                onChange={(e) => handleAnswerChange(key, e.target.value)}
              />
            )}
          </div>
        );
      });
    }

    const predefined = qs.find((q) => q.type === 'predefined');
    if (predefined && predefined.answerKey) {
      return (
        <div className="form-grid">
          <div className="form-item">
            <label className="label">Patient Name</label>
            <input
              className="input"
              type="text"
              value={answers.patientName || ''}
              onChange={(e) => handleAnswerChange('patientName', e.target.value)}
            />
          </div>
          <div className="form-item">
            <label className="label">Age / DOB</label>
            <input
              className="input"
              type="text"
              value={answers.ageOrDob || ''}
              onChange={(e) => handleAnswerChange('ageOrDob', e.target.value)}
            />
          </div>
          <div className="form-item">
            <label className="label">ICD Codes</label>
            <input
              className="input"
              type="text"
              value={answers.icdCodes || ''}
              onChange={(e) => handleAnswerChange('icdCodes', e.target.value)}
              placeholder="Comma separated"
            />
          </div>
          <div className="form-item">
            <label className="label">CPT Codes</label>
            <input
              className="input"
              type="text"
              value={answers.cptCodes || ''}
              onChange={(e) => handleAnswerChange('cptCodes', e.target.value)}
              placeholder="Comma separated"
            />
          </div>
          <div className="form-item form-item--full">
            <label className="label">Notes</label>
            <textarea
              className="textarea"
              value={answers.notes || ''}
              onChange={(e) => handleAnswerChange('notes', e.target.value)}
              rows={4}
            />
          </div>
        </div>
      );
    }

    return <p className="muted">No questions available for this assignment.</p>;
  };

  if (loading) {
    return (
      <div className="container">
        <div className="page-header">
          <h2 className="title">
            <FiBook className="icon" /> New Assignments
          </h2>
        </div>
        <div className="skeleton-list">
          {[...Array(3)].map((_, i) => (
            <div className="skeleton-card" key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="empty-state error">
          <div className="empty-icon">
            <FiClock />
          </div>
          <div>
            <h3>Something went wrong</h3>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // DETAIL VIEW
  if (activeAssignment) {
    if (!activeSubAssignment && activeAssignment.subAssignments?.length > 0) {
      return (
        <div className="container">
          <div className="page-header">
            <button className="btn btn-ghost" onClick={() => setActiveAssignment(null)}>
              Back
            </button>
            <h3 className="title-sm">{activeAssignment.moduleName}</h3>
          </div>

          <div className="grid">
            {activeAssignment.subAssignments.map((sub, idx) => (
              <div key={idx} className="card sub-card">
                <div className="card-head">
                  <h4 className="card-title">{sub.subModuleName}</h4>
                  <span className={`badge ${sub.isCompleted ? 'badge-success' : 'badge-neutral'}`}>
                    {sub.isCompleted ? 'Completed' : 'Pending'}
                  </span>
                </div>

                <div className="card-actions">
                  <button
                    className="btn"
                    onClick={() => handleStart(activeAssignment._id, sub._id)}
                    disabled={Boolean(sub.isCompleted)}
                  >
                    {sub.isCompleted ? 'Completed' : 'Start'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    const pdfUrl = activeSubAssignment?.assignmentPdf || activeAssignment.assignmentPdf;
    const questionSource = activeSubAssignment || activeAssignment;

    return (
      <div className="container">
        <div className="page-header">
          <button
            className="btn btn-ghost"
            onClick={() => {
              if (activeSubAssignment) {
                setActiveSubAssignment(null);
              } else {
                setActiveAssignment(null);
              }
            }}
          >
            Back
          </button>
          <h3 className="title-sm">{activeSubAssignment?.subModuleName || activeAssignment.moduleName}</h3>
        </div>

        
        {pdfUrl && (
          <iframe
            src={`https://docs.google.com/gview?url=${encodeURIComponent(pdfUrl)}&embedded=true`}
            width="100%" height="500px" frameBorder="0" title="Assignment PDF"
          ></iframe>
        )}


        <div className="panel">
          <div className="panel-head">
            <h4>Questions</h4>
          </div>
          <div className="panel-body">{renderQuestions(questionSource)}</div>

          <div className="panel-actions">
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={Boolean(activeSubAssignment?.isCompleted || activeAssignment?.isCompleted)}
            >
              {activeSubAssignment?.isCompleted || activeAssignment?.isCompleted
                ? 'Already Submitted'
                : 'Submit Assignment'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // CARDS VIEW
  return (
    <div className="container">
      <div className="page-header">
        <h2 className="title">
          <FiBook className="icon" /> New Assignments
        </h2>
      </div>

      {assignments.length > 0 ? (
        <div className="grid">
          {assignments.map((assignment, index) => (
            <div key={index} className="card">
              <div className="card-head">
                <h3 className="card-title">{assignment.moduleName}</h3>
                <span className={`badge ${assignment.isCompleted ? 'badge-success' : 'badge-neutral'}`}>
                  {assignment.isCompleted ? 'Completed' : 'Assigned'}
                </span>
              </div>

              <div className="meta">
                <span className="meta-key">Assigned</span>
                <span className="meta-val">{formatDate(assignment.assignedDate)}</span>
              </div>

              <div className="card-actions">
                <button
                  className="btn"
                  onClick={() => handleStart(assignment._id)}
                  disabled={Boolean(assignment.isCompleted)}
                >
                  {assignment.isCompleted
                    ? 'Completed'
                    : assignment.subAssignments?.length > 0
                    ? 'View Sections'
                    : 'Start'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">
            <FiClock />
          </div>
          <div>
            <h3>No new assignments</h3>
            <p className="muted">You’ll see new items here when assigned.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewAssignments;