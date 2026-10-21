import express from "express";
import mongoose from "mongoose";
import Media from "../models/Media.model.js";
const r = express.Router();
r.get("/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).end();
  const m = await Media.findById(req.params.id).lean();
  if (!m) return res.status(404).end();
  const buf = Buffer.from(m.data.buffer || m.data);
  res.set({ "Content-Type": m.mime, "Cache-Control": "public, max-age=31536000, immutable", "Content-Length": buf.length, "Accept-Ranges": "bytes" });
  const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
  if (range) { // video seeking
    const start = Number(range[1] || 0), end = Math.min(range[2] ? Number(range[2]) : buf.length - 1, buf.length - 1);
    res.status(206).set({ "Content-Range": `bytes ${start}-${end}/${buf.length}`, "Content-Length": end - start + 1 });
    return res.end(buf.subarray(start, end + 1));
  }
  res.end(buf);
});
export default r;
