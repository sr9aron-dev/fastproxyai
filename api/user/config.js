import { json, optionsResponse, readJson, vercelHandler } from "../../src/http.mjs";
import { loadUserConfig, saveUserConfig, clearChatHistory, loadChatHistory } from "../../src/store.mjs";
import { getInitialPsychology, getPreferredAddress } from "../../src/psychology.mjs";
import { generateInitialPersonality } from "../../src/personality.mjs";
import { loadConfig } from "../../src/store.mjs";
import { deleteMessage } from "../../src/telegram.mjs";
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
      config.preferred_address = getPreferredAddress(config.psychology, config.husband_profile || {}, config.relationship_status || "Kenalan Baru");

      // HITUNG RASIO KOGNITIF UNTUK DASHBOARD
      if (!config.psychology.cognitive_ratio) {
        const { calculateDominanceRatio } = await import("../../src/psychology.mjs");
        config.psychology.cognitive_ratio = calculateDominanceRatio(config.psychology, config.life_context || "", config.relationship_status || "Kenalan Baru");
      }

      return json(200, { ok: true, config });
    }

    if (event.httpMethod === "POST") {
      const body = readJson(event);
      const currentConfig = await loadUserConfig(chatId);
      
      // LOGIKA RESET TOTAL DARI UI
      if (body.action === 'TOTAL_RESET') {
        console.log(`[API] Triggering total reset for ${chatId} from UI...`);
        
        // 1. Hapus Chat di Layar Telegram (Best Effort)
        try {
          const history = await loadChatHistory(chatId, 100);
          const messageIds = history.map(m => m.messageId).filter(Boolean);
          for (const msgId of messageIds) {
            deleteMessage(chatId, msgId).catch(() => {}); // Non-blocking
          }
        } catch (e) {
          console.error("[API] Failed to cleanup Telegram screen:", e.message);
        }

        // 2. Hapus Riwayat di DB
        await clearChatHistory(chatId);
        
        // 2. Reset Config
        const resetConfig = {
          ...currentConfig,
          saga: "",
          chat_count_saga: 0,
          chat_count_personality: 0,
          relationship_status: "Kenalan Baru",
          husband_profile: {},
          life_context: "",
          personality_description: "",
          narrative_directives: "",
          stagnation_level: 0,
          chat_count_directives: 0,
          active_duties: [],
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

      const hasContextChanged = body.life_context !== undefined && body.life_context !== currentConfig.life_context;
      const hasTraitsChanged = body.personality_traits && JSON.stringify(body.personality_traits) !== JSON.stringify(currentConfig.personality_traits);

      if (!currentConfig.personality_description || hasContextChanged || hasTraitsChanged) {
        console.log(`[API] Generating/Updating personality description for ${chatId}...`);
        const appConfig = await loadConfig();
        const traits = body.personality_traits || currentConfig.personality_traits || {
          openness: 0.5, conscientiousness: 0.5, extraversion: 0.5, agreeableness: 0.5, neuroticism: 0.5
        };
        const lifeContext = body.life_context !== undefined ? body.life_context : (currentConfig.life_context || "");
        body.personality_description = await generateInitialPersonality(traits, lifeContext, appConfig);
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
