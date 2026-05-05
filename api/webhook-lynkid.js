import { json, optionsResponse, readJson, vercelHandler } from "../src/http.mjs";
import { extendSubscription } from "../src/auth.mjs";

async function handler(event) {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST" } });
  }

  try {
    const body = readJson(event);
    console.log("[Webhook] Received Lynkid payload:", JSON.stringify(body));

    // Lynkid payload structure (Adjusted based on common implementations)
    // Common fields: user_email, status, transaction_status, etc.
    const email = body.user_email || body.email;
    const status = body.status || body.transaction_status;

    if (!email) {
      return json(400, { ok: false, message: "No email found in payload" });
    }

    // Only process successful payments
    const isSuccess = ["success", "paid", "settlement", "completed"].includes(status?.toLowerCase());
    
    if (!isSuccess) {
      console.log(`[Webhook] Skipping non-success status: ${status}`);
      return json(200, { ok: true, message: "Webhook received but not processed (status not success)" });
    }

    // Extend subscription by 40 days
    const result = await extendSubscription(email, 40);

    console.log(`[Webhook] Successfully extended subscription for ${email} until ${result.expiry}`);

    return json(200, { 
      ok: true, 
      message: "Subscription extended successfully",
      data: result 
    });

  } catch (error) {
    console.error("[Webhook] Error processing Lynkid webhook:", error);
    return json(500, {
      ok: false,
      error: {
        code: "WEBHOOK_ERROR",
        message: error.message
      }
    });
  }
}

export default vercelHandler(handler);
