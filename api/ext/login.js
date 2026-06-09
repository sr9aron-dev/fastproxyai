import { db } from "../../src/firebase.mjs";
import { setupCors } from "../../src/http.mjs";

export default async function handler(req, res) {
  setupCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    // Check against teepublic_users collection
    const usersRef = db.collection("teepublic_users");
    const snapshot = await usersRef.where("username", "==", username).get();

    if (snapshot.empty) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    let userDoc = null;
    let userData = null;

    // Find the matching password (case sensitive)
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.password === password) {
        userDoc = doc;
        userData = data;
      }
    });

    if (!userDoc) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    if (userData.active === false) {
      return res.status(403).json({ error: "Account is disabled" });
    }

    // We can use the proxy_token stored in the user document, or generate a simple one
    const token = userData.token || process.env.ADMIN_TOKEN || "proxy_default_token_123";

    return res.status(200).json({
      ok: true,
      token,
      user: {
        username: userData.username,
      }
    });
  } catch (error) {
    console.error("[Login API] Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
