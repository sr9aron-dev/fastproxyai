// --- QWEN VISION AI ---
export async function analyzeImage(imageBase64) {
    const apiKey = process.env.QWEN_API_KEY || 'sk-ws-H.ILHDHP.fakn.MEYCIQDGQZgkorFTHh9mN1IlzQTeZ8zRIs6mpfQd9UiznuGVOgIhAKIPOHid-8zDdxd5uk0Fpz70IajHWahhfqgiFvq6NL1m';
    const url = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions";
    const body = {
        model: "qwen-vl-max",
        messages: [
            {
                role: "user",
                content: [
                    { type: "image_url", image_url: { url: imageBase64 } },
                    { type: "text", text: "Tolong deskripsikan gambar ini dengan sangat detail dalam bahasa Indonesia. Jika ini adalah gambar pakaian/baju, sebutkan warna, bahan, motif, dan gayanya. (Maksimal 2-3 kalimat)" }
                ]
            }
        ]
    };
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify(body)
    });
    if (!response.ok) return "Foto yang dikirim tidak jelas.";
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Gambar tidak diketahui.";
}
