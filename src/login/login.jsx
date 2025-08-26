import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const Login = () => {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await axios.post("https://el-backend-ashen.vercel.app/login", {
        name,
        password,
      });

      if (res.data?.success) {
        const user = res.data.user || {};
        const role = user.role || "user";
        const sessionId = res.data.sessionId || "";

        // Robust IDs and fields
        const userId = user.id || user._id || "";
        const courseName = user.courseName || ""; // <-- dashboard expects this in localStorage
        const enrolledDate = user.enrolledDate || "";
        const profileImage = Array.isArray(user.profileImage)
          ? (user.profileImage[0] || "")
          : (user.profileImage || "");

        // Persist everything we need for the dashboard
        localStorage.setItem("user", JSON.stringify(user));
        localStorage.setItem("sessionId", sessionId);
        localStorage.setItem("userId", userId);
        localStorage.setItem("courseName", courseName); // IMPORTANT
        localStorage.setItem("name", user.name || "");
        localStorage.setItem("role", role);
        localStorage.setItem("enrolledDate", enrolledDate);
        localStorage.setItem("profileImage", profileImage);

        // Route by role
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
    }
  };

  return (
    <div style={styles.container}>
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
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
          required
        />

        <button type="submit" style={styles.button}>
          Login
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
};

export default Login;