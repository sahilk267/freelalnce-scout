/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from "vitest";
import { 
  createResumeOrder, 
  getTierPricing 
} from "../models/ResumeOrder";
import { InMemoryOrderRepository } from "../repositories/InMemoryOrderRepository";
import { SQLiteOrderRepository } from "../repositories/SQLiteOrderRepository";
import { ResumeServiceAgent } from "./ResumeServiceAgent";
import { IAIClientProvider } from "../providers/IAIClientProvider";

// Mock AI Provider that returns predictable JSON responses
class MockAIClientProvider implements IAIClientProvider {
  public mockRewriteText: string = JSON.stringify({
    rewrittenResumeText: "Professional Software Engineer with 5 years experience at Acme Corp.",
    factTraceabilityLog: [
      {
        rewrittenBullet: "Engineered scalable microservices at Acme Corp.",
        originalSourceReference: "Built backend services at Acme Corp.",
        confidenceScore: 0.98
      }
    ]
  });

  public mockVerifyText: string = JSON.stringify({
    status: "VERIFIED",
    checks: {
      factualConsistency: { passed: true, issues: [] },
      noInventedCredentials: { passed: true, issues: [] },
      noExaggeratedMetrics: { passed: true, issues: [] },
      noUnsupportedScopeClaims: { passed: true, issues: [] }
    },
    auditNotes: "All claims verified against source resume."
  });

  public mockAtsBefore: string = JSON.stringify({ matchScore: 62 });
  public mockAtsAfter: string = JSON.stringify({ matchScore: 88 });

  public callCount = 0;

  getClient(): any {
    return {
      models: {
        generateContent: async (args: any) => {
          this.callCount++;
          const contents = args.contents || "";

          // Pass 2 Verifier prompt
          if (contents.includes("Compliance & Fact-Verification Auditor") || contents.includes("FACTUAL GROUNDING AUDITOR")) {
            return { text: this.mockVerifyText };
          }

          // ATS Scoring prompt
          if (contents.includes("ATS evaluation") || contents.includes("ATS Evaluation Matrix")) {
            if (this.callCount % 2 === 1) {
              return { text: this.mockAtsBefore };
            }
            return { text: this.mockAtsAfter };
          }

          // Pass 1 Rewrite prompt
          return { text: this.mockRewriteText };
        }
      }
    };
  }
}

