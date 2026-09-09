/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ScreeningServiceAgent } from "./ScreeningServiceAgent";
import { createScreeningSession } from "../models/ScreeningSession";
import { IAIClientProvider } from "../providers/IAIClientProvider";

class MockAIClientProvider implements IAIClientProvider {
  getClient(): any {
    return {
      models: {
        generateContent: async (params: any) => {
          const contentsStr = typeof params.contents === "string" ? params.contents : JSON.stringify(params.contents || "");
          if (contentsStr.includes("You are an expert, professional technical recruiter")) {
            return {
              text: "Could you tell me more about your hands-on experience building Node.js microservices?"
            };
          }
          if (contentsStr.includes("senior hiring auditor")) {
            return {
              text: JSON.stringify({
                overallScore: 85,
                recommendation: "STRONG_HIRE",
                criteriaEvaluations: [
                  {
                    requirement: "3+ years Node.js experience",
                    score: 90,
                    reasoning: "Candidate demonstrated 4 years of Node.js experience.",
                    candidateEvidence: "I have built production services in Node.js for 4 years."
                  }
                ],
                strengths: ["Strong backend architecture background."],
                concerns: [],
                auditNotes: "Candidate meets all core technical requirements."
              })
            };
          }
          if (contentsStr.includes("Compliance & Fact-Verification Auditor")) {
            return {
              text: JSON.stringify({
                status: "PASSED",
                auditNotes: "All claims verified against transcript.",
                flags: []
              })
            };
          }
          return { text: "Default mock response" };
        }
      }
    };
  }
}

describe("ScreeningServiceAgent Unit Tests", () => {
  let agent: ScreeningServiceAgent;

  beforeEach(() => {
    agent = new ScreeningServiceAgent(new MockAIClientProvider());
  });

  it("processes interaction and appends candidate + assistant messages", async () => {
    const session = createScreeningSession({
      candidateId: "cand-123",
      jobId: "job-456",
      jobTitle: "Senior Backend Engineer",
      jobRequirements: ["Node.js", "TypeScript", "SQLite"]
    });

    const initialMessageCount = session.messages.length;
    const { assistantMessage, updatedSession } = await agent.interact(
      session,
      "I have 4 years of experience with Node.js and TypeScript."
    );

    expect(updatedSession.messages.length).toBe(initialMessageCount + 2);
    expect(updatedSession.messages[initialMessageCount].sender).toBe("candidate");
    expect(updatedSession.messages[initialMessageCount + 1].sender).toBe("assistant");
    expect(assistantMessage.content).toContain("Node.js");
  });

  it("enforces lazy expiration check during interaction", async () => {
    const session = createScreeningSession({
      candidateId: "cand-123",
      jobId: "job-456",
      jobTitle: "Backend Engineer",
      jobRequirements: ["Node.js"],
      ttlHours: -1 // Expired 1 hour ago
    });

    await expect(
      agent.interact(session, "Hello")
    ).rejects.toThrow("Screening session has expired");

    expect(session.status).toBe("expired");
  });

  it("evaluates session transcript and runs 2-pass verification audit", async () => {
    const session = createScreeningSession({
      candidateId: "cand-123",
      jobId: "job-456",
      jobTitle: "Senior Backend Engineer",
      jobRequirements: ["Node.js", "TypeScript"]
    });

    await agent.interact(session, "I have built scaled services using Node.js and TypeScript.");

    const evaluatedSession = await agent.evaluateSession(session);

    expect(evaluatedSession.status).toBe("needs_human_review");
    expect(evaluatedSession.evaluation).toBeDefined();
    expect(evaluatedSession.evaluation?.overallScore).toBe(85);
    expect(evaluatedSession.evaluation?.recommendation).toBe("STRONG_HIRE");
    expect(evaluatedSession.evaluation?.verificationAudit?.status).toBe("PASSED");
  });

  it("records human review sign-off and updates status to approved/rejected", async () => {
    const session = createScreeningSession({
      candidateId: "cand-123",
      jobId: "job-456",
      jobTitle: "Senior Backend Engineer",
      jobRequirements: ["Node.js"]
    });

    const approvedSession = await agent.submitHumanReview(
      session,
      "approve",
      "recruiter_john",
      "Candidate verified during interview."
    );

    expect(approvedSession.status).toBe("approved");
    expect(approvedSession.humanReview?.action).toBe("approve");
    expect(approvedSession.humanReview?.approvedBy).toBe("recruiter_john");
  });
});
