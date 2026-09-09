/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PersistenceConfig {
  backupIntervalMinutes: number;
  retentionCount: number;
  backupDirectory: string;
  databaseFilename: string;
  retryCount: number;
  retryDelayMs: number;
  retryMaxDelayMs: number;
  retryAbortThresholdMs: number;
  schedulerEnabled: boolean;
  logLevel: "debug" | "info" | "warn" | "error";
  manifestFilename: string;
  compressionEnabled: boolean;
}

export class PersistenceConfigService {
  private config: PersistenceConfig;

  constructor() {
    this.config = {
      backupIntervalMinutes: Number(process.env.BACKUP_INTERVAL_MINUTES || "60"),
      retentionCount: Number(process.env.BACKUP_RETENTION_COUNT || "10"),
      backupDirectory: process.env.BACKUP_DIRECTORY || "./backups",
      databaseFilename: process.env.BACKUP_DATABASE_FILENAME || "backup.sqlitedb",
      retryCount: Number(process.env.RETRY_COUNT || "3"),
      retryDelayMs: Number(process.env.RETRY_DELAY_MS || "1000"),
      retryMaxDelayMs: Number(process.env.RETRY_MAX_DELAY_MS || "10000"),
      retryAbortThresholdMs: Number(process.env.RETRY_ABORT_THRESHOLD_MS || "30000"),
      schedulerEnabled: process.env.SCHEDULER_ENABLED !== "false",
      logLevel: (process.env.LOG_LEVEL || "info") as any,
      manifestFilename: process.env.MANIFEST_FILENAME || "manifest.json",
      compressionEnabled: process.env.COMPRESSION_ENABLED === "true",
    };
  }

  public getConfig(): PersistenceConfig {
    return { ...this.config };
  }

  public updateConfig(patch: Partial<PersistenceConfig>): void {
    this.config = { ...this.config, ...patch };
  }
}
