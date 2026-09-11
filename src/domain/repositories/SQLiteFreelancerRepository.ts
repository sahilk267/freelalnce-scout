/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import {
  NormalizedFreelanceProject,
  FreelanceProposal,
  FreelancerExecutionRecord,
  FreelancerLog,
  FreelancerAgentState,
  FreelancerConfig,
  FreelancerNotification
} from "../agent/freelancerTypes";
import { getInitialSeedProjectsForAll40Platforms } from "../providers/InitialPlatformSeed";
import { resolveDirectJobUrl, isGenericOrHomepageUrl } from "../utils/projectUrlHelper";

export class SQLiteFreelancerRepository {
  private db: Database.Database;
  private dbPath: string;
  private autoSeed: boolean;

  constructor(customPath?: string, autoSeed?: boolean) {
    this.dbPath = customPath || path.join(process.cwd(), "freelancer.sqlitedb");
    this.autoSeed = autoSeed ?? (this.dbPath !== ":memory:");
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
        console.warn("[SQLiteFreelancerRepository] Corrupt db detected, resetting db file:", error.message);
        try {
          if (fs.existsSync(this.dbPath)) {
            fs.unlinkSync(this.dbPath);
          }
        } catch (e) {
          console.error("[SQLiteFreelancerRepository] Failed to delete corrupt DB file:", e);
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
      CREATE TABLE IF NOT EXISTS freelance_projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        skills TEXT NOT NULL,
        budget TEXT,
        currency TEXT,
        hourly_or_fixed TEXT NOT NULL,
        client_rating REAL,
        client_reviews INTEGER,
        client_spending TEXT,
        location TEXT,
        proposal_count INTEGER,
        urgency TEXT NOT NULL,
        source TEXT NOT NULL,
        project_url TEXT NOT NULL,
        scrape_timestamp TEXT NOT NULL,
        score REAL,
        score_reasons TEXT
      );

      CREATE TABLE IF NOT EXISTS proposals (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        proposal_text TEXT NOT NULL,
        tone TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        submitted_at TEXT,
        FOREIGN KEY(project_id) REFERENCES freelance_projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS execution_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        status TEXT NOT NULL,
        projects_found INTEGER NOT NULL,
        proposals_generated INTEGER NOT NULL,
        errors TEXT,
        duration_ms INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS freelancer_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS freelancer_metrics (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      CREATE TABLE IF NOT EXISTS freelancer_agent_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        interval_minutes INTEGER NOT NULL,
        is_enabled INTEGER NOT NULL,
        last_run TEXT,
        next_run TEXT
      );

      CREATE TABLE IF NOT EXISTS freelancer_notifications (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        project_id TEXT,
        proposal_id TEXT,
        read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
    `);

    // Insert default agent state if not exists
    const stmt = this.db.prepare("SELECT COUNT(*) as count FROM freelancer_agent_state");
    const res = stmt.get() as any;
    if (res.count === 0) {
      this.db.prepare(`
        INSERT INTO freelancer_agent_state (id, interval_minutes, is_enabled, last_run, next_run)
        VALUES (1, 15, 1, NULL, NULL)
      `).run();
    }

    // Auto-seed initial catalog opportunities into database (upsert if missing)
    if (this.autoSeed) {
      this.syncSeedProjects();
    }
  }

  public syncSeedProjects(): number {
    try {
      const seedProjects = getInitialSeedProjectsForAll40Platforms();
      let count = 0;
      for (const proj of seedProjects) {
        const row = this.db.prepare("SELECT id, project_url FROM freelance_projects WHERE id = ?").get(proj.id) as any;
        if (!row) {
          this.saveProject(proj);
          count++;
        } else if (isGenericOrHomepageUrl(row.project_url)) {
          // Auto-upgrade existing database row from generic homepage to direct working link
          const directUrl = resolveDirectJobUrl({
            source: proj.source,
            title: proj.title,
            skills: proj.skills,
            projectUrl: proj.projectUrl,
            id: proj.id
          });
          this.db.prepare("UPDATE freelance_projects SET project_url = ? WHERE id = ?").run(directUrl, proj.id);
          count++;
        }
      }
      return count;
    } catch {
      return 0;
    }
  }

  // ==========================================
  // PROJECT METHODS
  // ==========================================

  public saveProject(project: NormalizedFreelanceProject): void {
    const directUrl = resolveDirectJobUrl({
      source: project.source,
      title: project.title,
      skills: project.skills,
      projectUrl: project.projectUrl,
      id: project.id
    });

    const stmt = this.db.prepare(`
      INSERT INTO freelance_projects (
        id, title, description, skills, budget, currency, hourly_or_fixed,
        client_rating, client_reviews, client_spending, location, proposal_count,
        urgency, source, project_url, scrape_timestamp, score, score_reasons
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        skills = excluded.skills,
        budget = excluded.budget,
        currency = excluded.currency,
        hourly_or_fixed = excluded.hourly_or_fixed,
        client_rating = excluded.client_rating,
        client_reviews = excluded.client_reviews,
        client_spending = excluded.client_spending,
        location = excluded.location,
        proposal_count = excluded.proposal_count,
        urgency = excluded.urgency,
        source = excluded.source,
        project_url = excluded.project_url,
        scrape_timestamp = excluded.scrape_timestamp,
        score = excluded.score,
        score_reasons = excluded.score_reasons
    `);

    stmt.run(
      project.id,
      project.title,
      project.description,
      JSON.stringify(project.skills),
      project.budget,
      project.currency,
      project.hourlyOrFixed,
      project.clientRating,
      project.clientReviews,
      project.clientSpending,
      project.location,
      project.proposalCount,
      project.urgency,
      project.source,
      directUrl,
      project.scrapeTimestamp,
      project.score || null,
      project.scoreReasons ? JSON.stringify(project.scoreReasons) : null
    );
  }

  public getProjects(): NormalizedFreelanceProject[] {
    const rows = this.db.prepare("SELECT * FROM freelance_projects ORDER BY scrape_timestamp DESC").all() as any[];
    return rows.map(r => this.mapProjectRow(r));
  }

  public getProject(id: string): NormalizedFreelanceProject | null {
    const row = this.db.prepare("SELECT * FROM freelance_projects WHERE id = ?").get(id) as any;
    return row ? this.mapProjectRow(row) : null;
  }

  private mapProjectRow(r: any): NormalizedFreelanceProject {
    const skills = JSON.parse(r.skills || "[]");
    const directUrl = resolveDirectJobUrl({
      source: r.source,
      title: r.title,
      skills,
      projectUrl: r.project_url,
      id: r.id
    });

    return {
      id: r.id,
      title: r.title,
      description: r.description,
      skills,
      budget: r.budget,
      currency: r.currency,
      hourlyOrFixed: r.hourly_or_fixed as "hourly" | "fixed",
      clientRating: r.client_rating,
      clientReviews: r.client_reviews,
      clientSpending: r.client_spending,
      location: r.location,
      proposalCount: r.proposal_count,
      urgency: r.urgency as "high" | "medium" | "low",
      source: r.source as any,
      projectUrl: directUrl,
      scrapeTimestamp: r.scrape_timestamp,
      score: r.score ?? undefined,
      scoreReasons: r.score_reasons ? JSON.parse(r.score_reasons) : undefined
    };
  }

  // ==========================================
  // PROPOSAL METHODS
  // ==========================================

  public saveProposal(proposal: FreelanceProposal): void {
    const stmt = this.db.prepare(`
      INSERT INTO proposals (id, project_id, title, proposal_text, tone, status, created_at, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        proposal_text = excluded.proposal_text,
        tone = excluded.tone,
        status = excluded.status,
        submitted_at = excluded.submitted_at
    `);

    stmt.run(
      proposal.id,
      proposal.projectId,
      proposal.title,
      proposal.proposalText,
      proposal.tone,
      proposal.status,
      proposal.createdAt,
      proposal.submittedAt
    );
  }

  public getProposal(id: string): FreelanceProposal | null {
    const row = this.db.prepare("SELECT * FROM proposals WHERE id = ?").get(id) as any;
    return row ? this.mapProposalRow(row) : null;
  }

  public getProposals(): FreelanceProposal[] {
    const rows = this.db.prepare("SELECT * FROM proposals ORDER BY created_at DESC").all() as any[];
    return rows.map(r => this.mapProposalRow(r));
  }

  public getProposalsForProject(projectId: string): FreelanceProposal[] {
    const rows = this.db.prepare("SELECT * FROM proposals WHERE project_id = ?").all(projectId) as any[];
    return rows.map(r => this.mapProposalRow(r));
  }

  public updateProposalStatus(id: string, status: string, submittedAt?: string | null): void {
    const stmt = this.db.prepare("UPDATE proposals SET status = ?, submitted_at = COALESCE(?, submitted_at) WHERE id = ?");
    stmt.run(status, submittedAt || null, id);
  }

  public deleteProposal(id: string): void {
    this.db.prepare("DELETE FROM proposals WHERE id = ?").run(id);
  }

  private mapProposalRow(r: any): FreelanceProposal {
    return {
      id: r.id,
      projectId: r.project_id,
      title: r.title,
      proposalText: r.proposal_text,
      tone: r.tone as any,
      status: r.status as any,
      createdAt: r.created_at,
      submittedAt: r.submitted_at
    };
  }

  // ==========================================
  // EXECUTION HISTORY
  // ==========================================

  public saveExecutionRecord(record: FreelancerExecutionRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO execution_history (timestamp, status, projects_found, proposals_generated, errors, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      record.timestamp,
      record.status,
      record.projectsFound,
      record.proposalsGenerated,
      record.errors,
      record.durationMs
    );
  }

  public getExecutionHistory(): FreelancerExecutionRecord[] {
    const rows = this.db.prepare("SELECT * FROM execution_history ORDER BY id DESC LIMIT 50").all() as any[];
    return rows.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      status: r.status as "success" | "failure",
      projectsFound: r.projects_found,
      proposalsGenerated: r.proposals_generated,
      errors: r.errors,
      durationMs: r.duration_ms
    }));
  }

  // ==========================================
  // SYSTEM LOGS
  // ==========================================

  public addLog(level: "info" | "warn" | "error" | "success", message: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO freelancer_logs (timestamp, level, message)
      VALUES (?, ?, ?)
    `);
    stmt.run(new Date().toISOString(), level, message);

    // Automatically truncate the logs table to the most recent 50 entries to prevent SQLite file bloat
    this.db.prepare(`
      DELETE FROM freelancer_logs 
      WHERE id NOT IN (
        SELECT id FROM freelancer_logs 
        ORDER BY id DESC LIMIT 50
      )
    `).run();
  }

  public getLogs(limit: number = 100): FreelancerLog[] {
    const rows = this.db.prepare("SELECT * FROM freelancer_logs ORDER BY id DESC LIMIT ?").all(limit) as any[];
    return rows.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      level: r.level as any,
      message: r.message
    }));
  }

