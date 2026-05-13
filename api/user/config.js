import { json, optionsResponse, readJson, vercelHandler } from "../../src/http.mjs";
import { loadUserConfig, saveUserConfig } from "../../src/store.mjs";
import { getInitialPsychology } from "../../src/psychology.mjs";

async function handler(event) {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  
  try {
    // In a real app, you should validate Telegram Init Data here.
    // For now, we use a simple header for the chatId.
    const chatId = event.headers["x-telegram-chat-id"];
    if (!chatId) {
      return json(401, { ok: false, message: "Chat ID required" });
    }

    if (event.httpMethod === "GET") {
      const config = await loadUserConfig(chatId);
      if (!config.psychology) config.psychology = getInitialPsychology(config.personality_traits);
      return json(200, { ok: true, config });
    }

    if (event.httpMethod === "POST") {
      const updates = readJson(event);
      const currentConfig = await loadUserConfig(chatId);
      
      const newConfig = {
        ...currentConfig,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await saveUserConfig(chatId, newConfig);
      return json(200, { ok: true, config: newConfig });
    }

    return json(405, { ok: false, message: "Method not allowed" });
  } catch (error) {
    return json(500, { ok: false, message: error.message });
  }
}

export default vercelHandler(handler);
