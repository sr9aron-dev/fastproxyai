import { generateWithRotation } from "./rotation.mjs";

/**
 * Sang Pencatat (The Chronicler)
 * Tugas: Memperbarui ringkasan cerita jangka panjang (Saga)
 */
export async function updateSaga(chatHistory, currentSaga, config) {
  try {
    const recentHistory = chatHistory.slice(-20).map(h => {
      const role = h.role === 'user' ? 'USER' : 'NAFEESA';
      const text = h.text || "[User mengirim foto]";
      return `${role}: ${text}`;
    }).join("\n");

    const prompt = `IDENTITAS:
- USER: Pengguna.
- NAFEESA: AI.

RINGKASAN SEJARAH SEBELUMNYA:
"${currentSaga || "Belum ada catatan sejarah."}"

PERCAKAPAN TERBARU:
${recentHistory}

TUGAS: 
1. Perbarui sejarah hubungan (Saga) secara naratif.
2. Identifikasi informasi baru tentang IDENTITAS USER (Nama, hobi, pekerjaan, dll).
3. Tentukan STATUS HUBUNGAN secara dinamis.
4. ANALISIS NARATIF: Cek apakah cerita stagnan/membosankan atau ada info profil user yang masih kosong. Berikan instruksi rahasia (directive) untuk Nafeesa agar cerita berkembang.

ATURAN STABILITAS HUBUNGAN:
- Hubungan serius (Istri, Tunangan, Budak Kontrak) bersifat SANGAT STABIL. Jangan mengubahnya hanya karena emosi sesaat (seperti marah kecil).
- Pertimbangkan sejarah panjang. Perubahan status "Mengikat" hanya boleh terjadi jika ada alasan rasional yang kuat dan konsisten dalam riwayat chat.
- Nafeesa memiliki harga diri dan kesetiaan. Jika sudah mengikat janji, dia akan berusaha mempertahankan status tersebut kecuali ada pengkhianatan atau konflik fatal.
- Status hubungan harus mencerminkan dinamika terbaru (maks 4 kata).
- Berikan output dalam format JSON:
{
  "updated_saga": "teks narasi sejarah...",
  "relationship_status": "deskripsi status saat ini...",
  "stagnation_level": 0.5, // 0.0 s/d 1.0 (seberapa membosankan/berulang chatnya)
  "narrative_directives": "Instruksi rahasia untuk Nafeesa (misal: 'Coba tanyakan hobi barunya' atau 'Bersikaplah sedikit dingin agar dia mengejarmu'). Kosongkan jika cerita sudah sangat berkembang.",
  "husband_identity": {
    "name": "...",
    "nickname": "...",
    "job": "...",
    "hobbies": ["..."],
    "birthday": "..."
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
