import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const Login = () => {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false); // NEW
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true); // show "Processing..."

    try {
      const res = await axios.post("https://el-backend-ashen.vercel.app/login", {
        name,
        password,
      });

      if (res.data?.success) {
        const user = res.data.user || {};
        const role = user.role || "user";
        const sessionId = res.data.sessionId || "";

        const userId = user.id || user._id || "";
        const courseName = user.courseName || "";
        const enrolledDate = user.enrolledDate || "";
        const profileImage = Array.isArray(user.profileImage)
          ? (user.profileImage[0] || "")
          : (user.profileImage || "");

        localStorage.setItem("user", JSON.stringify(user));
        localStorage.setItem("sessionId", sessionId);
        localStorage.setItem("userId", userId);
        localStorage.setItem("courseName", courseName);
        localStorage.setItem("name", user.name || "");
        localStorage.setItem("role", role);
        localStorage.setItem("enrolledDate", enrolledDate);
        localStorage.setItem("profileImage", profileImage);

        if (role === "admin" || role === "subadmin") {
          navigate("/admin/dashboard");
        } else if (role === "user") {
          navigate("/student/dashboard");
        } else {
          setError("Invalid role assigned");
        }
      } else {
        setError(res.data?.message || "Login failed");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Server error");
    } finally {
      setLoading(false); // hide "Processing..."
    }
  };

  return (
    <div style={styles.container} aria-busy={loading}>
      <h2 style={styles.heading}>Wellmed Medical Coding Login</h2>
      {error && <p style={styles.error}>{error}</p>}

      <form onSubmit={handleLogin} style={styles.form}>
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={styles.input}
          required
          disabled={loading}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
          required
          disabled={loading}
        />

        <button type="submit" style={{...styles.button, opacity: loading ? 0.7 : 1}} disabled={loading}>
          {loading ? "Processing..." : "Login"}
        </button>
      </form>

      
    </div>
  );
};

const styles = {
  container: {
    maxWidth: "350px",
    margin: "60px auto",
    padding: "20px",
    border: "1px solid #ccc",
    borderRadius: "10px",
    textAlign: "center",
    background: "#f9f9f9",
  },
  heading: {
    marginBottom: "20px",
    color: "#333",
  },
  form: {
    display: "flex",
    flexDirection: "column",
  },
  input: {
    padding: "10px",
    margin: "8px 0",
    borderRadius: "5px",
    border: "1px solid #ccc",
  },
  button: {
    padding: "10px",
    marginTop: "10px",
    backgroundColor: "#007bff",
    color: "#fff",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
  },
  error: {
    color: "red",
    fontSize: "14px",
    marginBottom: "10px",
  },
  loading: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexDirection: "column",
    marginTop: 12,
  },
};

export default Login;