/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IMigrationService, MigrationResult, ProgressCallback } from "./IMigrationService";
import { FirestoreCandidateRepository } from "../repositories/FirestoreCandidateRepository";
import { SQLiteBackupRepository } from "../repositories/SQLiteBackupRepository";
import { PersistenceConfigService } from "./PersistenceConfigService";
import { GlobalOperationLockService } from "./GlobalOperationLockService";
import { ProgressTrackerService } from "./ProgressTrackerService";
import { RetryService } from "./RetryService";
import { StructuredLoggerService } from "./StructuredLoggerService";
import { Candidate } from "../models/Candidate";

export class MigrationService implements IMigrationService {
  private configService: PersistenceConfigService;
  private lockService: GlobalOperationLockService;
  private progressTracker: ProgressTrackerService;
  private retryService: RetryService;
  private loggerService: StructuredLoggerService;

  constructor(
    private primaryRepo: FirestoreCandidateRepository,
    private secondaryRepo: SQLiteBackupRepository,
    configService?: PersistenceConfigService,
    lockService?: GlobalOperationLockService,
    progressTracker?: ProgressTrackerService,
    retryService?: RetryService,
    loggerService?: StructuredLoggerService
  ) {
    this.configService = configService || new PersistenceConfigService();
    this.lockService = lockService || new GlobalOperationLockService();
    this.progressTracker = progressTracker || new ProgressTrackerService();
    this.retryService = retryService || new RetryService(this.configService);
    this.loggerService = loggerService || new StructuredLoggerService(this.configService.getConfig().backupDirectory);
  }

  async migrateFirestoreToSQLite(onProgress?: ProgressCallback, dryRun = false): Promise<MigrationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const opId = `mig-f2s-${Date.now()}`;
    let recordsMigrated = 0;
    let duplicatesFound = 0;
    let rolledBack = false;

    // Operation locking
    if (!dryRun) {
      if (!this.lockService.acquire("migration")) {
        const activeOp = this.lockService.getActiveOperation();
        throw new Error(`Concurrency Conflict: Another operation is currently running (${activeOp}).`);
      }
    }

