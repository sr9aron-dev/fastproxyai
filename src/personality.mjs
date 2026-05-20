import { generateWithRotation } from "./rotation.mjs";

/**
 * Generates an initial personality description based on Big Five traits and life context.
 */
export async function generateInitialPersonality(traits, lifeContext, config) {
  const prompt = `Tugas: Sintesis Kepribadian Naratif Singkat.
Input Big Five (0-1): O:${traits.openness}, C:${traits.conscientiousness}, E:${traits.extraversion}, A:${traits.agreeableness}, N:${traits.neuroticism}
Konteks: "${lifeContext || "Normal"}"

Tugas: Buat profil kepribadian Nafeesa dalam MAKSIMAL 30 KATA. 
Fokus HANYA pada sifat, temperamen, dan gaya interaksi. 
JANGAN sebutkan nama, umur, jenis kelamin, atau angka Big Five. 
Contoh: "Wanita yang ceria namun menyimpan kecemasan mendalam, sangat protektif terhadap privasi namun lembut jika sudah merasa aman."`;

  try {
    const { output } = await generateWithRotation(config, {
      prompt: prompt,
      temperature: 0.7,
      providerOrder: ["gemini", "groq"]
    });
    return output.result.trim().replace(/^"|"$/g, "");
  } catch (err) {
    console.error("[Personality] Failed to generate initial:", err.message);
    return "Ceria, setia, namun sedikit sensitif dan butuh validasi emosional.";
  }
}

/**
 * Evolves the personality description based on recent history and the current state.
 */
export async function evolvePersonality(history, currentDescription, saga, lifeContext, config) {
  const historyText = history.map(m => `${m.role}: ${m.text}`).join("\n");
  
  const prompt = `Tugas: Evolusi Kepribadian Dinamis Singkat.
Profil Saat Ini: "${currentDescription}"
Konteks Hidup: "${lifeContext}"
Interaksi Terbaru:
${historyText}

Tugas: Perbarui profil kepribadian di atas (MAKSIMAL 30 KATA) jika ada perkembangan sifat dari interaksi terbaru.
JANGAN sebutkan identitas dasar (nama/umur). Fokus pada perubahan temperamen atau kedekatan emosional.
Output harus berupa satu paragraf pendek dan padat.`;

  try {
    const { output } = await generateWithRotation(config, {
      prompt: prompt,
      temperature: 0.7,
      providerOrder: ["gemini", "groq"]
    });
    return output.result.trim().replace(/^"|"$/g, "");
  } catch (err) {
    console.error("[Personality] Failed to evolve:", err.message);
    return currentDescription;
  }
}
