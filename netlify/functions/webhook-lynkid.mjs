import { getStore } from "@netlify/blobs";

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
    
    // Check existing subscription in Firestore first
    const firebaseKey = process.env.FIREBASE_API_KEY || "AIzaSyCNGYKxyqvqCrduHbl6BJ5a2AbBOJMsrz8";
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/fast-proxy-ai/databases/(default)/documents/users/${encodeURIComponent(email)}?key=${firebaseKey}`;

    let expiryDate = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

    try {
      const getRes = await fetch(firestoreUrl);
      if (getRes.ok) {
        const doc = await getRes.json();
        const currentExpiryStr = doc.fields?.subscriptionExpiry?.stringValue;
        if (currentExpiryStr) {
          const currentExpiry = new Date(currentExpiryStr);
          if (currentExpiry > now) {
            // Add to existing expiry
            expiryDate = new Date(currentExpiry.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
          }
        }
      }
    } catch (e) {
      console.warn("[Webhook] Failed to fetch existing sub:", e.message);
    }

    // 3. Update Firestore via REST API
    const updateData = {
      fields: {
        email: { stringValue: email },
        subscriptionStatus: { stringValue: "active" },
        subscriptionExpiry: { stringValue: expiryDate.toISOString() },
        lastTransactionId: { stringValue: transactionId },
        plan: { stringValue: body.product_name || "pro_40_days" },
        updatedAt: { stringValue: now.toISOString() }
      }
    };

    const updateRes = await fetch(firestoreUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updateData)
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      console.error("[Webhook] Firestore update failed:", errText);
      return new Response("Internal Server Error", { status: 500 });
    }

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
