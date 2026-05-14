import { db } from "../src/firebase.mjs";
import { json, optionsResponse, vercelHandler } from "../src/http.mjs";

async function handler(event) {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  
  // Optional: Add authentication here if needed. 
  // For now, let's keep it simple for the user to view.

  try {
    const limit = parseInt(event.queryStringParameters?.limit || "50");
    const snapshot = await db.collection("logs")
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();

    const logs = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Convert Firestore timestamp to ISO string if it exists
        time: data.timestamp ? data.timestamp.toDate().toISOString() : data.time
      };
    });

    return json(200, { ok: true, logs });
  } catch (err) {
    console.error("[Proxy] Logs Error:", err.message);
    return json(500, { ok: false, error: err.message });
  }
}

export default vercelHandler(handler);
