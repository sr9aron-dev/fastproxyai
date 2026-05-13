import { generateWithRotation } from "./rotation.mjs";

/**
 * Sang Pencatat (The Chronicler)
 * Tugas: Memperbarui ringkasan cerita jangka panjang (Saga)
 */
export async function updateSaga(chatHistory, currentSaga, config) {
  try {
    // Ambil 20 pesan terakhir untuk dianalisa
    const recentHistory = chatHistory.slice(-20).map(h => `${h.role}: ${h.text}`).join("\n");
    
    const prompt = `Ini adalah ringkasan kisah hubungan mereka sejauh ini:
"${currentSaga || "Kisah baru saja dimulai."}"

Berikut adalah percakapan terbaru mereka:
${recentHistory}

Tugas: Perbarui ringkasan kisah di atas dengan menyertakan perkembangan penting dari percakapan terbaru.
Aturan:
1. Tetap gunakan gaya narasi yang mendalam dan emosional.
2. Pertahankan detail penting (nama, kejadian besar, janji).
3. Buang detail kecil yang tidak relevan untuk ingatan jangka panjang.
4. Jangan terlalu panjang, maksimal 300-500 kata.
5. Fokus pada perkembangan hubungan (apakah makin dekat, menjauh, atau ada konflik baru).

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
