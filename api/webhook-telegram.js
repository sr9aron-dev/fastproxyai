// Trigger redeploy for Mini App configuration
import { json, optionsResponse, readJson, vercelHandler } from "../src/http.mjs";
import { loadConfig, loadChatHistory, saveChatMessage, saveConfig, trackUsage, clearChatHistory, loadUserConfig, saveUserConfig } from "../src/store.mjs";
import { generateWithRotation } from "../src/rotation.mjs";
import {
  sendMessage,
  sendChatAction,
  editMessageText,
  answerCallbackQuery,
  getTelegramFile
} from "../src/telegram.mjs";
import redis, { KEYS } from "../src/redis.mjs";
import { sha256 } from "../src/crypto.mjs";
import { 
  analyzeEmotionalImpact, 
  updatePsychology, 
  generatePsychologicalSummary,
  getInitialPsychology,
  analyzeSelfReflection
} from "../src/psychology.mjs";
import { buildRoleplayPrompt, ROLEPLAY_TEMPLATES } from "../src/prompt.mjs";
import { updateSaga } from "../src/saga.mjs";

/**
 * Telegram Webhook Endpoint
 */

async function handleKondisiCommand(chatId, event) {
  const host = event?.headers?.host || process.env.BASE_URL?.replace('https://', '') || 'mega-vercel-ai-proxy.vercel.app';
  const miniAppUrl = `https://${host}/miniapp.html`;
  
  await sendMessage(chatId, `📊 *Monitor Kondisi Nafeesa*\n\nAnda bisa memantau emosi, mood, dan sifat internal saya secara real-time melalui Dashboard.`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📊 Buka Dashboard Emosi", web_app: { url: miniAppUrl } }]
      ]
    }
  });
}

async function handleStartCommand(chatId) {
  await sendMessage(
    chatId,
    `Halo... 👋\n\nAku Nafeesa, Aku siap nemenin kamu setiap saat. Kamu bisa kirim chat atau foto apa aja ke aku... ❤️`
  );
}

async function handleIdCommand(chatId) {
  await sendMessage(chatId, `Chat ID kita adalah: *${chatId}*`);
}

async function handleSettingsCommand(chatId, event) {
  const host = event?.headers?.host || process.env.BASE_URL?.replace('https://', '') || 'mega-vercel-ai-proxy.vercel.app';
  const miniAppUrl = `https://${host}/miniapp.html`;
  
  await sendMessage(chatId, `✨ *Panel Kontrol Nafeesa* ✨\n\nSemua pengaturan mode, provider AI, dan workshop kepribadian sekarang sudah disatukan dalam satu aplikasi agar lebih mudah digunakan.`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🚀 Buka Panel Nafeesa", web_app: { url: miniAppUrl } }],
        [{ text: "🗑️ Hapus Riwayat Chat", callback_data: "confirm_clear_chat" }]
      ]
    }
  });
}

async function handlePersonalityCommand(chatId) {
  await handleSettingsCommand(chatId);
}

