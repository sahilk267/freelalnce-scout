/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface NormalizedFreelanceProject {
  id: string; // E.g., "freelancer-123", "upwork-abc"
  title: string;
  description: string;
  skills: string[];
  budget: string;
  currency: string;
  hourlyOrFixed: "hourly" | "fixed";
  clientRating: number | null;
  clientReviews: number | null;
  clientSpending: string | null;
  location: string;
  proposalCount: number;
  urgency: "high" | "medium" | "low";
  source: string;
  projectUrl: string;
  scrapeTimestamp: string;
  score?: number; // Calculated score
  scoreReasons?: string[]; // Score breakdowns
  sourceStatus?: "live" | "mock" | "error";
  sourceStatusReason?: "blocked_403" | "timeout" | "rate_limited" | "parse_failed" | "unauthorized_401" | "network_error" | "official_api_active" | string;
}

export type ProposalTone = "professional" | "friendly" | "premium" | "concise";
export type ProposalStatus = "Pending Approval" | "Approved" | "Submitted" | "Rejected";

export interface FreelanceProposal {
  id: string;
  projectId: string;
  title: string;
  proposalText: string;
  tone: ProposalTone;
  status: ProposalStatus;
  createdAt: string;
  submittedAt: string | null;
}

export interface FreelancerExecutionRecord {
  id?: number;
  timestamp: string;
  status: "success" | "failure";
  projectsFound: number;
  proposalsGenerated: number;
  errors: string | null;
  durationMs: number;
}

export interface FreelancerLog {
  id?: number;
  timestamp: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
}

export interface FreelancerAgentState {
  intervalMinutes: number; // 5, 15, 30, 60
  isEnabled: boolean;
  lastRun: string | null;
  nextRun: string | null;
}

export interface FreelancerNotification {
  id: string;
  type: "MATCH" | "APPROVAL_REQUIRED" | "SUBMISSION" | "SYSTEM" | "ERROR";
  message: string;
  projectId?: string | null;
  proposalId?: string | null;
  read: boolean;
  createdAt: string;
}

export interface FreelancerConfig {
  mode: "development" | "production";
  timeoutMs: number;
  retryCount: number;
  providers: {
    Upwork: boolean;
    Freelancer: boolean;
    PeoplePerHour: boolean;
    Guru: boolean;
    FiverrPro: boolean;
  };
  proposalTemplate: string;
  aiModel: string;
  databasePath: string;
  schedulerInterval: number; // minutes
  cronExpression: string;
  featureFlags: {
    autoSubmit: boolean;
    highValueNotifications: boolean;
  };
}

export interface FreelancerDashboardData {
  status: "Running" | "Idle" | "Paused" | "Error";
  currentTask: string | null;
  projectsFoundTodayCount: number;
  projectsAwaitingApprovalCount: number;
  generatedProposalsCount: number;
  successMetrics: {
    totalScraped: number;
    totalProposals: number;
    totalApproved: number;
    totalSubmitted: number;
  };
  lastExecution: string | null;
  errors: string[];
  upcomingSchedule: string | null;
}
