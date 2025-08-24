import React, { useState, useEffect } from 'react';

const StudentCredentials = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Internal CSS
  const styles = {
    container: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '2rem',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    },
    title: {
      fontSize: '1.75rem',
      fontWeight: '600',
      color: '#111827',
      marginBottom: '1.5rem',
      textAlign: 'center'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
      borderRadius: '0.5rem',
      overflow: 'hidden'
    },
    tableHeader: {
      backgroundColor: '#f3f4f6',
      color: '#374151',
      textAlign: 'left',
      padding: '1rem',
      fontWeight: '600',
      borderBottom: '1px solid #e5e7eb'
    },
    tableCell: {
      padding: '1rem',
      borderBottom: '1px solid #e5e7eb',
      color: '#4b5563'
    },
    tableRow: {
      transition: 'background-color 0.2s ease',
      '&:hover': {
        backgroundColor: '#f9fafb'
      },
      '&:last-child td': {
        borderBottom: 'none'
      }
    },
    loadingContainer: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '200px'
    },
    spinner: {
      width: '40px',
      height: '40px',
      border: '4px solid rgba(99, 102, 241, 0.2)',
      borderTopColor: '#6366f1',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    },
    errorMessage: {
      color: '#ef4444',
      padding: '1rem',
      backgroundColor: '#fee2e2',
      borderRadius: '0.375rem',
      textAlign: 'center',
      margin: '2rem auto',
      maxWidth: '500px'
    },
    '@keyframes spin': {
      '0%': { transform: 'rotate(0deg)' },
      '100%': { transform: 'rotate(360deg)' }
    }
  };

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
    <div style={styles.container}>
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
      </div>
    </div>
  );

  if (error) return (
    <div style={styles.container}>
      <div style={styles.errorMessage}>{error}</div>
    </div>
  );

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Student Credentials</h2>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.tableHeader}>Name</th>
            <th style={styles.tableHeader}>Password</th>
            <th style={styles.tableHeader}>Course Name</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student, index) => (
            <tr key={index} style={styles.tableRow}>
              <td style={styles.tableCell}>{student.name}</td>
              <td style={styles.tableCell}>{student.password}</td>
              <td style={styles.tableCell}>{student.courseName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default StudentCredentials;