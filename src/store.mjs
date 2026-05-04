import { getStore } from "@netlify/blobs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const STORE_NAME = "smart-keyword-ai-proxy";
const CONFIG_KEY = "config";
const LOCAL_DATA_DIR = path.join(process.cwd(), ".data");
const LOCAL_CONFIG_PATH = path.join(LOCAL_DATA_DIR, "config.json");

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
    hash: k, // Expecting SHA-256 hash in env or raw token if auth.mjs handles it
    createdAt: new Date().toISOString(),
    lastUsedAt: null
  }))
};

export function configStore() {
  // Gunakan konfigurasi manual jika disediakan lewat environment variables
  return getStore({
    name: STORE_NAME,
    siteID: process.env.NETLIFY_SITE_ID || undefined,
    token: process.env.NETLIFY_API_TOKEN || undefined
  });
}

function shouldUseLocalStore() {
  // Jika berjalan di Netlify (ada process.env.NETLIFY, URL, atau AWS_LAMBDA), dilarang pakai local file.
  if (process.env.NETLIFY || process.env.URL || process.env.AWS_LAMBDA_FUNCTION_NAME) return false;

  return process.env.LOCAL_FILE_STORE === "1" || !process.env.NETLIFY_BLOBS_CONTEXT;
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
      const store = configStore();
      config = await store.get(CONFIG_KEY, { type: "json", consistency: "strong" });
    }
  } catch (err) {
    console.error("Error loading config:", err.message);
  }

  // Merge logic: Env variables take precedence if storage is empty
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
    const store = configStore();
    await store.setJSON(CONFIG_KEY, next);
  }

  return next;
}

