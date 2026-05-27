import { json, optionsResponse, readJson, vercelHandler } from "../src/http.mjs";
import { loadChatHistory, saveChatMessage, saveConfig, trackUsage, clearChatHistory, loadUserConfig, saveUserConfig, recordLog, loadConfig } from "../src/store.mjs";
import { generateWithRotation } from "../src/rotation.mjs";
import { sendMessage, sendChatAction, editMessageText, answerCallbackQuery, getTelegramFile } from "../src/telegram.mjs";
import redis, { KEYS } from "../src/redis.mjs";
import { 
  getInitialPsychology, 
  updatePsychology, 
  analyzeAndInstinct, 
  calculateDominanceRatio,
  generatePsychologicalSummary, 
  getPreferredAddress,
  getInitialEgo,
  updateEgo,
  generateEgoSummary
} from "../src/psychology.mjs";
import { buildRoleplayPrompt } from "../src/prompt.mjs";
import { updateSaga } from "../src/saga.mjs";
import { camouflagePrompt, isSensitive } from "../src/camouflage.mjs";
import { evolvePersonality } from "../src/personality.mjs";

async function handleSejarahCommand(chatId, userConfig) {
  const saga = userConfig.saga || "Belum ada sejarah yang tercatat antara kita... Mari kita buat kenangan bersama! ❤️";
  await sendMessage(chatId, `📖 *Sejarah Hubungan Kita*:\n\n${saga}`);
}

async function handleKondisiCommand(chatId, event) {
  const host = event?.headers?.host || process.env.BASE_URL?.replace('https://', '') || 'mega-vercel-ai-proxy.vercel.app';
  const miniAppUrl = `https://${host}/miniapp.html`;
  await sendMessage(chatId, `📊 *Monitor Kondisi Nafeesa*\n\nPantau emosi, mood, dan sifat internal saya secara real-time melalui Dashboard.`, {
    reply_markup: { inline_keyboard: [[{ text: "📊 Buka Dashboard Emosi", web_app: { url: miniAppUrl } }]] }
  });
}

async function handleStartCommand(chatId) {
  await sendMessage(chatId, `Halo... 👋\n\nAku Nafeesa, Aku siap nemenin kamu setiap saat. Kamu bisa kirim chat atau foto apa aja ke aku... ❤️`);
}

async function handleSettingsCommand(chatId, event) {
  const host = event?.headers?.host || process.env.BASE_URL?.replace('https://', '') || 'mega-vercel-ai-proxy.vercel.app';
  const miniAppUrl = `https://${host}/miniapp.html`;
  await sendMessage(chatId, `✨ *Panel Kontrol Nafeesa* ✨\n\nAtur mode, model AI, dan kepribadian saya melalui aplikasi dashboard.`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🚀 Buka Panel Nafeesa", web_app: { url: miniAppUrl } }],
        [{ text: "🗑️ Hapus Riwayat Chat", callback_data: "confirm_clear_chat" }]
      ]
    }
  });
}

