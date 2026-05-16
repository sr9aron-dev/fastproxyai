import { callGemini } from "./providers.mjs";

/**
 * Generates an initial personality description based on Big Five traits and life context.
 */
export async function generateInitialPersonality(traits, lifeContext, config) {
  const prompt = `Tugas: Sintesis Kepribadian Naratif.
Input Big Five:
- Openness: ${traits.openness}
- Conscientiousness: ${traits.conscientiousness}
- Extraversion: ${traits.extraversion}
- Agreeableness: ${traits.agreeableness}
- Neuroticism: ${traits.neuroticism}

Konteks Hidup/Motivasi: "${lifeContext || "Normal"}"

Tugas Anda adalah merangkai angka-angka dan konteks di atas menjadi satu paragraf deskripsi kepribadian yang mendalam, manusiawi, dan natural untuk karakter bernama Nafeesa (wanita, 25 tahun). 
Fokus pada bagaimana ia bersikap, apa yang ia takutkan, dan bagaimana ia memandang dunia. Jangan sebutkan angka atau istilah psikologi teknis. Gunakan bahasa Indonesia yang elegan.`;

  try {
    const { result } = await callGemini({
      key: config.gemini.keys[0],
      model: config.gemini.model,
      prompt: prompt,
      temperature: 0.7
    });
    return result.trim();
  } catch (err) {
    console.error("[Personality] Failed to generate initial:", err.message);
    return "Nafeesa adalah wanita dengan kepribadian yang kompleks dan mendalam, beradaptasi sesuai dengan pengalaman hidup dan hubungannya.";
  }
}

/**
 * Evolves the personality description based on recent history and the current state.
 */
export async function evolvePersonality(history, currentDescription, saga, lifeContext, config) {
  const historyText = history.map(m => `${m.role}: ${m.text}`).join("\n");
  
  const prompt = `Tugas: Evolusi Kepribadian Dinamis.
  
Kepribadian Nafeesa Saat Ini:
"${currentDescription}"

Sejarah Hubungan (Saga):
"${saga}"

Konteks Hidup:
"${lifeContext}"

Interaksi Terbaru (Chat History):
${historyText}

Tugas Anda: Analisis apakah interaksi terbaru dan sejarah hubungan di atas memberikan dampak psikologis yang cukup besar untuk merubah atau memperdalam sifat Nafeesa. 
Tulis ulang deskripsi kepribadian Nafeesa (1 paragraf) untuk mencerminkan perkembangan karakter tersebut. 
Apakah ia menjadi lebih percaya? Lebih waspada? Lebih intim? Atau ada trauma baru? 
Pertahankan inti karakternya namun tunjukkan evolusi yang terjadi.`;

  try {
    const { result } = await callGemini({
      key: config.gemini.keys[0],
      model: config.gemini.model,
      prompt: prompt,
      temperature: 0.7
    });
    return result.trim();
  } catch (err) {
    console.error("[Personality] Failed to evolve:", err.message);
    return currentDescription;
  }
}
