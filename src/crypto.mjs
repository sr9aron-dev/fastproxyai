import crypto from "node:crypto";

export function randomToken(prefix = "ek_live") {
  return `${prefix}_${crypto.randomBytes(32).toString("base64url")}`;
}

export function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

export function maskKey(value) {
  if (!value || value.length < 12) return value ? "****" : "";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function normalizeKeyList(value) {
  if (Array.isArray(value)) return value.map(String).map((key) => key.trim()).filter(Boolean);
  return String(value || "")
    .split(/\r?\n|,/)
    .map((key) => key.trim())
    .filter(Boolean);
}
