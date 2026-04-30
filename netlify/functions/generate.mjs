import { bearerToken, json, optionsResponse, readJson } from "../../src/http.mjs";
import { sha256 } from "../../src/crypto.mjs";
import { validateExtensionToken } from "../../src/auth.mjs";
import { loadConfig, saveConfig } from "../../src/store.mjs";
import { generateWithRotation } from "../../src/rotation.mjs";

const MAX_BASE64_LENGTH = Number(process.env.MAX_BASE64_LENGTH || 6_000_000);

function validateRequest(body) {
  if (!body || typeof body !== "object") throw new Error("JSON body is required");
  if (!body.image?.base64 || !body.image?.mime) throw new Error("image.base64 and image.mime are required");
  if (!/^image\/(png|jpe?g|webp)$/i.test(body.image.mime)) throw new Error("Only png, jpeg, and webp images are supported");
  if (body.image.base64.length > MAX_BASE64_LENGTH) throw new Error("Image payload is too large");
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST" } });
  }

  try {
    const token = bearerToken(event);
    const extensionKey = await validateExtensionToken(token);
    if (!extensionKey) {
      return json(401, { ok: false, error: { code: "UNAUTHORIZED", message: "Invalid extension API key" } });
    }

    const body = readJson(event);
    validateRequest(body);

    const config = await loadConfig();
    const output = await generateWithRotation(config, body);

    const latestConfig = await loadConfig();
    const tokenHash = sha256(token);
    const key = latestConfig.extensionKeys.find((item) => item.hash === tokenHash);
    if (key) {
      key.lastUsedAt = new Date().toISOString();
      await saveConfig(latestConfig);
    }

    return json(200, {
      ok: true,
      provider: output.provider,
      model: output.model,
      result: {
        title: output.result.title,
        keywords: output.result.keywords,
        category: output.result.category,
        peopleOrProperty: output.result.peopleOrProperty,
        fileTypeFlag: output.result.fileTypeFlag
      },
      legacyResult: output.result.legacyResult,
      usage: output.usage
    });
  } catch (error) {
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
