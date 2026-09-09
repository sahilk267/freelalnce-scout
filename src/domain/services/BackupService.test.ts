/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from "vitest";
import { BackupService } from "./BackupService";
import { Candidate } from "../models/Candidate";

describe("BackupService", () => {
  const mockCandidates: Candidate[] = [
    { id: "cand-1", name: "Alice", skills: ["JS"], experienceYears: 2, locationPreference: "Remote" },
    { id: "cand-2", name: "Bob", skills: ["Go"], experienceYears: 4, locationPreference: "NY" }
  ];

  it("should successfully back up records from primary to secondary", async () => {
    const mockPrimary = {
      getAll: vi.fn().mockResolvedValue(mockCandidates),
      save: vi.fn(),
      getById: vi.fn(),
      verifyConnectivity: vi.fn().mockResolvedValue(true)
    } as any;

    const mockSecondary = {
      clearAll: vi.fn(),
      bulkSave: vi.fn(),
      getAll: vi.fn().mockResolvedValue(mockCandidates),
      getDatabaseSize: vi.fn().mockReturnValue(1024),
      verifyIntegrity: vi.fn().mockReturnValue(true)
    } as any;

    const service = new BackupService(mockPrimary, mockSecondary);
    const result = await service.backup();

    expect(result.success).toBe(true);
    expect(result.recordsProcessed).toBe(2);
    expect(result.dbSize).toBe(1024);
    expect(result.integrityOk).toBe(true);
    expect(mockPrimary.getAll).toHaveBeenCalled();
    expect(mockSecondary.clearAll).toHaveBeenCalled();
    expect(mockSecondary.bulkSave).toHaveBeenCalledWith(mockCandidates);
  });

  it("should fail backup and return errors if primary data is invalid", async () => {
    const invalidCandidates: Candidate[] = [
      { id: "", name: "Alice", skills: [], experienceYears: 1, locationPreference: "" } // missing id
    ];

    const mockPrimary = {
      getAll: vi.fn().mockResolvedValue(invalidCandidates),
      save: vi.fn(),
      getById: vi.fn(),
      verifyConnectivity: vi.fn().mockResolvedValue(true)
    } as any;

    const mockSecondary = {
      clearAll: vi.fn(),
      bulkSave: vi.fn(),
      getDatabaseSize: vi.fn().mockReturnValue(512),
      verifyIntegrity: vi.fn().mockReturnValue(false)
    } as any;

    const service = new BackupService(mockPrimary, mockSecondary);
    const result = await service.backup();

    expect(result.success).toBe(false);
    expect(result.recordsProcessed).toBe(0);
    expect(result.error).toContain("Data validation failed");
    expect(mockSecondary.bulkSave).not.toHaveBeenCalled();
  });

  it("should successfully restore records from secondary to primary", async () => {
    const mockPrimary = {
      getAll: vi.fn(),
      save: vi.fn().mockImplementation((cand) => Promise.resolve(cand)),
      getById: vi.fn(),
      verifyConnectivity: vi.fn()
    } as any;

    const mockSecondary = {
      clearAll: vi.fn(),
      bulkSave: vi.fn(),
      getAll: vi.fn().mockResolvedValue(mockCandidates),
      getDatabaseSize: vi.fn(),
      verifyIntegrity: vi.fn()
    } as any;

    const service = new BackupService(mockPrimary, mockSecondary);
    const result = await service.restore();

    expect(result.success).toBe(true);
    expect(result.recordsProcessed).toBe(2);
    expect(mockSecondary.getAll).toHaveBeenCalled();
    expect(mockPrimary.save).toHaveBeenCalledTimes(2);
  });

  it("should retrieve system and database status accurately", async () => {
    const mockPrimary = {
      getAll: vi.fn().mockResolvedValue(mockCandidates),
      save: vi.fn(),
      getById: vi.fn(),
      verifyConnectivity: vi.fn().mockResolvedValue(true)
    } as any;

    const mockSecondary = {
      clearAll: vi.fn(),
      bulkSave: vi.fn(),
      getAll: vi.fn().mockResolvedValue(mockCandidates),
      getDatabaseSize: vi.fn().mockReturnValue(2048),
      verifyIntegrity: vi.fn().mockReturnValue(true)
    } as any;

    const service = new BackupService(mockPrimary, mockSecondary);
    const status = await service.getStatus();

    expect(status.primaryAccessible).toBe(true);
    expect(status.primaryCount).toBe(2);
    expect(status.secondaryCount).toBe(2);
    expect(status.dbSize).toBe(2048);
    expect(status.integrityOk).toBe(true);
  });
});
