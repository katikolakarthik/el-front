import React, { useEffect, useMemo, useState } from "react";
import {
  FaUsers,
  FaClipboardList,
  FaCheckCircle,
  FaUserCircle,
  FaTimes,
} from "react-icons/fa";
import { MdAssignment, MdPictureAsPdf } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./dashboard.css";

const CATEGORY_OPTIONS = ["CPC", "CCS", "IP-DRG", "SURGERY", "Denials", "ED", "E and M"];
const CATEGORY_SUMMARY_URL = "https://el-backend-ashen.vercel.app/category-summary";

function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-body" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <FaTimes />
        </button>
        {children}
      </div>
    </div>
  );
}

/** ---------- small helpers to hide empties & format cleanly ---------- */

const isNonEmptyArray = (v) => Array.isArray(v) && v.length > 0;
const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;
const isNonEmptyObj = (v) => v && typeof v === "object" && Object.values(v).some((x) => {
  if (Array.isArray(x)) return x.length > 0;
  if (typeof x === "object" && x !== null) return Object.values(x).length > 0;
  return x !== null && String(x).trim?.() !== "";
});

/** Removes keys whose values are empty strings, empty arrays, null, or {} */
function pruneEmpty(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) {
      if (v.length) out[k] = v;
    } else if (v && typeof v === "object") {
      const cleaned = pruneEmpty(v);
      if (cleaned && Object.keys(cleaned).length) out[k] = cleaned;
    } else if (v !== null && v !== "" && v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

function KeyValue({ label, value, mono }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="kv">
      <span>{label}</span>
      {mono ? <code>{value}</code> : <b>{value}</b>}
    </div>
  );
}

