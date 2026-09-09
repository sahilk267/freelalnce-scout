/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { ScreeningSession } from "../models/ScreeningSession";
import { IScreeningRepository } from "./IScreeningRepository";

export class SQLiteScreeningRepository implements IScreeningRepository {
  private db: Database.Database;
  private dbPath: string;

  constructor(customPath?: string) {
    this.dbPath = customPath || path.join(process.cwd(), "screening_sessions.sqlitedb");

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
        console.warn("[SQLiteScreeningRepository] Corrupt DB detected, resetting file:", error.message);
        try {
          if (fs.existsSync(this.dbPath) && this.dbPath !== ":memory:") {
            fs.unlinkSync(this.dbPath);
          }
        } catch (e) {
          console.error("[SQLiteScreeningRepository] Failed to delete corrupt DB file:", e);
        }
        this.db = new Database(this.dbPath);
        this.initializeSchema();
      } else {
        throw error;
      }
    }
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS screening_sessions (
        id TEXT PRIMARY KEY,
        candidate_id TEXT NOT NULL,
        job_id TEXT NOT NULL,
        job_title TEXT NOT NULL,
        job_requirements TEXT NOT NULL,
        session_token TEXT NOT NULL,
        status TEXT NOT NULL,
        messages TEXT NOT NULL,
        evaluation TEXT,
        human_review TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_interaction_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_screening_candidate_id ON screening_sessions(candidate_id);
      CREATE INDEX IF NOT EXISTS idx_screening_job_id ON screening_sessions(job_id);
      CREATE INDEX IF NOT EXISTS idx_screening_session_token ON screening_sessions(session_token);
    `);
  }

  public close(): void {
    try {
      this.db.close();
    } catch (e) {
      // Ignore
    }
  }

  private mapRowToSession(row: any): ScreeningSession {
    return {
      id: row.id,
      candidateId: row.candidate_id,
      jobId: row.job_id,
      jobTitle: row.job_title,
      jobRequirements: JSON.parse(row.job_requirements || "[]"),
      sessionToken: row.session_token,
      status: row.status,
      messages: JSON.parse(row.messages || "[]"),
      evaluation: row.evaluation ? JSON.parse(row.evaluation) : undefined,
      humanReview: row.human_review ? JSON.parse(row.human_review) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastInteractionAt: row.last_interaction_at,
      expiresAt: row.expires_at,
    };
  }

  async save(session: ScreeningSession): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO screening_sessions (
        id, candidate_id, job_id, job_title, job_requirements,
        session_token, status, messages, evaluation, human_review,
        created_at, updated_at, last_interaction_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        candidate_id = excluded.candidate_id,
        job_id = excluded.job_id,
        job_title = excluded.job_title,
        job_requirements = excluded.job_requirements,
        session_token = excluded.session_token,
        status = excluded.status,
        messages = excluded.messages,
        evaluation = excluded.evaluation,
        human_review = excluded.human_review,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        last_interaction_at = excluded.last_interaction_at,
        expires_at = excluded.expires_at
    `);

    stmt.run(
      session.id,
      session.candidateId,
      session.jobId,
      session.jobTitle,
      JSON.stringify(session.jobRequirements || []),
      session.sessionToken,
      session.status,
      JSON.stringify(session.messages || []),
      session.evaluation ? JSON.stringify(session.evaluation) : null,
      session.humanReview ? JSON.stringify(session.humanReview) : null,
      session.createdAt,
      session.updatedAt,
      session.lastInteractionAt,
      session.expiresAt
    );
  }

  async findById(id: string): Promise<ScreeningSession | null> {
    const stmt = this.db.prepare(`SELECT * FROM screening_sessions WHERE id = ?`);
    const row = stmt.get(id);
    if (!row) return null;
    return this.mapRowToSession(row);
  }

  async findByCandidateId(candidateId: string): Promise<ScreeningSession[]> {
    const stmt = this.db.prepare(`SELECT * FROM screening_sessions WHERE candidate_id = ? ORDER BY created_at DESC`);
    const rows = stmt.all(candidateId);
    return rows.map((r) => this.mapRowToSession(r));
  }

  async findByJobId(jobId: string): Promise<ScreeningSession[]> {
    const stmt = this.db.prepare(`SELECT * FROM screening_sessions WHERE job_id = ? ORDER BY created_at DESC`);
    const rows = stmt.all(jobId);
    return rows.map((r) => this.mapRowToSession(r));
  }

  async findByToken(token: string): Promise<ScreeningSession | null> {
    const stmt = this.db.prepare(`SELECT * FROM screening_sessions WHERE session_token = ?`);
    const row = stmt.get(token);
    if (!row) return null;
    return this.mapRowToSession(row);
  }
}
