/**
 * MANUAL, LOCAL-ONLY DEBUGGING TOOL - NOT FOR PRODUCTION OR PACKAGED DEPLOYMENT.
 * 
 * Ad-hoc connectivity verification script for Firestore.
 * Reads configuration strictly from existing environment variables or firebase-applet-config.json.
 */

const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const fs = require("fs");
const path = require("path");

async function main() {
  try {
    let config = {};
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      try {
        config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      } catch (e) {
        console.warn("[test-db-connectivity] Warning reading firebase-applet-config.json:", e.message);
      }
    }

    const projectId = process.env.FIREBASE_PROJECT_ID || config.projectId;
    const databaseId = process.env.FIRESTORE_DATABASE_ID || process.env.FIREBASE_DATABASE_ID || config.firestoreDatabaseId;

    if (!projectId) {
      console.error("[test-db-connectivity] No FIREBASE_PROJECT_ID configured. Aborting local connectivity check.");
      process.exit(1);
    }

    console.log(`[test-db-connectivity] Checking connectivity for project: "${projectId}", database: "${databaseId || '(default)'}"...`);

    const app = initializeApp({
      projectId,
      credential: applicationDefault()
    });

    const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
    const snapshot = await db.collection("candidates").limit(1).get();
    console.log("[test-db-connectivity] Connection SUCCESS! Snapshot size:", snapshot.size);
  } catch (err) {
    console.error("[test-db-connectivity] Connection FAILED:", err.message);
    process.exit(1);
  }
}

main();
