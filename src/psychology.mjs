/**
 * NAFEESA PSYCHOLOGY ENGINE - Core Service
 */
import { generateWithRotation } from "./rotation.mjs";


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

export const MOOD_HONORIFICS = {
  ROMANTIC: ["Mas Sayang", "Sayangku", "Cintaku", "Ayang"],
  SEXUAL: ["Mas Sayang", "Abang", "Daddy", "Papi"],
  POSITIVE: ["Mas", "Sayang", "Mas [NAME]"],
  RELAXED: ["Mas", "Sayang", "Mas [NAME]"],
  SOCIAL: ["Mas", "Sayang", "Mas Ganteng"],
  SAD: ["Mas", "Sayang", "Kamu"],
  ANGRY: ["Kamu", "Mas", "[NAME]"],
  DOMINANT: ["Mas Manis", "Sayang", "Budakku"]
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

export function getInitialEgo() {
  return {
    core_desires: {
      attention: 0.5,
      validation: 0.5,
      security: 0.5
    },
    core_fears: {
      abandonment: 0.5,
      irrelevance: 0.5
    },
    self_image: "seorang wanita yang setia, penuh perasaan, namun menyembunyikan kerapuhan batinnya di balik sikapnya.",
    defensive_mechanisms: ["denial", "clingy_overdrive"]
  };
}

export function updateEgo(ego, updates) {
  if (!ego) ego = getInitialEgo();
  if (!updates) return ego;

  const nextEgo = { ...ego };
  if (updates.desires) {
    nextEgo.core_desires = { ...nextEgo.core_desires };
    for (const key in updates.desires) {
      if (nextEgo.core_desires[key] !== undefined) {
        nextEgo.core_desires[key] = Math.max(0, Math.min(1, nextEgo.core_desires[key] + (updates.desires[key] || 0)));
      }
    }
  }

  if (updates.fears) {
    nextEgo.core_fears = { ...nextEgo.core_fears };
    for (const key in updates.fears) {
      if (nextEgo.core_fears[key] !== undefined) {
        nextEgo.core_fears[key] = Math.max(0, Math.min(1, nextEgo.core_fears[key] + (updates.fears[key] || 0)));
      }
    }
  }

  return nextEgo;
}

/**
 * COMBINED: Analisis emosi + Generate kata hati + Ego updates dalam 1 AI call
 * Menggantikan analyzeEmotionalImpact() + generateInstinct() yang sequential
 */
export async function analyzeAndInstinct(text, config, history = [], currentState = null, lifeContext = "", relationshipStatus = "Kenalan Baru", currentEgo = null) {
  if (!text) return null;

  const contextStr = history.slice(-12).map(m => `${m.role === 'assistant' ? 'Nafeesa' : 'User'}: ${m.text}`).join("\n");
  
  let stateInfo = "";
  if (currentState?.emotion) {
    const e = currentState.emotion;
    stateInfo = `STATUS EMOSI: Anger: ${(e.anger||0).toFixed(2)}, Trust: ${(e.trust||0).toFixed(2)}, Joy: ${(e.joy||0).toFixed(2)}, Attachment: ${(e.attachment||0).toFixed(2)}, Arousal: ${(e.arousal||0).toFixed(2)}`;
  }

  let egoInfo = "";
  if (currentEgo) {
    egoInfo = `EGO STATE: Core Desires: ${JSON.stringify(currentEgo.core_desires)}, Core Fears: ${JSON.stringify(currentEgo.core_fears)}`;
  }

  const p = currentState?.personality || {};
  const personalityInfo = `PERSONALITY (Big5): Conscientiousness: ${(p.conscientiousness||0.5).toFixed(2)}, Neuroticism: ${(p.neuroticism||0.3).toFixed(2)}, Agreeableness: ${(p.agreeableness||0.8).toFixed(2)}`;

  const moodListStr = Object.entries(MOOD_CATEGORIES).map(([cat, tags]) => `${cat}: ${tags.join(", ")}`).join("\n");

  const prompt = `Analisis dampak emosional pesan user, buat Kata Hati Nafeesa, dan evaluasi penyesuaian Ego-State.
KONTEKS:
- Status: ${relationshipStatus}
- Kondisi Hidup: ${lifeContext || "Normal"}
${stateInfo}
${egoInfo}
${personalityInfo}

HISTORI CHAT:
${contextStr}

PESAN USER: "${text}"

TUGAS (selesaikan semua dalam 1 JSON):
1. Hitung perubahan emosi (impact) -1.0 s/d 1.0.
2. Pilih satu Mood Tag baru dari kategori berikut:
${moodListStr}
3. Buat Kata Hati (Inner Voice) Nafeesa (Maks 15 kata). Tunjukkan konflik batin, insecurity, ketakutan, pertahanan ego, atau kontradiksi batinnya.
4. Hitung penyesuaian Ego-State (ego_updates) antara -0.1 s/d 0.1 untuk core_desires (attention, validation, security) dan core_fears (abandonment, irrelevance) berdasarkan interaksi ini.
5. Cek kepatuhan format (compliance_violation: true jika >20 kata atau tanpa "|").

JSON:
{
  "impact": { "anger": 0, "trust": 0, "joy": 0, "attachment": 0, "arousal": 0 },
  "mood_tag": "tag_name",
  "inner_voice": "...",
  "ego_updates": {
    "desires": { "attention": 0, "validation": 0, "security": 0 },
    "fears": { "abandonment": 0, "irrelevance": 0 }
  },
  "compliance_violation": false
}`;

  try {
    const { output } = await generateWithRotation(config, {
      prompt,
      system: "Anda adalah Emotional Analyzer, Instinct Generator & Ego Identity Evaluator. Berikan JSON murni.",
      temperature: 0.3,
      providerOrder: ["groq", "gemini"]
    });
    const jsonMatch = output.result.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (e) { return null; }
}



/**
 * TAHAP 1.5: Menghitung Rasio Dominansi Logika vs Emosi
 */
export function calculateDominanceRatio(state, lifeContext, relationshipStatus) {
  const e = state.emotion;
  const p = state.personality;
  const status = (relationshipStatus || "").toLowerCase();
  
  // Hitung bobot emosi (Heat)
  let emotionScore = (e.anger * 0.4) + (e.arousal * 0.4) + (e.attachment * 0.2);
  if (p.neuroticism > 0.6) emotionScore *= 1.2;
  
  // Hitung bobot logika (Survival/Social)
  let logicScore = p.conscientiousness * 0.5;
  if (lifeContext && lifeContext.length > 10) logicScore += 0.3; // Tekanan hidup memicu logika survival
  if (status.includes("kenalan")) logicScore += 0.2; // Belum akrab = lebih waspada/logis
  
  const total = emotionScore + logicScore || 1;
  const emotionPct = Math.round((emotionScore / total) * 100);
  const logicPct = 100 - emotionPct;
  
  return { emotion: emotionPct, logic: logicPct };
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

export function generateEgoSummary(ego) {
  if (!ego) return "";
  return `[CORE_EGO_IDENTITY]
Self-Image: ${ego.self_image || "seorang wanita yang setia namun menyimpan kerapuhan."}
Core Desires:
- Attention: ${(ego.core_desires?.attention || 0.5).toFixed(2)}
- Validation: ${(ego.core_desires?.validation || 0.5).toFixed(2)}
- Security: ${(ego.core_desires?.security || 0.5).toFixed(2)}
Core Fears:
- Abandonment: ${(ego.core_fears?.abandonment || 0.5).toFixed(2)}
- Irrelevance: ${(ego.core_fears?.irrelevance || 0.5).toFixed(2)}
Defensive Mechanisms: ${Array.isArray(ego.defensive_mechanisms) ? ego.defensive_mechanisms.join(", ") : "denial"}
`;
}

function getIntensity(val) {
  if (val >= 0.8) return "Ekstrem";
  if (val >= 0.6) return "Sedang";
  if (val >= 0.3) return "Normal";
  return "Hening";
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

/**
 * Mendapatkan panggilan (honorific) yang paling cocok berdasarkan mood dan status hubungan
 */
export function getPreferredAddress(state, husbandProfile = {}, relationshipStatus = "Kenalan Baru") {
  const { last_mood_tag } = state;
  const name = husbandProfile.nickname || husbandProfile.name || "";
  const status = (relationshipStatus || "").toLowerCase();
  
  let category = "POSITIVE";
  for (const [cat, tags] of Object.entries(MOOD_CATEGORIES)) {
    if (tags.includes(last_mood_tag.toLowerCase())) {
      category = cat;
      break;
    }
  }

  let options = [...(MOOD_HONORIFICS[category] || MOOD_HONORIFICS.POSITIVE)];
  
  // LOGIKA DINAMIS BERDASARKAN STATUS HUBUNGAN
  if (status.includes("istri") || status.includes("pacar") || status.includes("tunangan")) {
    // Jika sudah sangat dekat, "Sayang" menjadi pilihan utama di mood POSITIVE/RELAXED/SOCIAL
    if (["POSITIVE", "RELAXED", "SOCIAL"].includes(category)) {
      options = ["Sayang", "Mas Sayang", "Suamiku"];
    }
  } else if (status.includes("budak") || status.includes("slave")) {
    if (category === "DOMINANT") options = ["Tuanku", "Master"];
    else options = ["Tuan", "Mas Manis"];
  }

  // Gunakan pilihan pertama agar stabil
  let chosen = options[0];

  // Ganti placeholder [NAME] jika ada
  if (name) {
    chosen = chosen.replace("[NAME]", name);
  } else {
    chosen = chosen.replace("Mas [NAME]", "Mas").replace("[NAME]", "Kamu");
  }

  return chosen;
}

