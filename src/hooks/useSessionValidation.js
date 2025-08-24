import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const useSessionValidation = () => {
  const navigate = useNavigate();
  const intervalRef = useRef(null);

  const validateSession = async () => {
    try {
      const sessionId = localStorage.getItem('sessionId');
      if (!sessionId) {
        // No session, redirect to login
        handleSessionExpired();
        return;
      }

      const response = await axios.get('http://localhost:5000/validate-session', {
        headers: {
          'x-session-id': sessionId
        }
      });

      if (!response.data.success) {
        // Session invalid, redirect to login
        handleSessionExpired();
      }
    } catch (error) {
      console.error('Session validation error:', error);
      // Session validation failed, redirect to login
      handleSessionExpired();
    }
  };

  const handleSessionExpired = () => {
    // Clear all stored data
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    localStorage.removeItem('sessionId');
    
    // Redirect to login
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    // Validate session every 5 minutes
    intervalRef.current = setInterval(validateSession, 5 * 60 * 1000);

    // Also validate on window focus (when user comes back to tab)
    const handleFocus = () => {
      validateSession();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      window.removeEventListener('focus', handleFocus);
    };
  }, [navigate]);

  return { validateSession, handleSessionExpired };
};

export default useSessionValidation;
