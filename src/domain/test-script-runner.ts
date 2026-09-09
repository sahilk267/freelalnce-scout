import dotenv from "dotenv";
dotenv.config();

import { DIContainer } from "./di/DIContainer";
import { ICandidateRepository } from "./repositories/ICandidateRepository";
import { IBackupService } from "./services/IBackupService";

async function main() {
  console.log("==================================================================");
  console.log("PROGRAMMATIC SECURITY CONTROL AND CREDENTIAL VERIFICATION");
  console.log("==================================================================");
  
  console.log("--- ENVIRONMENT DIAGNOSTICS ---");
  console.log("Available environment keys:", Object.keys(process.env).filter(k => k.includes("FIRE") || k.includes("SERVICE") || k.includes("CRED")));
  
  const rawSecret = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawSecret) {
    console.log("FIREBASE_SERVICE_ACCOUNT_JSON exists! Length:", rawSecret.length);
    try {
      const parsed = JSON.parse(rawSecret.trim());
      console.log("Successfully parsed FIREBASE_SERVICE_ACCOUNT_JSON! Keys:", Object.keys(parsed));
    } catch (e: any) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON as JSON:", e.message);
    }
  } else {
    console.log("FIREBASE_SERVICE_ACCOUNT_JSON does NOT exist in process.env.");
  }
  console.log("--------------------------------\n");

  const repo = DIContainer.get<ICandidateRepository>("ICandidateRepository");
  
  console.log("Testing Firestore Connection via verifyConnectivity()...");
  const connected = typeof (repo as any).verifyConnectivity === "function" 
    ? await (repo as any).verifyConnectivity() 
    : true;
  console.log("Firestore Connected successfully?", connected ? "YES" : "NO");

  if (connected) {
    console.log("\nTriggering Manual Backup / Scheduler Flow once...");
    const backupService = DIContainer.get<IBackupService>("IBackupService");
    const result = await backupService.backup();
    console.log("\n--- BACKUP REPORT ---");
    console.log(JSON.stringify(result, null, 2));
    console.log("---------------------");
  } else {
    console.error("\nFAILED: Firestore is not accessible.");
  }
}

main().catch(err => {
  console.error("Execution failed:", err);
});
