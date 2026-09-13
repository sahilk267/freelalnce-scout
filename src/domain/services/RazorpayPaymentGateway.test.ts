/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import request from "supertest";

// Mock Razorpay SDK before importing server
vi.mock("razorpay", () => {
  return {
    default: class MockRazorpay {
      orders = {
        create: vi.fn().mockImplementation(async (params: any) => ({
          id: `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          amount: params.amount,
          currency: params.currency || "INR",
          status: "created"
        })),
        fetch: vi.fn().mockImplementation(async (orderId: string) => ({
          id: orderId,
          amount: 80000,
          currency: "INR",
          status: "created"
        }))
      };
      payments = {
        refund: vi.fn().mockImplementation(async (paymentId: string, _options: any) => ({
          id: `rfnd_mock_${Date.now()}`,
          payment_id: paymentId,
          amount: 80000,
          status: "processed"
        }))
      };
    }
  };
});

import { app, authService } from "../../../server";
import { DIContainer, IOrderRepository, IUserRepository, UserRole } from "../index";
import { createResumeOrder } from "../models/ResumeOrder";

function generateSignature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(Buffer.from(payload)).digest("hex");
}

describe("Razorpay Payment Gateway & Webhook Security", () => {
  const originalEnv = { ...process.env };
  const WEBHOOK_SECRET = "test_rzp_webhook_secret_super_secure";
  const TEST_API_KEY = "test-api-key-gateway-12345";

  beforeEach(() => {
    process.env.AZIZ_API_KEY = TEST_API_KEY;
    process.env.RAZORPAY_KEY_ID = "rzp_test_key_abc123";
    process.env.RAZORPAY_KEY_SECRET = "rzp_test_secret_xyz789";
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.ALLOW_PAYMENT_SIMULATION = "true";
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("pay-simulate Route Guarding", () => {
    it("returns 403 when NODE_ENV is 'production' even if ALLOW_PAYMENT_SIMULATION is true", async () => {
      process.env.NODE_ENV = "production";
      process.env.ALLOW_PAYMENT_SIMULATION = "true";

      const orderRepo = DIContainer.get<IOrderRepository>("IOrderRepository");
      const order = createResumeOrder({
        candidateId: "cand-guard-1",
        tier: "standard",
        originalResumeText: "Sample resume content"
      });
      await orderRepo.save(order);

      const res = await request(app)
        .post(`/api/orders/${order.id}/pay-simulate`)
        .set("X-API-Key", TEST_API_KEY)
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("Payment simulation is strictly forbidden in production environments");
    });

    it("returns 403 when ALLOW_PAYMENT_SIMULATION is not 'true' in non-production", async () => {
      process.env.NODE_ENV = "development";
      process.env.ALLOW_PAYMENT_SIMULATION = "false";

      const orderRepo = DIContainer.get<IOrderRepository>("IOrderRepository");
      const order = createResumeOrder({
        candidateId: "cand-guard-2",
        tier: "standard",
        originalResumeText: "Sample resume content"
      });
      await orderRepo.save(order);

      const res = await request(app)
        .post(`/api/orders/${order.id}/pay-simulate`)
        .set("X-API-Key", TEST_API_KEY)
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("Payment simulation is disabled");
    });

    it("allows simulation in non-production when ALLOW_PAYMENT_SIMULATION is 'true'", async () => {
      process.env.NODE_ENV = "development";
      process.env.ALLOW_PAYMENT_SIMULATION = "true";

      const orderRepo = DIContainer.get<IOrderRepository>("IOrderRepository");
      const order = createResumeOrder({
        candidateId: "cand-guard-3",
        tier: "standard",
        originalResumeText: "Sample resume content"
      });
      await orderRepo.save(order);

      const res = await request(app)
        .post(`/api/orders/${order.id}/pay-simulate`)
        .set("X-API-Key", TEST_API_KEY)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.order.paymentStatus).toBe("paid");
    });
  });

  describe("Razorpay create-payment-intent Route", () => {
    it("returns 501 when Razorpay keys are not configured", async () => {
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;

      const orderRepo = DIContainer.get<IOrderRepository>("IOrderRepository");
      const order = createResumeOrder({
        candidateId: "cand-pi-1",
        tier: "standard",
        originalResumeText: "Sample resume"
      });
      await orderRepo.save(order);

      const res = await request(app)
        .post(`/api/orders/${order.id}/create-payment-intent`)
        .set("X-API-Key", TEST_API_KEY);

      expect(res.status).toBe(501);
      expect(res.body.error).toContain("Payment gateway not configured");
    });

    it("creates a Razorpay order with live tier pricing and returns public keyId", async () => {
      const orderRepo = DIContainer.get<IOrderRepository>("IOrderRepository");
      const order = createResumeOrder({
        candidateId: "cand-pi-2",
        tier: "standard",
        originalResumeText: "Sample resume"
      });
      await orderRepo.save(order);

      const res = await request(app)
        .post(`/api/orders/${order.id}/create-payment-intent`)
        .set("X-API-Key", TEST_API_KEY);

      expect(res.status).toBe(200);
      expect(res.body.razorpayOrderId).toBeDefined();
      expect(res.body.amountMinorUnits).toBe(80000);
      expect(res.body.currency).toBe("INR");
      expect(res.body.keyId).toBe("rzp_test_key_abc123");
      // Never expose secret
      expect(res.body.keySecret).toBeUndefined();
    });
  });

  describe("POST /api/payments/webhook", () => {
    it("returns 501 when RAZORPAY_WEBHOOK_SECRET is not configured", async () => {
      delete process.env.RAZORPAY_WEBHOOK_SECRET;

      const res = await request(app)
        .post("/api/payments/webhook")
        .set("X-Razorpay-Signature", "some_signature")
        .send(JSON.stringify({ event: "payment.captured" }));

      expect(res.status).toBe(501);
    });

    it("returns 400 when X-Razorpay-Signature header is missing", async () => {
      const payload = JSON.stringify({ event: "payment.captured" });

      const res = await request(app)
        .post("/api/payments/webhook")
        .set("Content-Type", "application/json")
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Missing X-Razorpay-Signature header");
    });

    it("returns 400 when X-Razorpay-Signature does not match HMAC-SHA256 signature", async () => {
      const payload = JSON.stringify({ event: "payment.captured" });
      const badSignature = "0000000000000000000000000000000000000000000000000000000000000000";

      const res = await request(app)
        .post("/api/payments/webhook")
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", badSignature)
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid webhook signature");
    });

    it("verifies valid HMAC-SHA256 signature and flips order paymentStatus to 'paid'", async () => {
      const orderRepo = DIContainer.get<IOrderRepository>("IOrderRepository");
      const order = createResumeOrder({
        candidateId: "cand-wh-1",
        tier: "standard",
        originalResumeText: "Sample content"
      });
      order.razorpayOrderId = "order_rzp_wh_100";
      order.priceMinorUnits = 80000;
      await orderRepo.save(order);

      const eventPayload = {
        id: "evt_captured_test_100",
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_rzp_123456",
              order_id: "order_rzp_wh_100",
              amount: 80000,
              currency: "INR",
              status: "captured"
            }
          }
        }
      };

      const payloadString = JSON.stringify(eventPayload);
      const signature = generateSignature(payloadString, WEBHOOK_SECRET);

      const res = await request(app)
        .post("/api/payments/webhook")
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", signature)
        .send(payloadString);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("paid");

      const updated = await orderRepo.getById(order.id);
      expect(updated?.paymentStatus).toBe("paid");
      expect(updated?.razorpayPaymentId).toBe("pay_rzp_123456");
    });

    it("is idempotent: re-sending the same payment.captured event does not fail or duplicate", async () => {
      const orderRepo = DIContainer.get<IOrderRepository>("IOrderRepository");
      const order = createResumeOrder({
        candidateId: "cand-wh-2",
        tier: "standard",
        originalResumeText: "Sample content"
      });
      order.razorpayOrderId = "order_rzp_wh_200";
      order.priceMinorUnits = 80000;
      await orderRepo.save(order);

      const eventPayload = {
        id: "evt_captured_test_200",
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_rzp_200000",
              order_id: "order_rzp_wh_200",
              amount: 80000,
              currency: "INR",
              status: "captured"
            }
          }
        }
      };

      const payloadString = JSON.stringify(eventPayload);
      const signature = generateSignature(payloadString, WEBHOOK_SECRET);

      // First webhook
      const res1 = await request(app)
        .post("/api/payments/webhook")
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", signature)
        .send(payloadString);

      expect(res1.status).toBe(200);
      expect(res1.body.status).toBe("paid");

      // Re-send duplicate webhook
      const res2 = await request(app)
        .post("/api/payments/webhook")
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", signature)
        .send(payloadString);

      expect(res2.status).toBe(200);
      expect(["already_processed", "duplicate_webhook_ignored"]).toContain(res2.body.status);

      const updated = await orderRepo.getById(order.id);
      expect(updated?.paymentStatus).toBe("paid");
    });

    it("handles payment.failed event and updates order status with failure reason", async () => {
      const orderRepo = DIContainer.get<IOrderRepository>("IOrderRepository");
      const order = createResumeOrder({
        candidateId: "cand-wh-3",
        tier: "standard",
        originalResumeText: "Sample content"
      });
      order.razorpayOrderId = "order_rzp_wh_300";
      await orderRepo.save(order);

      const eventPayload = {
        id: "evt_failed_test_300",
        event: "payment.failed",
        payload: {
          payment: {
            entity: {
              id: "pay_rzp_failed_300",
              order_id: "order_rzp_wh_300",
              error_description: "Payment failed due to insufficient funds"
            }
          }
        }
      };

      const payloadString = JSON.stringify(eventPayload);
      const signature = generateSignature(payloadString, WEBHOOK_SECRET);

      const res = await request(app)
        .post("/api/payments/webhook")
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", signature)
        .send(payloadString);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("failed_recorded");

      const updated = await orderRepo.getById(order.id);
      expect(updated?.paymentStatus).toBe("failed");
      expect(updated?.paymentFailureReason).toBe("Payment failed due to insufficient funds");
    });

    it("flags order with needs_human_review on amount discrepancy", async () => {
      const orderRepo = DIContainer.get<IOrderRepository>("IOrderRepository");
      const order = createResumeOrder({
        candidateId: "cand-wh-4",
        tier: "standard",
        originalResumeText: "Sample content"
      });
      order.razorpayOrderId = "order_rzp_wh_400";
      order.priceMinorUnits = 80000;
      await orderRepo.save(order);

      const eventPayload = {
        id: "evt_discrepancy_test_400",
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_rzp_underpaid_400",
              order_id: "order_rzp_wh_400",
              amount: 50000, // Captured 500 INR instead of 800 INR
              currency: "INR",
              status: "captured"
            }
          }
        }
      };

      const payloadString = JSON.stringify(eventPayload);
      const signature = generateSignature(payloadString, WEBHOOK_SECRET);

      const res = await request(app)
        .post("/api/payments/webhook")
        .set("Content-Type", "application/json")
        .set("X-Razorpay-Signature", signature)
        .send(payloadString);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("needs_human_review");

      const updated = await orderRepo.getById(order.id);
      expect(updated?.paymentStatus).toBe("needs_human_review");
      expect(updated?.paymentDiscrepancy).toBeDefined();
    });
  });

  describe("Admin Refund Route Gating", () => {
    it("rejects non-admin callers with 403", async () => {
      const orderRepo = DIContainer.get<IOrderRepository>("IOrderRepository");
      const order = createResumeOrder({
        candidateId: "cand-refund-1",
        tier: "standard",
        originalResumeText: "Sample content"
      });
      order.paymentStatus = "paid";
      order.razorpayPaymentId = "pay_rzp_refund_test";
      await orderRepo.save(order);

      // Caller has non-admin (recruiter) role
      const userRepo = DIContainer.get<IUserRepository>("IUserRepository");
      let recruiterUser = await userRepo.findByEmail("recruiter.refund@example.com");
      if (!recruiterUser) {
        recruiterUser = await userRepo.createUser({
          email: "recruiter.refund@example.com",
          passwordHash: "dummy_hash",
          role: "recruiter"
        });
      }
      const recruiterToken = authService.generateToken(recruiterUser);

      const res = await request(app)
        .post(`/api/orders/${order.id}/refund`)
        .set("Authorization", `Bearer ${recruiterToken}`)
        .send({ reason: "User request" });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("Forbidden: Insufficient role privileges");
    });

    it("allows admin caller to refund a paid order", async () => {
      const orderRepo = DIContainer.get<IOrderRepository>("IOrderRepository");
      const order = createResumeOrder({
        candidateId: "cand-refund-2",
        tier: "standard",
        originalResumeText: "Sample content"
      });
      order.paymentStatus = "paid";
      order.razorpayPaymentId = "pay_rzp_refund_test_2";
      await orderRepo.save(order);

      const userRepo = DIContainer.get<IUserRepository>("IUserRepository");
      let adminUser = await userRepo.findByEmail("admin.refund@example.com");
      if (!adminUser) {
        adminUser = await userRepo.createUser({
          email: "admin.refund@example.com",
          passwordHash: "dummy_hash",
          role: "admin"
        });
      }
      const adminToken = authService.generateToken(adminUser);

      const res = await request(app)
        .post(`/api/orders/${order.id}/refund`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ reason: "Customer cancellation request" });

      expect(res.status).toBe(200);
      expect(res.body.refundId).toBeDefined();
      expect(res.body.order.paymentStatus).toBe("refunded");

      const updated = await orderRepo.getById(order.id);
      expect(updated?.paymentStatus).toBe("refunded");
    });
  });
});
