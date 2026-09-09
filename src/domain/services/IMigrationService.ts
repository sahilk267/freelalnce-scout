/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MigrationStepProgress {
  stage: string;
  percentage: number;
  message: string;
}

export type ProgressCallback = (progress: MigrationStepProgress) => void;

export interface MigrationResult {
  success: boolean;
  recordsMigrated: number;
  duplicatesFound: number;
  errors: string[];
  rolledBack: boolean;
  timestamp: string;
  dryRunAnalysis?: {
    recordsToMigrate: number;
    conflictsCount: number;
    duplicatesCount: number;
    validationErrors: string[];
    estimatedDurationMs: number;
    estimatedWrites: number;
  };
}

export interface IMigrationService {
  migrateFirestoreToSQLite(onProgress?: ProgressCallback, dryRun?: boolean): Promise<MigrationResult>;
  migrateSQLiteToFirestore(onProgress?: ProgressCallback, dryRun?: boolean): Promise<MigrationResult>;
}
