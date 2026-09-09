/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  RefreshCw, 
  Globe, 
  Terminal, 
  CheckCircle, 
  AlertTriangle,
  Server,
  ShieldCheck,
  Download,
  History,
  ArrowRightLeft,
  Database,
  AlertCircle,
  FileCheck,
  Settings,
  ShieldAlert,
  Archive,
  Info,
  Layers,
  Sparkles
} from "lucide-react";
import { DiagnosticMetrics, SystemLog } from "../types";

export interface BackupManifest {
  backupFilename: string;
  timestamp: string;
  firestoreRecordCount: number;
  sqliteRecordCount: number;
  backupDurationMs: number;
  fileSize: number;
  sha256Checksum: string;
  integrityStatus: "VALID" | "INVALID";
  integrityDetails: {
    pragmaOk: boolean;
    recordCountOk: boolean;
    checksumOk: boolean;
    missingCount: number;
    duplicateIdCount: number;
    duplicateNameCount: number;
  };
  appVersion: string;
  databaseVersion: string;
  migrationVersion: string;
  healthScore: number;
  healthStatus: "Healthy" | "Warning" | "Unhealthy";
  compressionEnabled: boolean;
}

export interface StructuredLog {
  operationId: string;
  timestamp: string;
  durationMs: number;
  operation: "backup" | "restore" | "migration" | "validation" | "scheduler" | "cleanup";
  status: "success" | "failure" | "warning" | "running";
  recordsProcessed: number;
  warnings: string[];
  errors: string[];
  retries: number;
  user: string;
  environment: string;
}

export interface OperationProgress {
  operationId: string;
  operation: "backup" | "restore" | "migration" | "validation";
  stage: string;
  percentage: number;
  elapsedTimeMs: number;
  estimatedRemainingTimeMs: number;
  currentRecordName: string;
  errors: string[];
  warnings: string[];
  timestamp: string;
}

export interface RestorePreviewResult {
  backupRecordsCount: number;
  firestoreRecordsCount: number;
  recordsToOverwrite: string[];
  recordsToInsert: string[];
  missingRecords: string[];
  duplicateIds: string[];
  duplicateNames: string[];
}