    try {
      const pushProgress = (stage: string, percentage: number, message: string) => {
        const elapsed = Date.now() - startTime;
        onProgress?.({ stage, percentage, message });
        
        // Push globally to progress tracker (unless dryRun is silent, but dryRun progress is good too!)
        this.progressTracker.updateProgress({
          operationId: opId,
          operation: "migration",
          stage,
          percentage,
          elapsedTimeMs: elapsed,
          estimatedRemainingTimeMs: Math.max(0, Math.floor(elapsed * (100 - percentage) / (percentage || 1))),
          currentRecordName: message,
          errors,
          warnings: [],
          timestamp: new Date().toISOString()
        });
      };

      pushProgress("init", 5, `${dryRun ? "[Dry Run] " : ""}Initializing Firestore to SQLite migration...`);

      // 1. Connectivity Check
      pushProgress("connectivity", 15, "Checking Firestore accessibility...");
      const isAccessible = await this.primaryRepo.verifyConnectivity();
      if (!isAccessible) {
        throw new Error("Unable to establish connection to Cloud Firestore.");
      }

      // 2. Fetch Firestore Candidates
      pushProgress("fetch", 30, "Retrieving records from Firestore...");
      const firestoreCandidates = await this.retryService.executeWithRetry(async () => {
        return await this.primaryRepo.getAll();
      }, "fetch-firestore-candidates");

      pushProgress("fetch", 50, `Fetched ${firestoreCandidates.length} source records.`);

      // 3. Validation & Duplicate Detection
      pushProgress("validation", 65, "Validating data and checking duplicates...");
      const validated: Candidate[] = [];
      let originalSQLiteData: Candidate[] = [];
      try {
        originalSQLiteData = await this.secondaryRepo.getAll();
      } catch (e) {
        // Safe catch
      }

      const sqliteCandidates = originalSQLiteData;
      const sqliteIdMap = new Map<string, Candidate>(sqliteCandidates.map(c => [c.id, c]));
      const sqliteNameMap = new Map<string, Candidate>(sqliteCandidates.map(c => [(c.name || "").toLowerCase().trim(), c]));

      for (const cand of firestoreCandidates) {
        if (!cand.id || typeof cand.id !== "string" || cand.id.trim() === "") {
          errors.push(`Validation error: Record has an invalid or missing ID.`);
          continue;
        }
        if (!cand.name || typeof cand.name !== "string" || cand.name.trim() === "") {
          errors.push(`Validation error: Candidate ID "${cand.id}" has an invalid or empty name.`);
          continue;
        }
        if (!Array.isArray(cand.skills)) {
          errors.push(`Validation error: Candidate "${cand.name}" (ID: ${cand.id}) skills must be an array.`);
          continue;
        }
        if (typeof cand.experienceYears !== "number" || cand.experienceYears < 0) {
          errors.push(`Validation error: Candidate "${cand.name}" (ID: ${cand.id}) has invalid experience years.`);
          continue;
        }

        // Duplicate detection
        const dupById = sqliteIdMap.get(cand.id);
        const dupByName = sqliteNameMap.get((cand.name || "").toLowerCase().trim());
        if (dupById || dupByName) {
          duplicatesFound++;
        }

        validated.push(cand);
      }

      // Dry run analysis return
      if (dryRun) {
        pushProgress("complete", 100, "[Dry Run] Analysis complete!");
        const elapsed = Date.now() - startTime;
        return {
          success: true,
          recordsMigrated: 0,
          duplicatesFound,
          errors,
          rolledBack: false,
          timestamp: new Date().toISOString(),
          dryRunAnalysis: {
            recordsToMigrate: validated.length,
            conflictsCount: duplicatesFound,
            duplicatesCount: duplicatesFound,
            validationErrors: errors,
            estimatedDurationMs: elapsed + Math.floor(validated.length * 5),
            estimatedWrites: validated.length
          }
        };
      }

      // 4. Batch Write with transaction
      pushProgress("write", 80, "Executing bulk transactional save in SQLite...");
      
      this.secondaryRepo.clearAll();
      try {
        this.secondaryRepo.bulkSave(validated);
        recordsMigrated = validated.length;
      } catch (err: any) {
        // Rollback SQLite to original state
        pushProgress("rollback", 90, "Transaction failed. Rolling back SQLite database...");
        this.secondaryRepo.clearAll();
        if (originalSQLiteData.length > 0) {
          this.secondaryRepo.bulkSave(originalSQLiteData);
        }
        rolledBack = true;
        throw new Error(`SQLite Bulk Save transaction failed: ${err.message || String(err)}`);
      }

      // 5. Final Verify
      pushProgress("verify", 95, "Verifying record integrity...");
      const verifyCount = (await this.secondaryRepo.getAll()).length;
      if (verifyCount !== recordsMigrated) {
        throw new Error(`Data verification failed. Target database count (${verifyCount}) mismatch against migration list count (${recordsMigrated}).`);
      }

      pushProgress("complete", 100, "Migration completed successfully!");

      const durationMs = Date.now() - startTime;
      if (typeof this.secondaryRepo.logMigrationRun === "function") {
        this.secondaryRepo.logMigrationRun("firestore-to-sqlite", recordsMigrated, duplicatesFound, errors, durationMs, "1.0");
      }

      // Write structured log
      this.loggerService.logOperation({
        operationId: opId,
        timestamp: new Date().toISOString(),
        durationMs,
        operation: "migration",
        status: "success",
        recordsProcessed: recordsMigrated,
        warnings: errors.length > 0 ? ["Validation conflicts detected"] : [],
        errors: [],
        retries: 0,
        user: "system_admin",
        environment: process.env.NODE_ENV || "production"
      });

      return {
        success: true,
        recordsMigrated,
        duplicatesFound,
        errors,
        rolledBack: false,
        timestamp: new Date().toISOString()
      };

    } catch (e: any) {
      const errorMsg = e.message || String(e);
      errors.push(errorMsg);
      const durationMs = Date.now() - startTime;

      if (!dryRun) {
        if (typeof this.secondaryRepo.logMigrationRun === "function") {
          this.secondaryRepo.logMigrationRun("firestore-to-sqlite", 0, duplicatesFound, errors, durationMs, "1.0");
        }

        // Write structured log
        this.loggerService.logOperation({
          operationId: opId,
          timestamp: new Date().toISOString(),
          durationMs,
          operation: "migration",
          status: "failure",
          recordsProcessed: 0,
          warnings: [],
          errors: [errorMsg],
          retries: 0,
          user: "system_admin",
          environment: process.env.NODE_ENV || "production"
        });
      }
      
      return {
        success: false,
        recordsMigrated: 0,
        duplicatesFound,
        errors,
        rolledBack,
        timestamp: new Date().toISOString()
      };
    } finally {
      if (!dryRun) {
        this.lockService.release("migration");
      }
    }
  }

  async migrateSQLiteToFirestore(onProgress?: ProgressCallback, dryRun = false): Promise<MigrationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const opId = `mig-s2f-${Date.now()}`;
    let recordsMigrated = 0;
    let duplicatesFound = 0;
    let rolledBack = false;

    // Operation locking
    if (!dryRun) {
      if (!this.lockService.acquire("migration")) {
        const activeOp = this.lockService.getActiveOperation();
        throw new Error(`Concurrency Conflict: Another operation is currently running (${activeOp}).`);
      }
    }

    const docIdsWritten: string[] = [];

    const pushProgress = (stage: string, percentage: number, message: string) => {
      const elapsed = Date.now() - startTime;
      onProgress?.({ stage, percentage, message });
      
      this.progressTracker.updateProgress({
        operationId: opId,
        operation: "migration",
        stage,
        percentage,
        elapsedTimeMs: elapsed,
        estimatedRemainingTimeMs: Math.max(0, Math.floor(elapsed * (100 - percentage) / (percentage || 1))),
        currentRecordName: message,
        errors,
        warnings: [],
        timestamp: new Date().toISOString()
      });
    };

    try {
      pushProgress("init", 5, `${dryRun ? "[Dry Run] " : ""}Initializing SQLite to Firestore migration...`);

      // 1. Fetch SQLite Candidates
      pushProgress("fetch", 20, "Reading records from SQLite...");
      const sqliteCandidates = await this.secondaryRepo.getAll();
      pushProgress("fetch", 40, `Read ${sqliteCandidates.length} source records from SQLite.`);

      if (sqliteCandidates.length === 0) {
        pushProgress("complete", 100, "No candidates found in SQLite to migrate.");
        const durationMs = Date.now() - startTime;
        if (!dryRun && typeof this.secondaryRepo.logMigrationRun === "function") {
          this.secondaryRepo.logMigrationRun("sqlite-to-firestore", 0, 0, [], durationMs, "1.0");
        }
        return {
          success: true,
          recordsMigrated: 0,
          duplicatesFound: 0,
          errors: [],
          rolledBack: false,
          timestamp: new Date().toISOString()
        };
      }

      // 2. Connectivity Check
      pushProgress("connectivity", 50, "Verifying Firestore connection...");
      const isAccessible = await this.primaryRepo.verifyConnectivity();
      if (!isAccessible) {
        throw new Error("Unable to establish connection to Cloud Firestore.");
      }

      // 3. Fetch current Firestore state for duplicate checking
      pushProgress("duplicate_check", 60, "Checking for existing records in Firestore...");
      const firestoreCandidates = await this.retryService.executeWithRetry(async () => {
        return await this.primaryRepo.getAll();
      }, "fetch-firestore-candidates");

      const firestoreIdMap = new Map<string, Candidate>(firestoreCandidates.map(c => [c.id, c]));
      const firestoreNameMap = new Map<string, Candidate>(firestoreCandidates.map(c => [(c.name || "").toLowerCase().trim(), c]));

      const validated: Candidate[] = [];
      for (const cand of sqliteCandidates) {
        if (!cand.id || typeof cand.id !== "string" || cand.id.trim() === "") {
          errors.push(`Validation error (SQLite): Record has invalid/missing ID.`);
          continue;
        }
        if (!cand.name || typeof cand.name !== "string" || cand.name.trim() === "") {
          errors.push(`Validation error (SQLite): Candidate ID "${cand.id}" has empty name.`);
          continue;
        }

        // Duplicate Check
        const dupById = firestoreIdMap.get(cand.id);
        const dupByName = firestoreNameMap.get((cand.name || "").toLowerCase().trim());
        if (dupById || dupByName) {
          duplicatesFound++;
        }

        validated.push(cand);
      }

      // Dry run analysis return
      if (dryRun) {
        pushProgress("complete", 100, "[Dry Run] Analysis complete!");
        const elapsed = Date.now() - startTime;
        return {
          success: true,
          recordsMigrated: 0,
          duplicatesFound,
          errors,
          rolledBack: false,
          timestamp: new Date().toISOString(),
          dryRunAnalysis: {
            recordsToMigrate: validated.length,
            conflictsCount: duplicatesFound,
            duplicatesCount: duplicatesFound,
            validationErrors: errors,
            estimatedDurationMs: elapsed + Math.floor(validated.length * 100), // higher estimate for cloud writes
            estimatedWrites: validated.length
          }
        };
      }

      // 4. Batch/Iterative Write to Firestore
      pushProgress("write", 80, `Migrating ${validated.length} records to Firestore...`);
      
      for (let i = 0; i < validated.length; i++) {
        const cand = validated[i];
        try {
          // Robust retry wrapper for network robustness (Phase 12)
          await this.retryService.executeWithRetry(async () => {
            await this.primaryRepo.save(cand);
          }, `migrate-save-${cand.id}`);

          docIdsWritten.push(cand.id);
          recordsMigrated++;

          const percent = 80 + Math.floor((i / validated.length) * 15);
          pushProgress("write", percent, `Migrated candidate: ${cand.name} (${i + 1}/${validated.length})`);
        } catch (err: any) {
          throw new Error(`Firestore save failed for candidate "${cand.name}" (ID: ${cand.id}): ${err.message || String(err)}`);
        }
      }

      pushProgress("complete", 100, "Migration completed successfully!");

      const durationMs = Date.now() - startTime;
      if (typeof this.secondaryRepo.logMigrationRun === "function") {
        this.secondaryRepo.logMigrationRun("sqlite-to-firestore", recordsMigrated, duplicatesFound, errors, durationMs, "1.0");
      }

      // Structured logging
      this.loggerService.logOperation({
        operationId: opId,
        timestamp: new Date().toISOString(),
        durationMs,
        operation: "migration",
        status: "success",
        recordsProcessed: recordsMigrated,
        warnings: errors.length > 0 ? ["Validation conflicts encountered"] : [],
        errors: [],
        retries: 0,
        user: "system_admin",
        environment: process.env.NODE_ENV || "production"
      });

      return {
        success: true,
        recordsMigrated,
        duplicatesFound,
        errors,
        rolledBack: false,
        timestamp: new Date().toISOString()
      };

    } catch (e: any) {
      const errorMsg = e.message || String(e);
      errors.push(errorMsg);
      pushProgress("rollback", 95, "Migration failed. Initiating Firestore rollback for newly written records...");
      
      // Rollback newly written candidates from Firestore to prevent partial inconsistent states
      if (docIdsWritten.length > 0) {
        try {
          for (const writtenId of docIdsWritten) {
            await this.primaryRepo.delete(writtenId);
          }
          rolledBack = true;
          pushProgress("rollback", 100, `Rollback complete. Cleaned up ${docIdsWritten.length} partial Firestore records.`);
        } catch (rollErr) {
          errors.push(`Rollback clean up error: ${rollErr}`);
        }
      }

      const durationMs = Date.now() - startTime;
      if (!dryRun) {
        if (typeof this.secondaryRepo.logMigrationRun === "function") {
          this.secondaryRepo.logMigrationRun("sqlite-to-firestore", 0, duplicatesFound, errors, durationMs, "1.0");
        }

        // Structured logging
        this.loggerService.logOperation({
          operationId: opId,
          timestamp: new Date().toISOString(),
          durationMs,
          operation: "migration",
          status: "failure",
          recordsProcessed: 0,
          warnings: [],
          errors: [errorMsg],
          retries: 0,
          user: "system_admin",
          environment: process.env.NODE_ENV || "production"
        });
      }

      return {
        success: false,
        recordsMigrated: 0,
        duplicatesFound,
        errors,
        rolledBack,
        timestamp: new Date().toISOString()
      };
    } finally {
      if (!dryRun) {
        this.lockService.release("migration");
      }
    }
  }
}
