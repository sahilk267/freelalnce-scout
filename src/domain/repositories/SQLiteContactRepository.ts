/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { 
  Contact, 
  normalizeEmail, 
  normalizeLinkedInUrl, 
  isDuplicateContact, 
  categorizeDuplicates, 
  DuplicateCheckResult 
} from "../models/Contact";
import { IContactRepository } from "./IContactRepository";

export class SQLiteContactRepository implements IContactRepository {
  private db: Database.Database;
  private dbPath: string;

  constructor(customPath?: string) {
    this.dbPath = customPath || path.join(process.cwd(), "contacts.sqlitedb");
    
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
        console.warn("[SQLiteContactRepository] Corrupt DB detected, resetting file:", error.message);
        try {
          if (fs.existsSync(this.dbPath) && this.dbPath !== ":memory:") {
            fs.unlinkSync(this.dbPath);
          }
        } catch (e) {
          console.error("[SQLiteContactRepository] Failed to delete corrupt DB file:", e);
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
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        company TEXT NOT NULL,
        email TEXT,
        linkedin_url TEXT,
        role TEXT,
        confidence TEXT NOT NULL,
        do_not_contact INTEGER NOT NULL,
        last_contacted_at TEXT,
        response_status TEXT NOT NULL,
        metadata TEXT NOT NULL
      );
    `);
  }

  public close(): void {
    if (this.db && this.db.open) {
      this.db.close();
    }
  }

  private mapRowToContact(row: any): Contact {
    let metadata = { source: "manual" };
    try {
      metadata = JSON.parse(row.metadata || "{}");
    } catch (e) {
      metadata = { source: "manual" };
    }

    return {
      id: row.id,
      name: row.name,
      company: row.company,
      email: row.email || undefined,
      linkedinUrl: row.linkedin_url || undefined,
      role: row.role || undefined,
      confidence: row.confidence as "verified" | "guessed",
      doNotContact: Boolean(row.do_not_contact),
      lastContactedAt: row.last_contacted_at || undefined,
      responseStatus: row.response_status as any,
      metadata
    };
  }

  async getAll(): Promise<Contact[]> {
    const rows = this.db.prepare(`SELECT * FROM contacts`).all();
    return rows.map((r) => this.mapRowToContact(r));
  }

  async getById(id: string): Promise<Contact | null> {
    const row = this.db.prepare(`SELECT * FROM contacts WHERE id = ?`).get(id);
    if (!row) return null;
    return this.mapRowToContact(row);
  }

  async findByEmail(email: string): Promise<Contact | null> {
    const target = normalizeEmail(email);
    if (!target) return null;
    const contacts = await this.getAll();
    for (const c of contacts) {
      if (normalizeEmail(c.email) === target) {
        return c;
      }
    }
    return null;
  }

  async findByLinkedInUrl(linkedinUrl: string): Promise<Contact | null> {
    const target = normalizeLinkedInUrl(linkedinUrl);
    if (!target) return null;
    const contacts = await this.getAll();
    for (const c of contacts) {
      if (normalizeLinkedInUrl(c.linkedinUrl) === target) {
        return c;
      }
    }
    return null;
  }

  async findDuplicates(contact: Partial<Contact>): Promise<Contact[]> {
    const contacts = await this.getAll();
    const matches: Contact[] = [];
    for (const existing of contacts) {
      if (existing.id === contact.id) continue;
      if (isDuplicateContact(existing, contact)) {
        matches.push(existing);
      }
    }
    return matches;
  }

  async checkDuplicates(contact: Partial<Contact>): Promise<DuplicateCheckResult> {
    const contacts = await this.getAll();
    return categorizeDuplicates(contact, contacts);
  }

  async save(contact: Contact): Promise<Contact> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO contacts (
        id, name, company, email, linkedin_url, role,
        confidence, do_not_contact, last_contacted_at,
        response_status, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      contact.id,
      contact.name,
      contact.company,
      contact.email || null,
      contact.linkedinUrl || null,
      contact.role || null,
      contact.confidence,
      contact.doNotContact ? 1 : 0,
      contact.lastContactedAt || null,
      contact.responseStatus,
      JSON.stringify(contact.metadata || {})
    );

    return contact;
  }

  async delete(id: string): Promise<void> {
    this.db.prepare(`DELETE FROM contacts WHERE id = ?`).run(id);
  }
}
