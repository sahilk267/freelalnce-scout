/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";
import { Candidate } from "../models/Candidate";
import { ICandidateRepository } from "./ICandidateRepository";
import { SQLiteBackupRepository } from "./SQLiteBackupRepository";

export class FirestoreCandidateRepository implements ICandidateRepository {
  private db: Firestore;
  private collectionName = "candidates";
  private fallbackRepo: SQLiteBackupRepository;

  constructor() {
    this.fallbackRepo = new SQLiteBackupRepository();

    let config: any = {};
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");

    if (fs.existsSync(configPath)) {
      try {
        config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      } catch (e) {
        console.error("Failed to parse firebase-applet-config.json:", e);
      }
    }

    const projectId = config.projectId || process.env.FIREBASE_PROJECT_ID || "qualified-highway-s4dh4";
    const databaseId = config.firestoreDatabaseId || process.env.FIRESTORE_DATABASE_ID || process.env.FIREBASE_DATABASE_ID || "ai-studio-azizassistant-2ecd519e-059f-43dc-b6be-938cc13d5179";

    let app;
    if (getApps().length === 0) {
      let credential;
      
      // 1. Try raw JSON string from FIREBASE_SERVICE_ACCOUNT_JSON environment variable/secret
      const saJsonStr = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
      if (saJsonStr) {
        if (saJsonStr.startsWith("{")) {
          try {
            const serviceAccount = JSON.parse(saJsonStr);
            credential = cert(serviceAccount);
            console.log("[Firestore Admin SDK] Initialized credential using FIREBASE_SERVICE_ACCOUNT_JSON string.");
          } catch (e) {
            console.warn("[Firestore Admin SDK] FIREBASE_SERVICE_ACCOUNT_JSON parsing warning:", e);
          }
        } else {
          console.info("[Firestore Admin SDK] FIREBASE_SERVICE_ACCOUNT_JSON is unconfigured or non-JSON placeholder string. Falling back to default credentials.");
        }
      }

      // 2. Try file path from FIREBASE_SERVICE_ACCOUNT_JSON_PATH
      if (!credential) {
        const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_PATH;
        if (saPath && fs.existsSync(saPath)) {
          try {
            const serviceAccount = JSON.parse(fs.readFileSync(saPath, "utf-8"));
            credential = cert(serviceAccount);
            console.log(`[Firestore Admin SDK] Initialized credential using FIREBASE_SERVICE_ACCOUNT_JSON_PATH file: ${saPath}`);
          } catch (e) {
            console.error("Failed to parse service account JSON file:", e);
          }
        }
      }
      
      if (!credential) {
        credential = applicationDefault();
        console.log("[Firestore Admin SDK] Initialized credential using Application Default Credentials.");
      }

      app = initializeApp({
        projectId,
        credential,
      });
    } else {
      app = getApp();
    }

    try {
      this.db = getFirestore(app, databaseId);
      console.log(`[Firestore Admin SDK] Initialized Admin SDK successfully for database: ${databaseId}`);
    } catch (dbErr) {
      console.error("[Firestore Admin SDK] Failed to initialize Firestore with custom database ID. Falling back to default database.", dbErr);
      this.db = getFirestore(app);
    }
  }

  /**
   * Helper to execute operations with exponential backoff retry logic.
   * Fails fast on non-transient permission or authentication errors.
   */
  private async retry<T>(operation: () => Promise<T>, maxAttempts = 3, delayMs = 100): Promise<T> {
    let attempt = 0;
    while (attempt < maxAttempts) {
      try {
        return await operation();
      } catch (err: any) {
        attempt++;
        const errMsg = err?.message || String(err);
        const isNonTransient =
          errMsg.includes("PERMISSION_DENIED") ||
          errMsg.includes("Missing or insufficient permissions") ||
          errMsg.includes("7 PERMISSION_DENIED") ||
          errMsg.includes("5 NOT_FOUND") ||
          errMsg.includes("UNAUTHENTICATED");

        if (isNonTransient || attempt >= maxAttempts) {
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(2, attempt)));
      }
    }
    throw new Error("Retry exhausted.");
  }

  /**
   * Helper to verify if Firestore is currently reachable/accessible
   */
  async verifyConnectivity(): Promise<boolean> {
    try {
      await this.retry(async () => {
        const snapshot = await this.db.collection(this.collectionName).limit(1).get();
        return snapshot;
      }, 1, 50);
      return true;
    } catch (e: any) {
      console.info(`[FirestoreCandidateRepository] Connectivity check notice (${e?.message || e}). Operating in local SQLite fallback mode.`);
      return false;
    }
  }

  async getAll(): Promise<Candidate[]> {
    try {
      return await this.retry(async () => {
        const snapshot = await this.db.collection(this.collectionName).get();
        const list: Candidate[] = [];
        
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            name: data.name || "",
            skills: Array.isArray(data.skills) ? data.skills : [],
            experienceYears: typeof data.experienceYears === "number" ? data.experienceYears : 0,
            locationPreference: data.locationPreference || ""
          });
        });

        return list;
      });
    } catch (e: any) {
      console.info(`[FirestoreCandidateRepository] getAll() fallback triggered (${e?.message || e}). Serving records from local SQLite repository.`);
      return await this.fallbackRepo.getAll();
    }
  }

  async getById(id: string): Promise<Candidate | null> {
    if (!id) return null;
    try {
      return await this.retry(async () => {
        const docSnap = await this.db.collection(this.collectionName).doc(id).get();
        
        if (!docSnap.exists) {
          return null;
        }

        const data = docSnap.data()!;
        return {
          id: docSnap.id,
          name: data.name || "",
          skills: Array.isArray(data.skills) ? data.skills : [],
          experienceYears: typeof data.experienceYears === "number" ? data.experienceYears : 0,
          locationPreference: data.locationPreference || ""
        };
      });
    } catch (e: any) {
      console.info(`[FirestoreCandidateRepository] getById() fallback triggered (${e?.message || e}). Serving record from local SQLite repository.`);
      return await this.fallbackRepo.getById(id);
    }
  }

  async save(candidate: Candidate): Promise<Candidate> {
    const id = candidate.id || `cand-${Date.now()}`;
    const savedCand: Candidate = { ...candidate, id };
    
    try {
      await this.retry(async () => {
        await this.db.collection(this.collectionName).doc(id).set({
          name: savedCand.name || "",
          skills: savedCand.skills || [],
          experienceYears: savedCand.experienceYears || 0,
          locationPreference: savedCand.locationPreference || ""
        });
      });
    } catch (e: any) {
      console.info(`[FirestoreCandidateRepository] save() fallback triggered (${e?.message || e}). Saving record to local SQLite repository.`);
      return await this.fallbackRepo.save(savedCand);
    }

    try {
      await this.fallbackRepo.save(savedCand);
    } catch {
      // Ignore fallback write error if cloud write succeeded
    }

    return savedCand;
  }

  async delete(id: string): Promise<void> {
    if (!id) return;
    try {
      await this.retry(async () => {
        await this.db.collection(this.collectionName).doc(id).delete();
      });
    } catch (e: any) {
      console.info(`[FirestoreCandidateRepository] delete() fallback triggered (${e?.message || e}). Deleting record from local SQLite repository.`);
      return await this.fallbackRepo.delete(id);
    }

    try {
      await this.fallbackRepo.delete(id);
    } catch {
      // Ignore fallback delete error
    }
  }
}
