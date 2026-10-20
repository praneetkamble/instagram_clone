// Vercel serverless entry: every request is rewritten here (see vercel.json).
import app from "../src/app.js";
import { ensureReady } from "../src/bootstrap.js";
export default async function handler(req, res) {
  try { await ensureReady(); }
  catch (e) { console.error("startup:", e); res.statusCode = 503; res.setHeader("content-type", "application/json");
    // CORS on the startup-failure path too, so the web app shows a real error instead of "Network Error"
    const origin = req.headers.origin, allowed = (process.env.CLIENT_URL || "").split(",").map((x) => x.trim());
    if (origin && allowed.includes(origin)) { res.setHeader("access-control-allow-origin", origin); res.setHeader("access-control-allow-credentials", "true"); res.setHeader("vary", "Origin"); }
    if (req.method === "OPTIONS") { res.statusCode = 204; res.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS"); res.setHeader("access-control-allow-headers", req.headers["access-control-request-headers"] || "content-type,authorization"); return res.end(); } return res.end(JSON.stringify({ success: false, code: "DB_UNAVAILABLE", message: "Database unavailable: " + e.message })); }
  return app(req, res);
}
