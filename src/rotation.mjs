import { saveConfig } from "./store.mjs";
import { callGemini, callGroq } from "./providers.mjs";

const callers = {
  groq: callGroq,
  gemini: callGemini
};

function nextKey(providerConfig) {
  const keys = providerConfig.keys || [];
  if (keys.length === 0) return null;
  const cursor = Number(providerConfig.cursor || 0);
  const index = cursor % keys.length;
  return {
    key: keys[index],
    nextCursor: (index + 1) % keys.length
  };
}

function isRetryable(error) {
  const status = Number(error.statusCode || 0);
  return status === 0 || status === 408 || status === 409 || status === 429 || status >= 500 || status === 401 || status === 403 || status === 503 || status === 504;
}

export async function generateWithRotation(config, request) {
  const providers = request.forceProvider 
    ? [request.forceProvider] 
    : (Array.isArray(config.providerOrder) && config.providerOrder.length > 0
      ? config.providerOrder
      : ["groq", "gemini"]);
  const errors = [];
  const nextConfig = structuredClone(config);

  for (const provider of providers) {
    const providerConfig = nextConfig[provider];
    const caller = callers[provider];
    if (!providerConfig || !caller || !providerConfig.keys?.length) continue;

    const attempts = providerConfig.keys.length;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const selected = nextKey(providerConfig);
      if (!selected) break;
      providerConfig.cursor = selected.nextCursor;

      try {
        const output = await caller({
          key: selected.key,
          model: providerConfig.model,
          image: request.image,
          prompt: request.prompt
        });

        return {
          output: {
            provider,
            model: providerConfig.model,
            ...output
          },
          config: nextConfig
        };
      } catch (error) {
        console.warn(`[Proxy] Provider ${provider} (${providerConfig.model}) failed: ${error.message} (Status: ${error.statusCode})`);
        errors.push({
          provider,
          model: providerConfig.model,
          message: error.message,
          statusCode: error.statusCode || null
        });
        if (!isRetryable(error)) break;
        console.log(`[Proxy] Rotating to next key for ${provider}...`);
      }
    }
  }

  const error = new Error("No provider key succeeded");
  error.statusCode = 502;
  error.details = errors;
  throw error;
}
