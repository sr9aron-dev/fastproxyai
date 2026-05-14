import { generateWithRotation } from "./rotation.mjs";

/**
 * Sang Pencatat (The Chronicler)
 * Tugas: Memperbarui ringkasan cerita jangka panjang (Saga)
 */
export async function updateSaga(chatHistory, currentSaga, config) {
  try {
    const recentHistory = chatHistory.slice(-20).map(h => `${h.role === 'user' ? 'SUAMI' : 'NAFEESA (ISTRI)'}: ${h.text}`).join("\n");

    const prompt = `IDENTITAS:
- SUAMI: User.
- NAFEESA (ISTRI): AI.

RINGKASAN SEJARAH SEBELUMNYA:
"${currentSaga || "Belum ada catatan sejarah."}"

PERCAKAPAN TERBARU:
${recentHistory}

TUGAS: 
1. Perbarui sejarah hubungan (Saga) secara naratif.
2. Identifikasi informasi baru tentang IDENTITAS SUAMI (Nama Lengkap, Panggilan, Pekerjaan, Hobi, Tanggal Lahir).

ATURAN:
- Gunakan gaya bahasa naratif yang tenang untuk Saga.
- Berikan output dalam format JSON:
{
  "updated_saga": "teks narasi sejarah...",
  "husband_identity": {
    "name": "nama lengkap jika ada",
    "nickname": "panggilan jika ada",
    "job": "pekerjaan jika ada",
    "hobbies": ["hobi1", "hobi2"],
    "birthday": "tanggal lahir jika ada"
  }
}`;

    const { output } = await generateWithRotation(config, {
      prompt: prompt,
      system: "Anda adalah Sang Pencatat Sejarah dan Profiler Identitas. Berikan output JSON murni.",
      temperature: 0.2,
      providerOrder: ["groq", "gemini"]
    });

    const jsonMatch = output.result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { updated_saga: currentSaga, husband_identity: {} };
    
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("[Saga Engine Error]", err.message);
    return { updated_saga: currentSaga, husband_identity: {} };
  }
}
