/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { Candidate } from "../models/Candidate";
import { ICandidateRepository } from "./ICandidateRepository";

export class SQLiteBackupRepository implements ICandidateRepository {
  private db: Database.Database;
  private dbPath: string;

  constructor(customPath?: string) {
    this.dbPath = customPath || path.join(process.cwd(), "backup.sqlitedb");
    
    // Ensure parent directories exist
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    try {
      this.db = new Database(this.dbPath);
      this.initializeSchema();
    } catch (error: any) {
      if (
        error.code === "SQLITE_CORRUPT" || 
        (error.message && (error.message.includes("corrupt") || error.message.includes("malformed")))
      ) {
        console.warn("[SQLiteBackupRepository] Malformed or corrupt database detected, recovering: ", error.message);
        try {
          if (fs.existsSync(this.dbPath)) {
            fs.unlinkSync(this.dbPath);
          }
          if (fs.existsSync(`${this.dbPath}-wal`)) fs.unlinkSync(`${this.dbPath}-wal`);
          if (fs.existsSync(`${this.dbPath}-shm`)) fs.unlinkSync(`${this.dbPath}-shm`);
        } catch (unlinkError) {
          console.error("[SQLiteBackupRepository] Failed to delete corrupt DB files:", unlinkError);
        }
        this.db = new Database(this.dbPath);
        this.initializeSchema();
      } else {
        throw error;
      }
    }
  }

  private initializeSchema(): void {
    // Enable WAL mode for high performance concurrency
    this.db.pragma("journal_mode = WAL");
    
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS candidates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        skills TEXT NOT NULL,
        experienceYears INTEGER NOT NULL,
        locationPreference TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS _infrastructure_meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS migration_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        direction TEXT NOT NULL,
        records_migrated INTEGER NOT NULL,
        duplicates_found INTEGER NOT NULL,
        errors TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        version TEXT NOT NULL
      );
    `);

    // Bootstrap metadata if not already written
    this.setMetaValue("schema_version", "1");
    this.setMetaValue("db_version", "1");
  }

  public getMetaValue(key: string): string {
    try {
      const row = this.db.prepare("SELECT value FROM _infrastructure_meta WHERE key = ?").get(key) as any;
      return row ? row.value : "";
    } catch {
      return "";
    }
  }

  public setMetaValue(key: string, value: string): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO _infrastructure_meta (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `);
      stmt.run(key, value);
    } catch (e) {
      console.error(`Failed to set SQLite metadata key "${key}":`, e);
    }
  }

  public getJournalMode(): string {
    try {
      const result = this.db.prepare("PRAGMA journal_mode").get() as any;
      return result ? result.journal_mode : "unknown";
    } catch {
      return "unknown";
    }
  }

  public getPragmaVersion(type: "schema" | "user"): number {
    try {
      const result = this.db.prepare(`PRAGMA ${type}_version`).get() as any;
      if (result) {
        return Number(result[`${type}_version`]);
      }
      return 0;
    } catch {
      return 0;
    }
  }

  public logMigrationRun(direction: string, recordsMigrated: number, duplicatesFound: number, errors: string[], durationMs: number, version: string): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO migration_history (direction, records_migrated, duplicates_found, errors, timestamp, duration_ms, version)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(direction, recordsMigrated, duplicatesFound, JSON.stringify(errors), new Date().toISOString(), durationMs, version);
    } catch (e) {
      console.error("Failed to log migration to SQLite history table:", e);
    }
  }

  public getMigrationHistory(): any[] {
    try {
      return this.db.prepare("SELECT * FROM migration_history ORDER BY id DESC").all() as any[];
    } catch {
      return [];
    }
  }


  getDatabasePath(): string {
    return this.dbPath;
  }

  getDatabaseSize(): number {
    if (fs.existsSync(this.dbPath)) {
      const stats = fs.statSync(this.dbPath);
      return stats.size;
    }
    return 0;
  }

  verifyIntegrity(): boolean {
    try {
      const result = this.db.prepare("PRAGMA integrity_check").get() as any;
      return result && result.integrity_check === "ok";
    } catch (e) {
      console.error("SQLite integrity check failed:", e);
      return false;
    }
  }

  async getAll(): Promise<Candidate[]> {
    const rows = this.db.prepare("SELECT * FROM candidates").all() as any[];
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      skills: JSON.parse(row.skills),
      experienceYears: row.experienceYears,
      locationPreference: row.locationPreference
    }));
  }

  async getById(id: string): Promise<Candidate | null> {
    if (!id) return null;
    const row = this.db.prepare("SELECT * FROM candidates WHERE id = ?").get(id) as any;
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      skills: JSON.parse(row.skills),
      experienceYears: row.experienceYears,
      locationPreference: row.locationPreference
    };
  }

  async save(candidate: Candidate): Promise<Candidate> {
    const id = candidate.id || `cand-${Date.now()}`;
    const savedCand: Candidate = { ...candidate, id };

    const stmt = this.db.prepare(`
      INSERT INTO candidates (id, name, skills, experienceYears, locationPreference)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        skills = excluded.skills,
        experienceYears = excluded.experienceYears,
        locationPreference = excluded.locationPreference
    `);

    stmt.run(
      savedCand.id,
      savedCand.name || "",
      JSON.stringify(savedCand.skills || []),
      savedCand.experienceYears || 0,
      savedCand.locationPreference || ""
    );

    return savedCand;
  }

  /**
   * Clears all data inside the SQLite candidates table (transactional)
   */
  clearAll(): void {
    const stmt = this.db.prepare("DELETE FROM candidates");
    stmt.run();
  }

  /**
   * Run a bulk transaction import
   */
  bulkSave(candidates: Candidate[]): void {
    const insert = this.db.prepare(`
      INSERT INTO candidates (id, name, skills, experienceYears, locationPreference)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        skills = excluded.skills,
        experienceYears = excluded.experienceYears,
        locationPreference = excluded.locationPreference
    `);

    const transaction = this.db.transaction((list: Candidate[]) => {
      for (const item of list) {
        insert.run(
          item.id,
          item.name || "",
          JSON.stringify(item.skills || []),
          item.experienceYears || 0,
          item.locationPreference || ""
        );
      }
    });

    transaction(candidates);
  }

  async delete(id: string): Promise<void> {
    if (!id) return;
    const stmt = this.db.prepare("DELETE FROM candidates WHERE id = ?");
    stmt.run(id);
  }

  close(): void {
    this.db.close();
  }
}
