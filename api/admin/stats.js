import { json, optionsResponse, requireAdmin, vercelHandler } from "../../src/http.mjs";
import { db } from "../../src/firebase.mjs";
import { loadConfig } from "../../src/store.mjs";

async function handler(event) {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  
  try {
    requireAdmin(event);
    
    const configId = process.env.CONFIG_ID || "";
    const statsCollection = configId ? `stats-${configId}` : "stats";
    const statsDoc = await db.collection(statsCollection).doc("global").get();
    const stats = statsDoc.exists ? statsDoc.data() : { total: 0, providers: {}, models: {}, status: {}, history: {} };

    // Get config to count keys (respects CONFIG_ID dynamically)
    const config = await loadConfig();
    
    const totalKeys = config.extensionKeys?.length || 0;
    const activeKeys = config.extensionKeys?.filter(k => k.active)?.length || 0;
    
    // Count keys used in the last 24 hours
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const activeToday = config.extensionKeys?.filter(k => k.lastUsedAt && k.lastUsedAt > last24h).length || 0;

    return json(200, { 
      ok: true, 
      stats,
      users: {
        total: totalKeys,
        active: activeKeys,
        onlineToday: activeToday
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
