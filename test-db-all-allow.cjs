const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

async function main() {
  try {
    const projectId = "qualified-highway-s4dh4";
    const databaseId = "ai-studio-azizassistant-2ecd519e-059f-43dc-b6be-938cc13d5179";
    
    const app = initializeApp({
      projectId,
      credential: applicationDefault()
    });
    
    const db = getFirestore(app, databaseId);
    console.log("Checking connectivity to collection 'candidates' with allow all rules...");
    const snapshot = await db.collection("candidates").limit(1).get();
    console.log("SUCCESS! Got snapshot of size:", snapshot.size);
  } catch (err) {
    console.error("FAILED WITH ERROR:", err);
  }
}

main();
