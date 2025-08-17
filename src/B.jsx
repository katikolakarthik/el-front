import React, { useEffect, useState } from "react";

export default function Assignments() {
  const [assignments, setAssignments] = useState([]);
  const [selectedSub, setSelectedSub] = useState(null);

  useEffect(() => {
            fetch("https://el-backend-ashen.vercel.app/admin/assignments")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setAssignments(data);
        } else {
          setAssignments([data]);
        }
      })
      .catch((err) => console.error("Error fetching assignments:", err));
  }, []);

  const handleSelectSubmodule = (sub) => {
    setSelectedSub(sub);
  };

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "sans-serif" }}>
      {/* Sidebar */}
      <div
        style={{
          width: "220px",
          borderRight: "1px solid #ddd",
          padding: "10px",
          background: "#f8f8f8",
        }}
      >
        <h3>Submodules</h3>
        {assignments.flatMap((module) =>
          module.subAssignments.map((sub) => (
            <div
              key={sub._id}
              style={{
                padding: "8px",
                margin: "5px 0",
                cursor: "pointer",
                background:
                  selectedSub && selectedSub._id === sub._id
                    ? "#e0e0e0"
                    : "#fff",
                borderRadius: "4px",
                border: "1px solid #ccc",
              }}
              onClick={() => handleSelectSubmodule(sub)}
            >
              {sub.subModuleName}
            </div>
          ))
        )}
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: "20px" }}>
        {selectedSub ? (
          <div style={{ display: "flex", gap: "20px" }}>
            {/* PDF Viewer in a Card */}
            <div style={{ flex: 2 }}>
              <h3>PDF Viewer</h3>
              <div
                style={{
                  border: "1px solid #ccc",
                  borderRadius: "8px",
                  overflow: "hidden",
                  height: "500px", // fixed height
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <iframe
                  src={`https://docs.google.com/viewer?url=${encodeURIComponent(
                    selectedSub.assignmentPdf
                  )}&embedded=true`}
                  title="Assignment PDF"
                  style={{
                    border: "none",
                    flex: 1,
                  }}
                ></iframe>
              </div>
            </div>

            {/* Form */}
            <div style={{ flex: 1 }}>
              <h3>Patient Details</h3>
              <div style={{ marginBottom: "10px" }}>
                <label>Age / DOB</label>
                <input
                  type="text"
                  style={{ width: "100%", padding: "6px", marginTop: "4px" }}
                />
              </div>
              <div style={{ marginBottom: "10px" }}>
                <label>ICD-10 Codes</label>
                <input
                  type="text"
                  style={{ width: "100%", padding: "6px", marginTop: "4px" }}
                />
              </div>
              <div style={{ marginBottom: "10px" }}>
                <label>CPT Codes</label>
                <input
                  type="text"
                  style={{ width: "100%", padding: "6px", marginTop: "4px" }}
                />
              </div>
              <div style={{ marginBottom: "10px" }}>
                <label>Notes</label>
                <textarea
                  style={{
                    width: "100%",
                    padding: "6px",
                    marginTop: "4px",
                    height: "80px",
                  }}
                ></textarea>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  style={{
                    flex: 1,
                    padding: "8px",
                    background: "#007bff",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Submit
                </button>
                <button
                  style={{
                    flex: 1,
                    padding: "8px",
                    background: "#6c757d",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Send to Audit
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p>Select a submodule to view details</p>
        )}
      </div>
    </div>
  );
}