async function handleAIMessage(chatId, text, photo) {
  let typingInterval;
  try {
    // 1. Load everything in parallel
    const [config, userConfig, history, redisInnerVoice] = await Promise.all([
      loadConfig(),
      loadUserConfig(chatId),
      loadChatHistory(chatId, 15),
      (async () => {
        try {
          if (!redis) return null;
          return await redis.get(KEYS.innerVoice(chatId));
        } catch (e) {
          console.warn("[Redis Error] Gagal ambil kata hati:", e.message);
          return null;
        }
      })()
    ]);

    const forceProvider = userConfig.provider;

    // Show "typing..."
    await sendChatAction(chatId, "typing");
    typingInterval = setInterval(() => {
      sendChatAction(chatId, "typing").catch(() => { });
    }, 4000);

    let imagePayload = null;
    if (photo && photo.length > 0) {
      const fileId = photo[photo.length - 1].file_id;
      imagePayload = await getTelegramFile(fileId);
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });
    const dateStr = now.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const mode = userConfig.mode || "istri";
    const sagaSummary = userConfig.saga || "";
    
    // 1. Persiapkan Psikologi (Hanya ambil state lama)
    let psychSummary = "";
    let psychState = null;
    if (mode === "istri") {
      psychState = userConfig.psychology || getInitialPsychology(userConfig.personality_traits || {});
      // Pakai Kata Hati dari Redis jika ada
      if (redisInnerVoice) psychState.inner_voice = redisInnerVoice;
      psychSummary = generatePsychologicalSummary(psychState);
    }

    // --- 1. AI ANALYZER (Pencatat Emosi & Kata Hati) ---
    let extractedImpact = null;
    if (mode === "istri" && psychState && text) {
      console.log(`[Analyzer] Analyzing emotional impact for ${chatId}...`);
      // Paksa pakai Groq agar analisa kilat (<1.5s)
      extractedImpact = await analyzeEmotionalImpact(text, config, history, psychState);
      
      if (extractedImpact) {
        // Update Psikologi secara instan di memori
        psychState = updatePsychology(psychState, extractedImpact);
        userConfig.psychology = psychState; // Siapkan untuk disimpan nanti
        
        // Update Summary untuk disuntikkan ke Nafeesa sekarang juga
        psychSummary = generatePsychologicalSummary(psychState);
        
        // Simpan Kata Hati terbaru ke Redis agar persisten
        if (extractedImpact.inner_voice) {
          try {
            if (redis) {
              await redis.set(KEYS.innerVoice(chatId), extractedImpact.inner_voice, { ex: 3600 });
            }
          } catch (e) {
            console.warn("[Redis Error] Gagal simpan kata hati:", e.message);
          }
        }
      }
    }

    // --- 2. NAFEESA CHATBOT (Aktor & Balasan) ---
    const systemPrompt = buildRoleplayPrompt(mode, timeStr, dateStr, psychSummary, sagaSummary);
    const finalHistory = history;

    // 2. Main AI Call
    const { output } = await generateWithRotation(config, {
      prompt: text || "Lihat foto yang aku kirim ini",
      system: systemPrompt,
      temperature: 0.8,
      history: finalHistory,
      image: imagePayload,
      forceProvider
    });

    if (typingInterval) clearInterval(typingInterval);

    let rawAIResponse = output.result;
    let cleanAIResponse = rawAIResponse.trim();

    // 3. Kirim Pesan Pertama
    // Cek apakah ada pesan kedua (dipisah oleh '|')
    const chatParts = cleanAIResponse.split("|").map(p => p.trim()).filter(Boolean);
    const firstMessage = chatParts[0];

    const sendResult = await sendMessage(chatId, firstMessage);
    if (!sendResult || !sendResult.ok) {
      await sendMessage(chatId, firstMessage, { parse_mode: null });
    }

    // 4. Proactive "Multi-Burst" (Nyerocos Otomatis)
    if (chatParts.length > 1) {
      try {
        // Mulai dari elemen kedua (index 1) sampai habis
        for (let i = 1; i < chatParts.length; i++) {
          const extraMessage = chatParts[i];
          
          // Simulasikan Nafeesa sedang mengetik
          await sendChatAction(chatId, "typing");
          // Jeda makin lama sedikit agar terasa natural
          await new Promise(resolve => setTimeout(resolve, 1000 + (i * 200))); 
          
          // Kirim pesan tambahan
          await sendMessage(chatId, extraMessage);
          
          // Simpan ke histori
          await saveChatMessage(chatId, "assistant", extraMessage);
        }
      } catch (err) {
        console.error("[Multi-Burst Error]", err.message);
      }
    }

    // 5. Background tasks (Simpan semua di sini)
    const backgroundTasks = [
      saveChatMessage(chatId, "user", text || "[Mengirim Foto]"),
      saveChatMessage(chatId, "assistant", cleanAIResponse),
      trackUsage(output.provider, output.model, "success")
    ];

    // Logika Pembaruan Saga (Background tapi WAJIB DITUNGGU agar tidak terbunuh Vercel)
    if (mode === "istri") {
      // Tambah hitungan chat saga
      userConfig.chat_count_saga = (userConfig.chat_count_saga || 0) + 1;
      
      const shouldUpdateSaga = text === "/story" || 
                               (!userConfig.saga && userConfig.chat_count_saga >= 3) || 
                               (userConfig.chat_count_saga >= 10);

      if (shouldUpdateSaga) {
        console.log(`[Saga Engine] Triggering story update for ${chatId}...`);
        
        // Buat histori lengkap (Histori lama + Pesan baru ini)
        const updatedHistoryForSaga = [
          ...history,
          { role: "user", text: text || "[Foto]" },
          { role: "assistant", text: cleanAIResponse }
        ];

        backgroundTasks.push(
          updateSaga(updatedHistoryForSaga, userConfig.saga, config).then(async (newSaga) => {
            userConfig.saga = newSaga;
            userConfig.chat_count_saga = 0; // Reset
            
            if (text === "/story") {
              await sendMessage(chatId, `📖 *Kisah Kita Diperbarui*:\n\n${newSaga}`);
            }
            
            return saveUserConfig(chatId, userConfig);
          })
        );
      } else {
        backgroundTasks.push(saveUserConfig(chatId, userConfig));
      }
    }

    // WAJIB AWAIT: Agar Vercel tidak mematikan fungsi sebelum simpan data selesai
    await Promise.all(backgroundTasks).catch(err => console.error("[Background Task Error]", err.message));

    // Simpan Kata Hati ke Redis (Hanya bertahan 1 jam)
    if (mode === "istri" && extractedImpact?.inner_voice) {
      try {
        if (redis) {
          await redis.set(KEYS.innerVoice(chatId), extractedImpact.inner_voice, { ex: 3600 });
        }
      } catch (e) {
        console.warn("[Redis Error] Gagal simpan kata hati:", e.message);
      }
    }

    imagePayload = null;

  } catch (aiError) {
    if (typingInterval) clearInterval(typingInterval);
    console.error("[Telegram AI] Error:", aiError.message);
    await sendMessage(chatId, "Maaf boss, ada gangguan sedikit di pikiranku. Bisa coba kirim lagi pesannya?");
  }
}

