import { bearerToken, json, optionsResponse, readJson, vercelHandler } from "../src/http.mjs";
import { sha256 } from "../src/crypto.mjs";
import { validateExtensionToken } from "../src/auth.mjs";
import { loadConfig, saveConfig } from "../src/store.mjs";
import { generateWithRotation } from "../src/rotation.mjs";
import { buildMetadataPrompt } from "../src/prompt.mjs";
import { normalizeMetadata } from "../src/normalize.mjs";

const MAX_BASE64_LENGTH = Number(process.env.MAX_BASE64_LENGTH || 6_000_000);

function validateRequest(body) {
  if (!body || typeof body !== "object") throw new Error("JSON body is required");
  if (body.image) {
    if (!body.image.base64 || !body.image.mime) throw new Error("image.base64 and image.mime are required");
    if (!/^image\/(png|jpe?g|webp)$/i.test(body.image.mime)) throw new Error("Only png, jpeg, and webp images are supported");
    if (body.image.base64.length > MAX_BASE64_LENGTH) throw new Error("Image payload is too large");
  }
}

async function handler(event) {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST" } });
  }

  try {
    const token = bearerToken(event);
    const keyRecord = await validateExtensionToken(token);
    if (!keyRecord) {
      return json(401, { ok: false, error: { code: "UNAUTHORIZED", message: "Invalid extension API key" } });
    }

    const body = readJson(event);
    
    // Auto-build prompt if not provided as string
    let prompt = body.prompt;
    if (!prompt || typeof prompt !== "string") {
      prompt = buildMetadataPrompt(body.settings, body.context);
    }
    
    validateRequest({ ...body, prompt });

    const config = await loadConfig();
    const { output, config: updatedConfig } = await generateWithRotation(config, { ...body, prompt });

    // Normalize AI output to structured metadata
    let finalResult;
    try {
      finalResult = normalizeMetadata(output.result, body.settings);
    } catch (err) {
       console.error("[Proxy] Normalization failed:", err.message);
       throw new Error(`AI returned invalid format: ${err.message}`);
    }

    // Update lastUsedAt for the specific extension key used
    const tokenHash = sha256(token);
    const foundKey = updatedConfig.extensionKeys.find((item) => item.hash === tokenHash || item.hash === token);
    if (foundKey) {
      foundKey.lastUsedAt = new Date().toISOString();
    }
    
    await saveConfig(updatedConfig);

    return json(200, {
      ok: true,
      provider: output.provider,
      model: output.model,
      ...finalResult,
      usage: output.usage
    });
  } catch (error) {
    console.error("[Proxy] Generate Error:", error);
    return json(error.statusCode || 500, {
      ok: false,
      error: {
        code: error.statusCode === 502 ? "NO_PROVIDER_AVAILABLE" : "GENERATE_ERROR",
        message: error.message,
        details: error.details || undefined
      }
    });
  }
}

export default vercelHandler(handler);