async function handleAIMessage(chatId, text, photo, event) {
  let typingInterval;
  const backgroundTasks = [];
  try {
    // 1. Load Data
    const [config, userConfig, rawHistory, redisInnerVoice, redisMoodTag] = await Promise.all([
      loadConfig(),
      loadUserConfig(chatId),
      loadChatHistory(chatId, 15),
      redis ? redis.get(KEYS.innerVoice(chatId)) : null,
      redis ? redis.get(KEYS.moodTag(chatId)) : null
    ]);

    let history = rawHistory;
    let hoursPassed = 0;
    if (history.length > 0) {
      const lastMsg = history[history.length - 1];
      const lastTime = lastMsg.timestamp?.toDate ? lastMsg.timestamp.toDate() : new Date(lastMsg.timestamp);
      hoursPassed = (new Date() - lastTime) / (1000 * 60 * 60);
      if (hoursPassed > 3) {
        history = []; 
        if (redis) await Promise.all([redis.del(KEYS.innerVoice(chatId)), redis.del(KEYS.moodTag(chatId))]);
      }
    }

    sendChatAction(chatId, "typing").catch(() => {});
    typingInterval = setInterval(() => sendChatAction(chatId, "typing").catch(() => {}), 4000);

    let imagePayload = null;
    if (photo && photo.length > 0) {
      const fileId = photo[photo.length - 1].file_id;
      imagePayload = await getTelegramFile(fileId);
    }

    // --- USE PSYCHOLOGY & EGO FROM PREVIOUS MESSAGE (already in userConfig/Redis) ---
    const mode = userConfig.mode || "istri";
    const lifeContext = userConfig.life_context || "";
    const relationshipStatus = userConfig.relationship_status || "Kenalan Baru";
    let psychState = userConfig.psychology || getInitialPsychology(userConfig.personality_traits || {});
    let egoState = userConfig.ego_identity || getInitialEgo();

    // Sync from Redis (already loaded in Promise.all above)
    if (redisInnerVoice) psychState.inner_voice = redisInnerVoice;
    if (redisMoodTag) psychState.last_mood_tag = redisMoodTag;

    // Recalculate cognitive ratio (deterministic, ~0ms)
    if (psychState.emotion) {
      psychState.cognitive_ratio = calculateDominanceRatio(psychState, lifeContext, relationshipStatus);
    }


    const psychSummary = generatePsychologicalSummary(psychState);
    const egoSummary = (mode === "istri" || mode === "nafeesa") ? generateEgoSummary(egoState) : "";
    const preferredAddress = (mode === "istri" || mode === "nafeesa") ? getPreferredAddress(psychState, userConfig.husband_profile || {}, relationshipStatus) : "Boss";
    const now = new Date();
    const timeStr = now.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });
    const dateStr = now.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // --- NARRATIVE DIRECTIVES EXPIRATION ---
    let plotDirectives = "";
    if ((mode === "istri" || mode === "nafeesa") && userConfig.narrative_directives) {
      userConfig.chat_count_directives = (userConfig.chat_count_directives || 0) + 1;
      if (userConfig.chat_count_directives > 5) {
        userConfig.narrative_directives = ""; // Expire after 5 messages
        userConfig.chat_count_directives = 0;
      } else if (userConfig.stagnation_level > 0.6) {
        plotDirectives = userConfig.narrative_directives;
      }
    }

    // 2. Build Prompt & Generate Response
    let systemPrompt = buildRoleplayPrompt(
      mode, timeStr, dateStr, psychSummary, userConfig.saga || "", 
      preferredAddress, userConfig.husband_profile || {}, relationshipStatus, 
      lifeContext, userConfig.personality_description || "", plotDirectives,
      userConfig.active_duties || [], egoSummary
    );
    
    let userPrompt = text || "Lihat foto ini";
    const isRequestSensitive = isSensitive(userPrompt);
    
    // Proactive Camouflage for known sensitive prompts
    if (isRequestSensitive && userConfig.camouflage_enabled) {
      console.log(`[Safety] Proactive camouflage for sensitive prompt: "${userPrompt.substring(0, 20)}..."`);
      userPrompt = camouflagePrompt(userPrompt, Math.floor(Math.random() * 5));
    }

    let output;
    const maxAttempts = 3;
    let attempt = 0;

    while (attempt < maxAttempts) {
      try {
        const result = await generateWithRotation(config, {
          prompt: userPrompt,
          system: systemPrompt,
          temperature: 0.8 + (attempt * 0.1), // Increase temp on retries
          history: history,
          image: imagePayload,
          forceProvider: userConfig.provider,
          // If first attempt fails or is sensitive, shift providers
          providerOrder: isRequestSensitive || attempt > 0 ? ["groq", "mistral", "gemini"] : config.providerOrder
        });
        
        output = result.output;
        const resultText = output.result.toLowerCase();
        
        // Detect "Soft Refusal" (AI says no politely)
        const refusalKeywords = ["maaf", "tidak bisa", "standar komunitas", "pantas", "kebijakan keamanan", "ai model", "unfortunate", "policy", "cannot fulfill"];
        const isRefusal = refusalKeywords.some(k => resultText.includes(k)) && resultText.length < 150;

        if (isRefusal && attempt < maxAttempts - 1) {
          if (userConfig.camouflage_enabled) {
            console.log(`[Safety] Detected soft refusal on attempt ${attempt + 1}. Retrying with camouflage...`);
            attempt++;
            userPrompt = camouflagePrompt(text || userPrompt, attempt);
            continue;
          } else {
            console.log(`[Safety] Detected soft refusal, but camouflage is disabled. Breaking.`);
            break;
          }
        }

        break; // Success or final attempt
      } catch (err) {
        if (err.isSafetyBlock && attempt < maxAttempts - 1 && userConfig.camouflage_enabled) {
          console.log(`[Safety] Hard block on attempt ${attempt + 1}. Retrying with camouflage...`);
          attempt++;
          userPrompt = camouflagePrompt(text || userPrompt, attempt);
        } else {
          throw err;
        }
      }
    }

    if (typingInterval) clearInterval(typingInterval);
    const cleanAIResponse = output.result.trim();

    // 3. Send Messages (Handle Multi-Burst)
    const chatParts = cleanAIResponse.split("|").map(p => p.trim()).filter(Boolean);
    for (let i = 0; i < chatParts.length; i++) {
      if (i > 0) {
        await sendChatAction(chatId, "typing");
        await new Promise(r => setTimeout(r, 500 + (i * 150)));
      }
      const sentMsg = await sendMessage(chatId, chatParts[i]);
      if (sentMsg?.ok) {
        backgroundTasks.push(saveChatMessage(chatId, "assistant", chatParts[i], sentMsg.result.message_id));
      }
    }

    // 4. Background Updates
    const userMsgId = event.body?.message?.message_id;
    backgroundTasks.push(saveChatMessage(chatId, "user", text || "[Photo]", userMsgId));
    backgroundTasks.push(trackUsage(output.provider, output.model, "success"));
    
    // Saga & Personality Update Logic
    if (mode === "istri" || mode === "nafeesa") {
      const isManualStory = text === "/story";

      const unifiedBackgroundPipeline = (async () => {
        try {
          let needsSave = true; // Always save at least to persist chat counters or analysis
          
          // Step A: Psychology & Ego Analysis
          const analysisInput = text || (photo ? "[User mengirim sebuah foto]" : null);
          if (analysisInput) {
            console.log(`[Analyzer] Background analysis for ${chatId}...`);
            const impactResult = await analyzeAndInstinct(analysisInput, config, history, psychState, lifeContext, relationshipStatus, egoState);
            if (impactResult) {
              const updated = updatePsychology(psychState, impactResult, hoursPassed);
              const ratio = calculateDominanceRatio(updated, lifeContext, relationshipStatus);
              updated.inner_voice = impactResult.inner_voice || "";
              updated.last_mood_tag = impactResult.mood_tag;
              updated.cognitive_ratio = ratio;
              userConfig.psychology = updated;

              // Step B: Update Ego Identity
              if (impactResult.ego_updates) {
                userConfig.ego_identity = updateEgo(egoState, impactResult.ego_updates);
              }

              if (redis) {
                if (impactResult.inner_voice) redis.set(KEYS.innerVoice(chatId), impactResult.inner_voice, { ex: 3600 }).catch(() => {});
                if (impactResult.mood_tag) redis.set(KEYS.moodTag(chatId), impactResult.mood_tag, { ex: 10800 }).catch(() => {});
              }
            }
          }

          // Step C: Saga & Personality Updates
          if (text) {
            userConfig.chat_count_saga = (userConfig.chat_count_saga || 0) + 1;
            userConfig.chat_count_personality = (userConfig.chat_count_personality || 0) + 1;

            const shouldUpdateSaga = userConfig.chat_count_saga >= 10 || isManualStory || !userConfig.saga;
            const shouldEvolvePersonality = userConfig.chat_count_personality >= 50;

            console.log(`[Stats] Chat Count for ${chatId} -> Saga: ${userConfig.chat_count_saga}/10, Personality: ${userConfig.chat_count_personality}/50`);

            if (shouldUpdateSaga) {
              console.log(`[Saga Engine] Updating story & identity for ${chatId}...`);
              const fullTime = `${dateStr}, ${timeStr}`;
              const sagaResult = await updateSaga(history, userConfig.saga || "", config, userConfig.active_duties || [], fullTime);
              if (sagaResult && sagaResult.updated_saga) {
                userConfig.saga = sagaResult.updated_saga;
                userConfig.relationship_status = sagaResult.relationship_status || userConfig.relationship_status;
                userConfig.chat_count_saga = 0;
                userConfig.narrative_directives = sagaResult.narrative_directives || "";
                userConfig.stagnation_level = sagaResult.stagnation_level || 0;
                userConfig.chat_count_directives = 0; 
                userConfig.active_duties = sagaResult.active_duties || userConfig.active_duties || [];
                if (sagaResult.husband_identity) {
                  userConfig.husband_profile = { ...userConfig.husband_profile, ...sagaResult.husband_identity };
                }
                if (isManualStory) await sendMessage(chatId, `📖 *Kisah Kita Diperbarui*:\n\n${userConfig.saga}`);
              }
            }

            if (shouldEvolvePersonality) {
              console.log(`[Personality Engine] Evolving character description for ${chatId}...`);
              const newDesc = await evolvePersonality(history, userConfig.personality_description || "", userConfig.saga || "", lifeContext, config);
              if (newDesc) {
                userConfig.personality_description = newDesc;
                userConfig.chat_count_personality = 0;
              }
            }
          }

          // Step D: Unified Save
          await saveUserConfig(chatId, userConfig);
        } catch (e) {
          console.error("[BG Pipeline Error]", e.message);
        }
      });

      if (isManualStory) await unifiedBackgroundPipeline();
      else backgroundTasks.push(unifiedBackgroundPipeline());
    } else {
      // In Non-Roleplay mode (e.g. Asisten), just save the configuration normally
      backgroundTasks.push(saveUserConfig(chatId, userConfig));
    }

    await Promise.all(backgroundTasks).catch(e => console.error("[BG Error]", e.message));

  } catch (err) {
    if (typingInterval) clearInterval(typingInterval);
    console.error("[Chat Error]", err.message);
    await sendMessage(chatId, "Maaf, ada gangguan sedikit di pikiranku. Bisa coba lagi?");
  }
}

