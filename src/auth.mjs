import { sha256 } from "./crypto.mjs";
import { loadConfig } from "./store.mjs";

export async function validateExtensionToken(token) {
  if (!token) return null;
  const config = await loadConfig();
  const tokenHash = sha256(token);
  
  // Periksa apakah token cocok dengan hash (aman) ATAU cocok dengan string mentah (untuk kemudahan setup env var)
  const key = config.extensionKeys.find((item) => 
    (item.hash === tokenHash || item.hash === token) && item.active !== false
  );
  
  return key || null;
}
