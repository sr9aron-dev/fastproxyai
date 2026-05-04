import { buildMetadataPrompt } from "./prompt.mjs";
import { normalizeMetadata } from "./normalize.mjs";

export async function callGroq({ key, model, image, prompt }) {
  const content = [{ type: "text", text: prompt }];
  if (image) {
    content.push({
      type: "image_url",
      image_url: { url: `data:${image.mime};base64,${image.base64}` }
    });
  }
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content
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
    result: text.trim(),
    usage: payload?.usage || null
  };
}

export async function callGemini({ key, model, image, prompt }) {
  const parts = [{ text: prompt }];
  if (image) {
    parts.push({
      inlineData: {
        mimeType: image.mime,
        data: image.base64
      }
    });
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0.2
      },
      contents: [
        {
          role: "user",
          parts
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
    result: text.trim(),
    usage: payload?.usageMetadata || null
  };
}
