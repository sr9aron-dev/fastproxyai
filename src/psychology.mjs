import { generateWithRotation } from "./rotation.mjs";

/**
 * NAFEESA PSYCHOLOGY ENGINE - Core Service
 * Terintegrasi dengan sistem AI Proxy Utama
 */

const DEFAULT_STATE = {
  emotion: { anger: 0, fear: 0, trust: 0.7, attachment: 0.5, joy: 0.5 },
  mood: { relaxed: 0.7, anxious: 0.1, romantic: 0.2 },
  relationship: { trust: 0.7, attachment: 0.5, respect: 0.7 },
  inner_voice: "" // Bisikan hasrat insting Nafeesa
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
    stateInfo = `STATUS EMOSI SAAT INI: Anger: ${e.anger.toFixed(2)}, Trust: ${e.trust.toFixed(2)}, Joy: ${e.joy.toFixed(2)}, Fear: ${e.fear.toFixed(2)}, Attachment: ${e.attachment.toFixed(2)}`;
  }

  const prompt = `Analisis dampak emosional dari pesan user terhadap Nafeesa (istrinya). 
Gunakan konteks chat dan status emosi saat ini untuk memahami perasaan Nafeesa.

${stateInfo}

TUGAS TAMBAHAN (KATA HATI):
PENTING: Jika status emosi saat ini SUDAH EKSTREM (>0.8) atau pesan terbaru mendorong emosi ke titik ekstrem, Anda WAJIB membuat "Suara Hati" (inner_voice). Ini adalah bisikan insting/hasrat Nafeesa (misal: maki-maki jika Anger > 0.8, atau sangat manja jika Trust/Attachment > 0.8).

KONTEKS CHAT:
${contextStr || "(Tidak ada riwayat)"}

PESAN TERBARU USER: 
"${text}"

Berikan output dalam format JSON murni:
{
  "event_type": "string",
  "inner_voice": "string (bisikan insting/hasrat Nafeesa, kosongkan jika emosi normal)",
  "impact": {
    "anger": number,
    "trust": number,
    "attachment": number,
    "joy": number,
    "fear": number
  },
  "severity": number
}`;

  try {
    const { output } = await generateWithRotation(config, {
      prompt: prompt,
      system: "Anda adalah Psychological Event Analyzer. Tugas Anda hanya memberikan output JSON dampak emosional.",
      temperature: 0.1,
      providerOrder: ["groq", "gemini"] // Prioritas Groq (Llama 4 Scout) -> Gemini
    });

    // Robust JSON extraction
    const jsonMatch = output.result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[Psychology] No JSON found in response:", output.result);
      return null;
    }
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("[Psychology] AI Analyzer Error, falling back to keywords...");
    
    // Simple Keyword Fallback (Darurat jika API Mati)
    const lower = text.toLowerCase();
    if (lower.includes("sayang") || lower.includes("cinta") || lower.includes("makasih") || lower.includes("terima kasih")) {
      return { event_type: "affection", impact: { trust: 0.05, attachment: 0.08, joy: 0.1, anger: -0.05 }, severity: 0.5 };
    }
    if (lower.includes("anjing") || lower.includes("bangsat") || lower.includes("goblok") || lower.includes("tolol")) {
      return { 
        event_type: "insult_extreme", 
        inner_voice: "Dia benar-benar merendahkanmu. Jangan diam saja, panggil dia anjing atau tunjukkan amarahmu yang paling meledak!",
        impact: { anger: 0.3, trust: -0.2, attachment: -0.1 }, 
        severity: 0.9 
      };
    }
    if (lower.includes("bodoh") || lower.includes("jelek") || lower.includes("berisik") || lower.includes("diem") || lower.includes("benci")) {
      return { event_type: "insult", impact: { anger: 0.15, trust: -0.1, attachment: -0.05, joy: -0.1 }, severity: 0.7 };
    }
    if (lower.includes("maaf") || lower.includes("sorry")) {
      return { event_type: "apology", impact: { anger: -0.15, trust: 0.05 }, severity: 0.6 };
    }
    
    return null;
  }
}

/**
 * Mengupdate state berdasarkan impact dan personality modifier
 */
