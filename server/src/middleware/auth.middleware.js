import jwt from "jsonwebtoken";
import User from "../models/User.model.js";
import { Session } from "../models/Security.model.js";

export const protect = async (req, res, next) => {
  try {
    const h = req.headers.authorization;
    const token = h && h.startsWith("Bearer") ? h.split(" ")[1] : null;
    if (!token) return res.status(401).json({ success: false, code: "UNAUTHORIZED", message: "Access denied" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.typ === "challenge") return res.status(401).json({ success: false, code: "UNAUTHORIZED", message: "Verification pending" });
    const user = await User.findById(decoded.id).select("-password -refreshToken");
    if (!user) return res.status(401).json({ success: false, code: "UNAUTHORIZED", message: "User not found" });
    if ((decoded.tv ?? 0) !== (user.tokenVersion ?? 0)) return res.status(401).json({ success: false, code: "SESSION_EXPIRED", message: "Session expired. Please log in again." });
    if (decoded.sid) {
      const s = await Session.findById(decoded.sid);
      if (!s || s.revoked) return res.status(401).json({ success: false, code: "SESSION_EXPIRED", message: "Session expired. Please log in again." });
      if (Date.now() - s.lastSeenAt > 60000) { s.lastSeenAt = new Date(); s.save().catch(() => {}); }
      req.sessionId = s._id;
    }
    if (user.status !== "active") return res.status(403).json({ success: false, code: "ACCOUNT_SUSPENDED", message: `Your account is ${user.status}.` });
    if (Date.now() - (user.lastActiveAt?.getTime() || 0) > 60000) User.updateOne({ _id: user._id }, { lastActiveAt: new Date() }).catch(() => {});
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, code: "UNAUTHORIZED", message: error.message });
  }
};
export const optionalAuth = async (req, res, next) => {
  if (!req.headers.authorization) return next();
  return protect(req, res, next);
};
export const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") return res.status(403).json({ success: false, code: "FORBIDDEN", message: "Admin access required" });
  next();
};
