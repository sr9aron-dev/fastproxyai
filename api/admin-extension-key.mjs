import { handler } from "../netlify/functions/admin-extension-key.mjs";
import { vercelHandler } from "../src/http.mjs";

export default vercelHandler(handler);
