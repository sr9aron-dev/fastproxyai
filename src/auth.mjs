import { sha256 } from "./crypto.mjs";
import { loadConfig } from "./store.mjs";

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
    const firebaseKey = process.env.FIREBASE_API_KEY || "AIzaSyCNGYKxyqvqCrduHbl6BJ5a2AbBOJMsrz8";
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/fast-proxy-ai/databases/(default)/documents/users/${encodeURIComponent(email)}?key=${firebaseKey}`;
    
    const res = await fetch(firestoreUrl);
    if (!res.ok) {
      if (res.status === 404) return { active: false, status: "none" };
      throw new Error(`Firestore error: ${res.status}`);
    }
    
    const doc = await res.json();
    const expiryStr = doc.fields?.subscriptionExpiry?.stringValue;
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
