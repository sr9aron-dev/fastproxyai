import { adobeCategories } from "./prompt.mjs";

function stripCodeFence(text) {
  return String(text || "")
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function extractJson(text) {
  const cleaned = stripCodeFence(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("Provider returned invalid JSON");
  }
}

function normalizeCategory(value) {
  const lower = String(value || "").toLowerCase().trim();
  return adobeCategories.includes(lower) ? lower : "business";
}

function normalizeKeywords(value, settings = {}) {
  const maxKeywords = Number(settings.keywordCount || settings.maxKeywordsNum || 49);
  const raw = Array.isArray(value) ? value : String(value || "").split(",");
  
  const rawRemove = Array.isArray(settings.removeKeywords) ? settings.removeKeywords : String(settings.removeKeywords || "").split(",");
  const removeSet = new Set(
    rawRemove.map(k => String(k).toLowerCase().replace(/\s+/g, " ").trim()).filter(Boolean)
  );

  const seen = new Set();
  const initialKeywords = [];
  
  // 1. Filter out duplicates and removeKeywords
  for (const item of raw) {
    const keyword = String(item).toLowerCase().replace(/\s+/g, " ").trim();
    if (!keyword || removeSet.has(keyword) || seen.has(keyword)) continue;
    seen.add(keyword);
    initialKeywords.push(keyword);
  }

  // 2. Add addKeywords
  const rawAdd = Array.isArray(settings.addKeywords) ? settings.addKeywords : String(settings.addKeywords || "").split(",");
  const addKeywords = rawAdd
    .map(k => String(k).toLowerCase().replace(/\s+/g, " ").trim())
    .filter(k => k && !seen.has(k));

  let combined = [];
  if (addKeywords.length > 0) {
    const pos = settings.keywordPosition || "Back";
    if (pos === "Front") {
      combined = [...addKeywords, ...initialKeywords];
    } else if (pos === "Custom") {
      const idx = Math.min(Math.max(0, Number(settings.positionNumber || 0)), initialKeywords.length);
      combined = [
        ...initialKeywords.slice(0, idx),
        ...addKeywords,
        ...initialKeywords.slice(idx)
      ];
    } else {
      combined = [...initialKeywords, ...addKeywords];
    }
  } else {
    combined = initialKeywords;
  }

  // 3. Enforce max length
  return combined.slice(0, maxKeywords);
}

export function normalizeMetadata(providerText, settings = {}) {
  let data;
  try {
    data = typeof providerText === "string" ? extractJson(providerText) : providerText;
  } catch (e) {
    // Fallback for plain text responses (detect labeled format)
    const text = String(providerText || "").trim();
    const titleMatch = text.match(/TITLE:\s*(.+)/i);
    const kwMatch = text.match(/KEYWORDS:\s*(.+)/i);
    const catMatch = text.match(/CATEGORY:\s*(.+)/i);
    const ftMatch = text.match(/FILE_TYPE:\s*(.+)/i);

    if (titleMatch || kwMatch) {
      return {
        result: text,
        title: titleMatch ? titleMatch[1].trim() : text.slice(0, 200),
        keywords: kwMatch ? kwMatch[1].split(",").map(k => k.trim()).filter(Boolean) : [],
        category: catMatch ? catMatch[1].toLowerCase().trim() : "business",
        peopleOrProperty: false,
        fileTypeFlag: ftMatch ? ftMatch[1].toLowerCase().includes("illustration") : false,
        legacyResult: text
      };
    }

    return {
      result: text,
      title: text.slice(0, 200),
      keywords: text.split(",").map(k => k.trim()).filter(Boolean),
      category: "business",
      peopleOrProperty: false,
      fileTypeFlag: false,
      legacyResult: text
    };
  }
  
  const start = String(settings.startText || "").trim();
  const end = String(settings.endText || "").trim();
  let baseTitle = String(data.title || "").replace(/\s+/g, " ").trim();
  
  let title = baseTitle;
  if (start) title = start + " " + title;
  if (end) title = title + " " + end;
  title = title.replace(/\s+/g, " ").trim().slice(0, 200);

  const keywords = normalizeKeywords(data.keywords, settings);
  const category = normalizeCategory(data.category);
  const peopleOrProperty = Boolean(data.peopleOrProperty);
  const fileTypeFlag = Boolean(data.fileTypeFlag);

  if (!title && keywords.length === 0) {
    throw new Error("Generated content is empty");
  }

  const legacyResult = `${title}&&${keywords.join(", ")}&&${category}&&${peopleOrProperty}&&${fileTypeFlag}`;

  return {
    result: legacyResult, // For backward compatibility with extension background.js
    title,
    keywords,
    category,
    peopleOrProperty,
    fileTypeFlag,
    legacyResult
  };
}

