import { buildMetadataPrompt } from "./prompt.mjs";
import { normalizeMetadata } from "./normalize.mjs";

function assertImage(image) {
  if (!image?.base64 || !image?.mime) throw new Error("Request image.base64 and image.mime are required");
}

export async function callGroq({ key, model, image, context, settings }) {
  assertImage(image);
  const prompt = buildMetadataPrompt(settings, context);
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${image.mime};base64,${image.base64}`
              }
            }
          ]
        }
      ]
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `Groq request failed with ${response.status}`;
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  const text = payload?.choices?.[0]?.message?.content || "";
  return {
    result: normalizeMetadata(text, settings),
    usage: payload?.usage || null
  };
}

export async function callGemini({ key, model, image, context, settings }) {
  assertImage(image);
  const prompt = buildMetadataPrompt(settings, context);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json"
      },
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: image.mime,
                data: image.base64
              }
            }
          ]
        }
      ]
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `Gemini request failed with ${response.status}`;
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  return {
    result: normalizeMetadata(text, settings),
    usage: payload?.usageMetadata || null
  };
}
