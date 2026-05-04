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

    // 1. Security Check (Optional but recommended)
    // Lynk.id usually sends a signature or you can check a specific secret in headers
    // For now, we'll proceed if status is 'success'
    if (body.status !== "success" && body.payment_status !== "paid") {
      return new Response("Ignored: payment not successful", { status: 200 });
    }

    const email = body.customer_email || body.email;
    const productId = body.product_id;
    const transactionId = body.reference_id || body.transaction_id;

    if (!email) {
      return new Response("Error: Missing email", { status: 400 });
    }

    // 2. Calculate Expiry (Default 40 days for the $12 package)
    // In a real scenario, you'd check productId against your price list
    const daysToAdd = 40;
    const now = new Date();
    
    const docRef = db.collection('users').doc(email);
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

    // 3. Update Firestore via Admin SDK
    await docRef.set({
      email: email,
      subscriptionStatus: "active",
      subscriptionExpiry: expiryDate.toISOString(),
      lastTransactionId: transactionId,
      plan: body.product_name || "pro_40_days",
      updatedAt: now.toISOString()
    }, { merge: true });

    // 4. Also sync to Netlify Blobs for faster edge checking
    const userStore = getStore("smart-keyword-users");
    await userStore.setJSON(email.toLowerCase(), {
      status: "active",
      expiry: expiryDate.toISOString(),
      lastUpdate: now.toISOString()
    });

    console.log(`[Webhook] Successfully updated subscription for ${email}. New expiry: ${expiryDate.toISOString()}`);
    return new Response("Success", { status: 200 });

  } catch (err) {
    console.error("[Webhook] Error processing request:", err);
    return new Response("Bad Request", { status: 400 });
  }
};

export const config = {
  path: "/api/webhook-lynkid"
};
