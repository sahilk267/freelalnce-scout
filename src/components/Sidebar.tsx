/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { 
  Terminal as TerminalIcon, 
  Cpu, 
  Briefcase, 
  Search, 
  Brain, 
  Activity, 
  Settings,
  LayoutGrid,
  Building2,
  Users,
  LogOut,
  Shield,
  UserCheck,
  Tag
} from "lucide-react";
import { ModuleId, SystemModule } from "../types";
import { UserPublicProfile } from "../domain/models/User";
import { clearAuthSession } from "../utils/apiAuth";

interface SidebarProps {
  activeModule: ModuleId;
  setActiveModule: (id: ModuleId) => void;
  modules: SystemModule[];
  user: UserPublicProfile | null;
  metrics: {
    cpuUsage: number;
    memoryUsage: number;
    apiStatus: {
      gemini: string;
    };
  } | null;
}

export default function Sidebar({ 
  activeModule, 
  setActiveModule, 
  modules,
  user,
  metrics
}: SidebarProps) {
  
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "studio": return <Cpu className="w-4 h-4" id="icon-studio" />;
      case "jsi": return <Briefcase className="w-4 h-4" id="icon-jsi" />;
      case "freelance": return <Search className="w-4 h-4" id="icon-freelance" />;
      case "companies": return <Building2 className="w-4 h-4 text-blue-400" id="icon-companies" />;
      case "ats": return <Briefcase className="w-4 h-4 text-emerald-400" id="icon-ats" />;
      case "agents": return <Cpu className="w-4 h-4 text-purple-400 animate-pulse" id="icon-agents" />;
      case "memory": return <Brain className="w-4 h-4" id="icon-memory" />;
      case "diagnostics": return <Activity className="w-4 h-4" id="icon-diagnostics" />;
      case "terminal": return <TerminalIcon className="w-4 h-4" id="icon-terminal" />;
      case "integrations": return <Settings className="w-4 h-4" id="icon-integrations" />;
      case "users": return <Users className="w-4 h-4 text-purple-400" id="icon-users" />;
      case "pricing": return <Tag className="w-4 h-4 text-emerald-400" id="icon-pricing" />;
      default: return <LayoutGrid className="w-4 h-4" id="icon-default" />;
    }
  };

  const isAdmin = user?.role === "admin";

  // Filter modules according to user role (recruiter cannot see admin-only modules)
  const visibleModules = modules.filter(m => {
    if (["terminal", "agents", "integrations", "users", "pricing"].includes(m.id)) {
      return isAdmin;
    }
    return true;
  });

  return (
    <aside 
      className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between h-screen text-slate-200"
      id="system-sidebar"
    >
      <div className="flex-1 overflow-y-auto">
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800" id="sidebar-header">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2 rounded-lg" id="brand-logo">
              <Cpu className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="font-sans font-semibold text-white tracking-tight text-sm" id="sidebar-title">
                Aziz Assistant
              </h1>
              <span className="text-[10px] text-slate-400 font-mono" id="sidebar-version">
                AI OS Enterprise v1.0
              </span>
            </div>
          </div>
        </div>

        {/* User Identity Session Card */}
        {user && (
          <div className="p-3.5 mx-3 mt-3 bg-slate-950/80 border border-slate-800/80 rounded-xl flex items-center justify-between gap-2" id="sidebar-user-card">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className={`p-1.5 rounded-lg shrink-0 ${
                user.role === "admin" 
                  ? "bg-purple-950/60 border border-purple-800/60 text-purple-400" 
                  : "bg-blue-950/60 border border-blue-800/60 text-blue-400"
              }`}>
                {user.role === "admin" ? <Shield className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-semibold text-white truncate" title={user.email}>
                  {user.email}
                </div>
                <div className="text-[10px] font-mono capitalize flex items-center gap-1 mt-0.5">
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                    user.role === "admin" 
                      ? "bg-purple-900/40 text-purple-300 border border-purple-700/40" 
                      : "bg-blue-900/40 text-blue-300 border border-blue-700/40"
                  }`}>
                    {user.role}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => clearAuthSession()}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
              id="btn-sidebar-logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modules List */}
        <div className="p-3 flex flex-col gap-1" id="sidebar-modules">
          <div className="px-3 py-2 text-[10px] font-mono tracking-wider text-slate-500 uppercase">
            Workspace Modules
          </div>
          {visibleModules.map((m) => {
            const isActive = activeModule === m.id;
            return (
              <button
                key={m.id}
                id={`sidebar-btn-${m.id}`}
                onClick={() => setActiveModule(m.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all duration-150 ${
                  isActive 
                    ? "bg-slate-800 text-white font-medium shadow-sm border border-slate-700" 
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {getIcon(m.id)}
                  <span>{m.name}</span>
                </div>
                {/* Active indicator dot */}
                <span 
                  className={`w-1.5 h-1.5 rounded-full ${
                    m.status === "active" 
                      ? "bg-emerald-500" 
                      : m.status === "error" 
                      ? "bg-rose-500" 
                      : "bg-slate-500"
                  }`} 
                  title={`Status: ${m.status}`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Diagnostics Widget */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 font-mono text-xs text-slate-400 shrink-0" id="sidebar-footer">
        <div className="flex flex-col gap-1.5 text-[11px]">
          <div className="flex justify-between items-center">
            <span>Core Load:</span>
            <span className="text-white">{metrics ? `${metrics.cpuUsage}%` : "L-0.0%"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Kernel Mem:</span>
            <span className="text-white">{metrics ? `${metrics.memoryUsage}MB` : "L-0.0MB"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Gemini API:</span>
            <span className={metrics?.apiStatus.gemini === "online" ? "text-emerald-400" : "text-amber-400"}>
              {metrics ? metrics.apiStatus.gemini.toUpperCase() : "CHECKING"}
            </span>
          </div>
          <div className="mt-1 text-center text-[10px] text-slate-600">
            sahil.k00267@gmail.com
          </div>
        </div>
      </div>
    </aside>
  );
}
