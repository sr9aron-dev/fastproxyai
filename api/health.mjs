import { handler } from "../netlify/functions/health.mjs";
import { vercelHandler } from "../src/http.mjs";

export default vercelHandler(handler);
