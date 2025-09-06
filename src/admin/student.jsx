import React, { useState, useEffect, useCallback } from "react";
import { FaChevronDown, FaTrash, FaTimes, FaEllipsisV, FaPlus, FaEdit } from "react-icons/fa";
import axios from "axios";
import "./student.css";

const API_URL = "https://el-backend-ashen.vercel.app/admin";

export default function Students() {
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    password: "",
    courseName: "",
    paidAmount: 0,
    remainingAmount: 0,
    enrolledDate: new Date().toISOString().split('T')[0],
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Default: 30 days from now
    profileImage: null
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // delete + global processing overlay
  const [isDeleting, setIsDeleting] = useState(false);

  // stats loader for submitted/not-submitted section
  const [isStatsLoading, setIsStatsLoading] = useState(false);

  const CATEGORY_OPTIONS = ["CPC", "CCS", "IP-DRG", "SURGERY", "Denials", "ED", "E and M"];

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/students/summary`);
      setStudents(res.data);
    } catch (err) {
      console.error("Error fetching students:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // DELETE with full-screen processing overlay
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this student?")) return;
    setIsDeleting(true);
    try {
      await axios.delete(`${API_URL}/student/${id}`);
      // refresh list
      await fetchStudents();
      // close any open modal so overlay isn't stuck
      closeModal();
    } catch (err) {
      console.error("Error deleting student:", err);
      alert("Error deleting student: " + (err?.response?.data?.message || err.message));
    } finally {
      setIsDeleting(false);
    }
  };

  // fetch stats for a single student and inject into selectedStudent
  const fetchAndInjectStudentStats = async (student) => {
    try {
      setIsStatsLoading(true);

      const url = `https://el-backend-ashen.vercel.app/student/stats/${student.id}`;
      const { data } = await axios.get(url);

      if (!data?.success) return;

      const stats = data.stats || {};
      const submittedAssignmentsRaw = stats.submittedAssignments || [];
      const pendingAssignmentsRaw = stats.pendingAssignments || [];

      // Submitted (flatten to sub-level for existing UI)
      const submittedFlattened = submittedAssignmentsRaw.flatMap(a => {
        const subs = a.subAssignments || [];
        if (!subs.length) {
          return [{
            _id: a.assignmentId,
            moduleName: a.moduleName,
            subModuleName: a.moduleName,
            progressPercent: a.overallProgress ?? 0,
            correctCount: a.totalCorrect ?? 0,
            wrongCount: a.totalWrong ?? 0
          }];
        }
        return subs.map(sub => ({
          _id: sub.subAssignmentId,
          moduleName: a.moduleName,
          subModuleName: sub.subModuleName || "",
          progressPercent: sub.progressPercent ?? 0,
          correctCount: sub.correctCount ?? 0,
          wrongCount: sub.wrongCount ?? 0
        }));
      });

      // Not submitted: one row per assignment (grouped by module in UI)
      const notSubmittedMapped = pendingAssignmentsRaw.map(p => ({
        _id: p._id,
        moduleName: p.moduleName,
        subModuleName: p.moduleName
      }));

      // Optional aggregates for header block
      const overallProgressAvg = Math.round(
        submittedAssignmentsRaw.length
          ? submittedAssignmentsRaw.reduce((acc, a) => acc + (a.overallProgress ?? 0), 0) / submittedAssignmentsRaw.length
          : 0
      );
      const totalCorrectSum = submittedAssignmentsRaw.reduce((acc, a) => acc + (a.totalCorrect ?? 0), 0);
      const totalWrongSum = submittedAssignmentsRaw.reduce((acc, a) => acc + (a.totalWrong ?? 0), 0);

      setSelectedStudent(prev => ({
        ...prev,
        submittedCount: stats.submittedCount ?? submittedAssignmentsRaw.length ?? 0,
        notSubmittedCount: stats.pendingCount ?? pendingAssignmentsRaw.length ?? 0,
        submittedAssignments: submittedFlattened,
        notSubmittedAssignments: notSubmittedMapped,
        progress: {
          overallProgress: overallProgressAvg,
          totalCorrect: totalCorrectSum,
          totalWrong: totalWrongSum
        }
      }));
    } catch (err) {
      console.error("Error fetching student stats:", err);
    } finally {
      setIsStatsLoading(false);
    }
  };

  const openDetailsModal = (student) => {
    setSelectedStudent(student);
    setIsDetailsModalOpen(true);
    document.addEventListener('keydown', handleKeyDown);

    // fetch stats for submitted/not-submitted sections
    fetchAndInjectStudentStats(student);
  };

  const openFormModal = (student = null) => {
    if (student) {
      // Edit mode
      setIsEditMode(true);
      setFormData({
        id: student.id,
        name: student.name,
        password: '', // Password is not retrieved from backend for security
        courseName: student.courseName || "",
        paidAmount: student.paidAmount || 0,
        remainingAmount: student.remainingAmount || 0,
        enrolledDate: student.enrolledDate ? student.enrolledDate.split('T')[0] : new Date().toISOString().split('T')[0],
        expiryDate: student.expiryDate ? student.expiryDate.split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        profileImage: student.profileImage || null
      });
    } else {
      // Add mode
      setIsEditMode(false);
      setFormData({
        name: "",
        password: "",
        courseName: "",
        paidAmount: 0,
        remainingAmount: 0,
        enrolledDate: new Date().toISOString().split('T')[0],
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        profileImage: null
      });
    }
    setSelectedFile(null);
    setIsFormModalOpen(true);
    document.addEventListener('keydown', handleKeyDown);
  };

  const closeModal = useCallback(() => {
    setIsDetailsModalOpen(false);
    setIsFormModalOpen(false);
    setSelectedStudent(null);
    document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  }, [closeModal]);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Build form data
    const formDataToSend = new FormData();
    formDataToSend.append('name', formData.name);

    // Only send password when adding OR when user typed a new one in edit mode
    if (!isEditMode || (formData.password && formData.password.trim() !== '')) {
      formDataToSend.append('password', formData.password.trim());
    }

    formDataToSend.append('courseName', formData.courseName);
    formDataToSend.append('paidAmount', formData.paidAmount);
    formDataToSend.append('remainingAmount', formData.remainingAmount);
    formDataToSend.append('enrolledDate', formData.enrolledDate);
    formDataToSend.append('expiryDate', formData.expiryDate);

    if (selectedFile) {
      formDataToSend.append('profileImage', selectedFile);
    }

    try {
      if (isEditMode && formData.id) {
        // Edit existing student
        await axios.put(`${API_URL}/student/${formData.id}`, formDataToSend, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        // Add new student
        await axios.post(`${API_URL}/add-student`, formDataToSend, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      fetchStudents();
      closeModal();
    } catch (err) {
      console.error("Error saving student:", err);
      alert("Error saving student: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const groupByModule = (assignments) =>
    (assignments || []).reduce((acc, curr) => {
      acc[curr.moduleName] = acc[curr.moduleName] || [];
      acc[curr.moduleName].push(curr);
      return acc;
    }, {});

  // Function to format date and add expiry status
  const formatDateWithStatus = (dateString) => {
    if (!dateString) return "—";

    const date = new Date(dateString);
    const now = new Date();
    const isExpired = date < now;

    return (
      <span className={isExpired ? "expired-date" : "active-date"}>
        {date.toLocaleDateString()} {isExpired && "(Expired)"}
      </span>
    );
  };

  return (
    <div className="students-container">
      {/* GLOBAL PROCESSING OVERLAY (Delete) */}
      {isDeleting && (
        <div className="processing-overlay" aria-live="assertive" aria-busy="true">
          <div className="processing-dialog" role="dialog" aria-modal="true">
            <div className="processing-spinner" />
            <p>Processing…</p>
          </div>
        </div>
      )}

      <div className="students-header">
        <h2>Students</h2>
        <button 
          onClick={() => openFormModal()} 
          className="add-student-btn"
          disabled={isDeleting}
        >
          <FaPlus /> Add Student
        </button>
      </div>

      {isLoading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading students...</p>
        </div>
      ) : (
        <table className="students-table" aria-disabled={isDeleting}>
          <thead>
            <tr>
              <th>Profile</th>
              <th>Name</th>
              <th>Course</th>
              <th>Enrolled Date</th>
              <th>Expiry Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.length > 0 ? (
              students.map((s) => {
                const enrolledDate = s.enrolledDate
                  ? new Date(s.enrolledDate).toLocaleDateString()
                  : "—";

                return (  
                  <tr key={s.id} className={`student-row ${isDeleting ? "disabled-row" : ""}`}>  
                    <td>  
                      {s.profileImage ? (  
                        <img  
                          src={s.profileImage}  
                          alt={s.name}  
                          className="profile-img"  
                        />  
                      ) : (  
                        <img 
                          src="https://res.cloudinary.com/dppiuypop/image/upload/v1755322490/uploads/hp2mrub5fgg5xdxugyy5.jpg" 
                          alt="Profile"
                          className="profile-img"
                        />
                      )}  
                    </td>  
                    <td className="student-name">{s.name}</td>  
                    <td>{s.courseName || "—"}</td>  
                    <td>{enrolledDate}</td>
                    <td>{formatDateWithStatus(s.expiryDate)}</td>
                    <td className="actions-cell">  
                      <div className="actions-wrapper">  
                        <button  
                          onClick={() => openDetailsModal(s)}  
                          className="details-btn"  
                          title="View details"  
                          disabled={isDeleting}
                        >  
                          <FaEllipsisV />  
                        </button>
                        <button
                          onClick={() => openFormModal(s)}
                          className="edit-btn"
                          title="Edit student"
                          disabled={isDeleting}
                        >
                          <FaEdit />
                        </button>
                      </div>  
                    </td>  
                  </tr>  
                );  
              })
            ) : (
              <tr>
                <td colSpan="6" className="no-students-message">
                  No students found
                </td>
              </tr>
            )}
          </tbody>  
        </table>
      )}

      {/* Details Modal */}
      {isDetailsModalOpen && selectedStudent && (  
        <div className="modal-overlay" onClick={handleOverlayClick}>  
          <div className="modal">  
            <div className="modal-header">  
              <h3>{selectedStudent.name}'s Details</h3>  
              <button onClick={closeModal} className="close-btn" disabled={isDeleting}>  
                <FaTimes />  
              </button>  
            </div>  
            <div className="modal-content">  
              <div className="student-info">  
                <div className="profile-section">  
                  {selectedStudent.profileImage ? (  
                    <img  
                      src={selectedStudent.profileImage}  
                      alt={selectedStudent.name}  
                      className="modal-profile-img"  
                    />  
                  ) : (  
                    <div className="modal-placeholder-profile">—</div>  
                  )}  
                </div>  
                <div className="info-section">  
                  <p><strong>Course:</strong> {selectedStudent.courseName || "—"}</p>  
                  <p><strong>Enrolled Date:</strong> {selectedStudent.enrolledDate ? new Date(selectedStudent.enrolledDate).toLocaleDateString() : "—"}</p>  
                  <p><strong>Expiry Date:</strong> {formatDateWithStatus(selectedStudent.expiryDate)}</p>
                  <p><strong>Paid Amount:</strong> {selectedStudent.paidAmount ?? 0}</p>  
                  <p><strong>Remaining Amount:</strong> {selectedStudent.remainingAmount ?? 0}</p>  
                  <p><strong>Overall Progress:</strong> {selectedStudent.progress?.overallProgress ?? 0}%</p>  
                  <p><strong>Total Correct:</strong> {selectedStudent.progress?.totalCorrect ?? 0}</p>  
                  <p><strong>Total Wrong:</strong> {selectedStudent.progress?.totalWrong ?? 0}</p>  
                </div>  
              </div>  

              {/* stats loader */}
              {isStatsLoading && (
                <div className="loading-container" style={{ marginTop: 8 }}>
                  <div className="loading-spinner" />
                  <p>Loading assignment stats…</p>
                </div>
              )}

              <div className="assignments-sections">  
                <div className="assignments-section">  
                  <h4>Submitted Assignments ({selectedStudent.submittedCount || 0})</h4>  
                  {Object.keys(groupByModule(selectedStudent.submittedAssignments || [])).length === 0 ? (  
                    <p className="no-data">No submissions yet.</p>  
                  ) : (  
                    <>  
                      {Object.entries(groupByModule(selectedStudent.submittedAssignments || [])).map(([moduleName, assignments]) => (  
                        <div key={moduleName} className="module-group">  
                          <h5>{moduleName}</h5>  
                          <ul>  
                            {assignments.map(({ _id, subModuleName, progressPercent, correctCount, wrongCount }) => (  
                              <li key={_id}>  
                                {subModuleName}   
                                <span className="progress-details">  
                                  (Progress: {progressPercent}%,   
                                  Correct: {correctCount},   
                                  Wrong: {wrongCount})  
                                </span>  
                              </li>  
                            ))}  
                          </ul>  
                        </div>  
                      ))}  
                    </>  
                  )}  
                </div>  

                <div className="assignments-section">  
                  <h4>Not Submitted Assignments ({selectedStudent.notSubmittedCount || 0})</h4>  
                  {Object.keys(groupByModule(selectedStudent.notSubmittedAssignments || [])).length === 0 ? (  
                    <p className="no-data">All assignments submitted.</p>  
                  ) : (  
                    <>  
                      {Object.entries(groupByModule(selectedStudent.notSubmittedAssignments || [])).map(([moduleName, assignments]) => (  
                        <div key={moduleName} className="module-group">  
                          <h5>{moduleName}</h5>  
                          <ul>  
                            {assignments.map(({ _id, subModuleName }) => (  
                              <li key={_id}>{subModuleName}</li>  
                            ))}  
                          </ul>  
                        </div>  
                      ))}  
                    </>  
                  )}  
                </div>  
              </div>  

              <div className="modal-footer">  
                <button   
                  onClick={() => handleDelete(selectedStudent.id)}   
                  className="delete-btn"  
                  disabled={isDeleting}
                >  
                  {isDeleting ? (
                    <>
                      <div className="button-spinner"></div> Deleting...
                    </>
                  ) : (
                    <>
                      <FaTrash /> Delete Student
                    </>
                  )}
                </button>  
                <button
                  onClick={() => {
                    closeModal();
                    openFormModal(selectedStudent);
                  }}
                  className="edit-btn"
                  disabled={isDeleting}
                >
                  <FaEdit /> Edit Student
                </button>
              </div>  
            </div>  
          </div>  
        </div>  
      )}

      {/* Add/Edit Form Modal */}
      {isFormModalOpen && (
        <div className="modal-overlay" onClick={handleOverlayClick}>
          <div className="modal form-modal">
            <div className="modal-header">
              <h3>{isEditMode ? 'Edit Student' : 'Add New Student'}</h3>
              <button onClick={closeModal} className="close-btn" disabled={isDeleting}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-content">
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Name:</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    disabled={isDeleting}
                  />
                </div>

                <div className="form-group">
                  <label>Password:</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required={!isEditMode}
                    placeholder={isEditMode ? "Leave blank to keep current password" : ""}
                    disabled={isDeleting}
                  />
                </div>

                <div className="form-group">
                  <label>Course:</label>
                  <select
                    name="courseName"
                    value={formData.courseName}
                    onChange={handleInputChange}
                    required
                    disabled={isDeleting}
                  >
                    <option value="">-- Select a Category --</option>
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Paid Amount:</label>
                    <input
                      type="number"
                      name="paidAmount"
                      value={formData.paidAmount}
                      onChange={handleInputChange}
                      disabled={isDeleting}
                    />
                  </div>

                  <div className="form-group">
                    <label>Remaining Amount:</label>
                    <input
                      type="number"
                      name="remainingAmount"
                      value={formData.remainingAmount}
                      onChange={handleInputChange}
                      disabled={isDeleting}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Enrolled Date:</label>
                    <input
                      type="date"
                      name="enrolledDate"
                      value={formData.enrolledDate}
                      onChange={handleInputChange}
                      disabled={isDeleting}
                    />
                  </div>

                  <div className="form-group">
                    <label>Expiry Date:</label>
                    <input
                      type="date"
                      name="expiryDate"
                      value={formData.expiryDate}
                      onChange={handleInputChange}
                      required
                      disabled={isDeleting}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Profile Image:</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={isDeleting}
                  />
                  {formData.profileImage && !selectedFile && (
                    <div className="current-image-preview">
                      <p>Current Image:</p>
                      <img 
                        src={formData.profileImage} 
                        alt="Current profile" 
                        className="preview-img" 
                      />
                    </div>
                  )}
                </div>

                <div className="form-actions">
                  <button type="button" onClick={closeModal} className="cancel-btn" disabled={isDeleting}>
                    Cancel
                  </button>
                  <button type="submit" className="submit-btn" disabled={isSubmitting || isDeleting}>
                    {isSubmitting ? (
                      <>
                        <div className="button-spinner"></div> 
                        {isEditMode ? 'Updating...' : 'Adding...'}
                      </>
                    ) : (
                      <>
                        {isEditMode ? 'Update Student' : 'Add Student'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}