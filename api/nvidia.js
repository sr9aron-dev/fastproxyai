import { recordLog } from "../src/store.mjs";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiKey, model, prompt, image } = req.body;

  if (!apiKey || (!prompt && !image)) {
    return res.status(400).json({ error: 'API Key and either Prompt or Image are required' });
  }

  try {
    const userMessageContent = [];
    if (prompt) {
      userMessageContent.push({ type: 'text', text: prompt });
    }
    if (image) {
      let imageUrl = typeof image === 'string' 
        ? (image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`) 
        : `data:${image.mime || 'image/jpeg'};base64,${image.base64}`;
        
      userMessageContent.push({
        type: 'image_url',
        image_url: { url: imageUrl }
      });
    }

    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'mistralai/mistral-large-3-675b-instruct-2512',
        messages: [
          {
            role: 'system',
            content: 'You are a microstock metadata expert. Your task is to generate a Title and exactly 50 Keywords for the content provided. \n\nOutput format:\nTitle: [Generated Title, descriptive and catchy, 50-70 characters]\nKeywords: [50 keywords, comma-separated, most relevant first, no duplicates, all lowercase]'
          },
          {
            role: 'user',
            content: userMessageContent
          }
        ],
        temperature: 0.15,
        max_tokens: 2048,
        top_p: 1.00
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.status(200).json(data);
    await recordLog({
      method: "POST",
      path: "/api/nvidia",
      status: 200,
      host: req.headers.host || "unknown",
      provider: "nvidia",
      model: model || "mistralai/mistral-large-3-675b-instruct-2512",
      message: "Nvidia generation success"
    });
  } catch (error) {
    console.error('Nvidia API Error:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
    await recordLog({
      method: "POST",
      path: "/api/nvidia",
      status: 500,
      host: req.headers?.host || "unknown",
      message: error.message,
      error: true
    });
  }
}
