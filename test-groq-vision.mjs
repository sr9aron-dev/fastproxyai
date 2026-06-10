import { analyzeImageWithGroq } from "./src/skills/vision.mjs";

async function testGroqVision() {
    // Test with a real image URL
    const imageUrl = "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/1200px-Cat03.jpg";
    
    console.log("Mengirim ke Groq Vision...");
    const result = await analyzeImageWithGroq(imageUrl);
    console.log("Hasil:", result);
}

testGroqVision();
