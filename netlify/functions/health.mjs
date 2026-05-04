import { json, optionsResponse } from "../../src/http.mjs";
import { readFile } from "node:fs/promises";
import path from "node:path";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  
  let version = "unknown";
  try {
    const pkg = JSON.parse(await readFile(path.join(process.cwd(), "package.json"), "utf8"));
    version = pkg.version;
  } catch {}

  return json(200, {
    ok: true,
    service: "smart-keyword-ai-proxy",
    version,
    env: process.env.NETLIFY ? "production" : "development",
    time: new Date().toISOString()
  });
}
