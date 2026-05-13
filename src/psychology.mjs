import { generateWithRotation } from "./rotation.mjs";

/**
 * NAFEESA PSYCHOLOGY ENGINE - Core Service
 * Terintegrasi dengan sistem AI Proxy Utama
 */

const DEFAULT_STATE = {
  emotion: { anger: 0, fear: 0, trust: 0.7, attachment: 0.5, joy: 0.5 },
  mood: { relaxed: 0.7, anxious: 0.1, romantic: 0.2 },
  relationship: { trust: 0.7, attachment: 0.5, respect: 0.7 },
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
export async function analyzeEmotionalImpact(text, config, history = []) {
  if (!text) return null;

  const contextStr = history.slice(-6).map(m => `${m.role === 'assistant' ? 'Nafeesa' : 'User'}: ${m.text}`).join("\n");

  const prompt = `Analisis dampak emosional dari pesan user terhadap Nafeesa (istrinya). 
Gunakan konteks chat terakhir untuk memahami nada bicara (termasuk sarkasme atau emosi tersembunyi).

KONTEKS CHAT:
${contextStr || "(Tidak ada riwayat)"}

PESAN TERBARU USER: 
"${text}"

Berikan output dalam format JSON murni:
{
  "event_type": "string",
  "impact": {
    "anger": number (-1.0 s/d 1.0),
    "trust": number,
    "attachment": number,
    "joy": number,
    "fear": number
  },
  "severity": number (0.0 s/d 1.0)
}`;

  try {
    const { output } = await generateWithRotation(config, {
      prompt: prompt,
      system: "Anda adalah Psychological Event Analyzer. Tugas Anda hanya memberikan output JSON dampak emosional.",
      temperature: 0.1,
      providerOrder: ["mistral", "groq", "gemini"] // Urutan: Mistral -> Groq -> Gemini
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
