import { json, optionsResponse, readJson, requireAdmin } from "../../src/http.mjs";
import { normalizeKeyList } from "../../src/crypto.mjs";
import { generateWithRotation } from "../../src/rotation.mjs";
import { loadConfig } from "../../src/store.mjs";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST" } });
  }

  try {
    requireAdmin(event);
    const body = readJson(event);
    const currentConfig = await loadConfig();

    // Prepare a temporary config for testing
    // If keys are masked in the UI, we should restore them from the current config if they match the mask
    const restoreKeys = (input, current) => {
      const inputList = normalizeKeyList(input);
      return inputList.map(key => {
        if (key.includes("...")) {
          // It's a masked key, find original
          const original = current.find(k => {
             const masked = `${k.slice(0, 6)}...${k.slice(-4)}`;
             return masked === key;
          });
          return original || key;
        }
        return key;
      });
    };

    const testConfig = {
      providerOrder: body.providerOrder || ["groq", "gemini"],
      groq: {
        model: body.groq?.model || currentConfig.groq.model,
        keys: restoreKeys(body.groq?.keys, currentConfig.groq.keys),
        cursor: 0
      },
      gemini: {
        model: body.gemini?.model || currentConfig.gemini.model,
        keys: restoreKeys(body.gemini?.keys, currentConfig.gemini.keys),
        cursor: 0
      }
    };

    // Test with a simple prompt
    const testRequest = {
      prompt: "Say 'Connection successful' in one sentence.",
      settings: { keywordCount: 1 }
    };

    const result = await generateWithRotation(testConfig, testRequest);

    return json(200, {
      ok: true,
      message: "Test connection successful!",
      provider: result.output.provider,
      model: result.output.model,
      response: result.output.result?.title || result.output.result
    });

  } catch (error) {
    return json(error.statusCode || 500, {
      ok: false,
      error: {
        code: "TEST_CONNECTION_FAILED",
        message: error.message,
        details: error.details || undefined
      }
    });
  }
}
