/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../../server";
import { CompanyProfileService } from "./CompanyProfileService";

describe("Company Delivery API & Anti-Abuse Controls", () => {
  const apiKey = process.env.AZIZ_API_KEY || "test-key-12345";
  let testCompanyId = "";

  beforeEach(() => {
    process.env.AZIZ_API_KEY = apiKey;
    const compService = CompanyProfileService.getInstance();
    const companies = compService.getAll();
    if (companies.length > 0) {
      testCompanyId = companies[0].id;
    }
  });

  describe("Authentication Enforcement on Outbound Delivery Endpoints", () => {
    it("rejects unauthenticated requests to POST /api/companies/:id/test-delivery with 401", async () => {
      const res = await request(app)
        .post(`/api/companies/${testCompanyId}/test-delivery`)
        .send({ channel: "all" });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Unauthorized/i);
    });

    it("rejects invalid API key requests to POST /api/companies/:id/test-delivery with 401", async () => {
      const res = await request(app)
        .post(`/api/companies/${testCompanyId}/test-delivery`)
        .set("X-API-Key", "invalid-malicious-key")
        .send({ channel: "telegram" });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Unauthorized/i);
    });

    it("rejects unauthenticated requests to POST /api/companies/:id/test-alert with 401", async () => {
      const res = await request(app)
        .post(`/api/companies/${testCompanyId}/test-alert`)
        .send({});

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Unauthorized/i);
    });

    it("rejects unauthenticated requests to POST /api/companies/:id/scout with 401", async () => {
      const res = await request(app)
        .post(`/api/companies/${testCompanyId}/scout`)
        .send({});

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Unauthorized/i);
    });

    it("rejects unauthenticated requests to modify company profiles with 401", async () => {
      const createRes = await request(app)
        .post("/api/companies")
        .send({ name: "Malicious Fake Profile" });
      expect(createRes.status).toBe(401);

      const updateRes = await request(app)
        .put(`/api/companies/${testCompanyId}`)
        .send({ hostingerEmail: "attacker@malicious.com" });
      expect(updateRes.status).toBe(401);

      const deleteRes = await request(app)
        .delete(`/api/companies/${testCompanyId}`);
      expect(deleteRes.status).toBe(401);
    });
  });

  describe("Delivery Test Behavior & Abuse Mitigations with Valid Auth", () => {
    it("returns 404 for non-existent company profile", async () => {
      const res = await request(app)
        .post("/api/companies/non-existent-comp-id-9999/test-delivery")
        .set("X-API-Key", apiKey)
        .send({ channel: "all" });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/Company profile not found/i);
    });

    it("enforces cooldown when test-delivery is triggered in rapid succession", async () => {
      // Create a dedicated test company with disabled delivery channels so no real external networks are pinged
      const compService = CompanyProfileService.getInstance();
      const testComp = compService.create({
        name: "Cooldown Test Co",
        telegramEnabled: false,
        hostingerEnabled: false,
        gmailEnabled: false
      });

      // First dispatch should pass cooldown check (channels disabled = cleanly handled in response)
      const res1 = await request(app)
        .post(`/api/companies/${testComp.id}/test-delivery`)
        .set("X-API-Key", apiKey)
        .send({ channel: "all" });

      expect(res1.status).toBe(200);

      // Immediate second dispatch must be rejected with 429 Too Many Requests
      const res2 = await request(app)
        .post(`/api/companies/${testComp.id}/test-delivery`)
        .set("X-API-Key", apiKey)
        .send({ channel: "all" });

      expect(res2.status).toBe(429);
      expect(res2.body.error).toMatch(/Delivery test cooldown active/i);

      // Cleanup
      compService.delete(testComp.id);
    });

    it("validates notification target formats to prevent malformed destinations or header injections", async () => {
      const res = await request(app)
        .post("/api/companies")
        .set("X-API-Key", apiKey)
        .send({
          name: "Invalid Target Co",
          hostingerEmail: "invalid-email-address-no-at",
          telegramChatId: "invalid!@#$%"
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });
});
