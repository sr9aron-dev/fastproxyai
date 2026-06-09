import { db } from "../../src/firebase.mjs";
import { json, optionsResponse, readJson, vercelHandler } from "../../src/http.mjs";

async function handler(event) {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Method Not Allowed" });
  }

  try {
    const body = readJson(event);
    const email = body.email;

    if (!email) {
      return json(400, { ok: false, error: "Email is required" });
    }

    // Check against teepublic_users collection
    const usersRef = db.collection("teepublic_users");
    const snapshot = await usersRef.where("email", "==", email).get();

    if (snapshot.empty) {
      return json(401, { ok: false, error: "Akun email ini tidak terdaftar atau belum diizinkan." });
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    if (userData.active === false) {
      return json(403, { ok: false, error: "Akun ini telah dinonaktifkan." });
    }

    const token = userData.token || process.env.ADMIN_TOKEN || "proxy_default_token_123";

    return json(200, {
      ok: true,
      token,
      user: {
        email: userData.email,
        name: userData.name || userData.email.split('@')[0],
      }
    });
  } catch (error) {
    console.error("[Login API] Error:", error);
    return json(500, { ok: false, error: "Internal Server Error" });
  }
}

export default vercelHandler(handler);
