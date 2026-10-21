import express from "express";
import crypto from "crypto";
import { runAll, maintenanceLog } from "../services/maintenance.js";
const eq = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
// Accepts `Authorization: Bearer <secret>` (Vercel Cron sends this automatically when CRON_SECRET is set),
// `x-cron-key: <secret>` or `?key=<secret>` (handy for cron-job.org).
export const secretGuard = (envName) => (req, res, next) => {
  const secret = process.env[envName] || (envName !== "CRON_SECRET" ? process.env.CRON_SECRET : "");
  if (!secret) {
    if (process.env.VERCEL || process.env.NODE_ENV === "production") return res.status(503).json({ success: false, code: "NOT_CONFIGURED", message: `${envName} is not set` });
    return next(); // local dev convenience
  }
  const given = String((req.headers.authorization || "").replace(/^Bearer\s+/i, "") || req.headers["x-cron-key"] || req.query.key || "");
  if (!given || !eq(given, secret)) return res.status(401).json({ success: false, code: "UNAUTHORIZED" });
  next();
};
const r = express.Router();
r.all("/tick", secretGuard("CRON_SECRET"), async (_req, res) => res.json({ success: true, ranAt: new Date().toISOString(), ...(await runAll()) }));
r.get("/log", secretGuard("CRON_SECRET"), (_req, res) => res.json({ success: true, log: maintenanceLog() }));
// SMTP smoke test. Only ever mails the configured sender mailbox (no arbitrary recipients). Never echoes credentials.
r.all("/test-email", secretGuard("CRON_SECRET"), async (_req, res) => {
  const { sendEmail } = await import("../services/mailer.js");
  const to = process.env.SMTP_USER;
  if (!to) return res.json({ success: false, configured: false });
  const t = Date.now();
  const out = await sendEmail({ to, subject: "InstAI SMTP test ✔", text: `SMTP test from ${process.env.VERCEL ? "Vercel" : "local"} at ${new Date().toISOString()}` });
  res.json({ success: !!out.sent, configured: true, host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), result: out.sent ? "sent" : out.dev ? "dev-log-only" : "error", error: out.error || null, ms: Date.now() - t });
});
export default r;
