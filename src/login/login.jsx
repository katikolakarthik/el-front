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

  try {
          const res = await axios.post("https://el-backend-ashen.vercel.app/login", {
      name,
      password,
    });

    if (res.data.success) {
      // Store the entire user object in localStorage
      localStorage.setItem("user", JSON.stringify(res.data.user));
      
      // Make sure we're using the correct ID field (either id or _id)
      const userId = res.data.user.id || res.data.user._id;
      localStorage.setItem("userId", userId);

      // Redirect based on role
      if (res.data.user.role === "admin") {
        navigate("/admin/dashboard");
      } else if (res.data.user.role === "user") {
        navigate("/student/dashboard");
      } else {
        setError("Invalid role assigned");
      }
    } else {
      setError(res.data.message || "Login failed");
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