import { useState, useEffect } from "react";
import axios from "axios";
import { Loader2, AlertCircle, RefreshCcw, X, DatabaseBackup } from "lucide-react";
import { apiFetch } from "./api";

export default function BackupDashboard() {
    const [registrations, setRegistrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedImage, setSelectedImage] = useState(null);

    const fetchBackups = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiFetch("/admin/backups");
            setRegistrations(res);
        } catch (err) {
            setError(err.message || "Failed to fetch backups.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBackups();
    }, []);

    return (
        <div className="result-card" style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h2 style={{ margin: 0, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "10px" }}>
                    <DatabaseBackup color="#8b5cf6" />
                    Testing & Backup Registrations
                </h2>
                <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                    <button className="btn-primary" onClick={fetchBackups} style={{ background: "linear-gradient(135deg, #8b5cf6, #6d28d9)", width: "auto", display: "flex", gap: "8px", padding: "8px 16px" }}>
                        <RefreshCcw size={16} />Refresh Backups
                    </button>
                </div>
            </div>

            {/* Stats Bar */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", marginBottom: "24px" }}>
                <div style={{ background: "rgba(255,255,255,0.05)", padding: "16px", borderRadius: "12px", flex: "1 1 min-content", minWidth: "200px", border: "1px solid var(--border-color)" }}>
                    <div style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}>Total Backups</div>
                    <div style={{ fontSize: "28px", fontWeight: "bold", color: "var(--text-primary)" }}>{registrations.length}</div>
                </div>
            </div>

            {loading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
                    <Loader2 size={32} className="spin" color="#8b5cf6" />
                </div>
            ) : error ? (
                <div style={{ color: "var(--error)", padding: "20px", background: "rgba(239,68,68,0.1)", borderRadius: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <AlertCircle size={20} />
                    {error}
                </div>
            ) : registrations.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)" }}>
                    No backup registrations found.
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
                                <th style={{ padding: "12px", borderBottom: "1px solid var(--border-color)" }}>Receiver</th>
                                <th style={{ padding: "12px", borderBottom: "1px solid var(--border-color)" }}>Status</th>
                                <th style={{ padding: "12px", borderBottom: "1px solid var(--border-color)" }}>Date</th>
                                <th style={{ padding: "12px", borderBottom: "1px solid var(--border-color)", textAlign: "center" }}>Screenshot</th>
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
                                    <td style={{ padding: "12px" }}>{reg.Receiver}</td>
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
        </div>
    );
}
