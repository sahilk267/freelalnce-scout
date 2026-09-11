/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  UserCheck, 
  XCircle, 
  Plus, 
  RefreshCw, 
  Send, 
  ShieldAlert, 
  ShieldCheck,
  Key,
  Lock, 
  Check, 
  ExternalLink,
  History,
  ToggleLeft,
  ToggleRight,
  Eye,
  EyeOff
} from "lucide-react";
import { SchedulingSession, InterviewerSlot, SchedulingAuditLog } from "../domain/models/Scheduling";
import { getAdminAuthHeaders, getAdminApiKey, setAdminApiKey } from "../utils/apiAuth";

export default function SchedulingDashboard() {
  const [activeTab, setActiveTab] = useState<"recruiter" | "candidate_portal" | "audit_logs">("recruiter");
  
  // Recruiter state
  const [sessions, setSessions] = useState<SchedulingSession[]>([]);
  const [auditLogs, setAuditLogs] = useState<SchedulingAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Admin API key management state
  const [apiKeyInput, setApiKeyInput] = useState(() => getAdminApiKey());
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [isAuthError, setIsAuthError] = useState(false);
  const [showKeySecret, setShowKeySecret] = useState(false);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [interviewerName, setInterviewerName] = useState("Dr. Sarah Vance");
  const [interviewerId, setInterviewerId] = useState("int_sarah_vance");
  const [autoBookEnabled, setAutoBookEnabled] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ session: SchedulingSession; token: string } | null>(null);

  // Candidate Portal Simulator state
  const [portalSessionId, setPortalSessionId] = useState("");
  const [portalToken, setPortalToken] = useState("");
  const [candidateSlots, setCandidateSlots] = useState<InterviewerSlot[]>([]);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [portalSuccess, setPortalSuccess] = useState<string | null>(null);
  const [portalSessionStatus, setPortalSessionStatus] = useState<string | null>(null);
  const [portalAutoBook, setPortalAutoBook] = useState<boolean>(false);

  const fetchSessionsAndLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const [resSessions, resLogs] = await Promise.all([
        fetch("/api/scheduling/sessions", { headers: getAdminAuthHeaders() }),
        fetch("/api/scheduling/audit-logs", { headers: getAdminAuthHeaders() })
      ]);

      if (resSessions.status === 401 || resLogs.status === 401) {
        setIsAuthError(true);
        setError("Admin Authorization Required (401): AZIZ_API_KEY is configured on the server. Please enter your API key to access recruiter scheduling.");
        setSessions([]);
        setAuditLogs([]);
        return;
      }

      if (!resSessions.ok || !resLogs.ok) {
        setError(`Failed to load scheduling data (HTTP ${resSessions.status}/${resLogs.status}).`);
        return;
      }

      setIsAuthError(false);
      const dataSessions = await resSessions.json();
      setSessions(dataSessions);
      const dataLogs = await resLogs.json();
      setAuditLogs(dataLogs);
    } catch (err: any) {
      setError(`Failed to load scheduling data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionsAndLogs();

    const handleKeyUpdate = () => {
      setApiKeyInput(getAdminApiKey());
      fetchSessionsAndLogs();
    };

    const handleUnauthorized = (e: any) => {
      if (e?.detail?.url && (e.detail.url.includes("/scheduling/") || e.detail.url.includes("/api/"))) {
        setIsAuthError(true);
        setError("Admin Authorization Required (401): Valid AZIZ_API_KEY required. Please configure your key below.");
      }
    };

    window.addEventListener("aziz-api-key-updated", handleKeyUpdate);
    window.addEventListener("aziz-api-unauthorized", handleUnauthorized);

    return () => {
      window.removeEventListener("aziz-api-key-updated", handleKeyUpdate);
      window.removeEventListener("aziz-api-unauthorized", handleUnauthorized);
    };
  }, []);

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminApiKey(apiKeyInput.trim());
    setIsAuthError(false);
    setShowKeyConfig(false);
    setActionSuccess("AZIZ_API_KEY updated successfully.");
    fetchSessionsAndLogs();
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateName.trim() || !candidateEmail.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/scheduling/invite", {
        method: "POST",
        headers: getAdminAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          candidateId: `cand_${Date.now()}`,
          candidateName,
          candidateEmail,
          interviewerId,
          interviewerName,
          autoBookEnabled
        })
      });

      const data = await res.json();
      if (res.ok) {
        setInviteResult({ session: data.session, token: data.token });
        // Auto-populate candidate portal simulator
        setPortalSessionId(data.session.id);
        setPortalToken(data.token);
        fetchSessionsAndLogs();
      } else {
        if (res.status === 401) {
          setIsAuthError(true);
          setError("Unauthorized (401): Valid AZIZ_API_KEY is required to create invites.");
        } else {
          setError(data.error || "Failed to generate candidate invite.");
        }
      }
    } catch (err: any) {
      setError(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPending = async (sessionId: string) => {
    setLoading(true);
    setActionSuccess(null);
    setError(null);
    try {
      const res = await fetch("/api/scheduling/confirm", {
        method: "POST",
        headers: getAdminAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ sessionId })
      });
      const data = await res.json();
      if (res.ok) {
        setActionSuccess(`Booking confirmed successfully for session ${sessionId}.`);
        fetchSessionsAndLogs();
      } else {
        if (res.status === 401) {
          setIsAuthError(true);
          setError("Unauthorized (401): Valid AZIZ_API_KEY is required to confirm bookings.");
        } else {
          setError(data.error || "Failed to confirm booking.");
        }
      }
    } catch (err: any) {
      setError(`Confirmation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRecruiterCancelBooking = async (sessionId: string) => {
    setLoading(true);
    setActionSuccess(null);
    setError(null);
    try {
      const res = await fetch("/api/scheduling/cancel", {
        method: "POST",
        headers: getAdminAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ 
          sessionId,
          reason: "Recruiter cancelled session from dashboard"
        })
      });
      const data = await res.json();
      if (res.ok) {
        setActionSuccess(`Session ${sessionId} successfully cancelled.`);
        fetchSessionsAndLogs();
      } else {
        if (res.status === 401) {
          setIsAuthError(true);
          setError("Unauthorized (401): Valid AZIZ_API_KEY is required to cancel sessions as recruiter.");
        } else {
          setError(data.error || "Failed to cancel session.");
        }
      }
    } catch (err: any) {
      setError(`Cancellation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCandidateCancelBooking = async () => {
    if (!portalSessionId.trim() || !portalToken.trim()) {
      setPortalError("Provide both Session ID and Candidate Token.");
      return;
    }
    setPortalLoading(true);
    setPortalError(null);
    setPortalSuccess(null);
    try {
      const res = await fetch("/api/scheduling/cancel", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Session-Token": portalToken
        },
        body: JSON.stringify({
          sessionId: portalSessionId,
          reason: "Candidate cancelled booking via self-service portal"
        })
      });

      const data = await res.json();
      if (res.ok) {
        setPortalSuccess("Booking / slot reservation has been cancelled.");
        handleFetchCandidateSlots();
        fetchSessionsAndLogs();
      } else {
        setPortalError(data.error || "Failed to cancel booking.");
      }
    } catch (err: any) {
      setPortalError(`Error cancelling booking: ${err.message}`);
    } finally {
      setPortalLoading(false);
    }
  };

  const handleFetchCandidateSlots = async () => {
    if (!portalSessionId.trim() || !portalToken.trim()) {
      setPortalError("Provide both Session ID and Candidate Token.");
      return;
    }

    setPortalLoading(true);
    setPortalError(null);
    setPortalSuccess(null);
    try {
      const res = await fetch(`/api/scheduling/slots/${portalSessionId}`, {
        headers: { "X-Session-Token": portalToken }
      });
      const data = await res.json();
      if (res.ok) {
        setCandidateSlots(data.slots || []);
        setPortalSessionStatus(data.sessionStatus);
        setPortalAutoBook(Boolean(data.autoBookEnabled));
      } else {
        setPortalError(data.error || "Failed to query available slots.");
      }
    } catch (err: any) {
      setPortalError(`Network error: ${err.message}`);
    } finally {
      setPortalLoading(false);
    }
  };

  const handleCandidateSelectSlot = async (slotId: string) => {
    setPortalLoading(true);
    setPortalError(null);
    setPortalSuccess(null);
    try {
      const res = await fetch("/api/scheduling/select", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Session-Token": portalToken
        },
        body: JSON.stringify({
          sessionId: portalSessionId,
          slotId
        })
      });

      const data = await res.json();
      if (res.ok) {
        if (data.session?.status === "confirmed") {
          setPortalSuccess("🎉 Interview confirmed and booked on calendar!");
        } else {
          setPortalSuccess("⏳ Slot held for 48 hours! Awaiting recruiter final confirmation.");
        }
        handleFetchCandidateSlots();
        fetchSessionsAndLogs();
      } else {
        setPortalError(data.error || "Slot selection failed.");
      }
    } catch (err: any) {
      setPortalError(`Error selecting slot: ${err.message}`);
    } finally {
      setPortalLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "invited":
        return <span className="px-2.5 py-1 text-xs font-medium rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">Invite Sent</span>;
      case "pending_confirmation":
        return <span className="px-2.5 py-1 text-xs font-medium rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">Pending Confirmation (48h Hold)</span>;
      case "confirmed":
        return <span className="px-2.5 py-1 text-xs font-medium rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Confirmed</span>;
      case "needs_human_review":
        return <span className="px-2.5 py-1 text-xs font-medium rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Needs Human Review</span>;
      case "hold_expired":
        return <span className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-500/10 text-slate-400 border border-slate-500/20">Hold Expired</span>;
      case "cancelled":
        return <span className="px-2.5 py-1 text-xs font-medium rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">Cancelled</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-800 text-slate-300">{status}</span>;
    }
  };

  return (
    <div className="space-y-6" id="scheduling-dashboard-root">
      {/* Module Header */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex justify-between items-center flex-wrap gap-4" id="scheduling-header">
        <div>
          <h2 className="text-xl font-sans font-semibold text-white tracking-tight flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-400" />
            Self-Scheduling Agent & Calendar Hub
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Automate interview slot search, candidate selection holds, 48h timeout sweeps, and double-booking concurrency locks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowKeyConfig(!showKeyConfig)}
            id="toggle-api-key-config-btn"
            className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
              apiKeyInput
                ? "bg-slate-800 hover:bg-slate-700 text-emerald-400 border-slate-700"
                : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30"
            }`}
            title="Configure Admin API Key (AZIZ_API_KEY)"
          >
            {apiKeyInput ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>API Key Set</span>
              </>
            ) : (
              <>
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>Set API Key</span>
              </>
            )}
          </button>
          <button
            onClick={() => setShowInviteModal(true)}
            id="create-invite-btn"
            className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Candidate Invite
          </button>
          <button
            onClick={fetchSessionsAndLogs}
            id="refresh-scheduling-btn"
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* API Key Configuration Drawer / Auth Banner */}
      {(showKeyConfig || isAuthError) && (
        <div className="bg-slate-900/90 border border-indigo-500/30 rounded-xl p-5 shadow-lg backdrop-blur-sm" id="api-key-config-panel">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Admin Authentication (AZIZ_API_KEY)</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  The backend requires <code className="text-indigo-300 font-mono">X-API-Key</code> on all administrative recruiter endpoints (<code className="text-slate-300 font-mono">/sessions</code>, <code className="text-slate-300 font-mono">/invite</code>, <code className="text-slate-300 font-mono">/confirm</code>, <code className="text-slate-300 font-mono">/audit-logs</code>).
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowKeyConfig(false)}
              className="text-slate-500 hover:text-slate-300 text-xs px-2 py-1 rounded border border-slate-800 hover:bg-slate-800"
            >
              Close
            </button>
          </div>

          <form onSubmit={handleSaveApiKey} className="flex items-center gap-3 mt-3 flex-wrap">
            <div className="relative flex-1 min-w-[280px]">
              <input
                type={showKeySecret ? "text" : "password"}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="Enter AZIZ_API_KEY..."
                className="w-full pl-3 pr-10 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                id="aziz-api-key-input"
              />
              <button
                type="button"
                onClick={() => setShowKeySecret(!showKeySecret)}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                tabIndex={-1}
              >
                {showKeySecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              type="submit"
              id="save-api-key-btn"
              className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              Save & Authenticate
            </button>
            {apiKeyInput && (
              <button
                type="button"
                onClick={() => {
                  setApiKeyInput("");
                  setAdminApiKey("");
                  setIsAuthError(false);
                }}
                className="px-3 py-2 text-sm font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Clear Key
              </button>
            )}
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-800 space-x-6" id="scheduling-tabs">
        <button
          onClick={() => setActiveTab("recruiter")}
          id="tab-recruiter-btn"
          className={`pb-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "recruiter"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Recruiter Management ({sessions.length})
        </button>

        <button
          onClick={() => setActiveTab("candidate_portal")}
          id="tab-candidate-portal-btn"
          className={`pb-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "candidate_portal"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <ExternalLink className="w-4 h-4" />
          Candidate Self-Scheduling Portal
        </button>

        <button
          onClick={() => setActiveTab("audit_logs")}
          id="tab-audit-logs-btn"
          className={`pb-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "audit_logs"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <History className="w-4 h-4" />
          Audit Logs ({auditLogs.length})
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          {error}
        </div>
      )}
      {actionSuccess && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          {actionSuccess}
        </div>
      )}

      {/* RECRUITER MANAGEMENT TAB */}
      {activeTab === "recruiter" && (
        <div className="space-y-4" id="recruiter-sessions-panel">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-medium text-xs uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Candidate</th>
                  <th className="px-6 py-3.5">Interviewer</th>
                  <th className="px-6 py-3.5">Auto-Book</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Selected Slot</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                      No active scheduling sessions found. Click "Create Candidate Invite" to generate an interview link.
                    </td>
                  </tr>
                ) : (
                  sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{s.candidateName}</div>
                        <div className="text-xs text-slate-500">{s.candidateEmail}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-300">
                        {s.interviewerName}
                      </td>
                      <td className="px-6 py-4">
                        {s.autoBookEnabled ? (
                          <span className="text-xs text-emerald-400 font-mono">Enabled</span>
                        ) : (
                          <span className="text-xs text-slate-500 font-mono">Disabled (48h Hold)</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(s.status)}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-400">
                        {s.selectedSlotStart ? (
                          <div>
                            <div>{new Date(s.selectedSlotStart).toLocaleString()}</div>
                            <div className="text-slate-500">to {new Date(s.selectedSlotEnd!).toLocaleTimeString()}</div>
                          </div>
                        ) : (
                          <span className="text-slate-600">None selected</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {s.status === "pending_confirmation" && (
                          <button
                            onClick={() => handleConfirmPending(s.id)}
                            id={`confirm-btn-${s.id}`}
                            className="px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                          >
                            Confirm Booking
                          </button>
                        )}
                        {s.status === "needs_human_review" && (
                          <button
                            onClick={() => handleConfirmPending(s.id)}
                            id={`override-confirm-btn-${s.id}`}
                            className="px-3 py-1.5 text-xs font-medium rounded-md bg-amber-600 hover:bg-amber-500 text-white transition-colors"
                          >
                            Override & Confirm
                          </button>
                        )}
                        {s.status !== "cancelled" && s.status !== "hold_expired" && (
                          <button
                            onClick={() => handleRecruiterCancelBooking(s.id)}
                            id={`recruiter-cancel-btn-${s.id}`}
                            className="px-3 py-1.5 text-xs font-medium rounded-md bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 transition-colors"
                          >
                            Cancel Session
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setPortalSessionId(s.id);
                            setActiveTab("candidate_portal");
                          }}
                          id={`test-portal-btn-${s.id}`}
                          className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                        >
                          Test Portal
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CANDIDATE PORTAL SIMULATOR TAB */}
      {activeTab === "candidate_portal" && (
        <div className="space-y-6" id="candidate-portal-simulator">
          <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-indigo-400" />
                Candidate Authentication Link
              </h3>
              <span className="text-xs text-slate-500">
                Protected via timing-safe <code className="text-slate-300">X-Session-Token</code> header auth
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Session ID</label>
                <input
                  type="text"
                  value={portalSessionId}
                  onChange={(e) => setPortalSessionId(e.target.value)}
                  placeholder="e.g. sched_1720000000_abc"
                  id="portal-session-id-input"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Candidate Secret Token</label>
                <input
                  type="password"
                  value={portalToken}
                  onChange={(e) => setPortalToken(e.target.value)}
                  placeholder="e.g. sched_tok_..."
                  id="portal-token-input"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handleFetchCandidateSlots}
                id="fetch-slots-btn"
                disabled={portalLoading}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${portalLoading ? "animate-spin" : ""}`} />
                Query Available Interview Slots
              </button>

              <button
                onClick={handleCandidateCancelBooking}
                id="candidate-cancel-btn"
                disabled={portalLoading || !portalSessionId.trim() || !portalToken.trim()}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Cancel My Booking / Reservation
              </button>
            </div>
          </div>

          {portalError && (
            <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              {portalError}
            </div>
          )}

          {portalSuccess && (
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              {portalSuccess}
            </div>
          )}

          {/* Slots List */}
          {candidateSlots.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-slate-300">Available Interviewer Slots</h4>
                <span className="text-xs text-slate-400">
                  Mode: {portalAutoBook ? <strong className="text-emerald-400">Instant Auto-Book</strong> : <strong className="text-amber-400">48-Hour Recruiter Hold</strong>}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {candidateSlots.map((slot) => (
                  <div 
                    key={slot.id} 
                    className={`p-4 rounded-xl border transition-all ${
                      slot.status === "available"
                        ? "bg-slate-900 border-slate-800 hover:border-indigo-500/50"
                        : "bg-slate-900/50 border-slate-800/50 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-xs font-mono text-indigo-400">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(slot.slotStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(slot.slotEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                        slot.status === "available" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-slate-800 text-slate-500"
                      }`}>
                        {slot.status}
                      </span>
                    </div>

                    <div className="text-sm font-medium text-white mb-4">
                      {new Date(slot.slotStart).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>

                    <button
                      onClick={() => handleCandidateSelectSlot(slot.id)}
                      disabled={slot.status !== "available" || portalLoading}
                      id={`select-slot-btn-${slot.id}`}
                      className="w-full py-2 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 disabled:bg-slate-800 disabled:text-slate-500 flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Select Slot
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AUDIT LOGS TAB */}
      {activeTab === "audit_logs" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden" id="audit-logs-panel">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-medium text-xs uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-3.5">Timestamp</th>
                <th className="px-6 py-3.5">Action</th>
                <th className="px-6 py-3.5">Session ID</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No audit logs emitted yet.
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors font-mono text-xs">
                    <td className="px-6 py-3 text-slate-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-3 font-semibold text-indigo-300">
                      {log.action}
                    </td>
                    <td className="px-6 py-3 text-slate-400">
                      {log.sessionId}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${
                        log.status === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                        log.status === "needs_human_review" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                        "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-400 truncate max-w-xs">
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE INVITE MODAL */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50" id="create-invite-modal">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-indigo-400" />
                Generate Candidate Invite
              </h3>
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteResult(null);
                }}
                id="close-invite-modal-btn"
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {inviteResult ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm space-y-2">
                  <div className="font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Invite Generated Successfully!
                  </div>
                  <div className="text-xs text-slate-300 font-mono space-y-1">
                    <div><strong>Session ID:</strong> {inviteResult.session.id}</div>
                    <div><strong>Raw Candidate Token:</strong> {inviteResult.token}</div>
                  </div>
                </div>

                <p className="text-xs text-slate-400">
                  The raw token has been auto-filled into the Candidate Portal tab for testing.
                </p>

                <button
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteResult(null);
                    setActiveTab("candidate_portal");
                  }}
                  id="go-to-candidate-portal-btn"
                  className="w-full py-2.5 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                >
                  Open Candidate Portal Simulator
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateInvite} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Candidate Name</label>
                  <input
                    type="text"
                    required
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    placeholder="e.g. Alex Mercer"
                    id="candidate-name-input"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Candidate Email</label>
                  <input
                    type="email"
                    required
                    value={candidateEmail}
                    onChange={(e) => setCandidateEmail(e.target.value)}
                    placeholder="e.g. alex.mercer@example.com"
                    id="candidate-email-input"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Interviewer</label>
                  <input
                    type="text"
                    required
                    value={interviewerName}
                    onChange={(e) => setInterviewerName(e.target.value)}
                    id="interviewer-name-input"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <div>
                    <div className="text-xs font-medium text-slate-200">Auto-Book Mode</div>
                    <div className="text-[11px] text-slate-500">
                      {autoBookEnabled ? "Instantly book calendar upon selection" : "Require recruiter sign-off (48h hold)"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoBookEnabled(!autoBookEnabled)}
                    id="toggle-autobook-btn"
                    className="text-indigo-400 focus:outline-none"
                  >
                    {autoBookEnabled ? (
                      <ToggleRight className="w-7 h-7 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-slate-600" />
                    )}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  id="submit-invite-form-btn"
                  className="w-full py-2.5 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
                >
                  {loading ? "Generating Invite..." : "Generate Invite Link"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