async function handleCallback(body, event) {
  const callbackQueryId = body.callback_query.id;
  const chatId = body.callback_query.message.chat.id;
  const messageId = body.callback_query.message.message_id;
  const data = body.callback_query.data;

  const [config, userConfig] = await Promise.all([
    loadConfig(),
    loadUserConfig(chatId)
  ]);

  const host = event?.headers?.host || process.env.BASE_URL?.replace('https://', '') || 'mega-vercel-ai-proxy.vercel.app';
  const miniAppUrl = `https://${host}/miniapp.html`;

  if (data === "show_models") {
    const keyboard = [
      [{ text: "Gemini 2.0 (Google)", callback_data: "set_provider_gemini" }],
      [{ text: "Llama 4 Scout (Groq)", callback_data: "set_provider_groq" }],
      [{ text: "Mistral Tiny", callback_data: "set_provider_mistral" }],
      [{ text: "🗑️ Hapus Riwayat Chat", callback_data: "confirm_clear_chat" }],
      [{ text: "⬅️ Kembali", callback_data: "back_to_main" }]
    ];
    await editMessageText(chatId, messageId, "Pilih model yang mau aku pakai ya, Boss:", keyboard);
  } else if (data === "confirm_reset") {
    await editMessageText(chatId, messageId, "<b>⚠️ Konfirmasi Reset</b>\n\nKamu yakin mau mereset ingatan aku untuk sementara?", [
      [{ text: "✅ Ya, Reset Sekarang", callback_data: "clear_chat_now" }],
      [{ text: "❌ Batalkan", callback_data: "back_to_main" }]
    ]);
  } else if (data === "confirm_clear_chat") {
    await editMessageText(chatId, messageId, "<b>⚠️ Konfirmasi Hapus Total</b>\n\nKamu yakin mau menghapus semua riwayat chat kita secara permanen?", [
      [{ text: "✅ Ya, Hapus Semuanya", callback_data: "clear_chat_now" }],
      [{ text: "❌ Batalkan", callback_data: "show_models" }]
    ]);
  } else if (data === "clear_chat_now") {
    try {
      // 1. Hapus riwayat pesan mentah
      await clearChatHistory(chatId);
      
      // 2. Reset Ingatan Jangka Panjang & Psikologi
      userConfig.saga = "";
      userConfig.chat_count_saga = 0;
      userConfig.psychology = getInitialPsychology(userConfig.personality_traits || {});
      await saveUserConfig(chatId, userConfig);
      
      // 3. Hapus Kata Hati di Redis
      try {
        if (redis) await redis.del(KEYS.innerVoice(chatId));
      } catch (re) {
        console.warn("[Redis Error] Gagal hapus kata hati saat reset:", re.message);
      }

      await answerCallbackQuery(callbackQueryId, "Amnesia Total Berhasil!");
      await editMessageText(chatId, messageId, "✅ <b>Buka Lembaran Baru!</b>\n\nSeluruh riwayat chat dan ingatanku tentang kita sudah aku hapus bersih. Aku merasa seperti baru pertama kali mengenalmu lagi... ❤️", [[{ text: "❌ Tutup", callback_data: "close_menu" }]]);
    } catch (err) {
      console.error("[Reset Error]", err.message);
      await answerCallbackQuery(callbackQueryId, "Gagal mereset ingatan.");
    }
  } else if (data.startsWith("set_provider_")) {
    const newProvider = data.replace("set_provider_", "");
    await saveUserConfig(chatId, { provider: newProvider });

    await answerCallbackQuery(callbackQueryId, `Model diganti ke ${newProvider.toUpperCase()}!`);
    await editMessageText(chatId, messageId, `Sip! Sekarang aku pakai model <b>${newProvider.toUpperCase()}</b> ya, Boss. ❤️`, [
      [{ text: "⬅️ Kembali", callback_data: "back_to_main" }]
    ]);
  } else if (data === "toggle_mode") {
    const newMode = (userConfig.mode || "istri") === "istri" ? "asisten" : "istri";
    await saveUserConfig(chatId, { mode: newMode });
    await answerCallbackQuery(callbackQueryId, `Mode diganti ke ${newMode.toUpperCase()}!`);

    const keyboard = [
      [{ text: "⬅️ Kembali", callback_data: "back_to_main" }]
    ];
    await editMessageText(chatId, messageId, `Sip! Sekarang aku jadi *${newMode === "istri" ? "Istri ❤️" : "Asisten 💼"}* kamu ya, Boss.`, keyboard);
  } else if (data === "back_to_main" || data === "check_state") {
    const text = data === "check_state" ? "📊 *Monitor Kondisi Nafeesa*" : "✨ *Panel Kontrol Nafeesa* ✨";
    const subText = data === "check_state" ? "Pantau emosi, mood, dan sifat internal saya secara real-time." : "Atur mode, model AI, dan kepribadian saya di sini.";
    
    await editMessageText(chatId, messageId, `${text}\n\n${subText}`, [
      [{ text: "🚀 Buka Panel Nafeesa", web_app: { url: miniAppUrl } }],
      [{ text: "🗑️ Hapus Riwayat Chat", callback_data: "confirm_clear_chat" }],
      [{ text: "❌ Tutup Menu", callback_data: "close_menu" }]
    ]);
  } else if (data === "close_menu") {
    await editMessageText(chatId, messageId, "Menu pengaturan ditutup. Chat aku kapan aja ya! ❤️", []);
  } else if (data.startsWith("trait_")) {
    const [_, trait, action] = data.split("_");
    const traitMap = {
      ope: "openness",
      con: "conscientiousness",
      ext: "extraversion",
      agr: "agreeableness",
      neu: "neuroticism"
    };
    
    const fullTraitName = traitMap[trait];
    
    // Pastikan objek psikologi dan personality ada (PENTING untuk data lama)
    if (!userConfig.psychology) {
      userConfig.psychology = getInitialPsychology(userConfig.personality_traits || {});
    }
    if (!userConfig.psychology.personality) {
      const initial = getInitialPsychology(userConfig.personality_traits || {});
      userConfig.psychology.personality = initial.personality;
    }
    
    if (action === "plus") {
      userConfig.psychology.personality[fullTraitName] = Math.min(1.0, userConfig.psychology.personality[fullTraitName] + 0.05);
    } else if (action === "minus") {
      userConfig.psychology.personality[fullTraitName] = Math.max(0.0, userConfig.psychology.personality[fullTraitName] - 0.05);
    }
    
    await saveUserConfig(chatId, userConfig);
    
    const p = userConfig.psychology.personality;
    const keyboard = [
      [{ text: "📖 Keterbukaan", callback_data: "none" }, { text: "➖", callback_data: "trait_ope_minus" }, { text: p.openness.toFixed(2), callback_data: "none" }, { text: "➕", callback_data: "trait_ope_plus" }],
      [{ text: "💼 Kedisiplinan", callback_data: "none" }, { text: "➖", callback_data: "trait_con_minus" }, { text: p.conscientiousness.toFixed(2), callback_data: "none" }, { text: "➕", callback_data: "trait_con_plus" }],
      [{ text: "🎉 Energi Sosial", callback_data: "none" }, { text: "➖", callback_data: "trait_ext_minus" }, { text: p.extraversion.toFixed(2), callback_data: "none" }, { text: "➕", callback_data: "trait_ext_plus" }],
      [{ text: "🤝 Keramahan", callback_data: "none" }, { text: "➖", callback_data: "trait_agr_minus" }, { text: p.agreeableness.toFixed(2), callback_data: "none" }, { text: "➕", callback_data: "trait_agr_plus" }],
      [{ text: "🧠 Sensitivitas", callback_data: "none" }, { text: "➖", callback_data: "trait_neu_minus" }, { text: p.neuroticism.toFixed(2), callback_data: "none" }, { text: "➕", callback_data: "trait_neu_plus" }],
      [{ text: "✅ Selesai", callback_data: "close_menu" }]
    ];
    
    await editMessageText(chatId, messageId, `*Workshop Kepribadian Nafeesa* 🛠️\n\nAtur sifat dasar istri virtualmu di sini. Nilai berkisar antara 0.0 (rendah) sampai 1.0 (tinggi).`, keyboard);
  }

  await answerCallbackQuery(callbackQueryId);
}

