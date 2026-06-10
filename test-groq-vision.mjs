import { analyzeImageWithGroq } from "./src/skills/vision.mjs";

async function testGroqVision() {
    // 1x1 red pixel JPEG base64
    const base64Image = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
    
    console.log("Mengirim ke Groq Vision...");
    const result = await analyzeImageWithGroq(base64Image);
    console.log("Hasil:", result);
}

testGroqVision();
