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
import { ModuleId, SystemModule, DiagnosticMetrics } from "./types";

export default function App() {
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
    { id: "integrations", name: "Unified Integrations", description: "Configure SMTP, Gmail, Hostinger & Telegram", status: "active" }
  ]);
  const [metrics, setMetrics] = useState<DiagnosticMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOSState = async () => {
    try {
      const response = await fetch("/api/diagnostics");
      if (response.ok) {
        const data = await response.json();
        if (data.modules && data.modules.length > 0) {
          setModules(data.modules);
        }
        setMetrics(data.metrics || null);
      }
    } catch (err) {
      // Handle gracefully without printing console.error during startup
      console.log("Kernel sync pending, retrying...");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOSState();
    // Poll system metrics every 5 seconds to keep the sidebar footer stats completely dynamic
    const interval = setInterval(fetchOSState, 5000);
    return () => clearInterval(interval);
  }, []);

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
        <span>Booting Aziz OS Kernel...</span>
      </div>
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
