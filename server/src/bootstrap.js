import connectDB from "./config/db.js";
// One-time per instance: DB connection (+ optional idempotent seed). Used by the Vercel handler and the harness.
let ready;
export function ensureReady() {
  if (!process.env.JWT_SECRET) { if (process.env.VERCEL) console.error("JWT_SECRET missing"); process.env.JWT_SECRET = process.env.JWT_SECRET || "dev_insecure_secret_change_me"; }
  ready ||= (async () => {
    await connectDB();
    if (process.env.SEED_ON_START === "true") { const { seed } = await import("./seed.js"); await seed().catch((e) => console.error("seed:", e.message)); }
  })().catch((e) => { ready = null; throw e; });
  return ready;
}
