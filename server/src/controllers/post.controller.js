import mongoose from "mongoose";
import User from "../models/User.model.js";
import Post, { PUBLISHED, extractHashtags } from "../models/Post.model.js";
import Like from "../models/Like.model.js";
import Follow from "../models/Follow.model.js";
import { Comment, Report } from "../models/Misc.model.js";
import { postQuota } from "../services/plans.js";
import { now } from "../services/time.js";
import { audit } from "../services/audit.js";

export const MAX_SCHEDULED = Number(process.env.MAX_SCHEDULED_POSTS || 2);
const fail = (res, status, code, message, extra = {}) => res.status(status).json({ success: false, code, message, ...extra });
const err = (res, e) => { console.log(e); return fail(res, e.name === "ValidationError" ? 400 : 500, e.name === "ValidationError" ? "VALIDATION_ERROR" : "SERVER_ERROR", e.message); };

async function resolveTagged(tagged = []) {
  if (!Array.isArray(tagged) || !tagged.length) return [];
  const ids = tagged.filter((t) => mongoose.isValidObjectId(t));
  const names = tagged.filter((t) => !mongoose.isValidObjectId(t)).map((t) => String(t).replace(/^@/, ""));
  const users = await User.find({ $or: [{ _id: { $in: ids } }, { username: { $in: names } }] }).select("_id");
  return users.map((u) => u._id);
}

export const createPost = async (req, res) => {
  try {
    const { caption = "", location, media, taggedUsers, visibility, hashtags, scheduledAt } = req.body;
    if (!media || media.length === 0) return fail(res, 400, "MEDIA_REQUIRED", "Please upload at least one image");
    const quota = await postQuota(req.user);
    if (!quota.canPost) return fail(res, 403, "POST_LIMIT_REACHED", `Your ${quota.plan} plan allows ${quota.limit} post(s). Upgrade your subscription to post more.`, { quota });
    let status = "published", when = null;
    if (scheduledAt) {
      when = new Date(scheduledAt);
      if (isNaN(when)) return fail(res, 400, "INVALID_DATE", "Invalid schedule date");
      if (when <= now()) return fail(res, 400, "SCHEDULE_PAST", "Scheduled time must be in the future");
      const count = await Post.countDocuments({ user: req.user._id, status: "scheduled", isDeleted: false });
      if (count >= MAX_SCHEDULED) return fail(res, 400, "SCHEDULE_LIMIT", `You can have at most ${MAX_SCHEDULED} scheduled posts at a time.`);
      status = "scheduled";
    }
    const post = await Post.create({
      user: req.user._id, caption, location, media, visibility, status, scheduledAt: when,
      publishedAt: status === "published" ? now() : null,
      hashtags: extractHashtags(caption, hashtags), taggedUsers: await resolveTagged(taggedUsers),
    });
    if (status === "published") await User.findByIdAndUpdate(req.user._id, { $inc: { PostCount: 1 } });
    res.status(201).json({ success: true, message: status === "scheduled" ? "Post scheduled" : "Post Created Successfully", post, quota: await postQuota(req.user) });
  } catch (e) { err(res, e); }
};

export const getPosts = async (req, res) => {
  try {
    const page = Math.max(1, +req.query.page || 1), limit = Math.min(50, +req.query.limit || 30);
    const filter = { isDeleted: false, isArchived: { $ne: true }, ...PUBLISHED };
    const viewer = req.user?._id;
    let followingIds = [];
    if (viewer) followingIds = (await Follow.find({ follower: viewer }).select("following")).map((f) => f.following);
    filter.$or = [{ visibility: { $ne: "followers" } }, { user: { $in: [...followingIds, viewer].filter(Boolean) } }];
    const posts = await Post.find(filter).sort({ publishedAt: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit)
      .populate("user", "username fullName profilePicture isVerified").populate("taggedUsers", "username").lean();
    const likes = await Like.find({ post: { $in: posts.map((p) => p._id) } }).populate("user", "username fullName profilePicture");
    const map = {}; likes.forEach((l) => (map[l.post] ||= []).push(l));
    res.status(200).json({ success: true, posts: posts.map((p) => ({ ...p, likes: map[p._id] || [] })) });
  } catch (e) { err(res, e); }
};

export const getUserPosts = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return fail(res, 404, "NOT_FOUND", "User not found");
    const posts = await Post.find({ user: user._id, isDeleted: false, ...PUBLISHED }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, posts });
  } catch (e) { err(res, e); }
};

export const getQuota = async (req, res) => res.json({ success: true, quota: await postQuota(req.user) });

