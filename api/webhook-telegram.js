import { json, optionsResponse, readJson, vercelHandler } from "../src/http.mjs";
import { loadChatHistory, saveChatMessage, saveConfig, trackUsage, clearChatHistory, loadUserConfig, saveUserConfig, recordLog, loadConfig } from "../src/store.mjs";
import { generateWithRotation } from "../src/rotation.mjs";
import { sendMessage, sendChatAction, editMessageText, answerCallbackQuery, getTelegramFile } from "../src/telegram.mjs";
import redis, { KEYS } from "../src/redis.mjs";
import { 
  getInitialPsychology, 
  updatePsychology, 
  analyzeEmotionalImpact, 
  calculateDominanceRatio,
  generateInstinct,
  generatePsychologicalSummary, 
  getPreferredAddress 
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

    await sendChatAction(chatId, "typing");
    typingInterval = setInterval(() => sendChatAction(chatId, "typing").catch(() => {}), 4000);

    let imagePayload = null;
    if (photo && photo.length > 0) {
      const fileId = photo[photo.length - 1].file_id;
      imagePayload = await getTelegramFile(fileId);
    }

    const mode = userConfig.mode || "istri";
    const lifeContext = userConfig.life_context || "";
    const relationshipStatus = userConfig.relationship_status || "Kenalan Baru";
    let psychState = userConfig.psychology || getInitialPsychology(userConfig.personality_traits || {});

    // --- SINKRONISASI PSIKOLOGI & KATA HATI ---
    let extractedImpact = null;
    const analysisInput = text || (photo ? "[User mengirim sebuah foto]" : null);
    
    if (mode === "istri" && analysisInput) {
      console.log(`[Analyzer] Phase 1: Emotional Impact for ${chatId}...`);
      extractedImpact = await analyzeEmotionalImpact(analysisInput, config, history, psychState, lifeContext, relationshipStatus);
      
      if (extractedImpact) {
        // Update angka emosi terlebih dahulu
        psychState = updatePsychology(psychState, extractedImpact, hoursPassed);
        
        // Fase 1.5: Hitung Rasio Dominansi Logika vs Emosi
        const ratio = calculateDominanceRatio(psychState, lifeContext, relationshipStatus);
        console.log(`[Analyzer] Phase 1.5: Dominance Ratio -> Logic: ${ratio.logic}%, Emotion: ${ratio.emotion}%`);
        
        // Fase 2: Generate Kata Hati (Insting) berdasarkan Rasio
        console.log(`[Analyzer] Phase 2: Generating Instinct...`);
        const innerVoice = await generateInstinct(analysisInput, config, history, psychState, lifeContext, relationshipStatus, ratio);
        
        psychState.inner_voice = innerVoice;
        psychState.last_mood_tag = extractedImpact.mood_tag;
        psychState.cognitive_ratio = ratio; // SIMPAN RASIO KE STATE
        userConfig.psychology = psychState;

        // Simpan ke Redis agar persisten
        if (redis) {
          if (innerVoice) await redis.set(KEYS.innerVoice(chatId), innerVoice, { ex: 3600 });
          if (extractedImpact.mood_tag) await redis.set(KEYS.moodTag(chatId), extractedImpact.mood_tag, { ex: 10800 });
        }
      }
    }

    const psychSummary = generatePsychologicalSummary(psychState);
    const preferredAddress = (mode === "istri") ? getPreferredAddress(psychState, userConfig.husband_profile || {}, relationshipStatus) : "Boss";
    const now = new Date();
    const timeStr = now.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });
    const dateStr = now.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // 2. Build Prompt & Generate Response
    let systemPrompt = buildRoleplayPrompt(
      mode, timeStr, dateStr, psychSummary, userConfig.saga || "", 
      preferredAddress, userConfig.husband_profile || {}, relationshipStatus, 
      lifeContext, userConfig.personality_description || ""
    );
    
    let userPrompt = text || "Lihat foto ini";
    let isRequestSensitive = isSensitive(userPrompt);

    let output;
    try {
      const result = await generateWithRotation(config, {
        prompt: userPrompt,
        system: systemPrompt,
        temperature: 0.8,
        history: history,
        image: imagePayload,
        forceProvider: userConfig.provider
      });
      output = result.output;
    } catch (err) {
      if (err.isSafetyBlock || isRequestSensitive) {
        console.log(`[Safety] Attempting camouflage for ${chatId}...`);
        const camouflaged = camouflagePrompt(userPrompt, 0);
        const result = await generateWithRotation(config, {
          prompt: camouflaged,
          system: systemPrompt,
          temperature: 0.9, // Higher temp for more 'creative' bypass
          history: history,
          image: imagePayload,
          // If gemini blocked it, try groq/mistral first on retry
          providerOrder: ["groq", "mistral", "gemini"] 
        });
        output = result.output;
      } else {
        throw err;
      }
    }

    if (typingInterval) clearInterval(typingInterval);
    const cleanAIResponse = output.result.trim();

    // 3. Send Messages (Handle Multi-Burst)
    const chatParts = cleanAIResponse.split("|").map(p => p.trim()).filter(Boolean);
    for (let i = 0; i < chatParts.length; i++) {
      if (i > 0) {
        await sendChatAction(chatId, "typing");
        await new Promise(r => setTimeout(r, 1000 + (i * 200)));
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
    if (mode === "istri" && text) {
      userConfig.chat_count_saga = (userConfig.chat_count_saga || 0) + 1;
      userConfig.chat_count_personality = (userConfig.chat_count_personality || 0) + 1;
      
      const isManualStory = text === "/story";
      const shouldUpdateSaga = userConfig.chat_count_saga >= 10 || isManualStory || !userConfig.saga;
      const shouldEvolvePersonality = userConfig.chat_count_personality >= 50;

      console.log(`[Stats] Chat Count for ${chatId} -> Saga: ${userConfig.chat_count_saga}/10, Personality: ${userConfig.chat_count_personality}/50`);

      const updateTask = (async () => {
        try {
          let needsSave = true; // Always save at the end to persist counters
          if (shouldUpdateSaga) {
            console.log(`[Saga Engine] Updating story & identity for ${chatId}...`);
            const sagaResult = await updateSaga(history, userConfig.saga || "", config);
            if (sagaResult && sagaResult.updated_saga) {
              userConfig.saga = sagaResult.updated_saga;
              userConfig.relationship_status = sagaResult.relationship_status || userConfig.relationship_status;
              userConfig.chat_count_saga = 0;
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

          await saveUserConfig(chatId, userConfig);
        } catch (e) { console.error("[Update Task Error]", e.message); }
      });

      if (isManualStory) await updateTask(); 
      else backgroundTasks.push(updateTask());
    } else {
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
  const body = readJson(event);
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
      await handleAIMessage(chatId, text, message.photo, event);
      return json(200, { ok: true });
    }
  }
  if (body.callback_query) return handleCallback(body, event).then(() => json(200, { ok: true }));
  return json(200, { ok: true });
}

export default vercelHandler(handler);
