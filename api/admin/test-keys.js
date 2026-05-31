import { json, optionsResponse, readJson, requireAdmin, vercelHandler } from "../../src/http.mjs";
import { callGroq, callGemini, callMistral, callNvidia } from "../../src/providers.mjs";

async function handler(event) {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  
  try {
    requireAdmin(event);
    if (event.httpMethod !== "POST") {
      return json(405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST" } });
    }

    const { provider, keys, model } = readJson(event);
    if (!provider || !Array.isArray(keys)) {
      return json(400, { ok: false, message: "Provider and keys array are required" });
    }

    const testPrompt = "Reply with exactly one word: 'OK'";
    const results = await Promise.all(keys.map(async (key) => {
      // If key is masked, we skip it (we can't test masked keys from the frontend)
      if (key.includes("...")) {
        return { key, status: "skipped", message: "Cannot test masked key" };
      }

      try {
        let caller;
        let defaultModel;

        if (provider === "groq") {
          caller = callGroq;
          defaultModel = "meta-llama/llama-4-scout-17b-16e-instruct";
        } else if (provider === "gemini") {
          caller = callGemini;
          defaultModel = "gemini-2.5-flash";
        } else if (provider === "mistral") {
          caller = callMistral;
          defaultModel = "mistral-tiny";
        } else if (provider === "nvidia") {
          caller = callNvidia;
          defaultModel = "mistralai/mistral-large-3-675b-instruct-2512";
        }

        await caller({ key, model: model || defaultModel, prompt: testPrompt });
        return { key, status: "valid" };
      } catch (err) {
        return { key, status: "invalid", message: err.message };
      }
    }));

    return json(200, { ok: true, results });
  } catch (error) {
    return json(error.statusCode || 500, {
      ok: false,
      error: { code: "TEST_KEYS_ERROR", message: error.message }
    });
  }
}

export default vercelHandler(handler);