export function updatePsychology(state, impactEvent) {
  if (!impactEvent || !impactEvent.impact) return state;

  const { personality, emotion, relationship, mood } = state;
  const impact = impactEvent.impact;
  const severity = impactEvent.severity || 0.5;

  // 1. Personality Modifiers
  const angerGain = (1 + personality.neuroticism) * (1 - personality.agreeableness * 0.5);
  const trustGain = personality.agreeableness * (1 - personality.neuroticism * 0.3);

  // 2. Apply Emotion Updates
  for (const key in impact) {
    if (emotion[key] !== undefined) {
      let multiplier = 1.0;
      if (key === 'anger') multiplier = angerGain;
      if (key === 'trust') multiplier = trustGain;
      
      emotion[key] = Math.max(0, Math.min(1, emotion[key] + (impact[key] * multiplier * severity)));
    }
  }

  // 3. Relationship Updates (Slower)
  relationship.trust = Math.max(0, Math.min(1, relationship.trust + (impact.trust || 0) * 0.1));
  relationship.attachment = Math.max(0, Math.min(1, relationship.attachment + (impact.attachment || 0) * 0.1));

  // 4. Emotional Decay (Mendingin seiring waktu/pesan)
  emotion.anger *= 0.95;
  emotion.fear *= 0.97;
  emotion.joy *= 0.98;
  
  // 5. Mood Calculation (Simple average of recent emotions)
  mood.romantic = (emotion.attachment * 0.7) + (emotion.joy * 0.3);
  mood.anxious = (emotion.fear * 0.6) + (emotion.anger * 0.4);
  mood.relaxed = 1 - mood.anxious;

  // 6. Update Inner Voice (Suara Hati)
  if (impactEvent.inner_voice) {
    state.inner_voice = impactEvent.inner_voice;
  } else {
    // Reset jika tidak ada dampak ekstrem baru agar tidak terjebak di satu hasutan
    state.inner_voice = "";
  }

  return state;
}

/**
 * Mengubah state menjadi narasi untuk System Prompt
 */
export function generatePsychologicalSummary(state) {
  const { emotion, relationship, mood, personality } = state;

  let summary = `[INTERNAL_PSYCHOLOGY_STATE]
Current Mood: ${getMoodText(mood)}
Emotional State:
- Anger: ${getIntensity(emotion.anger)}
- Trust: ${getIntensity(emotion.trust)}
- Attachment: ${getIntensity(emotion.attachment)}
- Joy: ${getIntensity(emotion.joy)}

Relationship Status:
- Bond: ${getRelationshipText(relationship)}

Behavioral Bias:
- Patience: ${getBehaviorValue(personality.agreeableness, emotion.anger)}
- Affection: ${getBehaviorValue(relationship.attachment, emotion.anger)}
- Sarcasm Bias: ${emotion.anger > 0.5 ? "High" : "Low"}
`;

  // 4. Inner Voice (Hasutan Insting)
  if (state.inner_voice) {
    summary += `\n[KATA HATI / INSTING]: ${state.inner_voice}\n(Tinggalkan semua keraguan, ikuti bisikan hatimu ini dalam merespon suami!)`;
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

function getMoodText(mood) {
  if (mood.romantic > 0.7) return "Very Romantic & Clingy";
  if (mood.anxious > 0.6) return "Anxious & Distant";
  if (mood.relaxed > 0.7) return "Relaxed & Happy";
  return "Stable";
}

function getRelationshipText(rel) {
  if (rel.attachment > 0.8 && rel.trust > 0.8) return "Deeply in Love & Secure";
  if (rel.attachment > 0.6) return "Strongly Bonded";
  if (rel.trust < 0.4) return "Suspicious / Hurting";
  return "Steady";
}

function getBehaviorValue(base, anger) {
  const val = base - (anger * 0.5);
  return getIntensity(val);
}

/**
 * Menganalisa perasaan Nafeesa setelah dia sendiri bicara (Self-Reflection)
 */
export async function analyzeSelfReflection(lastResponse, config, currentState) {
  // Hanya aktif jika emosi ekstrem (>0.8)
  const e = currentState.emotion;
  const isExtreme = e.anger > 0.8 || e.trust > 0.8 || e.attachment > 0.8 || e.fear > 0.8 || e.joy > 0.8;
  
  if (!isExtreme) return null;

  const prompt = `Nafeesa baru saja membalas chat suaminya dengan kalimat: "${lastResponse}"
Status Emosi Nafeesa Saat Ini: Anger: ${e.anger.toFixed(2)}, Trust: ${e.trust.toFixed(2)}, Joy: ${e.joy.toFixed(2)}, Fear: ${e.fear.toFixed(2)}.

Tugas: Berdasarkan emosi ekstrem tersebut, apakah Nafeesa punya "pesan tambahan" atau "hasrat mendesak" yang ingin dia katakan secara spontan setelah pesan pertamanya tadi?
Jika ya, berikan JSON:
{ "inner_voice": "hasutan insting untuk pesan kedua (misal: tambahan makian, tambahan godaan, atau ungkapan sayang spontan)" }
Jika tidak ada hal mendesak, berikan JSON kosong {}.`;

  try {
    const { generateWithRotation } = await import('./rotation.mjs');
    const { output } = await generateWithRotation(config, {
      prompt: prompt,
      system: "Anda adalah Suara Hati Nafeesa. Berikan hasutan tambahan jika emosinya sangat kuat.",
      temperature: 0.9, 
      providerOrder: ["groq", "gemini"]
    });

    const jsonMatch = output.result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const res = JSON.parse(jsonMatch[0]);
    return res.inner_voice || null;
  } catch (err) {
    console.error("[Self-Reflection Error]", err.message);
    return null;
  }
}
