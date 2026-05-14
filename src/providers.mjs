

export async function callGroq({ key, model, image, prompt, system, temperature, history }) {
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
      temperature: temperature ?? 0.2,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        ...(history || []).map(msg => ({ 
          role: msg.role === "assistant" ? "assistant" : "user", 
          content: msg.text 
        })),
        {
          role: "user",
          content
        }
      ]
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const rawMessage = payload?.error?.message || `Status ${response.status}`;
    console.error(`[Groq] Error: ${rawMessage}`);
    const error = new Error(`Groq provider error: ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  const text = payload?.choices?.[0]?.message?.content || "";
  return {
    result: text.trim(),
    usage: payload?.usage || null
  };
}

export async function callGemini({ key, model, image, prompt, system, temperature, history }) {
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
      system_instruction: system ? { parts: [{ text: system }] } : undefined,
      generationConfig: {
        temperature: temperature ?? 0.2
      },
      contents: [
        ...(history || []).map(msg => ({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.text }]
        })),
        {
          role: "user",
          parts
        }
      ]
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const rawMessage = payload?.error?.message || `Status ${response.status}`;
    console.error(`[Gemini] Error: ${rawMessage}`);
    const error = new Error(`Gemini provider error: ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
  return {
    result: text.trim(),
    usage: payload?.usageMetadata || null
  };
}

export async function callMistral({ key, model, image, prompt, system, temperature, history }) {
  const userMessageContent = [];
  if (prompt) {
    userMessageContent.push({ type: "text", text: prompt });
  }
  if (image) {
    userMessageContent.push({
      type: "image_url",
      image_url: `data:${image.mime};base64,${image.base64}`
    });
  }

  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: model || "mistral-tiny",
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        ...(history || []).map(msg => ({ 
          role: msg.role === "assistant" ? "assistant" : "user", 
          content: msg.text 
        })),
        {
          role: "user",
          content: userMessageContent
        }
      ],
      temperature: temperature ?? 0.2
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const rawMessage = payload?.error?.message || `Status ${response.status}`;
    console.error(`[Mistral] Error: ${rawMessage}`);
    const error = new Error(`Mistral provider error: ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }

  const text = payload?.choices?.[0]?.message?.content || "";
  return {
    result: text.trim(),
    usage: payload?.usage || null
  };
}
