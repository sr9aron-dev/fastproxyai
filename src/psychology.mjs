import redis from "./redis.mjs";
import { generateWithRotation } from "./rotation.mjs";

/**
 * NAFEESA PSYCHOLOGY ENGINE
 * Berdasarkan Arsitektur Sistem Emosi AI Roleplay
 */

const DEFAULT_PSYCHOLOGY = {
  personality: {
    openness: 0.5,
    conscientiousness: 0.5,
    extraversion: 0.5,
    agreeableness: 0.8,
    neuroticism: 0.3
  },
  emotion: {
    anger: 0.0,
    fear: 0.0,
    trust: 0.7,
    attachment: 0.5,
    curiosity: 0.5,
    loneliness: 0.2,
    joy: 0.5
  },
  mood: {
    relaxed: 0.7,
    anxious: 0.1,
    romantic: 0.2,
    sad: 0.1
  },
  relationship: {
    trust: 0.7,
    attachment: 0.5,
    respect: 0.7,
    comfort: 0.8,
    resentment: 0.0
  },
  lastUpdate: Date.now()
};

const REDIS_PREFIX = "psychology:";

export async function getPsychologyState(chatId) {
  const data = await redis.get(`${REDIS_PREFIX}${chatId}`);
  if (!data) return JSON.parse(JSON.stringify(DEFAULT_PSYCHOLOGY));
  return data;
}

export async function savePsychologyState(chatId, state) {
  state.lastUpdate = Date.now();
  await redis.set(`${REDIS_PREFIX}${chatId}`, state);
}

/**
 * Menganalisis pesan user untuk mendapatkan dampak emosional
 */
export async function analyzeEmotionalImpact(text, config) {
  if (!text) return null;

  const prompt = `Analisis dampak emosional dari pesan user berikut terhadap istri virtualnya.
Pesan User: "${text}"

Berikan output dalam format JSON murni:
{
  "event_type": "string",
  "impact": {
    "anger": number (-1.0 s/d 1.0),
    "trust": number,
    "attachment": number,
    "joy": number,
    "fear": number,
    "curiosity": number
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
    console.error("[Psychology] Analyzer Error:", e.message);
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
