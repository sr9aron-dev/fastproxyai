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
      userMessageContent.push({
        type: 'image_url',
        image_url: image // This is the base64 data URL
      });
    }

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'mistral-large-latest',
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
        temperature: 0.7,
        max_tokens: 500
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('Mistral API Error:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
