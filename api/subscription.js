import { json, optionsResponse, readJson, vercelHandler } from "../src/http.mjs";
import { extendSubscription } from "../src/auth.mjs";
import { recordLog } from "../src/store.mjs";
import { db } from "../src/firebase.mjs";

async function handler(event) {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST" } });
  }

  const body = readJson(event);

  // === 1. START TRIAL LOGIC ===
  // Use body.action to route since Vercel rewrites may alter event.path
  if (body.action === "start-trial") {
    try {
      const { email, deviceHash } = body;
      if (!email || !deviceHash) return json(400, { ok: false, message: "Email and deviceHash required" });
      if (!db) return json(500, { ok: false, message: "Database not initialized" });

      const configId = process.env.CONFIG_ID || "";
      const devicesCollection = configId ? `device_trials-${configId}` : "device_trials";
      const usersCollection = configId ? `users-${configId}` : "users";

      const deviceRef = db.collection(devicesCollection).doc(deviceHash);
      const deviceDoc = await deviceRef.get();
      if (deviceDoc.exists) return json(403, { ok: false, message: "Free trial already used on this device", code: "TRIAL_USED" });

      const userRef = db.collection(usersCollection).doc(email);
      const userDoc = await userRef.get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        if (userData.isTrial) return json(403, { ok: false, message: "User already claimed a free trial", code: "TRIAL_USED_USER" });
        if (userData.subscriptionExpiry && new Date(userData.subscriptionExpiry) > new Date()) {
          return json(400, { ok: false, message: "User already has an active subscription", code: "ACTIVE_SUB" });
        }
      }

      await extendSubscription(email, 1);
      await userRef.set({ isTrial: true }, { merge: true });
      await deviceRef.set({ email, claimedAt: new Date().toISOString() });

      return json(200, { ok: true, message: "1-Day Free Trial activated successfully", isTrial: true });
    } catch (e) {
      return json(500, { ok: false, message: e.message });
    }
  }

  // === 2. WEBHOOK LYNKID LOGIC ===
  try {
    if (body.event === "ping" || body.event === "test") {
      return json(200, { ok: true, message: "Ping received" });
    }

    const email = body.data?.message_data?.customer?.email || body.user_email || body.email;
    const status = body.data?.message_action || body.status || body.transaction_status;
    const eventType = body.event;
    
    const items = body.data?.message_data?.items || [];
    const productUuid = items[0]?.uuid || "";
    const expectedUuid = "69f8bc383494a38805ddad8f-3584-3961659950-1777908792574";

    if (!email && eventType === "payment.received") return json(400, { ok: false, message: "No email found" });
    if (!email) return json(200, { ok: true, message: "Event ignored" });

    const isSuccess = ["success", "paid", "settlement", "completed"].includes(String(status).toLowerCase());
    if (!isSuccess && eventType !== "payment.received") return json(200, { ok: true, message: "Ignored (not success)" });
    if (productUuid !== expectedUuid) return json(200, { ok: true, message: "Ignored (invalid product UUID)" });

    const result = await extendSubscription(email, 30);
    // Remove the trial flag since they actually paid
    if (db) {
        const configId = process.env.CONFIG_ID || "";
        const usersCollection = configId ? `users-${configId}` : "users";
        await db.collection(usersCollection).doc(email).set({ isTrial: false }, { merge: true });
    }

    await recordLog({ method: "WEBHOOK", path: "/api/webhook-lynkid", status: 200, host: "Lynk.id", message: `Subscription extended for ${email} (+30 days)` });
    return json(200, { ok: true, message: "Subscription extended successfully", data: result });
  } catch (error) {
    console.error("[Webhook] Error:", error);
    return json(500, { ok: false, error: { code: "WEBHOOK_ERROR", message: error.message } });
  }
}

export default vercelHandler(handler);
