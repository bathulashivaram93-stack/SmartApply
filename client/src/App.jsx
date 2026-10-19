import React from "react";

import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";

const DEPARTMENTS = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "IT", "ATML"];
const REQUEST_TYPES = ["Leave Application", "Bonafide Certificate", "OD Permission", "Other"];

function SelectDepartment({ value, onChange }) {
  return <select value={value} onChange={onChange} required>
    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
  </select>;
}

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("smartapply_user") || "null"); }
    catch { return null; }
  });
  const [mode, setMode] = useState("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [applications, setApplications] = useState([]);
  const [staff, setStaff] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ name: "", email: "", password: "", department: "CSE" });
  const [staffForm, setStaffForm] = useState({ name: "", email: "", password: "", role: "faculty", department: "CSE" });
  const [applicationForm, setApplicationForm] = useState({
    title: "", type: REQUEST_TYPES[0], reason: "", department: "CSE", facultyId: ""
  });

  const canCreateStaff = user?.role === "admin";
  const roleLabel = useMemo(() => ({
    student: "Student", faculty: "Faculty", hod: "HOD", admin: "Admin"
  }[user?.role] || ""), [user]);

  async function loadApplications() {
    try {
      const data = await api("/applications");
      setApplications(data.applications || []);
    } catch (e) { setMessage(e.message); }
  }

  async function loadStaffList() {
    if (!canCreateStaff) return;
    try {
      const data = await api("/admin/users");
      setStaffList(data.users || []);
    } catch (e) { setMessage(e.message); }
  }

  async function loadFaculty(department) {
    try {
      const data = await api(`/applications/staff?department=${encodeURIComponent(department)}`);
      setStaff(data.staff.filter(s => s.role === "faculty"));
      setApplicationForm(prev => ({
        ...prev,
        facultyId: data.staff.find(s => s.role === "faculty")?._id || ""
      }));
    } catch (e) { setStaff([]); setMessage(e.message); }
  }

  useEffect(() => {
    if (!user) return;
    loadApplications();
    loadStaffList();
    if (user.role === "student") loadFaculty(applicationForm.department);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function handleLogin(e) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const data = await api("/auth/login", { method: "POST", body: JSON.stringify(loginForm) });
      localStorage.setItem("smartapply_token", data.token);
      localStorage.setItem("smartapply_user", JSON.stringify(data.user));
      setUser(data.user); setMessage(`Welcome, ${data.user.name}`);
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }

  async function handleRegister(e) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const data = await api("/auth/register", { method: "POST", body: JSON.stringify(registerForm) });
      setMessage(data.message + " You can now log in.");
      setMode("login");
      setLoginForm({ email: registerForm.email, password: "" });
      setRegisterForm({ name: "", email: "", password: "", department: "CSE" });
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }

  async function handleCreateStaff(e) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const data = await api("/admin/users", { method: "POST", body: JSON.stringify(staffForm) });
      setMessage(data.message);
      setStaffForm(prev => ({ ...prev, name: "", email: "", password: "" }));
      await loadStaffList();
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }

  async function handleSubmitApplication(e) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const data = await api("/applications", { method: "POST", body: JSON.stringify(applicationForm) });
      setMessage(data.message);
      setApplicationForm(prev => ({ ...prev, title: "", reason: "" }));
      await loadApplications();
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  }

  async function handleForward(id) {
    const note = window.prompt("Optional note to HOD:", "") ?? null;
    if (note === null) return;
    try {
      const data = await api(`/applications/${id}/forward`, {
        method: "POST", body: JSON.stringify({ note })
      });
      setMessage(data.message); await loadApplications();
    } catch (e) { setMessage(e.message); }
  }

  async function handleDecision(id, decision) {
    const note = window.prompt(`Optional note for ${decision.toLowerCase()}:`, "") ?? null;
    if (note === null) return;
    try {
      const data = await api(`/applications/${id}/decision`, {
        method: "POST", body: JSON.stringify({ decision, note })
      });
      setMessage(data.message); await loadApplications();
    } catch (e) { setMessage(e.message); }
  }

  function logout() {
    localStorage.removeItem("smartapply_token");
    localStorage.removeItem("smartapply_user");
    setUser(null); setApplications([]); setMessage(""); setMode("login");
  }

  if (!user) return (
    <main className="auth-shell">
      <section className="hero">
        <div className="brand-mark">SA</div>
        <p className="eyebrow">SMARTAPPLY · CAMPUS SERVICES</p>
        <h1>College requests,<br /><em>without the paperwork.</em></h1>
        <p className="hero-copy">Submit requests, follow approvals, and keep every department in sync.</p>
        <div className="steps"><span>01 · Student submits</span><span>02 · Faculty reviews</span><span>03 · HOD decides</span></div>
      </section>
      <section className="auth-card">
        <div className="tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Sign in</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Student registration</button>
        </div>
        {mode === "login" ? <form onSubmit={handleLogin} className="form">
          <h2>Welcome back</h2><p className="muted">Use your SmartApply account to continue.</p>
          <label>Email address<input type="email" value={loginForm.email} onChange={e => setLoginForm({ ...loginForm, email: e.target.value })} placeholder="you@college.edu" required /></label>
          <label>Password<input type="password" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} placeholder="Enter password" required /></label>
          <button className="primary" disabled={busy}>{busy ? "Signing in…" : "Sign in →"}</button>
          <div className="demo"><strong>Default admin</strong><span>admin@gmail.com</span><span>admin123</span></div>
        </form> : <form onSubmit={handleRegister} className="form">
          <h2>Create student account</h2><p className="muted">Students can register with their department.</p>
          <label>Full name<input value={registerForm.name} onChange={e => setRegisterForm({ ...registerForm, name: e.target.value })} required /></label>
          <label>Email address<input type="email" value={registerForm.email} onChange={e => setRegisterForm({ ...registerForm, email: e.target.value })} required /></label>
          <label>Password (8+ characters)<input type="password" minLength="8" value={registerForm.password} onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })} required /></label>
          <label>Department<SelectDepartment value={registerForm.department} onChange={e => setRegisterForm({ ...registerForm, department: e.target.value })} /></label>
          <button className="primary" disabled={busy}>{busy ? "Creating…" : "Register as student →"}</button>
        </form>}
        {message && <div className="notice">{message}</div>}
      </section>
    </main>
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark small">SA</span><span>SmartApply<small>STUDENT ADMINISTRATION</small></span></div>
        <div className="user-pill"><span className="avatar">{user.name?.slice(0,1).toUpperCase()}</span><span><b>{user.name}</b><small>{roleLabel}{user.department ? ` · ${user.department}` : ""}</small></span><button className="ghost" onClick={logout}>Sign out</button></div>
      </header>
      <section className="welcome">
        <div><p className="eyebrow">WORKSPACE / {roleLabel.toUpperCase()}</p><h1>{user.role === "student" ? "Your applications." : user.role === "faculty" ? "Faculty review queue." : user.role === "hod" ? "Department approvals." : "Administration."}</h1><p className="muted">{user.role === "student" ? "Send a request to your department faculty and track every step." : user.role === "faculty" ? "Review student requests assigned to you and forward them to your department HOD." : user.role === "hod" ? "Review requests forwarded by faculty in your department." : "Create department staff accounts and manage the request workflow."}</p></div>
        <div className="stat"><span>VISIBLE REQUESTS</span><strong>{applications.length.toString().padStart(2, "0")}</strong></div>
      </section>

      {message && <div className="notice global-notice"><span>{message}</span><button onClick={() => setMessage("")}>×</button></div>}

      {canCreateStaff && <section className="panel">
        <div className="section-head"><div><p className="eyebrow">STAFF DIRECTORY</p><h2>Create HOD or Faculty account</h2></div><span className="tag">ADMIN ONLY</span></div>
        <form className="staff-grid" onSubmit={handleCreateStaff}>
          <label>Full name<input value={staffForm.name} onChange={e => setStaffForm({ ...staffForm, name: e.target.value })} required /></label>
          <label>Email<input type="email" value={staffForm.email} onChange={e => setStaffForm({ ...staffForm, email: e.target.value })} required /></label>
          <label>Temporary password<input type="password" minLength="8" value={staffForm.password} onChange={e => setStaffForm({ ...staffForm, password: e.target.value })} required /></label>
          <label>Role<select value={staffForm.role} onChange={e => setStaffForm({ ...staffForm, role: e.target.value })}><option value="faculty">Faculty</option><option value="hod">HOD</option></select></label>
          <label>Department<SelectDepartment value={staffForm.department} onChange={e => setStaffForm({ ...staffForm, department: e.target.value })} /></label>
          <button className="primary align-end" disabled={busy}>{busy ? "Creating…" : "Create account +"}</button>
        </form>
        <div className="staff-list"><h3>Existing staff</h3>{staffList.length === 0 ? <p className="muted">No staff accounts yet. Create a HOD for a department before forwarding applications from its faculty.</p> :
          <div className="staff-table">{staffList.map(s => <div className="staff-row" key={s._id}><span className="avatar">{s.name.slice(0,1).toUpperCase()}</span><span><b>{s.name}</b><small>{s.email}</small></span><span className="tag">{s.role.toUpperCase()}</span><span className="dept-chip">{s.department}</span></div>)}</div>}</div>
      </section>}

      {user.role === "student" && <section className="panel">
        <div className="section-head"><div><p className="eyebrow">NEW REQUEST</p><h2>Submit an application</h2></div><span className="tag">STEP 01 / 03</span></div>
        <form className="application-form" onSubmit={handleSubmitApplication}>
          <label>Application title<input value={applicationForm.title} onChange={e => setApplicationForm({ ...applicationForm, title: e.target.value })} placeholder="e.g. Leave request for 22 October" required /></label>
          <div className="two-col"><label>Request type<select value={applicationForm.type} onChange={e => setApplicationForm({ ...applicationForm, type: e.target.value })}>{REQUEST_TYPES.map(t => <option key={t}>{t}</option>)}</select></label>
          <label>Department<SelectDepartment value={applicationForm.department} onChange={e => { setApplicationForm({ ...applicationForm, department: e.target.value, facultyId: "" }); loadFaculty(e.target.value); }} /></label></div>
          <label>Send to faculty<select value={applicationForm.facultyId} onChange={e => setApplicationForm({ ...applicationForm, facultyId: e.target.value })} required><option value="">Select faculty in {applicationForm.department}</option>{staff.map(s => <option key={s._id} value={s._id}>{s.name} · {s.department}</option>)}</select></label>
          <label>Reason / details<textarea rows="4" value={applicationForm.reason} onChange={e => setApplicationForm({ ...applicationForm, reason: e.target.value })} placeholder="Explain your request and include relevant dates or details…" required /></label>
          <button className="primary" disabled={busy || !applicationForm.facultyId}>{busy ? "Submitting…" : "Submit to faculty →"}</button>
          {!staff.length && <p className="hint">No faculty listed for this department yet. Ask the admin to create a faculty account in this department.</p>}
        </form>
      </section>}

      <section className="panel">
        <div className="section-head"><div><p className="eyebrow">REQUEST TRACKER</p><h2>{user.role === "student" ? "My applications" : user.role === "faculty" ? "Assigned applications" : user.role === "hod" ? "Forwarded applications" : "All applications"}</h2></div><button className="secondary" onClick={loadApplications}>↻ Refresh</button></div>
        {!applications.length ? <div className="empty"><div className="empty-icon">↗</div><h3>No applications to show</h3><p>When requests are submitted, they will appear here.</p></div> :
          <div className="application-list">{applications.map(a => {
            const actionableFaculty = user.role === "faculty" && a.status === "Submitted";
            const actionableHod = user.role === "hod" && a.status === "Forwarded to HOD";
            return <article className="request-card" key={a._id}>
              <div className="request-top"><div><span className="request-type">{a.type}</span><h3>{a.title}</h3></div><span className={`status status-${a.status.toLowerCase().replaceAll(" ", "-")}`}>{a.status}</span></div>
              <p className="reason">{a.reason}</p>
              <div className="request-meta">
                <span><small>STUDENT</small><b>{a.student?.name || "Student"}</b></span>
                <span><small>DEPARTMENT</small><b>{a.department}</b></span>
                <span><small>FACULTY</small><b>{a.faculty?.name || "—"}</b></span>
                <span><small>HOD</small><b>{a.hod?.name || "Pending faculty review"}</b></span>
              </div>
              {a.facultyNote && <p className="note"><b>Faculty note:</b> {a.facultyNote}</p>}
              {a.hodNote && <p className="note"><b>HOD note:</b> {a.hodNote}</p>}
              <div className="request-bottom"><span className="muted">Submitted {new Date(a.createdAt).toLocaleString()}</span>
                {actionableFaculty && <button className="primary compact" onClick={() => handleForward(a._id)}>Forward to HOD →</button>}
                {actionableHod && <div className="actions"><button className="approve" onClick={() => handleDecision(a._id, "Approved")}>Approve</button><button className="reject" onClick={() => handleDecision(a._id, "Rejected")}>Reject</button></div>}
              </div>
            </article>;
          })}</div>}
      </section>
      <footer>SmartApply · Request workflow <span>Student → Faculty → HOD</span></footer>
    </main>
  );
}
