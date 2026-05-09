import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { db, admin } from "./firebase.mjs";

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
  providerOrder: ["groq", "gemini", "mistral"],
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
  mistral: {
    model: process.env.MISTRAL_MODEL || "mistral-tiny",
    keys: parseEnvKeys("MISTRAL_KEYS").length ? parseEnvKeys("MISTRAL_KEYS") : ["tKStvrZoL05yQFlpjh1y1YyB7GXrf5Xv"],
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
    mistral: {
      ...defaultConfig.mistral,
      ...(config?.mistral || {}),
      keys: (config?.mistral?.keys?.length ? config.mistral.keys : defaultConfig.mistral.keys)
    },
    extensionKeys: (config?.extensionKeys?.length ? config.extensionKeys : defaultConfig.extensionKeys)
  };

  // Reconcile providerOrder: Ensure new system providers are added to the list if missing
  const currentOrder = Array.isArray(merged.providerOrder) ? merged.providerOrder : defaultConfig.providerOrder;
  const systemProviders = ["groq", "gemini", "mistral"];
  const missingProviders = systemProviders.filter(p => !currentOrder.includes(p));
  
  if (missingProviders.length > 0) {
    merged.providerOrder = [...currentOrder, ...missingProviders];
  }

  return merged;
}

export async function saveConfig(config) {
  const next = {
    ...config,
    updatedAt: new Date().toISOString()
  };

  // Ensure AI keys are deduplicated before saving
  if (next.groq?.keys) next.groq.keys = [...new Set(next.groq.keys)];
  if (next.gemini?.keys) next.gemini.keys = [...new Set(next.gemini.keys)];
  if (next.mistral?.keys) next.mistral.keys = [...new Set(next.mistral.keys)];

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

export async function trackUsage(provider, model, status = "success") {
  if (shouldUseLocalStore()) return; // Skip local for now to avoid IO overhead

  try {
    const statsRef = db.collection("stats").doc("global");
    const dateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    
    // Increments using Firestore FieldValue.increment
    const update = {
      total: admin.firestore.FieldValue.increment(1),
      [`providers.${provider}.total`]: admin.firestore.FieldValue.increment(1),
      [`models.${model.replace(/\./g, '_')}.total`]: admin.firestore.FieldValue.increment(1),
      [`status.${status}`]: admin.firestore.FieldValue.increment(1),
      [`history.${dateStr}.total`]: admin.firestore.FieldValue.increment(1),
      [`history.${dateStr}.${status}`]: admin.firestore.FieldValue.increment(1)
    };

    await statsRef.set(update, { merge: true });
  } catch (err) {
    console.error("Error tracking usage:", err.message);
  }
}

export async function loadChatHistory(chatId, limit = 10) {
  if (shouldUseLocalStore()) return [];

  try {
    const snapshot = await db.collection("chats")
      .doc(String(chatId))
      .collection("messages")
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => doc.data()).reverse();
  } catch (err) {
    console.error("Error loading chat history:", err.message);
    return [];
  }
}

export async function saveChatMessage(chatId, role, text) {
  if (shouldUseLocalStore()) return;

  try {
    await db.collection("chats")
      .doc(String(chatId))
      .collection("messages")
      .add({
        role,
        text,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
  } catch (err) {
    console.error("Error saving chat message:", err.message);
  }
}



