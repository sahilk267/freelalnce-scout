/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Play, 
  Pause, 
  Trash2, 
  Plus, 
  Terminal, 
  RefreshCw, 
  Layers, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  Shield, 
  Database, 
  Globe, 
  Mail, 
  Calendar, 
  GitBranch, 
  Eye, 
  List, 
  Cpu, 
  ChevronRight, 
  Activity, 
  Server,
  Sparkles,
  Inbox
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Agent {
  id: string;
  name: string;
  status: string;
  progress: number;
  assignedTasks: string[];
  capabilities: string[];
}

interface Task {
  id: string;
  agentId: string;
  priority: number;
  createdTime: string;
  startedTime?: string;
  finishedTime?: string;
  retries: number;
  maxRetries: number;
  currentStep: string;
  progress: number;
  status: string;
  logs: string[];
  metadata: Record<string, any>;
}

interface QueueState {
  isPaused: boolean;
  tasksCount: number;
  queuedCount: number;
  activeCount: number;
  completedCount: number;
  failedCount: number;
}

interface AgentMetrics {
  runningAgents: number;
  queuedAgents: number;
  completedTasks: number;
  failedTasks: number;
  averageRuntimeSeconds: number;
  totalRetriesCount: number;
  cpuUsagePercentage: number;
  memoryUsageMB: number;
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export default function AgentDashboard() {
  const [activeTab, setActiveTab] = useState<"agents" | "queue" | "workflows" | "tools" | "telemetry">("agents");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [metrics, setMetrics] = useState<AgentMetrics | null>(null);
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [logStream, setLogStream] = useState<any[]>([]);

  // Filtering / Search
  const [taskFilter, setTaskFilter] = useState<string>("All");
  const [selectedAgentLogs, setSelectedAgentLogs] = useState<string>("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Modals & Form states
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [newAgentId, setNewAgentId] = useState("");
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentCaps, setNewAgentCaps] = useState("");

  const [showDispatchModal, setShowDispatchModal] = useState<Agent | null>(null);
  const [dispatchPriority, setDispatchPriority] = useState<number>(5);
  const [dispatchPrompt, setDispatchPrompt] = useState("");
  const [dispatchTargetUrl, setDispatchTargetUrl] = useState("");

  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const triggerNotification = (text: string, type: "success" | "error" = "success") => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // 1. DATA POLLING ENGINE
  const fetchData = async () => {
    try {
      const [agentsRes, tasksRes, queueRes, metricsRes, toolsRes, logsRes] = await Promise.all([
        fetch("/api/agents"),
        fetch("/api/tasks"),
        fetch("/api/queue"),
        fetch("/api/agent-metrics"),
        fetch("/api/tools"),
        fetch("/api/logs")
      ]);

      const parseJsonSafe = async (res: Response) => {
        if (!res.ok) return null;
        const contentType = res.headers.get("content-type");
        if (contentType && !contentType.includes("application/json")) return null;
        try {
          return await res.json();
        } catch {
          return null;
        }
      };

      const agentsData = await parseJsonSafe(agentsRes);
      if (agentsData) setAgents(agentsData);

      const tasksData = await parseJsonSafe(tasksRes);
      if (tasksData && Array.isArray(tasksData)) {
        setTasks(tasksData);
        if (selectedTask) {
          const updated = tasksData.find((t) => t.id === selectedTask.id);
          if (updated) setSelectedTask(updated);
        }
      }

      const queueData = await parseJsonSafe(queueRes);
      if (queueData) setQueueState(queueData);

      const metricsData = await parseJsonSafe(metricsRes);
      if (metricsData) setMetrics(metricsData);

      const toolsData = await parseJsonSafe(toolsRes);
      if (toolsData) setTools(toolsData);

      const logsData = await parseJsonSafe(logsRes);
      if (logsData && Array.isArray(logsData)) {
        setLogStream(logsData.filter((l: any) => l.module === "agents"));
      }
    } catch (err) {
      console.warn("[AgentDashboard] Poll retry pending...", err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [selectedTask]);

  // 2. USER INTERACTIONS
  const handleRegisterAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentId || !newAgentName) {
      triggerNotification("Agent ID and Name are mandatory.", "error");
      return;
    }

    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newAgentId,
          name: newAgentName,
          capabilities: newAgentCaps.split(",").map((c) => c.trim()).filter(Boolean)
        })
      });

      if (res.ok) {
        triggerNotification(`Agent '${newAgentName}' registered into operational matrix.`);
        setShowRegisterModal(false);
        setNewAgentId("");
        setNewAgentName("");
        setNewAgentCaps("");
        fetchData();
      } else {
        const err = await res.json();
        triggerNotification(err.error || "Failed to register agent.", "error");
      }
    } catch (e: any) {
      triggerNotification(e.message, "error");
    }
  };

  const handleUnregisterAgent = async (id: string) => {
    if (!confirm("Are you sure you want to unregister this agent? Any current tasks will remain orphaned.")) return;
    try {
      const res = await fetch(`/api/agents/${id}`, { method: "DELETE" });
      if (res.ok) {
        triggerNotification(`Agent ${id} has been gracefully decommissioned.`);
        fetchData();
      }
    } catch (e: any) {
      triggerNotification(e.message, "error");
    }
  };

  const handlePauseQueue = async () => {
    try {
      const res = await fetch("/api/queue/pause", { method: "POST" });
      if (res.ok) {
        triggerNotification("Central Task Scheduler paused globally.", "error");
        fetchData();
      }
    } catch (e: any) {
      triggerNotification(e.message, "error");
    }
  };

  const handleResumeQueue = async () => {
    try {
      const res = await fetch("/api/queue/resume", { method: "POST" });
      if (res.ok) {
        triggerNotification("Central Task Scheduler active.");
        fetchData();
      }
    } catch (e: any) {
      triggerNotification(e.message, "error");
    }
  };

  const handleDispatchTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showDispatchModal) return;

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: showDispatchModal.id,
          priority: Number(dispatchPriority),
          currentStep: "Initializing parameters...",
          metadata: {
            taskPrompt: dispatchPrompt,
            targetUrl: dispatchTargetUrl || undefined,
            userInitiated: true
          }
        })
      });

      if (res.ok) {
        const created: Task = await res.json();
        triggerNotification(`Autonomous cognitive workflow task queued under ID: ${created.id}`);
        setShowDispatchModal(null);
        setDispatchPrompt("");
        setDispatchTargetUrl("");
        setDispatchPriority(5);
        fetchData();
      }
    } catch (e: any) {
      triggerNotification(e.message, "error");
    }
  };

  const handleCancelTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/cancel`, { method: "POST" });
      if (res.ok) {
        triggerNotification(`Task '${taskId}' cancelled successfully.`, "error");
        fetchData();
      }
    } catch (e: any) {
      triggerNotification(e.message, "error");
    }
  };

  const handleRetryFailedTasks = async () => {
    try {
      const res = await fetch("/api/tasks/retry-failed", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        triggerNotification(`Re-queued ${data.retriedCount} failed task(s) for execution.`);
        fetchData();
      }
    } catch (e: any) {
      triggerNotification(e.message, "error");
    }
  };

  const handleClearFailedTasks = async () => {
    try {
      const res = await fetch("/api/queue/clear-failed", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        triggerNotification(`Cleared ${data.clearedCount} failed task(s) from queue.`);
        fetchData();
      }
    } catch (e: any) {
      triggerNotification(e.message, "error");
    }
  };

  const handlePauseTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/pause`, { method: "POST" });
      if (res.ok) {
        triggerNotification(`Execution on task '${taskId}' paused.`);
        fetchData();
      }
    } catch (e: any) {
      triggerNotification(e.message, "error");
    }
  };

  const handleResumeTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/resume`, { method: "POST" });
      if (res.ok) {
        triggerNotification(`Execution on task '${taskId}' resumed.`);
        fetchData();
      }
    } catch (e: any) {
      triggerNotification(e.message, "error");
    }
  };

  // Launch a complex pre-defined Multi-Agent Workflow
  const handleTriggerOutboundWorkflow = async () => {
    try {
      triggerNotification("Assembling and starting dynamic Recruiter Outbound Multi-Agent Workflow...");
      
      // Step A: Queue Crawler task to collect listings
      const crawlRes = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: `task-wf__recruiter__crawl-${Date.now()}`,
          agentId: "agent-crawler",
          priority: 8,
          currentStep: "Scraping web job boards...",
          metadata: { targetUrl: "https://remoteok.com/api", workflow: "OutboundRecruiting" }
        })
      });

      if (crawlRes.ok) {
        // Step B: Queue Recruiter ATS to qualify profiles
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: `task-wf__recruiter__match-${Date.now()}`,
            agentId: "agent-matcher",
            priority: 6,
            currentStep: "Analyzing resume qualifications...",
            metadata: { scoreThreshold: 85, workflow: "OutboundRecruiting" }
          })
        });

        // Step C: Queue Notifier to alert candidates
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: `task-wf__recruiter__notify-${Date.now()}`,
            agentId: "agent-smtp",
            priority: 4,
            currentStep: "Dispatching transactional invites...",
            metadata: { channel: "SMTP", workflow: "OutboundRecruiting" }
          })
        });

        triggerNotification("Multi-Agent recruitment sequence registered and dispatched to task queue!");
        setActiveTab("queue");
        fetchData();
      }
    } catch (e: any) {
      triggerNotification(e.message, "error");
    }
  };

  // Filtered lists
  const filteredTasks = tasks.filter((t) => {
    if (taskFilter === "All") return true;
    return t.status === taskFilter;
  });

  return (
    <div className="space-y-6" id="agent-workspace-dashboard">
      {/* Dynamic Pop notification toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl border shadow-lg flex items-center gap-3 font-sans text-sm ${
              notification.type === "success"
                ? "bg-emerald-950/90 border-emerald-500/50 text-emerald-300"
                : "bg-rose-950/90 border-rose-500/50 text-rose-300"
            }`}
          >
            {notification.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
            <span>{notification.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/40 p-6 rounded-2xl border border-slate-800" id="agent-dashboard-header">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="w-5 h-5 text-purple-400 animate-pulse" />
            <span className="text-xs text-purple-400 font-mono tracking-wider font-semibold uppercase">Autonomous Core Framework</span>
          </div>
          <h1 className="text-2xl font-sans font-bold text-white tracking-tight">Aziz OS Agent Portal</h1>
          <p className="text-sm text-slate-400">Orchestrate multi-agent cognitive tasks, manage priority-based queues, audit tools, and launch workflows.</p>
        </div>

        <div className="flex items-center gap-3">
          {queueState?.isPaused ? (
            <button
              onClick={handleResumeQueue}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer shadow-sm shadow-emerald-900/50"
              id="btn-resume-queue"
            >
              <Play className="w-4 h-4" />
              <span>Resume Scheduler</span>
            </button>
          ) : (
            <button
              onClick={handlePauseQueue}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 rounded-xl text-sm font-medium transition-colors border border-slate-700 flex items-center gap-2 cursor-pointer"
              id="btn-pause-queue"
            >
              <Pause className="w-4 h-4 text-amber-400" />
              <span>Pause Scheduler</span>
            </button>
          )}

          <button
            onClick={() => setShowRegisterModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer shadow-sm shadow-blue-900/50"
            id="btn-register-agent"
          >
            <Plus className="w-4 h-4" />
            <span>Register Agent</span>
          </button>
        </div>
      </div>

      {/* TOP SYSTEM TELEMETRY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="agent-metrics-grid">
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 relative overflow-hidden flex flex-col justify-between h-28">
          <div className="flex justify-between items-start">
            <span className="text-xs text-slate-400 font-medium">Running / Total Agents</span>
            <div className="p-1.5 bg-purple-500/10 rounded-lg text-purple-400"><Cpu className="w-4 h-4" /></div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white font-mono">{metrics?.runningAgents || 0} / {agents.length}</div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">ACTIVE COGNITIVE ENTITIES</div>
          </div>
        </div>

        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 relative overflow-hidden flex flex-col justify-between h-28">
          <div className="flex justify-between items-start">
            <span className="text-xs text-slate-400 font-medium">Tasks Queued / Total</span>
            <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-400"><List className="w-4 h-4" /></div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white font-mono">{metrics?.queuedAgents || 0} / {tasks.length}</div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">CURRENT CONCURRENCY LOAD</div>
          </div>
        </div>

        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 relative overflow-hidden flex flex-col justify-between h-28">
          <div className="flex justify-between items-start">
            <span className="text-xs text-slate-400 font-medium">Completed / Failed Tasks</span>
            <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400"><CheckCircle2 className="w-4 h-4" /></div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white font-mono flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className="text-emerald-400">{metrics?.completedTasks || 0}</span>
                <span className="text-slate-500">/</span>
                <span className="text-rose-400">{metrics?.failedTasks || 0}</span>
              </div>
              {(metrics?.failedTasks || 0) > 0 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleRetryFailedTasks}
                    className="text-[10px] bg-blue-600/30 hover:bg-blue-600/60 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                    title="Re-queue failed tasks for execution retry"
                  >
                    Retry
                  </button>
                  <button
                    onClick={handleClearFailedTasks}
                    className="text-[10px] bg-rose-600/30 hover:bg-rose-600/60 text-rose-300 border border-rose-500/30 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                    title="Clear failed tasks from queue"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">AVERAGE RUNTIME: {metrics?.averageRuntimeSeconds || 0}s</div>
          </div>
        </div>

        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 relative overflow-hidden flex flex-col justify-between h-28">
          <div className="flex justify-between items-start">
            <span className="text-xs text-slate-400 font-medium">Resource Load</span>
            <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-400"><Activity className="w-4 h-4" /></div>
          </div>
          <div>
            <div className="text-xl font-bold text-white font-mono flex items-baseline gap-2">
              <span>{metrics?.cpuUsagePercentage || 0}% CPU</span>
              <span className="text-xs text-slate-400">/</span>
              <span className="text-xs text-slate-300">{metrics?.memoryUsageMB || 0}MB</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">HOST CONTAINER overhead</div>
          </div>
        </div>
      </div>

      {/* CORE NAVIGATION TABS */}
      <div className="flex border-b border-slate-800 gap-2" id="agent-dashboard-tabs">
        <button
          onClick={() => setActiveTab("agents")}
          className={`px-4 py-2.5 font-sans text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === "agents" ? "border-purple-500 text-white bg-purple-500/5" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Agent Manager
        </button>
        <button
          onClick={() => setActiveTab("queue")}
          className={`px-4 py-2.5 font-sans text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === "queue" ? "border-purple-500 text-white bg-purple-500/5" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Queue & Scheduler
        </button>
        <button
          onClick={() => setActiveTab("workflows")}
          className={`px-4 py-2.5 font-sans text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === "workflows" ? "border-purple-500 text-white bg-purple-500/5" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Active Workflows
        </button>
        <button
          onClick={() => setActiveTab("tools")}
          className={`px-4 py-2.5 font-sans text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === "tools" ? "border-purple-500 text-white bg-purple-500/5" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Tool Registry (MCP)
        </button>
        <button
          onClick={() => setActiveTab("telemetry")}
          className={`px-4 py-2.5 font-sans text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === "telemetry" ? "border-purple-500 text-white bg-purple-500/5" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Telemetry Logs
        </button>
      </div>

      {/* VIEWPORTS */}
      <div className="min-h-[400px]">
        {/* TAB 1: AGENT MANAGER */}
        {activeTab === "agents" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-sans font-semibold text-white">Registered Autonomous Agents</h2>
              <span className="text-xs text-slate-400 font-mono">{agents.length} agent classes operating</span>
            </div>

            {agents.length === 0 ? (
              <div className="bg-slate-900/20 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
                No agents registered. Use 'Register Agent' to onboard a new intelligence model.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {agents.map((agent) => (
                  <motion.div
                    key={agent.id}
                    layoutId={`agent-card-${agent.id}`}
                    className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-slate-700 transition-all"
                  >
                    <div>
                      {/* Name, Status */}
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div>
                          <h3 className="font-sans font-bold text-white text-base">{agent.name}</h3>
                          <span className="text-[10px] text-slate-500 font-mono block">ID: {agent.id}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                          agent.status === "Running"
                            ? "bg-blue-950/50 text-blue-300 border-blue-500/30"
                            : agent.status === "Planning"
                            ? "bg-purple-950/50 text-purple-300 border-purple-500/30"
                            : agent.status === "Paused"
                            ? "bg-amber-950/50 text-amber-300 border-amber-500/30"
                            : "bg-slate-850 text-slate-400 border-slate-800"
                        }`}>
                          {agent.status}
                        </span>
                      </div>

                      {/* Capabilities */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {agent.capabilities.map((cap) => (
                          <span key={cap} className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-mono border border-slate-750">
                            {cap}
                          </span>
                        ))}
                      </div>

                      {/* Progress slider if running */}
                      {(() => {
                        const progressPct = typeof agent.progress === "object" && agent.progress !== null
                          ? (agent.progress as any).percentage ?? 0
                          : (typeof agent.progress === "number" ? agent.progress : 0);
                        return (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-mono">
                              <span className="text-slate-400">Cognitive Load</span>
                              <span className="text-white font-semibold">{progressPct}%</span>
                            </div>
                            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-500 rounded-full ${
                                  agent.status === "Running" ? "bg-blue-500" : agent.status === "Planning" ? "bg-purple-500" : "bg-slate-600"
                                }`}
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Footer Stats and Action buttons */}
                    <div className="flex justify-between items-center pt-3 border-t border-slate-800/60 mt-2">
                      <span className="text-[10px] text-slate-400 font-mono">Tasks Active: {agent.assignedTasks?.length || 0}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowDispatchModal(agent)}
                          className="px-2.5 py-1.5 bg-blue-600/20 hover:bg-blue-600 hover:text-white text-blue-300 border border-blue-500/20 rounded-lg text-xs font-medium cursor-pointer transition-all"
                        >
                          Dispatch Task
                        </button>
                        <button
                          onClick={() => handleUnregisterAgent(agent.id)}
                          className="p-1.5 bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 border border-slate-700/50 hover:border-rose-500/30 rounded-lg cursor-pointer transition-all"
                          title="Unregister Agent"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: QUEUE & SCHEDULER */}
        {activeTab === "queue" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/20 p-4 rounded-xl border border-slate-800">
              <div className="flex flex-wrap items-center gap-2" id="queue-status-filters">
                <span className="text-xs text-slate-400 font-mono mr-2">FILTER TASKS:</span>
                {["All", "Queued", "Running", "Completed", "Failed", "Paused"].map((status) => (
                  <button
                    key={status}
                    onClick={() => setTaskFilter(status)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono border transition-all cursor-pointer ${
                      taskFilter === status
                        ? "bg-purple-600 text-white border-purple-500 font-semibold"
                        : "bg-slate-850 hover:bg-slate-800 text-slate-400 border-slate-800"
                    }`}
                  >
                    {status.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="text-xs text-slate-400 font-mono">
                Active Concurrency Throttle: <span className="text-white">5 items</span>
              </div>
            </div>

            {/* Tasks list */}
            {filteredTasks.length === 0 ? (
              <div className="bg-slate-900/20 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
                No tasks match the status '{taskFilter}'.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Tasks List Panel */}
                <div className="lg:col-span-2 space-y-3">
                  {filteredTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 cursor-pointer ${
                        selectedTask?.id === task.id
                          ? "bg-slate-850 border-purple-500/50 shadow-sm shadow-purple-950/25"
                          : "bg-slate-900/40 border-slate-800 hover:border-slate-750"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            task.status === "Completed"
                              ? "bg-emerald-500"
                              : task.status === "Failed"
                              ? "bg-rose-500"
                              : task.status === "Running"
                              ? "bg-blue-500 animate-pulse"
                              : "bg-amber-500"
                          }`} />
                          <h4 className="font-mono text-xs text-white font-bold">{task.id}</h4>
                        </div>
                        <p className="text-sm text-slate-300 font-sans">
                          {typeof task.currentStep === "object" && task.currentStep !== null
                            ? (task.currentStep as any).currentStep || JSON.stringify(task.currentStep)
                            : String(task.currentStep || "Enqueued task.")}
                        </p>
                        <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
                          <span>AGENT: {task.agentId}</span>
                          <span>PRIORITY: {task.priority}</span>
                          <span>RETRIES: {task.retries}/{task.maxRetries}</span>
                        </div>
                      </div>

                      {/* Task execution progress & actions */}
                      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                        {(() => {
                          const taskProgressPct = typeof task.progress === "object" && task.progress !== null
                            ? (task.progress as any).percentage ?? 0
                            : (typeof task.progress === "number" ? task.progress : 0);
                          return (
                            <div className="text-right sm:block hidden w-20">
                              <div className="text-xs font-mono font-semibold text-slate-300">{taskProgressPct}%</div>
                              <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden mt-1">
                                <div className="bg-blue-500 h-full" style={{ width: `${taskProgressPct}%` }} />
                              </div>
                            </div>
                          );
                        })()}

                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {task.status === "Queued" && (
                            <button
                              onClick={() => handleCancelTask(task.id)}
                              className="px-2 py-1 bg-rose-950/50 hover:bg-rose-950 hover:text-rose-400 text-rose-300 border border-rose-500/20 rounded-lg text-xs font-mono transition-colors cursor-pointer"
                            >
                              CANCEL
                            </button>
                          )}
                          {task.status === "Running" && (
                            <button
                              onClick={() => handlePauseTask(task.id)}
                              className="px-2 py-1 bg-amber-950/50 hover:bg-amber-950 hover:text-amber-400 text-amber-300 border border-amber-500/20 rounded-lg text-xs font-mono transition-colors cursor-pointer"
                            >
                              PAUSE
                            </button>
                          )}
                          {task.status === "Paused" && (
                            <button
                              onClick={() => handleResumeTask(task.id)}
                              className="px-2 py-1 bg-emerald-950/50 hover:bg-emerald-950 hover:text-emerald-400 text-emerald-300 border border-emerald-500/20 rounded-lg text-xs font-mono transition-colors cursor-pointer"
                            >
                              RESUME
                            </button>
                          )}
                          <ChevronRight className="w-4 h-4 text-slate-500" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Task Details Side Panel */}
                <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 h-[480px] overflow-y-auto space-y-4">
                  {selectedTask ? (
                    <>
                      <div className="border-b border-slate-800 pb-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-slate-400 font-mono uppercase font-semibold">Cognitive Task Details</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                            selectedTask.status === "Completed" ? "bg-emerald-950 text-emerald-300" : "bg-blue-950 text-blue-300"
                          }`}>{selectedTask.status}</span>
                        </div>
                        <h3 className="font-mono text-sm text-white font-bold mt-2">{selectedTask.id}</h3>
                      </div>

                      <div className="space-y-3 font-mono text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Target Agent:</span>
                          <span className="text-white">{selectedTask.agentId}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Created Time:</span>
                          <span className="text-white text-[10px]">{new Date(selectedTask.createdTime).toLocaleTimeString()}</span>
                        </div>
                        {selectedTask.startedTime && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Started At:</span>
                            <span className="text-white text-[10px]">{new Date(selectedTask.startedTime).toLocaleTimeString()}</span>
                          </div>
                        )}
                        {selectedTask.finishedTime && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Completed At:</span>
                            <span className="text-white text-[10px]">{new Date(selectedTask.finishedTime).toLocaleTimeString()}</span>
                          </div>
                        )}
                      </div>

                      {/* Task prompt metadata description */}
                      {selectedTask.metadata?.taskPrompt && (
                        <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-xs">
                          <span className="text-[10px] text-slate-500 block mb-1 font-mono uppercase font-semibold">Prompt Description</span>
                          <p className="text-slate-300 leading-relaxed font-sans">{selectedTask.metadata.taskPrompt}</p>
                        </div>
                      )}

                      {/* Log stream */}
                      <div className="space-y-2">
                        <span className="text-[10px] text-slate-400 font-mono uppercase font-semibold block">Execution Logs ({selectedTask.logs?.length || 0})</span>
                        <div className="bg-slate-950/80 rounded-lg p-3 border border-slate-800 h-44 overflow-y-auto font-mono text-[10px] text-slate-400 space-y-1.5 leading-relaxed">
                          {selectedTask.logs && selectedTask.logs.length > 0 ? (
                            selectedTask.logs.map((log, i) => (
                              <div key={i} className="border-b border-slate-900/60 pb-1 last:border-0">{log}</div>
                            ))
                          ) : (
                            <span className="text-slate-650 italic">No logs compiled yet.</span>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-600 font-mono text-xs">
                      <Inbox className="w-8 h-8 text-slate-800 mb-2" />
                      <span>SELECT A TASK TO VIEW COMPREHENSIVE WORKFLOW METRICS & LOGS</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ACTIVE WORKFLOWS */}
        {activeTab === "workflows" && (
          <div className="space-y-6">
            <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Layers className="w-5 h-5 text-purple-400" />
                  <span className="text-xs text-purple-400 font-mono uppercase font-semibold">Structured Graph Choreography</span>
                </div>
                <h2 className="text-xl font-sans font-bold text-white">Topological Workflow Engine</h2>
                <p className="text-sm text-slate-400 mt-1">Deploy automated multi-agent sequences executing sequential, parallel, or conditional logic paths dynamically.</p>
              </div>

              <button
                onClick={handleTriggerOutboundWorkflow}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer shadow-md shadow-purple-900/50"
                id="btn-trigger-workflow"
              >
                <Sparkles className="w-4 h-4 text-purple-200 animate-pulse" />
                <span>Deploy Outbound Recruitment Workflow</span>
              </button>
            </div>

            {/* Flowchart Diagram */}
            <div className="bg-slate-950 border border-slate-850 p-6 rounded-2xl">
              <h3 className="text-xs text-slate-400 font-mono uppercase tracking-wider mb-6">Workflow visual graph: Outbound Recruitment Sequence</h3>
              
              <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12 relative">
                {/* Step 1: Web Scraper */}
                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl w-60 relative z-10 flex flex-col justify-between h-36 hover:border-slate-750 transition-all">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] text-blue-400 font-mono font-semibold uppercase">Step 1 (Sequential)</span>
                    <Globe className="w-4 h-4 text-blue-400" />
                  </div>
                  <h4 className="text-sm font-sans font-bold text-white mt-2">Web Intelligence Scraper</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">Scrapes top technology boards for newly posted listings.</p>
                  <div className="text-[10px] text-slate-500 font-mono mt-2 flex justify-between items-center">
                    <span>Target: agent-crawler</span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">✔ ACTIVE</span>
                  </div>
                </div>

                <div className="text-slate-700 md:rotate-0 rotate-90 flex items-center justify-center">
                  <ChevronRight className="w-6 h-6 animate-pulse text-purple-500" />
                </div>

                {/* Step 2: ATS Optimizer */}
                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl w-60 relative z-10 flex flex-col justify-between h-36 hover:border-slate-750 transition-all">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] text-purple-400 font-mono font-semibold uppercase">Step 2 (Topological)</span>
                    <Database className="w-4 h-4 text-purple-400" />
                  </div>
                  <h4 className="text-sm font-sans font-bold text-white mt-2">ATS Profile Matching</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">Extracts applicant CVs, scores qualifications, filters scores.</p>
                  <div className="text-[10px] text-slate-500 font-mono mt-2 flex justify-between items-center">
                    <span>Target: agent-matcher</span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">✔ ACTIVE</span>
                  </div>
                </div>

                <div className="text-slate-700 md:rotate-0 rotate-90 flex items-center justify-center">
                  <ChevronRight className="w-6 h-6 animate-pulse text-purple-500" />
                </div>

                {/* Step 3: Outbound Notifier */}
                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl w-60 relative z-10 flex flex-col justify-between h-36 hover:border-slate-750 transition-all">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] text-emerald-400 font-mono font-semibold uppercase">Step 3 (Alerting)</span>
                    <Mail className="w-4 h-4 text-emerald-400" />
                  </div>
                  <h4 className="text-sm font-sans font-bold text-white mt-2">Notification Engine</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">Transmits calendar invitations and proposal pitches.</p>
                  <div className="text-[10px] text-slate-500 font-mono mt-2 flex justify-between items-center">
                    <span>Target: agent-smtp</span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">✔ ACTIVE</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: TOOL REGISTRY */}
        {activeTab === "tools" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-sans font-semibold text-white">Registered Model Context Protocol (MCP) Sandbox Tools</h2>
              <span className="text-xs text-slate-400 font-mono">{tools.length} system API integrations available</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="tools-grid-explorer">
              {tools.map((tool) => {
                const getToolIcon = (tName: string) => {
                  switch (tName) {
                    case "filesystem": return <Terminal className="text-blue-400" />;
                    case "browser": return <Globe className="text-teal-400" />;
                    case "terminal": return <Terminal className="text-red-400" />;
                    case "memory_tool": return <Shield className="text-purple-400" />;
                    case "email": return <Mail className="text-indigo-400" />;
                    case "calendar": return <Calendar className="text-pink-400" />;
                    case "http": return <Globe className="text-amber-400" />;
                    case "git": return <GitBranch className="text-emerald-400" />;
                    case "database": return <Database className="text-sky-400" />;
                    default: return <Server className="text-slate-400" />;
                  }
                };

                return (
                  <div key={tool.name} className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 hover:border-slate-750 transition-all flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-800 rounded-lg">
                          {getToolIcon(tool.name)}
                        </div>
                        <h3 className="font-mono text-sm text-white font-bold">{tool.name}</h3>
                      </div>
                      <p className="text-xs text-slate-400 mt-3 leading-relaxed">{tool.description}</p>
                    </div>

                    <div className="pt-3 border-t border-slate-800/60 flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 font-mono">Parameters: {Object.keys(tool.parameters || {}).length} variables</span>
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700 font-mono uppercase">Vetted</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 5: TELEMETRY LOGS */}
        {activeTab === "telemetry" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-slate-900/20 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono">FILTER BY AGENT ID:</span>
                <select
                  value={selectedAgentLogs}
                  onChange={(e) => setSelectedAgentLogs(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-xs text-slate-300 rounded-lg px-3 py-1 font-mono focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="">All Autonomous Threads</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>{a.id}</option>
                  ))}
                </select>
              </div>

              <span className="text-xs text-slate-500 font-mono">Real-time kernel polling enabled</span>
            </div>

            <div className="bg-slate-950 rounded-2xl border border-slate-850 p-4 font-mono text-xs text-slate-400 h-96 overflow-y-auto space-y-2 leading-relaxed">
              {logStream
                .filter((l) => !selectedAgentLogs || l.message.includes(`[${selectedAgentLogs}]`))
                .map((log) => (
                  <div key={log.id} className="flex gap-4 border-b border-slate-900/60 pb-1.5 last:border-0 hover:bg-slate-900/10 px-2 rounded">
                    <span className="text-slate-600 text-[10px] shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className={`shrink-0 text-[10px] font-semibold px-1.5 rounded-sm uppercase ${
                      log.level === "success" ? "text-emerald-400 bg-emerald-950/40" : log.level === "error" ? "text-rose-400 bg-rose-950/40" : "text-blue-400"
                    }`}>{log.level}</span>
                    <span className="text-slate-300">{log.message}</span>
                  </div>
                ))}

              {logStream.length === 0 && (
                <div className="h-full flex items-center justify-center text-slate-600 italic">
                  No operational telemetry compiled in the current session.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: REGISTER NEW AGENT */}
      <AnimatePresence>
        {showRegisterModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative"
            >
              <h2 className="text-xl font-sans font-bold text-white mb-4 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-purple-400" />
                <span>Onboard Autonomous Intelligence</span>
              </h2>

              <form onSubmit={handleRegisterAgent} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase font-semibold mb-1">Unique Agent Identifier ID</label>
                  <input
                    type="text"
                    value={newAgentId}
                    onChange={(e) => setNewAgentId(e.target.value)}
                    placeholder="e.g. agent-scheduler"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase font-semibold mb-1">Agent Visual Display Name</label>
                  <input
                    type="text"
                    value={newAgentName}
                    onChange={(e) => setNewAgentName(e.target.value)}
                    placeholder="e.g. Core Scheduler Intelligence"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase font-semibold mb-1">Capabilities (Comma-separated)</label>
                  <input
                    type="text"
                    value={newAgentCaps}
                    onChange={(e) => setNewAgentCaps(e.target.value)}
                    placeholder="e.g. cron_management, slack_alert, report_generation"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none font-mono text-xs"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800/60">
                  <button
                    type="button"
                    onClick={() => setShowRegisterModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium cursor-pointer"
                  >
                    Register Into Matrix
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: DISPATCH CUSTOM TASK */}
      <AnimatePresence>
        {showDispatchModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative"
            >
              <h2 className="text-xl font-sans font-bold text-white mb-2 flex items-center gap-2">
                <Play className="w-5 h-5 text-blue-400 animate-pulse" />
                <span>Dispatch Cognitive Task</span>
              </h2>
              <p className="text-xs text-slate-400 mb-4 font-mono">TARGET MODEL: {showDispatchModal.id}</p>

              <form onSubmit={handleDispatchTask} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase font-semibold mb-1">Queue Dispatch Priority</label>
                  <select
                    value={dispatchPriority}
                    onChange={(e) => setDispatchPriority(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-4 py-2.5 text-sm text-white font-mono cursor-pointer focus:outline-none"
                  >
                    <option value={10}>10 (CRITICAL EMERGENCY / HIGH PRIORITY)</option>
                    <option value={7}>7 (ELEVATED / INTERACTIVE LOAD)</option>
                    <option value={5}>5 (STANDARD / DEFAULT BACKGROUND)</option>
                    <option value={2}>2 (DEFERRED / LOW PRIORITY)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase font-semibold mb-1">Prompt / Tactical Task Instructions</label>
                  <textarea
                    value={dispatchPrompt}
                    onChange={(e) => setDispatchPrompt(e.target.value)}
                    placeholder="Enter precise operational directives or goals for the autonomous agent..."
                    rows={4}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none font-sans"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 uppercase font-semibold mb-1">Target Action Resource URL (Optional)</label>
                  <input
                    type="text"
                    value={dispatchTargetUrl}
                    onChange={(e) => setDispatchTargetUrl(e.target.value)}
                    placeholder="e.g. https://himalayas.app/jobs/api/search?q=react"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none font-mono text-xs"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800/60">
                  <button
                    type="button"
                    onClick={() => setShowDispatchModal(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium cursor-pointer shadow-md shadow-blue-900/50"
                  >
                    Queue Task
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
