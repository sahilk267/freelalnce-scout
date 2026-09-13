/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { User, UserInvite, UserRole, normalizeEmail } from "../models/User";
import { 
  IUserRepository, 
  CreateUserData, 
  UpdateUserData, 
  CreateInviteData 
} from "./IUserRepository";

export class SQLiteUserRepository implements IUserRepository {
  private db: Database.Database;
  private dbPath: string;

  constructor(customPath?: string) {
    this.dbPath = customPath || path.join(process.cwd(), "data", "users.sqlitedb");

    if (this.dbPath !== ":memory:") {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    try {
      this.db = new Database(this.dbPath);
      this.initializeSchema();
    } catch (error: any) {
      if (
        error.code === "SQLITE_CORRUPT" ||
        (error.message && (error.message.includes("corrupt") || error.message.includes("malformed")))
      ) {
        console.warn("[SQLiteUserRepository] Corrupt database file detected. Resetting database file:", error.message);
        try {
          if (fs.existsSync(this.dbPath) && this.dbPath !== ":memory:") {
            fs.unlinkSync(this.dbPath);
          }
        } catch (e) {
          console.error("[SQLiteUserRepository] Failed to remove corrupt database file:", e);
        }
        this.db = new Database(this.dbPath);
        this.initializeSchema();
      } else {
        throw error;
      }
    }
  }

  private initializeSchema(): void {
    this.db.pragma("journal_mode = WAL");

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        last_login_at TEXT,
        sessions_revoked_at TEXT,
        is_bootstrap_admin INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

      CREATE TABLE IF NOT EXISTS user_invites (
        token TEXT PRIMARY KEY,
        email TEXT,
        role TEXT NOT NULL,
        invited_by TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        used_at TEXT,
        used_by TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_user_invites_token ON user_invites(token);

      CREATE TABLE IF NOT EXISTS token_denylist (
        token_or_jti TEXT PRIMARY KEY,
        user_id TEXT,
        expires_at INTEGER NOT NULL,
        revoked_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_token_denylist_exp ON token_denylist(expires_at);
    `);

    // Ensure is_bootstrap_admin column exists on preexisting database files before index creation
    const columns = this.db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
    const hasBootstrapAdminCol = columns.some(c => c.name === "is_bootstrap_admin");
    if (!hasBootstrapAdminCol) {
      try {
        this.db.exec("ALTER TABLE users ADD COLUMN is_bootstrap_admin INTEGER NOT NULL DEFAULT 0");
      } catch (err: any) {
        console.warn("[SQLiteUserRepository] Could not add is_bootstrap_admin column:", err.message);
      }
    }

    try {
      this.db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_bootstrap_admin ON users(is_bootstrap_admin) WHERE is_bootstrap_admin = 1");
    } catch (err: any) {
      console.warn("[SQLiteUserRepository] Could not create idx_users_bootstrap_admin:", err.message);
    }
  }

  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role as UserRole,
      active: Boolean(row.active),
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at || undefined,
      sessionsRevokedAt: row.sessions_revoked_at || undefined
    };
  }

  private mapRowToInvite(row: any): UserInvite {
    return {
      token: row.token,
      email: row.email || undefined,
      role: row.role as UserRole,
      invitedBy: row.invited_by,
      expiresAt: row.expires_at,
      used: Boolean(row.used),
      createdAt: row.created_at,
      usedAt: row.used_at || undefined,
      usedBy: row.used_by || undefined
    };
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalized = normalizeEmail(email);
    const stmt = this.db.prepare("SELECT * FROM users WHERE email = ? LIMIT 1");
    const row = stmt.get(normalized);
    return row ? this.mapRowToUser(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const stmt = this.db.prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
    const row = stmt.get(id);
    return row ? this.mapRowToUser(row) : null;
  }

  async createUser(data: CreateUserData): Promise<User> {
    const normalized = normalizeEmail(data.email);
    const existing = await this.findByEmail(normalized);
    if (existing) {
      throw new Error(`User with email "${normalized}" already exists.`);
    }

    const id = data.id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const createdAt = new Date().toISOString();
    const active = data.active !== undefined ? (data.active ? 1 : 0) : 1;

    const isBootstrap = data.isBootstrapAdmin ? 1 : 0;

    const stmt = this.db.prepare(`
      INSERT INTO users (id, email, password_hash, role, active, created_at, is_bootstrap_admin)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    if (data.isBootstrapAdmin) {
      // Atomic check-and-insert transaction:
      // Verifies no users exist AND attempts insert with is_bootstrap_admin = 1.
      // If any user exists, or if another bootstrap insert committed concurrently,
      // the transaction or unique index aborts the insert.
      const atomicBootstrap = this.db.transaction(() => {
        const countRow = this.db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
        if (countRow.count > 0) {
          throw new Error("First admin has already been registered. Registration is now invite-only. A valid invite token is required. Please ask an existing admin for an invite.");
        }
        stmt.run(id, normalized, data.passwordHash, data.role, active, createdAt, 1);
      });

      try {
        atomicBootstrap();
      } catch (err: any) {
        if (err.message && (err.message.includes("UNIQUE constraint failed") || err.message.includes("First admin"))) {
          throw new Error("First admin has already been registered. Registration is now invite-only. A valid invite token is required. Please ask an existing admin for an invite.");
        }
        throw err;
      }
    } else {
      stmt.run(id, normalized, data.passwordHash, data.role, active, createdAt, 0);
    }

    return {
      id,
      email: normalized,
      passwordHash: data.passwordHash,
      role: data.role,
      active: Boolean(active),
      createdAt
    };
  }

  async updateUser(id: string, updates: UpdateUserData): Promise<User | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const sets: string[] = [];
    const params: any[] = [];

    if (updates.role !== undefined) {
      sets.push("role = ?");
      params.push(updates.role);
    }
    if (updates.active !== undefined) {
      sets.push("active = ?");
      params.push(updates.active ? 1 : 0);
    }
    if (updates.passwordHash !== undefined) {
      sets.push("password_hash = ?");
      params.push(updates.passwordHash);
    }
    if (updates.lastLoginAt !== undefined) {
      sets.push("last_login_at = ?");
      params.push(updates.lastLoginAt);
    }
    if (updates.sessionsRevokedAt !== undefined) {
      sets.push("sessions_revoked_at = ?");
      params.push(updates.sessionsRevokedAt);
    }

    if (sets.length === 0) return existing;

    params.push(id);
    const sql = `UPDATE users SET ${sets.join(", ")} WHERE id = ?`;
    this.db.prepare(sql).run(...params);

    return this.findById(id);
  }

  async listUsers(): Promise<User[]> {
    const stmt = this.db.prepare("SELECT * FROM users ORDER BY created_at ASC");
    const rows = stmt.all();
    return rows.map((r: any) => this.mapRowToUser(r));
  }

  async countUsers(): Promise<number> {
    const stmt = this.db.prepare("SELECT COUNT(*) as count FROM users");
    const result = stmt.get() as { count: number };
    return result?.count || 0;
  }

  async createInvite(data: CreateInviteData): Promise<UserInvite> {
    const token = data.token || `inv_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const expiresAt = data.expiresAt || new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const createdAt = new Date().toISOString();
    const email = data.email ? normalizeEmail(data.email) : null;

    const stmt = this.db.prepare(`
      INSERT INTO user_invites (token, email, role, invited_by, expires_at, used, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `);

    stmt.run(token, email, data.role, data.invitedBy, expiresAt, createdAt);

    return {
      token,
      email: email || undefined,
      role: data.role,
      invitedBy: data.invitedBy,
      expiresAt,
      used: false,
      createdAt
    };
  }

  async getInvite(token: string): Promise<UserInvite | null> {
    const stmt = this.db.prepare("SELECT * FROM user_invites WHERE token = ? LIMIT 1");
    const row = stmt.get(token);
    return row ? this.mapRowToInvite(row) : null;
  }

  async consumeInvite(token: string, usedByUserId: string): Promise<UserInvite | null> {
    const nowIso = new Date().toISOString();
    // Atomic update: only updates if token exists, used == 0, and expires_at > now
    const stmt = this.db.prepare(`
      UPDATE user_invites
      SET used = 1, used_at = ?, used_by = ?
      WHERE token = ? AND used = 0 AND datetime(expires_at) > datetime(?)
    `);

    const info = stmt.run(nowIso, usedByUserId, token, nowIso);
    if (info.changes === 0) {
      return null;
    }

    return this.getInvite(token);
  }

  async listPendingInvites(): Promise<UserInvite[]> {
    const nowIso = new Date().toISOString();
    const stmt = this.db.prepare(`
      SELECT * FROM user_invites
      WHERE used = 0 AND datetime(expires_at) > datetime(?)
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(nowIso);
    return rows.map((r: any) => this.mapRowToInvite(r));
  }

  async isTokenDenylisted(tokenOrJti: string): Promise<boolean> {
    const nowSec = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare("SELECT expires_at FROM token_denylist WHERE token_or_jti = ? LIMIT 1");
    const row = stmt.get(tokenOrJti) as { expires_at: number } | undefined;

    if (!row) return false;
    if (nowSec > row.expires_at) {
      // Lazy cleanup of expired entry
      this.db.prepare("DELETE FROM token_denylist WHERE token_or_jti = ?").run(tokenOrJti);
      return false;
    }
    return true;
  }

  async denylistToken(tokenOrJti: string, expiresAt: number, userId?: string): Promise<void> {
    const nowIso = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO token_denylist (token_or_jti, user_id, expires_at, revoked_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(tokenOrJti, userId || null, expiresAt, nowIso);
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    const nowIso = new Date().toISOString();
    const stmt = this.db.prepare("UPDATE users SET sessions_revoked_at = ? WHERE id = ?");
    stmt.run(nowIso, userId);
  }

  async clearTokenDenylist(): Promise<number> {
    const stmt = this.db.prepare("DELETE FROM token_denylist");
    const result = stmt.run();
    return result.changes;
  }

  isMigrationApplied(name: string): boolean {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS system_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);
    const row = this.db.prepare("SELECT name FROM system_migrations WHERE name = ? LIMIT 1").get(name);
    return Boolean(row);
  }

  markMigrationApplied(name: string): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS system_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);
    this.db.prepare("INSERT OR REPLACE INTO system_migrations (name, applied_at) VALUES (?, ?)").run(
      name,
      new Date().toISOString()
    );
  }

  close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}
