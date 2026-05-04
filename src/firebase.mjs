import admin from "firebase-admin";

/**
 * Initialize Firebase Admin SDK using Service Account from Environment Variables
 */
function getFirestore() {
  if (!admin.apps.length) {
    const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountVar) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT environment variable is not set");
    }

    try {
      const serviceAccount = JSON.parse(serviceAccountVar);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("[Firebase] Admin SDK initialized successfully");
    } catch (err) {
      console.error("[Firebase] Initialization failed:", err.message);
      throw err;
    }
  }
  return admin.firestore();
}

export const db = getFirestore();
export { admin };
