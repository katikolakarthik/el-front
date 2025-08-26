// NewAssignments.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { FiBook, FiClock, FiCalendar } from 'react-icons/fi';
import { Worker, Viewer, SpecialZoomLevel } from '@react-pdf-viewer/core';
import '@react-pdf-viewer/core/lib/styles/index.css';
import './AssignmentFlow.css';

const API_BASE = 'https://el-backend-ashen.vercel.app';

/* ================== Robust PDF viewer (handles large PDFs) ================== */
const PdfReader = ({ url, height = '60vh', watermark = '' }) => {
  const [blobUrl, setBlobUrl] = useState('');
  const [err, setErr] = useState('');
  const [viewKey, setViewKey] = useState(0); // force remount on url change
  const currentBlob = useRef('');

  useEffect(() => {
    let abort = false;
    const ctrl = new AbortController();

    (async () => {
      try {
        setErr('');
        setBlobUrl('');
        setViewKey((k) => k + 1);

        // Fetch fully and create a Blob URL — stable for big files & CORS
        const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();

        // Yield once to avoid main-thread stall on huge files
        await new Promise((r) => setTimeout(r, 0));
        if (abort) return;

        const blob = new Blob([buf], { type: 'application/pdf' });
        const bUrl = URL.createObjectURL(blob);
        currentBlob.current = bUrl;
        setBlobUrl(bUrl);
      } catch (e) {
        if (e.name !== 'AbortError') {
          setErr('Unable to load PDF');
        }
      }
    })();

    return () => {
      abort = true;
      ctrl.abort();
      if (currentBlob.current) {
        URL.revokeObjectURL(currentBlob.current);
        currentBlob.current = '';
      }
    };
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
        background: '#fff',
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

      {/* Keep worker compatible with @react-pdf-viewer/core v3.x */}
      <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js">
        {err && (
          <div style={{ padding: 16, color: '#b00020' }}>
            {err}{' '}
            {url && (
              <a href={url} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
                Open PDF in new tab
              </a>
            )}
          </div>
        )}
        {!err && !blobUrl && <div style={{ padding: 16 }}>Loading PDF…</div>}
        {!err && blobUrl && (
          <Viewer
            key={viewKey}
            fileUrl={blobUrl}
            defaultScale={SpecialZoomLevel.PageWidth}
            onDocumentLoadFail={() => setErr('Failed to render PDF')}
          />
        )}
      </Worker>
    </div>
  );
};
/* ========================================================================== */

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

const ms = (d) => (d ? new Date(d).getTime() : 0);

// GLOBAL stable ascending (for lock order across all assignments)
const stableAsc = (arr) =>
  [...arr].sort((a, b) => {
    const da = ms(a.assignedDate), db = ms(b.assignedDate);
    if (da !== db) return da - db;
    const ca = ms(a.createdAt), cb = ms(b.createdAt);
    if (ca !== cb) return ca - cb;
    const na = (a.moduleName || '').localeCompare(b.moduleName || '');
    if (na !== 0) return na;
    return String(a._id || '').localeCompare(String(b._id || ''));
  });

// for display “latest first”
const sortByAssignedDesc = (arr) =>
  [...arr].sort((a, b) => ms(b.assignedDate) - ms(a.assignedDate));

const sameDay = (dStr, ymd) => {
  if (!dStr || !ymd) return false;
  const d = new Date(dStr);
  const [y, m, day] = ymd.split('-').map(Number);
  return d.getFullYear() === y && (d.getMonth() + 1) === m && d.getDate() === day;
};

// priority: unlocked (0) < locked (1) < completed (2)
const statusPriority = (assignment, canStartFn, isAllSubsDoneFn) => {
  if (isAllSubsDoneFn(assignment)) return 2;
  return canStartFn(assignment) ? 0 : 1;
};

const NewAssignments = () => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true); // ONLY for initial fetch
  const [error, setError] = useState(null);

  const [activeAssignment, setActiveAssignment] = useState(null);
  const [activeSubAssignment, setActiveSubAssignment] = useState(null);

  const [answers, setAnswers] = useState({});
  const [selectedDate, setSelectedDate] = useState(''); // filter only
  const [submitting, setSubmitting] = useState(false);  // submit overlay

  const [startingId, setStartingId] = useState(null);   // button-level spinner
  const questionsRef = useRef(null);

  const areAllSubAssignmentsCompleted = (assignment) => {
    if (!assignment?.subAssignments?.length) {
      return Boolean(assignment?.isCompleted);
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

  // ------- VIEW FILTER (date search only) -------
  const filtered = useMemo(() => {
    if (!selectedDate) return assignments;
    return assignments.filter((a) => sameDay(a.assignedDate, selectedDate));
  }, [assignments, selectedDate]);

  // ------- GLOBAL LOCK LOGIC -------
  const globalAscList = useMemo(() => stableAsc(assignments), [assignments]);

  const canStartAssignment = (assignment) => {
    if (areAllSubAssignmentsCompleted(assignment)) return false;
    const idx = globalAscList.findIndex((a) => String(a._id) === String(assignment._id));
    if (idx <= 0) return true;
    for (let i = 0; i < idx; i++) {
      if (!areAllSubAssignmentsCompleted(globalAscList[i])) return false;
    }
    return true;
  };

  // ------- DISPLAY ORDER: Unlocked → Locked → Completed; then latest first -------
  const displayList = useMemo(() => {
    const list = [...filtered];
    return list
      .map((a) => ({ a, p: statusPriority(a, canStartAssignment, areAllSubAssignmentsCompleted) }))
      .sort((x, y) => {
        if (x.p !== y.p) return x.p - y.p;
        const dx = ms(x.a.assignedDate), dy = ms(y.a.assignedDate);
        if (dx !== dy) return dy - dx;
        return String(y.a._id || '').localeCompare(String(x.a._id || ''));
      })
      .map((x) => x.a);
  }, [filtered, canStartAssignment]);

  // sub-sections always sequential
  const canStartSub = (assignment, subIdx) => {
    if (subIdx === 0) return !(assignment.subAssignments?.[0]?.isCompleted);
    for (let i = 0; i < subIdx; i++) {
      if (!assignment.subAssignments[i].isCompleted) return false;
    }
    return !assignment.subAssignments[subIdx].isCompleted;
  };

  const handleStart = async (assignmentId, subAssignmentId = null) => {
    try {
      setStartingId(`${assignmentId}:${subAssignmentId || 'parent'}`);
      setError(null);

      const fromList = assignments.find((a) => String(a._id) === String(assignmentId));
      if (!fromList) throw new Error('Assignment not found in list');
      if (!canStartAssignment(fromList)) throw new Error('Please complete previous assignments to unlock this one');

      const assignmentData = normalizeAssignment(fromList);
      assignmentData.isCompleted = Boolean(fromList.isCompleted);
      if (fromList?.subAssignments?.length) {
        assignmentData.subAssignments = (assignmentData.subAssignments || []).map((sub) => {
          const originalSub = fromList.subAssignments.find((s) => String(s._id) === String(sub._id));
          return { ...sub, isCompleted: originalSub ? originalSub.isCompleted : false };
        });
      }
      setActiveAssignment(assignmentData);

      if (subAssignmentId) {
        const idx = assignmentData.subAssignments.findIndex((s) => String(s._id) === String(subAssignmentId));
        if (!canStartSub(assignmentData, idx)) throw new Error('Complete previous section to unlock this one');
        setActiveSubAssignment(assignmentData.subAssignments[idx] || null);
      } else {
        setActiveSubAssignment(null);
      }

      setAnswers({});

      // smooth scroll to Questions area
      setTimeout(() => {
        questionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      setError(err.message);
    } finally {
      setStartingId(null); // DO NOT toggle global loading here
    }
  };

  const csvToArray = (str = '') => str.split(',').map((s) => s.trim()).filter(Boolean);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
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
      if (!res.data?.success) {
        alert('Failed to submit assignment');
        return;
      }

      // mark completed locally
      if (activeSubAssignment) {
        setActiveAssignment((prev) => {
          if (!prev) return prev;
          const updatedSubs = (prev.subAssignments || []).map((s) =>
            String(s._id) === String(activeSubAssignment._id) ? { ...s, isCompleted: true } : s
          );
          const parentCompleted = updatedSubs.every((s) => s.isCompleted);
          return { ...prev, subAssignments: updatedSubs, isCompleted: parentCompleted || prev.isCompleted };
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

      // Auto-advance inside assignment; if done, go back to list
      if (activeSubAssignment && (activeAssignment.subAssignments || []).length > 0) {
        const idx = activeAssignment.subAssignments.findIndex(
          (sub) => String(sub._id) === String(activeSubAssignment._id)
        );
        if (idx < activeAssignment.subAssignments.length - 1) {
          alert('Submitted. Next section unlocked.');
          setActiveSubAssignment({ ...activeAssignment.subAssignments[idx + 1], isCompleted: false });
          setTimeout(() => {
            questionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 150);
        } else {
          alert('Assignment completed successfully!');
          setActiveSubAssignment(null);
          setActiveAssignment(null);
        }
      } else {
        alert('Assignment submitted successfully!');
        setActiveAssignment(null);
      }
      setAnswers({});
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
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
                      disabled={target.isCompleted || submitting}
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
                disabled={target.isCompleted || submitting}
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
              disabled={target.isCompleted || submitting}
            />
          </div>
          <div className="form-item">
            <label className="label">Age / DOB</label>
            <input
              className="input"
              type="text"
              value={answers.ageOrDob || ''}
              onChange={(e) => handleAnswerChange('ageOrDob', e.target.value)}
              disabled={target.isCompleted || submitting}
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
              disabled={target.isCompleted || submitting}
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
              disabled={target.isCompleted || submitting}
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
              disabled={target.isCompleted || submitting}
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
              disabled={target.isCompleted || submitting}
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
              disabled={target.isCompleted || submitting}
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
              disabled={target.isCompleted || submitting}
            />
          </div>

          <div className="form-item form-item--full">
            <label className="label">Notes</label>
            <textarea
              className="textarea"
              value={answers.notes || ''}
              onChange={(e) => handleAnswerChange('notes', e.target.value)}
              rows={4}
              disabled={target.isCompleted || submitting}
            />
          </div>
        </div>
      );
    }

    return <p className="muted">No questions available for this assignment.</p>;
  };

  // ---------------- UI STATES ----------------
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

  if (error && !activeAssignment) {
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
            <button className="btn btn-ghost" onClick={() => setActiveAssignment(null)} disabled={submitting}>Back</button>
            <h3 className="title-sm">{activeAssignment.moduleName}</h3>
          </div>

          <div className="grid">
            {(() => {
              const withIdx = (activeAssignment.subAssignments || []).map((s, i) => ({ s, i }));
              const subsSorted = withIdx
                .map(({ s, i }) => ({
                  s,
                  i,
                  p: s.isCompleted ? 2 : (canStartSub(activeAssignment, i) ? 0 : 1),
                }))
                .sort((x, y) => x.p - y.p || x.i - y.i);

              return subsSorted.map(({ s, i }) => {
                const disabled = !canStartSub(activeAssignment, i) || submitting;
                const isStarting = startingId === `${activeAssignment._id}:${s._id}`;
                return (
                  <div key={i} className="card sub-card">
                    <div className="card-head">
                      <h4 className="card-title">{s.subModuleName}</h4>
                      <span className={`badge ${s.isCompleted ? 'badge-success' : disabled ? 'badge-neutral' : 'badge-pending'}`}>
                        {s.isCompleted ? 'Completed' : disabled ? 'Locked' : 'Pending'}
                      </span>
                    </div>
                    <div className="card-actions">
                      <button
                        className="btn"
                        onClick={() => handleStart(activeAssignment._id, s._id)}
                        disabled={disabled || isStarting}
                      >
                        {isStarting ? 'Opening…' : s.isCompleted ? 'Completed' : disabled ? 'Locked' : 'Start'}
                      </button>
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {submitting && <LoadingOverlay />}
        </div>
      );
    }

    const pdfUrl = activeSubAssignment?.assignmentPdf || activeAssignment.assignmentPdf;
    const questionSource = activeSubAssignment || activeAssignment;
    const isCompleted = questionSource.isCompleted;
    const isStartingParent = startingId === `${activeAssignment._id}:parent`;

    return (
      <div className="container">
        <div className="page-header">
          <button
            className="btn btn-ghost"
            onClick={() => (activeSubAssignment ? setActiveSubAssignment(null) : setActiveAssignment(null))}
            disabled={submitting}
          >
            Back
          </button>
  <h3 className="title-sm">{activeSubAssignment?.subModuleName || activeAssignment.moduleName}</h3>
        </div>

        {pdfUrl && <PdfReader url={pdfUrl} height="60vh" watermark="" />}

        <div ref={questionsRef} className="panel">
          <div className="panel-head">
            <h4>Questions</h4>
            {isCompleted && <span className="badge badge-success">Completed</span>}
          </div>
          <div className="panel-body">{renderQuestions(questionSource)}</div>
          <div className="panel-actions">
            <button className="btn btn-primary" onClick={handleSubmit} disabled={isCompleted || submitting || isStartingParent}>
              {isCompleted ? 'Already Submitted' : (submitting ? 'Submitting…' : 'Submit Assignment')}
            </button>
          </div>
        </div>

        {submitting && <LoadingOverlay />}
      </div>
    );
  }

  // --------------- CARDS VIEW ---------------
  return (
    <div className="container">
      <div className="page-header">
        <h2 className="title"><FiBook className="icon" /> New Assignments</h2>
      </div>

      {/* Date Picker (filter only) */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head" style={{ gap: 12, alignItems: 'center' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiCalendar /> Select Date (optional)
          </h4>
        </div>
        <div className="panel-body" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="date"
            className="input"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setActiveAssignment(null);
              setActiveSubAssignment(null);
            }}
            style={{ maxWidth: 220 }}
            disabled={submitting}
          />
          {selectedDate && (
            <button className="btn btn-ghost" onClick={() => setSelectedDate('')} disabled={submitting}>Clear</button>
          )}
          <span className="muted">Date is for search/filter only. Locking is global.</span>
        </div>
      </div>

      {displayList.length > 0 ? (
        <div className="grid">
          {displayList.map((assignment) => {
            const allSubsCompleted = areAllSubAssignmentsCompleted(assignment);
            const locked = !canStartAssignment(assignment) || submitting;
            const isStarting = startingId === `${assignment._id}:parent`;

            return (
              <div key={assignment._id} className="card">
                <div className="card-head">
                  <h3 className="card-title">{assignment.moduleName}</h3>
                  <span className={`badge ${
                    allSubsCompleted ? 'badge-success' : locked ? 'badge-neutral' : 'badge-pending'
                  }`}>
                    {allSubsCompleted ? 'Completed' : locked ? 'Locked' : 'Assigned'}
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
                  <button
                    className="btn"
                    onClick={() => handleStart(assignment._id)}
                    disabled={locked || isStarting}
                  >
                    {isStarting ? 'Opening…' : allSubsCompleted ? 'Completed' : locked ? 'Locked' : (assignment.subAssignments?.length > 0 ? 'View Sections' : 'Start')}
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
            <h3>No assignments{selectedDate ? ' for this date' : ''}</h3>
            <p className="muted">{selectedDate ? 'Try another date or clear the filter.' : 'Please check back later.'}</p>
          </div>
        </div>
      )}

      {submitting && <LoadingOverlay />}
    </div>
  );
};

// Full-screen loading overlay
const LoadingOverlay = () => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(255,255,255,0.7)',
      backdropFilter: 'blur(2px)',
      display: 'grid',
      placeItems: 'center',
      zIndex: 9999,
    }}
  >
    <div style={{ padding: 16, borderRadius: 12, border: '1px solid #ddd', background: '#fff', minWidth: 220, textAlign: 'center' }}>
      <div className="spinner" style={{ width: 28, height: 28, margin: '0 auto 10px', border: '3px solid #ddd', borderTopColor: '#333', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <div style={{ fontWeight: 600 }}>Submitting…</div>
      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Please wait</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  </div>
);

export default NewAssignments;