export default function Diagnostics() {
  const [metrics, setMetrics] = useState<DiagnosticMetrics | null>(null);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(false);

  // Persistence Admin states
  const [healthReport, setHealthReport] = useState<any>(null);
  const [dbActionLoading, setDbActionLoading] = useState(false);
  const [migrationDirection, setMigrationDirection] = useState<"firestore-to-sqlite" | "sqlite-to-firestore">("firestore-to-sqlite");
  const [migrationLogs, setMigrationLogs] = useState<string[]>([]);
  const [migrationResult, setMigrationResult] = useState<any>(null);
  const [dbMsg, setDbMsg] = useState<{ success: boolean; text: string } | null>(null);

  // Advanced Persistence states (Phase 17)
  const [config, setConfig] = useState({
    backupIntervalMinutes: 60,
    retentionCount: 10,
    backupDirectory: "./backups",
    databaseFilename: "backup.sqlitedb",
    retryCount: 3,
    retryDelayMs: 1000,
    retryMaxDelayMs: 10000,
    retryAbortThresholdMs: 30000,
    schedulerEnabled: true,
    logLevel: "info",
    manifestFilename: "manifest.json",
    compressionEnabled: false
  });

  const [versionedBackups, setVersionedBackups] = useState<any[]>([]);
  const [structuredLogs, setStructuredLogs] = useState<StructuredLog[]>([]);
  const [currentProgress, setCurrentProgress] = useState<OperationProgress | null>(null);
  
  // Dry run & Preview triggers
  const [dryRunMigration, setDryRunMigration] = useState(false);
  const [dryRunAnalysis, setDryRunAnalysis] = useState<any | null>(null);
  const [restorePreview, setRestorePreview] = useState<RestorePreviewResult | null>(null);
  const [showRestorePreviewModal, setShowRestorePreviewModal] = useState(false);
  const [configSuccessMsg, setConfigSuccessMsg] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("AZIZ_API_KEY") || "");

  const sseRef = useRef<EventSource | null>(null);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/diagnostics");
      const data = await response.json();
      setMetrics(data.metrics);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await fetch("/api/logs");
      const data = await response.json();
      setLogs(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPersistenceReport = async () => {
    try {
      const response = await fetch("/api/persistence/report");
      if (response.ok) {
        const data = await response.json();
        setHealthReport(data);
      }
    } catch (err) {
      console.error("Failed to fetch persistence report:", err);
    }
  };

  const fetchPersistenceConfig = async () => {
    try {
      const response = await fetch("/api/persistence/config");
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      }
    } catch (err) {
      console.error("Failed to fetch persistence configuration:", err);
    }
  };

  const fetchVersionedBackups = async () => {
    try {
      const response = await fetch("/api/persistence/backups");
      if (response.ok) {
        const data = await response.json();
        setVersionedBackups(data);
      }
    } catch (err) {
      console.error("Failed to fetch versioned backups:", err);
    }
  };

  const fetchStructuredLogs = async () => {
    try {
      const response = await fetch("/api/persistence/logs");
      if (response.ok) {
        const data = await response.json();
        setStructuredLogs(data);
      }
    } catch (err) {
      console.error("Failed to fetch structured logs:", err);
    }
  };

  // SSE stream registration for real-time non-polling updates (Phase 10)
  const setupProgressStream = () => {
    if (sseRef.current) {
      sseRef.current.close();
    }
    const sse = new EventSource("/api/persistence/progress/stream");
    sseRef.current = sse;

    sse.onmessage = (event) => {
      try {
        const progress: OperationProgress = JSON.parse(event.data);
        setCurrentProgress(progress);
        if (progress.stage === "complete" || progress.stage === "failed") {
          // Auto clear progress indicator after 5 seconds of completion
          setTimeout(() => {
            setCurrentProgress((cur) => cur?.operationId === progress.operationId ? null : cur);
          }, 5000);
        }
      } catch (err) {
        console.error("Failed to parse SSE progress update:", err);
      }
    };

    sse.onerror = () => {
      console.warn("Progress SSE channel disconnected. Reconnecting...");
    };
  };

  const saveConfiguration = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigSuccessMsg(null);
    try {
      const response = await fetch("/api/persistence/config", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-API-Key": apiKey
        },
        body: JSON.stringify(config)
      });
      if (response.ok) {
        setConfigSuccessMsg("Persistence Configuration successfully written and applied.");
        fetchPersistenceReport();
        setTimeout(() => setConfigSuccessMsg(null), 4000);
      } else {
        alert("Failed to write persistence configuration.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBackup = async () => {
    setDbActionLoading(true);
    setDbMsg(null);
    try {
      const response = await fetch("/api/persistence/backup", { 
        method: "POST",
        headers: { 
          "X-API-Key": apiKey
        }
      });
      const res = await response.json();
      if (response.ok && res.success) {
        setDbMsg({ success: true, text: `Manual backup complete: ${res.recordsProcessed} candidates persisted under health score ${res.manifest?.healthScore}%.` });
        fetchPersistenceReport();
        fetchVersionedBackups();
        fetchStructuredLogs();
        fetchLogs();
      } else {
        setDbMsg({ success: false, text: `Backup Failed: ${res.error || "Unknown server error"}` });
      }
    } catch (err: any) {
      setDbMsg({ success: false, text: `Client network timeout or error: ${err.message}` });
    } finally {
      setDbActionLoading(false);
    }
  };

  // Generate Restore Preview (Phase 7)
  const triggerRestorePreview = async () => {
    setDbActionLoading(true);
    setRestorePreview(null);
    try {
      const response = await fetch("/api/persistence/restore/preview");
      if (response.ok) {
        const data = await response.json();
        setRestorePreview(data);
        setShowRestorePreviewModal(true);
      } else {
        const res = await response.json();
        alert(`Restore Preview Failed: ${res.error || "No backup file found"}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDbActionLoading(false);
    }
  };

  const handleRestore = async () => {
    setShowRestorePreviewModal(false);
    setDbActionLoading(true);
    setDbMsg(null);
    try {
      const response = await fetch("/api/persistence/restore", { 
        method: "POST",
        headers: { 
          "X-API-Key": apiKey
        }
      });
      const res = await response.json();
      if (response.ok && res.success) {
        setDbMsg({ success: true, text: `Successfully restored Firestore. Recovered ${res.recordsProcessed} backup records.` });
        fetchPersistenceReport();
        fetchStructuredLogs();
        fetchLogs();
      } else {
        setDbMsg({ success: false, text: `Restore Failed: ${res.error || "Unknown server error"}` });
      }
    } catch (err: any) {
      setDbMsg({ success: false, text: `Client network timeout or error: ${err.message}` });
    } finally {
      setDbActionLoading(false);
    }
  };

  // Migration Trigger with Dry Run Toggle (Phase 8)
  const handleMigration = async () => {
    setDbActionLoading(true);
    setMigrationLogs([]);
    setMigrationResult(null);
    setDryRunAnalysis(null);
    setDbMsg(null);
    try {
      const response = await fetch("/api/persistence/migrate", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-API-Key": apiKey
        },
        body: JSON.stringify({ direction: migrationDirection, dryRun: dryRunMigration })
      });
      const data = await response.json();
      if (data.progressLogs) {
        setMigrationLogs(data.progressLogs);
      }
      if (response.ok && data.success) {
        if (dryRunMigration && data.dryRunAnalysis) {
          setDryRunAnalysis(data.dryRunAnalysis);
          setMigrationResult({
            success: true,
            text: `[Simulation OK] Dry run completed safely. Zero writes executed.`
          });
        } else {
          setMigrationResult({
            success: true,
            text: `Migration completed successfully. Moved ${data.recordsMigrated} records (Duplicates resolved: ${data.duplicatesFound}).`
          });
        }
        fetchPersistenceReport();
        fetchVersionedBackups();
        fetchStructuredLogs();
        fetchLogs();
      } else {
        setMigrationResult({
          success: false,
          text: `Migration failed: ${data.errors ? data.errors.join(", ") : "Unknown error"}`
        });
      }
    } catch (err: any) {
      setMigrationResult({ success: false, text: `Migration failed to execute: ${err.message}` });
    } finally {
      setDbActionLoading(false);
    }
  };

  // Secure Header-Authorized Backup File Downloader (Phase 15 security patch)
  const handleDownloadBackup = async (filename: string) => {
    setDbMsg(null);
    try {
      const response = await fetch(`/api/persistence/download?file=${encodeURIComponent(filename)}`, {
        method: "GET",
        headers: {
          "X-API-Key": apiKey
        }
      });
      if (!response.ok) {
        const errorText = await response.text();
        let errMsg = "Download failed";
        try {
          const parsed = JSON.parse(errorText);
          errMsg = parsed.error || errMsg;
        } catch {
          errMsg = errorText || errMsg;
        }
        throw new Error(errMsg);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setDbMsg({ success: false, text: `Backup download failed: ${err.message || String(err)}` });
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchStats();
    fetchLogs();
    fetchPersistenceReport();
    fetchPersistenceConfig();
    fetchVersionedBackups();
    fetchStructuredLogs();
    setupProgressStream();
    setLoading(false);

    // Live poller fallback for system load levels, rest is streaming
    const interval = setInterval(() => {
      fetchStats();
      fetchLogs();
      fetchPersistenceReport();
      fetchVersionedBackups();
      fetchStructuredLogs();
    }, 4000);

    return () => {
      clearInterval(interval);
      if (sseRef.current) {
        sseRef.current.close();
      }
    };
  }, []);

  return (
    <div className="space-y-6 pb-12" id="diagnostics-wrapper">
      {/* Module Title Header */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex justify-between items-center flex-wrap gap-4" id="diagnostics-header">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-sans font-semibold text-white tracking-tight flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              Kernel Diagnostics Panel
            </h2>
            <span className="bg-emerald-950 text-emerald-400 border border-emerald-900 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold animate-pulse">
              LIVE BROADCAST
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Real-time tracking of memory footprints, transaction queues, and autonomous scheduling.
          </p>
        </div>
        <button 
          onClick={() => {
            fetchStats();
            fetchLogs();
            fetchPersistenceReport();
            fetchVersionedBackups();
            fetchStructuredLogs();
          }}
          id="diagnostics-refresh-btn"
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white p-2.5 rounded-lg border border-slate-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Live Active Progress SSE Indicator (Phase 10) */}
      {currentProgress && (
        <div className="bg-blue-950/40 border border-blue-900/60 p-4 rounded-xl space-y-3" id="live-progress-bar">
          <div className="flex justify-between items-center text-xs font-mono">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400 animate-spin" />
              <span className="font-bold text-blue-300 uppercase">ACTIVE SSE STREAM: {currentProgress.operation.toUpperCase()}</span>
            </div>
            <span className="text-slate-400">ID: {currentProgress.operationId}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-slate-950 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${currentProgress.percentage}%` }}
              />
            </div>
            <span className="text-sm font-mono font-bold text-white shrink-0">{currentProgress.percentage}%</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[11px] font-mono text-slate-400">
            <p>Stage: <strong className="text-slate-200">{currentProgress.stage.toUpperCase()}</strong></p>
            <p>Target Node: <strong className="text-slate-200">{currentProgress.currentRecordName}</strong></p>
            <p>Elapsed Time: <strong className="text-slate-200">{currentProgress.elapsedTimeMs}ms</strong></p>
          </div>
        </div>
      )}

      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="diagnostics-metrics-grid">
          {/* CPU Load Card */}
          <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-3" id="metric-cpu-card">
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Host CPU Load</span>
              <Cpu className="w-4 h-4 text-blue-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-mono font-bold text-white">{metrics.cpuUsage}%</span>
              <span className="text-xs text-slate-500">of alloc quota</span>
            </div>
            {/* Visual Bar */}
            <div className="w-full bg-slate-950 rounded-full h-1.5" id="cpu-bar-bg">
              <div 
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-300" 
                style={{ width: `${metrics.cpuUsage}%` }}
                id="cpu-bar-fill"
              />
            </div>
          </div>

          {/* RAM Footprint */}
          <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-3" id="metric-ram-card">
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">RAM Pool Allocation</span>
              <HardDrive className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-mono font-bold text-white">{metrics.memoryUsage} MB</span>
              <span className="text-xs text-slate-500">active threads</span>
            </div>
            {/* Visual Bar */}
            <div className="w-full bg-slate-950 rounded-full h-1.5" id="ram-bar-bg">
              <div 
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300" 
                style={{ width: `${(metrics.memoryUsage / 256) * 100}%` }}
                id="ram-bar-fill"
              />
            </div>
          </div>

          {/* Core Latency */}
          <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-3" id="metric-latency-card">
            <div className="flex justify-between items-center">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">Router API Latency</span>
              <Globe className="w-4 h-4 text-purple-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-mono font-bold text-white">{metrics.latency} ms</span>
              <span className="text-xs text-slate-500">round-trip duration</span>
            </div>
            {/* Visual Bar */}
            <div className="w-full bg-slate-950 rounded-full h-1.5" id="latency-bar-bg">
              <div 
                className="bg-purple-500 h-1.5 rounded-full transition-all duration-300" 
                style={{ width: `${(metrics.latency / 120) * 100}%` }}
                id="latency-bar-fill"
              />
            </div>
          </div>
        </div>
      )}

      {/* API Integrations Directory */}
      <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-4" id="diagnostics-apis">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider font-sans">
          External Gateway APIs
        </h3>
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="api-status-grid">
            {Object.entries(metrics.apiStatus).map(([name, status]) => (
              <div key={name} id={`api-status-card-${name}`} className="bg-slate-950 p-3.5 rounded-lg border border-slate-850 flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-slate-300 capitalize">{name}</span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                  status === "online" 
                    ? "bg-emerald-950 text-emerald-400 border border-emerald-900" 
                    : status === "unconfigured" 
                    ? "bg-amber-950/40 text-amber-500 border border-amber-900/40"
                    : "bg-rose-950 text-rose-400 border border-rose-900"
                }`}>
                  {(status as string).toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ENTERPRISE PERSISTENCE MANAGEMENT DASHBOARD */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-6" id="persistence-admin-panel">
        <div className="flex justify-between items-center border-b border-slate-800 pb-4 flex-wrap gap-4">
          <div>
            <h3 className="text-lg font-sans font-semibold text-white tracking-tight flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-400" />
              Enterprise Zero-Trust Persistence Admin Console
            </h3>
            <p className="text-slate-400 text-xs mt-1">
              Active verification, status checks, backoffs, WAL journals, and automated backup scheduling.
            </p>
          </div>
          <button
            onClick={handleBackup}
            disabled={dbActionLoading}
            className="bg-blue-600 hover:bg-blue-500 text-white font-mono px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
          >
            <ShieldCheck className="w-4 h-4" />
            Trigger Instant Backup
          </button>
        </div>

        {/* API Key configuration input for high-impact actions */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4" id="persistence-api-key-config">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-300 font-mono flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
              Developer API Key Authorization (AZIZ_API_KEY)
            </span>
            <p className="text-slate-500 text-[11px]">
              High-impact persistence modifications (backups, restores, migrations, configurations) require authorization.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="password"
              placeholder="Enter AZIZ_API_KEY..."
              value={apiKey}
              onChange={(e) => {
                const val = e.target.value;
                setApiKey(val);
                localStorage.setItem("AZIZ_API_KEY", val);
              }}
              className="bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500 w-64"
            />
            {apiKey ? (
              <span className="text-[10px] bg-emerald-950/85 text-emerald-400 px-2 py-1 rounded border border-emerald-900/60 font-mono">
                Set (Local)
              </span>
            ) : (
              <span className="text-[10px] bg-amber-950/85 text-amber-400 px-2 py-1 rounded border border-amber-900/60 font-mono">
                Unset (Required)
              </span>
            )}
          </div>
        </div>

        {/* Database Status Cards Grid */}
        {healthReport ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="db-health-status-grids">
            {/* Primary Firestore Info */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3" id="db-firestore-info">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 font-mono flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-orange-500" />
                  Primary Store (Firestore)
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                  healthReport.firestore.connectivity
                    ? "bg-emerald-950 text-emerald-400 border border-emerald-900"
                    : "bg-rose-950 text-rose-400 border border-rose-900"
                }`}>
                  {healthReport.firestore.connectivity ? "ONLINE" : "OFFLINE"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="bg-slate-900/50 p-2.5 rounded border border-slate-850">
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">Record Count</span>
                  <span className="text-xl font-mono font-bold text-white">{healthReport.firestore.recordCount}</span>
                </div>
                <div className="bg-slate-900/50 p-2.5 rounded border border-slate-850">
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">Read/Write Check</span>
                  <span className={`text-xs font-mono font-bold block mt-1 ${healthReport.firestore.readWriteCapable ? "text-emerald-400" : "text-rose-400"}`}>
                    {healthReport.firestore.readWriteCapable ? "VERIFIED (OK)" : "FAILED"}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1 font-mono">
                <span>Latency Check:</span>
                <span className="text-slate-300 font-bold">{healthReport.firestore.latencyMs} ms</span>
              </div>
            </div>

            {/* Secondary SQLite Info */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3" id="db-sqlite-info">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 font-mono flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-emerald-400" />
                  Local Cache (SQLite WAL)
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                  healthReport.sqlite.integrityOk
                    ? "bg-emerald-950 text-emerald-400 border border-emerald-900"
                    : "bg-rose-950 text-rose-400 border border-rose-900"
                }`}>
                  {healthReport.sqlite.integrityOk ? "INTEGRITY PASS" : "INTEGRITY FAIL"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="bg-slate-900/50 p-2.5 rounded border border-slate-850">
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">SQLite Count</span>
                  <span className="text-xl font-mono font-bold text-white">{healthReport.sqlite.recordCount}</span>
                </div>
                <div className="bg-slate-900/50 p-2.5 rounded border border-slate-850">
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">Disk File Size</span>
                  <span className="text-xl font-mono font-bold text-white">{(healthReport.sqlite.fileSize / 1024).toFixed(1)} KB</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1 font-mono">
                <span>WAL journal status:</span>
                <span className="text-slate-300 font-bold">{healthReport.sqlite.walStatus.toUpperCase()}</span>
              </div>
            </div>

            {/* Versioned Backup Integrity Card (Phase 5 & 6) */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3" id="backup-health-summary">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 font-mono flex items-center gap-1.5">
                  <Archive className="w-4 h-4 text-blue-400" />
                  Backup Health Status
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                  healthReport.backup.healthStatus === "Healthy"
                    ? "bg-emerald-950 text-emerald-400 border border-emerald-900"
                    : healthReport.backup.healthStatus === "Warning"
                    ? "bg-amber-950/40 text-amber-500 border border-amber-900/40"
                    : "bg-rose-950 text-rose-400 border border-rose-900"
                }`}>
                  {healthReport.backup.healthStatus.toUpperCase()}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="bg-slate-900/50 p-2.5 rounded border border-slate-850">
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">Health Score</span>
                  <span className="text-xl font-mono font-bold text-white">{healthReport.backup.healthScore}%</span>
                </div>
                <div className="bg-slate-900/50 p-2.5 rounded border border-slate-850">
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">Backup Count</span>
                  <span className="text-xl font-mono font-bold text-white">{healthReport.backup.backupCount}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1 font-mono">
                <span>Age of Latest:</span>
                <span className="text-slate-300 font-bold">{healthReport.backup.backupAgeMinutes} min ago</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 text-center font-mono text-slate-500 text-xs">
            Loading real-time enterprise database health report...
          </div>
        )}

        {/* Global Warnings Panel (Zero-Trust Security Indicator) */}
        {healthReport && healthReport.warnings && healthReport.warnings.length > 0 && (
          <div className="bg-amber-950/20 border border-amber-900/40 p-4 rounded-xl flex items-start gap-3 text-xs font-mono text-amber-400">
            <ShieldAlert className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
            <div>
              <p className="font-bold uppercase mb-1">Zero-Trust Operational Anomalies Detected</p>
              <ul className="list-disc pl-4 space-y-1 text-amber-300/85">
                {healthReport.warnings.map((warn: string, i: number) => (
                  <li key={i}>{warn}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Action Triggers: Restore, and Consistency Analysis */}
        <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 space-y-4" id="db-action-panel">
          <div className="flex justify-between items-center border-b border-slate-850 pb-2">
            <span className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider">Disaster Recovery Actions</span>
            <span className="text-[10px] font-mono text-slate-500 font-bold">PREVIEW VERIFICATION ENFORCED</span>
          </div>

          <div className="flex flex-wrap gap-4" id="db-trigger-buttons">
            <button
              onClick={triggerRestorePreview}
              disabled={dbActionLoading}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4 text-orange-400" />
              Stage Restore & View Preview...
            </button>
          </div>

          {dbMsg && (
            <div id="db-msg-container" className={`p-3 rounded border text-xs font-mono leading-relaxed flex items-center gap-2 ${
              dbMsg.success ? "bg-emerald-950/20 border-emerald-900/30 text-emerald-400" : "bg-rose-950/20 border-rose-900/30 text-rose-400"
            }`}>
              {dbMsg.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>{dbMsg.text}</span>
            </div>
          )}

          {/* Deep Store-to-Store Comparison & Duplicate Detection Output */}
          {healthReport && healthReport.backup && (
            <div className="bg-slate-900/40 p-4 rounded-lg border border-slate-850/60 space-y-3" id="consistency-deep-dive">
              <h4 className="text-xs font-semibold text-slate-300 font-sans flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-blue-400" />
                Cross-Database Consistency & Duplicate Checks
              </h4>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono" id="consistency-metrics">
                <div className="p-2 bg-slate-950 rounded border border-slate-850">
                  <span className="text-[10px] text-slate-500 block">Identical Records</span>
                  <span className="text-sm font-bold text-emerald-400">{healthReport.backup.comparison.identicalCount}</span>
                </div>
                <div className="p-2 bg-slate-950 rounded border border-slate-850">
                  <span className="text-[10px] text-slate-500 block">Only in Primary</span>
                  <span className={`text-sm font-bold ${healthReport.backup.comparison.onlyInPrimary.length > 0 ? "text-amber-400" : "text-slate-400"}`}>
                    {healthReport.backup.comparison.onlyInPrimary.length}
                  </span>
                </div>
                <div className="p-2 bg-slate-950 rounded border border-slate-850">
                  <span className="text-[10px] text-slate-500 block">Mismatched Data</span>
                  <span className={`text-sm font-bold ${healthReport.backup.comparison.mismatchedData.length > 0 ? "text-rose-400" : "text-slate-400"}`}>
                    {healthReport.backup.comparison.mismatchedData.length}
                  </span>
                </div>
                <div className="p-2 bg-slate-950 rounded border border-slate-850">
                  <span className="text-[10px] text-slate-500 block">Duplicates Detected</span>
                  <span className={`text-sm font-bold ${healthReport.backup.duplicatesFound.ids.length > 0 || healthReport.backup.duplicatesFound.names.length > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    {healthReport.backup.duplicatesFound.ids.length + healthReport.backup.duplicatesFound.names.length}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Enterprise Scheduler & Storage Configurations Form (Phase 14, 1, 3, 16) */}
        <form onSubmit={saveConfiguration} className="bg-slate-950 p-5 rounded-xl border border-slate-850 space-y-4" id="config-panel">
          <div className="flex justify-between items-center border-b border-slate-850 pb-2">
            <span className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-blue-400" />
              Centralized Persistence Configuration Manager
            </span>
            <span className="text-[10px] font-mono text-slate-500">Phase 14 Engine Settings</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
            <div>
              <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Automatic Scheduler</label>
              <select
                value={config.schedulerEnabled ? "true" : "false"}
                onChange={(e) => setConfig({ ...config, schedulerEnabled: e.target.value === "true" })}
                className="bg-slate-900 border border-slate-800 rounded p-2 text-slate-200 outline-none w-full"
              >
                <option value="true">Daemon Enabled</option>
                <option value="false">Daemon Disabled</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Interval (Minutes)</label>
              <input
                type="number"
                value={config.backupIntervalMinutes}
                onChange={(e) => setConfig({ ...config, backupIntervalMinutes: parseInt(e.target.value) || 60 })}
                className="bg-slate-900 border border-slate-800 rounded p-2 text-slate-200 outline-none w-full"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Retention Limit</label>
              <input
                type="number"
                value={config.retentionCount}
                onChange={(e) => setConfig({ ...config, retentionCount: parseInt(e.target.value) || 10 })}
                className="bg-slate-900 border border-slate-800 rounded p-2 text-slate-200 outline-none w-full"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Gzip Compression</label>
              <select
                value={config.compressionEnabled ? "true" : "false"}
                onChange={(e) => setConfig({ ...config, compressionEnabled: e.target.value === "true" })}
                className="bg-slate-900 border border-slate-800 rounded p-2 text-slate-200 outline-none w-full"
              >
                <option value="true">Gzip Enabled (.sqlitedb.gz)</option>
                <option value="false">Uncompressed (.sqlitedb)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono px-4 py-2 rounded text-xs font-semibold transition-all"
            >
              Apply and Restart Scheduler
            </button>
          </div>

          {configSuccessMsg && (
            <div className="p-2.5 bg-emerald-950/25 border border-emerald-900/40 rounded text-xs font-mono text-emerald-400">
              {configSuccessMsg}
            </div>
          )}
        </form>

        {/* Versioned Backup Files List & Download Directory (Phase 2, 4, 15) */}
        <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 space-y-4" id="versioned-backups-list">
          <div className="flex justify-between items-center border-b border-slate-850 pb-2">
            <span className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Archive className="w-4 h-4 text-emerald-400" />
              Versioned Backup Repository Directory
            </span>
            <span className="text-[10px] font-mono text-slate-500 font-bold">SECURE PATH TRAVERSAL VERIFIED</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono text-slate-300">
              <thead>
                <tr className="border-b border-slate-900 text-[10px] uppercase text-slate-500">
                  <th className="py-2.5">File Name</th>
                  <th className="py-2.5">Created Date</th>
                  <th className="py-2.5">Records</th>
                  <th className="py-2.5">Size</th>
                  <th className="py-2.5">Health</th>
                  <th className="py-2.5">Status</th>
                  <th className="py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/50">
                {versionedBackups.map((b) => (
                  <tr key={b.dbFile} className="hover:bg-slate-900/30">
                    <td className="py-3 font-semibold text-slate-200">{b.dbFile}</td>
                    <td className="py-3 text-slate-400">{new Date(b.timestamp).toLocaleString()}</td>
                    <td className="py-3">{b.manifest ? b.manifest.sqliteRecordCount : "N/A"}</td>
                    <td className="py-3">{b.manifest ? (b.manifest.fileSize / 1024).toFixed(1) : "N/A"} KB</td>
                    <td className="py-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        b.manifest?.healthStatus === "Healthy" ? "text-emerald-400 bg-emerald-950/20" : "text-amber-400 bg-amber-950/20"
                      }`}>
                        {b.manifest ? `${b.manifest.healthScore}%` : "N/A"}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        b.manifest?.integrityStatus === "VALID" ? "text-emerald-400 bg-emerald-950/25" : "text-rose-400 bg-rose-950/25"
                      }`}>
                        {b.manifest ? b.manifest.integrityStatus : "N/A"}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleDownloadBackup(b.dbFile)}
                        className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2 py-1 rounded text-[10px] inline-flex items-center gap-1 text-slate-200 hover:text-white font-mono cursor-pointer"
                      >
                        <Download className="w-3 h-3" /> Download
                      </button>
                    </td>
                  </tr>
                ))}
                {versionedBackups.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-600">
                      No versioned local database backups detected on server.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* DATABASE TRANSFERS & MIGRATION ENGINE (Phase 8 Toggle DryRun) */}
        <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 space-y-4" id="db-migration-engine">
          <div className="flex justify-between items-center border-b border-slate-850 pb-2">
            <span className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <ArrowRightLeft className="w-4 h-4 text-purple-400" />
              Interactive Resumable Migration & Synchronization Engine
            </span>
            <span className="text-[10px] font-mono text-slate-500">Simulate Dry Runs Safely</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono" id="migration-controls">
            <div className="flex flex-col gap-1 w-full sm:w-auto">
              <label className="text-[10px] text-slate-500 block uppercase font-bold">Migration Direction</label>
              <select
                value={migrationDirection}
                onChange={(e: any) => setMigrationDirection(e.target.value)}
                id="select-migration-direction"
                className="bg-slate-900 border border-slate-800 rounded p-2 text-slate-200 outline-none focus:border-purple-500 w-full"
              >
                <option value="firestore-to-sqlite">Firestore Cloud ➔ Local SQLite Cache</option>
                <option value="sqlite-to-firestore">Local SQLite Cache ➔ Firestore Cloud</option>
              </select>
            </div>

            <div className="flex items-center gap-2 mt-4">
              <input
                type="checkbox"
                id="dry-run-chk"
                checked={dryRunMigration}
                onChange={(e) => setDryRunMigration(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-900 border-slate-800 text-purple-600 focus:ring-0 outline-none cursor-pointer"
              />
              <label htmlFor="dry-run-chk" className="text-slate-300 font-bold cursor-pointer select-none">
                Simulate Migration (dryRun = true)
              </label>
            </div>

            <button
              onClick={handleMigration}
              disabled={dbActionLoading}
              id="admin-btn-migrate"
              className="bg-purple-600 hover:bg-purple-500 text-white font-mono px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all mt-4 disabled:opacity-50"
            >
              <ArrowRightLeft className="w-4 h-4" />
              {dryRunMigration ? "Simulate Migration Analysis" : "Execute Migration"}
            </button>
          </div>

          {/* Dry Run Analysis Dashboard (Phase 8) */}
          {dryRunAnalysis && (
            <div className="bg-slate-900/60 p-4 border border-purple-900/50 rounded-lg text-xs font-mono space-y-3" id="dryrun-dashboard">
              <h4 className="font-bold text-purple-400 flex items-center gap-1.5 uppercase">
                <Info className="w-4 h-4" /> Migration Dry Run Simulation Report
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-slate-300">
                <div className="bg-slate-950 p-2.5 rounded border border-slate-850">
                  <span className="text-[9px] text-slate-500 block uppercase font-bold">Planned Migrates</span>
                  <span className="text-base font-bold text-slate-200">{dryRunAnalysis.recordsToMigrate}</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded border border-slate-850">
                  <span className="text-[9px] text-slate-500 block uppercase font-bold">Planned Writes</span>
                  <span className="text-base font-bold text-slate-200">{dryRunAnalysis.estimatedWrites}</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded border border-slate-850">
                  <span className="text-[9px] text-slate-500 block uppercase font-bold">Conflicts Found</span>
                  <span className="text-base font-bold text-amber-400">{dryRunAnalysis.conflictsCount}</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded border border-slate-850">
                  <span className="text-[9px] text-slate-500 block uppercase font-bold">Est. Duration</span>
                  <span className="text-base font-bold text-purple-400">{dryRunAnalysis.estimatedDurationMs}ms</span>
                </div>
              </div>

              {dryRunAnalysis.validationErrors && dryRunAnalysis.validationErrors.length > 0 && (
                <div className="bg-rose-950/20 p-3 rounded border border-rose-900/35 text-[11px] text-rose-300">
                  <p className="font-bold uppercase text-rose-400 flex items-center gap-1.5 mb-1">
                    <ShieldAlert className="w-4 h-4" /> Validation Warnings Raised
                  </p>
                  <ul className="list-disc pl-4 space-y-1">
                    {dryRunAnalysis.validationErrors.map((err: string, i: number) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Live Migration Progress Log */}
          {migrationLogs.length > 0 && (
            <div className="bg-slate-950 border border-slate-850 p-3.5 rounded-lg space-y-1.5 font-mono text-[11px]" id="migration-step-logs">
              <p className="text-slate-500 uppercase tracking-wide font-bold text-[10px] border-b border-slate-900 pb-1 flex items-center gap-1">
                <History className="w-3.5 h-3.5 text-purple-400" /> Live Migration Log Stream
              </p>
              <div className="max-h-[160px] overflow-y-auto space-y-1 text-slate-300">
                {migrationLogs.map((log, index) => (
                  <p key={index} id={`mig-log-${index}`}>{log}</p>
                ))}
              </div>
            </div>
          )}

          {migrationResult && (
            <div id="migration-result-msg" className={`p-3 rounded border text-xs font-mono leading-relaxed flex items-center gap-2 ${
              migrationResult.success ? "bg-purple-950/20 border-purple-900/30 text-purple-400" : "bg-rose-950/20 border-rose-900/30 text-rose-400"
            }`}>
              {migrationResult.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>{migrationResult.text}</span>
            </div>
          )}
        </div>
      </div>

      {/* Structured Logs Timeline Console (Phase 11) */}
      <div className="bg-slate-950 rounded-xl border border-slate-800 flex flex-col" id="diagnostics-logs">
        <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 rounded-t-xl flex justify-between items-center" id="logs-title-bar">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-blue-500" />
            <span className="font-mono text-xs font-semibold text-slate-200">
              structured-operation-timeline.log
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">Automatic updates</span>
        </div>
        <div className="p-4 max-h-[360px] overflow-y-auto space-y-3 font-mono text-xs" id="logs-container">
          {structuredLogs.map((log) => {
            const levelColors = {
              success: "text-emerald-400 border-emerald-950 bg-emerald-950/15",
              failure: "text-rose-400 border-rose-950 bg-rose-950/15",
              warning: "text-amber-400 border-amber-950 bg-amber-950/15",
              running: "text-blue-400 border-blue-950 bg-blue-950/15"
            };

            return (
              <div key={log.operationId} className={`p-3 rounded-lg border flex flex-col gap-1.5 ${levelColors[log.status || "success"]}`}>
                <div className="flex justify-between items-center flex-wrap gap-2 text-[11px]">
                  <span className="font-bold uppercase flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5" />
                    {log.operation.toUpperCase()}: {log.status.toUpperCase()}
                  </span>
                  <span className="text-slate-500">{new Date(log.timestamp).toLocaleString()}</span>
                </div>
                <p className="text-slate-300">
                  Processed <strong className="text-white">{log.recordsProcessed} records</strong> over <strong className="text-white">{log.durationMs}ms</strong> with <strong className="text-white">{log.retries} retries</strong>.
                </p>
                {log.errors.length > 0 && (
                  <p className="text-rose-300 text-[11px] leading-relaxed">
                    Error: {log.errors.join(", ")}
                  </p>
                )}
                {log.warnings.length > 0 && (
                  <p className="text-amber-300 text-[11px] leading-relaxed">
                    Warnings: {log.warnings.join(", ")}
                  </p>
                )}
                <div className="flex gap-4 text-[10px] text-slate-500 border-t border-slate-900 pt-1.5 mt-0.5">
                  <span>User: {log.user}</span>
                  <span>Environment: {log.environment}</span>
                  <span>OperationID: {log.operationId}</span>
                </div>
              </div>
            );
          })}
          {structuredLogs.length === 0 && (
            <div className="text-slate-600 text-center py-6">
              No structured operation logs stored on disk yet.
            </div>
          )}
        </div>
      </div>

      {/* Restore Preview Verification Modal (Phase 7 Verification) */}
      {showRestorePreviewModal && restorePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in" id="restore-preview-modal">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-xl w-full space-y-5 shadow-2xl">
            <div className="border-b border-slate-800 pb-3 flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-orange-500" />
              <div>
                <h3 className="text-md font-bold font-sans text-white">Stage Restore Preview Verification</h3>
                <p className="text-slate-500 text-[11px] font-mono">Zero-Trust Confirmation Required</p>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-lg border border-slate-850 grid grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <span className="text-[10px] uppercase text-slate-500 block">Backup Records</span>
                <span className="text-xl font-bold text-white">{restorePreview.backupRecordsCount}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-500 block">Current Firestore Records</span>
                <span className="text-xl font-bold text-white">{restorePreview.firestoreRecordsCount}</span>
              </div>
            </div>

            <div className="space-y-3 font-mono text-xs max-h-[220px] overflow-y-auto">
              <div className="flex justify-between border-b border-slate-850 pb-1.5">
                <span className="text-slate-400">Records to Overwrite:</span>
                <span className="font-bold text-amber-400">{restorePreview.recordsToOverwrite.length}</span>
              </div>
              <div className="flex justify-between border-b border-slate-850 pb-1.5">
                <span className="text-slate-400">New Records to Insert:</span>
                <span className="font-bold text-emerald-400">{restorePreview.recordsToInsert.length}</span>
              </div>
              <div className="flex justify-between border-b border-slate-850 pb-1.5">
                <span className="text-slate-400">Missing Records in Backup (Will stay in cloud):</span>
                <span className="font-bold text-purple-400">{restorePreview.missingRecords.length}</span>
              </div>
              <div className="flex justify-between border-b border-slate-850 pb-1.5">
                <span className="text-slate-400">Duplicate IDs Checked:</span>
                <span className={`font-bold ${restorePreview.duplicateIds.length > 0 ? "text-rose-400" : "text-slate-400"}`}>
                  {restorePreview.duplicateIds.length}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-850 pb-1.5">
                <span className="text-slate-400">Duplicate Names Checked:</span>
                <span className={`font-bold ${restorePreview.duplicateNames.length > 0 ? "text-rose-400" : "text-slate-400"}`}>
                  {restorePreview.duplicateNames.length}
                </span>
              </div>
            </div>

            <div className="bg-orange-950/20 border border-orange-900/40 p-3 rounded text-[11px] font-mono text-orange-400 leading-relaxed flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>CRITICAL:</strong> Nothing restores automatically. Confirming this action will overwrite matching Firestore records with SQLite backup state. Ensure integrity score of the backup file is valid.
              </span>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowRestorePreviewModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs px-4 py-2 rounded-lg transition-all"
              >
                Abort Operation
              </button>
              <button
                onClick={handleRestore}
                className="bg-orange-600 hover:bg-orange-500 text-white font-mono text-xs px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                CONFIRM RESTORE TRANSACTION
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
