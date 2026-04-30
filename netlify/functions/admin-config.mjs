import { json, optionsResponse, readJson, requireAdmin } from "../../src/http.mjs";
import { maskKey, normalizeKeyList } from "../../src/crypto.mjs";
import { loadConfig, saveConfig } from "../../src/store.mjs";

function publicConfig(config) {
  return {
    updatedAt: config.updatedAt,
    providerOrder: config.providerOrder,
    groq: {
      model: config.groq.model,
      keyCount: config.groq.keys.length,
      keys: config.groq.keys.map(maskKey)
    },
    gemini: {
      model: config.gemini.model,
      keyCount: config.gemini.keys.length,
      keys: config.gemini.keys.map(maskKey)
    },
    extensionKeys: config.extensionKeys.map((key) => ({
      id: key.id,
      label: key.label,
      active: key.active !== false,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt || null
    }))
  };
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return optionsResponse();

  try {
    requireAdmin(event);

    if (event.httpMethod === "GET") {
      const config = await loadConfig();
      return json(200, { ok: true, config: publicConfig(config) });
    }

    if (event.httpMethod !== "POST") {
      return json(405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET or POST" } });
    }

    const body = readJson(event);
    const config = await loadConfig();
    const next = {
      ...config,
      providerOrder: Array.isArray(body.providerOrder) && body.providerOrder.length
        ? body.providerOrder.filter((name) => ["groq", "gemini"].includes(name))
        : config.providerOrder,
      groq: {
        ...config.groq,
        model: body.groq?.model || config.groq.model,
        keys: body.groq?.keys === undefined ? config.groq.keys : normalizeKeyList(body.groq.keys),
        cursor: 0
      },
      gemini: {
        ...config.gemini,
        model: body.gemini?.model || config.gemini.model,
        keys: body.gemini?.keys === undefined ? config.gemini.keys : normalizeKeyList(body.gemini.keys),
        cursor: 0
      }
    };

    const saved = await saveConfig(next);
    return json(200, { ok: true, config: publicConfig(saved) });
  } catch (error) {
    return json(error.statusCode || 500, {
      ok: false,
      error: {
        code: "ADMIN_CONFIG_ERROR",
        message: error.message
      }
    });
  }
}
