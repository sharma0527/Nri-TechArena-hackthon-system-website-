import { useState, useEffect } from "react";
import axios from "axios";
import { Plus, Trash2, CheckCircle2, AlertCircle, ShieldCheck, UploadCloud, Lock, Loader2, XCircle } from "lucide-react";
import API from "./api";
import qrImage from "./assets/qr.jpeg";
import qrImage2 from "./assets/qr-2.jpeg";

export default function RegistrationForm() {
    const [step, setStep] = useState(1); // 1 = form, 2 = payment, 3 = success

    const [teamName, setTeamName] = useState("");
    const [domain, setDomain] = useState("");
    const [department, setDepartment] = useState("");
    const [branch, setBranch] = useState("");
    const [teamLeadName, setTeamLeadName] = useState("");
    const [teamLeadEmail, setTeamLeadEmail] = useState("");
    const [teamLeadPhone, setTeamLeadPhone] = useState("");
    const [members, setMembers] = useState([
        { name: "", email: "", branch: "" },
        { name: "", email: "", branch: "" },
        { name: "", email: "", branch: "" }
    ]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [orderId, setOrderId] = useState(null);

    const [utr, setUtr] = useState("");
    const [screenshot, setScreenshot] = useState(null);

    // Verification State
    const [verifyStage, setVerifyStage] = useState(null);
    const [verifyResult, setVerifyResult] = useState(null);
    const [showSupportPopup, setShowSupportPopup] = useState(false);
    const [showTermsPopup, setShowTermsPopup] = useState(false);
    const [payment, setPayment] = useState(null);
    const [globalStatus, setGlobalStatus] = useState(null);

    useEffect(() => {
        axios.get(`${API}/api/payment-status`)
            .then(res => setGlobalStatus(res.data))
            .catch(err => console.error(err));
    }, []);

    useEffect(() => {
        if (step === 2) {
            axios.get(`${API}/api/payment-config`)
                .then(res => setPayment(res.data))
                .catch(err => console.error(err));
        }
    }, [step]);

    const getAmount = () => {
        const count = members.length + 1; // members + team lead
        if (count === 3) return 600;
        if (count === 4) return 800;
        if (count === 5) return 1000;
        return 500;
    };

    const addMember = () => {
        if (members.length < 4) {
            setMembers([...members, { name: "", email: "", branch: "" }]);
        }
    };

    const removeMember = (index) => {
        const updated = members.filter((_, i) => i !== index);
        setMembers(updated);
    };

    const updateMember = (index, field, value) => {
        const updated = [...members];
        updated[index][field] = value;
        setMembers(updated);
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        if (!teamName || !teamLeadName || !teamLeadEmail) {
            setError("Please fill all required fields.");
            return;
        }

        const validMembers = members.filter(m => m.name.trim() !== "" && m.email.trim() !== "");
        if (validMembers.length < 3) {
            setError("A team must have a minimum of 4 members (Team Lead + at least 3 members). Please fill their details.");
            return;
        }

        setError(null);
        setLoading(true);

        try {
            const res = await axios.post(`${API}/api/register`, {
                teamName, domain, department, branch, teamLeadName, teamLeadEmail, teamLeadPhone, members
            });
            setOrderId(res.data.orderId);
            setStep(2);
        } catch (err) {
            setError(err.response?.data?.error || "Registration failed. Ensure backend is running.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (e) => {
        e.preventDefault();

        if (!utr.trim()) {
            setError("Please enter the UTR number.");
            return;
        }
        if (!screenshot) {
            setError("Please upload the payment screenshot.");
            return;
        }

        setLoading(true);
        setError(null);
        setVerifyResult(null);
        setVerifyStage("processing");

        try {
            const formData = new FormData();
            formData.append("orderId", orderId);
            formData.append("utr", utr);
            formData.append("screenshot", screenshot);

            const res = await axios.post(`${API}/api/verify-payment`, formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            setVerifyStage("done");

            if (res.data.success) {
                setVerifyResult({
                    success: true,
                    message: res.data.message,
                });
                setShowTermsPopup(true);
            } else {
                setVerifyResult({
                    success: false,
                    score: res.data.score,
                    checks: res.data.checks,
                    message: res.data.message
                });
                setShowSupportPopup(true);
            }
        } catch (err) {
            setVerifyStage("done");

            const errData = err.response?.data;
            if (errData) {
                setVerifyResult({
                    success: false,
                    score: errData.score,
                    checks: errData.checks,
                    message: errData.message
                });
                setShowSupportPopup(true);
            } else {
                setError("Payment verification failed. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    const resetAll = () => {
        setStep(1);
        setTeamName("");
        setDomain("");
        setDepartment("");
        setBranch("");
        setTeamLeadName("");
        setTeamLeadEmail("");
        setTeamLeadPhone("");
        setMembers([
            { name: "", email: "", branch: "" },
            { name: "", email: "", branch: "" },
            { name: "", email: "", branch: "" }
        ]);
        setOrderId(null);
        setUtr("");
        setScreenshot(null);
        setVerifyStage(null);
        setVerifyResult(null);
        setVerifyResult(null);
        setError(null);
    };

    // ═══ SUCCESS SCREEN ═══
    if (step === 3) {
        return (
            <div className="result-card" style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{
                    width: "80px", height: "80px", borderRadius: "50%",
                    background: "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 20px", border: "2px solid var(--success)",
                    animation: "pulse 2s infinite"
                }}>
                    <CheckCircle2 color="var(--success)" size={42} />
                </div>
                <h2 style={{ color: "var(--success)", marginBottom: "8px" }}>Registration Successful!</h2>
                <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>
                    Your team <strong>{teamName}</strong> is registered.
                </p>
                <p style={{ color: "var(--text-secondary)", marginTop: "8px" }}>
                    A confirmation email has been sent to <strong>{teamLeadEmail}</strong> and all team members.
                </p>

                <button
                    className="btn-primary"
                    style={{ marginTop: "24px", display: "inline-flex", width: "auto" }}
                    onClick={resetAll}
                >
                    Register Another Team
                </button>
            </div>
        );
    }

    // ═══ PAYMENT SCREEN ═══
    if (step === 2) {
        return (
            <div className="result-card" style={{ border: "2px solid var(--primary)", position: "relative", overflow: "hidden", padding: "0" }}>
                {/* Header */}
                <div style={{ background: "linear-gradient(135deg, var(--primary), #6d28d9)", color: "white", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <ShieldCheck size={24} />
                        <div>
                            <h3 style={{ margin: 0, color: "white", fontSize: "16px" }}>Secure Payment</h3>
                            <p style={{ margin: 0, fontSize: "11px", opacity: 0.8 }}>Payment verification system</p>
                        </div>
                    </div>
                    <div style={{
                        display: "flex", alignItems: "center", gap: 6,
                        background: "rgba(255,255,255,0.15)", padding: "4px 12px",
                        borderRadius: "16px", fontSize: "12px", backdropFilter: "blur(10px)"
                    }}>
                        <Lock size={12} /> Encrypted
                    </div>
                </div>

                <div style={{ padding: "24px" }}>
                    {/* Payment Amount & QR */}
                    <div style={{ textAlign: "center", marginBottom: 24 }}>
                        <h2 style={{ fontSize: "2.5rem", margin: "10px 0", color: "var(--text-primary)" }}>
                            ₹{getAmount()}
                        </h2>
                        <p style={{ color: "var(--text-secondary)" }}>Hackathon Registration Fee ({members.length + 1} Members)</p>

                        {payment ? (
                            <div style={{ margin: "20px 0", display: "flex", flexDirection: "column", alignItems: "center" }}>
                                <div style={{
                                    width: "220px",
                                    height: "220px",
                                    borderRadius: "10px",
                                    border: "3px solid #2c3e50",
                                    overflow: "hidden",
                                    background: "white",
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center"
                                }}>
                                    <img
                                        src={payment.id === 2 ? qrImage2 : qrImage}
                                        alt="Scan QR Code to Pay"
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "contain"
                                        }}
                                    />
                                </div>
                                <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: "12px" }}>Scan & pay using any UPI app. Download the screenshot!</p>
                            </div>
                        ) : (
                            <div style={{ margin: "40px 0", display: "flex", justifyContent: "center" }}>
                                <Loader2 size={32} className="spin" color="var(--primary)" />
                            </div>
                        )}
                    </div>

                    {/* Verification Form */}
                    <form onSubmit={handleVerify}>
                        <div className="form-group">
                            <label>Enter UTR Number (12 Digits) *</label>
                            <input type="text" value={utr} onChange={(e) => setUtr(e.target.value)} disabled={loading} placeholder="e.g. 786515036928" required />
                        </div>

                        <div className="form-group" style={{ position: "relative" }}>
                            <div className="file-drop-area" style={{ padding: "20px" }}>
                                {!screenshot ? (
                                    <>
                                        <UploadCloud className="file-icon" />
                                        <p style={{ fontSize: "14px" }}>Upload Payment Screenshot *</p>
                                        <p style={{ fontSize: "11px", color: "var(--text-secondary)", margin: "4px 0 0" }}>PNG, JPG, WebP — clear & high-res for best accuracy</p>
                                    </>
                                ) : (
                                    <div className="file-name" style={{ margin: 0, flexDirection: "column", gap: "4px" }}>
                                        <CheckCircle2 size={32} color="var(--success)" />
                                        <p style={{ fontSize: "13px", textAlign: "center", wordBreak: "break-all" }}>{screenshot.name}</p>
                                    </div>
                                )}
                                <input type="file" accept="image/*" disabled={loading} required onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        setScreenshot(e.target.files[0]);
                                        setVerifyResult(null);
                                        setVerifyStage(null);
                                        setError(null);
                                    }
                                }} />
                            </div>
                        </div>

                        {/* Loading State */}
                        {verifyStage && verifyStage !== "done" && (
                            <div style={{
                                background: "rgba(139, 92, 246, 0.06)",
                                border: "1px solid rgba(139, 92, 246, 0.15)",
                                borderRadius: "12px",
                                padding: "16px",
                                marginBottom: "16px",
                                textAlign: "center",
                                color: "var(--text-secondary)"
                            }}>
                                <Loader2 size={24} className="spin" style={{ color: "var(--primary)", display: "block", margin: "0 auto 8px" }} />
                                Processing your payment. Please wait...
                            </div>
                        )}

                        {/* Result */}
                        {verifyResult && (
                            <div style={{
                                background: verifyResult.success ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)",
                                border: `1px solid ${verifyResult.success ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
                                borderRadius: "12px",
                                padding: "16px",
                                marginBottom: "16px"
                            }}>
                                <div style={{
                                    display: "flex", alignItems: "center", gap: "8px",
                                    padding: "8px 12px", borderRadius: "8px",
                                    background: verifyResult.success ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                                    border: `1px solid ${verifyResult.success ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`
                                }}>
                                    {verifyResult.success
                                        ? <CheckCircle2 size={18} color="var(--success)" />
                                        : <XCircle size={18} color="var(--error)" />}
                                    <span style={{
                                        fontSize: "13px", fontWeight: 600,
                                        color: verifyResult.success ? "var(--success)" : "var(--error)"
                                    }}>
                                        {verifyResult.success ? "PAYMENT VERIFIED" : "VERIFICATION FAILED"}
                                    </span>
                                </div>

                                {/* Failure Reasons */}
                                {!verifyResult.success && verifyResult.failureReasons && (
                                    <div style={{ marginTop: "12px" }}>
                                        {verifyResult.failureReasons.map((reason, i) => (
                                            <div key={i} style={{
                                                fontSize: "12px", color: "var(--error)",
                                                display: "flex", alignItems: "flex-start", gap: "6px",
                                                marginBottom: "4px"
                                            }}>
                                                <span>•</span> {reason}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {error && (
                            <div style={{ color: "var(--error)", marginBottom: 16, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                                <AlertCircle size={18} />
                                {error}
                            </div>
                        )}

                        <button type="submit" className="btn-primary" disabled={loading || globalStatus?.paymentsStopped} style={{
                            background: (loading || globalStatus?.paymentsStopped) ? "var(--surface)" : "linear-gradient(135deg, var(--primary), #6d28d9)",
                            color: (loading || globalStatus?.paymentsStopped) ? "var(--text-secondary)" : "white",
                            cursor: globalStatus?.paymentsStopped ? "not-allowed" : "pointer",
                            opacity: globalStatus?.paymentsStopped ? 0.7 : 1
                        }}>
                            {globalStatus?.paymentsStopped ? (
                                <>
                                    <XCircle size={20} />
                                    Payments Disabled
                                </>
                            ) : loading ? (
                                <>
                                    <Loader2 size={20} className="spin" />
                                    Verifying...
                                </>
                            ) : (
                                <>
                                    <ShieldCheck size={20} />
                                    Verify Payment
                                </>
                            )}
                        </button>

                        {!loading && verifyResult && !verifyResult.success && (
                            <button
                                type="button"
                                onClick={() => {
                                    setScreenshot(null);
                                    setVerifyResult(null);
                                    setVerifyStage(null);
                                    setError(null);
                                }}
                                style={{
                                    marginTop: "10px", width: "100%",
                                    background: "none", border: "1px solid var(--border-color)",
                                    color: "var(--text-secondary)", padding: "12px",
                                    borderRadius: "10px", cursor: "pointer", fontSize: "14px"
                                }}
                            >
                                Try Again with New Screenshot
                            </button>
                        )}
                    </form>
                </div>

                {showSupportPopup && (
                    <div className="popup-overlay">
                        <div className="popup-box">
                            <h3>Verification Failed</h3>
                            <p>
                                If your payment was completed but verification failed,
                                it may be due to a technical issue.
                            </p>
                            <p><strong>Contact Support:</strong></p>
                            <p>Surya: <a href="tel:+919701711338" style={{ color: "var(--primary)" }}>+91 97017 11338</a></p>
                            <p>Sharma: <a href="tel:+918688011599" style={{ color: "var(--primary)" }}>+91 8688011599</a></p>
                            <button onClick={() => setShowSupportPopup(false)}>
                                Close
                            </button>
                        </div>
                    </div>
                )}

                {showTermsPopup && (
                    <div className="terms-overlay">
                        <div className="terms-box">
                            <h2>Hackathon Participation Guidelines</h2>
                            <p>
                                Thank you for registering for the Hackathon.
                                If you are coming from outside the city and require accommodation,
                                please contact the coordinators listed below.
                            </p>

                            <h3>Accommodation Contact</h3>
                            <p>Surya : <a href="tel:+919701711338">+91 97017 11338</a></p>
                            <p>Vijay : <a href="tel:+919392757990">+91 93927 57990</a></p>
                            <p>Sai : <a href="tel:+917207594604">+91 72075 94604</a></p>
                            <p>Sharma : <a href="tel:+918688011599">+91 8688011599</a></p>

                            <h3>Terms & Conditions</h3>
                            <ul>
                                <li>Accommodation is only for outside registered participants.</li>
                                <li>Carry your college ID and registration confirmation.</li>
                                <li>Follow all instructions provided by organizers.</li>
                                <li>Misconduct or rule violations may lead to disqualification.</li>
                                <li>Accommodation is subject to availability.</li>
                            </ul>

                            <button
                                onClick={() => {
                                    setShowTermsPopup(false);
                                    setStep(3);
                                }}
                            >
                                Accept & Continue
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ═══ REGISTRATION FORM ═══
    return (
        <form onSubmit={handleRegister} className="registration-form">
            <div style={{ display: "grid", gap: "20px" }}>

                <div className="form-section">
                    <h3>Team Details</h3>
                    <div className="form-group">
                        <label>Team Name *</label>
                        <input type="text" value={teamName} onChange={e => setTeamName(e.target.value)} required />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                        <div className="form-group">
                            <label>Domain</label>
                            <select value={domain} onChange={e => setDomain(e.target.value)}>
                                <option value="">Select Domain</option>
                                <option value="AI">AI / ML</option>
                                <option value="Web">Web Development</option>
                                <option value="IoT">IoT </option>
                                <option value="App Development">App Development </option>
                                <option value="Other">Open Innovation</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Department</label>
                            <select value={department} onChange={e => setDepartment(e.target.value)}>
                                <option value="">Select Dept</option>
                                <option value="B.Tech">B.Tech</option>
                                <option value="M.Tech">M.Tech</option>
                                <option value="Diploma">Diploma</option>
                                <option value="MBA">MBA</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Branch</label>
                            <input type="text" value={branch} onChange={e => setBranch(e.target.value)} placeholder="e.g. CSE" />
                        </div>
                    </div>
                </div>

                <div className="form-section">
                    <h3>Team Lead</h3>
                    <div className="form-group">
                        <label>Name *</label>
                        <input type="text" value={teamLeadName} onChange={e => setTeamLeadName(e.target.value)} required />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                        <div className="form-group">
                            <label>Email *</label>
                            <input type="email" value={teamLeadEmail} onChange={e => setTeamLeadEmail(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label>Phone</label>
                            <input type="tel" value={teamLeadPhone} onChange={e => setTeamLeadPhone(e.target.value)} />
                        </div>
                    </div>
                </div>

                <div className="form-section">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                        <h3 style={{ margin: 0 }}>Team Members (Min 3, Max 4)</h3>
                        <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>{members.length}/4</span>
                    </div>

                    {members.map((member, i) => (
                        <div key={i} style={{ background: "var(--surface)", padding: "16px", borderRadius: "8px", border: "1px solid var(--border-color)", marginBottom: "12px", position: "relative" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                                <strong>Member {i + 1}</strong>
                                <button type="button" onClick={() => removeMember(i)} style={{ background: "none", border: "none", color: "var(--error)", cursor: "pointer", padding: "4px" }}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px" }}>
                                <input type="text" placeholder="Name" value={member.name} onChange={e => updateMember(i, "name", e.target.value)} />
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                    <input type="email" placeholder="Email" value={member.email} onChange={e => updateMember(i, "email", e.target.value)} />
                                    <input type="text" placeholder="Branch" value={member.branch} onChange={e => updateMember(i, "branch", e.target.value)} />
                                </div>
                            </div>
                        </div>
                    ))}

                    {members.length < 4 && (
                        <button type="button" onClick={addMember} style={{ background: "transparent", border: "1px dashed var(--primary)", color: "var(--primary)", width: "100%", padding: "12px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                            <Plus size={16} /> Add Member
                        </button>
                    )}
                </div>

                {error && (
                    <div style={{ color: "var(--error)", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                        <AlertCircle size={18} />
                        {error}
                    </div>
                )}

                <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? <div className="loader"></div> : "Proceed to Payment"}
                </button>

            </div>
        </form>
    );
}
