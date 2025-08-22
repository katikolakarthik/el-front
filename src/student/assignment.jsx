import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FiBook, FiClock } from 'react-icons/fi';
import './AssignmentFlow.css';

const API_BASE = 'https://el-backend-ashen.vercel.app';

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
      return {
        ...sub,
        questions: sub.dynamicQuestions.map((q) => ({ ...q, type: 'dynamic' })),
      };
    } else if (sub.answerKey) {
      return { ...sub, questions: [{ type: 'predefined', answerKey: sub.answerKey }] };
    }
    return { ...sub, questions: sub.questions || [] };
  });

  return norm;
};

const sortByAssignedDesc = (arr) =>
  [...arr].sort(
    (a, b) =>
      new Date(b?.assignedDate || 0).getTime() -
      new Date(a?.assignedDate || 0).getTime()
  );

const NewAssignments = () => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeAssignment, setActiveAssignment] = useState(null);
  const [activeSubAssignment, setActiveSubAssignment] = useState(null);
  const [answers, setAnswers] = useState({});

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const userId = localStorage.getItem('userId');
        if (!userId) throw new Error('User ID not found');

        // 1️⃣ Get courseName from student API
        const studentRes = await axios.get(`${API_BASE}/student/${userId}/course`);
        const courseName = studentRes.data?.courseName;
        if (!courseName) throw new Error('Course name not found');

        // 2️⃣ Fetch assignments using courseName
        const assignmentRes = await axios.get(`${API_BASE}/category/${courseName}`);
        const normalized = (assignmentRes.data || []).map(normalizeAssignment);
        setAssignments(sortByAssignedDesc(normalized));
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchAssignments();
  }, []);

  const formatDate = (dateString) =>
    dateString
      ? new Date(dateString).toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : '—';

  const handleStart = async (assignmentId, subAssignmentId = null) => {
    try {
      const userId = localStorage.getItem('userId');
      setLoading(true);
      // keep same logic here later for starting assignment
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const userId = localStorage.getItem('userId');
      if (!userId) throw new Error('User ID not found');
      // keep same submission logic (already implemented in backend)
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAnswerChange = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const renderQuestions = (target) => {
    if (!target) return null;
    return (
      <div className="questions">
        {target.questions.map((q, i) => (
          <div key={i} className="question">
            <p>{q.questionText || 'Question'}</p>
            <input
              type="text"
              onChange={(e) => handleAnswerChange(i, e.target.value)}
            />
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="container">
        <div className="page-header">
          <h2 className="title">
            <FiBook className="icon" /> New Assignments
          </h2>
        </div>
        <div className="skeleton-list">
          {[...Array(3)].map((_, i) => (
            <div className="skeleton-card" key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="empty-state error">
          <div className="empty-icon">
            <FiClock />
          </div>
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
            <button
              className="btn btn-ghost"
              onClick={() => setActiveAssignment(null)}
            >
              Back
            </button>
            <h3 className="title-sm">{activeAssignment.moduleName}</h3>
          </div>
          <div className="sub-assignments">
            {activeAssignment.subAssignments.map((sub) => (
              <div
                key={sub._id}
                className="card"
                onClick={() => setActiveSubAssignment(sub)}
              >
                <h4>{sub.moduleName}</h4>
                <p>Assigned: {formatDate(sub.assignedDate)}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="container">
        <div className="page-header">
          <button
            className="btn btn-ghost"
            onClick={() => setActiveSubAssignment(null)}
          >
            Back
          </button>
          <h3 className="title-sm">
            {activeSubAssignment?.moduleName || activeAssignment.moduleName}
          </h3>
        </div>
        {renderQuestions(activeSubAssignment || activeAssignment)}
        <button className="btn btn-primary" onClick={handleSubmit}>
          Submit
        </button>
      </div>
    );
  }

  // CARDS VIEW
  return (
    <div className="container">
      <div className="page-header">
        <h2 className="title">
          <FiBook className="icon" /> New Assignments
        </h2>
      </div>
      <div className="card-list">
        {assignments.map((assignment) => (
          <div
            key={assignment._id}
            className="card"
            onClick={() => setActiveAssignment(assignment)}
          >
            <h3>{assignment.moduleName}</h3>
            <p>Assigned: {formatDate(assignment.assignedDate)}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NewAssignments;