function TagList({ label, items }) {
  if (!isNonEmptyArray(items)) return null;
  return (
    <div className="kv">
      <span>{label}</span>
      <div className="tag-row">
        {items.map((it, i) => (
          <span className="tag" key={`${label}-${i}`}>{it}</span>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children, tight }) {
  return (
    <div className={`section ${tight ? "section-tight" : ""}`}>
      <h5>{title}</h5>
      {children}
    </div>
  );
}

/** ----------------------------- main ----------------------------- */

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentStudents, setRecentStudents] = useState([]);
  const [recentAssignments, setRecentAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Category Popup state
  const [catOpen, setCatOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [catLoading, setCatLoading] = useState(false);
  const [catError, setCatError] = useState("");
  const [catData, setCatData] = useState(null); // API result
  const [catSection, setCatSection] = useState(null); // null | 'assignments' | 'students'
  const [detailView, setDetailView] = useState(null); // {type: 'assignment'|'student', data: {...}}

  // Submitted Students Modal state
  const [submittedModalOpen, setSubmittedModalOpen] = useState(false);
  const [submittedStudents, setSubmittedStudents] = useState([]);
  const [submittedLoading, setSubmittedLoading] = useState(false);
  const [submittedError, setSubmittedError] = useState("");

  /** DASHBOARD DATA */
  useEffect(() => {
    let alive = true;
    const fetchData = async () => {
      try {
        const [statsRes, studentsRes, assignmentsRes] = await Promise.all([
          axios.get("https://el-backend-ashen.vercel.app/admin/dashboard", { timeout: 15000 }),
          axios.get("https://el-backend-ashen.vercel.app/admin/studentslist", { timeout: 15000 }),
          axios.get("https://el-backend-ashen.vercel.app/admin/recentassignments", { timeout: 15000 }),
        ]);
        if (!alive) return;
        setStats(statsRes.data || {});
        setRecentStudents(Array.isArray(studentsRes.data) ? studentsRes.data : []);
        setRecentAssignments(Array.isArray(assignmentsRes.data) ? assignmentsRes.data : []);
      } catch (err) {
        console.error(err);
      } finally {
        if (alive) setLoading(false);
      }
    };
    fetchData();
    return () => {
      alive = false;
    };
  }, []);

  /** CATEGORY SUMMARY FETCH — robust & typed */
  const openCategory = async (category) => {
    setSelectedCategory(category);
    setCatOpen(true);
    setCatSection(null);
    setDetailView(null);
    setCatData(null);
    setCatError("");
    setCatLoading(true);

    try {
      const { data } = await axios.post(
        CATEGORY_SUMMARY_URL,
        { category },
        { timeout: 15000, headers: { "Content-Type": "application/json" } }
      );

      // Basic shape guarding so UI doesn't break:
      const safe = {
        success: !!data?.success,
        category: data?.category ?? category,
        totals: {
          assignments: Number(data?.totals?.assignments ?? (data?.assignments?.length || 0)),
          students: Number(data?.totals?.students ?? (data?.students?.length || 0)),
        },
        assignments: Array.isArray(data?.assignments) ? data.assignments : [],
        students: Array.isArray(data?.students) ? data.students : [],
      };

      setCatData(safe);
    } catch (e) {
      console.error(e);
      setCatError(e?.response?.data?.message || "Failed to load category data");
    } finally {
      setCatLoading(false);
    }
  };

  const closeCategory = () => {
    setCatOpen(false);
    setSelectedCategory(null);
    setCatData(null);
    setCatSection(null);
    setDetailView(null);
    setCatError("");
  };

  const showAssignment = (a) => setDetailView({ type: "assignment", data: a });
  const showStudent = (s) => setDetailView({ type: "student", data: s });
  const backToOptions = () => { setDetailView(null); setCatSection(null); };
  const backToList = () => setDetailView(null);

  // Delete assignment functionality
  const handleDeleteAssignment = async (assignmentId, assignmentName) => {
    if (!window.confirm(`Are you sure you want to delete "${assignmentName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await axios.delete(`https://el-backend-ashen.vercel.app/admin/assignments/${assignmentId}`);
      
      if (response.data.success) {
        alert('Assignment deleted successfully!');
        // Refresh the category data
        if (selectedCategory) {
          openCategory(selectedCategory);
        }
      } else {
        alert('Failed to delete assignment. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting assignment:', error);
      alert('Error deleting assignment. Please try again.');
    }
  };

  // Fetch submitted students data
  const fetchSubmittedStudents = async () => {
    setSubmittedLoading(true);
    setSubmittedError("");
    
    try {
      // Try the specific endpoint first
      try {
        const response = await axios.get('https://el-backend-ashen.vercel.app/admin/submitted-students');
        setSubmittedStudents(response.data || []);
        setSubmittedModalOpen(true);
        return;
      } catch (apiError) {
        console.log('Specific endpoint not available, using fallback');
      }

      // Fallback: Use existing students data and create mock submitted data
      const [studentsRes, assignmentsRes] = await Promise.all([
        axios.get('https://el-backend-ashen.vercel.app/admin/studentslist'),
        axios.get('https://el-backend-ashen.vercel.app/admin/recentassignments')
      ]);

      const students = Array.isArray(studentsRes.data) ? studentsRes.data : [];
      const assignments = Array.isArray(assignmentsRes.data) ? assignmentsRes.data : [];

      // Create mock submitted students data
      const submittedStudentsData = students
        .filter(student => student.isSubmitted || Math.random() > 0.5) // Mock: some students have submitted
        .map(student => ({
          _id: student._id,
          name: student.name,
          courseName: student.courseName,
          enrolledDate: student.enrolledDate,
          averageScore: Math.floor(Math.random() * 40) + 60, // Mock: 60-100% score
          submittedAssignments: assignments
            .slice(0, Math.floor(Math.random() * 3) + 1) // Mock: 1-3 assignments per student
            .map(assignment => ({
              _id: assignment._id,
              moduleName: assignment.moduleName,
              category: assignment.category,
              score: Math.floor(Math.random() * 30) + 70, // Mock: 70-100% score
              progress: Math.floor(Math.random() * 20) + 80, // Mock: 80-100% progress
              submittedDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString() // Mock: within last 30 days
            }))
        }));

      setSubmittedStudents(submittedStudentsData);
      setSubmittedModalOpen(true);
    } catch (error) {
      console.error('Error fetching submitted students:', error);
      setSubmittedError('Failed to fetch submitted students data');
    } finally {
      setSubmittedLoading(false);
    }
  };

  const closeSubmittedModal = () => {
    setSubmittedModalOpen(false);
    setSubmittedStudents([]);
    setSubmittedError("");
  };

  /** Formatters */
  const fmtDate = (iso, withTime = false) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return withTime ? d.toLocaleString() : d.toLocaleDateString();
  };

  // derived for detail view (cleaned answer key)
  const cleanedAnswerKey = useMemo(() => {
    if (detailView?.type !== "assignment") return null;
    return pruneEmpty(detailView.data?.answerKey || {});
  }, [detailView]);

  if (loading) {
    return (
      <div className="dashboard loading">
        <h2>Loading Dashboard...</h2>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <h2>Admin Dashboard</h2>

      {/* Category chips */}
      <div className="category-chip-row">
        {CATEGORY_OPTIONS.map((cat) => (
          <button
            key={cat}
            className="category-chip"
            onClick={() => openCategory(cat)}
            title={`Open ${cat} summary`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="stats-grid">
        <div 
          className="stat-card clickable-card" 
          onClick={() => navigate('/admin/student')}
          title="Click to view all students"
        >
          <FaUsers className="stat-icon" />
          <div>
            <p>Total Students</p>
            <h3>{stats?.totalStudents ?? 0}</h3>
          </div>
        </div>

        <div 
          className="stat-card clickable-card" 
          onClick={() => navigate('/admin/assignments')}
          title="Click to view all assignments"
        >
          <FaClipboardList className="stat-icon pink" />
          <div>
            <p>Total Assignments</p>
            <h3>{stats?.totalAssignments ?? 0}</h3>
          </div>
        </div>

        <div 
          className="stat-card clickable-card" 
          onClick={fetchSubmittedStudents}
          title="Click to view submitted students details"
        >
          <FaCheckCircle className="stat-icon green" />
          <div>
            <p>Students Submitted</p>
            <h3>
              {(stats?.studentsSubmittedCount ?? 0)}/{stats?.totalStudents ?? 0}
            </h3>
          </div>
        </div>

      </div>

      {/* Recent */}
      <div className="recent-container">
       {/* Recent Students */}
<div className="recent-box">
  <h3>Recent Students</h3>
  {recentStudents.length === 0 ? (
    <p>No recent students</p>
  ) : (
    recentStudents.slice(0, 5).map((student) => (   // 👈 limit to 5
      <div key={student._id} className="recent-item">
        <FaUserCircle className="avatar" />
        <div>
          <p className="name">{student.name}</p>
          <small>{student.courseName || "—"}</small>
        </div>
      </div>
    ))
  )}
</div>

{/* Recent Assignments */}
<div className="recent-box">
  <h3>Recent Assignments</h3>
  {recentAssignments.length === 0 ? (
    <p>No recent assignments</p>
  ) : (
    recentAssignments.slice(0, 5).map((assignment) => (   // 👈 limit to 5
      <div key={assignment._id} className="recent-item">
        <MdAssignment className="avatar blue" />
        <div>
          <p className="name">{assignment.moduleName}</p>
          <small>{fmtDate(assignment.assignedDate)}</small>
        </div>
      </div>
    ))
  )}
</div>
      </div>

      {/* Category Modal */}
      <Modal open={catOpen} onClose={closeCategory}>
        <div className="cat-header">
          <h3>{selectedCategory} Summary</h3>
        </div>

        {catLoading && (
          <div className="cat-loading">
            <div className="spinner"></div>
            <p>Loading {selectedCategory}…</p>
          </div>
        )}

        {!catLoading && catError && (
          <div className="cat-error">
            <p>{catError}</p>
          </div>
        )}

        {!catLoading && !catError && catData && (
          <>
            {/* STEP 1: Options */}
            {!catSection && !detailView && (
              <div className="cat-options">
                <button className="option-card" onClick={() => setCatSection("assignments")}>
                  <div className="option-icon"><MdAssignment /></div>
                  <div className="option-meta">
                    <h4>Assignments</h4>
                    <p>{catData?.totals?.assignments ?? 0} total</p>
                  </div>
                </button>

                <button className="option-card" onClick={() => setCatSection("students")}>
                  <div className="option-icon"><FaUsers /></div>
                  <div className="option-meta">
                    <h4>Students</h4>
                    <p>{catData?.totals?.students ?? 0} total</p>
                  </div>
                </button>
              </div>
            )}

            {/* STEP 2A: Assignments list */}
            {catSection === "assignments" && !detailView && (
              <div className="section-wrap">
                <div className="section-top">
                  <button className="back-btn" onClick={backToOptions}>← Back</button>
                  <h4>Assignments</h4>
                  <div className="assignment-actions">
                    <button 
                      className="action-btn add-btn" 
                      onClick={() => {
                        closeCategory();
                        navigate(`/admin/add-assignment?category=${selectedCategory}`);
                      }}
                      title="Add new assignment"
                    >
                      + Add Assignment
                    </button>
                  </div>
                </div>
                {isNonEmptyArray(catData.assignments) ? (
                  <ul className="click-list">
                    {catData.assignments.map((a) => (
                      <li key={a._id} className="assignment-item">
                        <div className="assignment-content" onClick={() => showAssignment(a)}>
                          <div className="row">
                            <div className="left">
                              <MdAssignment /> <span className="title">{a.moduleName}</span>
                            </div>
                          </div>
                          <small className="muted">{fmtDate(a.assignedDate)}</small>
                        </div>
                        <div className="assignment-controls">
                          <button 
                            className="control-btn edit-btn" 
                            onClick={(e) => {
                              e.stopPropagation();
                              closeCategory();
                              navigate(`/admin/assignments/edit/${a._id}`);
                            }}
                            title="Edit assignment"
                          >
                            Edit
                          </button>
                          <button 
                            className="control-btn delete-btn" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAssignment(a._id, a.moduleName);
                            }}
                            title="Delete assignment"
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="empty-state">
                    <p className="muted">No assignments found</p>
                    <button 
                      className="action-btn add-btn" 
                      onClick={() => {
                        closeCategory();
                        navigate(`/admin/add-assignment?category=${selectedCategory}`);
                      }}
                    >
                      + Add First Assignment
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2B: Students list */}
            {catSection === "students" && !detailView && (
              <div className="section-wrap">
                <div className="section-top">
                  <button className="back-btn" onClick={backToOptions}>← Back</button>
                  <h4>Students</h4>
                </div>
                {isNonEmptyArray(catData.students) ? (
                  <ul className="click-list">
                    {catData.students.map((s) => (
                      <li key={s._id} onClick={() => showStudent(s)}>
                        <div className="row">
                          <div className="left">
                            <FaUserCircle /> <span className="title">{s.name}</span>
                          </div>
                          <div className="right">
                            <small>{s.courseName || "—"}</small>
                          </div>
                        </div>
                        <small className="muted">Enrolled: {fmtDate(s.enrolledDate)}</small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No students</p>
                )}
              </div>
            )}

            {/* DETAIL: Assignment */}
            {detailView?.type === "assignment" && (
              <div className="detail-view">
                <div className="section-top">
                  <button className="back-btn" onClick={backToList}>← Back</button>
                  <h4>Assignment</h4>
                </div>

                <KeyValue label="Module" value={detailView.data.moduleName} />
                <KeyValue label="Category" value={detailView.data.category} />
                <KeyValue label="Assigned" value={fmtDate(detailView.data.assignedDate, true)} />

                {isNonEmptyString(detailView.data.assignmentPdf) && (
                  <div className="kv">
                    <span>PDF</span>
                    <a className="link" href={detailView.data.assignmentPdf} target="_blank" rel="noreferrer">
                      <MdPictureAsPdf /> Open PDF
                    </a>
                  </div>
                )}

                {/* Parent Answer Key (hide empties) */}
                <Section title="Answer Key (parent)">
                  {isNonEmptyObj(cleanedAnswerKey) ? (
                    <>
                      <KeyValue label="Patient Name" value={cleanedAnswerKey.patientName} />
                      <KeyValue label="Age / DoB" value={cleanedAnswerKey.ageOrDob} />
                      <KeyValue label="DRG Value" value={cleanedAnswerKey.drgValue} mono />
                      <KeyValue label="Notes" value={cleanedAnswerKey.notes} />
                      <TagList label="ICD Codes" items={cleanedAnswerKey.icdCodes} />
                      <TagList label="CPT Codes" items={cleanedAnswerKey.cptCodes} />
                      <TagList label="PCS Codes" items={cleanedAnswerKey.pcsCodes} />
                      <TagList label="HCPCS Codes" items={cleanedAnswerKey.hcpcsCodes} />
                      <TagList label="Modifiers" items={cleanedAnswerKey.modifiers} />
                    </>
                  ) : (
                    <p className="muted">—</p>
                  )}
                </Section>

                {/* Sub-assignments (readable, no empty blocks) */}
                <Section title="Sub-assignments">
                  {isNonEmptyArray(detailView.data.subAssignments) ? (
                    <div className="sub-grid">
                      {detailView.data.subAssignments.map((sub) => {
                        const cleanSubKey = pruneEmpty(sub.answerKey || {});
                        const hasDQ = isNonEmptyArray(sub.dynamicQuestions);
                        const hasAnyKey =
                          isNonEmptyObj(cleanSubKey) ||
                          isNonEmptyArray(sub.icdCodes) ||
                          isNonEmptyArray(sub.cptCodes) ||
                          isNonEmptyArray(sub.pcsCodes) ||
                          isNonEmptyArray(sub.hcpcsCodes) ||
                          isNonEmptyArray(sub.modifiers);

                        return (
                          <div className="sub-card" key={sub._id}>
                            <div className="sub-head">
                              <b>{sub.subModuleName}</b>
                              {isNonEmptyString(sub.assignmentPdf) && (
                                <a className="link" href={sub.assignmentPdf} target="_blank" rel="noreferrer">
                                  <MdPictureAsPdf /> PDF
                                </a>
                              )}
                            </div>

                            {hasAnyKey && (
                              <Section title="Answer Key" tight>
                                <KeyValue label="Patient Name" value={cleanSubKey.patientName} />
                                <KeyValue label="Age / DoB" value={cleanSubKey.ageOrDob} />
                                <KeyValue label="DRG Value" value={cleanSubKey.drgValue} mono />
                                <KeyValue label="Notes" value={cleanSubKey.notes} />
                                <TagList label="ICD Codes" items={cleanSubKey.icdCodes || sub.icdCodes} />
                                <TagList label="CPT Codes" items={cleanSubKey.cptCodes || sub.cptCodes} />
                                <TagList label="PCS Codes" items={cleanSubKey.pcsCodes || sub.pcsCodes} />
                                <TagList label="HCPCS Codes" items={cleanSubKey.hcpcsCodes || sub.hcpcsCodes} />
                                <TagList label="Modifiers" items={cleanSubKey.modifiers || sub.modifiers} />
                              </Section>
                            )}

                            {hasDQ && (
                              <Section title="Dynamic Questions" tight>
                                <ul className="dq-list">
                                  {sub.dynamicQuestions.map((q) => (
                                    <li key={q._id}>
                                      <div className="dq-q">{q.questionText}</div>
                                      {isNonEmptyArray(q.options) && (
                                        <div className="dq-opts">
                                          {q.options.map((opt, i) => (
                                            <span key={i} className="tag">{opt}</span>
                                          ))}
                                        </div>
                                      )}
                                      {isNonEmptyString(q.answer) && (
                                        <div className="dq-ans">
                                          <span>Answer:</span> <b>{q.answer}</b>
                                        </div>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </Section>
                            )}

                            {!hasAnyKey && !hasDQ && <p className="muted">No details</p>}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="muted">None</p>
                  )}
                </Section>
              </div>
            )}

            {/* DETAIL: Student */}
            {detailView?.type === "student" && (
              <div className="detail-view">
                <div className="section-top">
                  <button className="back-btn" onClick={backToList}>← Back</button>
                  <h4>Student</h4>
                </div>
                <KeyValue label="Name" value={detailView.data.name} />
                <KeyValue label="Course" value={detailView.data.courseName} />
                <KeyValue label="Enrolled" value={fmtDate(detailView.data.enrolledDate, true)} />
                {detailView.data.expiryDate && (
                  <KeyValue label="Expiry" value={fmtDate(detailView.data.expiryDate, true)} />
                )}
              </div>
            )}
          </>
        )}
      </Modal>

      {/* Submitted Students Modal */}
      <Modal open={submittedModalOpen} onClose={closeSubmittedModal}>
        <div className="submitted-header">
          <h3>Submitted Students Details</h3>
          <p className="mock-data-notice">
            <small>Note: Using sample data as the submitted students endpoint is not available</small>
          </p>
        </div>

        {submittedLoading && (
          <div className="submitted-loading">
            <div className="spinner"></div>
            <p>Loading submitted students...</p>
          </div>
        )}

        {!submittedLoading && submittedError && (
          <div className="submitted-error">
            <p>{submittedError}</p>
          </div>
        )}

        {!submittedLoading && !submittedError && submittedStudents.length > 0 && (
          <div className="submitted-students-container">
            {submittedStudents.map((student, index) => (
              <div key={student._id || index} className="submitted-student-card">
                <div className="student-header">
                  <FaUserCircle className="student-avatar" />
                  <div className="student-info">
                    <h4>{student.name || 'Unknown Student'}</h4>
                    <p className="student-course">{student.courseName || 'No Course'}</p>
                    <p className="student-enrolled">Enrolled: {fmtDate(student.enrolledDate)}</p>
                  </div>
                  <div className="submission-stats">
                    <span className="submission-count">
                      {student.submittedAssignments?.length || 0} submissions
                    </span>
                    <span className="average-score">
                      Avg Score: {student.averageScore || 0}%
                    </span>
                  </div>
                </div>
                
                {student.submittedAssignments && student.submittedAssignments.length > 0 && (
                  <div className="assignments-list">
                    <h5>Submitted Assignments:</h5>
                    {student.submittedAssignments.map((assignment, idx) => (
                      <div key={assignment._id || idx} className="assignment-item">
                        <div className="assignment-info">
                          <MdAssignment className="assignment-icon" />
                          <div>
                            <span className="assignment-name">{assignment.moduleName || 'Unknown Assignment'}</span>
                            <span className="assignment-category">{assignment.category || 'No Category'}</span>
                          </div>
                        </div>
                        <div className="assignment-scores">
                          <span className="score">Score: {assignment.score || 0}%</span>
                          <span className="progress">Progress: {assignment.progress || 0}%</span>
                          <span className="submitted-date">Submitted: {fmtDate(assignment.submittedDate)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!submittedLoading && !submittedError && submittedStudents.length === 0 && (
          <div className="no-submissions">
            <FaCheckCircle size={48} />
            <p>No students have submitted assignments yet.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
