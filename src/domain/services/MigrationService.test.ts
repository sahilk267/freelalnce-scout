/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from "vitest";
import { MigrationService } from "./MigrationService";
import { Candidate } from "../models/Candidate";
import { MigrationStepProgress } from "./IMigrationService";

describe("MigrationService", () => {
  const sampleCandidates: Candidate[] = [
    { id: "c-1", name: "John Doe", skills: ["Python"], experienceYears: 5, locationPreference: "Remote" },
    { id: "c-2", name: "Jane Smith", skills: ["Ruby"], experienceYears: 3, locationPreference: "London" }
  ];

  it("should migrate Firestore to SQLite successfully with progress reporting and duplicate detection", async () => {
    const mockPrimary = {
      verifyConnectivity: vi.fn().mockResolvedValue(true),
      getAll: vi.fn().mockResolvedValue(sampleCandidates),
      save: vi.fn(),
      getById: vi.fn()
    } as any;

    let sqliteState: Candidate[] = [{ id: "c-1", name: "John Doe", skills: ["Python"], experienceYears: 5, locationPreference: "Remote" }];

    const mockSecondary = {
      getAll: vi.fn().mockImplementation(async () => sqliteState),
      clearAll: vi.fn().mockImplementation(() => {
        sqliteState = [];
      }),
      bulkSave: vi.fn().mockImplementation((list: Candidate[]) => {
        sqliteState = [...list];
      }),
      verifyIntegrity: vi.fn().mockReturnValue(true)
    } as any;

    const progressLogs: MigrationStepProgress[] = [];
    const onProgress = (p: MigrationStepProgress) => {
      progressLogs.push(p);
    };

    const service = new MigrationService(mockPrimary, mockSecondary);
    const result = await service.migrateFirestoreToSQLite(onProgress);

    expect(result.success).toBe(true);
    expect(result.recordsMigrated).toBe(2);
    expect(result.duplicatesFound).toBe(1); // John Doe matches by ID
    expect(result.errors.length).toBe(0);
    expect(result.rolledBack).toBe(false);

    // Verify progress reporting happened
    expect(progressLogs.length).toBeGreaterThanOrEqual(4);
    expect(progressLogs[0].stage).toBe("init");
    expect(progressLogs[progressLogs.length - 1].stage).toBe("complete");
    expect(progressLogs[progressLogs.length - 1].percentage).toBe(100);

    expect(mockSecondary.clearAll).toHaveBeenCalled();
    expect(mockSecondary.bulkSave).toHaveBeenCalledWith(sampleCandidates);
  });

  it("should rollback SQLite if the bulk save operation throws an error", async () => {
    const mockPrimary = {
      verifyConnectivity: vi.fn().mockResolvedValue(true),
      getAll: vi.fn().mockResolvedValue(sampleCandidates),
      save: vi.fn(),
      getById: vi.fn()
    } as any;

    const originalData = [{ id: "orig-1", name: "Original", skills: [], experienceYears: 1, locationPreference: "" }];

    const mockSecondary = {
      getAll: vi.fn().mockResolvedValue(originalData),
      clearAll: vi.fn(),
      bulkSave: vi.fn().mockImplementationOnce(() => {
        throw new Error("Disk Full");
      })
    } as any;

    const service = new MigrationService(mockPrimary, mockSecondary);
    const result = await service.migrateFirestoreToSQLite();

    expect(result.success).toBe(false);
    expect(result.recordsMigrated).toBe(0);
    expect(result.rolledBack).toBe(true);
    expect(result.errors[0]).toContain("Disk Full");

    // Check that original state was restored on rollback
    expect(mockSecondary.clearAll).toHaveBeenCalledTimes(2);
    expect(mockSecondary.bulkSave).toHaveBeenLastCalledWith(originalData);
  });

  it("should migrate SQLite to Firestore successfully", async () => {
    const mockPrimary = {
      verifyConnectivity: vi.fn().mockResolvedValue(true),
      getAll: vi.fn().mockResolvedValue([]), // no duplicates in firestore
      save: vi.fn().mockResolvedValue({}),
      getById: vi.fn()
    } as any;

    const mockSecondary = {
      getAll: vi.fn().mockResolvedValue(sampleCandidates),
      clearAll: vi.fn(),
      bulkSave: vi.fn()
    } as any;

    const progressLogs: MigrationStepProgress[] = [];
    const onProgress = (p: MigrationStepProgress) => {
      progressLogs.push(p);
    };

    const service = new MigrationService(mockPrimary, mockSecondary);
    const result = await service.migrateSQLiteToFirestore(onProgress);

    expect(result.success).toBe(true);
    expect(result.recordsMigrated).toBe(2);
    expect(result.duplicatesFound).toBe(0);
    expect(mockPrimary.save).toHaveBeenCalledTimes(2);
    expect(progressLogs[progressLogs.length - 1].stage).toBe("complete");
  });
});
