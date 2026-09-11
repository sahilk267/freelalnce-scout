/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../../server";
import { DIContainer, ICandidateRepository, IScreeningRepository } from "../index";
import { createScreeningSession } from "../models/ScreeningSession";
import { ScreeningServiceAgent } from "./ScreeningServiceAgent";
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
          return { text: "Mock AI Response" };
        }
      }
    };
  }
}

describe("Screening Agent API Integration Tests", () => {
  const apiKey = process.env.AZIZ_API_KEY || "test-key-12345";

  beforeEach(async () => {
    process.env.AZIZ_API_KEY = apiKey;
    DIContainer.register("ScreeningServiceAgent", new ScreeningServiceAgent(new MockAIClientProvider()), true);

    // Seed a valid candidate
    const candidateRepo = DIContainer.get<ICandidateRepository>("ICandidateRepository");
    await candidateRepo.save({
      id: "cand-screening-valid",
      name: "Alice Developer",
      email: "alice@example.com",
      skills: ["Node.js", "TypeScript"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as any);
  });

  describe("POST /api/screening/sessions", () => {
    it("creates a screening session when candidate exists", async () => {
      const res = await request(app)
        .post("/api/screening/sessions")
        .set("X-API-Key", apiKey)
        .send({
          candidateId: "cand-screening-valid",
          jobId: "job-backend-1",
          jobTitle: "Senior Backend Engineer",
          jobRequirements: ["Node.js", "SQLite", "TypeScript"]
        });

      expect(res.status).toBe(201);
      expect(res.body.session).toBeDefined();
      expect(res.body.session.candidateId).toBe("cand-screening-valid");
      expect(res.body.session.sessionToken).toBeDefined();
      expect(res.body.session.status).toBe("in_progress");
    });

    it("returns 404 when candidateId does not exist", async () => {
      const res = await request(app)
        .post("/api/screening/sessions")
        .set("X-API-Key", apiKey)
        .send({
          candidateId: "non-existent-candidate",
          jobId: "job-backend-1",
          jobTitle: "Backend Engineer",
          jobRequirements: ["Node.js"]
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain("Candidate with ID 'non-existent-candidate' not found");
    });
  });

  describe("Candidate Session Endpoints (Candidate Auth via Token)", () => {
    it("fetches session with valid X-Session-Token and returns 401 on invalid token", async () => {
      const screeningRepo = DIContainer.get<IScreeningRepository>("IScreeningRepository");
      const session = createScreeningSession({
        candidateId: "cand-screening-valid",
        jobId: "job-1",
        jobTitle: "Software Engineer",
        jobRequirements: ["TypeScript"]
      });
      await screeningRepo.save(session);

      // Invalid token
      const resBad = await request(app)
        .get(`/api/screening/sessions/${session.id}/candidate`)
        .set("X-Session-Token", "invalid-token");

      expect(resBad.status).toBe(401);

      // Valid token
      const resGood = await request(app)
        .get(`/api/screening/sessions/${session.id}/candidate`)
        .set("X-Session-Token", session.sessionToken);

      expect(resGood.status).toBe(200);
      expect(resGood.body.id).toBe(session.id);
    });

    it("processes candidate chat interaction and returns assistant reply", async () => {
      const screeningRepo = DIContainer.get<IScreeningRepository>("IScreeningRepository");
      const session = createScreeningSession({
        candidateId: "cand-screening-valid",
        jobId: "job-1",
        jobTitle: "Software Engineer",
        jobRequirements: ["TypeScript"]
      });
      await screeningRepo.save(session);

      const res = await request(app)
        .post(`/api/screening/sessions/${session.id}/interact`)
        .set("X-Session-Token", session.sessionToken)
        .send({ message: "I have 5 years of TypeScript experience." });

      expect(res.status).toBe(200);
      expect(res.body.assistantMessage).toBeDefined();
      expect(res.body.session.messages.length).toBeGreaterThan(2);
    });

    it("returns 410 Gone when interacting with an expired session", async () => {
      const screeningRepo = DIContainer.get<IScreeningRepository>("IScreeningRepository");
      const session = createScreeningSession({
        candidateId: "cand-screening-valid",
        jobId: "job-1",
        jobTitle: "Software Engineer",
        jobRequirements: ["TypeScript"],
        ttlHours: -2 // Expired 2 hours ago
      });
      await screeningRepo.save(session);

      const res = await request(app)
        .post(`/api/screening/sessions/${session.id}/interact`)
        .set("X-Session-Token", session.sessionToken)
        .send({ message: "Hello" });

      expect(res.status).toBe(410);
      expect(res.body.error).toContain("Session has expired");
    });
  });

  describe("Admin Evaluation & Idempotency", () => {
    it("evaluates a session and returns 409 Conflict on subsequent evaluation attempts", async () => {
      const screeningRepo = DIContainer.get<IScreeningRepository>("IScreeningRepository");
      const session = createScreeningSession({
        candidateId: "cand-screening-valid",
        jobId: "job-1",
        jobTitle: "Software Engineer",
        jobRequirements: ["TypeScript"]
      });
      await screeningRepo.save(session);

      // First evaluation call
      const res1 = await request(app)
        .post(`/api/screening/sessions/${session.id}/evaluate`)
        .set("X-API-Key", apiKey);

      expect(res1.status).toBe(200);
      expect(res1.body.session.status).toBe("needs_human_review");

      // Second evaluation call (idempotency enforcement)
      const res2 = await request(app)
        .post(`/api/screening/sessions/${session.id}/evaluate`)
        .set("X-API-Key", apiKey);

      expect(res2.status).toBe(409);
      expect(res2.body.error).toContain("Session has already been evaluated");
    });

    it("records human review sign-off", async () => {
      const screeningRepo = DIContainer.get<IScreeningRepository>("IScreeningRepository");
      const session = createScreeningSession({
        candidateId: "cand-screening-valid",
        jobId: "job-1",
        jobTitle: "Software Engineer",
        jobRequirements: ["TypeScript"]
      });
      await screeningRepo.save(session);

      const res = await request(app)
        .post(`/api/screening/sessions/${session.id}/human-review`)
        .set("X-API-Key", apiKey)
        .send({
          action: "approve",
          reviewerId: "lead_recruiter",
          notes: "Strong candidate credentials."
        });

      expect(res.status).toBe(200);
      expect(res.body.session.status).toBe("approved");
      expect(res.body.session.humanReview.approvedBy).toBe("lead_recruiter");
    });
  });

  describe("Candidate Auth Rate Limiting for Failed Token Attempts", () => {
    it("returns 429 Too Many Requests after 10 consecutive failed candidate token attempts", async () => {
      const screeningRepo = DIContainer.get<IScreeningRepository>("IScreeningRepository");
      const session = createScreeningSession({
        candidateId: "cand-screening-valid",
        jobId: "job-1",
        jobTitle: "Software Engineer",
        jobRequirements: ["TypeScript"]
      });
      await screeningRepo.save(session);

      // Make 10 failed token requests from same test agent client
      for (let i = 0; i < 10; i++) {
        await request(app)
          .get(`/api/screening/sessions/${session.id}/candidate`)
          .set("X-Session-Token", `wrong-token-${i}`);
      }

      // The 11th request should hit 429 rate limit
      const resBlocked = await request(app)
        .get(`/api/screening/sessions/${session.id}/candidate`)
        .set("X-Session-Token", session.sessionToken);

      expect(resBlocked.status).toBe(429);
      expect(resBlocked.body.error).toMatch(/(Too many failed session authentication attempts|Rate limit exceeded)/);
    });
  });
});
