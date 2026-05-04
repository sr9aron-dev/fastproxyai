import { handler } from "../netlify/functions/admin-test.mjs";
import { vercelHandler } from "../src/http.mjs";

export default vercelHandler(handler);
