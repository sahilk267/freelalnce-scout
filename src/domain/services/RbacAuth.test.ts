/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { app, authService } from "../../../server";
import { 
  DIContainer, 
  IUserRepository, 
  SQLiteUserRepository, 
  InMemoryUserRepository, 
  AuthService 
} from "../index";

describe("Role-Based Access Control (RBAC) System Tests", () => {
  let userRepo: IUserRepository;
  const testPassword = "SecurePassword123!";

  beforeEach(() => {
    userRepo = DIContainer.get<IUserRepository>("IUserRepository");
  });

  describe("First-Boot Bootstrap & User Registration", () => {
    it("allows initial master admin registration in bootstrap mode, then disables bootstrap", async () => {
      const uniqueSuffix = Date.now();
      const adminEmail = `root_admin_${uniqueSuffix}@kernel.local`;

      // Check bootstrap status
      const statusRes = await request(app).get("/api/auth/bootstrap-status");
      expect(statusRes.status).toBe(200);

      const countBefore = await userRepo.countUsers();
      if (countBefore === 0) {
        expect(statusRes.body.bootstrapAvailable).toBe(true);

        // Register initial master admin
        const regRes = await request(app)
          .post("/api/auth/register")
          .send({ email: adminEmail, password: testPassword });

        expect(regRes.status).toBe(201);
        expect(regRes.body.user.role).toBe("admin");
        expect(regRes.body.token).toBeDefined();

        // Second registration without invite token must now fail
        const secondRes = await request(app)
          .post("/api/auth/register")
          .send({ email: `second_${uniqueSuffix}@kernel.local`, password: testPassword });

        expect(secondRes.status).toBe(400);
        expect(secondRes.body.error).toMatch(/invite token is required/i);
      } else {
        // If users already exist in persistent DB, registration without invite fails
        const regFail = await request(app)
          .post("/api/auth/register")
          .send({ email: `unauthorized_${uniqueSuffix}@kernel.local`, password: testPassword });

        expect(regFail.status).toBe(400);
        expect(regFail.body.error).toMatch(/invite token is required/i);
      }
    });

    it("handles concurrent first-admin registration race condition: exactly one becomes admin and the other receives an invite error", async () => {
      // Create a fresh isolated SQLite user repository with totalUsers = 0
      const isolatedRepo = new SQLiteUserRepository(":memory:");
      const testAuthService = new AuthService(isolatedRepo, "test-secret-at-least-32-chars-long-bootstrap-race");

      const initialCount = await isolatedRepo.countUsers();
      expect(initialCount).toBe(0);

      // Fire two concurrent registration requests at the exact same instant
      const [resA, resB] = await Promise.allSettled([
        testAuthService.register({ email: "racer_alpha@kernel.local", password: testPassword }),
        testAuthService.register({ email: "racer_beta@kernel.local", password: testPassword })
      ]);

      const fulfilled = [resA, resB].filter(r => r.status === "fulfilled") as PromiseFulfilledResult<any>[];
      const rejected = [resA, resB].filter(r => r.status === "rejected") as PromiseRejectedResult[];

      // Exactly one succeeds as admin
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      expect(fulfilled[0].value.user.role).toBe("admin");
      expect(["racer_alpha@kernel.local", "racer_beta@kernel.local"]).toContain(fulfilled[0].value.user.email);

      // The losing request receives a clear error directing them to ask an existing admin for an invite
      expect(rejected[0].reason.message).toMatch(/invite/i);
      expect(rejected[0].reason.message).toMatch(/admin/i);

      // Database state reflects strictly 1 user who is an admin
      const allUsers = await isolatedRepo.listUsers();
      expect(allUsers).toHaveLength(1);
      expect(allUsers[0].role).toBe("admin");

      isolatedRepo.close();
    });

    it("issues single-use invite tokens and rejects reuse", async () => {
      const uniqueSuffix = Date.now();
      // Ensure we have an admin
      let admin = await userRepo.findByEmail("admin_invite_issuer@kernel.local");
      if (!admin) {
        admin = await userRepo.createUser({
          email: "admin_invite_issuer@kernel.local",
          passwordHash: "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy",
          role: "admin",
          active: true
        });
      }

      // Generate invite
      const invite = await userRepo.createInvite({
        invitedBy: admin.id,
        role: "recruiter",
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      });

      expect(invite.token).toBeDefined();
      expect(invite.used).toBe(false);

      const recruiterEmail = `recruiter_${uniqueSuffix}@company.com`;

      // First redemption: succeeds
      const redeemRes = await request(app)
        .post("/api/auth/register")
        .send({
          email: recruiterEmail,
          password: testPassword,
          inviteToken: invite.token
        });

      expect(redeemRes.status).toBe(201);
      expect(redeemRes.body.user.email).toBe(recruiterEmail);
      expect(redeemRes.body.user.role).toBe("recruiter");

      // Second redemption with same token: rejected
      const reuseRes = await request(app)
        .post("/api/auth/register")
        .send({
          email: `second_attempt_${uniqueSuffix}@company.com`,
          password: testPassword,
          inviteToken: invite.token
        });

      expect(reuseRes.status).toBe(400);
      expect(reuseRes.body.error).toMatch(/redeemed|used|invalid|expired/i);
    });
  });

  describe("Token Verification & Security Edge Cases", () => {
    it("returns 401 for missing token", async () => {
      const res = await request(app).get("/api/candidates");
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/unauthorized/i);
    });

    it("returns 401 for invalid token", async () => {
      const res = await request(app)
        .get("/api/candidates")
        .set("Authorization", "Bearer invalid-tampered-token-123");

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid or expired/i);
    });

    it("returns 401 for expired token", async () => {
      const secret = process.env.JWT_SECRET!;
      // Construct expired token (-1 hour)
      const expiredToken = jwt.sign(
        {
          userId: "user_exp_123",
          email: "exp@example.com",
          role: "admin",
          tokenVersion: 1
        },
        secret,
        {
          algorithm: "HS256",
          expiresIn: "-1h",
          jwtid: "jti_expired_test"
        }
      );

      const res = await request(app)
        .get("/api/candidates")
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
    });

    it("returns 401 for revoked token", async () => {
      const uniqueSuffix = Date.now();
      const user = await userRepo.createUser({
        email: `revokeme_${uniqueSuffix}@kernel.local`,
        passwordHash: "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy",
        role: "recruiter",
        active: true
      });

      const token = authService.generateToken(user);

      // Verify token works before logout
      const beforeRes = await request(app)
        .get("/api/candidates")
        .set("Authorization", `Bearer ${token}`);
      expect(beforeRes.status).toBe(200);

      // Logout / Revoke token
      const logoutRes = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${token}`);
      expect(logoutRes.status).toBe(200);

      // Subsequent access with revoked token must fail with 401
      const afterRes = await request(app)
        .get("/api/candidates")
        .set("Authorization", `Bearer ${token}`);
      expect(afterRes.status).toBe(401);
      expect(afterRes.body.error).toMatch(/revoked/i);
    });
  });

  describe("Brute Force Rate Limiting", () => {
    it("triggers 429 when 5 failed login attempts occur within window", async () => {
      const uniqueEmail = `brute_victim_${Date.now()}@example.com`;

      // 5 consecutive failed attempts
      for (let i = 1; i <= 5; i++) {
        const res = await request(app)
          .post("/api/auth/login")
          .send({ email: uniqueEmail, password: "wrong-password" });

        expect(res.status).toBe(401);
      }

      // 6th attempt must be rejected with 429 Too Many Requests
      const blockedRes = await request(app)
        .post("/api/auth/login")
        .send({ email: uniqueEmail, password: "wrong-password" });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.error).toMatch(/too many failed login attempts/i);
      expect(blockedRes.body.retryAfterSec).toBeGreaterThan(0);
    });
  });

  describe("Role Privilege Enforcement (Admin vs Recruiter)", () => {
    let adminToken: string;
    let recruiterToken: string;

    beforeEach(async () => {
      const uniqueSuffix = Date.now();
      const adminUser = await userRepo.createUser({
        email: `admin_tester_${uniqueSuffix}@kernel.local`,
        passwordHash: "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy",
        role: "admin",
        active: true
      });
      adminToken = authService.generateToken(adminUser);

      const recruiterUser = await userRepo.createUser({
        email: `recruiter_tester_${uniqueSuffix}@kernel.local`,
        passwordHash: "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy",
        role: "recruiter",
        active: true
      });
      recruiterToken = authService.generateToken(recruiterUser);
    });

    it("allows recruiter to access general ATS and Candidate routes", async () => {
      const res = await request(app)
        .get("/api/candidates")
        .set("Authorization", `Bearer ${recruiterToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("forbids recruiter from executing terminal commands (403)", async () => {
      const res = await request(app)
        .post("/api/terminal/execute")
        .set("Authorization", `Bearer ${recruiterToken}`)
        .send({ command: "whoami" });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/forbidden|insufficient role privileges/i);
    });

    it("forbids recruiter from accessing persistence backup (403)", async () => {
      const res = await request(app)
        .get("/api/persistence/backup")
        .set("Authorization", `Bearer ${recruiterToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/forbidden|insufficient role privileges/i);
    });

    it("forbids recruiter from deleting resources (403)", async () => {
      const res = await request(app)
        .delete("/api/candidates/cand-1")
        .set("Authorization", `Bearer ${recruiterToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/forbidden|insufficient role privileges/i);
    });

    it("allows admin to access terminal execution", async () => {
      const res = await request(app)
        .post("/api/terminal/execute")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("X-Confirm-Dangerous-Action", "true")
        .send({ command: "echo 'hello admin'" });

      expect(res.status).toBe(200);
      expect(res.body.output).toBeDefined();
    });

    it("allows admin to access admin-only endpoints", async () => {
      // Admin should have access to admin-only user management directory
      const usersRes = await request(app)
        .get("/api/auth/users")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(usersRes.status).toBe(200);
      expect(Array.isArray(usersRes.body)).toBe(true);

      // Verify recruiter is blocked from accessing user management directory
      const recruiterRes = await request(app)
        .get("/api/auth/users")
        .set("Authorization", `Bearer ${recruiterToken}`);

      expect(recruiterRes.status).toBe(403);

      // Persistence endpoint allows admin through authorization gate (not 401 or 403)
      const res = await request(app)
        .get("/api/persistence/status")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
    });
  });

  describe("Backward Compatibility: AZIZ_API_KEY Machine Auth", () => {
    it("allows requests using AZIZ_API_KEY header with fallback admin role", async () => {
      const apiKey = process.env.AZIZ_API_KEY || "test-m2m-key-xyz";
      process.env.AZIZ_API_KEY = apiKey;

      const res = await request(app)
        .get("/api/candidates")
        .set("X-API-Key", apiKey);

      expect(res.status).toBe(200);
    });
  });

  describe("Cookie-Based Authentication & Double-Submit CSRF Protection", () => {
    let testAdmin: any;
    const testAdminPassword = "SecurePassword123!";

    const extractCookies = (res: request.Response): string[] => {
      const raw = res.headers["set-cookie"];
      if (!raw) return [];
      return Array.isArray(raw) ? raw : [raw];
    };

    beforeEach(async () => {
      const email = `cookie_user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}@kernel.local`;
      const passwordHash = await bcrypt.hash(testAdminPassword, 10);
      testAdmin = await userRepo.createUser({
        email,
        passwordHash,
        role: "admin",
        active: true
      });
    });

    it("POST /api/auth/login sets aziz_session (HttpOnly) and csrf_token (non-HttpOnly) cookies and returns NO token in body by default", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: testAdmin.email, password: testAdminPassword });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeUndefined(); // Token NOT exposed in JSON body for browser
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(testAdmin.email);

      const setCookies = extractCookies(res);
      expect(setCookies.length).toBeGreaterThan(0);

      const sessionCookie = setCookies.find((c: string) => c.startsWith("aziz_session="));
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toMatch(/httponly/i);
      expect(sessionCookie).toMatch(/samesite=strict/i);

      const csrfCookie = setCookies.find((c: string) => c.startsWith("csrf_token="));
      expect(csrfCookie).toBeDefined();
      expect(csrfCookie).not.toMatch(/httponly/i); // Readable by client JS
      expect(csrfCookie).toMatch(/samesite=strict/i);
    });

    it("POST /api/auth/login with grantType: 'service_account' returns JWT in JSON body and does NOT set aziz_session cookie", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: testAdmin.email, password: testAdminPassword, grantType: "service_account" });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined(); // Token returned in JSON body for scripts/CI
      expect(typeof res.body.token).toBe("string");
      expect(res.body.grantType).toBe("service_account");

      const setCookies = extractCookies(res);
      const sessionCookie = setCookies.find((c: string) => c.startsWith("aziz_session="));
      expect(sessionCookie).toBeUndefined();
    });

    it("Cookie-based authenticated requests work for GET endpoints", async () => {
      // 1. Login to get cookies
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: testAdmin.email, password: testAdminPassword });

      const setCookies = extractCookies(loginRes);
      const sessionCookie = setCookies.find((c: string) => c.startsWith("aziz_session="));
      expect(sessionCookie).toBeDefined();
      const sessionCookieStr = sessionCookie!.split(";")[0];

      // 2. GET request with aziz_session cookie (GET is exempt from CSRF)
      const res = await request(app)
        .get("/api/auth/me")
        .set("Cookie", [sessionCookieStr]);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe(testAdmin.email);
    });

    it("Cookie-based authenticated POST requests succeed when matching X-CSRF-Token header is supplied", async () => {
      // 1. Login to get cookies
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: testAdmin.email, password: testAdminPassword });

      const setCookies = extractCookies(loginRes);
      const sessionCookieStr = setCookies.find((c: string) => c.startsWith("aziz_session="))!.split(";")[0];
      const csrfCookiePart = setCookies.find((c: string) => c.startsWith("csrf_token="))!.split(";")[0];
      const csrfToken = csrfCookiePart.split("=")[1];

      // 2. POST with cookie + matching X-CSRF-Token header
      const res = await request(app)
        .post("/api/candidates")
        .set("Cookie", [sessionCookieStr, csrfCookiePart])
        .set("X-CSRF-Token", csrfToken)
        .send({ name: "CSRF Valid Candidate", email: "csrf_valid@example.com" });

      expect(res.status).toBe(201);
    });

    it("Cookie-based authenticated POST requests fail with 403 when X-CSRF-Token is missing or mismatched", async () => {
      // 1. Login to get cookies
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: testAdmin.email, password: testAdminPassword });

      const setCookies = extractCookies(loginRes);
      const sessionCookieStr = setCookies.find((c: string) => c.startsWith("aziz_session="))!.split(";")[0];
      const csrfCookiePart = setCookies.find((c: string) => c.startsWith("csrf_token="))!.split(";")[0];

      // Missing header -> 403
      const missingHeaderRes = await request(app)
        .post("/api/candidates")
        .set("Cookie", [sessionCookieStr, csrfCookiePart])
        .send({ name: "CSRF Invalid Candidate" });

      expect(missingHeaderRes.status).toBe(403);
      expect(missingHeaderRes.body.error).toMatch(/CSRF token validation failed/i);

      // Mismatched header -> 403
      const mismatchedHeaderRes = await request(app)
        .post("/api/candidates")
        .set("Cookie", [sessionCookieStr, csrfCookiePart])
        .set("X-CSRF-Token", "forged-or-wrong-csrf-token")
        .send({ name: "CSRF Invalid Candidate" });

      expect(mismatchedHeaderRes.status).toBe(403);
      expect(mismatchedHeaderRes.body.error).toMatch(/CSRF token validation failed/i);
    });

    it("Bearer token requests (service account flow) work WITHOUT a CSRF token", async () => {
      const token = authService.generateToken(testAdmin);

      // POST with Authorization: Bearer and NO CSRF token header
      const res = await request(app)
        .post("/api/candidates")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Service Account Candidate", email: "sa_candidate@example.com" });

      expect(res.status).toBe(201);
    });

    it("POST /api/auth/logout clears cookies AND revokes token", async () => {
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ email: testAdmin.email, password: testAdminPassword });

      const setCookies = extractCookies(loginRes);
      const sessionCookieStr = setCookies.find((c: string) => c.startsWith("aziz_session="))!.split(";")[0];
      const sessionToken = sessionCookieStr.split("=")[1];
      const csrfCookiePart = setCookies.find((c: string) => c.startsWith("csrf_token="))!.split(";")[0];
      const csrfToken = csrfCookiePart.split("=")[1];

      // Logout request
      const logoutRes = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", [sessionCookieStr, csrfCookiePart])
        .set("X-CSRF-Token", csrfToken);

      expect(logoutRes.status).toBe(200);

      // Verify Set-Cookie header clears cookies with max-age=0 or expires
      const logoutCookies = extractCookies(logoutRes);
      expect(logoutCookies.length).toBeGreaterThan(0);
      const clearedSession = logoutCookies.find((c: string) => c.startsWith("aziz_session="));
      expect(clearedSession).toMatch(/max-age=0|expires=/i);

      const clearedCsrf = logoutCookies.find((c: string) => c.startsWith("csrf_token="));
      expect(clearedCsrf).toMatch(/max-age=0|expires=/i);

      // Attempt to access protected endpoint using previous token (even as Bearer token) must fail (denylist check)
      const blockedRes = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${sessionToken}`);

      expect(blockedRes.status).toBe(401);
      expect(blockedRes.body.error).toMatch(/revoked/i);
    });
  });
});
