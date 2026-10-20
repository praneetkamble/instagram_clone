import express from "express";
import mongoose from "mongoose";
import { secretGuard } from "./cron.routes.js";
// One-shot seeding for hosted DBs (the box can't reach Atlas on 27017): GET/POST /api/admin/seed?key=SEED_SECRET[&demo=0]
const r = express.Router();
r.all("/", secretGuard("SEED_SECRET"), async (req, res) => {
  const t = Date.now();
  if (req.query.size === "large") {
    const { STEPS } = await import("../seedLarge.js");
    const step = String(req.query.step || "users");
    if (!STEPS[step]) return res.status(400).json({ success: false, message: "step must be one of " + Object.keys(STEPS).join(",") });
    try { return res.json({ success: true, step, result: await STEPS[step](), ms: Date.now() - t, next: { users: "posts", posts: "social", social: "extras" }[step] || null }); }
    catch (e) { return res.status(500).json({ success: false, step, message: e.message }); }
  }
  await mongoose.connection.syncIndexes().catch((e) => console.warn("index sync:", e.message));
  const { seed } = await import("../seed.js");
  const prev = process.env.SEED_DEMO;
  if (req.query.demo !== undefined) process.env.SEED_DEMO = req.query.demo === "0" ? "false" : "true";
  else process.env.SEED_DEMO = prev ?? "true";
  try { const admin = await seed(); res.json({ success: true, admin: admin.email, demo: process.env.SEED_DEMO === "true", ms: Date.now() - t }); }
  finally { process.env.SEED_DEMO = prev; }
});
export default r;
