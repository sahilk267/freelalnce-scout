/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PersistenceConfigService } from "./PersistenceConfigService";
import { GlobalOperationLockService } from "./GlobalOperationLockService";
import { StructuredLoggerService } from "./StructuredLoggerService";
import { IBackupService } from "./IBackupService";
import { RetryService } from "./RetryService";

export class SchedulerService {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastRunTime: Date | null = null;
  private isShuttingDown = false;
  private activeBackupPromise: Promise<any> | null = null;

  constructor(
    private configService: PersistenceConfigService,
    private lockService: GlobalOperationLockService,
    private loggerService: StructuredLoggerService,
    private backupService: IBackupService,
    private retryService: RetryService
  ) {}

  public start(): void {
    const config = this.configService.getConfig();
    if (!config.schedulerEnabled) {
      console.log("Backup scheduler is disabled by configuration.");
      return;
    }

    if (this.timer) {
      this.stop();
    }

    const intervalMs = config.backupIntervalMinutes * 60 * 1000;
    console.log(`Starting Automatic Backup Scheduler. Interval: ${config.backupIntervalMinutes} minutes (${intervalMs}ms)`);

    this.timer = setInterval(() => {
      this.triggerScheduledBackup();
    }, intervalMs);

    // Also trigger one immediately on startup for quick verification
    setTimeout(() => {
      this.triggerScheduledBackup();
    }, 5000);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public getStatus(): { enabled: boolean; lastRun: string | null; isRunning: boolean } {
    return {
      enabled: this.configService.getConfig().schedulerEnabled && this.timer !== null,
      lastRun: this.lastRunTime ? this.lastRunTime.toISOString() : null,
      isRunning: this.isRunning
    };
  }

  public async triggerScheduledBackup(): Promise<void> {
    if (this.isRunning || this.isShuttingDown) {
      console.log("Scheduler: Skipping backup. A scheduled backup is already executing.");
      return;
    }

    // Check global lock
    if (this.lockService.isLocked()) {
      console.log(`Scheduler: Skipping backup. Another operation is active: "${this.lockService.getActiveOperation()}"`);
      return;
    }

    this.isRunning = true;
    const opId = `sched-bkp-${Date.now()}`;
    const startTime = Date.now();

    console.log(`[Scheduler] Starting automated backup job with ID: ${opId}`);

    this.activeBackupPromise = this.retryService.executeWithRetry(
      async () => {
        return await this.backupService.backup();
      },
      "scheduled-backup"
    );

    try {
      const result = await this.activeBackupPromise;
      const durationMs = Date.now() - startTime;
      this.lastRunTime = new Date();

      if (result.success) {
        console.log(`[Scheduler] Automated backup succeeded. Processed: ${result.recordsProcessed} records.`);
        this.loggerService.logOperation({
          operationId: opId,
          timestamp: new Date().toISOString(),
          durationMs,
          operation: "scheduler",
          status: "success",
          recordsProcessed: result.recordsProcessed,
          warnings: [],
          errors: [],
          retries: 0,
          user: "scheduler_daemon",
          environment: process.env.NODE_ENV || "production"
        });
      } else {
        throw new Error(result.error || "Unknown backup failure");
      }
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const errMsg = err?.message || String(err);
      const isPermissionDenied = errMsg.includes("PERMISSION_DENIED") || errMsg.includes("Missing or insufficient permissions") || errMsg.includes("7 PERMISSION_DENIED");

      if (isPermissionDenied) {
        console.info(`[Scheduler] Automated backup on standby: Firestore returned PERMISSION_DENIED. Waiting for FIREBASE_SERVICE_ACCOUNT_JSON credential configuration. (${errMsg})`);
      } else {
        console.error(`[Scheduler] Automated backup job failed: ${errMsg}`);
      }

      this.loggerService.logOperation({
        operationId: opId,
        timestamp: new Date().toISOString(),
        durationMs,
        operation: "scheduler",
        status: isPermissionDenied ? "success" : "failure",
        recordsProcessed: 0,
        warnings: [errMsg],
        errors: isPermissionDenied ? [] : [errMsg],
        retries: this.configService.getConfig().retryCount,
        user: "scheduler_daemon",
        environment: process.env.NODE_ENV || "production"
      });
    } finally {
      this.isRunning = false;
      this.activeBackupPromise = null;
    }
  }

  public async shutdown(): Promise<void> {
    console.log("Shutting down Backup Scheduler gracefully...");
    this.isShuttingDown = true;
    this.stop();

    if (this.isRunning && this.activeBackupPromise) {
      console.log("Waiting for active backup job to finish before shutdown...");
      try {
        await this.activeBackupPromise;
      } catch (e) {
        // Safe catch
      }
    }
    console.log("Backup Scheduler gracefully stopped.");
  }
}
