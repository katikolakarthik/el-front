// NewAssignments.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { FiBook, FiClock, FiSearch, FiFilter } from 'react-icons/fi';
import { Worker, Viewer, SpecialZoomLevel } from '@react-pdf-viewer/core';
import '@react-pdf-viewer/core/lib/styles/index.css';
import './AssignmentFlow.css';

const API_BASE = 'https://el-backend-ashen.vercel.app';
const CATEGORY_OPTIONS = ["CPC", "CCS", "IP-DRG", "SURGERY", "Denials", "ED", "E and M"];

/* ---------------- PDF Reader ---------------- */
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
              <a href={url} target="_blank" rel="noreferrer">
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

/* ---------------- Helpers ---------------- */
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

const csvToArray = (str = '') => str.split(',').map((s) => s.trim()).filter(Boolean);

/* ---------------- Main Component ---------------- */
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

  const [countdown, setCountdown] = useState(null);
  const timerRef = useRef(null);
  const autoSubmittingRef = useRef(false);
  const deadlineRef = useRef(null);
  const questionsRef = useRef(null);

  /* fetch assignments */
  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        setLoading(true);
        setError(null);
        const userId = localStorage.getItem('userId');
        if (!userId) throw new Error('User ID not found');

        const courseResp = await axios.get(`${API_BASE}/student/${userId}/course`);
        const courseName = courseResp?.data?.courseName || courseResp?.data?.course?.name;
        if (!courseName) throw new Error('Course name not found');

        const asgResp = await axios.get(
          `${API_BASE}/category/${encodeURIComponent(courseName)}?studentId=${userId}`
        );

        let assignmentsData = [];
        if (asgResp?.data?.success && Array.isArray(asgResp.data.assignments))
          assignmentsData = asgResp.data.assignments;
        else if (Array.isArray(asgResp?.data)) assignmentsData = asgResp.data;
        else if (Array.isArray(asgResp?.data?.data)) assignmentsData = asgResp.data.data;
        else if (asgResp?.data?.assignment) assignmentsData = [asgResp.data.assignment];

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

  /* filter + sort */
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

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const da = ms(a.assignedDate), db = ms(b.assignedDate);
      return sortOrder === 'newest' ? db - da : da - db;
    });
    return list;
  }, [filtered, sortOrder]);

  /* start assignment */
  const handleStart = (assignmentId, subAssignmentId = null) => {
    setStartingId(`${assignmentId}:${subAssignmentId || 'parent'}`);
    const fromList = assignments.find((a) => String(a._id) === String(assignmentId));
    if (!fromList) return;
    setActiveAssignment(fromList);

    if (subAssignmentId) {
      const sub = fromList.subAssignments.find((s) => String(s._id) === String(subAssignmentId));
      setActiveSubAssignment(sub || null);
    } else {
      setActiveSubAssignment(null);
    }

    setAnswers({});
    initCountdown(fromList);

    setTimeout(() => {
      questionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    setStartingId(null);
  };

  /* countdown logic */
  const clearCountdown = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setCountdown(null);
    deadlineRef.current = null;
  };

  const initCountdown = (assignmentLike) => {
    clearCountdown();
    const mins = Number(assignmentLike.timeLimitMinutes || 0);
    if (!mins) return;
    const deadline = Date.now() + mins * 60000;
    deadlineRef.current = deadline;
    setCountdown(deadline - Date.now());

    timerRef.current = setInterval(() => {
      const left = deadlineRef.current - Date.now();
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
      await handleSubmit(true);
    } finally {
      autoSubmittingRef.current = false;
    }
  };

  useEffect(() => () => clearCountdown(), []);

  /* submit answers */
  const handleSubmit = async (isAuto = false) => {
    try {
      setSubmitting(true);
      const userId = localStorage.getItem('userId');
      if (!userId) throw new Error('User ID not found');

      const src = activeSubAssignment || activeAssignment;
      const category = activeAssignment?.category || '';

      const payload = {
        studentId: userId,
        assignmentId: activeAssignment._id,
        submittedAnswers: []
      };

      const predefined = {
        patientName: answers.patientName || '',
        ageOrDob: answers.ageOrDob || '',
        icdCodes: csvToArray(answers.icdCodes || ''),
        cptCodes: csvToArray(answers.cptCodes || ''),
        pcsCodes: csvToArray(answers.pcsCodes || ''),
        hcpcsCodes: csvToArray(answers.hcpcsCodes || ''),
        drgValue: answers.drgValue || '',
        modifiers: csvToArray(answers.modifiers || ''),
        notes: answers.notes || '',
        adx: answers.adx || ''
      };

      payload.submittedAnswers.push(predefined);

      await axios.post(`${API_BASE}/student/submit-assignment`, payload);
      if (!isAuto) alert("Submitted!");
      clearCountdown();
      setActiveAssignment(null);
      setActiveSubAssignment(null);
    } catch (err) {
      if (!isAuto) alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnswerChange = (key, val) => setAnswers((p) => ({ ...p, [key]: val }));

  /* render predefined form with category-based filtering */
  const renderPredefined = (category) => {
    const hide = {};
    if (category === "IP-DRG") {
      hide.cptCodes = true; hide.hcpcsCodes = true; hide.modifiers = true;
    }
    if (category === "CPC") {
      hide.pcsCodes = true; hide.patientName = true; hide.ageOrDob = true; hide.drgValue = true;
    }
    return (
      <div className="form-grid">
        {!hide.patientName && (
          <div className="form-item">
            <label>Patient Name</label>
            <input className="input" value={answers.patientName || ''} onChange={(e) => handleAnswerChange('patientName', e.target.value)} />
          </div>
        )}
        {!hide.ageOrDob && (
          <div className="form-item">
            <label>Age/DOB</label>
            <input className="input" value={answers.ageOrDob || ''} onChange={(e) => handleAnswerChange('ageOrDob', e.target.value)} />
          </div>
        )}
        <div className="form-item">
          <label>ICD Codes</label>
          <input className="input" value={answers.icdCodes || ''} onChange={(e) => handleAnswerChange('icdCodes', e.target.value)} />
        </div>
        {!hide.cptCodes && (
          <div className="form-item">
            <label>CPT Codes</label>
            <input className="input" value={answers.cptCodes || ''} onChange={(e) => handleAnswerChange('cptCodes', e.target.value)} />
          </div>
        )}
        {!hide.pcsCodes && (
          <div className="form-item">
            <label>PCS Codes</label>
            <input className="input" value={answers.pcsCodes || ''} onChange={(e) => handleAnswerChange('pcsCodes', e.target.value)} />
          </div>
        )}
        {!hide.hcpcsCodes && (
          <div className="form-item">
            <label>HCPCS Codes</label>
            <input className="input" value={answers.hcpcsCodes || ''} onChange={(e) => handleAnswerChange('hcpcsCodes', e.target.value)} />
          </div>
        )}
        {!hide.drgValue && (
          <div className="form-item">
            <label>DRG Value</label>
            <input className="input" value={answers.drgValue || ''} onChange={(e) => handleAnswerChange('drgValue', e.target.value)} />
          </div>
        )}
        {!hide.modifiers && (
          <div className="form-item">
            <label>Modifiers</label>
            <input className="input" value={answers.modifiers || ''} onChange={(e) => handleAnswerChange('modifiers', e.target.value)} />
          </div>
        )}
        <div className="form-item">
          <label>Adx</label>
          <input className="input" value={answers.adx || ''} onChange={(e) => handleAnswerChange('adx', e.target.value)} />
        </div>
        <div className="form-item form-item--full">
          <label>Notes</label>
          <textarea className="textarea" value={answers.notes || ''} onChange={(e) => handleAnswerChange('notes', e.target.value)} />
        </div>
      </div>
    );
  };

  /* UI */
  if (loading) return <div>Loading…</div>;
  if (error) return <div>Error: {error}</div>;

  if (activeAssignment) {
    const pdfUrl = activeSubAssignment?.assignmentPdf || activeAssignment.assignmentPdf;
    const showCountdown = countdown !== null;
    const cat = activeAssignment.category;
    return (
      <div className="container">
        <div className="page-header">
          <button onClick={() => { setActiveAssignment(null); clearCountdown(); }}>Back</button>
          <h3>{activeAssignment.moduleName}</h3>
          {showCountdown && (
            <div className="countdown-chip"><FiClock /> {fmtCountdown(countdown)}</div>
          )}
        </div>
        {pdfUrl && <PdfReader url={pdfUrl} />}
        <div ref={questionsRef} className="panel">
          {renderPredefined(cat)}
          <button onClick={() => handleSubmit(false)} disabled={submitting}>Submit</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h2><FiBook /> New Assignments</h2>
      </div>
        <div className="panel">
        <div className="panel-head">
          <h4><FiSearch /> Search</h4>
          <div style={{ marginLeft: 'auto' }}>
            <FiFilter />
            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
        </div>
        <div className="panel-body">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" />
        </div>
      </div>
      <div className="grid">
        {sorted.map((a) => (
          <div key={a._id} className="card">
            <h3>{a.moduleName}</h3>
            <button onClick={() => handleStart(a._id)}>Start</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NewAssignments;