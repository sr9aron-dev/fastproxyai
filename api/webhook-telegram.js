import { json, optionsResponse, readJson, vercelHandler } from "../src/http.mjs";
import { createClient } from "@supabase/supabase-js";

// --- KONFIGURASI SUPABASE ---
const supabaseUrl = process.env.SUPABASE_URL || "https://dummy.supabase.co";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "dummy_key";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- KONFIGURASI BOT ---
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const DEFAULT_REF_IMAGE = "https://cdn.jsdelivr.net/gh/SumeLabs/clawra@main/assets/clawra.png";

// --- LOGGER ---
async function logEvent(level, event, details, telegram_id = null) {
    try {
        await supabase.from('bot_logs').insert({
            level,
            event,
            details,
            telegram_id
        });
        console.log(`[${level}] ${event} - ${details}`);
    } catch (e) {
        console.error("Gagal menyimpan log:", e);
    }
}

// --- TELEGRAM API ---
async function sendTelegram(method, payload) {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            cache: 'no-store'
        });
        const data = await response.json();
        await logEvent('INFO', `Telegram API Res (${method})`, JSON.stringify(data));
        return data;
    } catch (error) {
        await logEvent('ERROR', 'Telegram Fetch Exception', `Method: ${method}, Err: ${error.message}`);
        return null;
    }
}

async function sendTelegramPhotoBuffer(chatId, buffer) {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('photo', new Blob([buffer], { type: 'image/jpeg' }), 'selfie.jpg');

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });
        return response.ok;
    } catch (error) {
        await logEvent('ERROR', 'Telegram Photo Upload Exception', `Err: ${error.message}`);
        return false;
    }
}


