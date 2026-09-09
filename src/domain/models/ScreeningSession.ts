/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from "crypto";

export function generateSessionToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

export type SessionStatus = 
  | "in_progress" 
  | "evaluated" 
  | "needs_human_review" 
  | "approved" 
  | "rejected" 
  | "expired" 
  | "failed";

export type Recommendation = "STRONG_HIRE" | "HIRE" | "POSSIBLE_HIRE" | "NO_HIRE";

export interface ChatMessage {
  id: string;
  sender: "assistant" | "candidate";
  content: string;
  timestamp: string;
}

export interface EvaluationCriterion {
  requirement: string;
  score: number; // 0-100
  reasoning: string;
  candidateEvidence: string;
}

export interface ScreeningEvaluation {
  overallScore: number; // 0-100
  recommendation: Recommendation;
  criteriaEvaluations: EvaluationCriterion[];
  strengths: string[];
  concerns: string[];
  auditNotes: string;
  verificationAudit?: {
    status: "PASSED" | "HALLUCINATION_DETECTED";
    auditNotes: string;
    flags: string[];
  };
}

export interface HumanReview {
  approvedBy?: string;
  approvedAt?: string;
  action: "approve" | "reject" | "override";
  notes?: string;
}

export interface ScreeningSession {
  id: string;
  candidateId: string; // Foreign key referencing ICandidateRepository
  jobId: string; // Foreign key referencing Job
  jobTitle: string;
  jobRequirements: string[];
  sessionToken: string; // Secret token for candidate-facing auth
  status: SessionStatus;
  messages: ChatMessage[];
  evaluation?: ScreeningEvaluation;
  humanReview?: HumanReview;
  createdAt: string;
  updatedAt: string;
  lastInteractionAt: string;
  expiresAt: string; // 24h TTL
}

/**
 * Creates a new ScreeningSession instance with 24h TTL and initial greeting message
 */
export function createScreeningSession(params: {
  candidateId: string;
  jobId: string;
  jobTitle: string;
  jobRequirements: string[];
  customInitialMessage?: string;
  ttlHours?: number;
}): ScreeningSession {
  const now = new Date();
  const ttlHours = params.ttlHours ?? 24;
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString();
  const sessionId = `scr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
  const nowIso = now.toISOString();

  const initialGreeting: ChatMessage = {
    id: `msg_${Date.now()}_0`,
    sender: "assistant",
    content: params.customInitialMessage || 
      `Hello! Welcome to the preliminary screening for the ${params.jobTitle} position. I will be asking you a few questions regarding your experience as it relates to our specific job requirements. To get started, could you briefly introduce yourself and share your experience related to: ${params.jobRequirements.slice(0, 3).join(", ")}?`,
    timestamp: nowIso
  };

  return {
    id: sessionId,
    candidateId: params.candidateId,
    jobId: params.jobId,
    jobTitle: params.jobTitle,
    jobRequirements: params.jobRequirements,
    sessionToken: generateSessionToken(),
    status: "in_progress",
    messages: [initialGreeting],
    createdAt: nowIso,
    updatedAt: nowIso,
    lastInteractionAt: nowIso,
    expiresAt
  };
}

/**
 * Lazy check to verify if a session is expired based on current timestamp
 */
export function isSessionExpired(session: ScreeningSession): boolean {
  if (session.status === "expired") return true;
  const now = new Date().getTime();
  const exp = new Date(session.expiresAt).getTime();
  return now > exp;
}
