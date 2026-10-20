import mongoose from "mongoose";
import bcrypt from "bcrypt";
import User from "../models/User.model.js";
import Post from "../models/Post.model.js";
import { Story, StoryView } from "../models/Story.model.js";
import { Comment, Report, Subscription } from "../models/Misc.model.js";
import { AuditLog, LoginHistory } from "../models/Security.model.js";
import { audit } from "../services/audit.js";
import { PLAN_CONFIG } from "../services/plans.js";
import { now } from "../services/time.js";

const fail = (res, s, code, message) => res.status(s).json({ success: false, code, message });
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const uf = "username fullName email profilePicture plan status role isVerified";
const DAY = 86400000;

// resource registry: model, searchable fields, filters, editable fields, populate
const R = {
  users: {
    model: User, search: ["username", "fullName", "email", "phone"], populate: [],
    editable: ["username", "fullName", "email", "phone", "bio", "role", "status", "isVerified", "plan", "planExpiresAt", "language", "accountType"],
    filters: (q) => {
      const f = {};
      if (q.status) f.status = q.status;
      if (q.role) f.role = q.role;
      if (q.plan) f.plan = q.plan;
      if (q.verified) f.isVerified = q.verified === "true";
      if (q.activity === "active") f.lastActiveAt = { $gte: new Date(Date.now() - 7 * DAY) };
      if (q.activity === "inactive") f.lastActiveAt = { $lt: new Date(Date.now() - 7 * DAY) };
      return f;
    },
  },
  posts: {
    model: Post, search: ["caption", "location", "hashtags"], populate: [["user", uf]],
    editable: ["caption", "location", "visibility", "status", "isArchived", "isDeleted", "scheduledAt", "hashtags"],
    filters: (q) => {
      const f = {};
      if (q.visibility) f.visibility = q.visibility;
      if (q.status) f.status = q.status === "published" ? { $in: ["published", null] } : q.status;
      if (q.deleted) f.isDeleted = q.deleted === "true";
      if (q.user && mongoose.isValidObjectId(q.user)) f.user = q.user;
      return f;
    },
  },
  scheduled: {
    model: Post, search: ["caption", "location", "hashtags"], populate: [["user", uf]], dateField: "scheduledAt",
    editable: ["caption", "location", "status", "scheduledAt"],
    base: { scheduledAt: { $ne: null } },
    filters: (q) => (q.status ? { status: q.status } : {}),
  },
  stories: {
    model: Story, search: ["caption"], populate: [["user", uf]],
    editable: ["caption", "privacy", "isArchived", "isDeleted", "expiresAt"],
    filters: (q) => {
      const f = {};
      if (q.privacy) f.privacy = q.privacy;
      if (q.state === "active") Object.assign(f, { isArchived: false, isDeleted: false, expiresAt: { $gt: now() } });
      if (q.state === "archived") Object.assign(f, { isDeleted: false, $or: [{ isArchived: true }, { expiresAt: { $lte: now() } }] });
      if (q.state === "deleted") f.isDeleted = true;
      return f;
    },
  },
  comments: {
    model: Comment, search: ["text"], populate: [["user", uf], ["post", "caption media"]],
    editable: ["text", "isHidden"],
    filters: (q) => (q.hidden ? { isHidden: q.hidden === "true" } : {}),
  },
  subscriptions: {
    model: Subscription, search: ["razorpayOrderId", "razorpayPaymentId", "invoiceNumber", "plan"], populate: [["user", uf]],
    editable: ["status", "endsAt", "autoRenew", "plan", "failureReason"],
    filters: (q) => { const f = {}; if (q.status) f.status = q.status; if (q.plan) f.plan = q.plan; return f; },
  },
  reports: {
    model: Report, search: ["reason", "resolutionNote"], populate: [["reporter", uf]],
    editable: ["status", "resolutionNote"],
    filters: (q) => { const f = {}; if (q.status) f.status = q.status; if (q.targetType) f.targetType = q.targetType; return f; },
  },
  "audit-logs": { model: AuditLog, search: ["action", "targetType", "targetId", "ip"], populate: [["actor", "username email role"]], readOnly: true, filters: (q) => (q.action ? { action: new RegExp(esc(q.action), "i") } : {}) },
  "login-history": { model: LoginHistory, search: ["email", "browser", "os", "ip", "reason"], populate: [["user", "username email"]], readOnly: true, filters: (q) => { const f = {}; if (q.status) f.status = q.status; if (q.deviceType) f.deviceType = q.deviceType; return f; } },
};
const getRes = (req, res) => { const r = R[req.params.resource]; if (!r) fail(res, 404, "NOT_FOUND", "Unknown resource"); return r; };

