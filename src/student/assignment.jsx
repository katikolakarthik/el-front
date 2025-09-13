// NewAssignments.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { FiBook, FiClock, FiSearch, FiFilter, FiCheck, FiX } from 'react-icons/fi';
import { Worker, Viewer, SpecialZoomLevel } from '@react-pdf-viewer/core';
import '@react-pdf-viewer/core/lib/styles/index.css';
import './AssignmentFlow.css';

const API_BASE = 'https://el-backend-ashen.vercel.app';


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

      {/* IMPORTANT: restore the Worker wrapper with a stable workerUrl */}
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
const fmtCountdown = (msLeft) => {
  if (msLeft < 0) msLeft = 0;
  const totalSec = Math.floor(msLeft / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

const showField = (category, field) => {
  if (category === 'IP-DRG' && ['cptCodes', 'hcpcsCodes', 'modifiers'].includes(field)) return false;
  if (category === 'CPC' && ['pcsCodes', 'patientName', 'ageOrDob', 'drgValue'].includes(field)) return false;
  return true;
};

const getTimeLimitMinutes = (assignment, sub) => {
  if (sub && Number.isFinite(Number(sub.timeLimitMinutes))) return Number(sub.timeLimitMinutes);
  if (Number.isFinite(Number(assignment?.timeLimitMinutes))) return Number(assignment.timeLimitMinutes);
  return null;
};

const makeTimerKey = (userId, assignmentId, subId) => `asgTimer:${userId}:${assignmentId}:${subId || 'parent'}`;

const getOrStartTimerEnd = (userId, assignment, sub) => {
  const minutes = getTimeLimitMinutes(assignment, sub);
  if (!minutes || minutes <= 0) return null;
  
  const key = makeTimerKey(userId, assignment._id, sub?._id);
  const stored = localStorage.getItem(key);
  
  if (stored) {
    const endMs = Number(stored);
    if (Number.isFinite(endMs) && endMs > 0) return endMs;
  }
  
  const end = Date.now() + minutes * 60 * 1000;
  localStorage.setItem(key, String(end));
  return end;
};

const clearTimerKey = (userId, assignmentId, subId) => {
  const key = makeTimerKey(userId, assignmentId, subId);
  localStorage.removeItem(key);
};

const arrEq = (a = [], b = []) =>
  Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => String(x).trim() === String(b[i]).trim());

const asArray = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return String(v).split(',').map((s) => s.trim()).filter(Boolean);
};

const chip = (text, tone = 'neutral', title = '') => {
  const bg = tone === 'good' ? '#eaf7ed' : tone === 'bad' ? '#fdeceb' : '#f3f4f6';
  const bd = tone === 'good' ? '#bfe6c7' : tone === 'bad' ? '#f3c1bf' : '#e5e7eb';
  const col = tone === 'good' ? '#1b5e20' : tone === 'bad' ? '#7f1d1d' : '#374151';
  
  return (
    <span title={title} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 999, fontSize: 12, background: bg, border: `1px solid ${bd}`, color: col, lineHeight: 1, marginRight: 6, marginBottom: 6 }}>
      {text}
    </span>
  );
};

