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

    // Lynkid payload structure
    const email = body.data?.message_data?.customer?.email || body.user_email || body.email;
    const status = body.data?.message_action || body.status || body.transaction_status;
    const eventType = body.event;
    
    // Product verification
    const items = body.data?.message_data?.items || [];
    const productUuid = items[0]?.uuid || "";
    const expectedUuid = "69f8bc383494a38805ddad8f-3584-3961659950-1777908792574";

    if (!email) {
      return json(400, { ok: false, message: "No email found in payload" });
    }

    // Only process successful payments
    const isSuccess = ["success", "paid", "settlement", "completed"].includes(String(status).toLowerCase());
    
    if (!isSuccess && eventType !== "payment.received") {
      console.log(`[Webhook] Skipping non-success status: ${status}`);
      return json(200, { ok: true, message: "Webhook received but not processed (status not success)" });
    }

    // Verify product UUID
    if (productUuid !== expectedUuid) {
       console.log(`[Webhook] Product UUID mismatch: ${productUuid}`);
       return json(200, { ok: true, message: "Webhook ignored: invalid product UUID" });
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
