import express from "express";
import multer from "multer";
import { protect } from "../middleware/auth.middleware.js";
import { storeFile, signedUploadParams, storageInfo, UPLOAD_DIR } from "../services/storage.js";
export { UPLOAD_DIR };
// Vercel caps request bodies at 4.5 MB, so keep files in memory and hand them to the storage backend.
const MAX = process.env.VERCEL ? 4.4 * 1024 * 1024 : Number(process.env.MAX_UPLOAD_MB || 50) * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(), limits: { fileSize: MAX, files: 10 },
  fileFilter: (_r, f, cb) => cb(/^(image|video)\//.test(f.mimetype) ? null : new Error("Only images and videos are allowed"), /^(image|video)\//.test(f.mimetype)),
});
const r = express.Router();
r.get("/config", protect, (_req, res) => res.json({ success: true, ...storageInfo() }));
// Signed params for direct browser → Cloudinary upload (large videos). 404 when Cloudinary isn't configured.
r.get("/sign", protect, (_req, res) => { const p = signedUploadParams(); return p ? res.json({ success: true, ...p }) : res.status(404).json({ success: false, code: "NO_DIRECT_UPLOAD" }); });
r.post("/", protect, (req, res) => {
  upload.array("files", 10)(req, res, async (err) => {
    if (err) return res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ success: false, code: err.code === "LIMIT_FILE_SIZE" ? "FILE_TOO_LARGE" : "UPLOAD_FAILED", message: err.message });
    try { res.json({ success: true, files: await Promise.all((req.files || []).map((f) => storeFile(f, req))) }); }
    catch (e) { res.status(e.status || 502).json({ success: false, code: e.status === 413 ? "FILE_TOO_LARGE" : "UPLOAD_FAILED", message: e.message }); }
  });
});
export default r;
