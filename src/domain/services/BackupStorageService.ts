/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";
import * as crypto from "crypto";
import { SQLiteBackupRepository } from "../repositories/SQLiteBackupRepository";
import { PersistenceConfigService } from "./PersistenceConfigService";
import { Candidate } from "../models/Candidate";

export interface BackupManifest {
  backupFilename: string;
  timestamp: string;
  firestoreRecordCount: number;
  sqliteRecordCount: number;
  backupDurationMs: number;
  fileSize: number;
  sha256Checksum: string;
  integrityStatus: "VALID" | "INVALID";
  integrityDetails: {
    pragmaOk: boolean;
    recordCountOk: boolean;
    checksumOk: boolean;
    missingCount: number;
    duplicateIdCount: number;
    duplicateNameCount: number;
  };
  appVersion: string;
  databaseVersion: string;
  migrationVersion: string;
  healthScore: number; // 0 to 100
  healthStatus: "Healthy" | "Warning" | "Unhealthy";
  compressionEnabled: boolean;
}

export class BackupStorageService {
  constructor(private configService: PersistenceConfigService) {}

  /**
   * Scans backup folder and returns all backups with their manifests
   */
  public listBackups(): { dbFile: string; manifestFile: string | null; manifest: BackupManifest | null; timestamp: Date }[] {
    const config = this.configService.getConfig();
    const dir = config.backupDirectory;
    if (!fs.existsSync(dir)) {
      return [];
    }

    const files = fs.readdirSync(dir);
    const backups: { dbFile: string; manifestFile: string | null; manifest: BackupManifest | null; timestamp: Date }[] = [];

    for (const file of files) {
      if ((file.startsWith("backup-") && file.endsWith(".sqlitedb")) || file.endsWith(".sqlitedb.gz")) {
        const fullPath = path.join(dir, file);
        const manifestFile = fullPath.replace(/\.sqlitedb(\.gz)?$/, ".manifest.json");
        let manifest: BackupManifest | null = null;

        if (fs.existsSync(manifestFile)) {
          try {
            manifest = JSON.parse(fs.readFileSync(manifestFile, "utf-8"));
          } catch (e) {
            console.error(`Failed to parse manifest for ${file}:`, e);
          }
        }

        // Try parsing timestamp from filename e.g. backup-YYYY-MM-DD-HH-MM-SS
        const match = file.match(/backup-(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})/);
        let timestamp = new Date();
        if (match && match[1]) {
          const parts = match[1].split("-");
          // Format parts to YYYY-MM-DDTHH:MM:SS
          timestamp = new Date(`${parts[0]}-${parts[1]}-${parts[2]}T${parts[3]}:${parts[4]}:${parts[5]}`);
        } else {
          const stat = fs.statSync(fullPath);
          timestamp = stat.mtime;
        }

        backups.push({
          dbFile: fullPath,
          manifestFile: fs.existsSync(manifestFile) ? manifestFile : null,
          manifest,
          timestamp
        });
      }
    }

    // Sort by timestamp descending
    return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Helper to compute file SHA-256
   */
  private getFileChecksum(filePath: string): string {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(fileBuffer).digest("hex");
  }

  /**
   * Calculate data checksum
   */
  private calculateDataChecksum(candidates: Candidate[]): string {
    const sorted = [...candidates].sort((a, b) => (a.id || "").localeCompare(b.id || ""));
    const str = JSON.stringify(sorted.map(c => ({
      id: c.id,
      name: c.name,
      skills: Array.isArray(c.skills) ? [...c.skills].sort() : [],
      experienceYears: c.experienceYears,
      locationPreference: c.locationPreference
    })));
    return crypto.createHash("sha256").update(str).digest("hex");
  }

  /**
   * Decompress a gzipped backup file to a temp file path
   */
  public decompressBackup(gzipPath: string): string {
    const tempPath = gzipPath.replace(/\.gz$/, ".decompressed.tmp");
    const compressed = fs.readFileSync(gzipPath);
    const decompressed = zlib.gunzipSync(compressed);
    fs.writeFileSync(tempPath, decompressed);
    return tempPath;
  }

