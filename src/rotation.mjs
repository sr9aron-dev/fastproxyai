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
const INVALID_KEY_BAN = 3600; // 1 hour for revoked/invalid keys

// In-memory circuit breaker fallback (when Redis is down)
const localHealthMap = new Map();

function isKeyHealthyLocal(healthKey) {
  const expiry = localHealthMap.get(healthKey);
  if (!expiry) return true;
  if (Date.now() > expiry) {
    localHealthMap.delete(healthKey);
    return true;
  }
  return false;
}

function markKeyUnhealthyLocal(healthKey, durationSeconds) {
  localHealthMap.set(healthKey, Date.now() + (durationSeconds * 1000));
}

/**
 * Determines retry strategy for failed provider calls.
 * - "next_key": Try next key in same provider (rate limit, server error, safety block)
 * - "skip_provider": Skip to next provider entirely (auth failure — key invalid)
 * - "abort": Stop trying (unknown/client error)
 */
function getRetryStrategy(error) {
  if (error.isSafetyBlock) return "next_key";
  const status = Number(error.statusCode || 0);
  if (status === 401 || status === 403) return "skip_provider";
  if (status === 0 || status === 408 || status === 409 || status === 429 || status >= 500) return "next_key";
  return "abort";
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

      // 1. Check Health + Concurrency (batched)
      if (redis) {
        try {
          const [isBanned, currentActive] = await Promise.all([
            redis.get(healthKey),
            redis.get(activeKey)
          ]);
          if (isBanned) {
            console.log(`[Proxy] Skipping unhealthy key for ${provider} (${keyHash.slice(0, 8)}): ${isBanned}`);
            continue;
          }
          if ((currentActive || 0) >= MAX_CONCURRENT_PER_KEY) {
            console.log(`[Proxy] Key at capacity for ${provider} (${keyHash.slice(0, 8)}): ${currentActive}/${MAX_CONCURRENT_PER_KEY}`);
            continue;
          }
        } catch (redisErr) {
          console.warn(`[Proxy] Redis check failed, using local fallback:`, redisErr.message);
          if (!isKeyHealthyLocal(healthKey)) {
            console.log(`[Proxy] Skipping unhealthy key (local) for ${provider} (${keyHash.slice(0, 8)})`);
            continue;
          }
        }
      } else if (!isKeyHealthyLocal(healthKey)) {
        console.log(`[Proxy] Skipping unhealthy key (no-redis) for ${provider} (${keyHash.slice(0, 8)})`);
        continue;
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

        // 3. Reactive Circuit Breaker (expanded: 401/403 + 429 + 500+)
        const status = error.statusCode;
        if (status === 401 || status === 403) {
          const banDuration = INVALID_KEY_BAN;
          markKeyUnhealthyLocal(healthKey, banDuration);
          if (redis) redis.set(healthKey, "invalid", { ex: banDuration }).catch(() => {});
          console.warn(`[Proxy] Key ${keyHash.slice(0, 8)} marked INVALID for ${banDuration}s`);
        } else if (status === 429 || status >= 500) {
          markKeyUnhealthyLocal(healthKey, HEALTH_BAN_DURATION);
          if (redis) redis.set(healthKey, "rate_limited", { ex: HEALTH_BAN_DURATION }).catch(() => {});
          console.warn(`[Proxy] Key ${keyHash.slice(0, 8)} marked rate_limited for ${HEALTH_BAN_DURATION}s`);
        }

        const strategy = getRetryStrategy(error);
        if (strategy === "skip_provider") {
          console.log(`[Proxy] Skipping provider ${provider} entirely (auth failure)`);
          break;
        }
        if (strategy === "abort") break;
        console.log(`[Proxy] Rotating to next key for ${provider}...`);
      }
    }
  }

  const error = new Error("No provider key succeeded or all keys at capacity");
  error.statusCode = 502;
  error.details = errors;
  throw error;
}
