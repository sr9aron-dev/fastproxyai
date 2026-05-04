import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const STORE_NAME = "smart-keyword-ai-proxy";
const CONFIG_KEY = "config";
const LOCAL_DATA_DIR = path.join(process.cwd(), ".data");
const LOCAL_CONFIG_PATH = path.join(LOCAL_DATA_DIR, "config.json");

/**
 * Netlify Blobs adapter
 */
async function getNetlifyStore() {
  try {
    const { getStore } = await import("@netlify/blobs");
    return getStore({
      name: STORE_NAME,
      siteID: process.env.NETLIFY_SITE_ID || undefined,
      token: process.env.NETLIFY_API_TOKEN || undefined
    });
  } catch (err) {
    return null;
  }
}

/**
 * Vercel KV adapter
 */
async function getVercelKV() {
  if (!process.env.KV_REST_API_URL) return null;
  try {
    const { kv } = await import("@vercel/kv");
    return kv;
  } catch (err) {
    return null;
  }
}

function parseEnvKeys(key) {
  const value = process.env[key];
  if (!value) return [];
  return value.split(",").map(k => k.trim()).filter(Boolean);
}

const defaultConfig = {
  version: 1,
  updatedAt: null,
  providerOrder: ["groq", "gemini"],
  groq: {
    model: process.env.GROQ_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct",
    keys: parseEnvKeys("GROQ_KEYS"),
    cursor: 0
  },
  gemini: {
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    keys: parseEnvKeys("GEMINI_KEYS"),
    cursor: 0
  },
  extensionKeys: parseEnvKeys("EXTENSION_KEYS").map(k => ({
    name: "Env Key",
    hash: k,
    createdAt: new Date().toISOString(),
    lastUsedAt: null
  }))
};

function shouldUseLocalStore() {
  // Jika berjalan di Netlify atau Vercel, dilarang pakai local file.
  if (process.env.NETLIFY || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) return false;

  return process.env.LOCAL_FILE_STORE === "1" || (!process.env.NETLIFY_BLOBS_CONTEXT && !process.env.KV_REST_API_URL);
}

async function readLocalConfig() {
  try {
    const raw = await readFile(LOCAL_CONFIG_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeLocalConfig(config) {
  try {
    await mkdir(LOCAL_DATA_DIR, { recursive: true });
    await writeFile(LOCAL_CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
  } catch (err) {
    console.warn("Failed to write local config (likely read-only filesystem):", err.message);
  }
}

export async function loadConfig() {
  let config;
  try {
    if (shouldUseLocalStore()) {
      config = await readLocalConfig();
    } else {
      const kv = await getVercelKV();
      if (kv) {
        config = await kv.get(CONFIG_KEY);
      } else {
        const store = await getNetlifyStore();
        if (store) {
          config = await store.get(CONFIG_KEY, { type: "json", consistency: "strong" });
        }
      }
    }
  } catch (err) {
    console.error("Error loading config:", err.message);
  }

  // Merge logic
  const merged = {
    ...defaultConfig,
    ...(config || {}),
    groq: {
      ...defaultConfig.groq,
      ...(config?.groq || {}),
      keys: (config?.groq?.keys?.length ? config.groq.keys : defaultConfig.groq.keys)
    },
    gemini: {
      ...defaultConfig.gemini,
      ...(config?.gemini || {}),
      keys: (config?.gemini?.keys?.length ? config.gemini.keys : defaultConfig.gemini.keys)
    },
    extensionKeys: (config?.extensionKeys?.length ? config.extensionKeys : defaultConfig.extensionKeys)
  };

  return merged;
}

export async function saveConfig(config) {
  const next = {
    ...config,
    updatedAt: new Date().toISOString()
  };

  if (shouldUseLocalStore()) {
    await writeLocalConfig(next);
  } else {
    const kv = await getVercelKV();
    if (kv) {
      await kv.set(CONFIG_KEY, next);
    } else {
      const store = await getNetlifyStore();
      if (store) {
        await store.setJSON(CONFIG_KEY, next);
      }
    }
  }

  return next;
}


