export const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": process.env.ALLOWED_ORIGIN || "*",
  "access-control-allow-headers": "content-type, authorization, x-admin-token",
  "access-control-allow-methods": "GET, POST, OPTIONS"
};

export function optionsResponse() {
  return {
    statusCode: 204,
    headers: jsonHeaders,
    body: ""
  };
}

export function json(statusCode, payload) {
  return {
    statusCode,
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  };
}

export function readJson(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    const error = new Error("Body must be valid JSON");
    error.statusCode = 400;
    throw error;
  }
}

export function requireAdmin(event) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    const error = new Error("ADMIN_TOKEN is not configured");
    error.statusCode = 500;
    throw error;
  }

  const actual = event.headers["x-admin-token"] || event.headers["X-Admin-Token"];
  if (actual !== expected) {
    const error = new Error("Invalid admin token");
    error.statusCode = 401;
    throw error;
  }
}

export function bearerToken(event) {
  const header = event.headers.authorization || event.headers.Authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}
