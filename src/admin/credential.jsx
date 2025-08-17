import React, { useState, useEffect } from 'react';
import "./credential.css";

const StudentCredentials = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const response = await fetch('https://el-backend-ashen.vercel.app/admin/students');
        if (!response.ok) {
          throw new Error('Failed to fetch student data');
        }
        const data = await response.json();

        const simplifiedData = data.map(student => ({
          name: student.name,
          password: student.password,
          courseName: student.courseName
        }));

        setStudents(simplifiedData);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  if (loading) return (
    <div className="student-credentials-container">
      <div className="loading-spinner">
        <div className="spinner"></div>
      </div>
    </div>
  );

  if (error) return (
    <div className="student-credentials-container">
      <div className="error-message">{error}</div>
    </div>
  );

  return (
    <div className="student-credentials-container">
      <h2 className="student-credentials-title">Student Credentials</h2>
      <table className="student-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Password</th>
            <th>Course Name</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student, index) => (
            <tr key={index}>
              <td>{student.name}</td>
              <td>{student.password}</td>
              <td>{student.courseName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default StudentCredentials;