const NewAssignments = () => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeAssignment, setActiveAssignment] = useState(null);
  const [activeSubAssignment, setActiveSubAssignment] = useState(null);

  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [startingId, setStartingId] = useState(null);
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');

  const [countdown, setCountdown] = useState(null); // ms left; drives UI & fail-safe
  const [timerEndMs, setTimerEndMs] = useState(null);
  const timerRef = useRef(null);
  const autoSubmittingRef = useRef(false);
  const questionsRef = useRef(null);

  const [resultLoading, setResultLoading] = useState(false);
  const [resultError, setResultError] = useState('');
  const [viewResult, setViewResult] = useState(null);

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        setLoading(true); setError(null);
        const userId = localStorage.getItem('userId');
        if (!userId) throw new Error('User ID not found');
        
        const courseResp = await axios.get(`${API_BASE}/student/${userId}/course`);
        const courseName = courseResp?.data?.courseName || courseResp?.data?.course?.name || courseResp?.data?.course?.courseName || null;
        if (!courseName) throw new Error('Course name not found for this student');
        
        const asgResp = await axios.get(`${API_BASE}/category/${encodeURIComponent(courseName)}?studentId=${userId}`);
        let assignmentsData = [];
        
        if (asgResp?.data?.success && Array.isArray(asgResp.data.assignments)) assignmentsData = asgResp.data.assignments;
        else if (Array.isArray(asgResp?.data)) assignmentsData = asgResp.data;
        else if (Array.isArray(asgResp?.data?.data)) assignmentsData = asgResp.data.data;
        else if (asgResp?.data?.assignment) assignmentsData = [asgResp.data.assignment];
        
        setAssignments(assignmentsData);
      } catch (err) {
        if (err.response?.status === 404) setAssignments([]);
        else setError(err?.message || 'Failed to fetch assignments');
      } finally { setLoading(false); }
    };
    
    fetchAssignments();
  }, []);

  const searchLower = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!searchLower) return assignments;
    return assignments.filter((a) => {
      const mod = (a.moduleName || '').toLowerCase();
      const subMatch = (a.subAssignments || []).some((s) => (s.subModuleName || '').toLowerCase().includes(searchLower));
      return mod.includes(searchLower) || subMatch;
    });
  }, [assignments, searchLower]);
  
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
    return assignment.subAssignments.every((s) => s.isCompleted);
  };

  const fetchResultForView = async (studentId, assignmentId) => {
    setResultLoading(true); setResultError(''); setViewResult(null);
    try {
      const { data } = await axios.post(`${API_BASE}/result`, { studentId, assignmentId });
      if (!data) throw new Error('No result data');
      setViewResult(data);
    } catch (e) {
      setResultError(e?.response?.data?.message || e.message);
    } finally { setResultLoading(false); }
  };

  const handleStart = async (assignmentId, subAssignmentId = null) => {
    try {
      setStartingId(`${assignmentId}:${subAssignmentId || 'parent'}`); setError('');
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
      
      setActiveAssignment(assignmentData);

      let selectedSub = null; 
      if (subAssignmentId) { 
        const idx = assignmentData.subAssignments.findIndex((s) => String(s._id) === String(subAssignmentId)); 
        selectedSub = assignmentData.subAssignments[idx] || null; 
        setActiveSubAssignment(selectedSub); 
      } else { 
        setActiveSubAssignment(null); 
      } 
      
      setAnswers({}); 
      setViewResult(null); 
      setResultError(''); 
      setResultLoading(false); 
      
      const userId = localStorage.getItem('userId');
      const isAlreadyDone = selectedSub ? selectedSub.isCompleted : assignmentData.isCompleted;
      
      if (!isAlreadyDone) {
        const endMs = getOrStartTimerEnd(userId, assignmentData, selectedSub);
        if (endMs) initCountdown(endMs);
        else clearCountdown();
      } else {
        clearCountdown();
        await fetchResultForView(userId, assignmentData._id);
      }
      
      setTimeout(() => {
        questionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      setError(err.message);
    } finally {
      setStartingId(null);
    }
  };

  const clearCountdown = () => {
    if (timerRef.current) { 
      clearInterval(timerRef.current); 
      timerRef.current = null; 
    }
    setCountdown(null); 
    setTimerEndMs(null);
  };

  // Fixed auto-submit function
  const triggerAutoSubmit = async () => {
    // Prevent multiple submissions
    if (autoSubmittingRef.current || submitting) return;
    autoSubmittingRef.current = true;
    
    try {
      // Check if we're in a valid state for submission
      const src = activeSubAssignment || activeAssignment;
      if (!src || src.isCompleted) return;
      
      // Submit the assignment
      await handleSubmit();
    } catch (error) {
      console.error('Auto-submit error:', error);
    } finally {
      autoSubmittingRef.current = false;
    }
  };

  const initCountdown = (endMs) => {
    clearCountdown(); 
    if (!endMs) return;
    
    setTimerEndMs(endMs);
    
    const tick = () => {
      const left = endMs - Date.now();
      if (left <= 0) {
        setCountdown(0); // fail-safe effect will submit
        clearInterval(timerRef.current);
        timerRef.current = null;
      } else {
        setCountdown(left);
      }
    };
    
    tick(); 
    timerRef.current = setInterval(tick, 500);
  };

  useEffect(() => {
    return () => clearCountdown();
  }, []);

  // Failsafe: if countdown reaches zero for any reason, auto-submit once.
  useEffect(() => {
    if (countdown === 0) {
      triggerAutoSubmit();
    }
  }, [countdown]); 

  const csvToArray = (str = '') => str.split(',').map((s) => s.trim()).filter(Boolean);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      const userId = localStorage.getItem('userId');
      if (!userId) throw new Error('User ID not found');
      if (!activeAssignment || !activeAssignment._id) { 
        setSubmitting(false); 
        return; 
      }

      const payload = { 
        studentId: userId, 
        assignmentId: activeAssignment._id, 
        submittedAnswers: [] 
      }; 
      
      const buildDynamic = (qs, prefix = 'dynamic') => 
        qs.map((q, idx) => ({ 
          questionText: q.questionText, 
          submittedAnswer: answers[`${prefix}-${idx}`] || '' 
        }));
      
      const buildPredefinedPayload = () => {
        const category = activeAssignment?.category;
        const base = { 
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
        
        const filtered = {};
        Object.entries(base).forEach(([k, v]) => {
          if (showField(category, k) || k === 'notes' || k === 'adx') filtered[k] = v;
        });
        
        return filtered;
      };
      
      if (activeSubAssignment) {
        if ((activeSubAssignment.questions || []).some((q) => q.type === 'dynamic')) {
          payload.submittedAnswers.push({
            subAssignmentId: activeSubAssignment._id,
            dynamicQuestions: buildDynamic(activeSubAssignment.questions, 'dynamic')
          });
        } else {
          payload.submittedAnswers.push({
            subAssignmentId: activeSubAssignment._id,
            ...buildPredefinedPayload()
          });
        }
      } else {
        if ((activeAssignment.questions || []).some((q) => q.type === 'dynamic')) {
          payload.submittedAnswers.push({
            dynamicQuestions: buildDynamic(activeAssignment.questions, 'dynamic')
          });
        } else {
          payload.submittedAnswers.push({
            ...buildPredefinedPayload()
          });
        }
      }
      
      const res = await axios.post(`${API_BASE}/student/submit-assignment`, payload);
      if (!res.data?.success) {
        alert(res.data?.message || 'Failed to submit assignment');
        return;
      }
      
      if (activeSubAssignment) {
        setActiveAssignment((prev) => {
          if (!prev) return prev;
          const updatedSubs = (prev.subAssignments || []).map((s) => 
            String(s._id) === String(activeSubAssignment._id) ? 
            { ...s, isCompleted: true } : s
          );
          
          const parentCompleted = updatedSubs.every((s) => s.isCompleted);
          return { ...prev, subAssignments: updatedSubs, isCompleted: parentCompleted || prev.isCompleted };
        });
        
        setActiveSubAssignment((prev) => (prev ? { ...prev, isCompleted: true } : prev));
        clearTimerKey(userId, activeAssignment._id, activeSubAssignment._id);
      } else {
        setActiveAssignment((prev) => (prev ? { ...prev, isCompleted: true } : prev));
        clearTimerKey(userId, activeAssignment._id, null);
      }
      
      // Refresh list quietly
      try {
        const userId2 = localStorage.getItem('userId');
        const courseResp2 = await axios.get(`${API_BASE}/student/${userId2}/course`);
        const courseName2 = courseResp2?.data?.courseName || courseResp2?.data?.course?.name || courseResp2?.data?.course?.courseName;
        
        if (courseName2) {
          const asgResp2 = await axios.get(`${API_BASE}/category/${encodeURIComponent(courseName2)}?studentId=${userId2}`);
          let refreshed = [];
          
          if (asgResp2?.data?.success && Array.isArray(asgResp2.data.assignments)) refreshed = asgResp2.data.assignments;
          else if (Array.isArray(asgResp2?.data)) refreshed = asgResp2.data;
          else if (Array.isArray(asgResp2?.data?.data)) refreshed = asgResp2.data.data;
          else if (asgResp2?.data?.assignment) refreshed = [asgResp2.data.assignment];
          
          setAssignments(refreshed);
        }
      } catch (err) {
        console.error('Failed to refresh assignments:', err);
      }
      
      // Success message
      alert('Assignment submitted successfully!');
      
      const userId3 = localStorage.getItem('userId');
      await fetchResultForView(userId3, activeAssignment._id);
      setAnswers({});
      clearCountdown();
      
      // If sub-assignments exist, move or close
      if (activeSubAssignment && (activeAssignment.subAssignments || []).length > 0) {
        const idx = activeAssignment.subAssignments.findIndex((sub) => 
          String(sub._id) === String(activeSubAssignment._id)
        );
        
        if (idx < activeAssignment.subAssignments.length - 1) {
          setActiveSubAssignment({ ...activeAssignment.subAssignments[idx + 1], isCompleted: false });
          setTimeout(() => {
            questionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 150);
        } else {
          setActiveSubAssignment(null);
          setActiveAssignment(null);
        }
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnswerChange = (key, value) => setAnswers((p) => ({ ...p, [key]: value }));

  const timerBadge = (a, sub = null) => {
    const minutes = getTimeLimitMinutes(a, sub);
    if (!minutes) return null;
    if (countdown === 0) return 'Time up';
    return `Timed (${minutes}m)`;
  };

  const pickResultBlock = (target) => {
    if (!viewResult || !viewResult.data) return null;
    const type = viewResult.assignmentType || 'single';
    
    if (type === 'single') return viewResult.data;
    if (!activeSubAssignment) return null;
    
    const arr = Array.isArray(viewResult.data) ? viewResult.data : [];
    let blk = arr.find(b => String(b?.submitted?.subAssignmentId) === String(activeSubAssignment._id));
    if (!blk) blk = arr.find(b => (b?.subModuleName || '').toLowerCase() === (activeSubAssignment?.subModuleName || '').toLowerCase());
    
    return blk || null;
  };

  const renderDynamicViewOnly = (resultBlock) => {
    if (!resultBlock) return null;
    const submittedDyn = resultBlock.submitted?.dynamicQuestions || [];
    const corrList = resultBlock.correctDynamicQuestions || [];
    const correctMap = new Map(corrList.map(q => [q.questionText, q.answer]));

    const toRender = submittedDyn.length ? submittedDyn : []; 
    return toRender.map((q, idx) => {
      const qText = q.questionText;
      const options = q.options || [];
      const submittedAnswer = q.submittedAnswer ?? '';
      const correctAnswer = correctMap.get(qText) ?? q.correctAnswer ?? '';
      const isCorrect = String(submittedAnswer) === String(correctAnswer);
      
      return (
        <div key={idx} className="q-block">
          <p className="q-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {qText} {isCorrect ? chip('Correct', 'good', 'Your answer is correct') : chip('Wrong', 'bad', 'Your answer is wrong')}
          </p>
          <div className="q-options">
            {options.map((opt, i) => {
              const selected = String(opt) === String(submittedAnswer);
              const isTheCorrect = String(opt) === String(correctAnswer);
              let outline = '#d1d5db';
              let title = '';
              let icon = null;
              
              if (isTheCorrect) {
                outline = '#10b981';
                title = 'Correct answer';
                icon = <FiCheck aria-hidden />;
              }
              
              if (selected && !isTheCorrect) {
                outline = '#ef4444';
                title = 'Your selected (incorrect)';
                icon = <FiX aria-hidden />;
              }
              
              if (selected && isTheCorrect) {
                title = 'You selected (correct)';
              }
              
              return (
                <label key={i} className="q-option" title={title} style={{ borderColor: outline }}>
                  <input type="radio" name={`q${idx}`} value={opt} checked={selected} readOnly disabled />
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>{opt} {icon}</span>
                </label>
              );
            })}
            
            {!options.length && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input className="input" type="text" value={submittedAnswer || ''} readOnly disabled placeholder="Your answer" 
                  title={isCorrect ? 'Your answer is correct' : 'Your answer is wrong'} 
                  style={{ borderColor: isCorrect ? '#10b981' : '#ef4444' }} />
                <div style={{ fontSize: 12 }}>{chip(`Correct: ${correctAnswer || '—'}`, isCorrect ? 'good' : 'neutral', 'Correct answer')}</div>
              </div>
            )}
          </div>
        </div>
      );
    });
  };

  const renderPredefinedViewOnly = (category, resultBlock) => {
    if (!resultBlock) return null;
    const submitted = resultBlock.submitted || {};
    const key = resultBlock.correctAnswerKey || {};
    
    const field = (label, yourVal, correctVal, isList = false) => {
      const yourArr = isList ? asArray(yourVal) : (yourVal ? [yourVal] : []);
      const correctArr = isList ? asArray(correctVal) : (correctVal ? [correctVal] : []);
      const ok = arrEq(yourArr, correctArr);
      
      return (
        <div className="result-field">
          <div className="result-label">{label}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {chip('Your:', 'neutral')}
            {yourArr.length ? yourArr.map((v, i) => chip(v, ok ? 'good' : 'neutral')) : chip('—', 'neutral')}
            
            {chip('Correct:', 'neutral')}
            {correctArr.length ? correctArr.map((v, i) => chip(v, 'good')) : chip('—', 'neutral')}
          </div>
        </div>
      );
    };
    
    const show = (f) => showField(category, f) || f === 'notes' || f === 'adx';
    
    return (
      <div className="result-grid">
        {show('patientName') && field('Patient Name', submitted.patientName, key.patientName, false)}
        {show('ageOrDob') && field('Age / DOB', submitted.ageOrDob, key.ageOrDob, false)}
        {show('icdCodes') && field('ICD (Pdx)', submitted.icdCodes, key.icdCodes, true)}
        {show('cptCodes') && field('CPT Codes', submitted.cptCodes, key.cptCodes, true)}
        {show('pcsCodes') && field('PCS Codes', submitted.pcsCodes, key.pcsCodes, true)}
        {show('hcpcsCodes') && field('HCPCS Codes', submitted.hcpcsCodes, key.hcpcsCodes, true)}
        {show('drgValue') && field('DRG Value', submitted.drgValue, key.drgValue, false)}
        {show('modifiers') && field('Modifiers', submitted.modifiers, key.modifiers, true)}
        {field('Adx', submitted.adx, key.adx, false)}
        {field('Notes', submitted.notes, key.notes, false)}
      </div>
    );
  }; 

  const renderQuestions = (target) => {
    if (!target) return null;
    const isCompleted = target.isCompleted;
    const qs = target.questions || [];
    const dynamicQs = qs.filter((q) => q.type === 'dynamic');
    const category = activeAssignment?.category;

    if (isCompleted && viewResult) {
      const block = pickResultBlock(target);
      if (!block) return <p className="muted">No results for this section.</p>;
      
      const hasDyn = (block.submitted?.dynamicQuestions || []).length > 0 || 
                    (block.correctDynamicQuestions || []).length > 0 || 
                    dynamicQs.length > 0;
      
      return hasDyn ? renderDynamicViewOnly(block) : renderPredefinedViewOnly(category, block);
    }
    
    // Disable only while submitting
    const readOnly = submitting;
    
    if (dynamicQs.length > 0) {
      return dynamicQs.map((q, idx) => {
        const key = `dynamic-${idx}`;
        const options = q.options || [];
        
        return (
          <div key={idx} className="q-block">
            <p className="q-title">{q.questionText}</p>
            {options.length > 0 ? (
              <div className="q-options">
                {options.map((opt, i) => (
                  <label key={i} className="q-option">
                    <input type="radio" name={`q${idx}`} value={opt} 
                      checked={answers[key] === opt} 
                      onChange={(e) => handleAnswerChange(key, e.target.value)} 
                      disabled={readOnly} />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            ) : (
              <input className="input" type="text" placeholder="Type your answer" 
                value={answers[key] || ''} 
                onChange={(e) => handleAnswerChange(key, e.target.value)} 
                disabled={readOnly} />
            )}
          </div>
        );
      });
    }
    
    const predefined = qs.find((q) => q.type === 'predefined');
    if (predefined && predefined.answerKey) {
      return (
        <div className="form-grid">
          {showField(category, 'patientName') && (
            <div className="form-item">
              <label className="label">Patient Name</label>
              <input className="input" type="text" value={answers.patientName || ''} 
                onChange={(e) => handleAnswerChange('patientName', e.target.value)} 
                disabled={readOnly} />
            </div>
          )}
          
          {showField(category, 'ageOrDob') && (
            <div className="form-item">
              <label className="label">Age / DOB</label>
              <input className="input" type="text" value={answers.ageOrDob || ''} 
                onChange={(e) => handleAnswerChange('ageOrDob', e.target.value)} 
                disabled={readOnly} />
            </div>
          )}
          
          {showField(category, 'icdCodes') && (
            <div className="form-item">
              <label className="label">ICD (Pdx)</label>
              <input className="input" type="text" value={answers.icdCodes || ''} 
                onChange={(e) => handleAnswerChange('icdCodes', e.target.value)} 
                placeholder="Comma separated" 
                disabled={readOnly} />
            </div>
          )}
          
          {showField(category, 'cptCodes') && (
            <div className="form-item">
              <label className="label">CPT Codes</label>
              <input className="input" type="text" value={answers.cptCodes || ''} 
                onChange={(e) => handleAnswerChange('cptCodes', e.target.value)} 
                placeholder="Comma separated" 
                disabled={readOnly} />
            </div>
          )}
          
          {showField(category, 'pcsCodes') && (
            <div className="form-item">
              <label className="label">PCS Codes</label>
              <input className="input" type="text" value={answers.pcsCodes || ''} 
                onChange={(e) => handleAnswerChange('pcsCodes', e.target.value)} 
                placeholder="Comma separated" 
                disabled={readOnly} />
            </div>
          )}
          
          {showField(category, 'hcpcsCodes') && (
            <div className="form-item">
              <label className="label">HCPCS Codes</label>
              <input className="input" type="text" value={answers.hcpcsCodes || ''} 
                onChange={(e) => handleAnswerChange('hcpcsCodes', e.target.value)} 
                placeholder="Comma separated" 
                disabled={readOnly} />
            </div>
          )}
          
          {showField(category, 'drgValue') && (
            <div className="form-item">
              <label className="label">DRG Value</label>
              <input className="input" type="text" value={answers.drgValue || ''} 
                onChange={(e) => handleAnswerChange('drgValue', e.target.value)} 
                placeholder="e.g. 470 or 470-xx" 
                disabled={readOnly} />
            </div>
          )}
          
          {showField(category, 'modifiers') && (
            <div className="form-item">
              <label className="label">Modifiers</label>
              <input className="input" type="text" value={answers.modifiers || ''} 
                onChange={(e) => handleAnswerChange('modifiers', e.target.value)} 
                placeholder="Comma separated (e.g. 26, 59, LT)" 
                disabled={readOnly} />
            </div>
          )}
          
          <div className="form-item">
            <label className="label">Adx</label>
            <input className="input" type="text" value={answers.adx || ''} 
              onChange={(e) => handleAnswerChange('adx', e.target.value)} 
              placeholder="Adx (e.g., principal diagnosis / free text)" 
              disabled={readOnly} />
          </div>
          
          <div className="form-item form-item--full">
            <label className="label">Notes</label>
            <textarea className="textarea" value={answers.notes || ''} 
              onChange={(e) => handleAnswerChange('notes', e.target.value)} 
              rows={4} 
              disabled={readOnly} />
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
          <h2 className="title">New Assignments</h2>
        </div>
        <div className="grid">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card loading">
              <div className="card-head">
                <div className="loading-line" style={{ width: '70%', height: 24 }}></div>
                <div className="loading-line" style={{ width: 80, height: 24 }}></div>
              </div>
              <div className="loading-line" style={{ width: '90%', height: 16, marginBottom: 8 }}></div>
              <div className="loading-line" style={{ width: '60%', height: 16 }}></div>
            </div>
          ))}
        </div>
      </div>
    );
  } 

  if (error && !activeAssignment) {
    return (
      <div className="container">
        <div className="page-header">
          <h2 className="title">New Assignments</h2>
        </div>
        <div className="empty-state error">
          <div className="empty-icon"><FiX /></div>
          <div>
            <h3>Something went wrong</h3>
            <p className="muted">{error}</p>
          </div>
        </div>
      </div>
    );
  } 

  if (activeAssignment) {
    if (!activeSubAssignment && activeAssignment.subAssignments?.length > 0) {
      return (
        <div className="container">
          <div className="page-header">
            <button className="btn btn-ghost" onClick={() => { setActiveAssignment(null); clearCountdown(); }} disabled={submitting}>
              Back
            </button>
            <h3 className="title-sm">{activeAssignment.moduleName}</h3>
            <div style={{ marginLeft: 'auto' }}>
              {timerBadge(activeAssignment)}
            </div>
          </div>
          
          <div className="grid">
            {(activeAssignment.subAssignments || []).map((s, i) => {
              const isStarting = startingId === `${activeAssignment._id}:${s._id}`;
              const btnLabel = s.isCompleted ? 'View' : 'Start';
              
              return (
                <div key={i} className="card sub-card">
                  <div className="card-head">
                    <h4 className="card-title">{s.subModuleName}</h4>
                    <span className={`badge ${s.isCompleted ? 'badge-success' : 'badge-pending'}`}>
                      {s.isCompleted ? 'Completed' : 'Pending'}
                    </span>
                  </div>
                  <div className="card-actions">
                    <button className="btn" onClick={() => handleStart(activeAssignment._id, s._id)} 
                      disabled={submitting || isStarting}>
                      {isStarting ? 'Opening…' : btnLabel}
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
    const hasTimeLimit = Number.isFinite(getTimeLimitMinutes(activeAssignment, activeSubAssignment || null));
    const showCountdown = Number.isFinite(countdown); // drive UI off countdown state
    
    return (
      <div className="container">
        <div className="page-header">
          <button className="btn btn-ghost" onClick={() => { 
            activeSubAssignment ? setActiveSubAssignment(null) : setActiveAssignment(null); 
            clearCountdown(); 
            setViewResult(null); 
            setResultError(''); 
            setResultLoading(false); 
          }} disabled={submitting}>
            Back
          </button>
          
          <h3 className="title-sm">{activeSubAssignment?.subModuleName || activeAssignment.moduleName}</h3>
          
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            {timerBadge(activeAssignment, activeSubAssignment || null)}
            {showCountdown && <div className="countdown-chip"><FiClock /> <span>{fmtCountdown(countdown ?? 0)}</span></div>}
            {isCompleted && <span className="badge badge-success">Completed (View Only)</span>}
          </div>
        </div>
        
        {/* Informational note; auto-submit on time end */}
        {hasTimeLimit && !isCompleted && (
          <div style={{ margin: '8px 0 12px', padding: '10px 12px', borderRadius: 8, background: '#fff8e1', border: '1px solid #f6d365', color: '#7a4d00', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
            <FiClock aria-hidden /> Note: This is a timed assignment. It will auto-submit when time ends.
          </div>
        )}
        
        {pdfUrl && <PdfReader url={pdfUrl} height="60vh" watermark="" />}
        
        <div ref={questionsRef} className="panel">
          <div className="panel-head"><h4>Questions</h4></div>
          
          {isCompleted && resultLoading && (
            <div className="loading-container" style={{ marginTop: 8 }}>
              <div className="loading-spinner" />
              <p>Loading results…</p>
            </div>
          )}
          
          {isCompleted && resultError && (
            <div className="empty-state error" style={{ marginTop: 8 }}>
              <div className="empty-icon"><FiX /></div>
              <div>
                <h3>Couldn't load results</h3>
                <p className="muted">{resultError}</p>
              </div>
            </div>
          )}
          
          <div className="panel-body">{renderQuestions(questionSource)}</div>
          
          <div className="panel-actions">
            {isCompleted ? (
              <button className="btn" disabled>View Only</button>
            ) : (
              <button className="btn btn-primary" onClick={() => handleSubmit(false)} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit Assignment'}
              </button>
            )}
          </div>
        </div>
        
        {submitting && <LoadingOverlay />}
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h2 className="title">New Assignments</h2>
      </div>
      
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiSearch /> Search
          </h4>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FiFilter />
            <select className="input" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} style={{ width: 180 }} disabled={submitting}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
        </div>
        
        <div className="panel-body" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="text" className="input" value={search} onChange={(e) => { 
            setSearch(e.target.value); 
            setActiveAssignment(null); 
            setActiveSubAssignment(null); 
          }} placeholder="Search by module or section name…" style={{ maxWidth: 360 }} disabled={submitting} />
          
          {search && <button className="btn btn-ghost" onClick={() => setSearch('')} disabled={submitting}>Clear</button>}
          <span className="muted">Sort controls affect date; search filters the view.</span>
        </div>
      </div>
      
      {sorted.length > 0 ? (
        <div className="grid">
          {sorted.map((assignment) => {
            const allSubsCompleted = areAllSubAssignmentsCompleted(assignment);
            const isStarting = startingId === `${assignment._id}:parent`;
            const btnLabel = allSubsCompleted ? 
              (assignment.subAssignments?.length > 0 ? 'View Sections' : 'View') : 
              (assignment.subAssignments?.length > 0 ? 'View Sections' : 'Start');
            
            return (
              <div key={assignment._id} className="card">
                <div className="card-head">
                  <h3 className="card-title">{assignment.moduleName}</h3>
                  <span className={`badge ${allSubsCompleted ? 'badge-success' : 'badge-pending'}`}>
                    {allSubsCompleted ? 'Completed' : 'Assigned'}
                  </span>
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
                  <button className="btn" onClick={() => handleStart(assignment._id)} disabled={submitting || isStarting}>
                    {isStarting ? 'Opening…' : btnLabel}
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
    </div>
  );
};

const LoadingOverlay = () => (
  <div className="loading-overlay">
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    <div className="loading-content">
      <div className="loading-spinner" style={{ width: 48, height: 48, borderWidth: 4 }}></div>
      <h4>Submitting…</h4>
      <p>Please wait</p>
    </div>
  </div>
); 

export default NewAssignments;