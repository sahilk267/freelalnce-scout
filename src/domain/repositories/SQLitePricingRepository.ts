/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { PricingTier, PricingAuditLog, DEFAULT_PRICING_TIERS } from "../models/PricingTier";
import { IPricingRepository } from "./IPricingRepository";

export class SQLitePricingRepository implements IPricingRepository {
  private db: Database.Database;
  private dbPath: string;

  constructor(customPath?: string) {
    this.dbPath = customPath || path.join(process.cwd(), "data", "pricing.sqlitedb");

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
        console.warn("[SQLitePricingRepository] Corrupt DB detected, resetting file:", error.message);
        try {
          if (fs.existsSync(this.dbPath) && this.dbPath !== ":memory:") {
            fs.unlinkSync(this.dbPath);
          }
        } catch (e) {
          console.error("[SQLitePricingRepository] Failed to delete corrupt DB file:", e);
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
      CREATE TABLE IF NOT EXISTS pricing_tiers (
        tier_id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        price_minor_units INTEGER NOT NULL,
        currency TEXT NOT NULL,
        revision_limit INTEGER NOT NULL,
        is_active INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pricing_audit_logs (
        id TEXT PRIMARY KEY,
        tier_id TEXT NOT NULL,
        old_price_minor_units INTEGER NOT NULL,
        new_price_minor_units INTEGER NOT NULL,
        old_currency TEXT NOT NULL,
        new_currency TEXT NOT NULL,
        old_revision_limit INTEGER NOT NULL,
        new_revision_limit INTEGER NOT NULL,
        old_is_active INTEGER NOT NULL,
        new_is_active INTEGER NOT NULL,
        changed_by TEXT NOT NULL,
        changed_at TEXT NOT NULL,
        reason TEXT,
        old_values TEXT,
        new_values TEXT
      );
    `);

    // Seed on first boot if table is empty
    const countRow = this.db.prepare(`SELECT count(*) as count FROM pricing_tiers`).get() as { count: number };
    if (countRow.count === 0) {
      this.seedDefaults();
    }
  }

  public seedDefaults(): void {
    const insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO pricing_tiers (
        tier_id, display_name, price_minor_units, currency, revision_limit, is_active, updated_at, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    const seedTransaction = this.db.transaction((tiers: PricingTier[]) => {
      for (const tier of tiers) {
        insertStmt.run(
          tier.tierId,
          tier.displayName,
          tier.priceMinorUnits,
          tier.currency,
          tier.revisionLimit,
          tier.isActive ? 1 : 0,
          tier.updatedAt || now,
          tier.updatedBy || "system"
        );
      }
    });

    seedTransaction(DEFAULT_PRICING_TIERS);
  }

  public close(): void {
    if (this.db && this.db.open) {
      this.db.close();
    }
  }

  private mapRowToTier(row: any): PricingTier {
    return {
      tierId: row.tier_id,
      displayName: row.display_name,
      priceMinorUnits: row.price_minor_units,
      currency: row.currency,
      revisionLimit: row.revision_limit,
      isActive: Boolean(row.is_active),
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }

  private mapRowToAuditLog(row: any): PricingAuditLog {
    return {
      id: row.id,
      tierId: row.tier_id,
      oldPriceMinorUnits: row.old_price_minor_units,
      newPriceMinorUnits: row.new_price_minor_units,
      oldCurrency: row.old_currency,
      newCurrency: row.new_currency,
      oldRevisionLimit: row.old_revision_limit,
      newRevisionLimit: row.new_revision_limit,
      oldIsActive: Boolean(row.old_is_active),
      newIsActive: Boolean(row.new_is_active),
      changedBy: row.changed_by,
      changedAt: row.changed_at,
      reason: row.reason || undefined,
      oldValues: row.old_values || JSON.stringify({
        priceMinorUnits: row.old_price_minor_units,
        currency: row.old_currency,
        revisionLimit: row.old_revision_limit,
        isActive: Boolean(row.old_is_active)
      }),
      newValues: row.new_values || JSON.stringify({
        priceMinorUnits: row.new_price_minor_units,
        currency: row.new_currency,
        revisionLimit: row.new_revision_limit,
        isActive: Boolean(row.new_is_active)
      })
    };
  }

  async getAllTiers(): Promise<PricingTier[]> {
    const rows = this.db.prepare(`SELECT * FROM pricing_tiers ORDER BY price_minor_units ASC`).all();
    return rows.map(r => this.mapRowToTier(r));
  }

  async getActiveTiers(): Promise<PricingTier[]> {
    const rows = this.db.prepare(`SELECT * FROM pricing_tiers WHERE is_active = 1 ORDER BY price_minor_units ASC`).all();
    return rows.map(r => this.mapRowToTier(r));
  }

  async getTierById(tierId: string): Promise<PricingTier | null> {
    const row = this.db.prepare(`SELECT * FROM pricing_tiers WHERE tier_id = ?`).get(tierId);
    if (!row) return null;
    return this.mapRowToTier(row);
  }

  async saveTier(tier: PricingTier): Promise<PricingTier> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO pricing_tiers (
        tier_id, display_name, price_minor_units, currency, revision_limit, is_active, updated_at, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      tier.tierId,
      tier.displayName,
      tier.priceMinorUnits,
      tier.currency,
      tier.revisionLimit,
      tier.isActive ? 1 : 0,
      tier.updatedAt,
      tier.updatedBy
    );

    return tier;
  }

  async recordAuditLog(log: PricingAuditLog): Promise<PricingAuditLog> {
    const stmt = this.db.prepare(`
      INSERT INTO pricing_audit_logs (
        id, tier_id, old_price_minor_units, new_price_minor_units,
        old_currency, new_currency, old_revision_limit, new_revision_limit,
        old_is_active, new_is_active, changed_by, changed_at, reason,
        old_values, new_values
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      log.id,
      log.tierId,
      log.oldPriceMinorUnits,
      log.newPriceMinorUnits,
      log.oldCurrency,
      log.newCurrency,
      log.oldRevisionLimit,
      log.newRevisionLimit,
      log.oldIsActive ? 1 : 0,
      log.newIsActive ? 1 : 0,
      log.changedBy,
      log.changedAt,
      log.reason || null,
      log.oldValues || null,
      log.newValues || null
    );

    return log;
  }

  async getAuditLogs(tierId?: string): Promise<PricingAuditLog[]> {
    if (tierId) {
      const rows = this.db.prepare(`
        SELECT * FROM pricing_audit_logs 
        WHERE tier_id = ? 
        ORDER BY changed_at DESC
      `).all(tierId);
      return rows.map(r => this.mapRowToAuditLog(r));
    }

    const rows = this.db.prepare(`
      SELECT * FROM pricing_audit_logs 
      ORDER BY changed_at DESC
    `).all();
    return rows.map(r => this.mapRowToAuditLog(r));
  }

  async countTiers(): Promise<number> {
    const row = this.db.prepare(`SELECT count(*) as count FROM pricing_tiers`).get() as { count: number };
    return row?.count || 0;
  }
}
