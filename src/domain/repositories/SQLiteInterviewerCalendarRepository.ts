/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { 
  CalendarConnectionStatus, 
  InterviewerCalendarAccount, 
  WorkingHoursConfig 
} from "../models/InterviewerCalendarAccount";
import { IInterviewerCalendarRepository } from "./IInterviewerCalendarRepository";

export class SQLiteInterviewerCalendarRepository implements IInterviewerCalendarRepository {
  private db: Database.Database;
  private dbPath: string;

  constructor(customPath?: string) {
    this.dbPath = customPath || path.join(process.cwd(), "data", "calendar_accounts.sqlitedb");

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
        console.warn("[SQLiteInterviewerCalendarRepository] Corrupt database file detected. Resetting:", error.message);
        try {
          if (fs.existsSync(this.dbPath) && this.dbPath !== ":memory:") {
            fs.unlinkSync(this.dbPath);
          }
        } catch (e) {
          console.error("[SQLiteInterviewerCalendarRepository] Failed to delete corrupt database:", e);
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
      CREATE TABLE IF NOT EXISTS interviewer_calendar_accounts (
        interviewer_id TEXT PRIMARY KEY,
        interviewer_name TEXT,
        interviewer_email TEXT,
        encrypted_refresh_token TEXT NOT NULL,
        scope TEXT NOT NULL,
        connected_at TEXT NOT NULL,
        status TEXT NOT NULL,
        last_sync_at TEXT,
        last_error TEXT,
        working_hours_json TEXT
      );
    `);
  }

  async saveAccount(account: InterviewerCalendarAccount): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO interviewer_calendar_accounts (
        interviewer_id,
        interviewer_name,
        interviewer_email,
        encrypted_refresh_token,
        scope,
        connected_at,
        status,
        last_sync_at,
        last_error,
        working_hours_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(interviewer_id) DO UPDATE SET
        interviewer_name = excluded.interviewer_name,
        interviewer_email = excluded.interviewer_email,
        encrypted_refresh_token = excluded.encrypted_refresh_token,
        scope = excluded.scope,
        connected_at = excluded.connected_at,
        status = excluded.status,
        last_sync_at = excluded.last_sync_at,
        last_error = excluded.last_error,
        working_hours_json = COALESCE(excluded.working_hours_json, interviewer_calendar_accounts.working_hours_json);
    `);

    stmt.run(
      account.interviewerId,
      account.interviewerName || null,
      account.interviewerEmail || null,
      account.encryptedRefreshToken,
      account.scope,
      account.connectedAt,
      account.status,
      account.lastSyncAt || new Date().toISOString(),
      account.lastError || null,
      account.workingHours ? JSON.stringify(account.workingHours) : null
    );
  }

  async getAccount(interviewerId: string): Promise<InterviewerCalendarAccount | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM interviewer_calendar_accounts WHERE interviewer_id = ?
    `);
    const row = stmt.get(interviewerId) as any;
    if (!row) return null;

    return this.mapRowToAccount(row);
  }

  async listAccounts(): Promise<InterviewerCalendarAccount[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM interviewer_calendar_accounts ORDER BY connected_at DESC
    `);
    const rows = stmt.all() as any[];
    return rows.map((r) => this.mapRowToAccount(r));
  }

  async updateStatus(interviewerId: string, status: CalendarConnectionStatus, error?: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE interviewer_calendar_accounts
      SET status = ?, last_error = ?, last_sync_at = ?
      WHERE interviewer_id = ?
    `);
    stmt.run(status, error || null, new Date().toISOString(), interviewerId);
  }

  async updateWorkingHours(interviewerId: string, config: WorkingHoursConfig): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE interviewer_calendar_accounts
      SET working_hours_json = ?, last_sync_at = ?
      WHERE interviewer_id = ?
    `);
    stmt.run(JSON.stringify(config), new Date().toISOString(), interviewerId);
  }

  async deleteAccount(interviewerId: string): Promise<void> {
    const stmt = this.db.prepare(`
      DELETE FROM interviewer_calendar_accounts WHERE interviewer_id = ?
    `);
    stmt.run(interviewerId);
  }

  private mapRowToAccount(row: any): InterviewerCalendarAccount {
    let workingHours: WorkingHoursConfig | undefined = undefined;
    if (row.working_hours_json) {
      try {
        workingHours = JSON.parse(row.working_hours_json);
      } catch (e) {
        workingHours = undefined;
      }
    }

    return {
      interviewerId: row.interviewer_id,
      interviewerName: row.interviewer_name || undefined,
      interviewerEmail: row.interviewer_email || undefined,
      encryptedRefreshToken: row.encrypted_refresh_token,
      scope: row.scope,
      connectedAt: row.connected_at,
      status: row.status as CalendarConnectionStatus,
      lastSyncAt: row.last_sync_at || undefined,
      lastError: row.last_error || undefined,
      workingHours
    };
  }
}
