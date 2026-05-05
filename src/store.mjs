import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "./firebase.mjs";

const CONFIG_DOC_ID = "proxy-settings";
const COLLECTION_NAME = "config";
const LOCAL_DATA_DIR = path.join(process.cwd(), ".data");
const LOCAL_CONFIG_PATH = path.join(LOCAL_DATA_DIR, "config.json");

function parseEnvKeys(key) {
  const value = process.env[key];
  if (!value) return [];
  return value.split(",").map(k => k.trim()).filter(Boolean);
}

const defaultConfig = {
  version: 2,
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
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) return false;
  return process.env.LOCAL_FILE_STORE === "1";
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
      const doc = await db.collection(COLLECTION_NAME).doc(CONFIG_DOC_ID).get();
      if (doc.exists) {
        config = doc.data();
      }
    }
  } catch (err) {
    console.error("Error loading config from Firestore:", err.message);
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
    try {
      await db.collection(COLLECTION_NAME).doc(CONFIG_DOC_ID).set(next, { merge: true });
    } catch (err) {
      console.error("Error saving config to Firestore:", err.message);
      throw err;
    }
  }

  return next;
}



