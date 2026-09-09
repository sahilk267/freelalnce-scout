/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Cpu,
  RefreshCw,
  Search,
  FileText,
  Check,
  X,
  Play,
  Pause,
  Database,
  Sliders,
  AlertCircle,
  Clock,
  TrendingUp,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Terminal,
  Settings,
  ShieldCheck,
  BadgeAlert,
  User,
  Plus,
  Trash2,
  CheckCircle2,
  Bell,
  FileCode,
  BarChart3,
  Building2
} from "lucide-react";
import CompanyProfilesManager from "./CompanyProfilesManager";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { REMOTE_PLATFORMS_40 } from "../domain/providers/RemotePlatformsCatalog";

interface NormalizedProject {
  id: string;
  title: string;
  description: string;
  skills: string[];
  budget: string;
  currency: string;
  hourlyOrFixed: string;
  clientRating: number | null;
  clientReviews: number | null;
  clientSpending: string | null;
  proposalCount: number;
  projectUrl: string;
  urgency: string;
  source: string;
  score?: number;
  scoreReasons?: string[];
  createdAt?: string;
  matchedCompanies?: Array<{
    id: string;
    name: string;
    score: number;
    reasons: string[];
  }>;
}

interface Proposal {
  id: string;
  projectId: string;
  title: string;
  proposalText: string;
  tone: "professional" | "friendly" | "premium" | "concise";
  status: "Pending Approval" | "Approved" | "Submitted" | "Rejected";
  createdAt: string;
  submittedAt: string | null;
}

interface Candidate {
  id: string;
  name: string;
  skills: string[];
  experienceYears: number;
  locationPreference: string;
}

interface FreelancerNotification {
  id: string;
  type: "MATCH" | "APPROVAL_REQUIRED" | "SUBMISSION" | "SYSTEM" | "ERROR";
  message: string;
  projectId?: string | null;
  proposalId?: string | null;
  read: boolean;
  createdAt: string;
}

interface DashboardStats {
  projectsFoundTodayCount: number;
  projectsAwaitingApprovalCount: number;
  generatedProposalsCount: number;
  dbSizeKb: number;
  activeJobs: number;
  upcomingSchedule: string | null;
  schedulerEnabled: boolean;
  errorRate: number;
  providerHealth: Record<string, string>;
  successMetrics: {
    totalSubmitted: number;
    totalApproved: number;
    totalRejected: number;
  };
}

interface AgentConfig {
  mode: "development" | "production";
  schedulerEnabled: boolean;
  schedulerInterval: number;
  timeoutMs: number;
  retryCount: number;
  aiModel: string;
  cronExpression?: string;
  featureFlags: {
    autoSubmit: boolean;
    highValueNotifications: boolean;
  };
  isEnabled?: boolean;
  intervalMinutes?: boolean;
}

interface LogRecord {
  id: string;
  timestamp: string;
  level: "info" | "success" | "warn" | "error";
  message: string;
}

interface AnalyticsData {
  matchDistributionData: { name: string; count: number }[];
  platformDistributionData: { name: string; value: number }[];
  statusBreakdownData: { name: string; value: number }[];
  budgetStats: {
    avgFixedBudget: number;
    avgHourlyBudget: number;
    totalFixedCount: number;
    totalHourlyCount: number;
  };
  runsHistory: any[];
}