export const deletePost = async (req, res) => {
  const post = await Post.findOne({ _id: req.params.id, user: req.user._id, isDeleted: false });
  if (!post) return fail(res, 404, "NOT_FOUND", "Post not found");
  post.isDeleted = true; await post.save();
  if (post.status === "published") await User.updateOne({ _id: req.user._id, PostCount: { $gt: 0 } }, { $inc: { PostCount: -1 } });
  res.json({ success: true });
};

// ---------- scheduled posts ----------
export const myScheduled = async (req, res) => {
  const status = req.query.status;
  const q = { user: req.user._id, isDeleted: false, status: status ? status : { $in: ["scheduled", "failed", "cancelled"] } };
  const items = await Post.find(q).sort({ scheduledAt: 1 }).populate("taggedUsers", "username fullName profilePicture").lean();
  res.json({ success: true, items, max: MAX_SCHEDULED });
};
export const getScheduled = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, "NOT_FOUND", "Not found");
  const p = await Post.findOne({ _id: req.params.id, user: req.user._id, isDeleted: false }).populate("taggedUsers", "username fullName profilePicture");
  if (!p) return fail(res, 404, "NOT_FOUND", "Not found");
  res.json({ success: true, post: p });
};
export const updateScheduled = async (req, res) => {
  try {
    const p = await Post.findOne({ _id: req.params.id, user: req.user._id, isDeleted: false });
    if (!p) return fail(res, 404, "NOT_FOUND", "Scheduled post not found");
    if (!["scheduled", "failed", "cancelled"].includes(p.status)) return fail(res, 400, "NOT_EDITABLE", "Only scheduled posts can be edited");
    const { caption, location, media, taggedUsers, hashtags, scheduledAt, visibility } = req.body;
    if (scheduledAt !== undefined) {
      const when = new Date(scheduledAt);
      if (isNaN(when) || when <= now()) return fail(res, 400, "SCHEDULE_PAST", "Scheduled time must be in the future");
      if (p.status !== "scheduled") {
        const count = await Post.countDocuments({ user: req.user._id, status: "scheduled", isDeleted: false });
        if (count >= MAX_SCHEDULED) return fail(res, 400, "SCHEDULE_LIMIT", `You can have at most ${MAX_SCHEDULED} scheduled posts at a time.`);
        const quota = await postQuota(req.user);
        if (!quota.canPost) return fail(res, 403, "POST_LIMIT_REACHED", `Your ${quota.plan} plan allows ${quota.limit} post(s).`, { quota });
        p.status = "scheduled"; p.publishAttempts = 0;
      }
      p.scheduledAt = when;
    }
    if (caption !== undefined) p.caption = caption;
    if (location !== undefined) p.location = location;
    if (visibility !== undefined) p.visibility = visibility;
    if (media !== undefined) p.media = media;
    if (taggedUsers !== undefined) p.taggedUsers = await resolveTagged(taggedUsers);
    if (caption !== undefined || hashtags !== undefined) p.hashtags = extractHashtags(p.caption, hashtags);
    await p.save();
    res.json({ success: true, post: p });
  } catch (e) { err(res, e); }
};
export const cancelScheduled = async (req, res) => {
  const p = await Post.findOneAndUpdate({ _id: req.params.id, user: req.user._id, status: "scheduled" }, { status: "cancelled" }, { new: true });
  if (!p) return fail(res, 404, "NOT_FOUND", "Scheduled post not found");
  res.json({ success: true, post: p });
};

// ---------- comments & reports ----------
export const addComment = async (req, res) => {
  const text = String(req.body.text || "").trim();
  if (!text) return fail(res, 400, "COMMENT_REQUIRED", "Comment cannot be empty");
  const post = await Post.findOne({ _id: req.params.id, isDeleted: false, ...PUBLISHED });
  if (!post) return fail(res, 404, "NOT_FOUND", "Post not found");
  const c = await Comment.create({ post: post._id, user: req.user._id, text });
  await Post.updateOne({ _id: post._id }, { $inc: { commentsCount: 1 } });
  res.status(201).json({ success: true, comment: await c.populate("user", "username profilePicture") });
};
export const listComments = async (req, res) => {
  const items = await Comment.find({ post: req.params.id, isHidden: false }).sort({ createdAt: -1 }).limit(100).populate("user", "username profilePicture");
  res.json({ success: true, items });
};
export const createReport = async (req, res) => {
  const { targetType, targetId, reason } = req.body;
  if (!["user", "post", "story", "comment"].includes(targetType) || !mongoose.isValidObjectId(targetId) || !reason) return fail(res, 400, "INVALID_REPORT", "targetType, targetId and reason are required");
  const r = await Report.create({ reporter: req.user._id, targetType, targetId, reason });
  await audit(req, "report.created", { targetType, targetId });
  res.status(201).json({ success: true, report: r });
};