  /**
   * Save a backup of candidate records, validate, compress and apply retention policy
   */
  public async storeBackup(
    candidates: Candidate[],
    firestoreChecksum: string,
    durationMs: number
  ): Promise<{ success: boolean; manifest: BackupManifest }> {
    const config = this.configService.getConfig();
    const dir = config.backupDirectory;

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const timestampStr = new Date().toISOString()
      .replace(/:/g, "-")
      .replace(/\./g, "-")
      .replace("T", "-")
      .replace("Z", "");

    const dbFilename = `backup-${timestampStr}.sqlitedb`;
    const dbPath = path.join(dir, dbFilename);

    // Write SQLite DB
    const repo = new SQLiteBackupRepository(dbPath);
    repo.clearAll();
    repo.bulkSave(candidates);

    // Save metadata
    const localChecksum = this.calculateDataChecksum(candidates);
    repo.setMetaValue("last_backup_timestamp", new Date().toISOString());
    repo.setMetaValue("backup_checksum", localChecksum);

    // Get versions
    const schemaVersion = repo.getPragmaVersion("schema").toString();
    const dbVersion = repo.getPragmaVersion("user").toString();
    repo.close();

    // Perform validation
    const checkRepo = new SQLiteBackupRepository(dbPath);
    const pragmaOk = checkRepo.verifyIntegrity();
    const backupCands = await checkRepo.getAll();
    checkRepo.close();

    // Compare with Firestore
    const firestoreCount = candidates.length;
    const sqliteCount = backupCands.length;
    const recordCountOk = firestoreCount === sqliteCount;
    const checksumOk = firestoreChecksum === localChecksum;

    // Missing records from backup
    const backIdSet = new Set(backupCands.map(c => c.id));
    const missingCount = candidates.filter(c => !backIdSet.has(c.id)).length;

    // Duplicates inside Firestore
    const firestoreIds = candidates.map(c => c.id);
    const duplicateIds = firestoreIds.filter((item, index) => firestoreIds.indexOf(item) !== index);
    const duplicateIdCount = Array.from(new Set(duplicateIds)).length;

    const firestoreNames = candidates.map(c => (c.name || "").toLowerCase().trim());
    const duplicateNames = firestoreNames.filter((item, index) => firestoreNames.indexOf(item) !== index);
    const duplicateNameCount = Array.from(new Set(duplicateNames)).length;

    // Calculate Health Score
    let healthScore = 100;
    if (!pragmaOk) {
      healthScore -= 50;
    }
    if (!checksumOk) {
      healthScore -= 20;
    }
    if (missingCount > 0) {
      healthScore -= Math.min(missingCount * 2, 20); // deduct 2% per missing, max 20%
    }
    if (duplicateIdCount > 0) {
      healthScore -= Math.min(duplicateIdCount * 5, 25); // deduct 5% per duplicate ID, max 25%
    }
    if (duplicateNameCount > 0) {
      healthScore -= Math.min(duplicateNameCount * 1, 10); // deduct 1% per duplicate name, max 10%
    }

    healthScore = Math.max(0, Math.min(100, healthScore));

    let healthStatus: "Healthy" | "Warning" | "Unhealthy" = "Healthy";
    if (healthScore < 70 || !pragmaOk) {
      healthStatus = "Unhealthy";
    } else if (healthScore < 100) {
      healthStatus = "Warning";
    }

    const integrityStatus = (pragmaOk && recordCountOk && checksumOk && healthScore >= 70) ? "VALID" : "INVALID";

    let finalFilename = dbFilename;
    let finalPath = dbPath;

    // Compression (Phase 16)
    if (config.compressionEnabled) {
      const gzipPath = `${dbPath}.gz`;
      const uncompressedBuffer = fs.readFileSync(dbPath);
      const compressedBuffer = zlib.gzipSync(uncompressedBuffer);
      fs.writeFileSync(gzipPath, compressedBuffer);
      
      // Delete original uncompressed file
      fs.unlinkSync(dbPath);
      finalFilename = `${dbFilename}.gz`;
      finalPath = gzipPath;
    }

    const fileSize = fs.existsSync(finalPath) ? fs.statSync(finalPath).size : 0;
    const sha256Checksum = this.getFileChecksum(finalPath);

    const manifest: BackupManifest = {
      backupFilename: finalFilename,
      timestamp: new Date().toISOString(),
      firestoreRecordCount: firestoreCount,
      sqliteRecordCount: sqliteCount,
      backupDurationMs: durationMs,
      fileSize,
      sha256Checksum,
      integrityStatus,
      integrityDetails: {
        pragmaOk,
        recordCountOk,
        checksumOk,
        missingCount,
        duplicateIdCount,
        duplicateNameCount
      },
      appVersion: "1.0.0",
      databaseVersion: dbVersion || "1",
      migrationVersion: schemaVersion || "1.0",
      healthScore,
      healthStatus,
      compressionEnabled: config.compressionEnabled
    };

    // Save manifest file
    const manifestPath = finalPath.replace(/\.sqlitedb(\.gz)?$/, ".manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");

    // Copy latest valid backup to default "backup.sqlitedb" for legacy system compatibility
    if (integrityStatus === "VALID") {
      const defaultDbPath = path.join(process.cwd(), "backup.sqlitedb");
      try {
        if (config.compressionEnabled) {
          const decompressedData = zlib.gunzipSync(fs.readFileSync(finalPath));
          fs.writeFileSync(defaultDbPath, decompressedData);
        } else {
          fs.copyFileSync(finalPath, defaultDbPath);
        }
      } catch (e) {
        console.error("Failed to copy latest backup to default fallback database:", e);
      }
    }

    // Apply Retention Policy (Phase 3)
    this.applyRetentionPolicy();

    // Verify requirements: "Never report success on invalid backup."
    if (integrityStatus === "INVALID") {
      throw new Error(`Backup failed validation checks. Health Score: ${healthScore}%. Integrity Status: INVALID.`);
    }

    return { success: true, manifest };
  }

  /**
   * Deletes older backups automatically according to retention count (Phase 3)
   * Never deletes the newest backup.
   */
  public applyRetentionPolicy(): void {
    const config = this.configService.getConfig();
    const backups = this.listBackups();

    if (backups.length <= config.retentionCount) {
      return;
    }

    // Keep the newest, delete the oldest
    const filesToKeepCount = Math.max(1, config.retentionCount);
    const filesToDelete = backups.slice(filesToKeepCount);

    for (const b of filesToDelete) {
      try {
        if (fs.existsSync(b.dbFile)) {
          fs.unlinkSync(b.dbFile);
          console.log(`Deleted backup file due to retention policy: ${b.dbFile}`);
        }
        if (b.manifestFile && fs.existsSync(b.manifestFile)) {
          fs.unlinkSync(b.manifestFile);
          console.log(`Deleted manifest file due to retention policy: ${b.manifestFile}`);
        }
      } catch (e) {
        console.error(`Failed to delete backup during retention cleanup:`, e);
      }
    }
  }
}
