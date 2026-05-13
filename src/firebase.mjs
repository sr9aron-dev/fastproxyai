import admin from "firebase-admin";

/**
 * Initialize Firebase Admin SDK using Service Account from Environment Variables
 */
function getFirestore() {
  if (!admin.apps.length) {
    let serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountVar) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT environment variable is not set");
    }

    try {
      // Clean up potential formatting issues
      serviceAccountVar = serviceAccountVar.trim();
      
      // If the string starts with the variable name (e.g. "FIREBASE_SERVICE_ACCOUNT={...}"), strip it
      if (serviceAccountVar.startsWith("FIREBASE_SERVICE_ACCOUNT=")) {
        serviceAccountVar = serviceAccountVar.replace("FIREBASE_SERVICE_ACCOUNT=", "").trim();
      }

      const serviceAccount = JSON.parse(serviceAccountVar);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("[Firebase] Admin SDK initialized successfully");
    } catch (err) {
      const snippet = serviceAccountVar ? serviceAccountVar.substring(0, 20) + "..." : "empty";
      console.error(`[Firebase] JSON Parse Failed. Start of string: "${snippet}"`);
      console.error("[Firebase] Error Details:", err.message);
      throw new Error(`Invalid FIREBASE_SERVICE_ACCOUNT JSON: ${err.message}`);
    }
  }
  return admin.firestore();
}

let _db;

export const db = new Proxy({}, {
  get(target, prop) {
    if (!_db) _db = getFirestore();
    return _db[prop];
  }
});

export { admin };
