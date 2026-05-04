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

/**
 * Normalizes headers from either Netlify (event.headers) or Vercel (req.headers)
 */
function getHeader(source, name) {
  const headers = source.headers || {};
  return headers[name.toLowerCase()] || headers[name] || "";
}

export function readJson(event) {
  // If event.body is already an object (Vercel's default behavior for JSON)
  if (event.body && typeof event.body === "object") {
    return event.body;
  }
  
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

  const actual = getHeader(event, "x-admin-token");
  if (actual !== expected) {
    const error = new Error("Invalid admin token");
    error.statusCode = 401;
    throw error;
  }
}

export function bearerToken(event) {
  const header = getHeader(event, "authorization");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

/**
 * Helper to adapt Netlify-style handler to Vercel Serverless Function
 */
export function vercelHandler(handler) {
  return async (req, res) => {
    // Vercel uses req.method instead of event.httpMethod
    const event = {
      httpMethod: req.method,
      headers: req.headers,
      body: req.body,
      queryStringParameters: req.query
    };

    const result = await handler(event);

    // Apply headers
    if (result.headers) {
      for (const [key, value] of Object.entries(result.headers)) {
        res.setHeader(key, value);
      }
    }

    res.status(result.statusCode || 200).send(result.body);
  };
}

