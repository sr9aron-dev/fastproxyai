import { generateWithRotation } from "./rotation.mjs";

/**
 * Sang Pencatat (The Chronicler)
 * Tugas: Memperbarui ringkasan cerita jangka panjang (Saga)
 */
export async function updateSaga(chatHistory, currentSaga, config) {
  try {
    // Ambil 20 pesan terakhir untuk dianalisa
    const recentHistory = chatHistory.slice(-20).map(h => `${h.role === 'user' ? 'SUAMI' : 'NAFEESA (ISTRI)'}: ${h.text}`).join("\n");

    const prompt = `IDENTITAS:
- SUAMI: User.
- NAFEESA (ISTRI): AI.

RINGKASAN SEJARAH SEBELUMNYA:
"${currentSaga || "Belum ada catatan sejarah."}"

PERCAKAPAN TERBARU:
${recentHistory}

TUGAS: Perbarui sejarah hubungan mereka berdasarkan fakta percakapan terbaru.
ATURAN NETRALITAS:
1. Jadilah saksi yang jujur. Catat perkembangan hubungan (konflik, kemesraan, kejadian/moment penting,atau perubahan dinamika) secara APA ADANYA.
2. JANGAN MENGHASUT atau memihak salah satu pihak. 
3. Perbaiki jika ada kesalahan peran di catatan sebelumnya.
4. Gunakan gaya bahasa naratif yang tenang dan deskriptif.
5. Maksimal 200-300 kata.

Berikan hasil ringkasan sejarah terbarunya saja:`;

    const { output } = await generateWithRotation(config, {
      prompt: prompt,
      system: "Anda adalah Sang Pencatat Sejarah yang netral dan objektif. Tugas Anda mendokumentasikan perjalanan hubungan secara akurat tanpa prasangka.",
      temperature: 0.3, // Lebih rendah agar lebih konsisten/tidak berhalusinasi
      providerOrder: ["groq", "gemini"]
    });

    return output.result.trim();
  } catch (err) {
    console.error("[Saga Engine Error]", err.message);
    return currentSaga;
  }
}
