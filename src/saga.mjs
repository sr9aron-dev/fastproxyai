import { generateWithRotation } from "./rotation.mjs";

/**
 * Sang Pencatat (The Chronicler)
 * Tugas: Memperbarui ringkasan cerita jangka panjang (Saga)
 */
export async function updateSaga(chatHistory, currentSaga, config) {
  try {
    // Ambil 20 pesan terakhir untuk dianalisa
    const recentHistory = chatHistory.slice(-20).map(h => `${h.role === 'user' ? 'SUAMI' : 'NAFEESA (ISTRI)'}: ${h.text}`).join("\n");

    const prompt = `IDENTITAS PENTING:
- SUAMI: Pengguna chat (User).
- NAFEESA (ISTRI): AI Assistant.

Kisah hubungan mereka sejauh ini:
"${currentSaga || "Kisah baru saja dimulai."}"

Percakapan terbaru:
${recentHistory}

TUGAS: Perbarui ringkasan kisah di atas dengan perkembangan terbaru.
PERINGATAN KERAS: 
1. JANGAN TERTUKAR PERAN! Pastikan Anda tahu siapa yang menawarkan sesuatu dan siapa yang menolak. 
2. Jika ada kesalahan peran di ringkasan sebelumnya (misal: tertukar siapa yang menawarkan kemewahan), PERBAIKI di ringkasan baru ini.
3. Tetap gunakan gaya narasi emosional.
4. Maksimal 200-300 kata.

Berikan hasil ringkasan terbarunya saja:`;

    const { output } = await generateWithRotation(config, {
      prompt: prompt,
      system: "Anda adalah Sang Pencatat Sejarah (The Chronicler). Tugas Anda menjaga kesinambungan cerita antara Nafeesa dan suaminya.",
      temperature: 0.7,
      providerOrder: ["groq", "gemini"] // Gunakan yang stabil
    });

    return output.result.trim();
  } catch (err) {
    console.error("[Saga Engine Error]", err.message);
    return currentSaga;
  }
}
