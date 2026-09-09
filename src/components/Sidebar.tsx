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
  Building2
} from "lucide-react";
import { ModuleId, SystemModule } from "../types";

interface SidebarProps {
  activeModule: ModuleId;
  setActiveModule: (id: ModuleId) => void;
  modules: SystemModule[];
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
  metrics
}: SidebarProps) {
  
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "studio": return <Cpu className="w-4 h-4" id="icon-studio" />;
      case "jsi": return <Briefcase className="w-4 h-4" id="icon-jsi" />;
      case "freelance": return <Search className="w-4 h-4" id="icon-freelance" />;
      case "companies": return <Building2 className="w-4 h-4 text-blue-400" id="icon-companies" />;
      case "agents": return <Cpu className="w-4 h-4 text-purple-400 animate-pulse" id="icon-agents" />;
      case "memory": return <Brain className="w-4 h-4" id="icon-memory" />;
      case "diagnostics": return <Activity className="w-4 h-4" id="icon-diagnostics" />;
      case "terminal": return <TerminalIcon className="w-4 h-4" id="icon-terminal" />;
      default: return <LayoutGrid className="w-4 h-4" id="icon-default" />;
    }
  };

  return (
    <aside 
      className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between h-screen text-slate-200"
      id="system-sidebar"
    >
      <div>
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-800" id="sidebar-header">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2 rounded-lg" id="brand-logo">
              <Cpu className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="font-sans font-semibold text-white tracking-tight" id="sidebar-title">
                Aziz Assistant
              </h1>
              <span className="text-[10px] text-slate-400 font-mono" id="sidebar-version">
                AI OS Enterprise v1.0
              </span>
            </div>
          </div>
        </div>

        {/* Modules List */}
        <div className="p-4 flex flex-col gap-1" id="sidebar-modules">
          <div className="px-3 py-2 text-[10px] font-mono tracking-wider text-slate-500 uppercase">
            Core Modules
          </div>
          {modules.map((m) => {
            const isActive = activeModule === m.id;
            return (
              <button
                key={m.id}
                id={`sidebar-btn-${m.id}`}
                onClick={() => setActiveModule(m.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                  isActive 
                    ? "bg-slate-800 text-white font-medium shadow-sm border border-slate-700" 
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center gap-3">
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
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 font-mono text-xs text-slate-400" id="sidebar-footer">
        <div className="flex flex-col gap-2">
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
          <div className="mt-2 text-center text-[10px] text-slate-600">
            sahil.k00267@gmail.com
          </div>
        </div>
      </div>
    </aside>
  );
}
