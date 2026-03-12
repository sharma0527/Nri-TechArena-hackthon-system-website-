import { useState, useCallback } from "react";
import axios from "axios";
import { UploadCloud, FileSpreadsheet, Send, CheckCircle2, AlertCircle, BarChart3, Mail, RefreshCcw, Users, User, ArrowLeft, Calendar, Lock, ArrowRight, LogOut, QrCode, DatabaseBackup } from "lucide-react";
import Particles from "react-tsparticles";
import { loadSlim } from "tsparticles-slim";
import "./index.css";
import API from "./api";
import RegistrationForm from "./RegistrationForm";
import AdminDashboard from "./AdminDashboard";
import BackupDashboard from "./BackupDashboard";

function App() {
  const particlesInit = useCallback(async engine => {
    await loadSlim(engine);
  }, []);

  const [authStatus, setAuthStatus] = useState("login"); // 'login' | 'admin' | 'guest'
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState(null);

  const [mode, setMode] = useState(null); // 'bulk' | 'single' | 'register'

  const [file, setFile] = useState(null);
  const [singleEmail, setSingleEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);
  const [singleResult, setSingleResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // drag events
  const handleDrag = function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = function (e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoginError(null);

    try {
      const res = await axios.post(`${API}/api/admin/login`, {
        email: emailInput,
        password: passwordInput
      });

      if (res.data.success) {
        setAuthStatus('admin');
        setMode(null);
        // Store admin key for later use in dashboards
        localStorage.setItem("adminKey", res.data.adminKey);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        // Not an admin, try guest access if email is not the admin email
        // Actually, let's just show an error for the admin login form.
        setLoginError("Invalid admin credentials");
      } else {
        // Possible network error or unexpected issue
        setLoginError("Login failed. Please ensure backend is running.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();

    if (!file) {
      setError("Please select an Excel file (emails list)");
      return;
    }
    if (!subject.trim()) {
      setError("Please enter a subject");
      return;
    }
    if (!message.trim()) {
      setError("Please enter a message");
      return;
    }

    setError(null);
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("subject", subject);
    formData.append("message", message);

    try {
      const res = await axios.post(
        `${API}/send-mails`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data"
          }
        }
      );
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Error sending emails. Ensure backend is running.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSingleSubmit = async (e) => {
    e.preventDefault();

    if (!singleEmail.trim()) {
      setError("Please enter an email address");
      return;
    }
    if (!subject.trim()) {
      setError("Please enter a subject");
      return;
    }
    if (!message.trim()) {
      setError("Please enter a message");
      return;
    }

    setError(null);
    setLoading(true);
    setSingleResult(null);

    try {
      const res = await axios.post(
        `${API}/send-single-mail`,
        {
          email: singleEmail,
          subject,
          message
        }
      );
      setSingleResult(res.data.message);
    } catch (err) {
      setError(err.response?.data?.error || "Error sending email. Ensure backend is running.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setSingleEmail("");
    setSubject("");
    setMessage("");
    setResult(null);
    setSingleResult(null);
    setError(null);
  };

  const renderContent = () => {
    if (authStatus === 'login') {
      return (
        <div className="container" style={{ position: "relative", minHeight: "500px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {/* Title now managed globally outside card */}

          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label>Email Address</label>
              <div style={{ position: "relative" }}>
                <Mail className="input-icon" size={20} color="var(--text-secondary)" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="email"
                  placeholder="admin@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  style={{ paddingLeft: "44px" }}
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: "32px" }}>
              <label>Password</label>
              <div style={{ position: "relative" }}>
                <Lock className="input-icon" size={20} color="var(--text-secondary)" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  style={{ paddingLeft: "44px" }}
                  required
                />
              </div>
            </div>

            {loginError && (
              <div style={{ color: "var(--error)", marginBottom: 16, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <AlertCircle size={18} />
                {loginError}
              </div>
            )}

            <button type="submit" className="btn-primary" style={{ height: "54px", fontSize: "16px" }}>
              Sign In
            </button>
          </form>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setAuthStatus('guest');
              setMode('register');
              setLoginError(null);
            }}
            style={{
              position: "absolute",
              bottom: "24px",
              left: "24px",
              background: "none",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "color 0.2s ease",
              padding: 0
            }}
            onMouseEnter={(e) => e.target.style.color = "var(--text-primary)"}
            onMouseLeave={(e) => e.target.style.color = "var(--text-secondary)"}
          >
            Skip <ArrowRight size={16} />
          </button>
        </div>
      );
    }

    return (
      <div className="container" style={{ position: "relative", paddingTop: "60px", maxWidth: mode === 'dashboard' ? "1200px" : "600px", transition: "max-width 0.3s ease" }}>
        <button
          onClick={() => {
            setAuthStatus('login');
            setMode(null);
            setEmailInput("");
            setPasswordInput("");
            setLoginError(null);
            resetForm();
          }}
          title="Logout / Change User"
          style={{
            position: "absolute",
            top: "24px",
            right: "24px",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            color: "var(--text-secondary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            transition: "all 0.2s ease"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"; e.currentTarget.style.color = "white"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
        >
          <LogOut size={16} />
        </button>

        <div className="header">
          <center>
            <h1 className="hackathon-title">
              Tech Arena <span>Hackathon</span>
            </h1>
          </center>
          <p className="hackathon-subtitle">{mode === null ? "Select how you want to proceed today" : (mode === 'bulk' ? "Upload Excel to instantly send personalized emails in bulk" : mode === 'register' ? "State Level Hackathon Registration" : mode === 'dashboard' ? "Admin Dashboard" : mode === 'backup' ? "Testing & Backup Registration Data" : mode === 'qr-change' ? "Payment Configuration" : "Quickly send an email to a single recipient")}</p>
        </div>

        {mode === null && authStatus === 'admin' && (
          <div className="mode-selection">
            <div className="mode-card" onClick={() => setMode('single')}>
              <User className="mode-icon" />
              <h3>Single Email</h3>
              <p>Send a message to one recipient instantly.</p>
            </div>
            <div className="mode-card" onClick={() => setMode('bulk')}>
              <Users className="mode-icon" />
              <h3>Bulk Emails</h3>
              <p>Upload an Excel file to blast emails to multiple people.</p>
            </div>
            <div className="mode-card" onClick={() => setMode('register')} style={{ borderColor: "var(--primary)" }}>
              <Calendar className="mode-icon" color="var(--primary)" />
              <h3 style={{ color: "var(--primary)" }}>Hackathon Registration</h3>
              <p>Register your team and complete payment securely.</p>
            </div>
            <div className="mode-card" onClick={() => setMode('dashboard')} style={{ borderColor: "#10b981" }}>
              <BarChart3 className="mode-icon" color="#10b981" />
              <h3 style={{ color: "#10b981" }}>Admin Dashboard</h3>
              <p>View all team registrations and verify payment screenshots.</p>
            </div>
            <div className="mode-card" onClick={() => setMode('qr-change')} style={{ borderColor: "#f59e0b" }}>
              <QrCode className="mode-icon" color="#f59e0b" />
              <h3 style={{ color: "#f59e0b" }}>Change QR Code</h3>
              <p>Instantly switch the active payment QR account.</p>
            </div>
            <div className="mode-card" onClick={() => setMode('backup')} style={{ borderColor: "#8b5cf6" }}>
              <DatabaseBackup className="mode-icon" color="#8b5cf6" />
              <h3 style={{ color: "#8b5cf6" }}>Backup Data</h3>
              <p>View previous testing logs and backup registration data.</p>
            </div>
          </div>
        )}

        {mode !== null && authStatus === 'admin' && (
          <button
            className="back-btn"
            onClick={() => {
              setMode(null);
              resetForm();
            }}
          >
            <ArrowLeft size={16} /> Back to Selection
          </button>
        )}

        {mode === 'register' && (
          <RegistrationForm />
        )}

        {mode === 'dashboard' && (
          <AdminDashboard />
        )}

        {mode === 'backup' && (
          <BackupDashboard />
        )}

        {mode === 'qr-change' && (
          <div className="result-card" style={{ maxWidth: "500px", margin: "0 auto", textAlign: "center" }}>
            <h3 style={{ justifyContent: "center" }}><QrCode size={24} color="var(--primary)" /> Change Active QR</h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: "24px" }}>Click to instantaneously switch the active payment receiver for all new registrations.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <button
                className="btn-primary"
                style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)", height: "auto", padding: "16px" }}
                onClick={async () => {
                  try {
                    await axios.post(`${API}/api/change-qr`, { qrId: 3 });
                    alert("✅ Successfully updated! Current QR is now: Sharma (SBI)");
                  } catch (e) { alert("Failed to change QR") }
                }}
              >
                Activate QR 1 : Sharma (SBI)
              </button>
              <button
                className="btn-primary"
                style={{ background: "linear-gradient(135deg, #10b981, #059669)", height: "auto", padding: "16px" }}
                onClick={async () => {
                  try {
                    await axios.post(`${API}/api/change-qr`, { qrId: 2 });
                    alert("✅ Successfully updated! Current QR is now: Siva Kotamma Challa (Axis Bank)");
                  } catch (e) { alert("Failed to change QR") }
                }}
              >
                Activate QR 2 : Siva Kotamma Challa (Axis Bank)
              </button>
            </div>
          </div>
        )}

        {mode === 'bulk' && (
          <form onSubmit={handleBulkSubmit}>
            <div className="form-group" style={{ position: "relative" }}>
              <div
                className={`file-drop-area ${dragActive ? "active" : ""}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                {!file ? (
                  <>
                    <UploadCloud className="file-icon" />
                    <p>Drag & drop your Excel file here</p>
                    <div style={{ marginTop: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                      Must contain an <strong>email</strong> column
                    </div>
                  </>
                ) : (
                  <div className="file-name">
                    <FileSpreadsheet size={24} />
                    {file.name}
                  </div>
                )}
                <input
                  type="file"
                  accept=".xls,.xlsx,.csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setFile(e.target.files[0]);
                    }
                  }}
                />
              </div>
            </div>

            <div className="form-group">
              <input
                type="text"
                placeholder="Subject Line"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div className="form-group">
              <textarea
                placeholder="Type your email message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            {error && (
              <div style={{ color: "var(--error)", marginBottom: 16, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="loader"></div>
                  Sending Emails...
                </>
              ) : (
                <>
                  <Send size={20} />
                  Blast Emails
                </>
              )}
            </button>
          </form>
        )}

        {mode === 'single' && (
          <form onSubmit={handleSingleSubmit}>
            <div className="form-group">
              <label>Recipient Email</label>
              <input
                type="text"
                placeholder="recipient@example.com"
                value={singleEmail}
                onChange={(e) => setSingleEmail(e.target.value)}
                style={{ marginTop: 8 }}
              />
            </div>

            <div className="form-group">
              <label>Subject</label>
              <input
                type="text"
                placeholder="Subject Line"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{ marginTop: 8 }}
              />
            </div>

            <div className="form-group">
              <label>Message</label>
              <textarea
                placeholder="Type your email message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                style={{ marginTop: 8 }}
              />
            </div>

            {error && (
              <div style={{ color: "var(--error)", marginBottom: 16, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="loader"></div>
                  Sending Email...
                </>
              ) : (
                <>
                  <Send size={20} />
                  Send Email
                </>
              )}
            </button>
          </form>
        )}

        {result && mode === 'bulk' && (
          <div className="result-card">
            <h3 style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: 16, marginBottom: 16 }}>
              <BarChart3 size={24} color="var(--primary)" />
              Campaign Report
              <button
                onClick={() => setResult(null)}
                style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}
              >
                <RefreshCcw size={14} /> Clear
              </button>
            </h3>

            <div className="stats">
              <div className="stat-box stat-total">
                <div className="stat-value">{result.total}</div>
                <div className="stat-label">Total</div>
              </div>
              <div className="stat-box stat-success">
                <div className="stat-value">{result.success.length}</div>
                <div className="stat-label">Success</div>
              </div>
              <div className="stat-box stat-error">
                <div className="stat-value">{result.failed.length}</div>
                <div className="stat-label">Failed</div>
              </div>
            </div>
          </div>
        )}

        {singleResult && mode === 'single' && (
          <div className="result-card" style={{ display: "flex", alignItems: "center", gap: 12, borderColor: "var(--success)", background: "rgba(16, 185, 129, 0.1)" }}>
            <CheckCircle2 color="var(--success)" size={32} />
            <div>
              <div style={{ color: "var(--success)", fontWeight: 600, fontSize: 16, marginBottom: 4 }}>
                Success!
              </div>
              <div style={{ color: "var(--text-primary)", fontSize: 14 }}>
                {singleResult}
              </div>
            </div>
            <button
              onClick={() => setSingleResult(null)}
              style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}
            >
              Clear
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page">
      <Particles
        id="tsparticles"
        init={particlesInit}
        options={{
          fullScreen: { enable: true, zIndex: 0 },
          background: { color: { value: "transparent" } },
          fpsLimit: 120,
          particles: {
            color: { value: ["#a78bfa", "#60a5fa", "#ffffff"] },
            links: { color: "#60a5fa", distance: 150, enable: true, opacity: 0.3, width: 1 },
            move: { enable: true, speed: 1.5, direction: "none", random: false, straight: false, outModes: "bounce" },
            number: { density: { enable: true, area: 800 }, value: 100 },
            opacity: { value: 0.7 },
            shape: { type: "circle" },
            size: { value: { min: 1, max: 2.5 } }
          },
          detectRetina: true
        }}
      />

      <div className="title-container">
        <h1>NRI Institute of Technology</h1>
        <p>State Level Hackathon</p>
      </div>

      {renderContent()}
    </div>
  );
}

export default App;
