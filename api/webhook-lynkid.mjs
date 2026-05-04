import { db } from "../src/firebase.mjs";
import { json, vercelHandler } from "../src/http.mjs";
import { getStore } from "@netlify/blobs"; // This will be handled by the same dynamic import logic if we move it to store.mjs

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, message: "Method not allowed" });
  }

  try {
    const body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    console.log("[Webhook] Received from Lynk.id:", JSON.stringify(body));

    const isPaymentReceived = body.event === "payment.received";
    const isSuccess = body.data?.message_action === "SUCCESS";

    if (!isPaymentReceived || !isSuccess) {
      return json(200, { ok: true, message: "Ignored: Not a successful payment" });
    }

    const msgData = body.data.message_data;
    const email = msgData?.customer?.email;
    const transactionId = msgData?.refId || body.data?.message_id;
    const productName = msgData?.items?.[0]?.title || "Pro Subscription";

    if (!email) {
      return json(400, { ok: false, message: "Error: Missing email" });
    }

    const daysToAdd = 40;
    const now = new Date();
    const docRef = db.collection('users').doc(email.toLowerCase());
    const doc = await docRef.get();

    let expiryDate = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

    if (doc.exists) {
      const data = doc.data();
      const currentExpiryStr = data.subscriptionExpiry;
      if (currentExpiryStr) {
        const currentExpiry = new Date(currentExpiryStr);
        if (currentExpiry > now) {
          expiryDate = new Date(currentExpiry.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        }
      }
    }

    await docRef.set({
      email: email.toLowerCase(),
      subscriptionStatus: "active",
      subscriptionExpiry: expiryDate.toISOString(),
      lastTransactionId: transactionId,
      plan: productName,
      updatedAt: now.toISOString()
    }, { merge: true });

    // Netlify Blobs sync (optional, will fail gracefully on Vercel)
    try {
      const { getStore } = await import("@netlify/blobs");
      const userStore = getStore("smart-keyword-users");
      await userStore.setJSON(email.toLowerCase(), {
        status: "active",
        expiry: expiryDate.toISOString(),
        lastUpdate: now.toISOString()
      });
    } catch (blobErr) {
      // Ignore if not on Netlify
    }

    console.log(`[Webhook] SUCCESS! User ${email} updated. New expiry: ${expiryDate.toISOString()}`);
    return json(200, { ok: true, message: "Success" });

  } catch (err) {
    console.error("[Webhook] Error processing request:", err);
    return json(400, { ok: false, message: "Bad Request" });
  }
}

export default vercelHandler(handler);
