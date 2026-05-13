const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function sendMessage(chatId, text, options = {}) {
  if (!TELEGRAM_TOKEN) {
    console.error("[Telegram Bot] TELEGRAM_BOT_TOKEN is not set");
    return;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "Markdown",
        ...options
      })
    });
    return await res.json();
  } catch (error) {
    console.error("[Telegram Bot] Failed to send message:", error);
  }
}

export async function sendChatAction(chatId, action = "typing") {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendChatAction`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action })
    });
  } catch (err) {
    console.error("[Telegram] sendChatAction error:", err);
  }
}

export async function editMessageText(chatId, messageId, text, keyboard) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: text,
        parse_mode: "Markdown",
        reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined
      })
    });
  } catch (error) {
    console.error("[Telegram Bot] Failed to edit message text:", error);
  }
}

export async function answerCallbackQuery(callbackQueryId, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text
      })
    });
  } catch (error) {
    console.error("[Telegram Bot] Failed to answer callback query:", error);
  }
}

export async function getTelegramFile(fileId) {
  const getFileUrl = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${fileId}`;
  try {
    const fileRes = await fetch(getFileUrl);
    const fileData = await fileRes.json();
    if (!fileData.ok) return null;

    const filePath = fileData.result.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;
    const response = await fetch(downloadUrl);
    const buffer = await response.arrayBuffer();

    return {
      base64: Buffer.from(buffer).toString("base64"),
      mime: "image/jpeg"
    };
  } catch (err) {
    console.error("[Telegram] getTelegramFile error:", err);
    return null;
  }
}
