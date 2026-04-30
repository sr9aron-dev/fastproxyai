import { getStore } from "@netlify/blobs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const STORE_NAME = "easy-keyword-ai-proxy";
const CONFIG_KEY = "config";
const LOCAL_DATA_DIR = path.join(process.cwd(), ".data");
const LOCAL_CONFIG_PATH = path.join(LOCAL_DATA_DIR, "config.json");

const defaultConfig = {
  version: 1,
  updatedAt: null,
  providerOrder: ["groq", "gemini"],
  groq: {
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    keys: [],
    cursor: 0
  },
  gemini: {
    model: "gemini-2.5-flash",
    keys: [],
    cursor: 0
  },
  extensionKeys: []
};

export function configStore() {
  return getStore(STORE_NAME);
}

function shouldUseLocalStore() {
  return process.env.LOCAL_FILE_STORE === "1" || (!process.env.NETLIFY && !process.env.NETLIFY_BLOBS_CONTEXT);
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
  await mkdir(LOCAL_DATA_DIR, { recursive: true });
  await writeFile(LOCAL_CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
}

export async function loadConfig() {
  let config;
  if (shouldUseLocalStore()) {
    config = await readLocalConfig();
  } else {
    const store = configStore();
    config = await store.get(CONFIG_KEY, { type: "json", consistency: "strong" });
  }

  return {
    ...defaultConfig,
    ...(config || {}),
    groq: { ...defaultConfig.groq, ...(config?.groq || {}) },
    gemini: { ...defaultConfig.gemini, ...(config?.gemini || {}) },
    extensionKeys: config?.extensionKeys || []
  };
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