describe("ResumeServiceAgent & Order Model", () => {
  let orderRepo: InMemoryOrderRepository;
  let sqliteOrderRepo: SQLiteOrderRepository;
  let mockAIProvider: MockAIClientProvider;
  let resumeAgent: ResumeServiceAgent;

  beforeEach(() => {
    orderRepo = new InMemoryOrderRepository();
    sqliteOrderRepo = new SQLiteOrderRepository(":memory:");
    mockAIProvider = new MockAIClientProvider();
    resumeAgent = new ResumeServiceAgent(mockAIProvider);
  });

  describe("Order Model & Tier Rules", () => {
    it("correctly assigns price, maxRevisions, and defaults for Basic tier", () => {
      const order = createResumeOrder({
        candidateId: "cand-123",
        tier: "basic",
        originalResumeText: "Software Developer with React skills."
      });

      expect(order.tier).toBe("basic");
      expect(order.priceINR).toBe(300);
      expect(order.maxRevisions).toBe(1);
      expect(order.revisionsUsed).toBe(0);
      expect(order.paymentStatus).toBe("unpaid");
      expect(order.deliveryStatus).toBe("draft");
      expect(order.autoDeliverEnabled).toBe(false);
    });

    it("correctly assigns price and maxRevisions for Standard and Premium tiers", () => {
      const stdOrder = createResumeOrder({ candidateId: "c1", tier: "standard", originalResumeText: "text" });
      expect(stdOrder.priceINR).toBe(800);
      expect(stdOrder.maxRevisions).toBe(2);

      const premOrder = createResumeOrder({ candidateId: "c2", tier: "premium", originalResumeText: "text" });
      expect(premOrder.priceINR).toBe(1500);
      expect(premOrder.maxRevisions).toBe(3);
    });

    it("tier pricing helper returns correct details", () => {
      const basicInfo = getTierPricing("basic");
      expect(basicInfo.priceINR).toBe(300);
      expect(basicInfo.maxRevisions).toBe(1);
    });
  });

  describe("ResumeServiceAgent Processing Pipeline", () => {
    it("routes VERIFIED rewrite to needs_human_review when autoDeliverEnabled is false", async () => {
      const order = createResumeOrder({
        candidateId: "cand-101",
        tier: "standard",
        originalResumeText: "Built Node.js apps at TechCorp.",
        autoDeliverEnabled: false
      });
      order.paymentStatus = "paid";

      const result = await resumeAgent.processResumeOrder(order);

      expect(result.verificationAudit.status).toBe("VERIFIED");
      expect(result.deliveryStatus).toBe("needs_human_review");
      expect(result.beforeAtsScore).toBeGreaterThan(0);
      expect(result.afterAtsScore).toBeGreaterThan(0);
      expect(result.factTraceabilityLog.length).toBeGreaterThan(0);
    });

    it("routes VERIFIED rewrite directly to verified when autoDeliverEnabled is true", async () => {
      const order = createResumeOrder({
        candidateId: "cand-102",
        tier: "premium",
        originalResumeText: "Built Node.js apps at TechCorp.",
        autoDeliverEnabled: true
      });
      order.paymentStatus = "paid";

      const result = await resumeAgent.processResumeOrder(order);

      expect(result.verificationAudit.status).toBe("VERIFIED");
      expect(result.deliveryStatus).toBe("delivered");
    });

    it("handles Pass 2 verification failure, retries up to 3 attempts, terminates loop, and surfaces as needs_human_review", async () => {
      let pass1Calls = 0;
      let pass2Calls = 0;

      class FailingAIProvider implements IAIClientProvider {
        getClient(): any {
          return {
            models: {
              generateContent: async (args: any) => {
                const contents = args.contents || "";

                if (contents.includes("Compliance & Fact-Verification Auditor")) {
                  pass2Calls++;
                  return {
                    text: JSON.stringify({
                      status: "HALLUCINATION_DETECTED",
                      checkResults: {
                        ungroundedCompaniesOrRoles: true,
                        ungroundedMetrics: true,
                        ungroundedSkillsOrCertifications: false,
                        ungroundedSeniorityOrScope: false
                      },
                      flaggedItems: [
                        { bulletText: "Invented company Google", failureReason: "Company not in source" }
                      ],
                      auditNotes: "Hallucinated company name and inflated metrics."
                    })
                  };
                }

                if (contents.includes("Evaluate the following resume text") || contents.includes('{"score": number}')) {
                  return { text: JSON.stringify({ score: 80 }) };
                }

                if (contents.includes("STRICT GROUNDING & TRUTH RULES") || contents.includes("expert ATS Resume Optimization Specialist")) {
                  pass1Calls++;
                  return {
                    text: JSON.stringify({
                      rewrittenResumeText: "Attempted rewrite",
                      factTraceabilityLog: [{ bulletText: "Bullet 1", sourceReference: "Source 1", reasoning: "Reason" }]
                    })
                  };
                }
              }
            }
          };
        }
      }

      const failingProvider = new FailingAIProvider();
      const agent = new ResumeServiceAgent(failingProvider);

      const order = createResumeOrder({
        candidateId: "cand-103",
        tier: "basic",
        originalResumeText: "Software Engineer at startup.",
        autoDeliverEnabled: true
      });
      order.paymentStatus = "paid";

      const result = await agent.processResumeOrder(order);

      // Verify loop executed exactly 3 times (1 initial + 2 retries) and terminated (no 4th attempt)
      expect(pass1Calls).toBe(3);
      expect(pass2Calls).toBe(3);
      expect(result.verificationAttempts).toBe(3);
      expect(result.verificationAudit.status).toBe("HALLUCINATION_DETECTED");
      expect(result.deliveryStatus).toBe("needs_human_review");
    });

    it("retries Pass 1 when initial Pass 2 verification fails, and succeeds if retry verification passes", async () => {
      let verifyAttempt = 0;
      class RetryingAIProvider implements IAIClientProvider {
        public pass1Calls = 0;
        public pass2Calls = 0;

        getClient(): any {
          return {
            models: {
              generateContent: async (args: any) => {
                const contents = args.contents || "";

                if (contents.includes("Compliance & Fact-Verification Auditor")) {
                  this.pass2Calls++;
                  verifyAttempt++;
                  if (verifyAttempt === 1) {
                    // Attempt 1 fails verification
                    return {
                      text: JSON.stringify({
                        status: "HALLUCINATION_DETECTED",
                        checkResults: { ungroundedCompaniesOrRoles: true, ungroundedMetrics: false, ungroundedSkillsOrCertifications: false, ungroundedSeniorityOrScope: false },
                        flaggedItems: [{ bulletText: "Senior VP at Google", failureReason: "Not in original resume" }],
                        auditNotes: "Invented role"
                      })
                    };
                  } else {
                    // Attempt 2 succeeds verification
                    return {
                      text: JSON.stringify({
                        status: "VERIFIED",
                        checkResults: { ungroundedCompaniesOrRoles: false, ungroundedMetrics: false, ungroundedSkillsOrCertifications: false, ungroundedSeniorityOrScope: false },
                        flaggedItems: [],
                        auditNotes: "Verified on retry"
                      })
                    };
                  }
                }

                if (contents.includes("Evaluate the following resume text") || contents.includes('{"score": number}')) {
                  return { text: JSON.stringify({ score: 80 }) };
                }

                if (contents.includes("STRICT GROUNDING & TRUTH RULES") || contents.includes("expert ATS Resume Optimization Specialist")) {
                  this.pass1Calls++;
                  return {
                    text: JSON.stringify({
                      rewrittenResumeText: "Grounded resume rewrite after feedback",
                      factTraceabilityLog: [{ bulletText: "Bullet 1", sourceReference: "Source 1", reasoning: "Corrected" }]
                    })
                  };
                }
              }
            }
          };
        }
      }

      const retryingProvider = new RetryingAIProvider();
      const retryingAgent = new ResumeServiceAgent(retryingProvider);

      const order = createResumeOrder({
        candidateId: "cand-104",
        tier: "standard",
        originalResumeText: "Software Engineer at Acme Corp.",
        autoDeliverEnabled: true
      });
      order.paymentStatus = "paid";

      const result = await retryingAgent.processResumeOrder(order);

      // Verify that retry happened: Pass 1 was called twice (initial + 1 retry)
      expect(retryingProvider.pass1Calls).toBe(2);
      expect(retryingProvider.pass2Calls).toBe(2);
      expect(result.verificationAudit.status).toBe("VERIFIED");
      expect(result.deliveryStatus).toBe("delivered");
    });
  });

  describe("Repository Persistence (InMemory & SQLite)", () => {
    it("persists and retrieves order in InMemoryOrderRepository", async () => {
      const order = createResumeOrder({
        candidateId: "cand-201",
        tier: "standard",
        originalResumeText: "Resume content"
      });

      await orderRepo.save(order);
      const fetched = await orderRepo.getById(order.id);

      expect(fetched).not.toBeNull();
      expect(fetched?.candidateId).toBe("cand-201");
      expect(fetched?.tier).toBe("standard");

      const byCandidate = await orderRepo.getByCandidateId("cand-201");
      expect(byCandidate.length).toBe(1);
    });

    it("persists and retrieves order in SQLiteOrderRepository", async () => {
      const order = createResumeOrder({
        candidateId: "cand-202",
        tier: "premium",
        originalResumeText: "SQLite test resume text"
      });
      order.paymentStatus = "paid";
      order.deliveryStatus = "needs_human_review";

      await sqliteOrderRepo.save(order);
      const fetched = await sqliteOrderRepo.getById(order.id);

      expect(fetched).not.toBeNull();
      expect(fetched?.id).toBe(order.id);
      expect(fetched?.paymentStatus).toBe("paid");
      expect(fetched?.deliveryStatus).toBe("needs_human_review");

      const reviewQueue = await sqliteOrderRepo.getReviewQueue();
      expect(reviewQueue.length).toBe(1);
      expect(reviewQueue[0].id).toBe(order.id);
    });
  });
});
