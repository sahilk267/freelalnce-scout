/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ModuleId =
  | "studio"
  | "jsi"
  | "freelance"
  | "companies"
  | "ats"
  | "agents"
  | "memory"
  | "diagnostics"
  | "terminal"
  | "integrations"
  | "users"
  | "pricing";

export interface SystemModule {
  id: ModuleId;
  name: string;
  description: string;
  icon: string;
  status: "active" | "error" | "offline" | "standby";
}

export interface SystemLog {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "success" | "debug";
  module: ModuleId | "kernel" | "server" | "api" | "security";
  message: string;
}

export interface AIProviderStatus {
  id: string;
  name: string;
  consecutiveFailures: number;
  totalRequests: number;
  totalFailures: number;
  isCoolingDown: boolean;
  cooldownRemainingMs: number;
}

export interface AIProviderDiagnosticsState {
  activeProvider: string;
  primaryProvider: string;
  fallbackProvider: string | null;
  failoverThreshold: number;
  cooldownPeriodMs: number;
  isFailoverActive: boolean;
  providers: Record<string, AIProviderStatus>;
}

export interface DiagnosticMetrics {
  cpuUsage: number;
  memoryUsage: number; // in MB
  latency: number; // in ms
  apiStatus: {
    gemini: "online" | "offline" | "unconfigured";
    anthropic?: "online" | "offline" | "unconfigured";
    aiActiveProvider?: string;
    smtp: "online" | "offline" | "unconfigured";
    telegram: "online" | "offline" | "unconfigured";
    gmail: "online" | "offline" | "unconfigured";
    [key: string]: any;
  };
  activeAgents: number;
  uptime: number; // in seconds
}

export interface JobRecord {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  source: string;
  timestamp: string;
  verification: "verified" | "unverified" | "pending";
  confidence: number; // 0 to 100
  originalUrl: string;
  duplicateStatus: "original" | "duplicate";
  skills: string[];
}

export interface FreelanceProject {
  id: string;
  title: string;
  platform: string; // e.g. Upwork, Freelancer, Toptal
  budget: string;
  postedTime: string;
  verification: "verified" | "unverified";
  confidence: number; // 0 to 100
  originalUrl: string;
  skills: string[];
  description: string;
  sourceStatus?: "live" | "mock" | "error";
  sourceStatusReason?: string;
}

export interface MemoryEntry {
  id: string;
  category: "user_preference" | "system_rule" | "knowledge" | "context";
  content: string;
  timestamp: string;
  embeddingStatus: "indexed" | "pending" | "failed";
}

export type FreelanceCategory =
  | "Writing & Content"
  | "Design & Creative"
  | "Virtual Assistant & Tasks"
  | "Digital Marketing"
  | "Video Editing & Media"
  | "Tech & Software"
  | "Aaditech Solution – IT & Infrastructure";

export interface CompanyProfile {
  id: string;
  name: string;
  website: string;
  description?: string;
  isPrimary?: boolean;
  categories: FreelanceCategory[];
  targetKeywords: string[];
  negativeKeywords: string[];
  physicalLocations: string[]; // e.g. ["Mumbai", "Navi Mumbai", "Thane"]
  allowRemote: boolean;
  
  // Notification / Delivery Channels Configuration
  telegramEnabled: boolean;
  telegramChatId: string; // e.g. "-1003793331993"
  telegramTopicId?: string;

  hostingerEnabled: boolean;
  hostingerEmail: string; // e.g. "contact@aaditechs.in"

  gmailEnabled: boolean;
  gmailEmail: string; // e.g. "sahil.k00267@gmail.com"

  email?: string; // backward compatibility
  status: "active" | "paused";
  leadsCount?: number;
  lastScoutedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TerminalLine {
  id: string;
  type: "input" | "output" | "error" | "system";
  text: string;
  timestamp: string;
}
