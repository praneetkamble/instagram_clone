import express from "express";
import mongoose from "mongoose";
import { secretGuard } from "./cron.routes.js";
// One-shot seeding for hosted DBs (the box can't reach Atlas on 27017): GET/POST /api/admin/seed?key=SEED_SECRET[&demo=0]
const r = express.Router();
r.all("/", secretGuard("SEED_SECRET"), async (req, res) => {
  const t = Date.now();
  await mongoose.connection.syncIndexes().catch((e) => console.warn("index sync:", e.message));
  const { seed } = await import("../seed.js");
  const prev = process.env.SEED_DEMO;
  if (req.query.demo !== undefined) process.env.SEED_DEMO = req.query.demo === "0" ? "false" : "true";
  else process.env.SEED_DEMO = prev ?? "true";
  try { const admin = await seed(); res.json({ success: true, admin: admin.email, demo: process.env.SEED_DEMO === "true", ms: Date.now() - t }); }
  finally { process.env.SEED_DEMO = prev; }
});
export default r;
