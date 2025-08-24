// NewAssignments.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FiBook, FiClock } from 'react-icons/fi';
import { Worker, Viewer, SpecialZoomLevel } from '@react-pdf-viewer/core';
import '@react-pdf-viewer/core/lib/styles/index.css';
import './AssignmentFlow.css';

const API_BASE = 'http://localhost:5000';

/* --------- Lightweight PDF viewer (no toolbar, no download) ---------- */
const PdfReader = ({ url, height = '60vh', watermark = '' }) => {
  const [fileData, setFileData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        setErr('');
        setFileData(null);
        // Fetch as ArrayBuffer so the browser doesn't open its native PDF viewer
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        setFileData(new Uint8Array(buf));
      } catch (e) {
        if (e.name !== 'AbortError') setErr('Unable to load PDF');
      }
    })();
    return () => ctrl.abort();
  }, [url]);

  return (
    <div
      style={{
        position: 'relative',
        height,
        border: '1px solid #eee',
        borderRadius: 8,
        overflow: 'hidden',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {watermark && (
        <div
          style={{
            pointerEvents: 'none',
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            opacity: 0.08,
            fontSize: 28,
            fontWeight: 700,
            textAlign: 'center',
          }}
        >
          {watermark}
        </div>
      )}

      <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
        {err && <div style={{ padding: 16, color: '#b00020' }}>{err}</div>}
        {!fileData && !err && <div style={{ padding: 16 }}>Loading PDF…</div>}
        {fileData && (
          <Viewer fileUrl={fileData} defaultScale={SpecialZoomLevel.PageWidth} />
        )}
      </Worker>
    </div>
  );
};
/* --------------------------------------------------------------------- */

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
      return { ...sub, questions: sub.dynamicQuestions.map((q) => ({ ...q, type: 'dynamic' })) };
    } else if (sub.answerKey) {
      return { ...sub, questions: [{ type: 'predefined', answerKey: sub.answerKey }] };
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

  const areAllSubAssignmentsCompleted = (assignment) => {
    if (!assignment.subAssignments || assignment.subAssignments.length === 0) {
      return assignment.isCompleted || false;
    }
    return assignment.subAssignments.every((sub) => sub.isCompleted);
  };

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        setLoading(true);
        setError(null);

        const userId = localStorage.getItem('userId');
        if (!userId) throw new Error('User ID not found');

        const courseResp = await axios.get(`${API_BASE}/student/${userId}/course`);
        const courseName =
          courseResp?.data?.courseName ||
          courseResp?.data?.course?.name ||
          courseResp?.data?.course?.courseName || null;
        if (!courseName) throw new Error('Course name not found for this student');

        const asgResp = await axios.get(
          `${API_BASE}/category/${encodeURIComponent(courseName)}?studentId=${userId}`
        );

        let assignmentsData = [];
        if (asgResp?.data?.success && Array.isArray(asgResp.data.assignments)) {
          assignmentsData = asgResp.data.assignments;
        } else if (Array.isArray(asgResp?.data)) {
          assignmentsData = asgResp.data;
        } else if (Array.isArray(asgResp?.data?.data)) {
          assignmentsData = asgResp.data.data;
        } else if (asgResp?.data?.assignment) {
          assignmentsData = [asgResp.data.assignment];
        }

        setAssignments(sortByAssignedDesc(assignmentsData));
      } catch (err) {
        if (err.response?.status === 404) setAssignments([]);
        else setError(err?.message || 'Failed to fetch assignments');
      } finally {
        setLoading(false);
      }
    };
    fetchAssignments();
  }, []);

  const formatDate = (dateString) =>
    dateString
      ? new Date(dateString).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
      : '—';

  const handleStart = async (assignmentId, subAssignmentId = null) => {
    try {
      setLoading(true);
      setError(null);
      const fromList = assignments.find((a) => String(a._id) === String(assignmentId));
      if (!fromList) throw new Error('Assignment not found in list');
      const assignmentData = normalizeAssignment(fromList);
      assignmentData.isCompleted = fromList.isCompleted || false;
      if (fromList && Array.isArray(fromList.subAssignments)) {
        assignmentData.subAssignments = (assignmentData.subAssignments || []).map((sub) => {
          const originalSub = fromList.subAssignments.find((s) => String(s._id) === String(sub._id));
          return { ...sub, isCompleted: originalSub ? originalSub.isCompleted : false };
        });
      }
      setActiveAssignment(assignmentData);
      if (subAssignmentId) {
        const sub = (assignmentData.subAssignments || []).find((s) => String(s._id) === String(subAssignmentId));
        setActiveSubAssignment(sub || null);
      } else setActiveSubAssignment(null);
      setAnswers({});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const csvToArray = (str = '') => str.split(',').map((s) => s.trim()).filter(Boolean);

  const handleSubmit = async () => {
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) throw new Error('User ID not found');

      const payload = { studentId: userId, assignmentId: activeAssignment._id, submittedAnswers: [] };
      const buildDynamic = (qs, prefix = 'dynamic') =>
        qs.map((q, idx) => ({ questionText: q.questionText, submittedAnswer: answers[`${prefix}-${idx}`] || '' }));
      const buildPredefinedPayload = () => ({
        patientName: answers.patientName || '',
        ageOrDob: answers.ageOrDob || '',
        icdCodes: csvToArray(answers.icdCodes || ''),
        cptCodes: csvToArray(answers.cptCodes || ''),
        pcsCodes: csvToArray(answers.pcsCodes || ''),
        hcpcsCodes: csvToArray(answers.hcpcsCodes || ''),
        drgValue: answers.drgValue || '',
        modifiers: csvToArray(answers.modifiers || ''),
        notes: answers.notes || '',
      });

      if (activeSubAssignment) {
        if ((activeSubAssignment.questions || []).some((q) => q.type === 'dynamic')) {
          payload.submittedAnswers.push({
            subAssignmentId: activeSubAssignment._id,
            dynamicQuestions: buildDynamic(activeSubAssignment.questions, 'dynamic'),
          });
        } else {
          payload.submittedAnswers.push({ subAssignmentId: activeSubAssignment._id, ...buildPredefinedPayload() });
        }
      } else {
        if ((activeAssignment.questions || []).some((q) => q.type === 'dynamic')) {
          payload.submittedAnswers.push({ dynamicQuestions: buildDynamic(activeAssignment.questions, 'dynamic') });
        } else {
          payload.submittedAnswers.push({ ...buildPredefinedPayload() });
        }
      }

      const res = await axios.post(`${API_BASE}/student/submit-assignment`, payload);
      if (!res.data?.success) return alert('Failed to submit assignment');

      if (activeSubAssignment) {
        setActiveAssignment((prev) => {
          if (!prev) return prev;
          const updatedSubs = (prev.subAssignments || []).map((s) =>
            String(s._id) === String(activeSubAssignment._id) ? { ...s, isCompleted: true } : s
          );
          return { ...prev, subAssignments: updatedSubs };
        });
        setActiveSubAssignment((prev) => (prev ? { ...prev, isCompleted: true } : prev));
      } else {
        setActiveAssignment((prev) => (prev ? { ...prev, isCompleted: true } : prev));
      }

      // refresh list (best effort)
      try {
        const courseResp2 = await axios.get(`${API_BASE}/student/${userId}/course`);
        const courseName2 =
          courseResp2?.data?.courseName || courseResp2?.data?.course?.name || courseResp2?.data?.course?.courseName;
        if (courseName2) {
          const asgResp2 = await axios.get(
            `${API_BASE}/category/${encodeURIComponent(courseName2)}?studentId=${userId}`
          );
          let refreshed = [];
          if (asgResp2?.data?.success && Array.isArray(asgResp2.data.assignments)) refreshed = asgResp2.data.assignments;
          else if (Array.isArray(asgResp2?.data)) refreshed = asgResp2.data;
          else if (Array.isArray(asgResp2?.data?.data)) refreshed = asgResp2.data.data;
          else if (asgResp2?.data?.assignment) refreshed = [asgResp2.data.assignment];
          setAssignments(sortByAssignedDesc(refreshed));
        }
      } catch {}

      if (activeSubAssignment && (activeAssignment.subAssignments || []).length > 0) {
        const idx = activeAssignment.subAssignments.findIndex(
          (sub) => String(sub._id) === String(activeSubAssignment._id)
        );
        if (idx < activeAssignment.subAssignments.length - 1) {
          alert('Assignment submitted successfully..wait for next');
          setActiveSubAssignment(activeAssignment.subAssignments[idx + 1]);
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

  const handleAnswerChange = (key, value) => setAnswers((p) => ({ ...p, [key]: value }));

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
                      disabled={target.isCompleted}
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
                disabled={target.isCompleted}
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
              disabled={target.isCompleted}
            />
          </div>
          <div className="form-item">
            <label className="label">Age / DOB</label>
            <input
              className="input"
              type="text"
              value={answers.ageOrDob || ''}
              onChange={(e) => handleAnswerChange('ageOrDob', e.target.value)}
              disabled={target.isCompleted}
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
              disabled={target.isCompleted}
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
              disabled={target.isCompleted}
            />
          </div>

          <div className="form-item">
            <label className="label">PCS Codes</label>
            <input
              className="input"
              type="text"
              value={answers.pcsCodes || ''}
              onChange={(e) => handleAnswerChange('pcsCodes', e.target.value)}
              placeholder="Comma separated"
              disabled={target.isCompleted}
            />
          </div>

          <div className="form-item">
            <label className="label">HCPCS Codes</label>
            <input
              className="input"
              type="text"
              value={answers.hcpcsCodes || ''}
              onChange={(e) => handleAnswerChange('hcpcsCodes', e.target.value)}
              placeholder="Comma separated"
              disabled={target.isCompleted}
            />
          </div>

          <div className="form-item">
            <label className="label">DRG Value</label>
            <input
              className="input"
              type="text"
              value={answers.drgValue || ''}
              onChange={(e) => handleAnswerChange('drgValue', e.target.value)}
              placeholder="e.g. 470 or 470-xx"
              disabled={target.isCompleted}
            />
          </div>

          <div className="form-item">
            <label className="label">Modifiers</label>
            <input
              className="input"
              type="text"
              value={answers.modifiers || ''}
              onChange={(e) => handleAnswerChange('modifiers', e.target.value)}
              placeholder="Comma separated (e.g. 26, 59, LT)"
              disabled={target.isCompleted}
            />
          </div>

          <div className="form-item form-item--full">
            <label className="label">Notes</label>
            <textarea
              className="textarea"
              value={answers.notes || ''}
              onChange={(e) => handleAnswerChange('notes', e.target.value)}
              rows={4}
              disabled={target.isCompleted}
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
        <div className="skeleton-list">{[...Array(3)].map((_, i) => <div className="skeleton-card" key={i} />)}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="empty-state error">
          <div className="empty-icon"><FiClock /></div>
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
            <button className="btn btn-ghost" onClick={() => setActiveAssignment(null)}>Back</button>
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
                  <button className="btn" onClick={() => handleStart(activeAssignment._id, sub._id)} disabled={sub.isCompleted}>
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
    const isCompleted = questionSource.isCompleted;

    return (
      <div className="container">
        <div className="page-header">
          <button
            className="btn btn-ghost"
            onClick={() => (activeSubAssignment ? setActiveSubAssignment(null) : setActiveAssignment(null))}
          >
            Back
          </button>
          <h3 className="title-sm">{activeSubAssignment?.subModuleName || activeAssignment.moduleName}</h3>
        </div>

        {/* PDF VIEWER (no download UI) */}
        {pdfUrl && (
          <PdfReader
            url={pdfUrl}           // works with Cloudinary
            height="60vh"
            watermark=""           // add a message if you want
          />
        )}

        <div className="panel">
          <div className="panel-head">
            <h4>Questions</h4>
            {isCompleted && <span className="badge badge-success">Completed</span>}
          </div>
          <div className="panel-body">{renderQuestions(questionSource)}</div>
          <div className="panel-actions">
            <button className="btn btn-primary" onClick={handleSubmit} disabled={isCompleted}>
              {isCompleted ? 'Already Submitted' : 'Submit Assignment'}
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
        <h2 className="title"><FiBook className="icon" /> New Assignments</h2>
      </div>

      {assignments.length > 0 ? (
        <div className="grid">
          {assignments.map((assignment, index) => {
            const allSubsCompleted = areAllSubAssignmentsCompleted(assignment);
            const isParentDisabled = assignment.subAssignments?.length > 0 ? allSubsCompleted : assignment.isCompleted;

            return (
              <div key={index} className="card">
                <div className="card-head">
                  <h3 className="card-title">{assignment.moduleName}</h3>
                  <span className={`badge ${isParentDisabled ? 'badge-success' : 'badge-neutral'}`}>
                    {isParentDisabled ? 'Completed' : 'Assigned'}
                  </span>
                </div>

                <div className="meta">
                  <span className="meta-key">Assigned</span>
                  <span className="meta-val">{formatDate(assignment.assignedDate)}</span>
                </div>

                {assignment.subAssignments?.length > 0 && (
                  <div className="meta">
                    <span className="meta-key">Progress</span>
                    <span className="meta-val">
                      {assignment.subAssignments.filter((sub) => sub.isCompleted).length} / {assignment.subAssignments.length} completed
                    </span>
                  </div>
                )}

                <div className="card-actions">
                  <button className="btn" onClick={() => handleStart(assignment._id)} disabled={isParentDisabled}>
                    {isParentDisabled ? 'Completed' : assignment.subAssignments?.length > 0 ? 'View Sections' : 'Start'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon"><FiClock /></div>
          <div>
            <h3>No assignments are available</h3>
            <p className="muted">Please check back later for new assignments.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewAssignments;