export const list = async (req, res) => {
  try {
    const r = getRes(req, res); if (!r) return;
    const q = req.query;
    const page = Math.max(1, +q.page || 1), limit = Math.min(100, Math.max(1, +q.limit || 20));
    const filter = { ...(r.base || {}), ...r.filters(q) };
    const df = r.dateField || "createdAt";
    if (q.from || q.to) { filter[df] = { ...(filter[df] || {}) }; if (q.from) filter[df].$gte = new Date(q.from); if (q.to) filter[df].$lte = new Date(new Date(q.to).getTime() + (q.to.length <= 10 ? DAY - 1 : 0)); }
    if (q.q) {
      const rx = new RegExp(esc(q.q), "i");
      const or = r.search.map((f) => ({ [f]: rx }));
      // search by owner username too
      if (r.populate.some(([p]) => p === "user")) { const ids = (await User.find({ $or: [{ username: rx }, { email: rx }] }).select("_id").limit(200)).map((u) => u._id); if (ids.length) or.push({ user: { $in: ids } }); }
      filter.$and = [...(filter.$and || []), { $or: or }];
    }
    const sortField = q.sort || df, order = q.order === "asc" ? 1 : -1;
    let cursor = r.model.find(filter).sort({ [sortField]: order, _id: order }).skip((page - 1) * limit).limit(limit);
    for (const [p, s] of r.populate) cursor = cursor.populate(p, s);
    const [items, total] = await Promise.all([cursor.lean(), r.model.countDocuments(filter)]);
    res.json({ success: true, items, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (e) { console.log(e); fail(res, 400, "BAD_QUERY", e.message); }
};

export const getOne = async (req, res) => {
  const r = getRes(req, res); if (!r) return;
  if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, "NOT_FOUND", "Not found");
  let c = r.model.findById(req.params.id);
  for (const [p, s] of r.populate) c = c.populate(p, s);
  const item = await c.lean();
  if (!item) return fail(res, 404, "NOT_FOUND", "Not found");
  res.json({ success: true, item });
};

export const create = async (req, res) => {
  try {
    const r = getRes(req, res); if (!r) return;
    if (r.readOnly) return fail(res, 400, "READ_ONLY", "Read-only resource");
    const body = { ...req.body };
    if (req.params.resource === "users") {
      if (!body.password || String(body.password).length < 6) return fail(res, 400, "PASSWORD_SHORT", "Password must be at least 6 characters");
      body.password = await bcrypt.hash(body.password, 10);
    }
    if (req.params.resource === "subscriptions" && body.plan && !body.amount) body.amount = PLAN_CONFIG[body.plan]?.price;
    const item = await r.model.create(body);
    await audit(req, `admin.${req.params.resource}.create`, { targetType: req.params.resource, targetId: item._id, details: { ...req.body, password: undefined } });
    res.status(201).json({ success: true, item });
  } catch (e) { fail(res, 400, "VALIDATION_ERROR", e.message); }
};

export const update = async (req, res) => {
  try {
    const r = getRes(req, res); if (!r) return;
    if (r.readOnly) return fail(res, 400, "READ_ONLY", "Read-only resource");
    const before = await r.model.findById(req.params.id).lean();
    if (!before) return fail(res, 404, "NOT_FOUND", "Not found");
    const upd = {};
    for (const k of r.editable) if (req.body[k] !== undefined) upd[k] = req.body[k];
    if (req.params.resource === "users" && req.body.password) { upd.password = await bcrypt.hash(req.body.password, 10); upd.tokenVersion = (before.tokenVersion || 0) + 1; }
    if (req.params.resource === "users" && upd.status && upd.status !== "active") upd.tokenVersion = (before.tokenVersion || 0) + 1; // force logout
    const item = await r.model.findByIdAndUpdate(req.params.id, upd, { new: true, runValidators: true });
    const changes = Object.fromEntries(Object.keys(upd).filter((k) => k !== "password").map((k) => [k, { from: before[k], to: upd[k] }]));
    await audit(req, `admin.${req.params.resource}.update`, { targetType: req.params.resource, targetId: item._id, details: changes });
    res.json({ success: true, item });
  } catch (e) { fail(res, 400, "VALIDATION_ERROR", e.message); }
};

export const remove = async (req, res) => {
  try {
    const r = getRes(req, res); if (!r) return;
    if (r.readOnly) return fail(res, 400, "READ_ONLY", "Read-only resource");
    const id = req.params.id;
    const item = await r.model.findById(id);
    if (!item) return fail(res, 404, "NOT_FOUND", "Not found");
    const hard = req.query.hard === "true";
    if (["posts", "scheduled", "stories"].includes(req.params.resource) && !hard) { item.isDeleted = true; if (req.params.resource === "stories") item.isArchived = true; await item.save(); }
    else if (req.params.resource === "users") {
      if (String(item._id) === String(req.user._id)) return fail(res, 400, "SELF_DELETE", "You cannot delete your own admin account");
      await Promise.all([Post.updateMany({ user: id }, { isDeleted: true }), Story.updateMany({ user: id }, { isDeleted: true, isArchived: true }), Comment.deleteMany({ user: id })]);
      await item.deleteOne();
    } else await item.deleteOne();
    await audit(req, `admin.${req.params.resource}.delete`, { targetType: req.params.resource, targetId: id, details: { hard } });
    res.json({ success: true });
  } catch (e) { fail(res, 400, "ERROR", e.message); }
};

export const stats = async (req, res) => {
  const t = now(), weekAgo = new Date(Date.now() - 7 * DAY);
  const [users, activeUsers, newUsers, suspended, posts, scheduled, failed, stories, activeStories, comments, openReports, subsActive, revenue, planDist, storyViews, failedLogins] = await Promise.all([
    User.countDocuments(), User.countDocuments({ lastActiveAt: { $gte: weekAgo } }), User.countDocuments({ createdAt: { $gte: weekAgo } }), User.countDocuments({ status: { $ne: "active" } }),
    Post.countDocuments({ isDeleted: false, status: { $in: ["published", null] } }), Post.countDocuments({ status: "scheduled", isDeleted: false }), Post.countDocuments({ status: "failed" }),
    Story.countDocuments({ isDeleted: false }), Story.countDocuments({ isDeleted: false, isArchived: false, expiresAt: { $gt: t } }),
    Comment.countDocuments(), Report.countDocuments({ status: { $in: ["open", "reviewing"] } }),
    Subscription.countDocuments({ status: "active", endsAt: { $gt: t } }),
    Subscription.aggregate([{ $match: { status: { $in: ["active", "cancelled", "expired"] }, razorpayPaymentId: { $exists: true } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    User.aggregate([{ $group: { _id: "$plan", count: { $sum: 1 } } }]),
    StoryView.estimatedDocumentCount(), LoginHistory.countDocuments({ status: { $in: ["failed", "denied", "locked"] }, createdAt: { $gte: weekAgo } }),
  ]);
  res.json({ success: true, stats: { users, activeUsers, newUsers, suspended, posts, scheduled, failedScheduled: failed, stories, activeStories, comments, openReports, activeSubscriptions: subsActive, revenue: revenue[0]?.total || 0, planDistribution: Object.fromEntries(planDist.map((p) => [p._id, p.count])), storyViews, failedLogins7d: failedLogins } });
};
