/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { ResumeOrder } from "../models/ResumeOrder";
import { IOrderRepository } from "./IOrderRepository";

export class SQLiteOrderRepository implements IOrderRepository {
  private db: Database.Database;
  private dbPath: string;

  constructor(customPath?: string) {
    this.dbPath = customPath || path.join(process.cwd(), "resume_orders.sqlitedb");

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
        console.warn("[SQLiteOrderRepository] Corrupt DB detected, resetting file:", error.message);
        try {
          if (fs.existsSync(this.dbPath) && this.dbPath !== ":memory:") {
            fs.unlinkSync(this.dbPath);
          }
        } catch (e) {
          console.error("[SQLiteOrderRepository] Failed to delete corrupt DB file:", e);
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
      CREATE TABLE IF NOT EXISTS resume_orders (
        id TEXT PRIMARY KEY,
        candidate_id TEXT NOT NULL,
        tier TEXT NOT NULL,
        price_inr INTEGER NOT NULL,
        max_revisions INTEGER NOT NULL,
        revisions_used INTEGER NOT NULL,
        payment_status TEXT NOT NULL,
        delivery_status TEXT NOT NULL,
        auto_deliver_enabled INTEGER NOT NULL,
        original_resume_text TEXT NOT NULL,
        target_job_description TEXT,
        rewritten_resume_text TEXT,
        fact_traceability_log TEXT,
        before_ats_score INTEGER,
        after_ats_score INTEGER,
        verification_audit TEXT,
        verification_attempts INTEGER DEFAULT 0,
        revision_instructions TEXT,
        approved_by TEXT,
        approved_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    try {
      this.db.exec(`ALTER TABLE resume_orders ADD COLUMN verification_attempts INTEGER DEFAULT 0;`);
    } catch (e) {
      // Column exists
    }

    try {
      this.db.exec(`ALTER TABLE resume_orders ADD COLUMN price_at_order_time INTEGER;`);
    } catch (e) {
      // Column exists
    }

    try {
      this.db.exec(`ALTER TABLE resume_orders ADD COLUMN currency TEXT DEFAULT 'INR';`);
    } catch (e) {
      // Column exists
    }

    try {
      this.db.exec(`ALTER TABLE resume_orders ADD COLUMN price_minor_units INTEGER;`);
    } catch (e) {
      // Column exists
    }

    try {
      this.db.exec(`ALTER TABLE resume_orders ADD COLUMN razorpay_order_id TEXT;`);
    } catch (e) {
      // Column exists
    }

    try {
      this.db.exec(`ALTER TABLE resume_orders ADD COLUMN razorpay_payment_id TEXT;`);
    } catch (e) {
      // Column exists
    }

    try {
      this.db.exec(`ALTER TABLE resume_orders ADD COLUMN payment_failure_reason TEXT;`);
    } catch (e) {
      // Column exists
    }

    try {
      this.db.exec(`ALTER TABLE resume_orders ADD COLUMN payment_discrepancy TEXT;`);
    } catch (e) {
      // Column exists
    }

    try {
      this.db.exec(`ALTER TABLE resume_orders ADD COLUMN refund_id TEXT;`);
    } catch (e) {
      // Column exists
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS processed_payment_events (
        event_id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        processed_at TEXT NOT NULL
      );
    `);
  }

  public close(): void {
    if (this.db && this.db.open) {
      this.db.close();
    }
  }

  private mapRowToOrder(row: any): ResumeOrder {
    let factTraceabilityLog;
    if (row.fact_traceability_log) {
      try { factTraceabilityLog = JSON.parse(row.fact_traceability_log); } catch (e) {}
    }

    let verificationAudit;
    if (row.verification_audit) {
      try { verificationAudit = JSON.parse(row.verification_audit); } catch (e) {}
    }

    let revisionInstructions;
    if (row.revision_instructions) {
      try { revisionInstructions = JSON.parse(row.revision_instructions); } catch (e) {}
    }

    return {
      id: row.id,
      candidateId: row.candidate_id,
      tier: row.tier as any,
      priceINR: row.price_inr,
      priceAtOrderTime: row.price_at_order_time ?? row.price_inr,
      priceMinorUnits: row.price_minor_units ?? (row.price_at_order_time ? row.price_at_order_time * 100 : row.price_inr * 100),
      currency: row.currency || "INR",
      maxRevisions: row.max_revisions,
      revisionsUsed: row.revisions_used,
      paymentStatus: row.payment_status as any,
      deliveryStatus: row.delivery_status as any,
      autoDeliverEnabled: Boolean(row.auto_deliver_enabled),
      originalResumeText: row.original_resume_text,
      targetJobDescription: row.target_job_description || undefined,
      rewrittenResumeText: row.rewritten_resume_text || undefined,
      factTraceabilityLog,
      beforeAtsScore: row.before_ats_score ?? undefined,
      afterAtsScore: row.after_ats_score ?? undefined,
      verificationAudit,
      verificationAttempts: row.verification_attempts ?? 0,
      revisionInstructions,
      approvedBy: row.approved_by || undefined,
      approvedAt: row.approved_at || undefined,
      razorpayOrderId: row.razorpay_order_id || undefined,
      razorpayPaymentId: row.razorpay_payment_id || undefined,
      paymentFailureReason: row.payment_failure_reason || undefined,
      paymentDiscrepancy: row.payment_discrepancy || undefined,
      refundId: row.refund_id || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getAll(): Promise<ResumeOrder[]> {
    const rows = this.db.prepare(`SELECT * FROM resume_orders ORDER BY created_at DESC`).all();
    return rows.map((r) => this.mapRowToOrder(r));
  }

  async getById(id: string): Promise<ResumeOrder | null> {
    const row = this.db.prepare(`SELECT * FROM resume_orders WHERE id = ?`).get(id);
    if (!row) return null;
    return this.mapRowToOrder(row);
  }

  async getByRazorpayOrderId(razorpayOrderId: string): Promise<ResumeOrder | null> {
    const row = this.db.prepare(`SELECT * FROM resume_orders WHERE razorpay_order_id = ?`).get(razorpayOrderId);
    if (!row) return null;
    return this.mapRowToOrder(row);
  }

  async getByCandidateId(candidateId: string): Promise<ResumeOrder[]> {
    const rows = this.db.prepare(`SELECT * FROM resume_orders WHERE candidate_id = ? ORDER BY created_at DESC`).all(candidateId);
    return rows.map((r) => this.mapRowToOrder(r));
  }

  async getReviewQueue(): Promise<ResumeOrder[]> {
    const rows = this.db.prepare(`SELECT * FROM resume_orders WHERE delivery_status IN ('needs_human_review', 'verified') ORDER BY created_at ASC`).all();
    return rows.map((r) => this.mapRowToOrder(r));
  }

  async save(order: ResumeOrder): Promise<ResumeOrder> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO resume_orders (
        id, candidate_id, tier, price_inr, price_at_order_time, currency, price_minor_units,
        max_revisions, revisions_used,
        payment_status, delivery_status, auto_deliver_enabled,
        original_resume_text, target_job_description, rewritten_resume_text,
        fact_traceability_log, before_ats_score, after_ats_score,
        verification_audit, verification_attempts, revision_instructions, approved_by, approved_at,
        razorpay_order_id, razorpay_payment_id, payment_failure_reason, payment_discrepancy, refund_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      order.id,
      order.candidateId,
      order.tier,
      order.priceINR,
      order.priceAtOrderTime ?? order.priceINR,
      order.currency || "INR",
      order.priceMinorUnits ?? ((order.priceAtOrderTime ?? order.priceINR) * 100),
      order.maxRevisions,
      order.revisionsUsed,
      order.paymentStatus,
      order.deliveryStatus,
      order.autoDeliverEnabled ? 1 : 0,
      order.originalResumeText,
      order.targetJobDescription || null,
      order.rewrittenResumeText || null,
      order.factTraceabilityLog ? JSON.stringify(order.factTraceabilityLog) : null,
      order.beforeAtsScore ?? null,
      order.afterAtsScore ?? null,
      order.verificationAudit ? JSON.stringify(order.verificationAudit) : null,
      order.verificationAttempts || 0,
      order.revisionInstructions ? JSON.stringify(order.revisionInstructions) : null,
      order.approvedBy || null,
      order.approvedAt || null,
      order.razorpayOrderId || null,
      order.razorpayPaymentId || null,
      order.paymentFailureReason || null,
      order.paymentDiscrepancy || null,
      order.refundId || null,
      order.createdAt,
      order.updatedAt
    );

    return order;
  }

  async delete(id: string): Promise<void> {
    this.db.prepare(`DELETE FROM resume_orders WHERE id = ?`).run(id);
  }

  async hasProcessedEvent(eventId: string): Promise<boolean> {
    const row = this.db.prepare(`SELECT event_id FROM processed_payment_events WHERE event_id = ?`).get(eventId);
    return Boolean(row);
  }

  async recordProcessedEvent(eventId: string, eventType: string): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO processed_payment_events (event_id, event_type, processed_at)
      VALUES (?, ?, ?)
    `);
    stmt.run(eventId, eventType, new Date().toISOString());
  }
}
