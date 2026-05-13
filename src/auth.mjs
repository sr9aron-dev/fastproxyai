import { sha256 } from "./crypto.mjs";
import { loadConfig } from "./store.mjs";
import { db } from "./firebase.mjs";

export async function validateExtensionToken(token) {
  if (!token) return null;
  const config = await loadConfig();
  const tokenHash = sha256(token);
  
  const key = config.extensionKeys.find((item) => 
    (item.hash === tokenHash || item.hash === token) && item.active !== false
  );
  
  if (!key) return null;

  // If key is linked to an email, check subscription status
  if (key.email) {
    const sub = await checkSubscription(key.email);
    if (!sub.active) {
      const error = new Error(`Subscription expired or inactive for ${key.email}`);
      error.statusCode = 403;
      error.details = { email: key.email, status: sub.status, expiry: sub.expiry };
      throw error;
    }
    // Attach email to key for context
    key.userEmail = key.email;
  }
  
  return key;
}

export async function checkSubscription(email) {
  if (!email) return { active: true }; // No email linked = unlimited/legacy key

  try {
    if (!db) {
      throw new Error("Database not initialized");
    }
    const docRef = db.collection('users').doc(email);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return { active: false, status: "none" };
    }
    
    const data = doc.data();
    const expiryStr = data.subscriptionExpiry;
    if (!expiryStr) return { active: false, status: "none" };
    
    const expiry = new Date(expiryStr);
    const now = new Date();
    
    return {
      active: expiry > now,
      expiry: expiryStr,
      status: expiry > now ? "active" : "expired"
    };
  } catch (e) {
    console.error("[Auth] Sub check failed:", e.message);
    // If DB is down, we might want to fail-safe based on config, 
    // but for now we return false to be safe if it's a paid service.
    // However, the original code returned active: true as fallback.
    // Let's stick to a safer fallback or a configurable one.
    return { active: false, error: e.message, status: "error" };
  }
}

export async function extendSubscription(email, days = 40) {
  if (!email) throw new Error("Email is required");

  if (!db) {
    throw new Error("Database not initialized");
  }

  const docRef = db.collection("users").doc(email);
  const doc = await docRef.get();
  
  let currentExpiry = new Date();
  if (doc.exists) {
    const data = doc.data();
    if (data.subscriptionExpiry) {
      const existingExpiry = new Date(data.subscriptionExpiry);
      if (existingExpiry > currentExpiry) {
        currentExpiry = existingExpiry;
      }
    }
  }

  const nextExpiry = new Date(currentExpiry.getTime() + days * 24 * 60 * 60 * 1000);
  const nextExpiryStr = nextExpiry.toISOString();

  await docRef.set({
    subscriptionExpiry: nextExpiryStr,
    updatedAt: new Date().toISOString()
  }, { merge: true });

  return { email, expiry: nextExpiryStr };
}