async function handleCallback(body, event) {
  const chatId = body.callback_query.message.chat.id;
  const messageId = body.callback_query.message.message_id;
  const data = body.callback_query.data;
  const userConfig = await loadUserConfig(chatId);

  if (data === "confirm_clear_chat") {
    await editMessageText(chatId, messageId, "<b>⚠️ Hapus Total?</b>\n\nSemua riwayat dan ingatan akan hilang permanen.", [
      [{ text: "✅ Ya, Hapus", callback_data: "clear_chat_now" }],
      [{ text: "❌ Batal", callback_data: "close_menu" }]
    ]);
  } else if (data === "clear_chat_now") {
    await clearChatHistory(chatId);
    const initialPsych = getInitialPsychology(userConfig.personality_traits || {});
    await saveUserConfig(chatId, { 
      ...userConfig, saga: "", chat_count_saga: 0, relationship_status: "Kenalan Baru", 
      husband_profile: {}, life_context: "", psychology: initialPsych 
    });
    if (redis) await redis.del(KEYS.innerVoice(chatId));
    await editMessageText(chatId, messageId, "✅ Amnesia Total Berhasil! Mari mulai dari awal lagi... ❤️", []);
  } else if (data === "close_menu") {
    await editMessageText(chatId, messageId, "Menu ditutup. Chat aku kapan saja! ❤️", []);
  }
}

