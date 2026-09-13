/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { execSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import request from "supertest";
import { google } from "googleapis";
import { validateJwtSecret } from "../../../server";
import { getEncryptionKey, encryptRefreshToken, decryptRefreshToken } from "../utils/calendarEncryption";
import { runSecuritySecretRotationMigration, SECURITY_MIGRATION_KEY } from "./SecurityRotationMigration";
import { AuthService } from "./AuthService";
import { InMemoryUserRepository } from "../repositories/InMemoryUserRepository";
import { SQLiteUserRepository } from "../repositories/SQLiteUserRepository";
import { app } from "../../../server";

describe("Security Audit: Fail-Closed Zero-Trust Secrets Enforcement", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  describe("1. JWT_SECRET Fail-Closed Boot Requirement", () => {
    it("fails and exits when JWT_SECRET is unset, empty, or shorter than 32 characters", () => {
      // Unset / undefined
      expect(() => validateJwtSecret(undefined)).toThrow(/process\.exit|FATAL.*JWT_SECRET/);

      // Empty string
      expect(() => validateJwtSecret("")).toThrow(/process\.exit|FATAL.*JWT_SECRET/);

      // Under 32 chars (e.g. 31 chars)
      const shortSecret = "1234567890123456789012345678901"; // 31 chars
      expect(() => validateJwtSecret(shortSecret)).toThrow(/process\.exit|FATAL.*JWT_SECRET/);

      // Whitespace only
      expect(() => validateJwtSecret("   ")).toThrow(/process\.exit|FATAL.*JWT_SECRET/);
    });

    it("accepts valid JWT_SECRET of >= 32 characters and trims whitespace", () => {
      const validSecret = "a_very_secure_random_jwt_secret_key_that_is_long_enough_12345";
      const result = validateJwtSecret(`  ${validSecret}  `);
      expect(result).toBe(validSecret);
    });

    it("ensures child process running server refuses to start when JWT_SECRET is missing", () => {
      const child = spawnSync(
        "npx",
        ["tsx", "-e", 'process.env.JWT_SECRET = ""; import("./server.ts");'],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          timeout: 10000
        }
      );

      expect(child.status).toBe(1);
      const combinedOutput = (child.stdout || "") + (child.stderr || "");
      expect(combinedOutput).toContain("JWT_SECRET is missing or too short");
    });

    it("verifies data/.jwt_secret is not created on disk and does not exist", () => {
      const secretFile = path.join(process.cwd(), "data", ".jwt_secret");
      expect(fs.existsSync(secretFile)).toBe(false);
    });

    it("verifies .gitignore contains explicit data/.jwt_secret entry", () => {
      const gitignore = fs.readFileSync(path.join(process.cwd(), ".gitignore"), "utf8");
      expect(gitignore).toMatch(/^data\/\.jwt_secret$/m);
    });

    it("verifies .env.example contains openssl generator instructions and no fake secrets", () => {
      const envExample = fs.readFileSync(path.join(process.cwd(), ".env.example"), "utf8");
      expect(envExample).toContain("generate with: openssl rand -hex 32");
      expect(envExample).toMatch(/JWT_SECRET=\r?\n/);
      expect(envExample).not.toContain("YOUR_JWT_SECRET_HERE");
      expect(envExample).toMatch(/CALENDAR_TOKEN_ENCRYPTION_KEY=\r?\n/);
    });
  });

  describe("2. CALENDAR_TOKEN_ENCRYPTION_KEY Fail-Closed Behavior", () => {
    it("throws immediately when CALENDAR_TOKEN_ENCRYPTION_KEY is unset", () => {
      delete process.env.CALENDAR_TOKEN_ENCRYPTION_KEY;
      expect(() => getEncryptionKey()).toThrow(
        /CALENDAR_TOKEN_ENCRYPTION_KEY.*missing or too short/i
      );
      expect(() => encryptRefreshToken("test_token")).toThrow(
        /CALENDAR_TOKEN_ENCRYPTION_KEY.*missing or too short/i
      );
    });

    it("throws immediately when CALENDAR_TOKEN_ENCRYPTION_KEY is under 32 characters", () => {
      process.env.CALENDAR_TOKEN_ENCRYPTION_KEY = "short_key_16_chr";
      expect(() => getEncryptionKey()).toThrow(
        /CALENDAR_TOKEN_ENCRYPTION_KEY.*missing or too short/i
      );
      expect(() => encryptRefreshToken("test_token")).toThrow(
        /CALENDAR_TOKEN_ENCRYPTION_KEY.*missing or too short/i
      );
    });

    it("successfully derives key and encrypts/decrypts when CALENDAR_TOKEN_ENCRYPTION_KEY >= 32 chars", () => {
      process.env.CALENDAR_TOKEN_ENCRYPTION_KEY = "32_byte_hex_or_base64_secure_encryption_key_2026";
      const token = "sample_oauth_refresh_token_xyz_987654321";
      const encrypted = encryptRefreshToken(token);
      expect(encrypted).not.toEqual(token);
      const decrypted = decryptRefreshToken(encrypted);
      expect(decrypted).toEqual(token);
    });

    it("fails with HTTP 500 and clear error when calendar OAuth callback is hit without key configured", async () => {
      delete process.env.CALENDAR_TOKEN_ENCRYPTION_KEY;

      // Mock OAuth2 getToken to return a refresh token, triggering token encryption
      vi.spyOn(google.auth.OAuth2.prototype, "getToken").mockResolvedValue({
        tokens: {
          refresh_token: "google_oauth_refresh_token_test_12345",
          scope: "https://www.googleapis.com/auth/calendar.events"
        }
      } as any);

      const statePayload = Buffer.from(JSON.stringify({ interviewerId: "int_test_sec_1" })).toString("base64url");
      
      const res = await request(app)
        .get(`/api/calendar/oauth/callback?code=mock_code&state=${statePayload}`);
      
      expect(res.status).toBe(500);
      expect(res.text).toContain("CALENDAR_TOKEN_ENCRYPTION_KEY is unset or too short");
    });
  });

  describe("3. Repository Leaked Strings Regression Guard", () => {
    it("asserts zero occurrences of leaked fallback strings across the entire repository", () => {
      // The two strings that were previously leaked in source code:
      const forbiddenStrings = [
        ["fail_closed", "vault_secret"].join("_"),
        ["calendar", "default", "encryption_key"].join("_")
      ];

      for (const forbidden of forbiddenStrings) {
        // Run grep excluding .git, node_modules, dist, and this test file
        const grepCmd = `grep -rn "${forbidden}" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude="FailClosedSecretsSecurity.test.ts" || true`;
        const output = execSync(grepCmd, { encoding: "utf8" }).trim();
        expect(output, `Expected zero matches for forbidden fallback string: ${forbidden}`).toBe("");
      }
    });
  });

  describe("4. Security Secret Rotation Migration", () => {
    it("clears token denylist and invalidates all existing user sessions on startup", async () => {
      const userRepo = new InMemoryUserRepository();
      const authService = new AuthService(userRepo, "test_jwt_secret_with_32_characters_minimum_len");

      // 1. Create 2 test users
      const user1 = await userRepo.createUser({
        email: "alice@example.com",
        passwordHash: "hash1",
        role: "admin"
      });
      const user2 = await userRepo.createUser({
        email: "bob@example.com",
        passwordHash: "hash2",
        role: "recruiter"
      });

      // 2. Add tokens to denylist
      await userRepo.denylistToken("legacy_token_1", Date.now() + 3600000, user1.id);
      await userRepo.denylistToken("legacy_token_2", Date.now() + 3600000, user2.id);

      expect(await userRepo.isTokenDenylisted("legacy_token_1")).toBe(true);
      expect(await userRepo.isTokenDenylisted("legacy_token_2")).toBe(true);

      // 3. Issue a token before rotation
      const preRotationToken = jwt.sign(
        { sub: user1.id, role: "admin", iat: Math.floor((Date.now() - 5000) / 1000) },
        "test_jwt_secret_with_32_characters_minimum_len"
      );

      // 4. Run migration
      const result = await runSecuritySecretRotationMigration(authService, userRepo, { force: true });
      expect(result.applied).toBe(true);
      expect(result.usersRevoked).toBe(2);
      expect(result.denylistCleared).toBe(2);

      // 5. Verify token denylist was completely cleared
      expect(await userRepo.isTokenDenylisted("legacy_token_1")).toBe(false);
      expect(await userRepo.isTokenDenylisted("legacy_token_2")).toBe(false);

      // 6. Verify pre-rotation token is rejected by authService because sessionsRevokedAt was bumped
      await expect(authService.verifyToken(preRotationToken)).rejects.toThrow(
        /session has been revoked/i
      );

      // 7. Verify subsequent run does not re-apply unless forced
      const rerunResult = await runSecuritySecretRotationMigration(authService, userRepo);
      expect(rerunResult.applied).toBe(false);
      expect(rerunResult.reason).toContain("already applied");
    });

    it("works correctly on SQLiteUserRepository with persistent system_migrations record", async () => {
      const sqliteRepo = new SQLiteUserRepository(":memory:");
      const authService = new AuthService(sqliteRepo, "test_jwt_secret_with_32_characters_minimum_len");

      await sqliteRepo.createUser({
        email: "sqlite_user@example.com",
        passwordHash: "hash",
        role: "admin"
      });
      await sqliteRepo.denylistToken("denylisted_jwt", Date.now() + 10000);

      const result = await runSecuritySecretRotationMigration(authService, sqliteRepo, { force: true });
      expect(result.applied).toBe(true);
      expect(result.usersRevoked).toBe(1);
      expect(result.denylistCleared).toBe(1);

      expect(sqliteRepo.isMigrationApplied(SECURITY_MIGRATION_KEY)).toBe(true);
      sqliteRepo.close();
    });
  });
});
