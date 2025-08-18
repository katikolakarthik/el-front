import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './SubAdminManagement.css';

const SubAdminManagement = () => {
  const [subadmins, setSubadmins] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    password: '',
    id: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const API_BASE_URL = 'https://el-backend-ashen.vercel.app/admin';

  useEffect(() => {
    fetchSubadmins();
  }, []);

  const fetchSubadmins = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/subadmins`);
      setSubadmins(response.data.subadmins);
    } catch (error) {
      showMessage('Failed to fetch subadmins', 'error');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await axios.put(`${API_BASE_URL}/subadmin/${formData.id}`, {
          name: formData.name,
          password: formData.password
        });
        showMessage('Subadmin updated successfully', 'success');
      } else {
        await axios.post(`${API_BASE_URL}/add-subadmin`, {
          name: formData.name,
          password: formData.password
        });
        showMessage('Subadmin created successfully', 'success');
      }
      resetForm();
      fetchSubadmins();
    } catch (error) {
      showMessage(error.response?.data?.message || 'Operation failed', 'error');
    }
  };

  const handleEdit = (subadmin) => {
    setFormData({
      name: subadmin.name,
      password: '', // Don't pre-fill password for security
      id: subadmin._id
    });
    setIsEditing(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this subadmin?')) {
      try {
        await axios.delete(`${API_BASE_URL}/subadmin/${id}`);
        showMessage('Subadmin deleted successfully', 'success');
        fetchSubadmins();
      } catch (error) {
        showMessage('Failed to delete subadmin', 'error');
      }
    }
  };

  const resetForm = () => {
    setFormData({ name: '', password: '', id: '' });
    setIsEditing(false);
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 3000);
  };

  return (
    <div className="subadmin-container">
      <h2>Subadmin Management</h2>
      
      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="form-section">
        <h3>{isEditing ? 'Edit Subadmin' : 'Add New Subadmin'}</h3>
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
              required={!isEditing}
              placeholder={isEditing ? 'Leave empty to keep current' : ''}
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">
              {isEditing ? 'Update' : 'Create'}
            </button>
            {isEditing && (
              <button type="button" className="btn-secondary" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="list-section">
        <h3>Existing Subadmins</h3>
        {subadmins.length === 0 ? (
          <p>No subadmins found</p>
        ) : (
          <table className="subadmin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subadmins.map(subadmin => (
                <tr key={subadmin._id}>
                  <td>{subadmin.name}</td>
                  <td>
                    <button 
                      onClick={() => handleEdit(subadmin)}
                      className="btn-edit"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(subadmin._id)}
                      className="btn-delete"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default SubAdminManagement;