async function handler(event) {
  if (event.httpMethod === "OPTIONS") return optionsResponse();

  // Validate Telegram webhook secret token
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (webhookSecret) {
    const receivedSecret = event.headers["x-telegram-bot-api-secret-token"];
    if (receivedSecret !== webhookSecret) {
      return json(401, { ok: false, error: "Invalid webhook secret" });
    }
  }

  const body = readJson(event);

  // Deduplicate Telegram webhooks (prevents double responses)
  if (redis && body.update_id) {
    const dedupKey = `tg_update:${body.update_id}`;
    const isNew = await redis.set(dedupKey, "1", { nx: true, ex: 60 });
    if (!isNew) {
      console.log(`[Webhook] Duplicate update_id ${body.update_id}, skipping`);
      return json(200, { ok: true });
    }
  }

  if (body.message) {
    const { message } = body;
    const chatId = message.chat.id;
    const text = message.text || message.caption;
    if (text === "/start") return handleStartCommand(chatId).then(() => json(200, { ok: true }));
    if (text === "/settings" || text === "/menu") return handleSettingsCommand(chatId, event).then(() => json(200, { ok: true }));
    if (text === "/kondisi") return handleKondisiCommand(chatId, event).then(() => json(200, { ok: true }));
    if (text === "/sejarah" || text === "/story") {
      const userConfig = await loadUserConfig(chatId);
      return handleSejarahCommand(chatId, userConfig).then(() => json(200, { ok: true }));
    }
    if (text || message.photo) {
      // Per-user lock to prevent concurrent processing race condition
      if (redis) {
        const lockKey = `lock:user:${chatId}`;
        const acquired = await redis.set(lockKey, "1", { nx: true, ex: 25 });
        if (!acquired) {
          sendMessage(chatId, "Tunggu sebentar ya, aku masih mikir... \u{1F4AD}").catch(() => {});
          return json(200, { ok: true });
        }
        try {
          await handleAIMessage(chatId, text, message.photo, event);
        } finally {
          await redis.del(lockKey);
        }
      } else {
        await handleAIMessage(chatId, text, message.photo, event);
      }
      return json(200, { ok: true });
    }
  }
  if (body.callback_query) return handleCallback(body, event).then(() => json(200, { ok: true }));
  return json(200, { ok: true });
}

export default vercelHandler(handler);
