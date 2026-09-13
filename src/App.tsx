/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import Studio from "./components/Studio";
import JobSearch from "./components/JobSearch";
import Ats from "./components/Ats";
import MemoryManager from "./components/MemoryManager";
import Diagnostics from "./components/Diagnostics";
import Terminal from "./components/Terminal";
import Integrations from "./components/Integrations";
import AgentDashboard from "./components/AgentDashboard";
import FreelancerDashboard from "./components/FreelancerDashboard";
import CompanyProfilesManager from "./components/CompanyProfilesManager";
import UserManager from "./components/UserManager";
import PricingManager from "./components/PricingManager";
import AuthScreen from "./components/AuthScreen";
import { ModuleId, SystemModule, DiagnosticMetrics } from "./types";
import { UserPublicProfile } from "./domain/models/User";
import { getAuthUser, setAuthSession, clearAuthSession, apiFetch } from "./utils/apiAuth";

export default function App() {
  const [user, setUser] = useState<UserPublicProfile | null>(() => getAuthUser());
  const [activeModule, setActiveModule] = useState<ModuleId>("studio");
  const [modules, setModules] = useState<SystemModule[]>([
    { id: "studio", name: "Studio Workspace", description: "AI Prompt prototyping and deployment studio", status: "active" },
    { id: "jsi", name: "Job Search Intelligence", description: "Live tracking & qualification of tech jobs", status: "active" },
    { id: "freelance", name: "Freelance Scout", description: "Automation of freelance platform listings", status: "active" },
    { id: "companies", name: "Company Profiles", description: "Multi-tenant lead routing & AadiTechs profile", status: "active" },
    { id: "ats", name: "Recruitment & ATS Hub", description: "Resume parser, optimizer and match matrix", status: "active" },
    { id: "agents", name: "Agent Core Framework", description: "Autonomous Agent Core & Task Queue Workspace", status: "active" },
    { id: "memory", name: "Semantic Memory", description: "Long-term client context storage", status: "active" },
    { id: "diagnostics", name: "Kernel Diagnostics", description: "System logs and micro-service statuses", status: "active" },
    { id: "terminal", name: "Secure CLI Terminal", description: "Execute developer command scripts", status: "active" },
    { id: "integrations", name: "Unified Integrations", description: "Configure SMTP, Gmail, Hostinger & Telegram", status: "active" },
    { id: "users", name: "User Management", description: "Role-Based Access Control, Invites & Directory", status: "active" },
    { id: "pricing", name: "Dynamic Pricing", description: "Resume Order Tiers, Live Currency & Audit Logs", status: "active" }
  ]);
  const [metrics, setMetrics] = useState<DiagnosticMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync auth state with window events
  useEffect(() => {
    const handleAuthChange = () => {
      setUser(getAuthUser());
    };

    const handleUnauthorized = () => {
      setUser(null);
    };

    window.addEventListener("aziz-auth-changed", handleAuthChange);
    window.addEventListener("aziz-api-unauthorized", handleUnauthorized);

    return () => {
      window.removeEventListener("aziz-auth-changed", handleAuthChange);
      window.removeEventListener("aziz-api-unauthorized", handleUnauthorized);
    };
  }, []);

  // Validate active session with /api/auth/me on boot via HttpOnly cookie
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await apiFetch("/api/auth/me");
        if (res.ok) {
          const profile = await res.json();
          setUser(profile);
          setAuthSession(profile);
        } else {
          clearAuthSession();
          setUser(null);
        }
      } catch {
        // Network or offline glitch; keep cached profile
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const fetchOSState = async () => {
    if (!user) return;
    try {
      const response = await apiFetch("/api/diagnostics");
      if (response.ok) {
        const data = await response.json();
        if (data.modules && data.modules.length > 0) {
          // Keep our local 'users' module included if admin
          const hasUsers = data.modules.some((m: SystemModule) => m.id === "users");
          if (!hasUsers) {
            data.modules.push({
              id: "users",
              name: "User Management",
              description: "Role-Based Access Control, Invites & Directory",
              status: "active"
            });
          }
          setModules(data.modules);
        }
        setMetrics(data.metrics || null);
      }
    } catch {
      console.log("Kernel diagnostics sync pending...");
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchOSState();
    const interval = setInterval(fetchOSState, 5000);
    return () => clearInterval(interval);
  }, [user]);

  // If user is recruiter and on an admin-only module, route to studio
  useEffect(() => {
    if (user && user.role === "recruiter") {
      const adminOnlyModules: ModuleId[] = ["terminal", "agents", "integrations", "users", "pricing"];
      if (adminOnlyModules.includes(activeModule)) {
        setActiveModule("studio");
      }
    }
  }, [user, activeModule]);

  const renderActiveViewport = () => {
    switch (activeModule) {
      case "studio":
        return <Studio id="studio-viewport" />;
      case "jsi":
        return <JobSearch key="jsi" initialTab="jsi" />;
      case "freelance":
        return <FreelancerDashboard />;
      case "companies":
        return <CompanyProfilesManager />;
      case "ats":
        return <Ats />;
      case "agents":
        return <AgentDashboard />;
      case "memory":
        return <MemoryManager id="memory-viewport" />;
      case "diagnostics":
        return <Diagnostics id="diagnostics-viewport" />;
      case "terminal":
        return <Terminal id="terminal-viewport" />;
      case "integrations":
        return <Integrations />;
      case "users":
        return <UserManager />;
      case "pricing":
        return <PricingManager />;
      default:
        return (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center font-mono text-sm text-slate-400" id="fallback-viewport">
            Module {activeModule.toUpperCase()} initialization in progress.
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3 text-slate-400 font-mono" id="app-loading-screen">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span>Booting Aziz OS Kernel & RBAC Gateway...</span>
      </div>
    );
  }

  // If unauthenticated, display the full-screen login / bootstrap portal
  if (!user) {
    return (
      <AuthScreen
        onSuccess={() => {
          setUser(getAuthUser());
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex overflow-hidden" id="app-root-shell">
      {/* Dynamic Navigation Sidebar */}
      <Sidebar
        activeModule={activeModule}
        setActiveModule={(id) => {
          setActiveModule(id);
        }}
        modules={modules}
        user={user}
        metrics={metrics}
      />

      {/* Main Viewport Workspace Area */}
      <main className="flex-1 overflow-y-auto h-screen bg-slate-950 p-8" id="viewport-workspace">
        <div className="max-w-6xl mx-auto space-y-6" id="workspace-container">
          {renderActiveViewport()}
        </div>
      </main>
    </div>
  );
}
