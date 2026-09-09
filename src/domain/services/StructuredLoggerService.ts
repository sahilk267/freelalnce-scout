/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from "fs";
import * as path from "path";

export interface StructuredLog {
  operationId: string;
  timestamp: string;
  durationMs: number;
  operation: "backup" | "restore" | "migration" | "validation" | "scheduler" | "cleanup";
  status: "success" | "failure" | "warning" | "running";
  recordsProcessed: number;
  warnings: string[];
  errors: string[];
  retries: number;
  user: string;
  environment: string;
}

export class StructuredLoggerService {
  private logsFile: string;
  private inMemoryLogs: StructuredLog[] = [];

  constructor(backupDir: string = "./backups") {
    this.logsFile = path.join(backupDir, "operation_logs.json");
    this.ensureDirectory();
    this.loadLogs();
  }

  private ensureDirectory(): void {
    const dir = path.dirname(this.logsFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private loadLogs(): void {
    try {
      if (fs.existsSync(this.logsFile)) {
        const data = fs.readFileSync(this.logsFile, "utf-8");
        this.inMemoryLogs = JSON.parse(data);
      }
    } catch (e) {
      console.error("Failed to load structured logs from file:", e);
      this.inMemoryLogs = [];
    }
  }

  public logOperation(log: StructuredLog): void {
    this.inMemoryLogs.unshift(log);
    
    // Limit in-memory/file log count to 500 for performance
    if (this.inMemoryLogs.length > 500) {
      this.inMemoryLogs = this.inMemoryLogs.slice(0, 500);
    }

    try {
      this.ensureDirectory();
      fs.writeFileSync(this.logsFile, JSON.stringify(this.inMemoryLogs, null, 2), "utf-8");
    } catch (e) {
      console.error("Failed to save structured log to file:", e);
    }
  }

  public getLogs(): StructuredLog[] {
    return [...this.inMemoryLogs];
  }

  public clearLogs(): void {
    this.inMemoryLogs = [];
    try {
      if (fs.existsSync(this.logsFile)) {
        fs.unlinkSync(this.logsFile);
      }
    } catch (e) {
      console.error("Failed to delete structured logs file:", e);
    }
  }
}
