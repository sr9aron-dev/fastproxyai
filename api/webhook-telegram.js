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
  getInitialPsychology
} from "../src/psychology.mjs";
import { buildRoleplayPrompt } from "../src/prompt.mjs";

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
    const [config, userConfig, history] = await Promise.all([
      loadConfig(),
      loadUserConfig(chatId),
      loadChatHistory(chatId, 12) // Reduced history for speed
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
    
    // --- PSYCHOLOGY ENGINE INTEGRATION ---
    let psychSummary = "";
    if (mode === "istri") {
      let psychState = userConfig.psychology || getInitialPsychology(userConfig.personality_traits || {});
      const impact = await analyzeEmotionalImpact(text, config);
      psychState = updatePsychology(psychState, impact);
      
      // Save updated state back to userConfig
      userConfig.psychology = psychState;
      await saveUserConfig(chatId, userConfig);
      
      psychSummary = generatePsychologicalSummary(psychState);
    }
    
    // Use the main project system prompt builder
    const systemPrompt = buildRoleplayPrompt(mode, timeStr, dateStr, psychSummary);
    // -------------------------------------

    // 2. Single AI Call (Better for Vision)
    const { output } = await generateWithRotation(config, {
      prompt: text || "Lihat foto yang aku kirim ini",
      system: systemPrompt,
      temperature: 0.8,
      history: history,
      image: imagePayload,
      forceProvider
    });

    if (typingInterval) clearInterval(typingInterval);

    // 3. Prioritize Telegram Response
    const sendResult = await sendMessage(chatId, output.result);
    if (!sendResult || !sendResult.ok) {
      await sendMessage(chatId, output.result, { parse_mode: null });
    }

    // 4. Background tasks (Don't await these to finish the request faster)
    Promise.all([
      saveChatMessage(chatId, "user", text || "[Mengirim Foto]"),
      saveChatMessage(chatId, "assistant", output.result),
      trackUsage(output.provider, output.model, "success")
    ]).catch(err => console.error("[Background Task Error]", err.message));

    imagePayload = null;

  } catch (aiError) {
    if (typingInterval) clearInterval(typingInterval);
    console.error("[Telegram AI] Error:", aiError.message);
    await sendMessage(chatId, "Maaf boss, ada gangguan sedikit di pikiranku. Bisa coba kirim lagi pesannya?");
  }
}

async function handleCallback(body) {
  const callbackQueryId = body.callback_query.id;
  const chatId = body.callback_query.message.chat.id;
  const messageId = body.callback_query.message.message_id;
  const data = body.callback_query.data;

  const [config, userConfig] = await Promise.all([
    loadConfig(),
    loadUserConfig(chatId)
  ]);

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
      await clearChatHistory(chatId);
      await answerCallbackQuery(callbackQueryId, "Riwayat chat berhasil dibersihkan!");
      await editMessageText(chatId, messageId, "✅ <b>Berhasil!</b>\n\nSekarang ingatan aku tentang chat kita sudah bersih. Ayo mulai chat baru!", [[{ text: "❌ Tutup", callback_data: "close_menu" }]]);
    } catch (err) {
      await answerCallbackQuery(callbackQueryId, "Gagal membersihkan chat.");
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
  } else if (data === "back_to_main") {
    const userConfig = await loadUserConfig(chatId);
    const currentProvider = userConfig.provider || config.providerOrder[0];
    const currentMode = userConfig.mode || "istri";
    const keyboard = [
      [{ text: `🤖 Model: ${currentProvider.toUpperCase()}`, callback_data: "show_models" }],
      [{ text: `🎭 Mode: ${currentMode === "istri" ? "Istri ❤️" : "Asisten 💼"}`, callback_data: "toggle_mode" }],
      [{ text: "📊 Cek Kondisi Saya", callback_data: "check_state" }],
      [{ text: "🧠 Atur Sifat (Big Five)", callback_data: "show_personality" }],
      [{ text: "🗑️ Hapus Ingatan (Reset)", callback_data: "confirm_reset" }],
      [{ text: "❌ Tutup Menu", callback_data: "close_menu" }]
    ];
    await editMessageText(chatId, messageId, `*Pengaturan Nafeesa AI*\n\nModel aktif: *${config[currentProvider]?.model || "Unknown"}*\nMode: *${currentMode.toUpperCase()}*`, keyboard);
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
    if (!userConfig.psychology) userConfig.psychology = getInitialPsychology();
    
    if (action === "plus") {
      userConfig.psychology.personality[fullTraitName] = Math.min(1.0, userConfig.psychology.personality[fullTraitName] + 0.05);
    } else {
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
      const chatId = body.message.chat.id;
      const text = body.message.text || body.message.caption || "";
      const photo = body.message.photo;

      if (text === "/start") return handleStartCommand(chatId).then(() => json(200, { ok: true }));
      if (text === "/id") return handleIdCommand(chatId).then(() => json(200, { ok: true }));
      if (text === "/settings" || text === "/s") return handleSettingsCommand(chatId, event).then(() => json(200, { ok: true }));
      if (text === "/kondisi" || text === "/k") return handleKondisiCommand(chatId, event).then(() => json(200, { ok: true }));
      if (text === "/personality" || text === "/sifat") return handleSettingsCommand(chatId, event).then(() => json(200, { ok: true }));

      if (text || photo) {
        await handleAIMessage(chatId, text, photo);
      }
    }

    if (body.callback_query) {
      await handleCallback(body);
    }

    return json(200, { ok: true });
  } catch (error) {
    console.error("[Telegram Webhook] error:", error);
    return json(200, { ok: false, error: error.message });
  }
}

export default vercelHandler(handler);
