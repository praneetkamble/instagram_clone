// Vercel serverless entry: every request is rewritten here (see vercel.json).
import app from "../src/app.js";
import { ensureReady } from "../src/bootstrap.js";
export default async function handler(req, res) {
  try { await ensureReady(); }
  catch (e) { console.error("startup:", e); res.statusCode = 503; res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ success: false, code: "DB_UNAVAILABLE", message: e.message })); }
  return app(req, res);
}
