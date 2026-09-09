/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ServiceTier = "basic" | "standard" | "premium";

export type PaymentStatus = "unpaid" | "paid" | "failed" | "refunded";

export type DeliveryStatus = 
  | "draft" 
  | "rewriting" 
  | "verified" // Note: Reserved for manual/external compliance audit state; processResumeOrder routes verified orders straight to 'delivered' (if autoDeliverEnabled) or 'needs_human_review'
  | "needs_human_review" 
  | "delivered" 
  | "failed";

export interface FactTraceabilityItem {
  bulletText: string;
  sourceReference: string;
  reasoning: string;
}

export interface VerificationCheckResults {
  ungroundedCompaniesOrRoles: boolean;
  ungroundedMetrics: boolean;
  ungroundedSkillsOrCertifications: boolean;
  ungroundedSeniorityOrScope: boolean;
}

export interface VerificationResult {
  status: "VERIFIED" | "HALLUCINATION_DETECTED";
  auditSummary: string;
  flaggedItems: Array<{
    bulletText: string;
    failureReason: string;
  }>;
  checkResults: VerificationCheckResults;
}

export interface ResumeOrder {
  id: string;
  candidateId: string; // References canonical Candidate record in ICandidateRepository
  tier: ServiceTier;
  priceINR: number;
  maxRevisions: number;
  revisionsUsed: number;
  paymentStatus: PaymentStatus;
  deliveryStatus: DeliveryStatus;
  autoDeliverEnabled: boolean; // Config flag, default false (requires human click to approve even when VERIFIED)
  originalResumeText: string;
  targetJobDescription?: string;
  rewrittenResumeText?: string;
  factTraceabilityLog?: FactTraceabilityItem[];
  beforeAtsScore?: number;
  afterAtsScore?: number;
  verificationAudit?: VerificationResult;
  verificationAttempts?: number;
  revisionInstructions?: string[];
  approvedBy?: string; // Audit field for human reviewer
  approvedAt?: string; // Audit field timestamp
  createdAt: string;
  updatedAt: string;
}

export function getTierPricing(tier: ServiceTier): { priceINR: number; maxRevisions: number } {
  switch (tier) {
    case "basic":
      return { priceINR: 300, maxRevisions: 1 };
    case "standard":
      return { priceINR: 800, maxRevisions: 2 };
    case "premium":
      return { priceINR: 1500, maxRevisions: 3 };
    default:
      return { priceINR: 300, maxRevisions: 1 };
  }
}

export function createResumeOrder(data: {
  id?: string;
  candidateId: string;
  tier: ServiceTier;
  originalResumeText: string;
  targetJobDescription?: string;
  autoDeliverEnabled?: boolean;
}): ResumeOrder {
  const pricing = getTierPricing(data.tier);
  const now = new Date().toISOString();

  return {
    id: data.id || `ord-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    candidateId: data.candidateId,
    tier: data.tier,
    priceINR: pricing.priceINR,
    maxRevisions: pricing.maxRevisions,
    revisionsUsed: 0,
    paymentStatus: "unpaid",
    deliveryStatus: "draft",
    autoDeliverEnabled: data.autoDeliverEnabled ?? false, // Default false: requires human sign-off
    originalResumeText: data.originalResumeText.trim(),
    targetJobDescription: data.targetJobDescription?.trim(),
    createdAt: now,
    updatedAt: now,
  };
}
