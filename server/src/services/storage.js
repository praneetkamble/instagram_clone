// Media storage. Picks the first available backend per file:
//  1. Cloudinary (CLOUDINARY_URL=cloudinary://<key>:<secret>@<cloud>) – images + videos, free plan, no card
//  2. imgbb (IMGBB_API_KEY) – images only (what the original project used)
//  3. MongoDB (default on Vercel, or STORAGE=mongo) – ≤ MONGO_MEDIA_MAX_MB, served by /api/media/:id
//  4. local disk (local dev) – served by /uploads
import crypto from "crypto";
import fs from "fs";
import path from "path";
import Media from "../models/Media.model.js";

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "uploads");
export function cloudinaryCfg() {
  const u = process.env.CLOUDINARY_URL;
  if (u) { const m = u.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/); if (m) return { apiKey: m[1], apiSecret: m[2], cloud: m[3] }; }
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
    return { cloud: process.env.CLOUDINARY_CLOUD_NAME, apiKey: process.env.CLOUDINARY_API_KEY, apiSecret: process.env.CLOUDINARY_API_SECRET };
  return null;
}
const FOLDER = process.env.CLOUDINARY_FOLDER || "instai";
export function cloudinarySignature(params, secret) {
  const str = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
  return crypto.createHash("sha1").update(str + secret).digest("hex");
}
// For direct browser → Cloudinary uploads (bypasses Vercel's 4.5 MB request limit, e.g. for videos)
export function signedUploadParams() {
  const c = cloudinaryCfg(); if (!c) return null;
  const timestamp = Math.floor(Date.now() / 1000);
  return { cloudName: c.cloud, apiKey: c.apiKey, timestamp, folder: FOLDER, signature: cloudinarySignature({ folder: FOLDER, timestamp }, c.apiSecret) };
}
async function toCloudinary(file, c) {
  const p = signedUploadParamsFor(c);
  const fd = new FormData();
  fd.append("file", new Blob([file.buffer], { type: file.mimetype }), file.originalname || "upload");
  for (const [k, v] of Object.entries(p)) fd.append(k, String(v));
  const r = await fetch(`https://api.cloudinary.com/v1_1/${c.cloud}/auto/upload`, { method: "POST", body: fd });
  const j = await r.json();
  if (!r.ok) throw new Error(`Cloudinary: ${j.error?.message || r.status}`);
  return { url: j.secure_url, width: j.width, height: j.height, duration: j.duration };
}
function signedUploadParamsFor(c) { const timestamp = Math.floor(Date.now() / 1000); return { api_key: c.apiKey, timestamp, folder: FOLDER, signature: cloudinarySignature({ folder: FOLDER, timestamp }, c.apiSecret) }; }
async function toImgbb(file, key) {
  const fd = new FormData();
  fd.append("image", file.buffer.toString("base64"));
  const r = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(key)}`, { method: "POST", body: fd });
  const j = await r.json().catch(() => ({}));
  if (!j.success) throw new Error(`imgbb: ${j.error?.message || r.status}`);
  return { url: j.data.url, width: Number(j.data.width), height: Number(j.data.height) };
}
async function toMongo(file, req) {
  const max = Number(process.env.MONGO_MEDIA_MAX_MB || 4) * 1024 * 1024;
  if (file.size > max) throw Object.assign(new Error(`File too large for the built-in store (max ${max / 1048576} MB). Configure CLOUDINARY_URL for bigger files/videos.`), { status: 413 });
  const m = await Media.create({ owner: req.user?._id, mime: file.mimetype, size: file.size, data: file.buffer });
  return { url: `${baseUrl(req)}/api/media/${m._id}` };
}
function toDisk(file, req) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${path.extname(file.originalname || "").toLowerCase().replace(/[^.a-z0-9]/g, "")}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), file.buffer);
  return { url: `${baseUrl(req)}/uploads/${name}` };
}
export const baseUrl = (req) => process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
export function storageMode() {
  if (process.env.STORAGE) return process.env.STORAGE;
  return process.env.VERCEL ? "mongo" : "disk";
}
export async function storeFile(file, req) {
  const isVideo = file.mimetype.startsWith("video");
  const c = cloudinaryCfg(), key = process.env.IMGBB_API_KEY;
  let out;
  if (c) out = await toCloudinary(file, c);
  else if (!isVideo && key) out = await toImgbb(file, key);
  else out = storageMode() === "mongo" ? await toMongo(file, req) : toDisk(file, req);
  return { ...out, type: isVideo ? "video" : "image", size: file.size };
}
export const storageInfo = () => ({ cloudinary: !!cloudinaryCfg(), imgbb: !!process.env.IMGBB_API_KEY, fallback: storageMode(), maxRequestMB: process.env.VERCEL ? 4.4 : Number(process.env.MAX_UPLOAD_MB || 50) });
