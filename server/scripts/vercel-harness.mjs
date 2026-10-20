// Runs the exact Vercel entry (api/index.js) behind a plain HTTP server: no app.listen, no Socket.io,
// no node-cron — background work only via /api/cron/tick and lazy-on-read. Usage:
//   VERCEL=1 MONGODB_URI=... PORT=5056 node scripts/vercel-harness.mjs
import http from "http";
process.env.VERCEL ||= "1";
const { default: handler } = await import("../api/index.js");
const PORT = Number(process.env.PORT || 5056);
http.createServer((req, res) => handler(req, res)).listen(PORT, () => console.log(`▲ vercel-style handler on http://localhost:${PORT}`));
