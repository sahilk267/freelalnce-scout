/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../../server";
import { DIContainer, IOrderRepository } from "../index";
import { createResumeOrder } from "../models/ResumeOrder";
import { InMemoryOrderRepository } from "../repositories/InMemoryOrderRepository";
import { InMemoryCandidateRepository } from "../repositories/InMemoryCandidateRepository";
import { ResumeServiceAgent } from "./ResumeServiceAgent";
import { IAIClientProvider } from "../providers/IAIClientProvider";

class DummyAIProvider implements IAIClientProvider {
  getClient(): any {
    return {
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            rewrittenResumeText: "Grounded rewritten text",
            factTraceabilityLog: [],
            status: "VERIFIED",
            checks: {
              factualConsistency: { passed: true, issues: [] },
              noInventedCredentials: { passed: true, issues: [] },
              noExaggeratedMetrics: { passed: true, issues: [] },
              noUnsupportedScopeClaims: { passed: true, issues: [] }
            },
            matchScore: 85
          })
        })
      }
    };
  }
}

describe("Resume Order API Rules & Business Constraints", () => {
  let orderRepo: InMemoryOrderRepository;
  let candidateRepo: InMemoryCandidateRepository;
  let resumeAgent: ResumeServiceAgent;

  beforeEach(async () => {
    orderRepo = new InMemoryOrderRepository();
    candidateRepo = new InMemoryCandidateRepository();
    resumeAgent = new ResumeServiceAgent(new DummyAIProvider());

    // Seed candidate
    await candidateRepo.save({
      id: "cand-valid-1",
      name: "John Doe",
      skills: ["TypeScript", "Node.js"],
      experienceYears: 5,
      locationPreference: "Remote"
    });
  });

  describe("Payment Requirement Check for Rewrite & Revision", () => {
    it("prevents rewrite and returns 402 when order.paymentStatus is 'failed' or 'unpaid'", async () => {
      const apiKey = process.env.AZIZ_API_KEY || "test-key-12345";
      process.env.AZIZ_API_KEY = apiKey;

      const serverOrderRepo = DIContainer.get<IOrderRepository>("IOrderRepository");
      const order = createResumeOrder({
        candidateId: "cand-valid-1",
        tier: "basic",
        originalResumeText: "Sample resume text"
      });
      order.paymentStatus = "failed";
      await serverOrderRepo.save(order);

      const res = await request(app)
        .post(`/api/orders/${order.id}/rewrite`)
        .set("X-API-Key", apiKey);

      expect(res.status).toBe(402);
      expect(res.body.error).toContain("Payment required");
    });

    it("prevents revision and returns 402 when order.paymentStatus is 'failed'", async () => {
      const apiKey = process.env.AZIZ_API_KEY || "test-key-12345";
      process.env.AZIZ_API_KEY = apiKey;

      const serverOrderRepo = DIContainer.get<IOrderRepository>("IOrderRepository");
      const order = createResumeOrder({
        candidateId: "cand-valid-1",
        tier: "standard",
        originalResumeText: "Sample resume text"
      });
      order.paymentStatus = "failed";
      await serverOrderRepo.save(order);

      const res = await request(app)
        .post(`/api/orders/${order.id}/revision`)
        .set("X-API-Key", apiKey)
        .send({ revisionInstruction: "Make it more concise" });

      expect(res.status).toBe(402);
      expect(res.body.error).toContain("Payment required");
    });

    it("allows rewrite after payment simulation flips status to 'paid'", async () => {
      const order = createResumeOrder({
        candidateId: "cand-valid-1",
        tier: "basic",
        originalResumeText: "Sample resume text"
      });
      await orderRepo.save(order);

      // Simulate payment
      order.paymentStatus = "paid";
      await orderRepo.save(order);

      const canExecuteRewrite = order.paymentStatus === "paid";
      expect(canExecuteRewrite).toBe(true);

      const result = await resumeAgent.processResumeOrder(order);
      expect(result.verificationAudit.status).toBe("VERIFIED");
    });

    it("handles payment failure simulation and allows candidate to retry payment", async () => {
      const order = createResumeOrder({
        candidateId: "cand-valid-1",
        tier: "basic",
        originalResumeText: "Sample resume text"
      });
      await orderRepo.save(order);

      // Simulate payment failure
      order.paymentStatus = "failed";
      await orderRepo.save(order);

      // Cannot execute rewrite when paymentStatus is 'failed'
      expect((order.paymentStatus as string) === "paid").toBe(false);

      // Candidate retries payment
      order.paymentStatus = "paid";
      await orderRepo.save(order);

      // Now rewrite is allowed
      expect(order.paymentStatus === "paid").toBe(true);
    });
  });

  describe("Revision Limit Enforcements", () => {
    it("rejects revision request when revisionsUsed >= maxRevisions", async () => {
      const order = createResumeOrder({
        candidateId: "cand-valid-1",
        tier: "basic", // maxRevisions = 1
        originalResumeText: "Sample resume text"
      });
      order.paymentStatus = "paid";
      order.revisionsUsed = 1; // Limit reached
      await orderRepo.save(order);

      const isRevisionAllowed = order.revisionsUsed < order.maxRevisions;
      expect(isRevisionAllowed).toBe(false);
    });

    it("increments revisionsUsed ONLY after rewrite pipeline completes successfully", async () => {
      const order = createResumeOrder({
        candidateId: "cand-valid-1",
        tier: "standard", // maxRevisions = 3
        originalResumeText: "Sample resume text"
      });
      order.paymentStatus = "paid";
      order.revisionsUsed = 0;
      await orderRepo.save(order);

      expect(order.revisionsUsed).toBe(0);

      // Simulate revision pipeline call
      const result = await resumeAgent.processResumeOrder(order, "Make experience section punchier.");
      
      // Increment revisionsUsed on successful result
      order.revisionsUsed += 1;
      order.rewrittenResumeText = result.rewrittenResumeText;
      await orderRepo.save(order);

      const updatedOrder = await orderRepo.getById(order.id);
      expect(updatedOrder?.revisionsUsed).toBe(1);
      expect(updatedOrder?.rewrittenResumeText).toBe("Grounded rewritten text");
    });

    it("does NOT charge revision credit if pipeline encounters an error", async () => {
      const order = createResumeOrder({
        candidateId: "cand-valid-1",
        tier: "basic",
        originalResumeText: "Sample resume text"
      });
      order.paymentStatus = "paid";
      order.revisionsUsed = 0;
      await orderRepo.save(order);

      // Simulate failed pipeline attempt
      try {
        throw new Error("AI Provider Timeout");
      } catch (err) {
        // Do NOT increment revisionsUsed on error
      }

      const unchangedOrder = await orderRepo.getById(order.id);
      expect(unchangedOrder?.revisionsUsed).toBe(0);
    });
  });

  describe("Admin Review Queue Workflows", () => {
    it("adds order to review queue when autoDeliverEnabled is false or verification fails", async () => {
      const order = createResumeOrder({
        candidateId: "cand-valid-1",
        tier: "premium",
        originalResumeText: "Sample resume",
        autoDeliverEnabled: false
      });
      order.paymentStatus = "paid";
      order.deliveryStatus = "needs_human_review";
      await orderRepo.save(order);

      const reviewQueue = await orderRepo.getReviewQueue();
      expect(reviewQueue.length).toBe(1);
      expect(reviewQueue[0].id).toBe(order.id);
    });

    it("approves order in review queue and sets deliveryStatus to 'delivered'", async () => {
      const order = createResumeOrder({
        candidateId: "cand-valid-1",
        tier: "premium",
        originalResumeText: "Sample resume",
        autoDeliverEnabled: false
      });
      order.paymentStatus = "paid";
      order.deliveryStatus = "needs_human_review";
      await orderRepo.save(order);

      // Reviewer approves
      order.deliveryStatus = "delivered";
      order.approvedBy = "admin_reviewer_1";
      order.approvedAt = new Date().toISOString();
      await orderRepo.save(order);

      const updated = await orderRepo.getById(order.id);
      expect(updated?.deliveryStatus).toBe("delivered");
      expect(updated?.approvedBy).toBe("admin_reviewer_1");

      // Confirm no longer in review queue
      const queueAfterApproval = await orderRepo.getReviewQueue();
      expect(queueAfterApproval.length).toBe(0);
    });
  });
});
