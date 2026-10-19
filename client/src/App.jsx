
import React, { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import "./style.css";
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

function getErrorMessage(error) {
  return error?.message || "Something went wrong. Please try again.";
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

function getId(item) {
  return item?._id || item?.id || "";
}

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("smartapply_user") || "null"
      );
    } catch {
      return null;
    }
  });

  const [authMode, setAuthMode] = useState("login");

  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
    department: "CSE",
  });

  const [requestForm, setRequestForm] = useState({
    type: REQUEST_TYPES[0],
    subject: "",
    description: "",
    department: "CSE",
  });

  const [staffForm, setStaffForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "faculty",
    department: "CSE",
  });

  const [applications, setApplications] = useState([]);
  const [staffAccounts, setStaffAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const role = user?.role || "";
  const isStudent = role === "student";
  const isFaculty = role === "faculty";
  const isHod = role === "hod";
  const isAdmin = role === "admin";

  function updateAuthForm(event) {
    const { name, value } = event.target;
    setAuthForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function updateRequestForm(event) {
    const { name, value } = event.target;
    setRequestForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function updateStaffForm(event) {
    const { name, value } = event.target;
    setStaffForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  const loadApplications = useCallback(async () => {
    const result = await api("/applications");

    setApplications(
      Array.isArray(result)
        ? result
        : result.applications || []
    );
  }, []);

  const loadStaffAccounts = useCallback(async () => {
    const result = await api("/admin/users");
    setStaffAccounts(result.users || []);
  }, []);

  const refreshDashboard = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError("");

    try {
      await loadApplications();

      if (user.role === "admin") {
        await loadStaffAccounts();
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [user, loadApplications, loadStaffAccounts]);

  useEffect(() => {
    if (user) {
      refreshDashboard();
    }
  }, [user, refreshDashboard]);

  async function handleAuth(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const endpoint =
        authMode === "login"
          ? "/auth/login"
          : "/auth/register";

      const payload =
        authMode === "login"
          ? {
              email: authForm.email,
              password: authForm.password,
            }
          : {
              name: authForm.name,
              email: authForm.email,
              password: authForm.password,
              department: authForm.department,
              role: "student",
            };

      const result = await api(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!result.user || !result.token) {
        throw new Error(
          "The server did not return a user and token."
        );
      }

      localStorage.setItem(
        "smartapply_user",
        JSON.stringify(result.user)
      );

      localStorage.setItem(
        "smartapply_token",
        result.token
      );

      setUser(result.user);
      setMessage("Login successful.");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("smartapply_user");
    localStorage.removeItem("smartapply_token");

    setUser(null);
    setApplications([]);
    setStaffAccounts([]);
    setMessage("");
    setError("");
  }

  async function handleCreateRequest(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      await api("/applications", {
        method: "POST",
        body: JSON.stringify(requestForm),
      });

      setMessage("Application submitted successfully.");

      setRequestForm({
        type: REQUEST_TYPES[0],
        subject: "",
        description: "",
        department: user?.department || "CSE",
      });

      await loadApplications();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateStaff(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const result = await api("/admin/users", {
        method: "POST",
        body: JSON.stringify(staffForm),
      });

      setMessage(
        result.message || "Staff account created successfully."
      );

      setStaffForm({
        name: "",
        email: "",
        password: "",
        role: "faculty",
        department: "CSE",
      });

      await loadStaffAccounts();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function updateApplication(applicationId, action) {
    setError("");
    setMessage("");
    setLoading(true);

    try {
      await api(`/applications/${applicationId}/${action}`, {
        method: "PATCH",
      });

      setMessage("Application updated successfully.");
      await loadApplications();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <main className="app-shell">
        <section className="panel auth-panel">
          <h1>SmartApply</h1>
          <p>
            Student Administrative Request and Approval System
          </p>

          <div className="button-row">
            <button
              type="button"
              onClick={() => setAuthMode("login")}
              disabled={authMode === "login"}
            >
              Login
            </button>

            <button
              type="button"
              onClick={() => setAuthMode("register")}
              disabled={authMode === "register"}
            >
              Register
            </button>
          </div>

          {error && (
            <p className="error-message">{error}</p>
          )}

          {message && (
            <p className="success-message">{message}</p>
          )}

          <form onSubmit={handleAuth} className="form-grid">
            {authMode === "register" && (
              <>
                <label>
                  Full name
                  <input
                    name="name"
                    value={authForm.name}
                    onChange={updateAuthForm}
                    required
                  />
                </label>

                <label>
                  Department
                  <select
                    name="department"
                    value={authForm.department}
                    onChange={updateAuthForm}
                  >
                    {DEPARTMENTS.map((department) => (
                      <option
                        key={department}
                        value={department}
                      >
                        {department}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}

            <label>
              Email
              <input
                type="email"
                name="email"
                value={authForm.email}
                onChange={updateAuthForm}
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                name="password"
                value={authForm.password}
                onChange={updateAuthForm}
                minLength={8}
                required
              />
            </label>

            <button type="submit" disabled={loading}>
              {loading
                ? "Please wait..."
                : authMode === "login"
                  ? "Login"
                  : "Create Student Account"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>SmartApply</h1>
          <p>
            Welcome, {user.name || user.email} (
            {role.toUpperCase()})
          </p>
        </div>

        <div className="button-row">
          <button
            type="button"
            onClick={refreshDashboard}
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </header>

      {error && (
        <p className="error-message">{error}</p>
      )}

      {message && (
        <p className="success-message">{message}</p>
      )}

      {isStudent && (
        <section className="panel">
          <h2>Submit a Request</h2>

          <form
            onSubmit={handleCreateRequest}
            className="form-grid"
          >
            <label>
              Request type
              <select
                name="type"
                value={requestForm.type}
                onChange={updateRequestForm}
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
                name="department"
                value={requestForm.department}
                onChange={updateRequestForm}
              >
                {DEPARTMENTS.map((department) => (
                  <option
                    key={department}
                    value={department}
                  >
                    {department}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Subject
              <input
                name="subject"
                value={requestForm.subject}
                onChange={updateRequestForm}
                required
              />
            </label>

            <label>
              Description
              <textarea
                name="description"
                value={requestForm.description}
                onChange={updateRequestForm}
                rows={4}
                required
              />
            </label>

            <button type="submit" disabled={loading}>
              Submit Request
            </button>
          </form>
        </section>
      )}

      {isAdmin && (
        <section className="panel">
          <h2>Create Faculty or HOD Account</h2>

          <form
            onSubmit={handleCreateStaff}
            className="form-grid"
          >
            <label>
              Name
              <input
                name="name"
                value={staffForm.name}
                onChange={updateStaffForm}
                required
              />
            </label>

            <label>
              Email
              <input
                type="email"
                name="email"
                value={staffForm.email}
                onChange={updateStaffForm}
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                name="password"
                value={staffForm.password}
                onChange={updateStaffForm}
                minLength={8}
                required
              />
            </label>

            <label>
              Role
              <select
                name="role"
                value={staffForm.role}
                onChange={updateStaffForm}
              >
                <option value="faculty">Faculty</option>
                <option value="hod">HOD</option>
              </select>
            </label>

            <label>
              Department
              <select
                name="department"
                value={staffForm.department}
                onChange={updateStaffForm}
              >
                {DEPARTMENTS.map((department) => (
                  <option
                    key={department}
                    value={department}
                  >
                    {department}
                  </option>
                ))}
              </select>
            </label>

            <button type="submit" disabled={loading}>
              Create Account
            </button>
          </form>

          <h3>Existing Staff Accounts</h3>

          {staffAccounts.length === 0 ? (
            <p>No staff accounts found.</p>
          ) : (
            <ul className="staff-list">
              {staffAccounts.map((staff) => (
                <li key={getId(staff) || staff.email}>
                  <strong>{staff.name}</strong>
                  <span>{staff.email}</span>
                  <span>
                    {staff.role?.toUpperCase()}
                  </span>
                  <span>{staff.department}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {(isStudent || isFaculty || isHod || isAdmin) && (
        <section className="panel">
          <h2>
            {isStudent
              ? "My Applications"
              : "Application Dashboard"}
          </h2>

          {loading && <p>Loading...</p>}

          {applications.length === 0 ? (
            <p>No applications to display.</p>
          ) : (
            <div className="application-list">
              {applications.map((application) => (
                <article
                  className="application-card"
                  key={getId(application)}
                >
                  <div className="application-heading">
                    <h3>
                      {application.subject ||
                        application.type ||
                        "Application"}
                    </h3>

                    <span
                      className={`status-badge ${statusClass(
                        application.status
                      )}`}
                    >
                      {application.status || "Submitted"}
                    </span>
                  </div>

                  <p>
                    <strong>Type:</strong>{" "}
                    {application.type || "Not specified"}
                  </p>

                  <p>
                    <strong>Department:</strong>{" "}
                    {application.department ||
                      "Not specified"}
                  </p>

                  <p>
                    <strong>Description:</strong>{" "}
                    {application.description ||
                      "No description"}
                  </p>

                  {application.student?.name && (
                    <p>
                      <strong>Student:</strong>{" "}
                      {application.student.name}
                    </p>
                  )}

                  {isFaculty &&
                    application.status === "Submitted" && (
                      <button
                        type="button"
                        onClick={() =>
                          updateApplication(
                            getId(application),
                            "forward"
                          )
                        }
                        disabled={loading}
                      >
                        Forward to HOD
                      </button>
                    )}

                  {isHod &&
                    application.status ===
                      "Forwarded to HOD" && (
                      <div className="button-row">
                        <button
                          type="button"
                          onClick={() =>
                            updateApplication(
                              getId(application),
                              "approve"
                            )
                          }
                          disabled={loading}
                        >
                          Approve
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            updateApplication(
                              getId(application),
                              "reject"
                            )
                          }
                          disabled={loading}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
