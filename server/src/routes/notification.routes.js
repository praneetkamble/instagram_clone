import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import { Notification } from "../models/Misc.model.js";
const r = express.Router();
r.get("/", protect, async (req, res) => {
  const items = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50).lean();
  res.json({ success: true, items, unread: items.filter((i) => !i.read).length });
});
r.post("/read", protect, async (req, res) => { await Notification.updateMany({ user: req.user._id, read: false }, { read: true }); res.json({ success: true }); });
export default r;