// --- MISTRAL AI ---
async function queryMistral(systemPrompt, history, userMessage) {
    // Karena ini berjalan di dalam proxy, kita bisa menggunakan endpoint proxy itu sendiri
    const url = process.env.MISTRAL_API_URL || "https://fatsproxyai.vercel.app/api/mistral";
    const apiKey = process.env.MISTRAL_API_KEY || ""; // Opsional jika proxy sudah punya keys

    const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map(h => ({
            role: h.role === 'user' ? 'user' : 'assistant',
            content: h.content
        })),
        { role: 'user', content: userMessage }
    ];

    const tools = [
        {
            type: "function",
            function: {
                name: "generate_selfie",
                description: "Picu alat ini saat pengguna meminta foto selfie atau gambar diri bot. Mode 'mirror' digunakan jika pengguna meminta outfit/pakaian (di cermin), mode 'direct' jika pengguna meminta foto close-up atau di lokasi tertentu secara langsung.",
                parameters: {
                    type: "object",
                    properties: {
                        context: { type: "string", description: "Deskripsi pose, pakaian, atau lokasi" },
                        mode: { type: "string", enum: ["mirror", "direct"], description: "Mode foto" }
                    },
                    required: ["context", "mode"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "save_memory",
                description: "Simpan fakta penting tentang pengguna agar bot mengingatnya di masa mendatang.",
                parameters: {
                    type: "object",
                    properties: {
                        fact: { type: "string", description: "Fakta penting tentang pengguna" },
                        event_date: { type: "string", description: "Tanggal kejadian (YYYY-MM-DD)" }
                    },
                    required: ["fact"]
                }
            }
        }
    ];

    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
            model: "mistral-large-latest",
            messages,
            tools,
            tool_choice: "auto"
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Mistral API Error: ${response.status} - ${errText}`);
    }

    return response.json();
}

// --- CLOUDFLARE WORKERS AI (REPLACING FAL.AI) ---
async function generateSelfieCF(prompt) {
    const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const cfApiToken = process.env.CLOUDFLARE_API_TOKEN;
    if (!cfAccountId || !cfApiToken) throw new Error("CLOUDFLARE_ACCOUNT_ID atau CLOUDFLARE_API_TOKEN tidak ada di environment.");

    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/@cf/bytedance/stable-diffusion-xl-lightning`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${cfApiToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompt: prompt })
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Cloudflare AI Error: ${text}`);
    }

    const buffer = await res.arrayBuffer();
    return buffer;
}

// --- MAIN PROCESSOR ---
async function processMessage(body) {
    if (!body.message || !body.message.text) {
        await logEvent('WARN', 'Webhook Message Ignored', 'Message body empty atau tidak berisi text.');
        return;
    }
    
    const chatId = body.message.chat.id;
    const text = body.message.text;
    const userId = body.message.from.id;

    await logEvent('INFO', 'Message Received', `Dari user ${userId}: "${text}"`, userId);

    try {
        await sendTelegram('sendChatAction', { chat_id: chatId, action: 'typing' });

        // 1. Registrasi & Ambil Persona
        await logEvent('INFO', 'Supabase Upsert User', `telegram_id: ${userId}`, userId);
        const { error: upsertErr } = await supabase.from('users').upsert({ telegram_id: userId }, { onConflict: 'telegram_id' });
        if (upsertErr) throw new Error(`Supabase Upsert Fail: ${upsertErr.message}`);
        
        let { data: persona } = await supabase.from('personas').select('*').eq('telegram_id', userId).single();
        
        let systemPrompt = "Kamu adalah Airish, AI companion yang ramah. Jawablah dengan bahasa Indonesia santai.";
        let refImage = DEFAULT_REF_IMAGE;

        if (persona) {
            systemPrompt = `Namamu adalah ${persona.name}. Sifatmu: ${persona.archetype}. Kerjaanmu: ${persona.craft}. 
Backstory: ${persona.backstory}. Lingkungan: ${persona.world_context}. 
Jawablah dengan bahasa Indonesia santai sesuai dengan sifatmu.`;
            if (persona.reference_image_url) refImage = persona.reference_image_url;
            await logEvent('INFO', 'Persona Loaded', `Menggunakan Persona: ${persona.name}`, userId);
        }

        // 2. Ambil Chat History
        const { data: history } = await supabase.from('chat_history')
            .select('*')
            .eq('telegram_id', userId)
            .order('created_at', { ascending: false })
            .limit(10);

        // Simpan pesan user
        await supabase.from('chat_history').insert({ telegram_id: userId, role: 'user', content: text });

        // 3. Panggil Mistral
        await logEvent('INFO', 'Mistral Request', `Mengirim request ke Mistral.`, userId);
        const mistralRes = await queryMistral(systemPrompt, history || [], text);
        const choice = mistralRes.choices?.[0];
        const message = choice?.message;

        // 4. Handle Tools
        if (message?.tool_calls && message.tool_calls.length > 0) {
            const toolCall = message.tool_calls[0];
            const callName = toolCall.function.name;
            const args = JSON.parse(toolCall.function.arguments);
            
            await logEvent('INFO', 'Mistral Tool Triggered', `Memanggil Tool: ${callName}`, userId);
            
            if (callName === 'generate_selfie') {
                await sendTelegram('sendMessage', { chat_id: chatId, text: "Bentar ya, aku fotokan dulu... 📸" });
                await sendTelegram('sendChatAction', { chat_id: chatId, action: 'upload_photo' });

                const context = args.context;
                // Modifikasi prompt untuk Text-to-Image karena CF tidak pakai reference image
                const prompt = args.mode === 'direct' 
                    ? `A close-up selfie of a beautiful Indonesian girl, ${context}, direct eye contact, fully visible face, high quality, photorealistic`
                    : `A mirror selfie of a beautiful Indonesian girl, ${context}, high quality, photorealistic`;

                try {
                    const imageBuffer = await generateSelfieCF(prompt);
                    const success = await sendTelegramPhotoBuffer(chatId, imageBuffer);

                    if (success) {
                        await supabase.from('chat_history').insert({ telegram_id: userId, role: 'assistant', content: "[Mengirim foto selfie]" });
                    } else {
                        await sendTelegram('sendMessage', { chat_id: chatId, text: "Aduh, koneksi ke Telegram putus saat mengirim foto." });
                    }
                } catch (error) {
                    await logEvent('ERROR', 'Generate Selfie CF Error', error.message, userId);
                    await sendTelegram('sendMessage', { chat_id: chatId, text: "Aduh, kamera aku lagi error nih." });
                }
            } 
            else if (callName === 'save_memory') {
                const fact = args.fact;
                await supabase.from('memories').insert({ telegram_id: userId, fact: fact, event_date: args.event_date || null });
                
                // Follow up to Mistral
                const toolResponseMessages = [
                    { role: 'system', content: systemPrompt },
                    ...(history || []).map((h) => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
                    { role: 'user', content: text },
                    message,
                    { role: 'tool', name: 'save_memory', tool_call_id: toolCall.id, content: JSON.stringify({ success: true }) }
                ];

                const url = process.env.MISTRAL_API_URL || "https://fatsproxyai.vercel.app/api/mistral";
                const apiKey = process.env.MISTRAL_API_KEY || "";
                const headers = { "Content-Type": "application/json" };
                if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

                const response = await fetch(url, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({ model: "mistral-large-latest", messages: toolResponseMessages })
                });

                if (response.ok) {
                    const followupData = await response.json();
                    const replyText = followupData.choices?.[0]?.message?.content || "Memori telah disimpan!";
                    await sendTelegram('sendMessage', { chat_id: chatId, text: replyText });
                    await supabase.from('chat_history').insert({ telegram_id: userId, role: 'assistant', content: replyText });
                } else {
                    await sendTelegram('sendMessage', { chat_id: chatId, text: "Fakta sudah kuingat ya!" });
                }
            }
        } else {
            const replyText = message?.content || "Maaf, aku tidak mengerti.";
            await sendTelegram('sendMessage', { chat_id: chatId, text: replyText });
            await supabase.from('chat_history').insert({ telegram_id: userId, role: 'assistant', content: replyText });
        }

    } catch (error) {
        await logEvent('ERROR', 'Process Message Exception', `Err: ${error.message}`, userId);
    }
}

// --- MAIN HANDLER ---
async function handler(event) {
    if (event.httpMethod === "OPTIONS") return optionsResponse();

    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (webhookSecret) {
        const receivedSecret = event.headers["x-telegram-bot-api-secret-token"] || (event.queryStringParameters && event.queryStringParameters.secret);
        if (receivedSecret !== webhookSecret) {
            return json(401, { ok: false, error: "Invalid webhook secret" });
        }
    }

    const body = readJson(event);
    await logEvent('INFO', 'Webhook Invoked', `Payload update_id: ${body.update_id}`);

    await processMessage(body);

    return json(200, { ok: true });
}

export default vercelHandler(handler);
