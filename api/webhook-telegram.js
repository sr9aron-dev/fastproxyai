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
function formatTelegramHTML(text) {
    if (!text) return text;
    let html = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html = html.replace(/\*\*([\s\S]*?)\*\*/g, '<b>$1</b>');
    html = html.replace(/\*([\s\S]*?)\*/g, '<i>$1</i>');
    html = html.replace(/__([\s\S]*?)__/g, '<u>$1</u>');
    html = html.replace(/(^|\s)_([\s\S]*?)_(\s|$)/g, '$1<i>$2</i>$3');
    html = html.replace(/`([\s\S]*?)`/g, '<code>$1</code>');
    return html;
}

async function sendTelegram(method, payload) {
    if (method === 'sendMessage' && payload.text && !payload.parse_mode) {
        payload.text = formatTelegramHTML(payload.text);
        payload.parse_mode = 'HTML';
    }
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

const AI_TOOLS = [
    {
        type: "function",
        function: {
            name: "generate_photo",
            description: "HANYA panggil alat ini JIKA DAN HANYA JIKA pengguna secara eksplisit meminta foto dirimu, meminta selfie, pap, atau ingin melihat pakaian/bagian tubuhmu (seperti sepatu, kaki, full body, dll).",
            parameters: {
                type: "object",
                properties: {
                    image_prompt: { type: "string", description: "Instruksi gambar dalam bahasa Inggris untuk AI Image Generator. Contoh: 'A photorealistic close-up selfie of this person smiling', atau 'A photo of this person\\'s feet wearing new sneakers', atau 'A full body mirror selfie of this person'. Selalu gunakan kata 'this person' agar AI mengenali wajah aslimu." }
                },
                required: ["image_prompt"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "save_memory",
            description: "HANYA panggil alat ini JIKA pengguna memberikan informasi atau fakta baru yang penting tentang diri mereka yang harus kamu ingat (misalnya: nama hewan peliharaan, ulang tahun, kesukaan, dll).",
            parameters: {
                type: "object",
                properties: {
                    fact: { type: "string", description: "Fakta penting tentang pengguna yang harus disimpan." },
                    event_date: { type: "string", description: "Tanggal kejadian (YYYY-MM-DD) jika disebutkan. Jika tidak, kosongkan saja." }
                },
                required: ["fact"]
            }
        }
    }
];

// --- MISTRAL AI ---
async function queryMistral(systemPrompt, history, userMessage, toolResponseMessages = null) {
    const url = process.env.MISTRAL_API_URL || "https://fatsproxyai.vercel.app/api/mistral";
    const apiKey = process.env.MISTRAL_API_KEY || ""; 

    let messages = toolResponseMessages;
    if (!messages) {
        messages = [
            { role: 'system', content: systemPrompt },
            ...history.map(h => ({
                role: h.role === 'user' ? 'user' : 'assistant',
                content: h.content
            })),
            { role: 'user', content: userMessage }
        ];
    }

    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const body = {
        model: "mistral-large-latest",
        messages,
    };
    if (!toolResponseMessages) {
        body.tools = AI_TOOLS;
        body.tool_choice = "auto";
    }

    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`Mistral Error: ${response.status} - ${await response.text()}`);
    return response.json();
}

// --- QWEN TEXT AI ---
async function queryQwen(systemPrompt, history, userMessage, toolResponseMessages = null) {
    const apiKey = process.env.QWEN_API_KEY || 'sk-ws-H.ILHDHP.fakn.MEYCIQDGQZgkorFTHh9mN1IlzQTeZ8zRIs6mpfQd9UiznuGVOgIhAKIPOHid-8zDdxd5uk0Fpz70IajHWahhfqgiFvq6NL1m';
    const url = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions";

    let messages = toolResponseMessages;
    if (!messages) {
        messages = [
            { role: 'system', content: systemPrompt },
            ...history.map(h => ({
                role: h.role === 'user' ? 'user' : 'assistant',
                content: h.content
            })),
            { role: 'user', content: userMessage }
        ];
    }

    const body = {
        model: "qwen-plus",
        messages,
    };
    if (!toolResponseMessages) {
        body.tools = AI_TOOLS;
        body.tool_choice = "auto";
    }

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`Qwen Text Error: ${response.status} - ${await response.text()}`);
    return response.json();
}

// --- AI FALLBACK SYSTEM ---
async function queryLLMWithFallback(systemPrompt, history, userMessage, toolResponseMessages = null) {
    try {
        await logEvent('INFO', 'AI Request', `Mengirim request ke Qwen Plus.`);
        return await queryQwen(systemPrompt, history, userMessage, toolResponseMessages);
    } catch (error) {
        await logEvent('WARN', 'Qwen Failed, Fallback to Mistral', error.message);
        return await queryMistral(systemPrompt, history, userMessage, toolResponseMessages);
    }
}

// --- QWEN IMAGE AI (ALIBABA DASHSCOPE) ---
async function generateQwenImage(prompt) {
    const apiKey = process.env.QWEN_API_KEY || 'sk-ws-H.ILHDHP.fakn.MEYCIQDGQZgkorFTHh9mN1IlzQTeZ8zRIs6mpfQd9UiznuGVOgIhAKIPOHid-8zDdxd5uk0Fpz70IajHWahhfqgiFvq6NL1m';
    const host = 'https://ws-9eq65lbzoayak8np.ap-southeast-1.maas.aliyuncs.com';
    const endpoint = `${host}/api/v1/services/aigc/multimodal-generation/generation`;
    const refImageUrl = 'https://fatsproxyai.vercel.app/airish.jpg';

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "qwen-image-edit",
            input: {
                messages: [
                    {
                        role: "user",
                        content: [
                            { image: refImageUrl },
                            { text: prompt }
                        ]
                    }
                ]
            },
            parameters: {
                size: "1024*1024",
                n: 1
            }
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Qwen AI Error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const results = data.output?.choices || data.output?.results;
    if (results && results.length > 0) {
        const content = results[0].message?.content;
        let imageUrl = null;
        
        if (Array.isArray(content)) {
            const imgBlock = content.find(c => c.image);
            if (imgBlock) imageUrl = imgBlock.image;
        }

        if (imageUrl) {
            const imgRes = await fetch(imageUrl);
            if (!imgRes.ok) throw new Error("Failed to download generated image from Qwen");
            return await imgRes.arrayBuffer();
        }
    }
    throw new Error("Gambar tidak ditemukan di dalam respons Qwen");
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

        // 1. Registrasi & Ambil Data User (Timezone)
        await logEvent('INFO', 'Supabase Fetch User', `telegram_id: ${userId}`, userId);
        let { data: userData } = await supabase.from('users').select('*').eq('telegram_id', userId).single();
        if (!userData) {
            const { data: newUser } = await supabase.from('users').insert({ telegram_id: userId }).select().single();
            userData = newUser || { timezone: 'Asia/Jakarta' };
        }
        
        const userTimezone = userData.timezone || 'Asia/Jakarta';
        const currentTime = new Date().toLocaleString('id-ID', { 
            timeZone: userTimezone, 
            dateStyle: 'full', 
            timeStyle: 'short' 
        });
        
        let { data: persona } = await supabase.from('personas').select('*').eq('telegram_id', userId).single();
        
        let systemPrompt = "Kamu adalah Airish, AI companion yang ramah. PENTING: Jawablah layaknya sedang chatting di WhatsApp. Balas dengan SANGAT SINGKAT (maksimal 1-3 kalimat pendek), natural, dan JANGAN PERNAH membuat list/bullet points. Gunakan bahasa Indonesia santai.";
        let refImage = DEFAULT_REF_IMAGE;

        if (persona) {
            systemPrompt = `Namamu adalah ${persona.name}. Sifatmu: ${persona.archetype}. Kerjaanmu: ${persona.craft}. 
Backstory: ${persona.backstory}. Lingkungan: ${persona.world_context}. 

ATURAN SANGAT PENTING: 
1. Jawablah layaknya sedang chatting santai di WhatsApp dengan teman.
2. Balasan harus SANGAT SINGKAT dan natural (maksimal 1-3 kalimat pendek).
3. JANGAN PERNAH membuat daftar (list) atau bullet points.
4. Gunakan gaya bahasa sesuai sifatmu, tapi jangan terlalu berlebihan/lebay.`;
            if (persona.reference_image_url) refImage = persona.reference_image_url;
            await logEvent('INFO', 'Persona Loaded', `Menggunakan Persona: ${persona.name}`, userId);
        }

        // Tambahkan konteks waktu ke bot
        systemPrompt += `\n\n[INFO SISTEM]\nWaktu pengguna saat ini: ${currentTime} (${userTimezone}). Jika ditanya waktu/hari, gunakan info ini.`;

        // 2. Ambil Chat History & Long Term Memory
        const { data: history } = await supabase.from('chat_history')
            .select('*')
            .eq('telegram_id', userId)
            .order('created_at', { ascending: false })
            .limit(10);

        const { data: memories } = await supabase.from('memories')
            .select('fact, event_date')
            .eq('telegram_id', userId);
        
        if (memories && memories.length > 0) {
            const memoryString = memories.map(m => `- ${m.fact}${m.event_date ? ' (' + m.event_date + ')' : ''}`).join('\n');
            systemPrompt += `\n\nFakta penting tentang pengguna yang HARUS kamu ingat di setiap obrolan:\n${memoryString}`;
        }

        // Simpan pesan user
        await supabase.from('chat_history').insert({ telegram_id: userId, role: 'user', content: text });

        // 3. Panggil AI (Qwen with Mistral Fallback)
        const aiRes = await queryLLMWithFallback(systemPrompt, history || [], text);
        const choice = aiRes.choices?.[0];
        const message = choice?.message;

        // 4. Handle Tools
        if (message?.tool_calls && message.tool_calls.length > 0) {
            const toolCall = message.tool_calls[0];
            const callName = toolCall.function.name;
            const args = JSON.parse(toolCall.function.arguments);
            
            await logEvent('INFO', 'AI Tool Triggered', `Memanggil Tool: ${callName}`, userId);
            
            if (callName === 'generate_photo' || callName === 'generate_selfie') {
                await sendTelegram('sendMessage', { chat_id: chatId, text: "Bentar ya, aku fotokan dulu... 📸" });
                await sendTelegram('sendChatAction', { chat_id: chatId, action: 'upload_photo' });

                // Jika AI lama masih pakai args.context, kita beri fallback. Jika pakai image_prompt, gunakan itu.
                let prompt = args.image_prompt;
                if (!prompt) {
                    const context = args.context || 'casual';
                    prompt = args.mode === 'direct' 
                        ? `Create a photorealistic close-up selfie of this person. ${context}. Direct eye contact, fully visible face, highly detailed.`
                        : `Create a photorealistic mirror selfie of this person. ${context}. Highly detailed.`;
                }

                try {
                    const imageBuffer = await generateQwenImage(prompt);
                    const success = await sendTelegramPhotoBuffer(chatId, imageBuffer);

                    if (success) {
                        await supabase.from('chat_history').insert({ telegram_id: userId, role: 'assistant', content: "[Mengirim foto selfie]" });
                    } else {
                        await sendTelegram('sendMessage', { chat_id: chatId, text: "Aduh, koneksi ke Telegram putus saat mengirim foto." });
                    }
                } catch (error) {
                    await logEvent('ERROR', 'Generate Selfie Error', error.message, userId);
                    await sendTelegram('sendMessage', { chat_id: chatId, text: "Aduh, kamera aku lagi error nih." });
                }
            } 
            else if (callName === 'save_memory') {
                const fact = args.fact;
                await supabase.from('memories').insert({ telegram_id: userId, fact: fact, event_date: args.event_date || null });
                
                // Follow up to AI
                const toolResponseMessages = [
                    { role: 'system', content: systemPrompt },
                    ...(history || []).map((h) => ({ role: h.role === 'user' ? 'user' : 'assistant', content: h.content })),
                    { role: 'user', content: text },
                    message,
                    { role: 'tool', name: 'save_memory', tool_call_id: toolCall.id, content: JSON.stringify({ success: true }) }
                ];

                try {
                    const followupData = await queryLLMWithFallback(systemPrompt, null, null, toolResponseMessages);
                    const replyText = followupData.choices?.[0]?.message?.content || "Memori telah disimpan!";
                    await sendTelegram('sendMessage', { chat_id: chatId, text: replyText });
                    await supabase.from('chat_history').insert({ telegram_id: userId, role: 'assistant', content: replyText });
                } catch (e) {
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