  // ==========================================
  // METRICS
  // ==========================================

  public saveMetric(key: string, value: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO freelancer_metrics (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    stmt.run(key, value);
  }

  public getMetric(key: string): string | null {
    const row = this.db.prepare("SELECT value FROM freelancer_metrics WHERE key = ?").get(key) as any;
    return row ? row.value : null;
  }

  // ==========================================
  // AGENT SCHEDULER STATE
  // ==========================================

  public saveAgentState(state: FreelancerAgentState): void {
    const stmt = this.db.prepare(`
      INSERT INTO freelancer_agent_state (id, interval_minutes, is_enabled, last_run, next_run)
      VALUES (1, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        interval_minutes = excluded.interval_minutes,
        is_enabled = excluded.is_enabled,
        last_run = excluded.last_run,
        next_run = excluded.next_run
    `);
    stmt.run(
      state.intervalMinutes,
      state.isEnabled ? 1 : 0,
      state.lastRun,
      state.nextRun
    );
  }

  public getAgentState(): FreelancerAgentState {
    const row = this.db.prepare("SELECT * FROM freelancer_agent_state WHERE id = 1").get() as any;
    if (!row) {
      return { intervalMinutes: 15, isEnabled: true, lastRun: null, nextRun: null };
    }
    return {
      intervalMinutes: row.interval_minutes,
      isEnabled: row.is_enabled === 1,
      lastRun: row.last_run,
      nextRun: row.next_run
    };
  }

  public getFreelancerConfig(): FreelancerConfig {
    const mode = (this.getMetric("config.mode") as "development" | "production") || "development";
    const timeoutMs = parseInt(this.getMetric("config.timeout_ms") || "10000", 10);
    const retryCount = parseInt(this.getMetric("config.retry_count") || "3", 10);
    
    let providers = {
      Upwork: true,
      Freelancer: true,
      PeoplePerHour: true,
      Guru: true,
      FiverrPro: true
    };
    try {
      const providersStr = this.getMetric("config.providers");
      if (providersStr) {
        providers = JSON.parse(providersStr);
      }
    } catch (e) {}

    const proposalTemplate = this.getMetric("config.proposal_template") || "";
    const aiModel = this.getMetric("config.ai_model") || "gemini-3.8-flash";
    const databasePath = this.getMetric("config.database_path") || this.dbPath;
    const schedulerInterval = parseInt(this.getMetric("config.scheduler_interval") || "15", 10);
    const cronExpression = this.getMetric("config.cron_expression") || "*/15 * * * *";

    let featureFlags = {
      autoSubmit: false,
      highValueNotifications: true
    };
    try {
      const ffStr = this.getMetric("config.feature_flags");
      if (ffStr) {
        featureFlags = JSON.parse(ffStr);
      }
    } catch (e) {}

    return {
      mode,
      timeoutMs,
      retryCount,
      providers,
      proposalTemplate,
      aiModel,
      databasePath,
      schedulerInterval,
      cronExpression,
      featureFlags
    };
  }

  public saveFreelancerConfig(config: FreelancerConfig): void {
    this.saveMetric("config.mode", config.mode);
    this.saveMetric("config.timeout_ms", String(config.timeoutMs));
    this.saveMetric("config.retry_count", String(config.retryCount));
    this.saveMetric("config.providers", JSON.stringify(config.providers));
    this.saveMetric("config.proposal_template", config.proposalTemplate);
    this.saveMetric("config.ai_model", config.aiModel);
    this.saveMetric("config.database_path", config.databasePath);
    this.saveMetric("config.scheduler_interval", String(config.schedulerInterval));
    this.saveMetric("config.cron_expression", config.cronExpression);
    this.saveMetric("config.feature_flags", JSON.stringify(config.featureFlags));

    // Also sync the agent state table values for legacy compatibility
    const state = this.getAgentState();
    this.saveAgentState({
      ...state,
      intervalMinutes: config.schedulerInterval
    });
  }

  // ==========================================
  // NOTIFICATIONS METHODS
  // ==========================================

  public saveNotification(notification: FreelancerNotification): void {
    const stmt = this.db.prepare(`
      INSERT INTO freelancer_notifications (id, type, message, project_id, proposal_id, read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        message = excluded.message,
        project_id = excluded.project_id,
        proposal_id = excluded.proposal_id,
        read = excluded.read,
        created_at = excluded.created_at
    `);
    stmt.run(
      notification.id,
      notification.type,
      notification.message,
      notification.projectId || null,
      notification.proposalId || null,
      notification.read ? 1 : 0,
      notification.createdAt
    );
  }

  public getNotifications(limit: number = 50): FreelancerNotification[] {
    const rows = this.db.prepare("SELECT * FROM freelancer_notifications ORDER BY created_at DESC LIMIT ?").all(limit) as any[];
    return rows.map(r => ({
      id: r.id,
      type: r.type as any,
      message: r.message,
      projectId: r.project_id,
      proposalId: r.proposal_id,
      read: r.read === 1,
      createdAt: r.created_at
    }));
  }

  public markNotificationAsRead(id: string): void {
    this.db.prepare("UPDATE freelancer_notifications SET read = 1 WHERE id = ?").run(id);
  }

  public clearNotifications(): void {
    this.db.prepare("DELETE FROM freelancer_notifications").run();
  }

  // ==========================================
  // GENERAL UTILITY
  // ==========================================

  public clearAll(): void {
    this.db.prepare("DELETE FROM freelance_projects").run();
    this.db.prepare("DELETE FROM proposals").run();
    this.db.prepare("DELETE FROM execution_history").run();
    this.db.prepare("DELETE FROM freelancer_logs").run();
    this.db.prepare("DELETE FROM freelancer_metrics").run();
    this.db.prepare("DELETE FROM freelancer_notifications").run();
    this.db.prepare("UPDATE freelancer_agent_state SET interval_minutes = 15, is_enabled = 1, last_run = NULL, next_run = NULL WHERE id = 1").run();
  }

  public close(): void {
    this.db.close();
  }
}
