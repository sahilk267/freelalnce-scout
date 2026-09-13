/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Shield, Key, Mail, Lock, UserPlus, LogIn, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { setAuthSession } from "../utils/apiAuth";

interface AuthScreenProps {
  onSuccess: () => void;
}

export default function AuthScreen({ onSuccess }: AuthScreenProps) {
  const [isBootstrap, setIsBootstrap] = useState<boolean>(false);
  const [checkingBootstrap, setCheckingBootstrap] = useState<boolean>(true);
  const [mode, setMode] = useState<"login" | "register">("login");
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [rateLimitRetry, setRateLimitRetry] = useState<number | null>(null);

  useEffect(() => {
    checkBootstrapStatus();
  }, []);

  // Countdown timer for rate limiting
  useEffect(() => {
    if (rateLimitRetry === null || rateLimitRetry <= 0) return;
    const timer = setInterval(() => {
      setRateLimitRetry((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [rateLimitRetry]);

  const checkBootstrapStatus = async () => {
    setCheckingBootstrap(true);
    try {
      const res = await fetch("/api/auth/bootstrap-status");
      if (res.ok) {
        const data = await res.json();
        if (data.bootstrapAvailable) {
          setIsBootstrap(true);
          setMode("register");
        } else {
          setIsBootstrap(false);
        }
      }
    } catch {
      // Fallback
    } finally {
      setCheckingBootstrap(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429 && data.retryAfterSec) {
          setRateLimitRetry(data.retryAfterSec);
        }
        throw new Error(data.error || "Login authentication failed.");
      }

      setAuthSession(data.user);
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
          inviteToken: isBootstrap ? undefined : inviteToken
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Registration failed.");
      }

      setAuthSession(data.user);
      setSuccessMsg(isBootstrap ? "Master Administrator account initialized successfully!" : "Account created successfully!");
      setTimeout(() => {
        onSuccess();
      }, 500);
    } catch (err: any) {
      setError(err.message || "Failed to complete account registration.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingBootstrap) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 font-mono gap-3" id="auth-loading">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
        <span>Verifying Security Gateway...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden" id="auth-screen-container">
      {/* Background glowing effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-8 backdrop-blur-xl relative z-10" id="auth-card">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-500/20 mb-3" id="auth-icon-badge">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight" id="auth-title">
            {isBootstrap ? "Kernel Bootstrap Setup" : "Aziz OS Access Gateway"}
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono" id="auth-subtitle">
            {isBootstrap 
              ? "First-run: Initialize the Root Administrator account" 
              : "Zero-Trust Role-Based Access Control"}
          </p>
        </div>

        {/* Mode Selector Tabs (only shown when not first-run bootstrap) */}
        {!isBootstrap && (
          <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 mb-6" id="auth-tab-group">
            <button
              type="button"
              id="tab-btn-login"
              onClick={() => { setMode("login"); setError(null); }}
              className={`py-2 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
                mode === "login"
                  ? "bg-slate-800 text-white shadow-sm border border-slate-700"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In
            </button>
            <button
              type="button"
              id="tab-btn-register"
              onClick={() => { setMode("register"); setError(null); }}
              className={`py-2 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${
                mode === "register"
                  ? "bg-slate-800 text-white shadow-sm border border-slate-700"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Redeem Invite
            </button>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-start gap-2.5" id="auth-error-banner">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span>{error}</span>
              {rateLimitRetry !== null && (
                <div className="mt-1 font-mono text-rose-400 font-semibold">
                  Cooldown lock: {rateLimitRetry}s remaining
                </div>
              )}
            </div>
          </div>
        )}

        {/* Success Banner */}
        {successMsg && (
          <div className="mb-5 p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2.5" id="auth-success-banner">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form Container */}
        <form onSubmit={mode === "login" ? handleLogin : handleRegister} className="space-y-4" id="auth-form">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5" htmlFor="auth-email">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              Email Address
            </label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5" htmlFor="auth-password">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-mono"
            />
          </div>

          {mode === "register" && !isBootstrap && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5" htmlFor="auth-invite-token">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                Invite Token
              </label>
              <input
                id="auth-invite-token"
                type="text"
                required
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                placeholder="inv_..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1 font-mono">
                Registration requires a valid single-use invite issued by an administrator.
              </p>
            </div>
          )}

          {isBootstrap && (
            <div className="p-3 bg-blue-950/40 border border-blue-800/50 rounded-xl text-blue-300 text-[11px] font-mono leading-relaxed" id="bootstrap-info-box">
              ⭐ This initial account will automatically be granted the <strong>admin</strong> role with unrestricted kernel rights.
            </div>
          )}

          <button
            type="submit"
            id="auth-submit-btn"
            disabled={loading || rateLimitRetry !== null}
            className={`w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white transition-all duration-150 flex items-center justify-center gap-2 shadow-lg ${
              loading || rateLimitRetry !== null
                ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                : isBootstrap
                ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20"
                : "bg-blue-600 hover:bg-blue-500 shadow-blue-600/20"
            }`}
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : rateLimitRetry !== null ? (
              <span>Locked ({rateLimitRetry}s)</span>
            ) : isBootstrap ? (
              <>
                <Shield className="w-4 h-4" />
                <span>Create Master Administrator</span>
              </>
            ) : mode === "login" ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>Sign In to System</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Redeem & Create Account</span>
              </>
            )}
          </button>
        </form>

        {/* Footer Note */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 text-center">
          <p className="text-[11px] text-slate-500 font-mono">
            Self-Hosted Aziz OS • RBAC Enforced • 12h Session JWT
          </p>
        </div>
      </div>
    </div>
  );
}
