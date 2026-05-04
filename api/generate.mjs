import { handler } from "../netlify/functions/generate.mjs";
import { vercelHandler } from "../src/http.mjs";

export default vercelHandler(handler);
