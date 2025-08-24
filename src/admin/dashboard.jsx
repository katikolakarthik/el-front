import React, { useEffect, useState } from "react";
import {
  FaUsers,
  FaClipboardList,
  FaCheckCircle,
  FaChartLine,
  FaUserCircle,
  FaStar,
  FaTimes,
} from "react-icons/fa";
import { MdAssignment } from "react-icons/md";
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

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentStudents, setRecentStudents] = useState([]);
  const [recentAssignments, setRecentAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  // category popup state
  const [catOpen, setCatOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [catLoading, setCatLoading] = useState(false);
  const [catError, setCatError] = useState("");
  const [catData, setCatData] = useState(null); // { totals, assignments, students, ... }
  const [detailView, setDetailView] = useState(null); // { type: 'assignment'|'student', data: {...} }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, studentsRes, assignmentsRes] = await Promise.all([
          axios.get("https://el-backend-ashen.vercel.app/admin/dashboard"),
          axios.get("https://el-backend-ashen.vercel.app/admin/studentslist"),
          axios.get("https://el-backend-ashen.vercel.app/admin/recentassignments"),
        ]);
        setStats(statsRes.data);
        setRecentStudents(studentsRes.data);
        setRecentAssignments(assignmentsRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const openCategory = async (category) => {
    setSelectedCategory(category);
    setCatOpen(true);
    setDetailView(null);
    setCatData(null);
    setCatError("");
    setCatLoading(true);
    try {
      const { data } = await axios.post(CATEGORY_SUMMARY_URL, { category });
      setCatData(data);
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
    setDetailView(null);
    setCatError("");
  };

  const showAssignment = (assignment) => setDetailView({ type: "assignment", data: assignment });
  const showStudent = (student) => setDetailView({ type: "student", data: student });
  const backToList = () => setDetailView(null);

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
        <div className="stat-card">
          <FaUsers className="stat-icon" />
          <div>
            <p>Total Students</p>
            <h3>{stats.totalStudents}</h3>
          </div>
        </div>

        <div className="stat-card">
          <FaClipboardList className="stat-icon pink" />
          <div>
            <p>Total Assignments</p>
            <h3>{stats.totalAssignments}</h3>
          </div>
        </div>

        <div className="stat-card">
          <FaCheckCircle className="stat-icon green" />
          <div>
            <p>Students Submitted</p>
            <h3>
              {stats.studentsSubmittedCount}/{stats.totalStudents}
            </h3>
          </div>
        </div>

        <div className="stat-card">
          <FaChartLine className="stat-icon blue" />
          <div>
            <p>Avg Progress</p>
            <h3>{stats.averageProgress}%</h3>
          </div>
        </div>

        <div className="stat-card">
          <FaStar className="stat-icon orange" />
          <div>
            <p>Avg Score</p>
            <h3>{stats.averageScore}%</h3>
          </div>
        </div>
      </div>

      {/* Recent Students & Assignments */}
      <div className="recent-container">
        {/* Recent Students */}
        <div className="recent-box">
          <h3>Recent Students</h3>
          {recentStudents.length === 0 ? (
            <p>No recent students</p>
          ) : (
            recentStudents.map((student, idx) => (
              <div key={idx} className="recent-item">
                <FaUserCircle className="avatar" />
                <div>
                  <p className="name">{student.name}</p>
                  <small>{student.courseName || "No Course"}</small>
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
            recentAssignments.map((assignment, idx) => (
              <div key={idx} className="recent-item">
                <MdAssignment className="avatar blue" />
                <div>
                  <p className="name">{assignment.moduleName}</p>
                  <small>
                    {new Date(assignment.assignedDate).toLocaleDateString()}
                  </small>
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
            {!detailView && (
              <>
                {/* Totals */}
                <div className="cat-totals">
                  <div className="mini-card">
                    <MdAssignment className="mini-ico" />
                    <div>
                      <small>Assignments</small>
                      <h4>{catData?.totals?.assignments ?? 0}</h4>
                    </div>
                  </div>
                  <div className="mini-card">
                    <FaUsers className="mini-ico" />
                    <div>
                      <small>Students</small>
                      <h4>{catData?.totals?.students ?? 0}</h4>
                    </div>
                  </div>
                </div>

                {/* Lists */}
                <div className="cat-lists">
                  <div className="cat-column">
                    <h4>Assignments</h4>
                    {catData.assignments?.length ? (
                      <ul className="click-list">
                        {catData.assignments.map((a) => (
                          <li key={a._id} onClick={() => showAssignment(a)}>
                            <div className="row">
                              <div className="left">
                                <MdAssignment />{" "}
                                <span className="title">{a.moduleName}</span>
                              </div>
                              <div className="right">
                                <small>
                                  {a.subAssignmentsCount ?? (a.subAssignments?.length || 0)} subs
                                </small>
                              </div>
                            </div>
                            <small className="muted">
                              {new Date(a.assignedDate).toLocaleDateString()}
                            </small>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted">No assignments</p>
                    )}
                  </div>

                  <div className="cat-column">
                    <h4>Students</h4>
                    {catData.students?.length ? (
                      <ul className="click-list">
                        {catData.students.map((s) => (
                          <li key={s._id} onClick={() => showStudent(s)}>
                            <div className="row">
                              <div className="left">
                                <FaUserCircle />{" "}
                                <span className="title">{s.name}</span>
                              </div>
                              <div className="right">
                                <small>{s.courseName}</small>
                              </div>
                            </div>
                            <small className="muted">
                              Enrolled:{" "}
                              {s.enrolledDate
                                ? new Date(s.enrolledDate).toLocaleDateString()
                                : "-"}
                            </small>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted">No students</p>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Detail Views */}
            {detailView?.type === "assignment" && (
              <div className="detail-view">
                <button className="back-btn" onClick={backToList}>← Back</button>
                <h4>Assignment</h4>
                <div className="kv">
                  <span>Module</span>
                  <b>{detailView.data.moduleName}</b>
                </div>
                <div className="kv">
                  <span>Category</span>
                  <b>{detailView.data.category}</b>
                </div>
                {detailView.data.assignmentPdf && (
                  <div className="kv">
                    <span>PDF</span>
                    <a href={detailView.data.assignmentPdf} target="_blank" rel="noreferrer">
                      Open PDF
                    </a>
                </div>
                )}
                <div className="kv">
                  <span>Assigned</span>
                  <b>{new Date(detailView.data.assignedDate).toLocaleString()}</b>
                </div>

                <div className="section">
                  <h5>Answer Key (parent)</h5>
                  {detailView.data.answerKey ? (
                    <pre className="pre">
{JSON.stringify(detailView.data.answerKey, null, 2)}
                    </pre>
                  ) : (
                    <p className="muted">—</p>
                  )}
                </div>

                <div className="section">
                  <h5>Sub-assignments</h5>
                  {detailView.data.subAssignments?.length ? (
                    <pre className="pre">
{JSON.stringify(detailView.data.subAssignments, null, 2)}
                    </pre>
                  ) : (
                    <p className="muted">None</p>
                  )}
                </div>
              </div>
            )}

            {detailView?.type === "student" && (
              <div className="detail-view">
                <button className="back-btn" onClick={backToList}>← Back</button>
                <h4>Student</h4>
                <div className="kv">
                  <span>Name</span>
                  <b>{detailView.data.name}</b>
                </div>
                <div className="kv">
                  <span>Course</span>
                  <b>{detailView.data.courseName}</b>
                </div>
                <div className="kv">
                  <span>Enrolled</span>
                  <b>
                    {detailView.data.enrolledDate
                      ? new Date(detailView.data.enrolledDate).toLocaleString()
                      : "-"}
                  </b>
                </div>
                {detailView.data.expiryDate && (
                  <div className="kv">
                    <span>Expiry</span>
                    <b>{new Date(detailView.data.expiryDate).toLocaleString()}</b>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}