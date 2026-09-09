/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BackupResult {
  success: boolean;
  recordsProcessed: number;
  dbSize: number;
  integrityOk: boolean;
  timestamp: string;
  error?: string;
  manifest?: any;
}

export interface RestoreResult {
  success: boolean;
  recordsProcessed: number;
  timestamp: string;
  error?: string;
}

export interface RestorePreviewResult {
  backupRecordsCount: number;
  firestoreRecordsCount: number;
  recordsToOverwrite: string[]; // candidate IDs
  recordsToInsert: string[]; // candidate IDs
  missingRecords: string[]; // candidate IDs
  duplicateIds: string[];
  duplicateNames: string[];
}

export interface DetailedHealthReport {
  firestore: {
    connectivity: boolean;
    latencyMs: number;
    readWriteCapable: boolean;
    recordCount: number;
  };
  sqlite: {
    integrityOk: boolean;
    walStatus: string;
    fileSize: number;
    schemaVersion: number;
    dbVersion: number;
    recordCount: number;
  };
  backup: {
    lastBackupTimestamp: string;
    backupSize: number;
    checksum: string;
    recordCount: number;
    duplicatesFound: {
      ids: string[];
      names: string[];
    };
    comparison: {
      onlyInPrimary: string[]; // candidate IDs
      onlyInBackup: string[]; // candidate IDs
      mismatchedData: string[]; // candidate IDs
      identicalCount: number;
    };
    backupCount: number;
    latestBackupName: string;
    backupAgeMinutes: number;
    healthScore: number;
    healthStatus: string;
  };
  migration: {
    lastMigrationTimestamp: string;
    lastMigrationVersion: string;
    lastMigrationDirection: string;
    lastMigrationDurationMs: number;
    history: any[];
  };
  scheduler: {
    enabled: boolean;
    lastRun: string | null;
    isRunning: boolean;
  };
  system: {
    diskUsageBytes: number;
    diskFreeBytes: number;
    diskTotalBytes: number;
  };
  activeOperation: string | null;
  lockedAt: string | null;
  warnings: string[];
}

export interface IBackupService {
  backup(): Promise<BackupResult>;
  restore(): Promise<RestoreResult>;
  getStatus(): Promise<{
    primaryCount: number;
    secondaryCount: number;
    dbSize: number;
    integrityOk: boolean;
    primaryAccessible: boolean;
    report?: DetailedHealthReport;
  }>;
  compareStoreStates(): Promise<{
    onlyInPrimary: string[];
    onlyInBackup: string[];
    mismatchedData: string[];
    identicalCount: number;
    duplicates: {
      ids: string[];
      names: string[];
    };
  }>;
  generateRestorePreview(): Promise<RestorePreviewResult>;
}
