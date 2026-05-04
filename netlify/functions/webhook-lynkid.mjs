import { getStore } from "@netlify/blobs";
import { db } from "../../src/firebase.mjs";

/**
 * Webhook handler for Lynk.id transactions
 * Endpoint: /api/webhook-lynkid
 */
export default async (req, context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    console.log("[Webhook] Received from Lynk.id:", JSON.stringify(body));

    // 1. Validasi Struktur Lynk.id
    const isPaymentReceived = body.event === "payment.received";
    const isSuccess = body.data?.message_action === "SUCCESS";

    if (!isPaymentReceived || !isSuccess) {
      console.log("[Webhook] Ignored: Not a successful payment event");
      return new Response("Ignored: Not a successful payment", { status: 200 });
    }

    const msgData = body.data.message_data;
    const email = msgData?.customer?.email;
    const transactionId = msgData?.refId || body.data?.message_id;
    const productName = msgData?.items?.[0]?.title || "Pro Subscription";

    if (!email) {
      console.error("[Webhook] Error: Email not found in payload");
      return new Response("Error: Missing email", { status: 400 });
    }

    // 2. Calculate Expiry (40 days)
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
          // Tambahkan ke masa aktif yang sudah ada
          expiryDate = new Date(currentExpiry.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        }
      }
    }

    // 3. Update Firestore via Admin SDK
    await docRef.set({
      email: email.toLowerCase(),
      subscriptionStatus: "active",
      subscriptionExpiry: expiryDate.toISOString(),
      lastTransactionId: transactionId,
      plan: productName,
      updatedAt: now.toISOString()
    }, { merge: true });

    // 4. Also sync to Netlify Blobs for faster edge checking
    try {
      const userStore = getStore("smart-keyword-users");
      await userStore.setJSON(email.toLowerCase(), {
        status: "active",
        expiry: expiryDate.toISOString(),
        lastUpdate: now.toISOString()
      });
    } catch (blobErr) {
      console.warn("[Webhook] Blobs sync failed (non-critical):", blobErr.message);
    }

    console.log(`[Webhook] SUCCESS! User ${email} updated. New expiry: ${expiryDate.toISOString()}`);
    return new Response("Success", { status: 200 });

  } catch (err) {
    console.error("[Webhook] Error processing request:", err);
    return new Response("Bad Request", { status: 400 });
  }
};

export const config = {
  path: "/api/webhook-lynkid"
};
