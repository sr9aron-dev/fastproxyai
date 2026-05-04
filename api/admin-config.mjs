import { handler } from "../netlify/functions/admin-config.mjs";
import { vercelHandler } from "../src/http.mjs";

export default vercelHandler(handler);
