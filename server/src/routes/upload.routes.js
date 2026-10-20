import express from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { protect } from "../middleware/auth.middleware.js";
export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_r, f, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${path.extname(f.originalname).toLowerCase().replace(/[^.a-z0-9]/g, "")}`),
});
const upload = multer({
  storage, limits: { fileSize: Number(process.env.MAX_UPLOAD_MB || 50) * 1024 * 1024, files: 10 },
  fileFilter: (_r, f, cb) => cb(/^(image|video)\//.test(f.mimetype) ? null : new Error("Only images and videos are allowed"), /^(image|video)\//.test(f.mimetype)),
});
const r = express.Router();
r.post("/", protect, (req, res) => {
  upload.array("files", 10)(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, code: "UPLOAD_FAILED", message: err.message });
    const base = process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
    res.json({ success: true, files: (req.files || []).map((f) => ({ url: `${base}/uploads/${f.filename}`, type: f.mimetype.startsWith("video") ? "video" : "image", size: f.size })) });
  });
});
export default r;
