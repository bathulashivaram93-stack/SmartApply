import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
const DEPARTMENTS = [
  "CSE",
  "ECE",
  "EEE",
  "MECH",
  "CIVIL",
  "IT",
  "ATML",
];

const REQUEST_TYPES = [
  "Leave Application",
  "Bonafide Certificate",
  "OD Permission",
  "Other",
];

const emptyRegister = {
  name: "",
  email: "",
  password: "",
  department: "CSE",
  rollNo: "",
};

const emptyLogin = {
  email: "",
  password: "",
};

const emptyApplication = {
  title: "",
  type: REQUEST_TYPES[0],
  reason: "",
  department: "CSE",
  facultyId: "",
};

function getId(value) {
  return value?._id || value?.id || value || "";
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-IN");
}

function getErrorMessage(error) {
  return error?.message || "Something went wrong. Please try again.";
}

export default function App() {
  const [mode, setMode] = useState("login");
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("smartapply_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [registerForm, setRegisterForm] = useState(emptyRegister);
  const [loginForm, setLoginForm] = useState(emptyLogin);
  const [applicationForm, setApplicationForm] = useState(emptyApplication);

  const [attachment, setAttachment] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const [staff, setStaff] = useState([]);
  const [applications, setApplications] = useState([]);

  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [pageMessage, setPageMessage] = useState("");
  const [notes, setNotes] = useState({});

  const API_BASE = (
    import.meta.env.VITE_API_URL || "http://localhost:5000/api"
  ).replace(/\/$/, "");

  const isStudent = user?.role === "student";
  const isFaculty = user?.role === "faculty";
  const isHod = user?.role === "hod";
  const isAdmin = user?.role === "admin";

  const visibleStaff = useMemo(
    () => staff.filter((member) => member.role === "faculty"),
    [staff]
  );

  const stats = useMemo(
    () => ({
      total: applications.length,
      submitted: applications.filter(
        (item) => item.status === "Submitted"
      ).length,
      forwarded: applications.filter(
        (item) => item.status === "Forwarded to HOD"
      ).length,
      approved: applications.filter(
        (item) => item.status === "Approved"
      ).length,
      rejected: applications.filter(
        (item) => item.status === "Rejected"
      ).length,
    }),
    [applications]
  );

  const loadApplications = useCallback(async () => {
    const result = await api("/applications");
    setApplications(result.applications || []);
  }, []);

  const loadStaff = useCallback(async (department) => {
    if (!department) {
      setStaff([]);
      return;
    }

    const result = await api(
      `/applications/staff?department=${encodeURIComponent(department)}`
    );

    setStaff(result.staff || []);
  }, []);

  const refreshDashboard = useCallback(async () => {
    if (!user) return;

    setPageError("");

    try {
      await loadApplications();

      if (user.role === "student" || user.role === "admin") {
        await loadStaff(
          user.role === "student"
            ? user.department
            : applicationForm.department
        );
      }
    } catch (error) {
      setPageError(getErrorMessage(error));
    }
  }, [user, applicationForm.department, loadApplications, loadStaff]);

  useEffect(() => {
    if (user) {
      refreshDashboard();
    }
  }, [user, refreshDashboard]);

  useEffect(() => {
    if (user?.role === "student" && user.department) {
      setApplicationForm((previous) => ({
        ...previous,
        department: user.department,
      }));
    }
  }, [user]);

  function updateRegister(field, value) {
    setRegisterForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function updateLogin(field, value) {
    setLoginForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function updateApplication(field, value) {
    setApplicationForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function handleRegister(event) {
    event.preventDefault();
    setLoading(true);
    setPageError("");
    setPageMessage("");

    try {
      const result = await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: registerForm.name.trim(),
          email: registerForm.email.trim(),
          password: registerForm.password,
          department: registerForm.department,
          rollNo: registerForm.rollNo.trim().toUpperCase(),
        }),
      });

      setPageMessage(
        result.message || "Registration successful. Please log in."
      );
      setRegisterForm(emptyRegister);
      setMode("login");
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setLoading(true);
    setPageError("");
    setPageMessage("");

    try {
      const result = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify(loginForm),
      });

      if (!result.token || !result.user) {
        throw new Error("The server returned an invalid login response.");
      }

      localStorage.setItem("smartapply_token", result.token);
      localStorage.setItem(
        "smartapply_user",
        JSON.stringify(result.user)
      );

      setUser(result.user);
      setLoginForm(emptyLogin);
      setPageMessage("Login successful.");
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("smartapply_token");
    localStorage.removeItem("smartapply_user");

    setUser(null);
    setApplications([]);
    setStaff([]);
    setAttachment(null);
    setPageError("");
    setPageMessage("");
    setMode("login");
  }

  async function handleSubmitApplication(event) {
    event.preventDefault();
    setLoading(true);
    setPageError("");
    setPageMessage("");

    try {
      const formData = new FormData();

      formData.append("title", applicationForm.title.trim());
      formData.append("type", applicationForm.type);
      formData.append("reason", applicationForm.reason.trim());
      formData.append("department", applicationForm.department);
      formData.append("facultyId", applicationForm.facultyId);

      if (attachment) {
        formData.append("attachment", attachment);
      }

      const result = await api("/applications", {
        method: "POST",
        body: formData,
      });

      setPageMessage(
        result.message || "Application submitted successfully."
      );

      setApplicationForm({
        ...emptyApplication,
        department: user?.department || "CSE",
      });

      setAttachment(null);
      setFileInputKey((key) => key + 1);

      await loadApplications();
      await loadStaff(user?.department);
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleForward(applicationId) {
    setLoading(true);
    setPageError("");
    setPageMessage("");

    try {
      const result = await api(
        `/applications/${applicationId}/forward`,
        {
          method: "POST",
          body: JSON.stringify({
            note: notes[applicationId] || "",
          }),
        }
      );

      setPageMessage(result.message || "Application forwarded to HOD.");
      await loadApplications();
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleDecision(applicationId, decision) {
    setLoading(true);
    setPageError("");
    setPageMessage("");

    try {
      const result = await api(
        `/applications/${applicationId}/decision`,
        {
          method: "POST",
          body: JSON.stringify({
            decision,
            note: notes[applicationId] || "",
          }),
        }
      );

      setPageMessage(
        result.message || `Application ${decision.toLowerCase()}.`
      );

      await loadApplications();
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function downloadApprovedPdf(applicationId) {
    setPageError("");

    try {
      const token = localStorage.getItem("smartapply_token");

      const response = await fetch(
        `${API_BASE}/applications/${applicationId}/pdf`,
        {
          headers: token
            ? { Authorization: `Bearer ${token}` }
            : {},
        }
      );

      if (!response.ok) {
        let message = "Unable to download the approved PDF.";

        try {
          const data = await response.json();
          message = data.message || message;
        } catch {
          // Keep the default message.
        }

        throw new Error(message);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = `SmartApply-${applicationId}.pdf`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setPageError(getErrorMessage(error));
    }
  }

  async function downloadAttachment(applicationId) {
    setPageError("");

    try {
      const token = localStorage.getItem("smartapply_token");

      const response = await fetch(
        `${API_BASE}/applications/${applicationId}/attachment`,
        {
          headers: token
            ? { Authorization: `Bearer ${token}` }
            : {},
        }
      );

      if (!response.ok) {
        let message = "Unable to download the attachment.";

        try {
          const data = await response.json();
          message = data.message || message;
        } catch {
          // Keep the default message.
        }

        throw new Error(message);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = "SmartApply-supporting-document";

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setPageError(getErrorMessage(error));
    }
  }

  function statusClass(status) {
    switch (status) {
      case "Approved":
        return "approved";
      case "Rejected":
        return "rejected";
      case "Forwarded to HOD":
        return "forwarded";
      default:
        return "submitted";
    }
  }

  function renderApplicationCard(application) {
    const applicationId = getId(application);
    const studentId = getId(application.student);
    const facultyId = getId(application.faculty);
    const hodId = getId(application.hod);

    const canForward =
      isFaculty &&
      facultyId === String(user?.id || user?._id) &&
      application.status === "Submitted";

    const canDecide =
      isHod &&
      hodId === String(user?.id || user?._id) &&
      application.status === "Forwarded to HOD";

    const canDownloadPdf =
      application.status === "Approved" &&
      (isAdmin || (isStudent && studentId === String(user?.id || user?._id)));

    return (
      <article className="application-card" key={applicationId}>
        <div className="application-card-top">
          <div>
            <p className="eyebrow">{application.type}</p>
            <h3>{application.title}</h3>
            <p className="muted">
              Application ID: {applicationId}
            </p>
          </div>

          <span
            className={`status-badge ${statusClass(application.status)}`}
          >
            {application.status}
          </span>
        </div>

        <div className="metadata-grid">
          <div>
            <small>STUDENT</small>
            <strong>{application.student?.name || "—"}</strong>
          </div>

          <div>
            <small>ROLL NUMBER</small>
            <strong>{application.student?.rollNo || "Not provided"}</strong>
          </div>

          <div>
            <small>DEPARTMENT</small>
            <strong>{application.department || "—"}</strong>
          </div>

          <div>
            <small>FACULTY</small>
            <strong>{application.faculty?.name || "—"}</strong>
          </div>

          <div>
            <small>HOD</small>
            <strong>{application.hod?.name || "Pending assignment"}</strong>
          </div>

          <div>
            <small>SUBMITTED</small>
            <strong>{formatDate(application.createdAt)}</strong>
          </div>
        </div>

        <div className="application-reason">
          <strong>Reason</strong>
          <p>{application.reason}</p>
        </div>

        {application.attachment?.fileName && (
          <p className="attachment-line">
            <strong>Attachment:</strong>{" "}
            {application.attachment.fileName}
          </p>
        )}

        {application.facultyNote && (
          <p className="note-line">
            <strong>Faculty note:</strong> {application.facultyNote}
          </p>
        )}

        {application.hodNote && (
          <p className="note-line">
            <strong>HOD note:</strong> {application.hodNote}
          </p>
        )}

        {(isAdmin || isFaculty || isHod || isStudent) &&
          application.attachment?.data !== undefined && (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => downloadAttachment(applicationId)}
            >
              Download Supporting Document
            </button>
          )}

        {(canForward || canDecide) && (
          <div className="decision-panel">
            <label>
              Notes (optional)
              <textarea
                rows="2"
                value={notes[applicationId] || ""}
                onChange={(event) =>
                  setNotes((previous) => ({
                    ...previous,
                    [applicationId]: event.target.value,
                  }))
                }
                placeholder="Add a note for the next step..."
              />
            </label>

            {canForward && (
              <button
                type="button"
                className="button"
                disabled={loading}
                onClick={() => handleForward(applicationId)}
              >
                Forward to HOD
              </button>
            )}

            {canDecide && (
              <div className="button-row">
                <button
                  type="button"
                  className="button button-success"
                  disabled={loading}
                  onClick={() => handleDecision(applicationId, "Approved")}
                >
                  Approve
                </button>

                <button
                  type="button"
                  className="button button-danger"
                  disabled={loading}
                  onClick={() => handleDecision(applicationId, "Rejected")}
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        )}

        {canDownloadPdf && (
          <button
            type="button"
            className="button"
            onClick={() => downloadApprovedPdf(applicationId)}
          >
            Download Approved PDF with QR
          </button>
        )}

        {application.status === "Approved" && (
          <p className="success-note">
            Approved on: {formatDate(application.decidedAt)}
          </p>
        )}
      </article>
    );
  }

  if (!user) {
    return (
      <div className="app-shell">
        <style>{styles}</style>

        <header className="topbar">
          <div className="brand">
            <div className="brand-icon">S</div>
            <div>
              <strong>SmartApply</strong>
              <small>Student Administrative Portal</small>
            </div>
          </div>

          <span className="topbar-label">College Request System</span>
        </header>

        <main className="auth-layout">
          <section className="welcome-panel">
            <p className="eyebrow">SMART CAMPUS · DIGITAL APPROVALS</p>
            <h1>Your college requests, made simpler.</h1>
            <p>
              Submit applications, track every approval, and download
              digitally verifiable documents from one place.
            </p>

            <div className="feature-list">
              <div><span>01</span> Submit college requests online</div>
              <div><span>02</span> Track faculty and HOD decisions</div>
              <div><span>03</span> Verify approved PDFs using QR codes</div>
            </div>
          </section>

          <section className="auth-card">
            <div className="auth-tabs">
              <button
                type="button"
                className={mode === "login" ? "active" : ""}
                onClick={() => {
                  setMode("login");
                  setPageError("");
                  setPageMessage("");
                }}
              >
                Login
              </button>

              <button
                type="button"
                className={mode === "register" ? "active" : ""}
                onClick={() => {
                  setMode("register");
                  setPageError("");
                  setPageMessage("");
                }}
              >
                Student Registration
              </button>
            </div>

            <h2>
              {mode === "login" ? "Welcome back" : "Create student account"}
            </h2>
            <p className="muted">
              {mode === "login"
                ? "Log in to access your SmartApply dashboard."
                : "Register with your college details to get started."}
            </p>

            {pageError && <div className="alert alert-error">{pageError}</div>}
            {pageMessage && (
              <div className="alert alert-success">{pageMessage}</div>
            )}

            {mode === "login" ? (
              <form className="form-stack" onSubmit={handleLogin}>
                <label>
                  Email address
                  <input
                    type="email"
                    value={loginForm.email}
                    onChange={(event) =>
                      updateLogin("email", event.target.value)
                    }
                    placeholder="you@example.com"
                    required
                  />
                </label>

                <label>
                  Password
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(event) =>
                      updateLogin("password", event.target.value)
                    }
                    placeholder="Enter your password"
                    required
                  />
                </label>

                <button className="button button-full" disabled={loading}>
                  {loading ? "Logging in..." : "Login"}
                </button>
              </form>
            ) : (
              <form className="form-stack" onSubmit={handleRegister}>
                <label>
                  Full name
                  <input
                    value={registerForm.name}
                    onChange={(event) =>
                      updateRegister("name", event.target.value)
                    }
                    placeholder="Enter your full name"
                    required
                  />
                </label>

                <label>
                  College roll number
                  <input
                    value={registerForm.rollNo}
                    onChange={(event) =>
                      updateRegister(
                        "rollNo",
                        event.target.value.toUpperCase()
                      )
                    }
                    placeholder="Enter your roll number"
                    required
                  />
                </label>

                <label>
                  Email address
                  <input
                    type="email"
                    value={registerForm.email}
                    onChange={(event) =>
                      updateRegister("email", event.target.value)
                    }
                    placeholder="you@example.com"
                    required
                  />
                </label>

                <label>
                  Password (minimum 8 characters)
                  <input
                    type="password"
                    minLength={8}
                    value={registerForm.password}
                    onChange={(event) =>
                      updateRegister("password", event.target.value)
                    }
                    placeholder="Create a password"
                    required
                  />
                </label>

                <label>
                  Department
                  <select
                    value={registerForm.department}
                    onChange={(event) =>
                      updateRegister("department", event.target.value)
                    }
                    required
                  >
                    {DEPARTMENTS.map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </select>
                </label>

                <button className="button button-full" disabled={loading}>
                  {loading ? "Creating account..." : "Create Account"}
                </button>
              </form>
            )}

            <p className="auth-footnote">
              Secure college requests · Transparent approval tracking
            </p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <style>{styles}</style>

      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">S</div>
          <div>
            <strong>SmartApply</strong>
            <small>Student Administrative Portal</small>
          </div>
        </div>

        <div className="profile-area">
          <div className="profile-text">
            <strong>{user.name}</strong>
            <small>
              {(user.role || "user").toUpperCase()} ·{" "}
              {user.department || "All departments"}
            </small>
          </div>

          <button
            type="button"
            className="button button-secondary"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard">
        <section className="dashboard-heading">
          <div>
            <p className="eyebrow">SMARTAPPLY WORKSPACE</p>
            <h1>
              {isStudent
                ? "Student Dashboard"
                : isFaculty
                  ? "Faculty Dashboard"
                  : isHod
                    ? "HOD Dashboard"
                    : "Admin Dashboard"}
            </h1>
            <p className="muted">
              {isStudent
                ? "Create requests and follow their approval status."
                : isFaculty
                  ? "Review submitted applications and forward them to the HOD."
                  : isHod
                    ? "Review forwarded applications and record decisions."
                    : "Monitor applications across the system."}
            </p>
          </div>

          <button
            type="button"
            className="button button-secondary"
            onClick={refreshDashboard}
            disabled={loading}
          >
            Refresh
          </button>
        </section>

        {pageError && <div className="alert alert-error">{pageError}</div>}
        {pageMessage && (
          <div className="alert alert-success">{pageMessage}</div>
        )}

        <section className="stats-grid">
          <div className="stat-card">
            <span>Total applications</span>
            <strong>{stats.total}</strong>
          </div>
          <div className="stat-card">
            <span>Submitted</span>
            <strong>{stats.submitted}</strong>
          </div>
          <div className="stat-card">
            <span>Forwarded to HOD</span>
            <strong>{stats.forwarded}</strong>
          </div>
          <div className="stat-card">
            <span>Approved</span>
            <strong>{stats.approved}</strong>
          </div>
          <div className="stat-card">
            <span>Rejected</span>
            <strong>{stats.rejected}</strong>
          </div>
        </section>

        {isStudent && (
          <section className="content-section">
            <div className="section-heading">
              <div>
                <h2>Create an application</h2>
                <p className="muted">
                  Upload supporting documents if required.
                </p>
              </div>
            </div>

            <form
              className="application-form form-stack"
              onSubmit={handleSubmitApplication}
            >
              <div className="form-grid">
                <label>
                  Application title
                  <input
                    value={applicationForm.title}
                    onChange={(event) =>
                      updateApplication("title", event.target.value)
                    }
                    placeholder="e.g. Request for Bonafide Certificate"
                    required
                  />
                </label>

                <label>
                  Request type
                  <select
                    value={applicationForm.type}
                    onChange={(event) =>
                      updateApplication("type", event.target.value)
                    }
                    required
                  >
                    {REQUEST_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Department
                  <select
                    value={applicationForm.department}
                    onChange={async (event) => {
                      const department = event.target.value;

                      updateApplication("department", department);
                      updateApplication("facultyId", "");

                      try {
                        await loadStaff(department);
                      } catch (error) {
                        setPageError(getErrorMessage(error));
                      }
                    }}
                    required
                  >
                    {DEPARTMENTS.map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Assigned faculty
                  <select
                    value={applicationForm.facultyId}
                    onChange={(event) =>
                      updateApplication("facultyId", event.target.value)
                    }
                    required
                  >
                    <option value="">Select faculty</option>
                    {visibleStaff.map((member) => (
                      <option key={getId(member)} value={getId(member)}>
                        {member.name} ({member.email})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                Reason / Details
                <textarea
                  rows="5"
                  value={applicationForm.reason}
                  onChange={(event) =>
                    updateApplication("reason", event.target.value)
                  }
                  placeholder="Explain why you are submitting this request..."
                  required
                />
              </label>

              <label>
                Supporting document (PDF, JPG, or PNG; maximum 5 MB)
                <input
                  key={fileInputKey}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;

                    if (file && file.size > 5 * 1024 * 1024) {
                      setPageError("File size must not exceed 5 MB.");
                      setAttachment(null);
                      setFileInputKey((key) => key + 1);
                      return;
                    }

                    setPageError("");
                    setAttachment(file);
                  }}
                />
                {attachment && (
                  <small className="muted">
                    Selected: {attachment.name}
                  </small>
                )}
              </label>

              <button className="button" disabled={loading}>
                {loading ? "Submitting..." : "Submit Application"}
              </button>
            </form>
          </section>
        )}

        <section className="content-section">
          <div className="section-heading">
            <div>
              <h2>
                {isStudent ? "My applications" : "Application tracker"}
              </h2>
              <p className="muted">
                Track status, review details, and take permitted actions.
              </p>
            </div>
            <span className="count-label">
              {applications.length} record
              {applications.length === 1 ? "" : "s"}
            </span>
          </div>

          {applications.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">▤</div>
              <h3>No applications found</h3>
              <p className="muted">
                Applications will appear here when available.
              </p>
            </div>
          ) : (
            <div className="application-list">
              {applications.map(renderApplicationCard)}
            </div>
          )}
        </section>

        <footer className="footer">
          SmartApply · Digital Student Request and Approval System
        </footer>
      </main>
    </div>
  );
}

const styles = `
  * { box-sizing: border-box; }

  :root {
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: #17233b;
    background: #f5f7fb;
    font-synthesis: none;
    text-rendering: optimizeLegibility;
  }

  body {
    margin: 0;
    min-width: 320px;
    background: #f5f7fb;
  }

  button, input, select, textarea { font: inherit; }
  button { cursor: pointer; }
  button:disabled { opacity: .6; cursor: not-allowed; }

  .app-shell { min-height: 100vh; }
  .topbar {
    min-height: 78px;
    padding: 16px clamp(18px, 5vw, 72px);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    background: #fff;
    border-bottom: 1px solid #e7ebf3;
  }

  .brand, .profile-area { display: flex; align-items: center; gap: 12px; }
  .brand-icon {
    width: 43px; height: 43px; border-radius: 13px;
    display: grid; place-items: center;
    background: #2457d6; color: white; font-weight: 800; font-size: 22px;
  }
  .brand strong, .profile-text strong { display: block; font-size: 15px; }
  .brand small, .profile-text small {
    display: block; margin-top: 4px; color: #77839a; font-size: 12px;
  }
  .topbar-label { color: #77839a; font-size: 13px; }
  .profile-text { text-align: right; }

  .auth-layout {
    max-width: 1160px; margin: 55px auto; padding: 0 24px;
    display: grid; grid-template-columns: 1.05fr .95fr; gap: 60px;
    align-items: center;
  }
  .welcome-panel { padding: 28px 0; }
  .eyebrow {
    color: #2457d6; font-size: 11px; font-weight: 800;
    letter-spacing: 1.5px; margin: 0 0 13px;
  }
  .welcome-panel h1 {
    max-width: 540px; font-size: clamp(34px, 4vw, 52px);
    line-height: 1.12; letter-spacing: -1.7px; margin: 0 0 20px;
  }
  .welcome-panel > p:not(.eyebrow) {
    max-width: 500px; color: #68758e; font-size: 16px; line-height: 1.8;
  }
  .feature-list { display: grid; gap: 18px; margin-top: 38px; color: #33415c; }
  .feature-list div { display: flex; gap: 15px; align-items: center; }
  .feature-list span {
    color: #2457d6; background: #e9efff; border-radius: 9px;
    padding: 9px 10px; font-size: 12px; font-weight: 800;
  }

  .auth-card {
    background: white; border: 1px solid #e8ecf4; border-radius: 20px;
    padding: clamp(22px, 4vw, 34px);
    box-shadow: 0 18px 55px rgba(30, 49, 90, .07);
  }
  .auth-tabs { display: flex; gap: 6px; padding: 5px; background: #f3f5fa; border-radius: 11px; }
  .auth-tabs button {
    flex: 1; border: 0; background: transparent; color: #77839a;
    border-radius: 8px; padding: 11px 8px; font-size: 13px; font-weight: 700;
  }
  .auth-tabs button.active { background: white; color: #2457d6; box-shadow: 0 2px 8px #17233b0c; }
  .auth-card h2 { margin: 27px 0 8px; font-size: 25px; }
  .muted { color: #7b879d; line-height: 1.6; }
  .auth-card > .muted { margin: 0 0 22px; font-size: 13px; }

  .form-stack { display: grid; gap: 17px; }
  label { display: grid; gap: 8px; color: #36435c; font-size: 13px; font-weight: 650; }
  input, select, textarea {
    width: 100%; min-width: 0; border: 1px solid #dfe5ef;
    border-radius: 9px; background: #fff; color: #17233b;
    padding: 12px 13px; outline: none;
  }
  input:focus, select:focus, textarea:focus {
    border-color: #7c9bea; box-shadow: 0 0 0 3px #2457d615;
  }
  textarea { resize: vertical; line-height: 1.6; }
  input[type="file"] { padding: 10px; background: #fafbfe; }
  .button {
    display: inline-flex; justify-content: center; align-items: center;
    gap: 8px; border: 1px solid #2457d6; border-radius: 9px;
    background: #2457d6; color: white; padding: 11px 16px;
    font-size: 13px; font-weight: 750; transition: .15s ease;
  }
  .button:hover:not(:disabled) { background: #1946bb; }
  .button-full { width: 100%; margin-top: 3px; padding: 13px; }
  .button-secondary { background: white; color: #34425e; border-color: #dfe5ef; }
  .button-secondary:hover:not(:disabled) { background: #f3f6fc; }
  .button-success { background: #168454; border-color: #168454; }
  .button-success:hover:not(:disabled) { background: #106b42; }
  .button-danger { background: #c63e4e; border-color: #c63e4e; }
  .button-danger:hover:not(:disabled) { background: #a92c3b; }
  .auth-footnote { margin: 23px 0 0; text-align: center; color: #8b95a8; font-size: 11px; }

  .dashboard { max-width: 1250px; padding: 38px 24px 24px; margin: 0 auto; }
  .dashboard-heading, .section-heading {
    display: flex; justify-content: space-between; align-items: center; gap: 18px;
  }
  .dashboard-heading { margin-bottom: 28px; }
  .dashboard-heading h1 { margin: 0; font-size: clamp(26px, 3vw, 34px); letter-spacing: -.8px; }
  .dashboard-heading .muted, .section-heading .muted { margin: 8px 0 0; font-size: 13px; }
  .stats-grid {
    display: grid; grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 14px; margin-bottom: 30px;
  }
  .stat-card {
    background: white; border: 1px solid #e8ecf4; border-radius: 13px;
    padding: 19px;
  }
  .stat-card span { display: block; color: #7b879d; font-size: 12px; }
  .stat-card strong { display: block; font-size: 29px; margin-top: 10px; letter-spacing: -.5px; }

  .content-section {
    background: white; border: 1px solid #e8ecf4; border-radius: 16px;
    padding: clamp(18px, 3vw, 27px); margin-bottom: 25px;
  }
  .section-heading { margin-bottom: 22px; }
  .section-heading h2 { font-size: 19px; margin: 0; }
  .count-label { font-size: 12px; color: #697791; background: #f3f5fa; border-radius: 20px; padding: 8px 12px; }
  .application-form { padding: 20px; background: #f9faff; border: 1px solid #edf0f7; border-radius: 12px; }
  .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 17px; }
  .application-list { display: grid; gap: 16px; }
  .application-card { border: 1px solid #e5eaf3; border-radius: 13px; padding: 21px; }
  .application-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 15px; margin-bottom: 18px; }
  .application-card h3 { margin: 0 0 6px; font-size: 17px; }
  .application-card .eyebrow { margin-bottom: 7px; font-size: 10px; }
  .application-card .muted { font-size: 11px; margin: 0; overflow-wrap: anywhere; }
  .status-badge {
    display: inline-flex; align-items: center; white-space: nowrap;
    border-radius: 30px; padding: 7px 10px; font-size: 11px; font-weight: 750;
  }
  .status-badge.submitted { background: #fff4d8; color: #956600; }
  .status-badge.forwarded { background: #e8efff; color: #2457d6; }
  .status-badge.approved { background: #e0f6e9; color: #167444; }
  .status-badge.rejected { background: #ffeaec; color: #b52b3c; }

  .metadata-grid {
    display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 15px; padding: 17px 0; border-top: 1px solid #edf0f5;
    border-bottom: 1px solid #edf0f5;
  }
  .metadata-grid small { display: block; color: #8a95a9; font-size: 9px; letter-spacing: .8px; margin-bottom: 6px; }
  .metadata-grid strong { display: block; font-size: 12px; overflow-wrap: anywhere; }
  .application-reason { padding: 17px 0 7px; }
  .application-reason strong, .note-line strong, .attachment-line strong { font-size: 12px; }
  .application-reason p { color: #68758e; font-size: 13px; line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; }
  .attachment-line, .note-line { color: #68758e; font-size: 12px; overflow-wrap: anywhere; }
  .decision-panel { margin-top: 18px; padding: 17px; background: #f8faff; border-radius: 11px; display: grid; gap: 13px; }
  .button-row { display: flex; flex-wrap: wrap; gap: 9px; }
  .success-note { font-size: 12px; color: #168454; margin-top: 15px; }
  .empty-state { padding: 48px 15px; text-align: center; }
  .empty-icon { margin: 0 auto 15px; display: grid; place-items: center; width: 48px; height: 48px; border-radius: 13px; background: #edf2ff; color: #2457d6; font-size: 23px; }
  .empty-state h3 { margin: 0 0 8px; }
  .empty-state p { font-size: 13px; }
  .alert { padding: 12px 14px; border-radius: 9px; font-size: 13px; margin-bottom: 18px; overflow-wrap: anywhere; }
  .alert-error { color: #a62e3d; background: #fff0f1; border: 1px solid #ffd8dc; }
  .alert-success { color: #176e45; background: #eaf8ef; border: 1px solid #cdeed8; }
  .footer { text-align: center; padding: 20px; color: #929caf; font-size: 11px; }

  @media (max-width: 900px) {
    .auth-layout { grid-template-columns: 1fr; gap: 25px; margin: 28px auto; max-width: 650px; }
    .welcome-panel { padding: 10px 0; }
    .welcome-panel h1 { font-size: 38px; }
    .feature-list { margin-top: 24px; }
    .stats-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }

  @media (max-width: 600px) {
    .topbar { padding: 14px 16px; }
    .topbar-label { display: none; }
    .brand small { max-width: 165px; }
    .profile-area { gap: 8px; }
    .profile-text { display: none; }
    .dashboard { padding: 25px 14px; }
    .dashboard-heading { align-items: flex-start; }
    .dashboard-heading h1 { font-size: 25px; }
    .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
    .stat-card { padding: 14px; }
    .stat-card strong { font-size: 25px; }
    .form-grid, .metadata-grid { grid-template-columns: 1fr; }
    .application-card { padding: 15px; }
    .application-card-top { flex-direction: column; }
    .section-heading { align-items: flex-start; }
    .auth-layout { padding: 0 14px; }
    .welcome-panel h1 { font-size: 34px; }
  }
`
