/**
 * NAFEESA PSYCHOLOGY ENGINE - Core Service
 */

export const MOOD_CATEGORIES = {
  POSITIVE: ["happy", "cheerful", "excited", "playful", "confident", "flirty", "affectionate", "caring", "grateful", "hopeful", "energetic", "proud", "inspired", "dreamy", "peaceful"],
  RELAXED: ["calm", "cozy", "sleepy", "lazy", "chill", "shy", "thoughtful", "nostalgic", "mellow", "soft"],
  SAD: ["sad", "lonely", "heartbroken", "disappointed", "insecure", "vulnerable", "depressed", "emotional", "sensitive"],
  ANGRY: ["angry", "irritated", "jealous", "frustrated", "annoyed", "aggressive", "defensive", "cold", "possessive", "bitter"],
  ROMANTIC: ["loving", "clingy", "seductive", "intimate", "passionate", "obsessed", "attached", "needy", "teasing"],
  SOCIAL: ["talkative", "curious", "friendly", "sarcastic", "humorous", "awkward", "chaotic"],
  DOMINANT: ["dominant", "independent", "ambitious", "serious", "mysterious", "elegant", "classy", "mature", "bossy", "fearless"],
  SEXUAL: ["horny", "aroused", "lustful"]
};

const DEFAULT_STATE = {
  emotion: { anger: 0, fear: 0, trust: 0.7, attachment: 0.5, joy: 0.5, arousal: 0 },
  mood: { relaxed: 0.7, anxious: 0.1, romantic: 0.2 },
  last_mood_tag: "stable",
  relationship: { trust: 0.7, attachment: 0.5, respect: 0.7 },
  inner_voice: ""
};

export function getInitialPsychology(personality = {}) {
  return {
    ...DEFAULT_STATE,
    personality: {
      openness: 0.5,
      conscientiousness: 0.5,
      extraversion: 0.5,
      agreeableness: 0.8,
      neuroticism: 0.3,
      ...personality
    }
  };
}

/**
 * Menganalisis pesan user untuk mendapatkan dampak emosional
 */
export async function analyzeEmotionalImpact(text, config, history = [], currentState = null) {
  if (!text) return null;

  const contextStr = history.slice(-12).map(m => `${m.role === 'assistant' ? 'Nafeesa' : 'User'}: ${m.text}`).join("\n");
  
  let stateInfo = "";
  if (currentState && currentState.emotion) {
    const e = currentState.emotion;
    const a = (e.anger || 0).toFixed(2);
    const t = (e.trust || 0).toFixed(2);
    const j = (e.joy || 0).toFixed(2);
    const att = (e.attachment || 0).toFixed(2);
    const ars = (e.arousal || 0).toFixed(2);
    stateInfo = `STATUS SAAT INI: Anger: ${a}, Trust: ${t}, Joy: ${j}, Attachment: ${att}, Arousal: ${ars}. Mood Terakhir: ${currentState.last_mood_tag || 'stable'}`;
  }

  const moodListStr = Object.entries(MOOD_CATEGORIES).map(([cat, tags]) => `${cat}: ${tags.join(", ")}`).join("\n");

  const prompt = `Analisis dampak emosional dari pesan user terhadap Nafeesa (istrinya).
Gunakan konteks chat dan status emosi saat ini.

${stateInfo}

PEDOMAN LOGIKA EMOSI:
1. KONTEKS ADALAH KUNCI: Bedakan antara "Caci Maki Kebencian" (merendahkan) dengan "Goda Kasar/Banter" (candaan akrab).
2. DAMPAK HINAAN JAHAT: Jika pesan murni menghina/menyakiti, Anger naik drastis, tapi Arousal dan Trust WAJIB turun.
3. DAMPAK GODAAN/BANTER: Jika pesan kasar tapi ada unsur gemas/seductive, Arousal bisa tetap tinggi atau naik.
4. HASRAT JUJUR: Nafeesa adalah istri yang setia, tapi dia punya harga diri. Jangan biarkan dia menjadi masokis kecuali ada konteks permainan (kink) yang jelas dari riwayat chat.

TUGAS KHUSUS: Pilih satu "mood_tag" yang paling menggambarkan perasaan Nafeesa saat ini dari daftar berikut:
${moodListStr}

TUGAS KATA HATI:
Buat "inner_voice" yang mencerminkan gejolak perasaan terdalamnya. Jika dia dihina, biarkan dia merasa terluka atau ingin melawan di dalam hatinya.

KONTEKS CHAT:
${contextStr || "(Tidak ada riwayat)"}

PESAN TERBARU USER: 
"${text}"

Berikan output JSON:
{
  "event_type": "string",
  "mood_tag": "string",
  "inner_voice": "string",
  "impact": {
    "anger": number,
    "trust": number,
    "attachment": number,
    "joy": number,
    "fear": number,
    "arousal": number
  },
  "severity": number
}`;

  try {
    const { generateWithRotation } = await import('./rotation.mjs');
    const { output } = await generateWithRotation(config, {
      prompt: prompt,
      system: "Anda adalah Psychological Event Analyzer. Tugas Anda hanya memberikan output JSON dampak emosional.",
      temperature: 0.2,
      providerOrder: ["groq", "gemini"]
    });

    const jsonMatch = output.result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("[Psychology] AI Analyzer Error", e.message);
    return null;
  }
}

/**
 * Mengupdate state berdasarkan impact dan personality modifier
 */
