/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../../server";
import { DIContainer } from "../index";
import { SchedulingServiceAgent } from "./SchedulingServiceAgent";

describe("Scheduling Dashboard API Key Authentication Tests", () => {
  const apiKey = "test-dashboard-admin-key-9999";
  let validSessionId = "";

  beforeEach(async () => {
    process.env.AZIZ_API_KEY = apiKey;
    const schedulingAgent = DIContainer.get<SchedulingServiceAgent>("SchedulingServiceAgent");

    const invite = await schedulingAgent.generateCandidateInvite({
      candidateId: `cand_dash_${Date.now()}`,
      candidateName: "Dashboard Test Candidate",
      candidateEmail: "dash.candidate@example.com",
      interviewerId: "int_01",
      interviewerName: "Dr. Sarah Vance",
      autoBookEnabled: false
    });

    validSessionId = invite.session.id;
  });

  describe("GET /api/scheduling/sessions Authentication", () => {
    it("returns 401 Unauthorized when X-API-Key header is missing", async () => {
      const res = await request(app).get("/api/scheduling/sessions");
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/unauthorized/i);
    });

    it("returns 401 Unauthorized when invalid X-API-Key header is provided", async () => {
      const res = await request(app)
        .get("/api/scheduling/sessions")
        .set("X-API-Key", "invalid-key-xyz");
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/unauthorized/i);
    });

    it("returns 200 OK with session list when valid X-API-Key is provided", async () => {
      const res = await request(app)
        .get("/api/scheduling/sessions")
        .set("X-API-Key", apiKey);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((s: any) => s.id === validSessionId)).toBe(true);
    });
  });

  describe("GET /api/scheduling/audit-logs Authentication", () => {
    it("returns 401 Unauthorized when X-API-Key header is missing", async () => {
      const res = await request(app).get("/api/scheduling/audit-logs");
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/unauthorized/i);
    });

    it("returns 200 OK with audit log list when valid X-API-Key is provided", async () => {
      const res = await request(app)
        .get("/api/scheduling/audit-logs")
        .set("X-API-Key", apiKey);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("POST /api/scheduling/invite Authentication", () => {
    it("returns 401 Unauthorized when X-API-Key header is missing", async () => {
      const res = await request(app)
        .post("/api/scheduling/invite")
        .send({
          candidateId: `cand_unauth_${Date.now()}`,
          candidateName: "Unauth Candidate",
          candidateEmail: "unauth@example.com",
          interviewerId: "int_01",
          interviewerName: "Dr. Sarah Vance",
          autoBookEnabled: false
        });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/unauthorized/i);
    });

    it("returns 201 Created with session and token when valid X-API-Key is provided", async () => {
      const res = await request(app)
        .post("/api/scheduling/invite")
        .set("X-API-Key", apiKey)
        .send({
          candidateId: `cand_auth_${Date.now()}`,
          candidateName: "Auth Candidate",
          candidateEmail: "auth@example.com",
          interviewerId: "int_01",
          interviewerName: "Dr. Sarah Vance",
          autoBookEnabled: false
        });
      expect(res.status).toBe(201);
      expect(res.body.session).toBeDefined();
      expect(res.body.token).toBeDefined();
    });
  });

  describe("POST /api/scheduling/confirm Authentication", () => {
    it("returns 401 Unauthorized when X-API-Key header is missing", async () => {
      const res = await request(app)
        .post("/api/scheduling/confirm")
        .send({ sessionId: validSessionId });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/unauthorized/i);
    });

    it("accepts valid X-API-Key for confirmation", async () => {
      const res = await request(app)
        .post("/api/scheduling/confirm")
        .set("X-API-Key", apiKey)
        .send({ sessionId: validSessionId });
      // Depending on slot selection state, it will either return 200 (if slot was selected) or 400 (if no slot pending), but definitely not 401!
      expect(res.status).not.toBe(401);
    });
  });

  describe("GET /api/auth/status Public Verification", () => {
    it("returns authenticated: false when no key is provided", async () => {
      const res = await request(app).get("/api/auth/status");
      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(false);
    });

    it("returns authenticated: true when valid X-API-Key is provided", async () => {
      const res = await request(app)
        .get("/api/auth/status")
        .set("X-API-Key", apiKey);
      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(true);
    });
  });
});
