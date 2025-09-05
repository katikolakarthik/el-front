// NewAssignments.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { FiBook, FiClock, FiSearch, FiFilter } from 'react-icons/fi';
import { Worker, Viewer, SpecialZoomLevel } from '@react-pdf-viewer/core';
import '@react-pdf-viewer/core/lib/styles/index.css';
import './AssignmentFlow.css';

const API_BASE = 'https://el-backend-ashen.vercel.app';

// Category list (reference)
const CATEGORY_OPTIONS = ["CPC", "CCS", "IP-DRG", "SURGERY", "Denials", "ED", "E and M"];

/* ================== Robust PDF viewer (handles large PDFs) ================== */
const PdfReader = ({ url, height = '60vh', watermark = '' }) => {
  const [blobUrl, setBlobUrl] = useState('');
  const [err, setErr] = useState('');
  const [viewKey, setViewKey] = useState(0);
  const currentBlob = useRef('');

  useEffect(() => {
    let abort = false;
    const ctrl = new AbortController();

    (async () => {
      try {
        setErr('');
        setBlobUrl('');
        setViewKey((k) => k + 1);

        const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        await new Promise((r) => setTimeout(r, 0));
        if (abort) return;

        const blob = new Blob([buf], { type: 'application/pdf' });
        const bUrl = URL.createObjectURL(blob);
        currentBlob.current = bUrl;
        setBlobUrl(bUrl);
      } catch (e) {
        if (e.name !== 'AbortError') setErr('Unable to load PDF');
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
      <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
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

// Format countdown mm:ss (or HH:MM:SS if long)
const fmtCountdown = (msLeft) => {
  if (msLeft < 0) msLeft = 0;
  const totalSec = Math.floor(msLeft / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

// ---- Minutes-based timer persistence keys ----
const startKey = (assignmentId) => `asgStart:${assignmentId}`;
const getStartTime = (assignmentId) => {
  const v = localStorage.getItem(startKey(assignmentId));
  const n = v ? Number(v) : null;
  return Number.isFinite(n) ? n : null;
};
const setStartTime = (assignmentId, ts) => {
  localStorage.setItem(startKey(assignmentId), String(ts));
};
const clearStartTime = (assignmentId) => {
  localStorage.removeItem(startKey(assignmentId));
};

// ---- Category-based visibility helpers ----
const catU = (category) => (category || '').toUpperCase();

// Field visibility for predefined path by category
const fieldVisible = (field, category) => {
  const c = catU(category);

  // IP-DRG: hide CPT, HCPCS, Modifiers
  if (c === 'IP-DRG' || c === 'IPDRG') {
    if (['cptCodes', 'hcpcsCodes', 'modifiers'].includes(field)) return false;
  }

  // CPC: hide PCS, Patient Name, Age/DOB, DRG
  if (c === 'CPC') {
    if (['pcsCodes', 'patientName', 'ageOrDob', 'drgValue'].includes(field)) return false;
  }

  return true;
};

const NewAssignments = () => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeAssignment, setActiveAssignment] = useState(null);
  const [activeSubAssignment, setActiveSubAssignment] = useState(null);

  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [search, setSearch] = useState('');              // search query
  const [sortOrder, setSortOrder] = useState('newest');  // 'newest' | 'oldest'

  const [countdown, setCountdown] = useState(null); // ms left (auto-submit at 0)
  const timerRef = useRef(null);
  const autoSubmittingRef = useRef(false);
  const questionsRef = useRef(null);

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

        setAssignments(assignmentsData);
      } catch (err) {
        if (err.response?.status === 404) setAssignments([]);
        else setError(err?.message || 'Failed to fetch assignments');
      } finally {
        setLoading(false);
      }
    };
    fetchAssignments();
  }, []);

  // ------- SEARCH FILTER -------
  const searchLower = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!searchLower) return assignments;
    return assignments.filter((a) => {
      const mod = (a.moduleName || '').toLowerCase();
      const subMatch = (a.subAssignments || []).some((s) =>
        (s.subModuleName || '').toLowerCase().includes(searchLower)
      );
      return mod.includes(searchLower) || subMatch;
    });
  }, [assignments, searchLower]);

  // ------- DATE SORT (Newest/Oldest) -------
  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const da = ms(a.assignedDate), db = ms(b.assignedDate);
      return sortOrder === 'newest' ? db - da : da - db;
    });
    return list;
  }, [filtered, sortOrder]);

  const areAllSubAssignmentsCompleted = (assignment) => {
    if (!assignment?.subAssignments?.length) return Boolean(assignment?.isCompleted);
    return assignment.subAssignments.every((sub) => sub.isCompleted);
  };

  const handleStart = async (assignmentId, subAssignmentId = null) => {
    try {
      setError(null);

      const fromList = assignments.find((a) => String(a._id) === String(assignmentId));
      if (!fromList) throw new Error('Assignment not found in list');

      const assignmentData = normalizeAssignment(fromList);
      assignmentData.isCompleted = Boolean(fromList.isCompleted);
      if (fromList?.subAssignments?.length) {
        assignmentData.subAssignments = (assignmentData.subAssignments || []).map((sub) => {
          const originalSub = fromList.subAssignments.find((s) => String(s._id) === String(sub._id));
          return { ...sub, isCompleted: originalSub ? originalSub.isCompleted : false };
        });
      }

      // Minutes-based timer: set start if not already set
      if (assignmentData.timeLimitMinutes && !getStartTime(assignmentData._id)) {
        setStartTime(assignmentData._id, Date.now());
      }

      setActiveAssignment(assignmentData);

      if (subAssignmentId) {
        const idx = assignmentData.subAssignments.findIndex((s) => String(s._id) === String(subAssignmentId));
        setActiveSubAssignment(assignmentData.subAssignments[idx] || null);
      } else {
        setActiveSubAssignment(null);
      }

      setAnswers({});
      initCountdown(assignmentData);

      setTimeout(() => {
        questionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      setError(err.message);
    }
  };

  // ---------------- TIMER: init + tick + auto-submit (minutes-based) ----------------
  const clearCountdown = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCountdown(null);
  };

  const initCountdown = (assignmentLike) => {
    clearCountdown();

    const limitMin = Number(assignmentLike?.timeLimitMinutes);
    if (!Number.isFinite(limitMin) || limitMin <= 0) return; // no limit => no countdown

    const startTs = getStartTime(assignmentLike._id);
    if (!startTs) return; // timer starts when handleStart wrote it; if absent, no countdown

    const endTs = startTs + limitMin * 60 * 1000;

    const now = Date.now();
    if (now >= endTs) {
      setCountdown(0);
      triggerAutoSubmit();
      return;
    }

    setCountdown(endTs - now);
    timerRef.current = setInterval(() => {
      const left = endTs - Date.now();
      if (left <= 0) {
        clearCountdown();
        setCountdown(0);
        triggerAutoSubmit();
      } else {
        setCountdown(left);
      }
    }, 500);
  };

  const triggerAutoSubmit = async () => {
    if (autoSubmittingRef.current) return;
    autoSubmittingRef.current = true;
    try {
      const src = activeSubAssignment || activeAssignment;
      if (!src || src.isCompleted) return;
      await handleSubmit(true); // silent auto-submit
    } finally {
      autoSubmittingRef.current = false;
    }
  };

  useEffect(() => {
    return () => clearCountdown();
  }, []);

  const csvToArray = (str = '') => str.split(',').map((s) => s.trim()).filter(Boolean);

  const handleSubmit = async (isAuto = false) => {
    try {
      setSubmitting(true);
      const userId = localStorage.getItem('userId');
      if (!userId) throw new Error('User ID not found');

      const payload = { studentId: userId, assignmentId: activeAssignment._id, submittedAnswers: [] };
      const buildDynamic = (qs, prefix = 'dynamic') =>
        qs.map((q, idx) => ({ questionText: q.questionText, submittedAnswer: answers[`${prefix}-${idx}`] || '' }));

      // Build predefined payload but strip fields hidden by category
      const buildPredefinedPayload = () => {
        const category = activeAssignment?.category || '';
        const obj = {
          patientName: answers.patientName || '',
          ageOrDob: answers.ageOrDob || '',
          icdCodes: csvToArray(answers.icdCodes || ''),
          cptCodes: csvToArray(answers.cptCodes || ''),
          pcsCodes: csvToArray(answers.pcsCodes || ''),
          hcpcsCodes: csvToArray(answers.hcpcsCodes || ''),
          drgValue: answers.drgValue || '',
          modifiers: csvToArray(answers.modifiers || ''),
          notes: answers.notes || '',
          adx: answers.adx || '',
        };
        Object.keys(obj).forEach((key) => {
          if (!fieldVisible(key, category)) delete obj[key];
        });
        return obj;
      };

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
        if (!isAuto) alert(res.data?.message || 'Failed to submit assignment');
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

      // Clear timer token for this assignment when fully completed
      const afterClearIfDone = (assignmentLike) => {
        const done =
          !assignmentLike?.subAssignments?.length ||
          (assignmentLike.subAssignments || []).every((s) => s.isCompleted);
        if (done) clearStartTime(assignmentLike._id);
      };

      // refresh cards best-effort
      try {
        const userId2 = localStorage.getItem('userId');
        const courseResp2 = await axios.get(`${API_BASE}/student/${userId2}/course`);
        const courseName2 =
          courseResp2?.data?.courseName || courseResp2?.data?.course?.name || courseResp2?.data?.course?.courseName;
        if (courseName2) {
          const asgResp2 = await axios.get(
            `${API_BASE}/category/${encodeURIComponent(courseName2)}?studentId=${userId2}`
          );
          let refreshed = [];
          if (asgResp2?.data?.success && Array.isArray(asgResp2.data.assignments)) refreshed = asgResp2.data.assignments;
          else if (Array.isArray(asgResp2?.data)) refreshed = asgResp2.data;
          else if (Array.isArray(asgResp2?.data?.data)) refreshed = asgResp2.data.data;
          else if (asgResp2?.data?.assignment) refreshed = [asgResp2.data.assignment];
          setAssignments(refreshed);
        }
      } catch {}

      if (!isAuto) {
        if (activeSubAssignment && (activeAssignment.subAssignments || []).length > 0) {
          const idx = activeAssignment.subAssignments.findIndex(
            (sub) => String(sub._id) === String(activeSubAssignment._id)
          );
          if (idx < activeAssignment.subAssignments.length - 1) {
            alert('Submitted. You can open any other section now.');
            setActiveSubAssignment({ ...activeAssignment.subAssignments[idx + 1], isCompleted: false });
            setTimeout(() => {
              questionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 150);
          } else {
            alert('Assignment completed successfully!');
            afterClearIfDone({ ...activeAssignment, subAssignments: activeAssignment.subAssignments.map((s) =>
              String(s._id) === String(activeSubAssignment._id) ? { ...s, isCompleted: true } : s
            ) });
            setActiveSubAssignment(null);
            setActiveAssignment(null);
            clearCountdown();
          }
        } else {
          alert('Assignment submitted successfully!');
          afterClearIfDone(activeAssignment);
          setActiveAssignment(null);
          clearCountdown();
        }
      } else {
        afterClearIfDone(activeAssignment);
        setActiveAssignment(null);
        setActiveSubAssignment(null);
        clearCountdown();
      }
      setAnswers({});
    } catch (err) {
      if (!isAuto) alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnswerChange = (key, value) => setAnswers((p) => ({ ...p, [key]: value }));

  // Minutes-based status badges
  const renderTimeLimitMeta = (a) => {
    const mins = Number(a?.timeLimitMinutes);
    if (!Number.isFinite(mins) || mins <= 0) return '—';
    const started = Boolean(getStartTime(a._id));
    return started ? 'In progress' : `Time limit: ${mins} min`;
  };

  const renderCountdownChip = (assignmentLike) => {
    const mins = Number(assignmentLike?.timeLimitMinutes);
    if (!Number.isFinite(mins) || mins <= 0) return null;
    const showCountdown = countdown !== null && countdown >= 0;
    if (!showCountdown) return null;
    return (
      <div className="countdown-chip">
        <FiClock /> <span>{fmtCountdown(countdown)}</span>
      </div>
    );
  };
const renderQuestions = (target) => {
    if (!target) return null;
    const qs = target.questions || [];
    const dynamicQs = qs.filter((q) => q.type === 'dynamic');
    const category = activeAssignment?.category || '';

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
          {fieldVisible('patientName', category) && (
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
          )}

          {fieldVisible('ageOrDob', category) && (
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
          )}

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

          {fieldVisible('cptCodes', category) && (
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
          )}

          {fieldVisible('pcsCodes', category) && (
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
          )}

          {fieldVisible('hcpcsCodes', category) && (
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
          )}

          {fieldVisible('drgValue', category) && (
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
          )}

          {fieldVisible('modifiers', category) && (
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
          )}

          <div className="form-item">
            <label className="label">Adx</label>
            <input
              className="input"
              type="text"
              value={answers.adx || ''}
              onChange={(e) => handleAnswerChange('adx', e.target.value)}
              placeholder="Adx (e.g., principal diagnosis / free text)"
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
            <button className="btn btn-ghost" onClick={() => { setActiveAssignment(null); clearCountdown(); }} disabled={submitting}>Back</button>
            <h3 className="title-sm">{activeAssignment.moduleName}</h3>
            <div style={{ marginLeft: 'auto' }}>
              <span className="badge badge-neutral">{renderTimeLimitMeta(activeAssignment)}</span>
            </div>
          </div>

          <div className="grid">
            {(activeAssignment.subAssignments || []).map((s, i) => {
              const disabled = s.isCompleted; // ✅ Only block if already completed
              return (
                <div key={i} className="card sub-card">
                  <div className="card-head">
                    <h4 className="card-title">{s.subModuleName}</h4>
                    <span className={`badge ${s.isCompleted ? 'badge-success' : 'badge-pending'}`}>
                      {s.isCompleted ? 'Completed' : 'Pending'}
                    </span>
                  </div>
                  <div className="card-actions">
                    <button
                      className="btn"
                      onClick={() => handleStart(activeAssignment._id, s._id)}
                      disabled={disabled}
                    >
                      {s.isCompleted ? 'Completed' : 'Start'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {submitting && <LoadingOverlay />}
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
            onClick={() => { activeSubAssignment ? setActiveSubAssignment(null) : setActiveAssignment(null); clearCountdown(); }}
            disabled={submitting}
          >
            Back
          </button>
          <h3 className="title-sm">{activeSubAssignment?.subModuleName || activeAssignment.moduleName}</h3>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="badge badge-neutral">{renderTimeLimitMeta(activeAssignment)}</span>
            {renderCountdownChip(activeAssignment)}
          </div>
        </div>

        {pdfUrl && <PdfReader url={pdfUrl} height="60vh" watermark="" />}

        <div ref={questionsRef} className="panel">
          <div className="panel-head">
            <h4>Questions</h4>
            {isCompleted && <span className="badge badge-success">Completed</span>}
          </div>

          {/* User can attempt any time; backend enforces rules if any. */}
          <div className="panel-body">{renderQuestions(questionSource)}</div>
          <div className="panel-actions">
            <button className="btn btn-primary" onClick={() => handleSubmit(false)} disabled={isCompleted || submitting}>
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

      {/* Search + Date sort controls */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiSearch /> Search
          </h4>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiFilter />
            <select
              className="input"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              style={{ width: 180 }}
              disabled={submitting}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
        </div>
        <div className="panel-body" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="input"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setActiveAssignment(null);
              setActiveSubAssignment(null);
            }}
            placeholder="Search by module or section name…"
            style={{ maxWidth: 360 }}
            disabled={submitting}
          />
          {search && (
            <button className="btn btn-ghost" onClick={() => setSearch('')} disabled={submitting}>Clear</button>
          )}
          <span className="muted">Sort controls affect date; search filters the view.</span>
        </div>
      </div>

      {sorted.length > 0 ? (
        <div className="grid">
          {sorted.map((assignment) => {
            const allSubsCompleted = areAllSubAssignmentsCompleted(assignment);
            return (
              <div key={assignment._id} className="card">
                <div className="card-head">
                  <h3 className="card-title">{assignment.moduleName}</h3>
                  <span className={`badge ${allSubsCompleted ? 'badge-success' : 'badge-pending'}`}>
                    {allSubsCompleted ? 'Completed' : 'Assigned'}
                  </span>
                </div>

                {/* Time limit status */}
                <div className="meta">
                  <span className="meta-key">Status</span>
                  <span className="meta-val">
                    {renderTimeLimitMeta(assignment)}
                  </span>
                </div>

                <div className="meta">
                  <span className="meta-key">Category</span>
                  <span className="meta-val">{assignment.category || '—'}</span>
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
                    disabled={allSubsCompleted}  // ✅ Only block if ALL done
                  >
                    {allSubsCompleted ? 'Completed' : (assignment.subAssignments?.length > 0 ? 'View Sections' : 'Start')}
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
            <h3>No assignments found</h3>
            <p className="muted">Try a different search.</p>
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
      <div
        className="spinner"
        style={{
          width: 28,
          height: 28,
          margin: '0 auto 10px',
          border: '3px solid '#ddd',
          borderTopColor: '#333',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      <div style={{ fontWeight: 600 }}>Submitting…</div>
      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Please wait</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  </div>
);

export default NewAssignments;