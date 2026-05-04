import { callGemini } from "./src/providers.mjs";

async function test() {
  try {
    const res = await callGemini({
      key: "AIzaSyDqxaZUYU4VFQ3ewO-1L5hp9d1ipUVkyaM",
      model: "gemini-2.5-flash",
      prompt: "Reply with the exact word 'SUCCESS'."
    });
    console.log("Success:", res);
  } catch (e) {
    console.error("Error:", e.statusCode, e.message);
  }
}

test();
