/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from "fs";
import * as path from "path";

export interface AuditIssue {
  id: string;
  title: string;
  location: {
    file: string;
    function_or_class: string;
    line: number;
  };
  category: "documentation" | "testing" | "runtime" | "path-conflict" | "security" | "ai-module" | "config" | "dead-code";
  status: "⚠️ broken" | "🌗 partial" | "⚪ missing" | "✅ resolved";
  why: string;
  evidence: string;
  impact: string;
  suggested_fix: string;
  severity: "critical" | "high" | "medium" | "low";
  effort_estimate_hours: number;
}

export interface AuditIndexSummary {
  total_files: number;
  total_modules: number;
  percent_indexed: number;
  percent_tested: number;
  percent_documented: number;
  last_full_scan: string;
}

export interface IndexedFileEntry {
  path: string;
  module: string;
  purpose: string;
  exports: string[];
  imports: string[];
  used_by: string[];
  status: string;
  tested: boolean;
  documented: boolean;
  last_verified: string;
  risk: string;
}

export interface AuditIndex {
  index_summary: AuditIndexSummary;
  files: IndexedFileEntry[];
}

export class AuditRunnerService {
  private auditDir: string;
  private indexPath: string;
  private reportsDir: string;

  constructor(customRootDir?: string) {
    const root = customRootDir || process.cwd();
    this.auditDir = path.join(root, "audit");
    this.indexPath = path.join(this.auditDir, "index.json");
    this.reportsDir = path.join(this.auditDir, "reports");

    if (!fs.existsSync(this.auditDir)) {
      fs.mkdirSync(this.auditDir, { recursive: true });
    }
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  public readIndex(): AuditIndex | null {
    if (!fs.existsSync(this.indexPath)) {
      return null;
    }
    try {
      const raw = fs.readFileSync(this.indexPath, "utf-8");
      return JSON.parse(raw) as AuditIndex;
    } catch {
      return null;
    }
  }

  public writeIndex(indexData: AuditIndex): void {
    indexData.index_summary.last_full_scan = new Date().toISOString();
    fs.writeFileSync(this.indexPath, JSON.stringify(indexData, null, 2), "utf-8");
  }

  public generateReport(issues: AuditIssue[], markdownContent: string): { reportPath: string; latestPath: string } {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const reportPath = path.join(this.reportsDir, `audit_${timestamp}.md`);
    const latestPath = path.join(this.reportsDir, "latest.md");

    fs.writeFileSync(reportPath, markdownContent, "utf-8");
    fs.writeFileSync(latestPath, markdownContent, "utf-8");

    return { reportPath, latestPath };
  }
}