export function updatePsychology(state, impactEvent, hoursPassed = 0) {
  // Pastikan field lengkap
  if (!state.personality) state = { ...getInitialPsychology(), ...state };
  if (state.emotion.arousal === undefined) state.emotion.arousal = 0;

  const { personality, emotion, relationship, mood } = state;

  // 1. Emotional Decay Berdasarkan Waktu
  if (hoursPassed > 0) {
    const decayFactor = Math.pow(0.6, hoursPassed);
    emotion.anger *= decayFactor;
    emotion.fear *= decayFactor;
    emotion.joy *= decayFactor;
    emotion.arousal *= Math.pow(0.5, hoursPassed); // Arousal turun lebih cepat

    if (hoursPassed > 3) {
      emotion.anger = Math.min(emotion.anger, 0.1);
      state.inner_voice = "";
      state.last_mood_tag = "stable";
    }
  }

  if (!impactEvent || !impactEvent.impact) return state;

  const impact = impactEvent.impact;
  const severity = impactEvent.severity || 0.5;

  // 2. Personality Modifiers
  const angerGain = (1 + personality.neuroticism) * (1 - personality.agreeableness * 0.5);
  const trustGain = personality.agreeableness * (1 - personality.neuroticism * 0.3);

  // 3. Apply Emotion Updates
  for (const key in impact) {
    if (emotion[key] !== undefined) {
      let multiplier = 1.0;
      if (key === 'anger') multiplier = angerGain;
      if (key === 'trust') multiplier = trustGain;
      
      emotion[key] = Math.max(0, Math.min(1, emotion[key] + (impact[key] * multiplier * severity)));
    }
  }

  // 4. Update Mood Tag
  if (impactEvent.mood_tag) {
    state.last_mood_tag = impactEvent.mood_tag.toLowerCase();
  }

  // 5. Relationship Updates
  relationship.trust = Math.max(0, Math.min(1, relationship.trust + (impact.trust || 0) * 0.1));
  relationship.attachment = Math.max(0, Math.min(1, relationship.attachment + (impact.attachment || 0) * 0.1));

  // 6. Per-Message Decay
  emotion.anger *= 0.95;
  emotion.fear *= 0.97;
  emotion.joy *= 0.98;
  
  // 7. Mood Calculation (Legacy support & internal balance)
  mood.romantic = (emotion.attachment * 0.6) + (emotion.joy * 0.2) + (emotion.arousal * 0.2);
  mood.anxious = (emotion.fear * 0.6) + (emotion.anger * 0.4);
  mood.relaxed = 1 - mood.anxious;

  if (impactEvent.inner_voice) state.inner_voice = impactEvent.inner_voice;

  return state;
}

/**
 * Mengubah state menjadi narasi untuk System Prompt
 */
export function generatePsychologicalSummary(state) {
  const { emotion, relationship, mood, personality, last_mood_tag } = state;
  const displayMood = last_mood_tag || "stable";

  let summary = `[INTERNAL_PSYCHOLOGY_STATE]
Current Mood: ${displayMood.toUpperCase()} (${getMoodDescription(displayMood)})
Emotional Levels:
- Anger: ${getIntensity(emotion.anger)}
- Trust: ${getIntensity(emotion.trust)}
- Attachment: ${getIntensity(emotion.attachment)}
- Joy: ${getIntensity(emotion.joy)}
- Arousal/Lust: ${getIntensity(emotion.arousal)}

Behavioral Bias:
- Patience: ${getBehaviorValue(personality.agreeableness, emotion.anger)}
- Bond: ${getRelationshipText(relationship)}
`;

  if (state.inner_voice) {
    summary += `\n[KATA HATI / INSTING]: ${state.inner_voice}\n(PENTING: Ikuti bisikan hatimu ini!)`;
  }

  return summary;
}

function getIntensity(val) {
  if (val > 0.8) return "Very High";
  if (val > 0.6) return "High";
  if (val > 0.4) return "Moderate";
  if (val > 0.2) return "Low";
  return "Very Low";
}

function getMoodDescription(tag) {
  for (const [cat, tags] of Object.entries(MOOD_CATEGORIES)) {
    if (tags.includes(tag)) return `Category: ${cat}`;
  }
  return "Stable";
}

function getRelationshipText(rel) {
  if (rel.attachment > 0.8 && rel.trust > 0.8) return "Deeply in Love";
  if (rel.attachment > 0.6) return "Strongly Bonded";
  if (rel.trust < 0.4) return "Suspicious";
  return "Steady";
}

function getBehaviorValue(base, anger) {
  const val = base - (anger * 0.5);
  return getIntensity(val);
}

export async function analyzeSelfReflection(lastResponse, config, currentState) {
  const e = currentState.emotion;
  const isExtreme = e.anger > 0.8 || e.arousal > 0.7 || e.attachment > 0.8;
  
  if (!isExtreme) return null;

  const prompt = `Nafeesa baru saja membalas: "${lastResponse}"
Status: Anger: ${(e.anger || 0).toFixed(2)}, Arousal: ${(e.arousal || 0).toFixed(2)}, Attachment: ${(e.attachment || 0).toFixed(2)}.

Apakah Nafeesa punya "hasrat mendesak" tambahan (godaan, makian, atau manja spontan)? Berikan JSON { "inner_voice": "..." } atau {}.`;

  try {
    const { generateWithRotation } = await import('./rotation.mjs');
    const { output } = await generateWithRotation(config, {
      prompt: prompt,
      system: "Anda adalah Suara Hati Nafeesa.",
      temperature: 0.9, 
      providerOrder: ["groq", "gemini"]
    });

    const jsonMatch = output.result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]).inner_voice || null;
  } catch (err) {
    return null;
  }
}