async function handler(event) {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  if (event.httpMethod !== "POST") return json(405, { ok: false, error: "Use POST" });

  try {
    const body = readJson(event);

    if (body.message) {
      const { message } = body;
      const chatId = message.chat.id;
      const text = message.text || message.caption;
      const photo = message.photo;

      // 1. Process Commands First
      if (text === "/start") return handleStartCommand(chatId).then(() => json(200, { ok: true }));
      if (text === "/id") return handleIdCommand(chatId).then(() => json(200, { ok: true }));
      if (text === "/settings" || text === "/menu" || text === "/s") return handleSettingsCommand(chatId, event).then(() => json(200, { ok: true }));
      if (text === "/kondisi" || text === "/k") return handleKondisiCommand(chatId, event).then(() => json(200, { ok: true }));
      if (text === "/personality" || text === "/sifat") return handleSettingsCommand(chatId, event).then(() => json(200, { ok: true }));

      // 2. Process AI Chat if not a command
      if (text || photo) {
        await handleAIMessage(chatId, text, photo);
        return json(200, { ok: true });
      }
    }

    if (body.callback_query) {
      return handleCallback(body, event).then(() => json(200, { ok: true }));
    }

    return json(200, { ok: true });
  } catch (error) {
    console.error("[Telegram Webhook] error:", error);
    return json(200, { ok: false, error: error.message });
  }
}

export default vercelHandler(handler);
