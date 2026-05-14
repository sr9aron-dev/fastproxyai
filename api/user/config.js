import { json, optionsResponse, readJson, vercelHandler } from "../../src/http.mjs";
import { loadUserConfig, saveUserConfig, clearChatHistory } from "../../src/store.mjs";
import { getInitialPsychology, getPreferredAddress } from "../../src/psychology.mjs";
import redis, { KEYS } from "../../src/redis.mjs";

async function handler(event) {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  
  try {
    const chatId = event.headers["x-telegram-chat-id"];
    if (!chatId) return json(401, { ok: false, message: "Chat ID required" });

    if (event.httpMethod === "GET") {
      const config = await loadUserConfig(chatId);
      if (!config.psychology) config.psychology = getInitialPsychology(config.personality_traits);
      
      // SINKRONISASI DATA TEMPORER DARI REDIS
      try {
        if (redis) {
          const [innerVoice, moodTag] = await Promise.all([
            redis.get(KEYS.innerVoice(chatId)),
            redis.get(KEYS.moodTag(chatId))
          ]);
          if (innerVoice) config.psychology.inner_voice = innerVoice;
          if (moodTag) config.psychology.last_mood_tag = moodTag;
        }
      } catch (e) { }

      // HITUNG PANGGILLAN SAAT INI
      config.preferred_address = getPreferredAddress(config.psychology, config.husband_profile || {});

      return json(200, { ok: true, config });
    }

    if (event.httpMethod === "POST") {
      const body = readJson(event);
      const currentConfig = await loadUserConfig(chatId);
      
      // LOGIKA RESET TOTAL DARI UI
      if (body.action === 'TOTAL_RESET') {
        console.log(`[API] Triggering total reset for ${chatId} from UI...`);
        
        // 1. Hapus Chat
        await clearChatHistory(chatId);
        
        // 2. Reset Config
        const resetConfig = {
          ...currentConfig,
          saga: "",
          chat_count_saga: 0,
          psychology: getInitialPsychology(currentConfig.personality_traits || {}),
          updatedAt: new Date().toISOString()
        };
        
        // 3. Hapus Redis (Data Temporer)
        try {
          if (redis) {
            await Promise.all([
              redis.del(KEYS.innerVoice(chatId)),
              redis.del(KEYS.moodTag(chatId)),
              redis.del(KEYS.violations(chatId))
            ]);
          }
        } catch (e) { }

        await saveUserConfig(chatId, resetConfig);
        return json(200, { ok: true, config: resetConfig });
      }

      const newConfig = {
        ...currentConfig,
        ...body,
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
