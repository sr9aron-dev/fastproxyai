import { updateProviderCursor, trackUsage } from "./store.mjs";
import { callGemini, callGroq, callMistral } from "./providers.mjs";
import redis, { KEYS } from "./redis.mjs";
import { sha256 } from "./crypto.mjs";

const callers = {
  groq: callGroq,
  gemini: callGemini,
  mistral: callMistral
};

const MAX_CONCURRENT_PER_KEY = Number(process.env.MAX_CONCURRENT_PER_KEY || 2);
const HEALTH_BAN_DURATION = 300; // 5 minutes in seconds



function isRetryable(error) {
  const status = Number(error.statusCode || 0);
  return status === 0 || status === 408 || status === 409 || status === 429 || status >= 500 || status === 401 || status === 403 || status === 503 || status === 504;
}

export async function generateWithRotation(config, request) {
  const providers = request.forceProvider 
    ? [request.forceProvider] 
    : (request.providerOrder || (Array.isArray(config.providerOrder) && config.providerOrder.length > 0
      ? config.providerOrder
      : ["groq", "gemini"]));
  const errors = [];

  for (const provider of providers) {
    const providerConfig = config[provider];
    const caller = callers[provider];
    if (!providerConfig || !caller || !providerConfig.keys?.length) continue;

    const attempts = providerConfig.keys.length;
    const keys = providerConfig.keys;

    // Use Redis for atomic cursor if available
    let currentIndex = Number(providerConfig.cursor || 0);
    if (redis) {
      try {
        const redisCursor = await redis.incr(KEYS.cursor(provider));
        currentIndex = redisCursor % keys.length;
      } catch (e) {
        console.warn("[Proxy] Redis cursor failed, fallback to memory:", e.message);
      }
    }

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const index = (currentIndex + attempt) % keys.length;
      const key = keys[index];
      
      const keyHash = sha256(key);
      const activeKey = KEYS.activeCount(provider, keyHash);
      const healthKey = KEYS.health(provider, keyHash);

      // 1. Check Health (Circuit Breaker)
      if (redis) {
        const isBanned = await redis.get(healthKey);
        if (isBanned) {
          console.log(`[Proxy] Skipping unhealthy key for ${provider} (${keyHash.slice(0, 8)})`);
          continue;
        }

        // 2. Check Concurrency
        const currentActive = await redis.get(activeKey) || 0;
        if (currentActive >= MAX_CONCURRENT_PER_KEY) {
          console.log(`[Proxy] Key at capacity for ${provider} (${keyHash.slice(0, 8)}): ${currentActive}/${MAX_CONCURRENT_PER_KEY}`);
          continue;
        }
      }

      // Update local memory & Firestore (Non-blocking backup)
      const nextIdx = (index + 1) % keys.length;
      providerConfig.cursor = nextIdx;
      updateProviderCursor(provider, nextIdx).catch(() => {});

      // Track start
      if (redis) await redis.incr(activeKey);

      try {
        const output = await caller({
          key,
          model: request.forceModel || request.model || providerConfig.model,
          image: request.image,
          prompt: request.prompt,
          system: request.system,
          temperature: request.temperature,
          history: request.history
        });

        // Track success completion
        if (redis) await redis.decr(activeKey);

        return {
          output: {
            provider,
            model: providerConfig.model,
            ...output
          }
        };
      } catch (error) {
        // Track failure completion
        if (redis) await redis.decr(activeKey);

        console.warn(`[Proxy] Provider ${provider} (${providerConfig.model}) failed: ${error.message} (Status: ${error.statusCode})`);
        errors.push({
          provider,
          model: providerConfig.model,
          message: error.message,
          statusCode: error.statusCode || null
        });

        // 3. Reactive Circuit Breaker (Mark unhealthy if rate limited or server error)
        if (redis && (error.statusCode === 429 || error.statusCode >= 500)) {
          console.warn(`[Proxy] Marking key ${keyHash.slice(0, 8)} as unhealthy for ${HEALTH_BAN_DURATION}s`);
          await redis.set(healthKey, "unhealthy", { ex: HEALTH_BAN_DURATION });
        }

        if (!isRetryable(error)) break;
        console.log(`[Proxy] Rotating to next key for ${provider}...`);
      }
    }
  }

  const error = new Error("No provider key succeeded or all keys at capacity");
  error.statusCode = 502;
  error.details = errors;
  throw error;
}
