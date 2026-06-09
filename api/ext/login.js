import { db } from "../../src/firebase.mjs";
import { setupCors } from "../../src/http.mjs";

export default async function handler(req, res) {
  setupCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Check against teepublic_users collection
    const usersRef = db.collection("teepublic_users");
    const snapshot = await usersRef.where("email", "==", email).get();

    if (snapshot.empty) {
      return res.status(401).json({ error: "Akun email ini tidak terdaftar atau belum diizinkan." });
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    if (userData.active === false) {
      return res.status(403).json({ error: "Akun ini telah dinonaktifkan." });
    }

    // We can use the proxy_token stored in the user document, or generate a simple one
    const token = userData.token || process.env.ADMIN_TOKEN || "proxy_default_token_123";

    return res.status(200).json({
      ok: true,
      token,
      user: {
        email: userData.email,
        name: userData.name || userData.email.split('@')[0],
      }
    });
  } catch (error) {
    console.error("[Login API] Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
