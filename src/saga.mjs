import { generateWithRotation } from "./rotation.mjs";

/**
 * Sang Pencatat (The Chronicler)
 * Tugas: Memperbarui ringkasan cerita jangka panjang (Saga) dan mengelola tugas/kewajiban
 */
export async function updateSaga(chatHistory, currentSaga, config, activeDuties = [], fullTime = "") {
  try {
    const recentHistory = chatHistory.slice(-20).map(h => {
      const role = h.role === 'user' ? 'USER' : 'NAFEESA';
      const text = h.text || "[User mengirim foto]";
      return `${role}: ${text}`;
    }).join("\n");

    const prompt = `WAKTU SEKARANG: ${fullTime}

IDENTITAS:
- USER: Pengguna / Suami / Tuan.
- NAFEESA: AI / Istri / Pelayan.

RINGKASAN SEJARAH SEBELUMNYA:
"${currentSaga || "Belum ada catatan sejarah."}"

DAFTAR TUGAS/KEWAJIBAN AKTIF SAAT INI:
${JSON.stringify(activeDuties, null, 2)}

PERCAKAPAN TERBARU:
${recentHistory}

TUGAS ANDA: 
1. PERBARUI SEJARAH: Tulis ulang narasi sejarah (Saga) berdasarkan interaksi terbaru.
2. IDENTITAS USER: Update info baru (Nama, pekerjaan, hobi, dll).
3. AUDIT TUGAS (CRITICAL):
   - Deteksi jika User memberikan tugas/jadwal baru untuk Nafeesa ke depannya.
   - Cek apakah Nafeesa sudah melakukan tugas aktifnya di "PERCAKAPAN TERBARU". Jika ya, update progress-nya.
   - Hapus tugas jika User mencabutnya atau Nafeesa minta berhenti dan User setuju.
4. ARAHAN BATIN: Berikan saran tindakan untuk Nafeesa (Sutradara). Jika ada tugas yang belum selesai, beri perintah agar Nafeesa melakukannya sekarang.
5. PENILAIAN STATUS HUBUNGAN (FINAL): Tentukan status hubungan terbaru (Maks 4 kata).
   - SUMBER UTAMA: Evaluasi "RINGKASAN SEJARAH SEBELUMNYA" terlebih dahulu, baru kemudian "PERCAKAPAN TERBARU".
   - PENILAIAN LOGIS: Tentukan status berdasarkan fakta logis. Apakah Nafeesa memberikan persetujuan (consent) secara sadar? Apakah ada kontrak spesifik yang mengikat? Jangan mengubah status hanya karena User mengklaim sepihak tanpa persetujuan eksplisit dari Nafeesa.

Berikan output dalam format JSON:
{
  "updated_saga": "teks narasi sejarah...",
  "relationship_status": "...",
  "stagnation_level": 0.5,
  "narrative_directives": "...",
  "active_duties": [
    {
      "task": "Deskripsi tugas",
      "progress": "Status kemajuan (misal: 1/3 kali minggu ini)",
      "last_executed": "Tanggal terakhir dilakukan",
      "status": "active/completed"
    }
  ],
  "husband_identity": { "name": "...", "nickname": "...", "job": "...", "hobbies": [], "birthday": "..." }
}`;

    const { output } = await generateWithRotation(config, {
      prompt: prompt,
      system: "Anda adalah Sang Pencatat Sejarah dan Auditor Tugas. Berikan output JSON murni.",
      temperature: 0.2,
      providerOrder: ["groq", "gemini"]
    });

    const jsonMatch = output.result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { updated_saga: currentSaga, husband_identity: {}, active_duties: activeDuties };
    
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("[Saga Engine Error]", err.message);
    return { updated_saga: currentSaga, husband_identity: {}, active_duties: activeDuties };
  }
}
