import { json, optionsResponse, requireAdmin, vercelHandler } from "../../src/http.mjs";
import { db } from "../../src/firebase.mjs";

async function handler(event) {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  
  try {
    requireAdmin(event);
    
    const doc = await db.collection("stats").doc("global").get();
    const stats = doc.exists ? doc.data() : { total: 0, providers: {}, models: {}, status: {}, history: {} };

    return json(200, { ok: true, stats });
  } catch (error) {
    return json(error.statusCode || 500, {
      ok: false,
      error: { code: "STATS_ERROR", message: error.message }
    });
  }
}

export default vercelHandler(handler);
