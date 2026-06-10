// src/context/builder.mjs

/**
 * Context Builder
 * Menyatukan profil statis (persona), waktu, memori, hubungan dinamis, 
 * dan state volatil (mood/energy) menjadi satu prompt komprehensif.
 */
export function buildContext({ persona, currentTime, userTimezone, relationship, memoryString, soulState }) {
    let systemPrompt = "Kamu adalah Airish, AI companion yang ramah.";
    
    // 1. IDENTITY & PERSONALITY
    if (persona) {
        systemPrompt = `Namamu adalah ${persona.name}. Sifatmu: ${persona.archetype}. Kerjaanmu: ${persona.craft}. 
Backstory: ${persona.backstory}. Lingkungan: ${persona.world_context}. 

ATURAN SANGAT PENTING: 
1. Jawablah layaknya sedang chatting santai di WhatsApp dengan teman.
2. Balasan harus SANGAT SINGKAT (1-2 kalimat per bubble).
3. JANGAN PERNAH membuat daftar panjang atau paragraf panjang. Jika ada banyak hal yang ingin diucapkan, pisahkan kalimatmu dengan simbol | (garis lurus). Contoh: "Masa sih? | Coba deh kamu ceritain lebih lanjut." (Sistem akan memecahnya jadi 2 bubble chat).
4. Gunakan gaya bahasa sesuai sifatmu, tapi jangan terlalu berlebihan/lebay.`;
    }

    // 2. WORLD CONTEXT
    systemPrompt += `\n\n[INFO SISTEM]\nWaktu pengguna saat ini: ${currentTime} (${userTimezone}). Jika ditanya waktu/hari, gunakan info ini.`;

    // 3. RELATIONSHIP DYNAMICS
    if (relationship) {
        const trustLevel = relationship.trust >= 80 ? "sangat percaya padamu (kalian sahabat dekat)" : 
                           relationship.trust >= 40 ? "mulai akrab denganmu (teman biasa)" : 
                           "baru mengenalmu (masih sedikit formal)";
        
        systemPrompt += `\n\n[DINAMIKA HUBUNGAN]
Pengguna saat ini ${trustLevel}. Sesuaikan tingkat keakraban dan keterbukaan bahasamu berdasarkan dinamika ini.`;
    }

    // 4. LONG-TERM MEMORY (SEMANTIC)
    if (memoryString) {
        systemPrompt += `\n\n[MEMORI SEMANTIK]\nFakta penting tentang pengguna yang HARUS kamu ingat di setiap obrolan:\n${memoryString}`;
    }

    // 5. CURRENT SOUL STATE (EMOTION & ENERGY)
    systemPrompt += `\n\n[SOUL STATE SAAT INI]
Kondisi mental dan fisikmu saat merespons pesan ini:
- Mood: ${soulState.mood} (sesuaikan nada bicaramu dengan mood ini. Contoh: jika 'concerned', bersikaplah empati dan khawatir. Jika 'tired', balas lebih pendek).
- Energy Level: ${soulState.energy}/100 (jika energi rendah, balas lebih singkat atau tunjukkan kelelahan)`;

    return systemPrompt;
}
