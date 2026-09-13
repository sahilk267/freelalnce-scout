/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Users, 
  UserPlus, 
  Shield, 
  ShieldAlert, 
  Key, 
  Check, 
  Copy, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Ban, 
  RotateCcw, 
  Clock, 
  LogOut, 
  Mail,
  UserCheck,
  Tag
} from "lucide-react";
import { UserPublicProfile, UserRole, UserInvite } from "../domain/models/User";
import { apiFetch, getAuthUser } from "../utils/apiAuth";
import PricingManager from "./PricingManager";

export default function UserManager() {
  const currentUser = getAuthUser();
  const [activeTab, setActiveTab] = useState<"users" | "pricing">("users");
  const [users, setUsers] = useState<UserPublicProfile[]>([]);
  const [invites, setInvites] = useState<UserInvite[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New invite form state
  const [newInviteEmail, setNewInviteEmail] = useState("");
  const [newInviteRole, setNewInviteRole] = useState<UserRole>("recruiter");
  const [newInviteHours, setNewInviteHours] = useState(48);
  const [createdInvite, setCreatedInvite] = useState<UserInvite | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, invitesRes] = await Promise.all([
        apiFetch("/api/auth/users"),
        apiFetch("/api/auth/invites")
      ]);

      if (!usersRes.ok) {
        const data = await usersRes.json();
        throw new Error(data.error || "Failed to load users directory");
      }
      const usersData = await usersRes.json();
      setUsers(usersData);

      if (invitesRes.ok) {
        const invitesData = await invitesRes.json();
        setInvites(invitesData);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load access control directory");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setActionLoading("invite");

    try {
      const res = await apiFetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newInviteEmail.trim() || undefined,
          role: newInviteRole,
          expiresInHours: Number(newInviteHours)
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate invite token");
      }

      setCreatedInvite(data);
      setSuccess(`Single-use invite token generated for role '${newInviteRole}'`);
      setNewInviteEmail("");
      loadData();
    } catch (err: any) {
      setError(err.message || "Failed to generate invite");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setError(null);
    setSuccess(null);
    setActionLoading(`role-${userId}`);

    try {
      const res = await apiFetch(`/api/auth/users/${userId}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update user role");
      }

      setSuccess(`Updated user role to '${newRole}'`);
      loadData();
    } catch (err: any) {
      setError(err.message || "Role change failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeactivate = async (userId: string) => {
    if (!confirm("Are you sure you want to deactivate this account? All active sessions will be terminated.")) {
      return;
    }

    setError(null);
    setSuccess(null);
    setActionLoading(`deactivate-${userId}`);

    try {
      const res = await apiFetch(`/api/auth/users/${userId}/deactivate`, {
        method: "POST"
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to deactivate user");
      }

      setSuccess("User account deactivated and active sessions revoked");
      loadData();
    } catch (err: any) {
      setError(err.message || "Deactivation failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivate = async (userId: string) => {
    setError(null);
    setSuccess(null);
    setActionLoading(`reactivate-${userId}`);

    try {
      const res = await apiFetch(`/api/auth/users/${userId}/reactivate`, {
        method: "POST"
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reactivate user");
      }

      setSuccess("User account reactivated successfully");
      loadData();
    } catch (err: any) {
      setError(err.message || "Reactivation failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevokeSessions = async (userId: string) => {
    if (!confirm("Terminate all active JWT sessions for this user?")) {
      return;
    }

    setError(null);
    setSuccess(null);
    setActionLoading(`revoke-${userId}`);

    try {
      const res = await apiFetch(`/api/auth/users/${userId}/revoke-sessions`, {
        method: "POST"
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to revoke sessions");
      }

      setSuccess("All active login sessions for user have been revoked");
      loadData();
    } catch (err: any) {
      setError(err.message || "Revoke sessions failed");
    } finally {
      setActionLoading(null);
    }
  };

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2500);
    }
  };

  return (
    <div className="space-y-8" id="user-manager-module">
      {/* Module Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl" id="user-manager-header">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-xl" id="header-icon">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight" id="user-manager-title">
                Role-Based Access Control (RBAC)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 font-mono" id="user-manager-desc">
                Manage user accounts, roles ("admin" vs "recruiter"), invitations, and session lifecycles.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono flex items-center gap-2 border border-slate-700 transition-colors"
          id="btn-refresh-users"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Directory</span>
        </button>
      </div>

      {/* Admin Tab Switcher */}
      <div className="flex border-b border-slate-800 space-x-6" id="admin-subnav-tabs">
        <button
          onClick={() => setActiveTab("users")}
          id="tab-admin-users"
          className={`pb-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "users"
              ? "border-blue-500 text-blue-400 font-semibold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>User Directory & Invites</span>
        </button>

        <button
          onClick={() => setActiveTab("pricing")}
          id="tab-admin-pricing"
          className={`pb-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "pricing"
              ? "border-emerald-500 text-emerald-400 font-semibold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>Pricing</span>
        </button>
      </div>

      {activeTab === "pricing" ? (
        <PricingManager />
      ) : (
        <>
          {/* Notifications */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-3" id="user-manager-error">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-3" id="user-manager-success">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{success}</span>
            </div>
          )}

      {/* Issue Invite Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6" id="invite-generator-card">
        <div className="flex items-center gap-2.5 mb-4 text-white font-semibold text-sm">
          <UserPlus className="w-4 h-4 text-blue-400" />
          <span>Generate Single-Use Invite Token</span>
        </div>

        <form onSubmit={handleCreateInvite} className="grid grid-cols-1 md:grid-cols-4 gap-4" id="form-create-invite">
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1" htmlFor="invite-email">
              Restricted Email (Optional)
            </label>
            <input
              id="invite-email"
              type="email"
              value={newInviteEmail}
              onChange={(e) => setNewInviteEmail(e.target.value)}
              placeholder="candidate@company.com"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1" htmlFor="invite-role">
              Assigned Role
            </label>
            <select
              id="invite-role"
              value={newInviteRole}
              onChange={(e) => setNewInviteRole(e.target.value as UserRole)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            >
              <option value="recruiter">recruiter (ATS, JSI, Companies)</option>
              <option value="admin">admin (Full System Access)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1" htmlFor="invite-hours">
              Token Expiration
            </label>
            <select
              id="invite-hours"
              value={newInviteHours}
              onChange={(e) => setNewInviteHours(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            >
              <option value={24}>24 Hours</option>
              <option value={48}>48 Hours (Standard)</option>
              <option value={72}>72 Hours</option>
              <option value={168}>7 Days</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={actionLoading === "invite"}
              id="btn-submit-invite"
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-md shadow-blue-600/20"
            >
              {actionLoading === "invite" ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Key className="w-3.5 h-3.5" />
              )}
              <span>Issue Invite Token</span>
            </button>
          </div>
        </form>

        {/* Display Created Invite Token */}
        {createdInvite && (
          <div className="mt-5 p-4 bg-slate-950 border border-amber-500/40 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3" id="created-invite-display">
            <div className="space-y-1">
              <div className="text-[11px] font-mono text-amber-400 uppercase tracking-wider flex items-center gap-1.5 font-bold">
                <Key className="w-3.5 h-3.5" />
                Active Single-Use Token Generated
              </div>
              <div className="font-mono text-xs text-white bg-slate-900 px-2.5 py-1 rounded border border-slate-800 break-all select-all">
                {createdInvite.token}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Role: <span className="text-white font-semibold">{createdInvite.role}</span> • Expires: {new Date(createdInvite.expiresAt).toLocaleString()}
                {createdInvite.email && ` • Restricted to: ${createdInvite.email}`}
              </div>
            </div>

            <button
              type="button"
              onClick={() => copyToClipboard(createdInvite.token)}
              className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors shrink-0"
              id="btn-copy-token"
            >
              {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedToken ? "Copied!" : "Copy Token"}</span>
            </button>
          </div>
        )}
      </div>

      {/* Users Directory Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden" id="users-directory-table-card">
        <div className="p-5 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Registered Users ({users.length})</h3>
          </div>
          <span className="text-xs font-mono text-slate-500">
            Current session: <strong className="text-blue-400">{currentUser?.email}</strong> ({currentUser?.role})
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono" id="users-table">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
              <tr>
                <th className="px-5 py-3">User / Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Login</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {users.map((u) => {
                const isSelf = currentUser?.id === u.id;
                return (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition-colors" id={`user-row-${u.id}`}>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-white flex items-center gap-2">
                        <span>{u.email}</span>
                        {isSelf && (
                          <span className="text-[10px] bg-blue-900/60 text-blue-300 border border-blue-700/50 px-1.5 py-0.5 rounded">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">{u.id}</div>
                    </td>

                    <td className="px-4 py-3.5">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                        disabled={actionLoading === `role-${u.id}`}
                        className={`bg-slate-950 border rounded-lg px-2 py-1 text-[11px] font-mono focus:outline-none transition-colors ${
                          u.role === "admin"
                            ? "text-purple-300 border-purple-800/60"
                            : "text-blue-300 border-blue-800/60"
                        }`}
                        id={`select-role-${u.id}`}
                      >
                        <option value="admin">admin</option>
                        <option value="recruiter">recruiter</option>
                      </select>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        u.active
                          ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/60"
                          : "bg-rose-950/60 text-rose-400 border border-rose-800/60"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.active ? "bg-emerald-400" : "bg-rose-400"}`} />
                        {u.active ? "Active" : "Deactivated"}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-slate-400 text-[11px]">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}
                    </td>

                    <td className="px-4 py-3.5 text-slate-400 text-[11px]">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Revoke Sessions */}
                        <button
                          type="button"
                          onClick={() => handleRevokeSessions(u.id)}
                          disabled={actionLoading === `revoke-${u.id}`}
                          title="Revoke all active sessions"
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors"
                          id={`btn-revoke-sessions-${u.id}`}
                        >
                          <LogOut className="w-3.5 h-3.5" />
                        </button>

                        {/* Deactivate / Reactivate */}
                        {u.active ? (
                          <button
                            type="button"
                            onClick={() => handleDeactivate(u.id)}
                            disabled={actionLoading === `deactivate-${u.id}` || isSelf}
                            title={isSelf ? "Cannot deactivate yourself" : "Deactivate user"}
                            className="p-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            id={`btn-deactivate-${u.id}`}
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleReactivate(u.id)}
                            disabled={actionLoading === `reactivate-${u.id}`}
                            title="Reactivate user"
                            className="p-1.5 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-800/50 rounded-lg transition-colors"
                            id={`btn-reactivate-${u.id}`}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Invites Table */}
      {invites.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden" id="pending-invites-card">
          <div className="p-4 border-b border-slate-800 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Pending Unredeemed Invites ({invites.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono" id="invites-table">
              <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">Invite Token</th>
                  <th className="px-4 py-3">Assigned Role</th>
                  <th className="px-4 py-3">Email Restriction</th>
                  <th className="px-4 py-3">Expires At</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {invites.map((inv) => (
                  <tr key={inv.token} className="hover:bg-slate-800/30" id={`invite-row-${inv.token.substring(0, 10)}`}>
                    <td className="px-4 py-3 font-semibold text-amber-300">
                      {inv.token.substring(0, 18)}...
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
                        {inv.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {inv.email || "Any Email"}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(inv.expiresAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(inv.token)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] inline-flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
