import { useState, useEffect } from "react";
import axios from "axios";
import { Loader2, AlertCircle, RefreshCcw, Image as ImageIcon, X, PauseCircle, PlayCircle, Clock } from "lucide-react";
import { apiFetch } from "./api";

export default function AdminDashboard() {
    const [registrations, setRegistrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedImage, setSelectedImage] = useState(null);
    const [activeQR, setActiveQR] = useState(2);

    // Payment Status & Countdown
    const [paymentStatus, setPaymentStatus] = useState(null);
    const [timeLeft, setTimeLeft] = useState({ d: '00', h: '00', m: '00', s: '00' });

    const deleteRegistration = async (orderId) => {
        if (!window.confirm("Are you sure you want to delete this registration?"))
            return;

        try {
            await apiFetch(`/api/delete-registration/${orderId}`, {
                method: "DELETE",
                headers: { authorization: localStorage.getItem("adminKey") || "supersecretadmin" }
            });
            alert("Registration deleted successfully");
            fetchRegistrations(); // refresh table
        } catch (error) {
            console.error(error);
            alert("Delete failed");
        }
    };

    const fetchRegistrations = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiFetch("/admin/registrations");
            setRegistrations(res);
        } catch (err) {
            setError(err.message || "Failed to fetch registrations.");
        } finally {
            setLoading(false);
        }
    };

    const fetchActiveQR = async () => {
        try {
            const res = await apiFetch("/api/payment-config");
            setActiveQR(res.id);
        } catch (e) {
            console.error(e);
        }
    };

    const changeQR = async (qrId) => {
        try {
            await apiFetch("/api/change-qr", {
                method: "POST",
                body: JSON.stringify({ qrId })
            });
            setActiveQR(qrId);
        } catch (e) {
            console.error(e);
            alert("Failed to change QR");
        }
    };

    const fetchPaymentStatus = async () => {
        try {
            const res = await apiFetch("/api/payment-status");
            setPaymentStatus(res);
        } catch (e) {
            console.error(e);
        }
    };

    const togglePayments = async () => {
        try {
            const res = await apiFetch("/api/toggle-payment", {
                method: "POST",
                headers: { authorization: localStorage.getItem("adminKey") || "supersecretadmin" }
            });
            setPaymentStatus(res);
            alert(`Payments have been successfully ${res.paymentsStopped ? "STOPPED" : "RESUMED"}!`);
        } catch (error) {
            console.error(error);
            alert("Failed to toggle payment status.");
        }
    };

    useEffect(() => {
        fetchRegistrations();
        fetchActiveQR();
        fetchPaymentStatus();
    }, []);

    useEffect(() => {
        if (!paymentStatus?.deadline) return;

        const interval = setInterval(() => {
            const now = new Date();
            const deadlineDate = new Date(paymentStatus.deadline);
            const diff = deadlineDate - now;

            if (diff <= 0) {
                setTimeLeft({ d: '00', h: '00', m: '00', s: '00' });
                clearInterval(interval);
            } else {
                const d = Math.floor(diff / (1000 * 60 * 60 * 24)).toString().padStart(2, '0');
                const h = Math.floor((diff / (1000 * 60 * 60)) % 24).toString().padStart(2, '0');
                const m = Math.floor((diff / 1000 / 60) % 60).toString().padStart(2, '0');
                const s = Math.floor((diff / 1000) % 60).toString().padStart(2, '0');
                setTimeLeft({ d, h, m, s });
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [paymentStatus]);

    const FlipUnit = ({ digit, unit }) => (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "0 10px" }}>
            <div style={{
                background: "linear-gradient(180deg, #1e293b 50%, #0f172a 50%)",
                color: "white", fontSize: "3rem", fontWeight: "bold", padding: "10px",
                borderRadius: "8px", boxShadow: "0 4px 10px rgba(0,0,0,0.5)",
                border: "1px solid rgba(255,255,255,0.1)",
                display: "flex", justifyContent: "center", alignItems: "center",
                width: "80px", height: "100px", fontFamily: "monospace", position: "relative"
            }}>
                {digit}
                {/* Horizontal middle divider purely for aesthetics */}
                <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: "2px", background: "rgba(0,0,0,0.7)", marginTop: "-1px" }} />
            </div>
            <span style={{ fontSize: "14px", color: "var(--text-secondary)", marginTop: "12px", textTransform: "uppercase", letterSpacing: "1px", fontWeight: "bold" }}>{unit}</span>
        </div>
    );

    return (
        <div className="result-card" style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h2 style={{ margin: 0, color: "var(--text-primary)" }}>Hackathon Registrations</h2>
                <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>Active QR:</span>
                        <select
                            value={activeQR}
                            onChange={(e) => changeQR(parseInt(e.target.value))}
                            style={{ padding: "6px 12px", borderRadius: "8px", background: "var(--surface)", border: "1px solid var(--border-color)", color: "var(--text-primary)", fontSize: "14px" }}
                        >
                            <option value={2}>Siva Kotamma Challa (SBI)</option>
                            <option value={3}>Sharma (SBI)</option>
                        </select>
                    </div>
                    <button className="btn-primary" onClick={fetchRegistrations} style={{ width: "auto", display: "flex", gap: "8px", padding: "8px 16px" }}>
                        <RefreshCcw size={16} />Refresh
                    </button>
                </div>
            </div>

            {/* Stats Bar */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", marginBottom: "24px" }}>
                <div style={{ background: "rgba(255,255,255,0.05)", padding: "16px", borderRadius: "12px", flex: "1 1 min-content", minWidth: "200px", border: "1px solid var(--border-color)" }}>
                    <div style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}>Total Registrations (All)</div>
                    <div style={{ fontSize: "28px", fontWeight: "bold", color: "var(--text-primary)" }}>{registrations.length}</div>
                </div>
                <div style={{ background: "rgba(255,255,255,0.05)", padding: "16px", borderRadius: "12px", flex: "1 1 min-content", minWidth: "200px", border: activeQR === 2 ? "1px solid var(--primary)" : "1px solid var(--border-color)", position: "relative" }}>
                    {activeQR === 2 && <div style={{ position: "absolute", top: "12px", right: "12px", fontSize: "11px", background: "var(--primary)", color: "white", padding: "2px 6px", borderRadius: "4px" }}>Active</div>}
                    <div style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}>Siva Kotamma Challa</div>
                    <div style={{ fontSize: "28px", fontWeight: "bold", color: "var(--text-primary)" }}>
                        {registrations.filter(r => r.QR_ID == 2).length} <span style={{ fontSize: "14px", fontWeight: "normal", color: "var(--text-secondary)" }}>teams</span>
                    </div>
                    <div style={{ fontSize: "14px", color: "var(--success)", marginTop: "4px", fontWeight: "bold" }}>
                        ₹{registrations.filter(r => r.QR_ID == 2).reduce((sum, r) => sum + (Number(r.Amount) || 0), 0)} collected
                    </div>
                </div>
                <div style={{ background: "rgba(255,255,255,0.05)", padding: "16px", borderRadius: "12px", flex: "1 1 min-content", minWidth: "200px", border: activeQR === 3 ? "1px solid var(--primary)" : "1px solid var(--border-color)", position: "relative" }}>
                    {activeQR === 3 && <div style={{ position: "absolute", top: "12px", right: "12px", fontSize: "11px", background: "var(--primary)", color: "white", padding: "2px 6px", borderRadius: "4px" }}>Active</div>}
                    <div style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}>Sharma (SBI)</div>
                    <div style={{ fontSize: "28px", fontWeight: "bold", color: "var(--text-primary)" }}>
                        {registrations.filter(r => r.QR_ID == 3).length} <span style={{ fontSize: "14px", fontWeight: "normal", color: "var(--text-secondary)" }}>teams</span>
                    </div>
                    <div style={{ fontSize: "14px", color: "var(--success)", marginTop: "4px", fontWeight: "bold" }}>
                        ₹{registrations.filter(r => r.QR_ID == 3).reduce((sum, r) => sum + (Number(r.Amount) || 0), 0)} collected
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
                    <Loader2 size={32} className="spin" color="var(--primary)" />
                </div>
            ) : error ? (
                <div style={{ color: "var(--error)", padding: "20px", background: "rgba(239,68,68,0.1)", borderRadius: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <AlertCircle size={20} />
                    {error}
                </div>
            ) : registrations.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)" }}>
                    No registrations yet.
                </div>
            ) : (
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", color: "var(--text-secondary)", fontSize: "14px" }}>
                        <thead>
                            <tr style={{ background: "rgba(255,255,255,0.05)", textAlign: "left" }}>
                                <th style={{ padding: "12px", borderBottom: "1px solid var(--border-color)" }}>S.No.</th>
                                <th style={{ padding: "12px", borderBottom: "1px solid var(--border-color)" }}>Order ID</th>
                                <th style={{ padding: "12px", borderBottom: "1px solid var(--border-color)" }}>Team Name</th>
                                <th style={{ padding: "12px", borderBottom: "1px solid var(--border-color)" }}>Department</th>
                                <th style={{ padding: "12px", borderBottom: "1px solid var(--border-color)" }}>Domain</th>
                                <th style={{ padding: "12px", borderBottom: "1px solid var(--border-color)" }}>Team Lead</th>
                                <th style={{ padding: "12px", borderBottom: "1px solid var(--border-color)" }}>Members</th>
                                <th style={{ padding: "12px", borderBottom: "1px solid var(--border-color)" }}>UTR</th>
                                <th style={{ padding: "12px", borderBottom: "1px solid var(--border-color)" }}>Amount</th>
                                <th style={{ padding: "12px", borderBottom: "1px solid var(--border-color)" }}>Status</th>
                                <th style={{ padding: "12px", borderBottom: "1px solid var(--border-color)" }}>Date</th>
                                <th style={{ padding: "12px", borderBottom: "1px solid var(--border-color)", textAlign: "center" }}>Screenshot</th>
                                <th style={{ padding: "12px", borderBottom: "1px solid var(--border-color)" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {registrations.map((reg, idx) => (
                                <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                    <td style={{ padding: "12px", fontWeight: "bold", color: "var(--text-primary)", textAlign: "center" }}>{idx + 1}</td>
                                    <td style={{ padding: "12px", fontSize: "12px" }}>{reg.OrderID}</td>
                                    <td style={{ padding: "12px" }}>
                                        <strong style={{ color: "var(--text-primary)" }}>{reg.TeamName}</strong>
                                    </td>
                                    <td style={{ padding: "12px" }}>
                                        <div>{reg.Department || "N/A"}</div>
                                    </td>
                                    <td style={{ padding: "12px" }}>
                                        <div>{reg.Domain || "N/A"}</div>
                                        <div style={{ fontSize: "12px", opacity: 0.7 }}>{reg.Branch}</div>
                                    </td>
                                    <td style={{ padding: "12px" }}>
                                        <div>{reg.LeadName}</div>
                                        <div style={{ fontSize: "12px", opacity: 0.7 }}>{reg.LeadEmail}</div>
                                        <div style={{ fontSize: "12px", opacity: 0.7 }}>{reg.LeadPhone}</div>
                                    </td>
                                    <td style={{ padding: "12px", textAlign: "center" }}>{reg.Members}</td>
                                    <td style={{ padding: "12px", fontFamily: "monospace" }}>{reg.UTR}</td>
                                    <td style={{ padding: "12px", fontWeight: "bold", color: "var(--text-primary)" }}>₹{reg.Amount}</td>
                                    <td style={{ padding: "12px" }}>
                                        <span style={{
                                            background: "rgba(16,185,129,0.1)",
                                            color: "var(--success)",
                                            padding: "4px 8px", borderRadius: "4px", fontSize: "12px"
                                        }}>
                                            {reg.Status}
                                        </span>
                                    </td>
                                    <td style={{ padding: "12px", fontSize: "12px" }}>{reg.Date}</td>
                                    <td style={{ padding: "12px", textAlign: "center" }}>
                                        {reg.Screenshot ? (
                                            <div
                                                onClick={() => setSelectedImage(reg.Screenshot)}
                                                style={{ cursor: "pointer", display: "inline-block", position: "relative" }}
                                                title="Click to view full size"
                                            >
                                                <img
                                                    src={reg.Screenshot.startsWith("/") ? `https://nri-techarena-hackthon-system-website-3.onrender.com${reg.Screenshot}` : reg.Screenshot}
                                                    alt="Payment"
                                                    style={{ width: "60px", height: "60px", objectFit: "cover", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.2)", transition: "transform 0.2s" }}
                                                    onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.1)"}
                                                    onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
                                                />
                                            </div>
                                        ) : (
                                            <span style={{ color: "var(--text-secondary)", fontSize: "12px" }}>N/A</span>
                                        )}
                                    </td>
                                    <td style={{ padding: "12px" }}>
                                        <button
                                            className="delete-btn"
                                            onClick={() => deleteRegistration(reg.OrderID)}
                                        >
                                            🗑 Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Image Modal */}
            {selectedImage && (
                <div style={{
                    position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
                    background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)",
                    display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000
                }} onClick={() => setSelectedImage(null)}>
                    <div style={{ position: "relative", maxWidth: "90%", maxHeight: "90%" }} onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setSelectedImage(null)}
                            style={{
                                position: "absolute", top: "-40px", right: 0,
                                border: "none", color: "white", cursor: "pointer",
                                padding: "8px", background: "rgba(255,255,255,0.1)",
                                borderRadius: "50%", display: "flex",
                                alignItems: "center", justifyContent: "center"
                            }}
                        >
                            <X size={24} />
                        </button>
                        <img
                            src={selectedImage.startsWith("/") ? `https://nri-techarena-hackthon-system-website-3.onrender.com${selectedImage}` : selectedImage}
                            alt="Payment Screenshot"
                            style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: "8px", border: "2px solid rgba(255,255,255,0.1)" }}
                        />
                    </div>
                </div>
            )}

            {/* Stop Payments & Flip Timer Block */}
            <div style={{
                marginTop: "40px", padding: "30px", background: "rgba(255,255,255,0.03)",
                borderTop: "1px solid var(--border-color)", borderRadius: "16px",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "24px"
            }}>
                <div style={{ textAlign: "center" }}>
                    <h3 style={{ margin: "0 0 10px", color: "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                        <Clock color="var(--primary)" />
                        Registration Deadline
                    </h3>
                    <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: "14px" }}>
                        Timer automatically counts down to 12:00 PM on 28/03/2026. Payments stop automatically at zero, but you can manually bypass this below anytime.
                    </p>
                </div>

                {/* Flip Timer UI */}
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", margin: "10px 0" }}>
                    <FlipUnit digit={timeLeft.d} unit="Days" />
                    <span style={{ fontSize: "2rem", color: "var(--text-secondary)", margin: "0 5px", marginBottom: "30px" }}>:</span>
                    <FlipUnit digit={timeLeft.h} unit="Hours" />
                    <span style={{ fontSize: "2rem", color: "var(--text-secondary)", margin: "0 5px", marginBottom: "30px" }}>:</span>
                    <FlipUnit digit={timeLeft.m} unit="Minutes" />
                    <span style={{ fontSize: "2rem", color: "var(--text-secondary)", margin: "0 5px", marginBottom: "30px" }}>:</span>
                    <FlipUnit digit={timeLeft.s} unit="Seconds" />
                </div>

                {/* Manual Override Button */}
                <div style={{ width: "100%", maxWidth: "400px", padding: "20px", background: "black", borderRadius: "12px", border: paymentStatus?.paymentsStopped ? "1px solid var(--error)" : "1px solid var(--success)", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                    <div style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
                        Current Status: <strong style={{ color: paymentStatus?.paymentsStopped ? "var(--error)" : "var(--success)" }}>{paymentStatus?.paymentsStopped ? "CLOSED (STOPPED)" : "OPEN (RECEIVING PAYMENTS)"}</strong>
                    </div>

                    <button
                        onClick={togglePayments}
                        style={{
                            width: "100%", padding: "16px", borderRadius: "8px", fontWeight: "bold",
                            border: "none", cursor: "pointer", display: "flex", gap: "12px", alignItems: "center", justifyContent: "center", fontSize: "16px", transition: "0.2s",
                            color: "white", background: paymentStatus?.paymentsStopped ? "linear-gradient(135deg, rgb(16, 185, 129), rgb(5, 150, 105))" : "linear-gradient(135deg, rgb(239, 68, 68), rgb(185, 28, 28))"
                        }}
                    >
                        {paymentStatus?.paymentsStopped ? (
                            <><PlayCircle size={22} /> Resume Registrations</>
                        ) : (
                            <><PauseCircle size={22} /> STOP ALL REGISTRATIONS</>
                        )}
                    </button>
                    <p style={{ margin: 0, fontSize: "11px", color: "var(--text-secondary)", textAlign: "center" }}>
                        Clicking this will instantly {paymentStatus?.paymentsStopped ? "re-enable" : "shut down"} .
                    </p>
                </div>
            </div>

        </div>
    );
}
