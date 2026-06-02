import { json, optionsResponse, readJson, vercelHandler } from "../src/http.mjs";
import { db } from "../src/firebase.mjs";
import { extendSubscription } from "../src/auth.mjs";

async function handler(event) {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  if (event.httpMethod !== "POST") return json(405, { ok: false, message: "Method not allowed" });

  try {
    const { email, deviceHash } = readJson(event);
    if (!email || !deviceHash) {
      return json(400, { ok: false, message: "Email and deviceHash required" });
    }

    if (!db) {
      return json(500, { ok: false, message: "Database not initialized" });
    }

    const configId = process.env.CONFIG_ID || "";
    const devicesCollection = configId ? `device_trials-${configId}` : "device_trials";
    const usersCollection = configId ? `users-${configId}` : "users";

    // Check if device already used a trial
    const deviceRef = db.collection(devicesCollection).doc(deviceHash);
    const deviceDoc = await deviceRef.get();

    if (deviceDoc.exists) {
      return json(403, { ok: false, message: "Free trial already used on this device", code: "TRIAL_USED" });
    }

    // Check if user already used a trial or has active subscription
    const userRef = db.collection(usersCollection).doc(email);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      const userData = userDoc.data();
      if (userData.isTrial) {
        return json(403, { ok: false, message: "User already claimed a free trial", code: "TRIAL_USED_USER" });
      }
      
      const expiryStr = userData.subscriptionExpiry;
      if (expiryStr) {
        const expiry = new Date(expiryStr);
        if (expiry > new Date()) {
          return json(400, { ok: false, message: "User already has an active subscription", code: "ACTIVE_SUB" });
        }
      }
    }

    // Grant 1-day trial
    await extendSubscription(email, 1);
    
    // Mark user as trial
    await userRef.set({ isTrial: true }, { merge: true });

    // Mark device as used
    await deviceRef.set({
      email,
      claimedAt: new Date().toISOString()
    });

    return json(200, { ok: true, message: "1-Day Free Trial activated successfully", isTrial: true });
  } catch (error) {
    console.error("[Trial] Error:", error.message);
    return json(500, { ok: false, message: error.message });
  }
}

export default vercelHandler(handler);
