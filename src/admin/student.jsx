import React, { useState, useEffect, useCallback } from "react";
import { FaChevronDown, FaTrash, FaTimes, FaEllipsisV, FaPlus, FaEdit } from "react-icons/fa";
import axios from "axios";
import "./student.css";

const API_URL = "http://localhost:5000/admin";

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
    profileImage: null
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this student?")) {
      setIsDeleting(true);
      try {
        await axios.delete(`${API_URL}/student/${id}`);
        fetchStudents(); // Refresh the list
      } catch (err) {
        console.error("Error deleting student:", err);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const openDetailsModal = (student) => {
    setSelectedStudent(student);
    setIsDetailsModalOpen(true);
    document.addEventListener('keydown', handleKeyDown);
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
    
    const formDataToSend = new FormData();
    formDataToSend.append('name', formData.name);
    formDataToSend.append('password', formData.password);
    formDataToSend.append('courseName', formData.courseName);
    formDataToSend.append('paidAmount', formData.paidAmount);
    formDataToSend.append('remainingAmount', formData.remainingAmount);
    formDataToSend.append('enrolledDate', formData.enrolledDate);
    if (selectedFile) {
      formDataToSend.append('profileImage', selectedFile);
    }

    try {
      if (isEditMode && formData.id) {
        // Edit existing student
        await axios.put(`${API_URL}/student/${formData.id}`, formDataToSend, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
      } else {
        // Add new student
        await axios.post(`${API_URL}/add-student`, formDataToSend, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
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
    assignments.reduce((acc, curr) => {
      acc[curr.moduleName] = acc[curr.moduleName] || [];
      acc[curr.moduleName].push(curr);
      return acc;
    }, {});

  return (
    <div className="students-container">
      <div className="students-header">
        <h2>Students</h2>
        <button 
          onClick={() => openFormModal()} 
          className="add-student-btn"
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
        <table className="students-table">
          <thead>
            <tr>
              <th>Profile</th>
              <th>Name</th>
              <th>Course</th>
              <th>Enrolled Date</th>
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
                  <tr key={s.id} className="student-row">  
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
                    <td className="actions-cell">  
                      <div className="actions-wrapper">  
                        <button  
                          onClick={() => openDetailsModal(s)}  
                          className="details-btn"  
                          title="View details"  
                        >  
                          <FaEllipsisV />  
                        </button>
                        <button
                          onClick={() => openFormModal(s)}
                          className="edit-btn"
                          title="Edit student"
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
                <td colSpan="5" className="no-students-message">
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
              <button onClick={closeModal} className="close-btn">  
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
                  <p><strong>Paid Amount:</strong> {selectedStudent.paidAmount ?? 0}</p>  
                  <p><strong>Remaining Amount:</strong> {selectedStudent.remainingAmount ?? 0}</p>  
                  <p><strong>Overall Progress:</strong> {selectedStudent.progress?.overallProgress ?? 0}%</p>  
                  <p><strong>Total Correct:</strong> {selectedStudent.progress?.totalCorrect ?? 0}</p>  
                  <p><strong>Total Wrong:</strong> {selectedStudent.progress?.totalWrong ?? 0}</p>  
                </div>  
              </div>  

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
              <button onClick={closeModal} className="close-btn">
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
                  />
                </div>

                <div className="form-group">
                  <label>Course:</label>
                  <input
                    type="text"
                    name="courseName"
                    value={formData.courseName}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Paid Amount:</label>
                    <input
                      type="number"
                      name="paidAmount"
                      value={formData.paidAmount}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label>Remaining Amount:</label>
                    <input
                      type="number"
                      name="remainingAmount"
                      value={formData.remainingAmount}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Enrolled Date:</label>
                  <input
                    type="date"
                    name="enrolledDate"
                    value={formData.enrolledDate}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label>Profile Image:</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
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
                  <button type="button" onClick={closeModal} className="cancel-btn">
                    Cancel
                  </button>
                  <button type="submit" className="submit-btn" disabled={isSubmitting}>
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