export default function FreelancerDashboard() {
  // UI Tabs
  const [activeTab, setActiveTab] = useState<"dashboard" | "companies" | "projects" | "platforms" | "proposals" | "candidates" | "notifications" | "analytics" | "config" | "logs">("dashboard");
  
  // Loaded Data States
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [projects, setProjects] = useState<NormalizedProject[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  
  // New Durable States
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [notifications, setNotifications] = useState<FreelancerNotification[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  // Resume Parsing & Profile Edit States
  const [resumeText, setResumeText] = useState("");
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Partial<Candidate> | null>(null);
  const [isSavingCandidate, setIsSavingCandidate] = useState(false);

  // UI Interaction States
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [selectedProject, setSelectedProject] = useState<NormalizedProject | null>(null);
  const [generatingProposalId, setGeneratingProposalId] = useState<string | null>(null);
  const [submittingProposalId, setSubmittingProposalId] = useState<string | null>(null);
  const [updatingConfig, setUpdatingConfig] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const logsEndRef = useRef<HTMLDivElement | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchDashboardData = async () => {
    try {
      setIsRefreshing(true);
      const [resStats, resProjects, resProposals, resLogs, resConfig, resCandidates, resNotifications, resAnalytics] = await Promise.all([
        fetch("/api/freelance/dashboard"),
        fetch("/api/freelance/projects"),
        fetch("/api/freelance/proposals"),
        fetch("/api/freelance/logs"),
        fetch("/api/freelance/config"),
        fetch("/api/freelance/candidates"),
        fetch("/api/freelance/notifications"),
        fetch("/api/freelance/analytics")
      ]);

      if (resStats.ok) setStats(await resStats.json());
      if (resProjects.ok) {
        const projs = await resProjects.json();
        setProjects(projs.sort((a: any, b: any) => (b.score || 0) - (a.score || 0)));
      }
      if (resProposals.ok) setProposals(await resProposals.json());
      if (resLogs.ok) setLogs(await resLogs.json());
      
      if (resConfig.ok) {
        const rawConfig = await resConfig.json();
        setConfig({
          ...rawConfig,
          isEnabled: rawConfig.schedulerEnabled !== false,
          intervalMinutes: rawConfig.schedulerInterval || 15
        });
      }

      if (resCandidates.ok) setCandidates(await resCandidates.json());
      if (resNotifications.ok) setNotifications(await resNotifications.json());
      if (resAnalytics.ok) setAnalytics(await resAnalytics.json());

    } catch (err) {
      console.error("Failed loading freelancer dashboard data:", err);
      showToast("Connection failed to Freelancer API gateway.", "error");
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Poll stats & logs every 4 seconds for dynamic telemetry
    const interval = setInterval(fetchDashboardData, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === "logs" && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, activeTab]);

  const handleTriggerScrape = async () => {
    try {
      const response = await fetch("/api/freelance/search", { method: "POST" });
      if (response.ok) {
        showToast("Crawler dispatched! Multi-source project scanning launched.", "info");
        fetchDashboardData();
      } else {
        showToast("Failed to schedule job crawler task.", "error");
      }
    } catch (e) {
      showToast("Network dispatch error.", "error");
    }
  };

  const handleGenerateProposal = async (projectId: string, tone = "professional") => {
    try {
      setGeneratingProposalId(projectId);
      showToast(`Generating tailored AI proposal (tone: ${tone}). Please wait...`, "info");
      const response = await fetch("/api/freelance/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, tone })
      });

      if (response.ok) {
        showToast("Proposal generation request queued successfully!", "success");
        setSelectedProject(null);
        fetchDashboardData();
      } else {
        showToast("AI generation bottleneck. Please try again.", "error");
      }
    } catch (e) {
      showToast("Network trigger error.", "error");
    } finally {
      setGeneratingProposalId(null);
    }
  };

  const handleApproveProposal = async (proposalId: string) => {
    try {
      const response = await fetch(`/api/freelance/proposals/${proposalId}/approve`, { method: "POST" });
      if (response.ok) {
        showToast("Proposal approved! Ready for platform injection.", "success");
        if (selectedProposal?.id === proposalId) {
          setSelectedProposal(prev => prev ? { ...prev, status: "Approved" } : null);
        }
        fetchDashboardData();
      } else {
        showToast("Failed to approve proposal.", "error");
      }
    } catch (e) {
      showToast("Approve network error.", "error");
    }
  };

  const handleRejectProposal = async (proposalId: string) => {
    try {
      const response = await fetch(`/api/freelance/proposals/${proposalId}/reject`, { method: "POST" });
      if (response.ok) {
        showToast("Proposal marked as rejected.", "info");
        if (selectedProposal?.id === proposalId) {
          setSelectedProposal(prev => prev ? { ...prev, status: "Rejected" } : null);
        }
        fetchDashboardData();
      } else {
        showToast("Failed to reject proposal.", "error");
      }
    } catch (e) {
      showToast("Reject network error.", "error");
    }
  };

  const handleSubmitProposal = async (proposalId: string) => {
    try {
      setSubmittingProposalId(proposalId);
      showToast("Queueing secure platform bid dispatch...", "info");
      const response = await fetch(`/api/freelance/proposals/${proposalId}/submit`, { method: "POST" });
      if (response.ok) {
        showToast("Proposal dispatcher successfully executed!", "success");
        if (selectedProposal?.id === proposalId) {
          setSelectedProposal(prev => prev ? { ...prev, status: "Submitted", submittedAt: new Date().toISOString() } : null);
        }
        fetchDashboardData();
      } else {
        const data = await response.json();
        showToast(data.error || "Failed submitting proposal bid.", "error");
      }
    } catch (e) {
      showToast("Submit network error.", "error");
    } finally {
      setSubmittingProposalId(null);
    }
  };

  const handleSaveConfig = async (updatedFields: Partial<AgentConfig>) => {
    try {
      setUpdatingConfig(true);
      const response = await fetch("/api/freelance/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedFields)
      });

      if (response.ok) {
        showToast("Scheduler configurations updated.", "success");
        fetchDashboardData();
      } else {
        showToast("Failed updating scheduler parameters.", "error");
      }
    } catch (e) {
      showToast("Config update network error.", "error");
    } finally {
      setUpdatingConfig(false);
    }
  };

  const handleClearDatabase = async () => {
    if (!confirm("Are you sure you want to purge all crawled jobs, state histories, and proposals? This is irreversible.")) {
      return;
    }

    try {
      const response = await fetch("/api/freelance/clear", { method: "POST" });
      if (response.ok) {
        showToast("Database successfully purged.", "success");
        setSelectedProposal(null);
        setSelectedProject(null);
        fetchDashboardData();
      } else {
        showToast("Failed to clear local SQLite database schemas.", "error");
      }
    } catch (e) {
      showToast("Clean operation failed.", "error");
    }
  };

  // CANDIDATES CRUD HANDLERS
  const handleSaveCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCandidate?.name) return;

    try {
      setIsSavingCandidate(true);
      const response = await fetch("/api/freelance/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingCandidate)
      });

      if (response.ok) {
        showToast("Candidate profile saved successfully!", "success");
        setEditingCandidate(null);
        fetchDashboardData();
      } else {
        showToast("Failed to save candidate profile.", "error");
      }
    } catch (err) {
      showToast("Candidate save network error.", "error");
    } finally {
      setIsSavingCandidate(false);
    }
  };

  const handleDeleteCandidate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this candidate profile?")) return;

    try {
      const response = await fetch(`/api/freelance/candidates/${id}`, { method: "DELETE" });
      if (response.ok) {
        showToast("Candidate profile deleted.", "info");
        fetchDashboardData();
      } else {
        showToast("Failed to delete candidate.", "error");
      }
    } catch (err) {
      showToast("Candidate delete network error.", "error");
    }
  };

  const handleParseResume = async () => {
    if (!resumeText.trim()) {
      showToast("Please enter or paste resume text first.", "info");
      return;
    }

    try {
      setIsParsingResume(true);
      showToast("Invoking ResumeParserService... Extraction in progress.", "info");
      const response = await fetch("/api/freelance/candidates/parse-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText })
      });

      if (response.ok) {
        showToast("Resume parsed & Profile synchronized successfully!", "success");
        setResumeText("");
        fetchDashboardData();
      } else {
        showToast("Parser service error. Fell back to heuristics.", "error");
      }
    } catch (err) {
      showToast("Parser service connection failed.", "error");
    } finally {
      setIsParsingResume(false);
    }
  };

  const handleLoadSampleCV = () => {
    const sample = `Dr. Robert Chen
Lead AI Architect & Full Stack Engineer with 9 years of experience.
Skills: React, TypeScript, Python, PyTorch, Node.js, Express, SQLite, Docker, Google Cloud.
Looking for high-value Remote contracts to design autonomous agents and scalable LLM layers.`;
    setResumeText(sample);
    showToast("Loaded high-quality sample developer resume.", "info");
  };

  // NOTIFICATION HANDLERS
  const handleMarkAsRead = async (id: string) => {
    try {
      const response = await fetch(`/api/freelance/notifications/${id}/read`, { method: "POST" });
      if (response.ok) {
        fetchDashboardData();
      }
    } catch (e) {
      console.error("Mark read error:", e);
    }
  };

  const handleClearNotifications = async () => {
    try {
      const response = await fetch("/api/freelance/notifications/clear", { method: "POST" });
      if (response.ok) {
        showToast("Notification alerts cleared.", "success");
        fetchDashboardData();
      }
    } catch (e) {
      showToast("Clear alerts failed.", "error");
    }
  };

  // Filtering projects list
  const filteredProjects = projects.filter((proj) => {
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery =
      proj.title.toLowerCase().includes(query) ||
      proj.description.toLowerCase().includes(query) ||
      proj.skills.some((s) => s.toLowerCase().includes(query)) ||
      proj.source.toLowerCase().includes(query);

    const matchesPlatform = sourceFilter === "all" || proj.source.toLowerCase() === sourceFilter.toLowerCase();

    let matchesScore = true;
    if (scoreFilter === "high") matchesScore = (proj.score || 0) >= 80;
    else if (scoreFilter === "medium") matchesScore = (proj.score || 0) >= 50 && (proj.score || 0) < 80;
    else if (scoreFilter === "low") matchesScore = (proj.score || 0) < 50;

    return matchesQuery && matchesPlatform && matchesScore;
  });

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased" id="freelancer-subsystem-root">
      
      {/* Toast alert component */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 p-4 rounded-xl shadow-2xl border flex items-center gap-3 transition-all duration-300 transform scale-100 ${
            toast.type === "error"
              ? "bg-rose-950/90 border-rose-800 text-rose-200"
              : toast.type === "info"
              ? "bg-blue-950/90 border-blue-800 text-blue-200"
              : "bg-emerald-950/90 border-emerald-800 text-emerald-200"
          }`}
          id="toast-notification"
        >
          {toast.type === "error" ? (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : toast.type === "info" ? (
            <Clock className="w-5 h-5 text-blue-400 shrink-0" />
          ) : (
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span className="text-xs font-semibold font-mono tracking-tight">{toast.message}</span>
        </div>
      )}

      {/* Header telemetry ribbon */}
      <header className="bg-slate-900/80 border-b border-slate-800 backdrop-blur-md sticky top-0 z-40 px-6 py-4" id="header-telemetry">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-950 border border-blue-900 rounded-xl text-blue-400 shadow-lg shadow-blue-500/10">
              <Cpu className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white font-sans tracking-tight">Freelancer autonomous agent</h1>
                <span className="bg-amber-950/40 text-amber-400 border border-amber-900/40 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold tracking-wider">
                  PRODUCTION ENGINE v2.0
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-0.5 font-sans">
                Continuous job discovery, client analytics profiling, and human-guided AI proposal bidding.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleTriggerScrape}
              disabled={isRefreshing}
              className="bg-slate-950 hover:bg-slate-850 text-slate-300 border border-slate-800 hover:border-slate-700 text-xs font-semibold px-4.5 py-2.5 rounded-lg flex items-center gap-2 cursor-pointer transition-colors"
              id="btn-scout-now"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-blue-400" : ""}`} />
              Scout & Index Jobs Now
            </button>
            <div className="h-4 w-px bg-slate-800 hidden sm:block" />
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-850 px-3.5 py-2.5 rounded-lg text-xs font-mono">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-slate-400">Daemon:</span>
              <span className="text-white font-semibold">{stats?.schedulerEnabled ? "ENABLED" : "PAUSED"}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">

        {/* Scraper Honest Disclosure Banner */}
        <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-4.5 flex gap-4 items-start" id="scraper-disclosure-banner">
          <div className="p-2 bg-amber-950 border border-amber-900 rounded-lg text-amber-400">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-amber-200">System Integration & Scraper Notice</h4>
            <p className="text-slate-400 text-xs leading-relaxed max-w-4xl">
              Public scrapers for Upwork, Guru, PeoplePerHour, Fiverr Pro, and Freelancer.com operate in <strong>best-effort fallback simulation mode</strong> due to remote anti-bot protection (HTTP 403 blocks) on external endpoints. For live production job discovery, configure enterprise API partner credentials inside your system configuration panel.
            </p>
          </div>
        </div>
        
        {/* Nav Tabs */}
        <div className="flex gap-2 border-b border-slate-800 pb-0.5 overflow-x-auto" id="dashboard-tab-bar">
          {(["dashboard", "companies", "projects", "platforms", "proposals", "candidates", "notifications", "analytics", "config", "logs"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              id={`tab-btn-${tab}`}
              className={`px-4 py-2 text-sm font-semibold border-b-2 capitalize whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? "border-blue-500 text-blue-400 font-semibold"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab === "companies" ? "🏢 Company Profiles & Routing" : tab === "platforms" ? "40 Remote Platforms" : tab === "config" ? "Scheduler Setup" : tab === "logs" ? "Agent Console Feed" : tab}
            </button>
          ))}
        </div>

        {/* RENDER VIEWPORTS */}
        
        {/* VIEWPORT: DASHBOARD */}
        {activeTab === "dashboard" && (
          <div className="space-y-6" id="viewport-dashboard">
            {/* Key Stat Cards Grid */}
            {stats && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="stats-dashboard-grid">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-mono font-medium text-slate-400 uppercase">Jobs Indexed Today</span>
                    <Database className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-sans font-bold text-white">{stats.projectsFoundTodayCount}</h3>
                    <p className="text-[10px] text-slate-500 font-mono mt-1">across Upwork, Freelancer, PPH & Guru</p>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-mono font-medium text-slate-400 uppercase">Requires Approval</span>
                    <BadgeAlert className="w-4 h-4 text-amber-500 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-sans font-bold text-white text-amber-400">
                      {stats.projectsAwaitingApprovalCount}
                    </h3>
                    <p className="text-[10px] text-slate-500 font-mono mt-1">bids formulated requiring human check</p>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-mono font-medium text-slate-400 uppercase">Total Bids Formulated</span>
                    <FileText className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-sans font-bold text-white">{stats.generatedProposalsCount}</h3>
                    <p className="text-[10px] text-slate-500 font-mono mt-1">high-context personalized drafts</p>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-mono font-medium text-slate-400 uppercase">Success Conversion</span>
                    <TrendingUp className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-sans font-bold text-white text-emerald-400">
                      {stats.successMetrics.totalSubmitted > 0
                        ? Math.round((stats.successMetrics.totalApproved / stats.successMetrics.totalSubmitted) * 100)
                        : 100}
                      %
                    </h3>
                    <p className="text-[10px] text-slate-500 font-mono mt-1">
                      {stats.successMetrics.totalSubmitted} submitted / {stats.successMetrics.totalApproved} approved
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Core Layout Split */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="dashboard-split-layout">
              {/* Human-in-the-Loop Approval Queue */}
              <div className="lg:col-span-8 space-y-4" id="human-approval-workspace">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-mono font-semibold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Human Approval Queue ({proposals.filter((p) => p.status === "Pending Approval").length})
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">Real-time bids await checking</span>
                </div>

                {proposals.filter((p) => p.status === "Pending Approval").length === 0 ? (
                  <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 text-center" id="approval-queue-empty">
                    <div className="inline-flex p-3 bg-slate-950 text-slate-600 rounded-xl mb-3 border border-slate-850">
                      <Check className="w-6 h-6" />
                    </div>
                    <h4 className="text-white font-sans text-sm font-semibold">Queue Completely Clear</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      All formulated proposals have been audited. Dispatched crawler tasks will automatically feed new projects here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4" id="approval-records-list">
                    {proposals
                      .filter((p) => p.status === "Pending Approval")
                      .map((proposal) => {
                        const associatedProj = projects.find((p) => p.id === proposal.projectId);
                        return (
                          <div
                            key={proposal.id}
                            className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 hover:border-slate-700 transition-all"
                          >
                            <div className="flex justify-between items-start flex-wrap gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="bg-amber-950 text-amber-400 border border-amber-900 text-[10px] px-2 py-0.5 rounded font-mono">
                                    {proposal.tone.toUpperCase()}
                                  </span>
                                  <span className="text-xs text-slate-500 font-mono">
                                    Drafted {new Date(proposal.createdAt).toLocaleTimeString()}
                                  </span>
                                </div>
                                <h4 className="text-base font-semibold text-white mt-1.5">{associatedProj?.title}</h4>
                              </div>

                              <div className="text-right">
                                <span className="text-emerald-400 font-mono font-semibold block text-sm">
                                  {associatedProj?.budget}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono uppercase block mt-0.5">
                                  via {associatedProj?.source}
                                </span>
                              </div>
                            </div>

                            <div className="bg-slate-950 border border-slate-850 rounded-lg p-4 font-sans text-xs text-slate-300 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
                              {proposal.proposalText}
                            </div>

                            <div className="flex justify-between items-center gap-4 pt-1 flex-wrap">
                              <button
                                onClick={() => setSelectedProposal(proposal)}
                                className="text-xs text-blue-400 hover:text-blue-300 font-mono flex items-center gap-1 transition-colors"
                              >
                                Expand proposal text editor
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleRejectProposal(proposal.id)}
                                  className="bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-rose-400 text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  Reject
                                </button>
                                <button
                                  onClick={() => handleApproveProposal(proposal.id)}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Approve Bid
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Quick Overview Sidebar */}
              <div className="lg:col-span-4 space-y-6" id="dashboard-sidebar-diagnostics">
                {/* Scheduler & Platform Health */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                  <h4 className="text-xs font-mono font-semibold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-blue-500" />
                    Scheduler & Platform Health
                  </h4>

                  <div className="space-y-3 text-xs" id="scheduler-metrics-details">
                    <div className="flex justify-between py-1.5 border-b border-slate-850">
                      <span className="text-slate-400">Operating Mode</span>
                      <span className={`font-mono font-bold uppercase ${config?.mode === "production" ? "text-amber-400" : "text-blue-400"}`}>
                        {config?.mode || "development"} Mode
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-850">
                      <span className="text-slate-400">Scheduler Engine</span>
                      <span className="font-mono text-emerald-400 font-bold">
                        {stats?.schedulerEnabled ? "ACTIVE" : "DISABLED"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-850">
                      <span className="text-slate-400">Crawling Interval</span>
                      <span className="font-mono text-white">{config?.schedulerInterval || 15} minutes</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-850">
                      <span className="text-slate-400">Database Size</span>
                      <span className="font-mono text-white">{stats?.dbSizeKb || 0} KB</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-400">Error Failure Rate</span>
                      <span className={`font-mono font-bold ${stats?.errorRate && stats.errorRate > 20 ? "text-rose-400" : "text-emerald-400"}`}>
                        {stats?.errorRate || 0}%
                      </span>
                    </div>
                  </div>

                  {/* Provider Health Monitor */}
                  <div className="pt-3 border-t border-slate-800 space-y-2.5">
                    <span className="text-[10px] font-mono font-semibold tracking-wider text-slate-500 uppercase block">Provider States</span>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      {stats?.providerHealth && Object.entries(stats.providerHealth).map(([provider, state]) => (
                        <div key={provider} className="flex items-center justify-between bg-slate-950 border border-slate-850 p-1.5 rounded">
                          <span className="text-slate-400 text-[10px] truncate pr-1">{provider}</span>
                          <span className={`text-[9px] font-bold uppercase px-1 rounded ${
                            state === "online" 
                              ? "bg-emerald-950/50 text-emerald-400 border border-emerald-900/40" 
                              : state === "degraded"
                              ? "bg-amber-950/50 text-amber-400 border border-amber-900/40"
                              : "bg-rose-950/50 text-rose-400 border border-rose-900/40"
                          }`}>
                            {state}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Console Logs Widget */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-mono font-semibold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
                      <Terminal className="w-4 h-4 text-slate-400" />
                      Agent Log stream
                    </h4>
                    <button
                      onClick={() => setActiveTab("logs")}
                      className="text-[10px] text-blue-400 hover:text-blue-300 font-mono"
                    >
                      View console
                    </button>
                  </div>

                  <div className="space-y-2 bg-slate-950 border border-slate-850 rounded-lg p-3 h-48 overflow-y-auto font-mono text-[10px] leading-relaxed">
                    {logs.slice(0, 8).map((log) => (
                      <div key={log.id} className="flex gap-1.5">
                        <span className="text-slate-600">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span
                          className={
                            log.level === "error"
                              ? "text-rose-400"
                              : log.level === "warn"
                              ? "text-amber-400"
                              : log.level === "success"
                              ? "text-emerald-400"
                              : "text-blue-400"
                          }
                        >
                          [{log.level.toUpperCase()}]
                        </span>
                        <span className="text-slate-300">{log.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEWPORT: COMPANY PROFILES & MULTI-TENANT LEAD ROUTING */}
        {activeTab === "companies" && (
          <div className="space-y-6" id="viewport-companies">
            <CompanyProfilesManager onCompanySelected={(id) => {
              setActiveTab("projects");
            }} />
          </div>
        )}

        {/* VIEWPORT: PROJECTS LISTINGS */}
        {activeTab === "projects" && (
          <div className="space-y-6" id="viewport-projects">
            {/* Filters Banner */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap gap-4 items-center justify-between" id="projects-filters">
              <div className="flex items-center gap-3 flex-1 min-w-[280px]">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Filter by keyword, skill or platform..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 text-xs border border-slate-800 rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-slate-700 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg">
                  <span className="text-[10px] font-mono text-slate-500 uppercase">Platform</span>
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="bg-transparent border-none text-xs text-slate-200 focus:outline-none cursor-pointer font-sans"
                  >
                    <option value="all" className="bg-slate-950">All Sources</option>
                    <option value="upwork" className="bg-slate-950">Upwork</option>
                    <option value="freelancer" className="bg-slate-950">Freelancer</option>
                    <option value="peopleperhour" className="bg-slate-950">PeoplePerHour</option>
                    <option value="guru" className="bg-slate-950">Guru</option>
                    <option value="fiverr" className="bg-slate-950">Fiverr Pro</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg">
                  <span className="text-[10px] font-mono text-slate-500 uppercase">Score Match</span>
                  <select
                    value={scoreFilter}
                    onChange={(e) => setScoreFilter(e.target.value)}
                    className="bg-transparent border-none text-xs text-slate-200 focus:outline-none cursor-pointer font-sans"
                  >
                    <option value="all" className="bg-slate-950">All Grades</option>
                    <option value="high" className="bg-slate-950">High Match (80+)</option>
                    <option value="medium" className="bg-slate-950">Medium Match (50-79)</option>
                    <option value="low" className="bg-slate-950">Low Match (&lt;50)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Project List */}
            <div className="space-y-4" id="crawled-projects-list">
              {filteredProjects.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl py-16 text-center" id="projects-empty-state">
                  <p className="text-slate-400 font-mono text-sm">No synchronized projects matching active filters.</p>
                </div>
              ) : (
                filteredProjects.map((proj) => (
                  <div
                    key={proj.id}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all flex justify-between items-start flex-wrap gap-4"
                  >
                    <div className="space-y-2.5 flex-1 max-w-3xl">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-semibold text-white tracking-tight">{proj.title}</h3>
                        <span className="bg-slate-950 text-slate-400 border border-slate-850 text-[10px] px-2 py-0.5 rounded font-mono uppercase">
                          {proj.source}
                        </span>
                        {proj.score !== undefined && (
                          <span
                            className={`border text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                              proj.score >= 80
                                ? "bg-emerald-950/50 border-emerald-800 text-emerald-400"
                                : proj.score >= 50
                                ? "bg-blue-950/50 border-blue-800 text-blue-400"
                                : "bg-slate-950/50 border-slate-800 text-slate-400"
                            }`}
                          >
                            Scout Score: {proj.score}/100
                          </span>
                        )}
                        {proj.urgency === "high" && (
                          <span className="bg-rose-950 text-rose-400 border border-rose-900 text-[10px] px-2 py-0.5 rounded font-mono font-medium">
                            URGENT
                          </span>
                        )}

                        {proj.matchedCompanies && proj.matchedCompanies.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            {proj.matchedCompanies.map((mc) => (
                              <span
                                key={mc.id}
                                className="bg-blue-950/70 border border-blue-800 text-blue-300 text-[10px] px-2 py-0.5 rounded font-mono font-semibold flex items-center gap-1"
                                title={`Matched reasons: ${mc.reasons.join(", ")}`}
                              >
                                <Building2 className="w-3 h-3 text-blue-400" />
                                {mc.name}: {mc.score}%
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">{proj.description}</p>

                      <div className="flex gap-1.5 flex-wrap pt-1">
                        {proj.skills.map((skill) => (
                          <span key={skill} className="bg-slate-950 text-slate-400 text-xs px-2.5 py-1 rounded border border-slate-850">
                            {skill}
                          </span>
                        ))}
                      </div>

                      {proj.scoreReasons && proj.scoreReasons.length > 0 && (
                        <div className="pt-2 text-[10px] text-slate-500 font-mono space-y-1">
                          <strong className="text-slate-400">Scoring Analysis Breakdown:</strong>
                          <ul className="list-disc list-inside">
                            {proj.scoreReasons.map((reason, index) => (
                              <li key={index}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="text-right text-xs text-slate-400 flex flex-col justify-between h-full gap-5">
                      <div className="font-mono">
                        <div className="text-emerald-400 font-semibold text-base">{proj.budget}</div>
                        <div className="text-[10px] text-slate-500 mt-1 uppercase">
                          {proj.hourlyOrFixed === "hourly" ? "Hourly Rate" : "Fixed Budget"}
                        </div>
                        {proj.clientRating && (
                          <div className="text-slate-300 mt-1">Client: {proj.clientRating}★</div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 items-end">
                        <a
                          href={proj.projectUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          Direct Contract Link
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        <button
                          onClick={() => setSelectedProject(proj)}
                          className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer mt-1"
                        >
                          Draft Proposal
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* VIEWPORT: 40 REMOTE PLATFORMS CATALOG */}
        {activeTab === "platforms" && (
          <div className="space-y-6" id="viewport-platforms-catalog">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-950 border border-blue-800 text-blue-400 text-xs px-2.5 py-1 rounded font-mono font-semibold">
                      40 Verified Platforms
                    </span>
                    <span className="text-xs text-slate-400 font-mono">100% Genuine Web Search Index</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mt-2">Remote Job Portals & Freelance Gigs Directory</h3>
                  <p className="text-slate-400 text-xs leading-relaxed mt-1 max-w-3xl">
                    Comprehensive catalog of 40 global remote work platforms, freelance marketplaces, niche developer boards, and tech job portals requested for automated client scouting and dealer expansion.
                  </p>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-300 font-mono">
                    <span className="text-emerald-400 font-bold">{REMOTE_PLATFORMS_40.filter(p => p.isLiveFeedSupported).length}</span> Live Feeds Active
                  </div>
                </div>
              </div>

              {/* Grid of 40 Platforms */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                {REMOTE_PLATFORMS_40.map((plat) => (
                  <div
                    key={plat.id}
                    className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col justify-between space-y-3 transition-all group"
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="bg-slate-900 border border-slate-800 text-slate-300 text-[10px] font-mono px-2 py-0.5 rounded uppercase">
                          {plat.category}
                        </span>
                        {plat.isLiveFeedSupported ? (
                          <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            Live Feed
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-500 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded">
                            Web Scrape
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-semibold text-white group-hover:text-blue-400 transition-colors">
                        {plat.name}
                      </h4>
                      <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                        {plat.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-900 flex justify-between items-center gap-2 text-xs font-mono">
                      <span className="text-slate-500 text-[11px] truncate max-w-[180px]">
                        {plat.url.replace("https://", "").replace("www.", "")}
                      </span>
                      <a
                        href={plat.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 bg-blue-900/40 hover:bg-blue-800/60 border border-blue-700/60 text-blue-300 px-2.5 py-1 rounded text-[11px] font-sans font-medium transition-colors"
                      >
                        Visit Genuine Site
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VIEWPORT: PROPOSALS ARCHIVE */}
        {activeTab === "proposals" && (
          <div className="space-y-6" id="viewport-proposals">
            {/* Proposals List */}
            <div className="space-y-4 font-sans" id="all-proposals-grid">
              {proposals.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl py-16 text-center" id="proposals-archive-empty">
                  <p className="text-slate-400 font-mono text-sm">No proposal bids have been formulated yet.</p>
                </div>
              ) : (
                proposals.map((prop) => {
                  const associatedProj = projects.find((p) => p.id === prop.projectId);
                  return (
                    <div
                      key={prop.id}
                      className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 hover:border-slate-700 transition-all"
                    >
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`border text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                                prop.status === "Submitted"
                                  ? "bg-emerald-950/50 border-emerald-800 text-emerald-400"
                                  : prop.status === "Approved"
                                  ? "bg-blue-950/50 border-blue-800 text-blue-400"
                                  : prop.status === "Rejected"
                                  ? "bg-rose-950/50 border-rose-900 text-rose-400"
                                  : "bg-slate-950 border-slate-800 text-slate-400"
                              }`}
                            >
                              {prop.status}
                            </span>
                            <span className="text-xs text-slate-500 font-mono">
                              Formulated {new Date(prop.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                          <h4 className="text-base font-semibold text-white mt-1.5">
                            {associatedProj ? associatedProj.title : prop.title}
                          </h4>
                        </div>

                        <div className="text-right">
                          <span className="text-emerald-400 font-mono font-semibold block text-sm">
                            {associatedProj ? associatedProj.budget : "Negotiable"}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono uppercase block mt-0.5">
                            Platform Bid: {associatedProj?.source || "Simulated"}
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-950 border border-slate-850 rounded-lg p-4 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap max-h-[180px] overflow-y-auto">
                        {prop.proposalText}
                      </div>

                      <div className="flex justify-between items-center gap-4 flex-wrap pt-1">
                        <button
                          onClick={() => setSelectedProposal(prop)}
                          className="text-xs text-blue-400 hover:text-blue-300 font-mono flex items-center gap-1 transition-colors"
                        >
                          Modify / Read Proposal in Editor
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>

                        <div className="flex items-center gap-2">
                          {prop.status === "Pending Approval" && (
                            <>
                              <button
                                onClick={() => handleRejectProposal(prop.id)}
                                className="bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-rose-400 text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => handleApproveProposal(prop.id)}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4.5 py-2 rounded-lg cursor-pointer"
                              >
                                Approve Cover Letter
                              </button>
                            </>
                          )}

                          {prop.status === "Approved" && (
                            <button
                              onClick={() => handleSubmitProposal(prop.id)}
                              disabled={submittingProposalId === prop.id}
                              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4.5 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${submittingProposalId === prop.id ? "animate-spin" : ""}`} />
                              Inject Proposal Bid
                            </button>
                          )}

                          {prop.status === "Submitted" && (
                            <span className="text-slate-400 text-xs font-mono flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              Dispatched: {new Date(prop.submittedAt || "").toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* VIEWPORT: CANDIDATES MANAGEMENT (REAL SYSTEM INTEGRATION) */}
        {activeTab === "candidates" && (
          <div className="space-y-6" id="viewport-candidates">
            {/* Split layout: Resume Parser Playground vs Profiles Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* AI Resume Parser Section */}
              <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <FileCode className="w-4 h-4 text-blue-400" />
                    AI Resume Parser Engine
                  </h3>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Paste raw markdown, textual resume, or copy-pasted CV details. The backend invokes Gemini to extract name, skills, and experience years.
                  </p>
                </div>

                <div className="space-y-3">
                  <textarea
                    rows={8}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-3 text-xs text-slate-300 placeholder-slate-600 font-mono focus:outline-none focus:border-slate-700 leading-normal"
                    placeholder="Paste candidate resume content here..."
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                  />

                  <div className="flex gap-2 justify-between">
                    <button
                      onClick={handleLoadSampleCV}
                      className="text-[10px] text-blue-400 hover:text-blue-300 font-mono bg-slate-950 hover:bg-slate-850 border border-slate-850 px-2.5 py-1.5 rounded transition-colors cursor-pointer"
                    >
                      Load Sample CV
                    </button>

                    <button
                      onClick={handleParseResume}
                      disabled={isParsingResume}
                      className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {isParsingResume ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          Extracting...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3" />
                          Parse CV Now
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Profiles Grid */}
              <div className="lg:col-span-8 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-slate-400" />
                    Candidate Talent Database ({candidates.length})
                  </h3>
                  
                  <button
                    onClick={() => setEditingCandidate({ name: "", skills: [], experienceYears: 3, locationPreference: "Remote" })}
                    className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Manual Profile
                  </button>
                </div>

                {candidates.length === 0 ? (
                  <div className="bg-slate-900/40 border border-slate-800 rounded-xl py-24 text-center">
                    <User className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                    <h4 className="text-white font-semibold text-sm">No Candidate Profiles Configured</h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 leading-normal">
                      Use the CV parser panel on the left or click "Manual Profile" to bootstrap skills scoring metadata.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {candidates.map((cand) => (
                      <div key={cand.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-blue-950 border border-blue-900/60 flex items-center justify-center text-blue-400 font-bold text-xs select-none">
                                {cand.name.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-white tracking-tight">{cand.name}</h4>
                                <span className="text-[10px] font-mono text-slate-500 uppercase">Candidate Target Profile</span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleDeleteCandidate(cand.id)}
                              className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-slate-950 transition-colors cursor-pointer"
                              title="Delete Profile"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-950/50 border border-slate-850/60 rounded-lg p-2.5">
                            <div>
                              <span className="text-slate-500 block text-[9px] uppercase">Experience</span>
                              <span className="text-slate-300 font-bold">{cand.experienceYears} Years</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[9px] uppercase">Location preference</span>
                              <span className="text-slate-300 font-bold">{cand.locationPreference}</span>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <span className="text-[10px] font-mono text-slate-500 uppercase block">Expertise Skills Set</span>
                            <div className="flex flex-wrap gap-1">
                              {cand.skills.map((skill) => (
                                <span key={skill} className="bg-slate-950 border border-slate-850 text-slate-400 text-[10px] px-2 py-0.5 rounded font-mono">
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-850/60">
                          <button
                            onClick={() => setEditingCandidate(cand)}
                            className="w-full bg-slate-950 hover:bg-slate-850 border border-slate-800 text-xs text-blue-400 hover:text-blue-300 font-mono py-1.5 rounded transition-all cursor-pointer text-center"
                          >
                            Edit Profile Meta
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Candidate Edit / Manual creation modal */}
            {editingCandidate && (
              <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <form onSubmit={handleSaveCandidate} className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md overflow-hidden">
                  <div className="p-5 border-b border-slate-800 flex justify-between items-center">
                    <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
                      {editingCandidate.id ? "Edit Candidate Profile" : "Create Manual Profile"}
                    </h3>
                    <button type="button" onClick={() => setEditingCandidate(null)} className="text-slate-400 hover:text-white">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-5 space-y-4 text-xs font-sans">
                    <div className="space-y-1.5">
                      <label className="text-slate-400 font-semibold block">Full Name</label>
                      <input
                        type="text"
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-slate-700"
                        placeholder="e.g. Robert Chen"
                        value={editingCandidate.name || ""}
                        onChange={(e) => setEditingCandidate({ ...editingCandidate, name: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-slate-400 font-semibold block">Experience (Years)</label>
                        <input
                          type="number"
                          required
                          min={0}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-slate-700 font-mono"
                          value={editingCandidate.experienceYears || 0}
                          onChange={(e) => setEditingCandidate({ ...editingCandidate, experienceYears: parseInt(e.target.value, 10) || 0 })}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-slate-400 font-semibold block">Location Preference</label>
                        <input
                          type="text"
                          required
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-slate-700"
                          value={editingCandidate.locationPreference || ""}
                          placeholder="e.g. Remote"
                          onChange={(e) => setEditingCandidate({ ...editingCandidate, locationPreference: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-slate-400 font-semibold block">Skills Set (Comma Separated)</label>
                      <input
                        type="text"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-slate-700 font-mono"
                        placeholder="React, TypeScript, Python, Express"
                        value={editingCandidate.skills?.join(", ") || ""}
                        onChange={(e) => setEditingCandidate({
                          ...editingCandidate,
                          skills: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                        })}
                      />
                    </div>
                  </div>

                  <div className="p-5 border-t border-slate-800 bg-slate-900/60 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingCandidate(null)}
                      className="bg-slate-950 hover:bg-slate-850 text-slate-300 border border-slate-800 text-xs px-4 py-2 rounded-lg cursor-pointer transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingCandidate}
                      className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4.5 py-2 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                    >
                      {isSavingCandidate && <RefreshCw className="w-3 h-3 animate-spin" />}
                      Save Profile
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* VIEWPORT: NOTIFICATIONS CENTER */}
        {activeTab === "notifications" && (
          <div className="space-y-6" id="viewport-notifications">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-blue-400 animate-swing" />
                  Persistent System Notifications ({notifications.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Durable platform logs, match scoring notifications, and security approval milestones.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchDashboardData}
                  className="bg-slate-900 hover:bg-slate-800 text-xs border border-slate-800 text-slate-300 px-3.5 py-2 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Sync Alerts
                </button>

                <button
                  onClick={handleClearNotifications}
                  disabled={notifications.length === 0}
                  className="bg-slate-900 hover:bg-slate-800 text-xs border border-slate-800 text-rose-400 hover:text-rose-300 px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Alerts
                </button>
              </div>
            </div>

            {notifications.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl py-24 text-center">
                <Bell className="w-10 h-10 text-slate-800 mx-auto mb-3" />
                <h4 className="text-white font-semibold text-sm">Notifications Clear</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                  You are all caught up! Crawler discoveries and action approvals will stream notifications here as they occur.
                </p>
              </div>
            ) : (
              <div className="space-y-3 font-mono text-xs">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => {
                      if (!notif.read) handleMarkAsRead(notif.id);
                    }}
                    className={`border rounded-xl p-4 flex gap-4 items-start justify-between transition-all cursor-pointer hover:border-slate-600 ${
                      notif.read
                        ? "bg-slate-900/40 border-slate-850 text-slate-400"
                        : "bg-slate-900 border-slate-800 text-slate-200 shadow-lg shadow-blue-500/5 border-l-4 border-l-blue-500"
                    }`}
                  >
                    <div className="flex gap-3 items-start">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded font-mono uppercase tracking-wider shrink-0 mt-0.5 ${
                          notif.type === "MATCH"
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-900/40"
                            : notif.type === "APPROVAL_REQUIRED"
                            ? "bg-amber-950 text-amber-400 border border-amber-900/40"
                            : notif.type === "SUBMISSION"
                            ? "bg-blue-950 text-blue-400 border border-blue-900/40"
                            : "bg-rose-950 text-rose-400 border border-rose-900/40"
                        }`}
                      >
                        {notif.type}
                      </span>
                      <div className="space-y-1">
                        <p className="font-sans text-xs leading-relaxed">{notif.message}</p>
                        <div className="flex gap-2 text-[10px] text-slate-500">
                          <span>Logged: {new Date(notif.createdAt).toLocaleString()}</span>
                          {notif.projectId && (
                            <>
                              <span>•</span>
                              <span className="text-blue-400 hover:underline">Project: {notif.projectId}</span>
                            </>
                          )}
                          {notif.proposalId && (
                            <>
                              <span>•</span>
                              <span className="text-amber-400 hover:underline">Proposal: {notif.proposalId}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {!notif.read && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsRead(notif.id);
                        }}
                        className="text-[10px] text-blue-400 hover:text-blue-300 font-mono hover:underline shrink-0 cursor-pointer"
                      >
                        Mark Read
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEWPORT: REAL-TIME ANALYTICS (RECHARTS CHIPS) */}
        {activeTab === "analytics" && (
          <div className="space-y-6 animate-fadeIn" id="viewport-analytics">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  Interactive Scout & Conversion Analytics
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Visual graphs charting platform match scores, client average budgets, and bid pipeline distributions.
                </p>
              </div>

              <button
                onClick={fetchDashboardData}
                className="bg-slate-900 hover:bg-slate-800 text-xs border border-slate-800 text-slate-300 px-3.5 py-2 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Sync Analytics
              </button>
            </div>

            {analytics ? (
              <>
                {/* Budget Trends KPIs Card */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="analytics-kpis">
                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-2">
                    <span className="text-[10px] font-mono uppercase text-slate-500">Avg Fixed Budget</span>
                    <h4 className="text-2xl font-bold text-emerald-400">${analytics.budgetStats.avgFixedBudget}</h4>
                    <p className="text-[10px] text-slate-500 font-mono">From {analytics.budgetStats.totalFixedCount} fixed listings</p>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-2">
                    <span className="text-[10px] font-mono uppercase text-slate-500">Avg Hourly Rate</span>
                    <h4 className="text-2xl font-bold text-blue-400">${analytics.budgetStats.avgHourlyBudget}/hr</h4>
                    <p className="text-[10px] text-slate-500 font-mono">From {analytics.budgetStats.totalHourlyCount} hourly contracts</p>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-2">
                    <span className="text-[10px] font-mono uppercase text-slate-500">Total Crawl Passes</span>
                    <h4 className="text-2xl font-bold text-slate-200">{analytics.runsHistory.length} Runs</h4>
                    <p className="text-[10px] text-slate-500 font-mono">Continuous background scans</p>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-2">
                    <span className="text-[10px] font-mono uppercase text-slate-500">Overall Success Ratio</span>
                    <h4 className="text-2xl font-bold text-cyan-400">
                      {stats ? (stats.successMetrics.totalSubmitted > 0 ? Math.round((stats.successMetrics.totalApproved / stats.successMetrics.totalSubmitted) * 100) : 100) : 100}%
                    </h4>
                    <p className="text-[10px] text-slate-500 font-mono">Approval vs. Platform submissions</p>
                  </div>
                </div>

                {/* Recharts Grid block */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Match score bar chart */}
                  <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                    <div>
                      <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wide">
                        Match Score Density Distribution
                      </h4>
                      <span className="text-[10px] text-slate-500 leading-none">Grouping of crawl listings into custom developer match tiers</span>
                    </div>

                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics.matchDistributionData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                          <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} tickLine={false} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "#020617", border: "1px solid #1e293b", borderRadius: "8px" }}
                            labelStyle={{ color: "#ffffff", fontWeight: "bold" }}
                          />
                          <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                            {analytics.matchDistributionData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index === 0 ? "#10b981" : index === 1 ? "#3b82f6" : "#64748b"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Platforms distribution Pie Chart */}
                  <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                    <div>
                      <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wide">
                        Job Share by Source Platform
                      </h4>
                      <span className="text-[10px] text-slate-500 leading-none">Crawl density comparison across platform API adapters</span>
                    </div>

                    <div className="h-[240px] flex items-center justify-center relative">
                      {analytics.platformDistributionData.length === 0 ? (
                        <span className="text-slate-600 font-mono text-xs">No project platform metrics indexed.</span>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={analytics.platformDistributionData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {analytics.platformDistributionData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: "#020617", border: "1px solid #1e293b", borderRadius: "8px" }} />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center text-[11px] font-mono text-slate-400">
                      {analytics.platformDistributionData.map((p, index) => (
                        <div key={p.name} className="flex items-center gap-1.5">
                          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                          <span>{p.name}: <strong className="text-white">{p.value}</strong></span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Engine Scheduler History Line Charts block */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div>
                    <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wide">
                      Daemon Crawler Discovery History
                    </h4>
                    <span className="text-[10px] text-slate-500 leading-none">Indexed project quantities across recent scheduler execution blocks</span>
                  </div>

                  <div className="space-y-3">
                    {analytics.runsHistory.length === 0 ? (
                      <div className="py-12 text-center text-slate-600 font-mono text-xs">No scheduler crawl execution histories.</div>
                    ) : (
                      <div className="space-y-2">
                        {analytics.runsHistory.map((run, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-slate-950 border border-slate-850 p-2.5 rounded-lg text-xs font-mono">
                            <div className="flex items-center gap-3">
                              <span className="text-slate-500">Run #{idx + 1}</span>
                              <span className="text-slate-400">{new Date(run.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <div className="flex gap-4">
                              <span>Found: <strong className="text-emerald-400">{run.projectsFound} jobs</strong></span>
                              <span>Duration: <strong className="text-slate-300">{run.durationMs}ms</strong></span>
                              <span className={`font-bold ${run.status === "success" ? "text-emerald-400" : "text-rose-400"}`}>
                                {run.status.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-xl py-24 text-center font-mono">
                <BarChart3 className="w-10 h-10 text-slate-800 mx-auto mb-3" />
                <h4 className="text-white font-semibold">Generating Real-Time Telemetry</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                  Scheduler engine must complete at least one job crawling pass to bootstrap interactive charts.
                </p>
              </div>
            )}
          </div>
        )}

        {/* VIEWPORT: SCHEDULER SETUP & INTERFACE ARTIFACTS */}
        {activeTab === "config" && config && (
          <div className="space-y-6" id="viewport-config">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-6 font-sans">
              
              {/* Header descriptions */}
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-slate-400" />
                  Continuous Autonomous Dispatcher Configurations
                </h3>
                <p className="text-slate-400 text-xs">
                  Calibrate active background thread sleep routines, execution error retries, and AI models for proposal draft formulas.
                </p>
              </div>

              {/* Master toggle form layouts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                
                {/* Mode Selectors */}
                <div className="space-y-3">
                  <span className="text-xs font-mono font-semibold tracking-wider text-slate-400 uppercase block">Engine Deployment Mode</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleSaveConfig({ mode: "development" })}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                        config.mode === "development"
                          ? "bg-blue-950/40 border-blue-800 text-blue-300"
                          : "bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-800"
                      }`}
                    >
                      <span className="font-bold text-xs block">Development Mode</span>
                      <span className="text-[9px] text-slate-500 block mt-1 leading-normal">
                        Mocks outbound crawling endpoints. Uses mock jobs & fast test feedback loops.
                      </span>
                    </button>

                    <button
                      onClick={() => handleSaveConfig({ mode: "production" })}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                        config.mode === "production"
                          ? "bg-amber-950/40 border-amber-800 text-amber-300"
                          : "bg-slate-950 border-slate-850 text-slate-400 hover:border-slate-800"
                      }`}
                    >
                      <span className="font-bold text-xs block">Production Mode</span>
                      <span className="text-[9px] text-slate-500 block mt-1 leading-normal">
                        Performs real network crawling across active Upwork, Fiverr Pro and Guru providers.
                      </span>
                    </button>
                  </div>
                </div>

                {/* Daemon Sleep Routines */}
                <div className="space-y-3">
                  <span className="text-xs font-mono font-semibold tracking-wider text-slate-400 uppercase block">Scheduler Status</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveConfig({ isEnabled: !config.isEnabled, schedulerEnabled: !config.schedulerEnabled })}
                      className={`flex-1 p-3 rounded-lg border text-left flex items-center justify-between cursor-pointer transition-all ${
                        config.isEnabled
                          ? "bg-emerald-950/30 border-emerald-900 text-emerald-300"
                          : "bg-rose-950/30 border-rose-900 text-rose-300"
                      }`}
                    >
                      <div>
                        <span className="font-bold text-xs block">
                          {config.isEnabled ? "Scout Daemon Running" : "Scout Daemon Paused"}
                        </span>
                        <span className="text-[9px] text-slate-500 block mt-0.5">
                          {config.isEnabled ? "Continuously scraping background jobs" : "Crawling daemon is temporarily asleep"}
                        </span>
                      </div>
                      {config.isEnabled ? (
                        <Pause className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Play className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Advanced Interval parameters */}
              <div className="pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 block font-mono">Crawler Run Interval</label>
                  <div className="flex gap-1">
                    {[5, 15, 30, 60].map((mins) => (
                      <button
                        key={mins}
                        onClick={() => handleSaveConfig({ schedulerInterval: mins, intervalMinutes: mins as any })}
                        className={`flex-1 text-center py-2 rounded-lg text-xs font-mono border transition-all ${
                          config.schedulerInterval === mins
                            ? "bg-blue-600 border-blue-500 text-white font-bold"
                            : "bg-slate-950 border-slate-850 hover:border-slate-800 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>
                  <span className="text-[9px] text-slate-500 block leading-none">Minutes between crawl passes</span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 block font-mono">Platform API Timeout</label>
                  <input
                    type="number"
                    value={config.timeoutMs}
                    onChange={(e) => handleSaveConfig({ timeoutMs: parseInt(e.target.value) || 10000 })}
                    className="w-full bg-slate-950 text-xs font-mono border border-slate-800 rounded-lg p-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-slate-700"
                  />
                  <span className="text-[9px] text-slate-500 block leading-none">Milliseconds before fetch cancel</span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 block font-mono">Scraper Fail Retry Limit</label>
                  <input
                    type="number"
                    value={config.retryCount}
                    onChange={(e) => handleSaveConfig({ retryCount: parseInt(e.target.value) || 3 })}
                    className="w-full bg-slate-950 text-xs font-mono border border-slate-800 rounded-lg p-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-slate-700"
                  />
                  <span className="text-[9px] text-slate-500 block leading-none">Max retry backoff occurrences</span>
                </div>
              </div>

              {/* Custom Cron Settings and AI Model configuration */}
              <div className="pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 block font-mono">AI Formulation Model</label>
                  <select
                    value={config.aiModel}
                    onChange={(e) => handleSaveConfig({ aiModel: e.target.value })}
                    className="w-full bg-slate-950 text-xs border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-slate-700 font-sans"
                  >
                    <option value="gemini-3.5-flash">gemini-3.5-flash (Standard Fast)</option>
                    <option value="gemini-2.5-pro">gemini-2.5-pro (High Quality)</option>
                    <option value="gemini-1.5-flash">gemini-1.5-flash (Deprecated)</option>
                  </select>
                  <span className="text-[9px] text-slate-500 block leading-none">Target LLM model used for tailored bidding</span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 block font-mono">Cron Rule Override</label>
                  <input
                    type="text"
                    value={config.cronExpression || "*/15 * * * *"}
                    onChange={(e) => handleSaveConfig({ cronExpression: e.target.value })}
                    className="w-full bg-slate-950 text-xs font-mono border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-slate-700"
                    placeholder="e.g. */15 * * * *"
                  />
                  <span className="text-[9px] text-slate-500 block leading-none">Cron string rule for production system daemon ticks</span>
                </div>
              </div>

              {/* Feature Flags Toggle Section */}
              <div className="pt-4 border-t border-slate-800 space-y-4">
                <span className="text-xs font-mono font-semibold tracking-wider text-slate-400 uppercase block">Engine Intelligent Feature Flags</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-xs text-white block">Auto-Submit Cover Letters</span>
                      <span className="text-[10px] text-slate-500">Submit bids automatically after approval</span>
                    </div>
                    <button
                      onClick={() => handleSaveConfig({
                        featureFlags: {
                          ...config.featureFlags,
                          autoSubmit: !config.featureFlags.autoSubmit
                        }
                      })}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        config.featureFlags?.autoSubmit ? "bg-emerald-600" : "bg-slate-800"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          config.featureFlags?.autoSubmit ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-xs text-white block">High-Value Notifications</span>
                      <span className="text-[10px] text-slate-500">Trigger special email alerts for matches &gt; 85%</span>
                    </div>
                    <button
                      onClick={() => handleSaveConfig({
                        featureFlags: {
                          ...config.featureFlags,
                          highValueNotifications: !config.featureFlags.highValueNotifications
                        }
                      })}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        config.featureFlags?.highValueNotifications ? "bg-emerald-600" : "bg-slate-800"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          config.featureFlags?.highValueNotifications ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Advanced Admin Operations */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <span className="font-semibold text-rose-400 block text-xs font-mono uppercase tracking-wider">
                  Danger Administration Area
                </span>
                <p className="text-slate-400 text-xs">
                  Executing admin tasks below can wipe persistent local database schemas or alter engine metadata.
                </p>
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={handleClearDatabase}
                    className="bg-rose-950/40 hover:bg-rose-950/75 border border-rose-900/60 text-rose-300 text-xs font-semibold px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Database className="w-3.5 h-3.5" />
                    Purge Freelance Local Database
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEWPORT FOR SYSTEM LOGS */}
        {activeTab === "logs" && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4" id="viewport-logs">
            <div className="flex justify-between items-center">
              <div className="space-y-0.5">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-slate-400" />
                  Agent Console Stream
                </h3>
                <p className="text-slate-400 text-xs">
                  Real-time kernel telemetry, crawler results, scoring logs, and AI formulation prompts.
                </p>
              </div>
              <button
                onClick={fetchDashboardData}
                className="text-xs text-blue-400 hover:text-blue-300 font-mono flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh Output
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-855 rounded-lg p-4 h-[420px] overflow-y-auto font-mono text-xs leading-relaxed space-y-2">
              {logs.length === 0 ? (
                <div className="text-slate-600 text-center py-20">Console feed is currently empty.</div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="flex gap-2.5 items-start">
                    <span className="text-slate-600 select-none">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span
                      className={`font-semibold shrink-0 select-none ${
                        log.level === "error"
                          ? "text-rose-500"
                          : log.level === "warn"
                          ? "text-amber-500"
                          : log.level === "success"
                          ? "text-emerald-500"
                          : "text-blue-500"
                      }`}
                    >
                      [{log.level.toUpperCase()}]
                    </span>
                    <span className="text-slate-300 whitespace-pre-wrap">{log.message}</span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}

      </main>

      {/* PROPOSAL TEXT DETAILS / EDIT MODAL */}
      {selectedProposal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-mono font-medium text-slate-500 uppercase">Proposal Editor</span>
                <h3 className="text-base font-semibold text-white mt-0.5">{selectedProposal.title}</h3>
              </div>
              <button onClick={() => setSelectedProposal(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 block font-mono">Bidding Text Body</label>
                <textarea
                  value={selectedProposal.proposalText}
                  onChange={(e) => {
                    const text = e.target.value;
                    setSelectedProposal((prev) => (prev ? { ...prev, proposalText: text } : null));
                    // Sync locally
                    const updated = proposals.map((p) => (p.id === selectedProposal.id ? { ...p, proposalText: text } : p));
                    setProposals(updated);
                  }}
                  rows={14}
                  className="w-full bg-slate-950 text-slate-300 font-sans text-xs border border-slate-850 rounded-lg p-4 focus:outline-none focus:border-slate-700 leading-relaxed"
                />
              </div>
            </div>

            <div className="p-5 border-t border-slate-800 bg-slate-900 flex justify-between items-center gap-4">
              <span className="text-[10px] text-slate-500 font-mono">
                Changes persist locally immediately. Bids remain draft until approved.
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedProposal(null)}
                  className="bg-slate-950 hover:bg-slate-850 text-slate-300 border border-slate-800 hover:border-slate-700 text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer transition-colors"
                >
                  Close Editor
                </button>

                {selectedProposal.status === "Pending Approval" && (
                  <button
                    onClick={() => {
                      handleApproveProposal(selectedProposal.id);
                      setSelectedProposal(null);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4.5 py-2 rounded-lg cursor-pointer transition-colors"
                  >
                    Approve Bid
                  </button>
                )}

                {selectedProposal.status === "Approved" && (
                  <button
                    onClick={() => {
                      handleSubmitProposal(selectedProposal.id);
                      setSelectedProposal(null);
                    }}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4.5 py-2 rounded-lg cursor-pointer transition-colors"
                  >
                    Submit Bid Now
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PROPOSAL FORMULATOR PANEL MODAL */}
      {selectedProject && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-800 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-mono font-medium text-slate-500 uppercase">AI Bid Generator</span>
                <h3 className="text-base font-semibold text-white mt-0.5">Customize Proposal Style</h3>
              </div>
              <button onClick={() => setSelectedProject(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                Formulate a custom cover letter and execution plan for:
                <strong className="text-slate-200 block mt-1">{selectedProject.title}</strong>
              </p>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-400 block font-mono">Select Tone Variant</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "professional", title: "Professional", desc: "Standard confident layout" },
                    { key: "friendly", title: "Friendly", desc: "Approachably collaborative" },
                    { key: "premium", title: "Premium Expert", desc: "Elite consultative approach" },
                    { key: "concise", title: "Concise Bullets", desc: "Direct value-focused list" }
                  ].map((style) => (
                    <button
                      key={style.key}
                      onClick={() => handleGenerateProposal(selectedProject.id, style.key)}
                      className="text-left p-3 rounded-lg bg-slate-950 hover:bg-slate-855 border border-slate-850 hover:border-slate-700 transition-all cursor-pointer group"
                    >
                      <span className="font-semibold text-xs text-white group-hover:text-blue-400 block">
                        {style.title}
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">{style.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-800 bg-slate-900 flex justify-end">
              <button
                onClick={() => setSelectedProject(null)}
                className="bg-slate-950 hover:bg-slate-850 text-slate-300 border border-slate-800 text-xs font-semibold px-4.5 py-2 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
