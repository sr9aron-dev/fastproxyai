import { json, optionsResponse, requireAdmin, vercelHandler } from "../../src/http.mjs";
import { db } from "../../src/firebase.mjs";
import { loadConfig } from "../../src/store.mjs";

// Firestore stores dot-notation paths as flat keys when using FieldValue.increment().
// This converts e.g. { "history.2026-05-05.total": 377 } into { history: { "2026-05-05": { total: 377 } } }
function unflatten(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const parts = key.split(".");
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) current[parts[i]] = {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
  }
  return result;
}

async function handler(event) {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  
  try {
    requireAdmin(event);
    
    const configId = process.env.CONFIG_ID || "";
    const statsCollection = configId ? `stats-${configId}` : "stats";
    const statsDoc = await db.collection(statsCollection).doc("global").get();
    const rawStats = statsDoc.exists ? statsDoc.data() : {};
    const stats = unflatten(rawStats);
    // Ensure all expected keys exist
    stats.total = stats.total || 0;
    stats.providers = stats.providers || {};
    stats.models = stats.models || {};
    stats.status = stats.status || {};
    stats.history = stats.history || {};

    // Get config to count keys (respects CONFIG_ID dynamically)
    const config = await loadConfig();
    
    const totalKeys = config.extensionKeys?.length || 0;
    const activeKeys = config.extensionKeys?.filter(k => k.active)?.length || 0;
    
    // Count keys used in the last 24 hours
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const activeToday = config.extensionKeys?.filter(k => k.lastUsedAt && k.lastUsedAt > last24h).length || 0;

    // Count TeePublic Users
    const tpSnap = await db.collection("teepublicUsers").get();
    let tpTotal = 0, tpActive = 0;
    const now = new Date();
    tpSnap.forEach(doc => {
      tpTotal++;
      const data = doc.data();
      const expiry = data.subscriptionExpiry ? new Date(data.subscriptionExpiry) : null;
      if (expiry && expiry > now) tpActive++;
    });

    // Count Smart Keyword Pro Users
    const skSnap = await db.collection("users").get();
    let skTotal = 0, skActive = 0;
    skSnap.forEach(doc => {
      skTotal++;
      const data = doc.data();
      const expiry = data.subscriptionExpiry ? new Date(data.subscriptionExpiry) : null;
      if (expiry && expiry > now) skActive++;
    });

    return json(200, { 
      ok: true, 
      stats,
      users: {
        total: totalKeys,
        active: activeKeys,
        onlineToday: activeToday,
        teepublic: { total: tpTotal, active: tpActive },
        smartkeyword: { total: skTotal, active: skActive }
      }
    });
  } catch (error) {
    return json(error.statusCode || 500, {
      ok: false,
      error: { code: "STATS_ERROR", message: error.message }
    });
  }
}

export default vercelHandler(handler);
