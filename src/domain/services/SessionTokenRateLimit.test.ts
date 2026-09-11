/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { 
  app, 
  getClientIp, 
  checkFailedSessionTokenRateLimit, 
  recordFailedSessionTokenAttempt, 
  clearFailedSessionTokenAttempts, 
  failedSessionTokenAttemptsMap 
} from "../../../server";

describe("Session Token Rate Limiting & Memory Eviction Tests", () => {
  beforeEach(() => {
    clearFailedSessionTokenAttempts();
  });

  describe("Proxy Trust Configuration", () => {
    it("has trust proxy properly configured to trust reverse proxy hops", () => {
      // app.get('trust proxy') returns 1 or a configured trust proxy resolver function
      const trustProxy = app.get("trust proxy");
      expect(trustProxy).toBeDefined();
      expect(Boolean(trustProxy)).toBe(true);
    });
  });

  describe("getClientIp Utility & Spoofing Defense", () => {
    it("extracts valid IPv4 and IPv6 addresses", () => {
      const mockReqIpv4 = {
        ip: "198.51.100.42",
        socket: { remoteAddress: "198.51.100.42" }
      } as any;
      expect(getClientIp(mockReqIpv4)).toBe("198.51.100.42");

      const mockReqIpv6 = {
        ip: "2001:db8::1",
        socket: { remoteAddress: "2001:db8::1" }
      } as any;
      expect(getClientIp(mockReqIpv6)).toBe("2001:db8::1");
    });

    it("normalizes IPv4-mapped IPv6 addresses (::ffff:)", () => {
      const mockReq = {
        ip: "::ffff:203.0.113.195",
        socket: { remoteAddress: "::ffff:203.0.113.195" }
      } as any;
      expect(getClientIp(mockReq)).toBe("203.0.113.195");
    });

    it("rejects malicious, injection, or invalid IP strings and falls back safely", () => {
      const mockReqMalicious = {
        ip: "evil.attacker.com' OR 1=1--",
        socket: { remoteAddress: "192.0.2.88" }
      } as any;
      expect(getClientIp(mockReqMalicious)).toBe("192.0.2.88");

      const mockReqCompletelyInvalid = {
        ip: "invalid_string",
        socket: { remoteAddress: "not_an_ip" }
      } as any;
      expect(getClientIp(mockReqCompletelyInvalid)).toBe("unknown_client");
    });
  });

  describe("Lockout and Rate Limiting Behavior", () => {
    it("allows up to 9 failed attempts and locks out on the 10th attempt", () => {
      const clientIp = "198.51.100.10";

      // 9 failed attempts should still allow requests
      for (let i = 1; i <= 9; i++) {
        recordFailedSessionTokenAttempt(clientIp);
        const req = { ip: clientIp, socket: { remoteAddress: clientIp } } as any;
        let respondedStatus = 0;
        const res = {
          status: (code: number) => {
            respondedStatus = code;
            return { json: () => {} };
          }
        } as any;

        const allowed = checkFailedSessionTokenRateLimit(req, res);
        expect(allowed).toBe(true);
        expect(respondedStatus).toBe(0);
      }

      // 10th failed attempt triggers lockout
      recordFailedSessionTokenAttempt(clientIp);
      {
        const req = { ip: clientIp, socket: { remoteAddress: clientIp } } as any;
        let respondedStatus = 0;
        let errorBody: any = null;
        const res = {
          status: (code: number) => {
            respondedStatus = code;
            return {
              json: (body: any) => {
                errorBody = body;
              }
            };
          }
        } as any;

        const allowed = checkFailedSessionTokenRateLimit(req, res);
        expect(allowed).toBe(false);
        expect(respondedStatus).toBe(429);
        expect(errorBody.error).toMatch(/too many failed session authentication attempts/i);
      }
    });

    it("does not lock out other IP addresses when one IP is locked out", () => {
      const badIp = "198.51.100.99";
      const goodIp = "198.51.100.100";

      for (let i = 0; i < 10; i++) {
        recordFailedSessionTokenAttempt(badIp);
      }

      // Bad IP is locked out
      const reqBad = { ip: badIp, socket: { remoteAddress: badIp } } as any;
      const resBad = { status: () => ({ json: () => {} }) } as any;
      expect(checkFailedSessionTokenRateLimit(reqBad, resBad)).toBe(false);

      // Good IP is unaffected
      const reqGood = { ip: goodIp, socket: { remoteAddress: goodIp } } as any;
      const resGood = { status: () => ({ json: () => {} }) } as any;
      expect(checkFailedSessionTokenRateLimit(reqGood, resGood)).toBe(true);
    });
  });

  describe("Memory Eviction & Bounded Storage", () => {
    it("lazily evicts expired records upon access", () => {
      const ip = "198.51.100.55";
      recordFailedSessionTokenAttempt(ip);

      const entry = failedSessionTokenAttemptsMap.get(ip);
      expect(entry).toBeDefined();

      // Simulate expiration
      if (entry) {
        entry.resetAt = Date.now() - 1000;
      }

      const req = { ip, socket: { remoteAddress: ip } } as any;
      const res = { status: () => ({ json: () => {} }) } as any;
      const allowed = checkFailedSessionTokenRateLimit(req, res);

      expect(allowed).toBe(true);
      // Entry should now be evicted from the map
      expect(failedSessionTokenAttemptsMap.has(ip)).toBe(false);
    });

    it("resets attempt count after expiration window when a new attempt is recorded", () => {
      const ip = "198.51.100.66";
      for (let i = 0; i < 5; i++) {
        recordFailedSessionTokenAttempt(ip);
      }
      expect(failedSessionTokenAttemptsMap.get(ip)?.count).toBe(5);

      // Force expiration
      const entry = failedSessionTokenAttemptsMap.get(ip);
      if (entry) {
        entry.resetAt = Date.now() - 1000;
      }

      // Record new attempt after expiration
      recordFailedSessionTokenAttempt(ip);
      const updatedEntry = failedSessionTokenAttemptsMap.get(ip);
      expect(updatedEntry?.count).toBe(1);
    });

    it("enforces bounded storage and does not grow unbounded under high volume", () => {
      // Simulate populating entries past threshold
      for (let i = 0; i < 5100; i++) {
        const fakeIp = `10.${Math.floor(i / 256)}.${i % 256}.1`;
        recordFailedSessionTokenAttempt(fakeIp);
      }

      // Map size must remain bounded and not exceed 5000 + burst
      expect(failedSessionTokenAttemptsMap.size).toBeLessThanOrEqual(5000);
    });
  });

  describe("API Endpoint Rate Limit Integration", () => {
    it("returns 429 Too Many Requests on candidate endpoint after repeated failed token attempts", async () => {
      const testSessionId = "session-rate-limit-test-123";

      // 10 failed attempts with invalid token
      for (let i = 0; i < 10; i++) {
        const res = await request(app)
          .get(`/api/scheduling/slots/${testSessionId}`)
          .set("X-Session-Token", `bad-token-${i}`);
        expect(res.status).toBe(401);
      }

      // Subsequent attempt triggers 429 lockout
      const resLocked = await request(app)
        .get(`/api/scheduling/slots/${testSessionId}`)
        .set("X-Session-Token", "bad-token-subsequent");
      expect(resLocked.status).toBe(429);
      expect(resLocked.body.error).toMatch(/too many failed session authentication attempts/i);

      // Subsequent attempt even on cancel booking endpoint receives 429
      const resCancel = await request(app)
        .post("/api/scheduling/cancel")
        .set("X-Session-Token", "bad-token-11")
        .send({ sessionId: testSessionId, reason: "Candidate canceled" });
      expect(resCancel.status).toBe(429);
    });
  });
});
