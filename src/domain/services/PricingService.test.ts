/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../../server";
import { DIContainer } from "../di/DIContainer";
import { PricingService, PricingValidationError } from "./PricingService";
import { SQLitePricingRepository } from "../repositories/SQLitePricingRepository";
import { InMemoryPricingRepository } from "../repositories/InMemoryPricingRepository";
import { IOrderRepository } from "../repositories/IOrderRepository";
import { ICandidateRepository } from "../repositories/ICandidateRepository";
import { createResumeOrder } from "../models/ResumeOrder";

describe("PricingService & Dynamic Pricing System", () => {
  let sqliteRepo: SQLitePricingRepository;
  let pricingService: PricingService;

  beforeEach(async () => {
    sqliteRepo = new SQLitePricingRepository(":memory:");
    pricingService = new PricingService(sqliteRepo);
  });

  describe("1. Seed-on-first-boot regression safety", () => {
    it("produces today's exact values on first boot (₹300/1, ₹800/2, ₹1500/3)", async () => {
      const tiers = await pricingService.getAllTiers(false);
      expect(tiers).toHaveLength(3);

      const basic = tiers.find((t) => t.tierId === "basic");
      expect(basic).toBeDefined();
      expect(basic?.displayName).toBe("Basic");
      expect(basic?.priceMinorUnits).toBe(30000); // 300 * 100 paise
      expect(basic?.currency).toBe("INR");
      expect(basic?.revisionLimit).toBe(1);
      expect(basic?.isActive).toBe(true);

      const standard = tiers.find((t) => t.tierId === "standard");
      expect(standard).toBeDefined();
      expect(standard?.displayName).toBe("Standard");
      expect(standard?.priceMinorUnits).toBe(80000); // 800 * 100 paise
      expect(standard?.currency).toBe("INR");
      expect(standard?.revisionLimit).toBe(2);
      expect(standard?.isActive).toBe(true);

      const premium = tiers.find((t) => t.tierId === "premium");
      expect(premium).toBeDefined();
      expect(premium?.displayName).toBe("Premium");
      expect(premium?.priceMinorUnits).toBe(150000); // 1500 * 100 paise
      expect(premium?.currency).toBe("INR");
      expect(premium?.revisionLimit).toBe(3);
      expect(premium?.isActive).toBe(true);
    });
  });

  describe("2. Validation rules", () => {
    it("rejects price <= 0", async () => {
      await expect(
        pricingService.updateTier("basic", { price: 0 }, "admin@example.com")
      ).rejects.toThrow(PricingValidationError);

      await expect(
        pricingService.updateTier("basic", { priceMinorUnits: -500 }, "admin@example.com")
      ).rejects.toThrow(PricingValidationError);
    });

    it("rejects revision limit < 0", async () => {
      await expect(
        pricingService.updateTier("basic", { revisionLimit: -1 }, "admin@example.com")
      ).rejects.toThrow(PricingValidationError);

      // 0 revision limit is allowed (e.g. no free revisions included)
      const updated = await pricingService.updateTier("basic", { revisionLimit: 0 }, "admin@example.com");
      expect(updated.revisionLimit).toBe(0);
    });

    it("rejects invalid 3-letter currency codes", async () => {
      await expect(
        pricingService.updateTier("basic", { currency: "INVALID" }, "admin@example.com")
      ).rejects.toThrow(PricingValidationError);

      await expect(
        pricingService.updateTier("basic", { currency: "US" }, "admin@example.com")
      ).rejects.toThrow(PricingValidationError);

      await expect(
        pricingService.updateTier("basic", { currency: "123" }, "admin@example.com")
      ).rejects.toThrow(PricingValidationError);

      // Valid currencies are accepted
      const updatedUSD = await pricingService.updateTier("basic", { currency: "USD" }, "admin@example.com");
      expect(updatedUSD.currency).toBe("USD");
    });

    it("rejects empty displayName", async () => {
      await expect(
        pricingService.updateTier("basic", { displayName: "   " }, "admin@example.com")
      ).rejects.toThrow(PricingValidationError);
    });
  });

  describe("3. In-memory caching and invalidation", () => {
    it("serves reads from cache and invalidates immediately on update", async () => {
      const initial = await pricingService.getTier("basic");
      expect(initial?.priceMinorUnits).toBe(30000);

      // Modify via service
      await pricingService.updateTier("basic", { price: 450 }, "admin@example.com");

      // Next read gets fresh updated value
      const updated = await pricingService.getTier("basic");
      expect(updated?.priceMinorUnits).toBe(45000);
    });
  });

  describe("4. Audit logging", () => {
    it("creates an audit log entry for every modification with old/new values, author, and timestamp", async () => {
      await pricingService.updateTier(
        "standard",
        { price: 950, reason: "Festival promotion" },
        "finance_admin@company.com"
      );

      const logs = await pricingService.getAuditLogs("standard");
      expect(logs.length).toBeGreaterThanOrEqual(1);

      const latest = logs[0];
      expect(latest.tierId).toBe("standard");
      expect(latest.changedBy).toBe("finance_admin@company.com");
      expect(latest.reason).toBe("Festival promotion");

      const oldVals = JSON.parse(latest.oldValues);
      const newVals = JSON.parse(latest.newValues);
      expect(oldVals.priceMinorUnits).toBe(80000);
      expect(newVals.priceMinorUnits).toBe(95000);
    });
  });

  describe("5. Tier deactivation", () => {
    it("excludes deactivated tier from public listing but keeps it in administrative view", async () => {
      await pricingService.updateTier("basic", { isActive: false }, "admin@example.com");

      const publicTiers = await pricingService.getPublicTiers();
      expect(publicTiers.map((t) => t.tierId)).not.toContain("basic");
      expect(publicTiers.map((t) => t.tierId)).toContain("standard");
      expect(publicTiers.map((t) => t.tierId)).toContain("premium");

      const allTiers = await pricingService.getAllTiers(false);
      const basicInAll = allTiers.find((t) => t.tierId === "basic");
      expect(basicInAll).toBeDefined();
      expect(basicInAll?.isActive).toBe(false);
    });
  });

  describe("6. Regression Protection: Price snapshots and existing orders", () => {
    it("never retroactively alters priceAtOrderTime or priceINR on existing orders when tier price changes", async () => {
      const orderRepo = DIContainer.get<IOrderRepository>("IOrderRepository");
      const candidateRepo = DIContainer.get<ICandidateRepository>("ICandidateRepository");

      await candidateRepo.save({
        id: "cand-pricing-test",
        name: "Test Candidate",
        skills: ["React"],
        experienceYears: 3,
        locationPreference: "Remote"
      });

      // 1. Create order on standard tier (₹800)
      const order = createResumeOrder({
        candidateId: "cand-pricing-test",
        tier: "standard",
        originalResumeText: "Test Resume Content",
        priceINR: 800,
        priceAtOrderTime: 800,
        priceMinorUnits: 80000,
        currency: "INR",
        maxRevisions: 2
      });
      order.paymentStatus = "paid";
      await orderRepo.save(order);

      // 2. Change standard tier price to ₹1200 via pricing service
      const appPricingService = DIContainer.get<PricingService>("PricingService");
      await appPricingService.updateTier("standard", { price: 1200 }, "admin@company.com");

      // 3. Verify existing order retains its original snapshot price of ₹800 (80000 paise)
      const fetchedOrder = await orderRepo.getById(order.id);
      expect(fetchedOrder).toBeDefined();
      expect(fetchedOrder?.priceAtOrderTime).toBe(800);
      expect(fetchedOrder?.priceINR).toBe(800);
      expect(fetchedOrder?.priceMinorUnits).toBe(80000);

      // 4. Verify payment intent for the existing order returns the original ₹800
      const apiKey = process.env.AZIZ_API_KEY || "test-key-12345";
      process.env.AZIZ_API_KEY = apiKey;

      const intentResExisting = await request(app)
        .post("/api/orders/create-payment-intent")
        .set("X-API-Key", apiKey)
        .send({ orderId: order.id });

      expect(intentResExisting.status).toBe(200);
      expect(intentResExisting.body.amount).toBe(800);
      expect(intentResExisting.body.amountMinorUnits).toBe(80000);

      // 5. Verify payment intent for a NEW standard tier order reflects the updated ₹1200
      const intentResNew = await request(app)
        .post("/api/orders/create-payment-intent")
        .set("X-API-Key", apiKey)
        .send({ tier: "standard" });

      expect(intentResNew.status).toBe(200);
      expect(intentResNew.body.amount).toBe(1200);
      expect(intentResNew.body.amountMinorUnits).toBe(120000);
    });

    it("prevents new order creation on deactivated tier but existing orders continue functioning", async () => {
      const apiKey = process.env.AZIZ_API_KEY || "test-key-12345";
      process.env.AZIZ_API_KEY = apiKey;
      const appPricingService = DIContainer.get<PricingService>("PricingService");
      const orderRepo = DIContainer.get<IOrderRepository>("IOrderRepository");

      // Deactivate premium tier
      await appPricingService.updateTier("premium", { isActive: false }, "admin@company.com");

      // Attempt to create a new order on premium tier -> should fail with 400
      const failRes = await request(app)
        .post("/api/orders")
        .set("X-API-Key", apiKey)
        .send({
          candidateId: "cand-pricing-test",
          tier: "premium",
          originalResumeText: "Some text"
        });

      expect(failRes.status).toBe(400);
      expect(failRes.body.error).toContain("deactivated");

      // Existing order created previously on premium tier still loads and functions
      const existingPremiumOrder = createResumeOrder({
        candidateId: "cand-pricing-test",
        tier: "premium",
        originalResumeText: "Existing Premium Order Text",
        priceINR: 1500,
        priceAtOrderTime: 1500,
        priceMinorUnits: 150000
      });
      existingPremiumOrder.paymentStatus = "paid";
      await orderRepo.save(existingPremiumOrder);

      const getOrderRes = await request(app)
        .get(`/api/orders/${existingPremiumOrder.id}`)
        .set("X-API-Key", apiKey);

      expect(getOrderRes.status).toBe(200);
      expect(getOrderRes.body.tier).toBe("premium");
      expect(getOrderRes.body.priceINR).toBe(1500);

      // Re-activate premium for subsequent tests
      await appPricingService.updateTier("premium", { isActive: true }, "admin@company.com");
    });
  });

  describe("7. HTTP Endpoints (/api/pricing)", () => {
    const apiKey = process.env.AZIZ_API_KEY || "test-key-12345";

    it("GET /api/pricing returns public active tiers without authentication", async () => {
      const res = await request(app).get("/api/pricing");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      expect(res.body[0]).toHaveProperty("tierId");
      expect(res.body[0]).toHaveProperty("price");
      expect(res.body[0]).toHaveProperty("priceMinorUnits");
      expect(res.body[0]).toHaveProperty("currency");
    });

    it("PUT /api/pricing/:tierId requires admin authentication", async () => {
      const unauthorizedRes = await request(app)
        .put("/api/pricing/basic")
        .send({ price: 350 });

      expect(unauthorizedRes.status).toBe(401);
    });

    it("PUT /api/pricing/:tierId updates tier and records audit log when authenticated as admin", async () => {
      const updateRes = await request(app)
        .put("/api/pricing/basic")
        .set("X-API-Key", apiKey)
        .set("X-User-Email", "superadmin@example.com")
        .send({
          price: 320,
          revisionLimit: 2,
          reason: "Inflation adjustment"
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.tier.price).toBe(320);
      expect(updateRes.body.tier.priceMinorUnits).toBe(32000);
      expect(updateRes.body.tier.revisionLimit).toBe(2);

      // Check audit log endpoint
      const auditRes = await request(app)
        .get("/api/pricing/audit?tierId=basic")
        .set("X-API-Key", apiKey);

      expect(auditRes.status).toBe(200);
      expect(Array.isArray(auditRes.body)).toBe(true);
      const log = auditRes.body.find((l: any) => l.reason === "Inflation adjustment");
      expect(log).toBeDefined();
      expect(log.tierId).toBe("basic");
    });
  });
});
