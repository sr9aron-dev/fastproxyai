import { json, optionsResponse } from "../../src/http.mjs";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  return json(200, {
    ok: true,
    service: "easy-keyword-ai-proxy",
    time: new Date().toISOString()
  });
}
