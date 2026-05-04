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
  
  return key || null;
}

export async function checkSubscription(email) {
  if (!email) return { active: true }; // No email linked = unlimited/legacy key

  try {
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
    return { active: true, error: e.message }; // Fallback to active if DB is down
  }
}
