/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs";
import path from "path";
import { AuthService } from "./AuthService";
import { IUserRepository } from "../repositories/IUserRepository";

export interface SecurityMigrationResult {
  applied: boolean;
  usersRevoked: number;
  denylistCleared: number;
  reason?: string;
}

export const SECURITY_MIGRATION_KEY = "security_secret_rotation_2026_09";

/**
 * Executes a one-time automatic security migration on server boot:
 * 1. Clears the entire token denylist table.
 * 2. Bumps all existing users' sessionsRevokedAt to now (invalidating any tokens signed
 *    by the former leaked fallback secret or legitimately issued before rotation).
 * 3. Marks the migration as applied so it runs exactly once.
 */
export async function runSecuritySecretRotationMigration(
  authService: AuthService,
  userRepo: IUserRepository,
  options: { force?: boolean } = {}
): Promise<SecurityMigrationResult> {
  const markerPath = path.join(process.cwd(), "data", ".security_rotation_applied");

  const hasDbMigrationCheck = typeof (userRepo as any).isMigrationApplied === "function";
  const isAlreadyApplied = !options.force && (
    (hasDbMigrationCheck && (userRepo as any).isMigrationApplied(SECURITY_MIGRATION_KEY)) ||
    fs.existsSync(markerPath)
  );

  if (isAlreadyApplied) {
    return {
      applied: false,
      usersRevoked: 0,
      denylistCleared: 0,
      reason: "Security secret rotation migration already applied previously."
    };
  }

  // 1. Clear the entire token denylist table
  let denylistCleared = 0;
  if (typeof (userRepo as any).clearTokenDenylist === "function") {
    denylistCleared = await (userRepo as any).clearTokenDenylist();
  }

  // 2. Bump all existing users' sessionsRevokedAt to now
  const usersRevoked = await authService.invalidateAllExistingSessions();

  // 3. Mark migration as permanently recorded
  if (typeof (userRepo as any).markMigrationApplied === "function") {
    (userRepo as any).markMigrationApplied(SECURITY_MIGRATION_KEY);
  }

  try {
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(
      markerPath,
      JSON.stringify(
        {
          migration: SECURITY_MIGRATION_KEY,
          appliedAt: new Date().toISOString(),
          usersRevoked,
          denylistCleared,
          description: "One-time security migration clearing token denylist and invalidating pre-rotation user sessions."
        },
        null,
        2
      ),
      "utf8"
    );
  } catch (err: any) {
    console.warn("[SecurityMigration] Warning: Could not write file marker (DB state used):", err?.message);
  }

  console.log(
    `[SECURITY_MIGRATION] One-time security secret rotation executed: Cleared token denylist (${denylistCleared} entries) and revoked all existing sessions across ${usersRevoked} users.`
  );

  return {
    applied: true,
    usersRevoked,
    denylistCleared
  };
}
