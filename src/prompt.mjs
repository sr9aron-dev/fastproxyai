export const adobeCategories = [
  "animals",
  "buildings and architecture",
  "business",
  "drinks",
  "the environment",
  "states of mind",
  "food",
  "graphic resources",
  "hobbies and leisure",
  "industry",
  "landscapes",
  "lifestyle",
  "people",
  "plants and flowers",
  "culture and religion",
  "science",
  "social issues",
  "sports",
  "technology",
  "transport",
  "travel"
];

export function buildMetadataPrompt(settings = {}, context = {}) {
  const keywordCount = Number(settings.keywordCount || settings.maxKeywordsNum || 49);
  const singleWord = Boolean(settings.singleWordKeywords || settings.isSingleKeywords);
  const niche = Boolean(settings.nicheKeywords || settings.isNicheKeywords);
  const existingTitle = context.existingTitle || "";
  const existingKeywords = Array.isArray(context.existingKeywords) ? context.existingKeywords.join(", ") : "";

  return [
    "You generate Adobe Stock metadata from an image.",
    "Return only valid compact JSON. Do not include markdown fences or explanations.",
    "",
    "Rules:",
    "- title must be natural English and under 200 characters.",
    `- keywords must be unique, relevant, and no more than ${keywordCount}.`,
    singleWord ? "- every keyword must be a single word." : "- multi-word keywords are allowed only when natural for stock metadata.",
    niche ? "- include more niche/specific terms while keeping relevance." : "- prefer broadly searchable stock keywords first.",
    "- category must be exactly one allowed category.",
    "- peopleOrProperty must be true if recognizable people, property, buildings, vehicles, brands, or private locations appear.",
    "- fileTypeFlag must be true only when the image is likely vector/illustration/graphic resource instead of a regular photo.",
    "",
    `Allowed categories: ${adobeCategories.join(" | ")}`,
    "",
    existingTitle ? `Existing title hint: ${existingTitle}` : "",
    existingKeywords ? `Existing keyword hints: ${existingKeywords}` : "",
    "",
    "Schema:",
    '{"title":"string","keywords":["string"],"category":"business","peopleOrProperty":false,"fileTypeFlag":false}'
  ]
    .filter(Boolean)
    .join("\n");
}
