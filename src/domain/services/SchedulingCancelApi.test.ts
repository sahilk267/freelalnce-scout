/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../../server";
import { DIContainer } from "../index";
import { SchedulingServiceAgent } from "./SchedulingServiceAgent";

describe("Scheduling Cancellation Security & Token Validation API Tests", () => {
  const apiKey = process.env.AZIZ_API_KEY || "test-key-12345";
  let validSessionId = "";
  let validCandidateToken = "";
  let targetSlotId = "";

  beforeEach(async () => {
    process.env.AZIZ_API_KEY = apiKey;
    const schedulingAgent = DIContainer.get<SchedulingServiceAgent>("SchedulingServiceAgent");

    const invite = await schedulingAgent.generateCandidateInvite({
      candidateId: `cand_cancel_${Date.now()}`,
      candidateName: "Test Candidate",
      candidateEmail: "candidate@example.com",
      interviewerId: "int_01",
      interviewerName: "Sarah Connor",
      autoBookEnabled: false
    });

    validSessionId = invite.session.id;
    validCandidateToken = invite.token;

    const slots = await schedulingAgent.getAvailableSlots(validSessionId);
    targetSlotId = slots[0].id;
    await schedulingAgent.selectSlot(validSessionId, validCandidateToken, targetSlotId);
  });

  describe("POST /api/scheduling/cancel Security Boundary", () => {
    it("rejects cancellation attempts when X-Session-Token header is missing with 401", async () => {
      const res = await request(app)
        .post("/api/scheduling/cancel")
        .send({
          sessionId: validSessionId,
          reason: "Malicious unauthenticated cancellation attempt"
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Missing session token/i);
    });

    it("rejects cancellation attempts with forged or invalid X-Session-Token with 401", async () => {
      const res = await request(app)
        .post("/api/scheduling/cancel")
        .set("X-Session-Token", "fake_forged_token_xyz")
        .send({
          sessionId: validSessionId,
          reason: "Malicious forged token attempt"
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Unauthorized or expired session token/i);
    });

    it("returns 400 when sessionId is missing from payload", async () => {
      const res = await request(app)
        .post("/api/scheduling/cancel")
        .set("X-Session-Token", validCandidateToken)
        .send({
          reason: "Missing session ID"
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Missing required body parameter: sessionId/i);
    });

    it("allows legitimate candidate to cancel their booking with valid X-Session-Token", async () => {
      const res = await request(app)
        .post("/api/scheduling/cancel")
        .set("X-Session-Token", validCandidateToken)
        .send({
          sessionId: validSessionId,
          reason: "Candidate has unavoidable conflict"
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.session?.status).toBe("cancelled");

      // Verify slot was released back to availability
      const schedulingAgent = DIContainer.get<SchedulingServiceAgent>("SchedulingServiceAgent");
      const slots = await schedulingAgent.getAvailableSlots(validSessionId);
      const releasedSlot = slots.find(s => s.id === targetSlotId);
      expect(releasedSlot).toBeDefined();
      expect(releasedSlot?.status).toBe("available");
    });

    it("allows authorized admin to cancel booking via X-API-Key without candidate token", async () => {
      const res = await request(app)
        .post("/api/scheduling/cancel")
        .set("X-API-Key", apiKey)
        .send({
          sessionId: validSessionId,
          reason: "Recruiter administrative cancellation"
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.session?.status).toBe("cancelled");
    });

    it("rejects attempt to cancel an already cancelled session with 400", async () => {
      // First cancel
      await request(app)
        .post("/api/scheduling/cancel")
        .set("X-Session-Token", validCandidateToken)
        .send({ sessionId: validSessionId });

      // Second cancel
      const res = await request(app)
        .post("/api/scheduling/cancel")
        .set("X-Session-Token", validCandidateToken)
        .send({ sessionId: validSessionId });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already cancelled/i);
    });
  });
});
