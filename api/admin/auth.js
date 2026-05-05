import { json, optionsResponse, requireAdmin, vercelHandler } from "../../src/http.mjs";

async function handler(event) {
  if (event.httpMethod === "OPTIONS") return optionsResponse();
  
  try {
    // This will throw 401 if the token is invalid
    requireAdmin(event);
    
    return json(200, { 
      ok: true, 
      message: "Authenticated",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return json(error.statusCode || 500, {
      ok: false,
      error: {
        code: "AUTH_ERROR",
        message: error.message
      }
    });
  }
}

export default vercelHandler(handler);
