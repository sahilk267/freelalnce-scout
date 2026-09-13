/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DEFAULT_PRICING_TIERS } from "./PricingTier";

export type ServiceTier = "basic" | "standard" | "premium";

export type PaymentStatus = "unpaid" | "paid" | "failed" | "refunded" | "needs_human_review";

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
  priceAtOrderTime?: number; // Snapshot of price at the time order was created
  priceMinorUnits?: number; // Snapshot of price in minor units (paise/cents)
  currency?: string; // Currency snapshot (e.g. "INR")
  razorpayOrderId?: string; // Razorpay Order ID created for checkout
  razorpayPaymentId?: string; // Razorpay Payment ID captured via webhook
  paymentFailureReason?: string; // Stored reason when payment.failed event received
  paymentDiscrepancy?: string; // Recorded amount mismatch details when needs_human_review triggered
  refundId?: string; // Razorpay refund ID if order is refunded
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

export function getTierPricing(tier: ServiceTier): { priceINR: number; maxRevisions: number; priceMinorUnits: number; currency: string } {
  const match = DEFAULT_PRICING_TIERS.find((t) => t.tierId === tier) || DEFAULT_PRICING_TIERS[0];
  return {
    priceINR: Math.round(match.priceMinorUnits / 100),
    maxRevisions: match.revisionLimit,
    priceMinorUnits: match.priceMinorUnits,
    currency: match.currency
  };
}

export function createResumeOrder(data: {
  id?: string;
  candidateId: string;
  tier: ServiceTier;
  originalResumeText: string;
  targetJobDescription?: string;
  autoDeliverEnabled?: boolean;
  priceINR?: number;
  priceAtOrderTime?: number;
  priceMinorUnits?: number;
  currency?: string;
  maxRevisions?: number;
}): ResumeOrder {
  const defaultPricing = getTierPricing(data.tier);
  const now = new Date().toISOString();
  const finalPriceINR = data.priceINR ?? data.priceAtOrderTime ?? defaultPricing.priceINR;
  const finalPriceMinorUnits = data.priceMinorUnits ?? (data.priceAtOrderTime ? data.priceAtOrderTime * 100 : finalPriceINR * 100);
  const finalCurrency = data.currency || "INR";
  const finalMaxRevisions = data.maxRevisions ?? defaultPricing.maxRevisions;

  return {
    id: data.id || `ord-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    candidateId: data.candidateId,
    tier: data.tier,
    priceINR: finalPriceINR,
    priceAtOrderTime: finalPriceINR,
    priceMinorUnits: finalPriceMinorUnits,
    currency: finalCurrency,
    maxRevisions: finalMaxRevisions,
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
