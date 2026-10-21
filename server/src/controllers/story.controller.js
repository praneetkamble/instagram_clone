import mongoose from "mongoose";
import User from "../models/User.model.js";
import Follow from "../models/Follow.model.js";
import Conversation from "../models/Conversation.model.js";
import Message from "../models/message.model.js";
import { Story, StoryView, StoryReaction, StoryReply, Highlight } from "../models/Story.model.js";
import { Notification } from "../models/Misc.model.js";
import { io } from "../socket.js";
import { now } from "../services/time.js";

const STORY_TTL_MS = 24 * 3600 * 1000;
const fail = (res, s, code, message) => res.status(s).json({ success: false, code, message });
const err = (res, e) => { console.log(e); fail(res, 500, "SERVER_ERROR", e.message); };
const userFields = "username fullName profilePicture isVerified";
const activeFilter = () => ({ isArchived: false, isDeleted: false, expiresAt: { $gt: now() } });
const emitAnalytics = (ownerId, storyId, type, data = {}) => io?.to(String(ownerId)).emit("story:analytics", { storyId: String(storyId), type, ...data });

// Can `viewer` see this owner's story with the given privacy?
async function canView(viewerId, owner, privacy, followsCache) {
  if (String(viewerId) === String(owner._id)) return true;
  if (privacy === "public") return true;
  const follows = followsCache ? followsCache.has(String(owner._id)) : !!(await Follow.exists({ follower: viewerId, following: owner._id }));
  if (privacy === "followers") return follows;
  if (privacy === "close_friends") return (owner.closeFriends || []).some((id) => String(id) === String(viewerId));
  return false;
}

export const createStory = async (req, res) => {
  try {
    const { media, caption = "", privacy = "public" } = req.body;
    if (!Array.isArray(media) || !media.length) return fail(res, 400, "MEDIA_REQUIRED", "Add at least one photo or video");
    if (media.length > 10) return fail(res, 400, "TOO_MANY_MEDIA", "A story can have at most 10 items");
    if (!["public", "followers", "close_friends"].includes(privacy)) return fail(res, 400, "INVALID_PRIVACY", "Invalid privacy");
    for (const m of media) if (!m.url || !["image", "video"].includes(m.type)) return fail(res, 400, "INVALID_MEDIA", "Each item needs a url and type image|video");
    const story = await Story.create({
      user: req.user._id, caption, privacy,
      media: media.map((m) => ({ url: m.url, type: m.type, duration: m.type === "video" ? Math.min(60, +m.duration || 15) : 5 })),
      expiresAt: new Date(now().getTime() + STORY_TTL_MS),
    });
    res.status(201).json({ success: true, story });
  } catch (e) { err(res, e); }
};

export const storyFeed = async (req, res) => {
  try {
    const me = req.user._id;
    const following = (await Follow.find({ follower: me }).select("following").lean()).map((f) => f.following);
    const followSet = new Set(following.map(String));
    const stories = await Story.find({ ...activeFilter(), user: { $in: [me, ...following] } }).sort({ createdAt: 1 }).populate("user", userFields + " closeFriends").lean();
    const visible = [];
    for (const s of stories) if (await canView(me, s.user, s.privacy, followSet)) visible.push(s);
    const viewed = new Set((await StoryView.find({ viewer: me, story: { $in: visible.map((s) => s._id) } }).select("story").lean()).map((v) => String(v.story)));
    const groups = new Map();
    for (const s of visible) {
      const k = String(s.user._id);
      const { closeFriends, ...u } = s.user;
      if (!groups.has(k)) groups.set(k, { user: u, stories: [], allSeen: true, isMine: k === String(me) });
      const g = groups.get(k);
      const isOwner = k === String(me);
      g.stories.push({ ...s, user: u, seen: viewed.has(String(s._id)), ...(isOwner ? {} : { viewsCount: undefined, uniqueViewers: undefined, completedViews: undefined, reactionsCount: undefined, repliesCount: undefined }) });
      if (!viewed.has(String(s._id)) && !isOwner) g.allSeen = false;
    }
    const list = [...groups.values()].sort((a, b) => (b.isMine - a.isMine) || (a.allSeen - b.allSeen));
    res.json({ success: true, groups: list });
  } catch (e) { err(res, e); }
};

export const userStories = async (req, res) => {
  try {
    const owner = await User.findById(req.params.userId).select(userFields + " closeFriends");
    if (!owner) return fail(res, 404, "NOT_FOUND", "User not found");
    const stories = await Story.find({ ...activeFilter(), user: owner._id }).sort({ createdAt: 1 }).lean();
    const out = [];
    for (const s of stories) if (await canView(req.user._id, owner, s.privacy)) out.push(s);
    res.json({ success: true, user: { _id: owner._id, username: owner.username, profilePicture: owner.profilePicture }, stories: out });
  } catch (e) { err(res, e); }
};

async function loadViewable(req, res, { allowArchived = false } = {}) {
  if (!mongoose.isValidObjectId(req.params.id)) { fail(res, 404, "NOT_FOUND", "Story not found"); return null; }
  const story = await Story.findOne({ _id: req.params.id, isDeleted: false }).populate("user", userFields + " closeFriends");
  if (!story) { fail(res, 404, "NOT_FOUND", "Story not found"); return null; }
  const expired = story.isArchived || story.expiresAt <= now();
  if (expired && !allowArchived) { fail(res, 410, "STORY_EXPIRED", "This story has expired"); return null; }
  if (!(await canView(req.user._id, story.user, story.privacy))) { fail(res, 403, "STORY_PRIVATE", "You can't view this story"); return null; }
  return story;
}

export const viewStory = async (req, res) => {
  try {
    const story = await loadViewable(req, res);
    if (!story) return;
    const ownerId = story.user._id;
    if (String(ownerId) === String(req.user._id)) return res.json({ success: true, owner: true });
    const mediaIndex = Math.max(0, Math.min(story.media.length - 1, +req.body.mediaIndex || 0));
    const completed = req.body.completed === true || req.body.completed === "true";
    const t = now();
    // upsert keyed by unique (story, viewer) index => never duplicates
    const before = await StoryView.findOneAndUpdate(
      { story: story._id, viewer: req.user._id },
      { $setOnInsert: { owner: ownerId, firstViewedAt: t }, $inc: { viewCount: 1 }, $max: { maxMediaIndex: mediaIndex }, $set: { lastViewedAt: t } },
      { upsert: true, new: false },
    ).catch(async (e) => { if (e.code === 11000) return StoryView.findOneAndUpdate({ story: story._id, viewer: req.user._id }, { $inc: { viewCount: 1 }, $set: { lastViewedAt: t } }); throw e; });
    const inc = { viewsCount: 1 };
    if (!before) inc.uniqueViewers = 1;
    if (completed && !before?.completed) {
      const r = await StoryView.updateOne({ story: story._id, viewer: req.user._id, completed: false }, { completed: true });
      if (r.modifiedCount) inc.completedViews = 1;
    }
    const updated = await Story.findByIdAndUpdate(story._id, { $inc: inc }, { new: true });
    emitAnalytics(ownerId, story._id, "view", { viewer: { _id: req.user._id, username: req.user.username, profilePicture: req.user.profilePicture }, newViewer: !before, totals: pickTotals(updated) });
    res.json({ success: true, newViewer: !before });
  } catch (e) { err(res, e); }
};
const pickTotals = (s) => ({ viewsCount: s.viewsCount, uniqueViewers: s.uniqueViewers, completedViews: s.completedViews, reactionsCount: s.reactionsCount, repliesCount: s.repliesCount, completionRate: s.uniqueViewers ? Math.round((s.completedViews / s.uniqueViewers) * 1000) / 10 : 0 });

export const reactStory = async (req, res) => {
  try {
    const story = await loadViewable(req, res);
    if (!story) return;
    const emoji = String(req.body.emoji || "❤️").slice(0, 16);
    if (String(story.user._id) === String(req.user._id)) return fail(res, 400, "OWN_STORY", "You can't react to your own story");
    const prev = await StoryReaction.findOneAndUpdate({ story: story._id, user: req.user._id }, { emoji }, { upsert: true, new: false });
    const updated = prev ? story : await Story.findByIdAndUpdate(story._id, { $inc: { reactionsCount: 1 } }, { new: true });
    await Notification.create({ user: story.user._id, type: "story_reaction", key: "notif.storyReaction", params: { username: req.user.username, emoji } });
    emitAnalytics(story.user._id, story._id, "reaction", { user: { _id: req.user._id, username: req.user.username }, emoji, totals: pickTotals(updated) });
    res.json({ success: true, emoji });
  } catch (e) { err(res, e); }
};

export const replyStory = async (req, res) => {
  try {
    const story = await loadViewable(req, res);
    if (!story) return;
    const text = String(req.body.text || "").trim();
    if (!text) return fail(res, 400, "REPLY_REQUIRED", "Reply cannot be empty");
    if (String(story.user._id) === String(req.user._id)) return fail(res, 400, "OWN_STORY", "You can't reply to your own story");
    const toDM = req.body.toDM !== false;
    let message = null;
    if (toDM) {
      let conv = await Conversation.findOne({ isGroup: false, participants: { $all: [req.user._id, story.user._id], $size: 2 } });
      if (!conv) conv = await Conversation.create({ participants: [req.user._id, story.user._id] });
      message = await Message.create({ conversation: conv._id, sender: req.user._id, text, storyReply: story._id, media: story.media[0]?.url || "" });
      await Conversation.updateOne({ _id: conv._id }, { lastMessage: message._id, lastMessageAt: new Date() });
      const populated = await Message.findById(message._id).populate("sender", "username fullName profilePicture");
      io?.to(String(conv._id)).emit("receive-message", populated);
      io?.to(String(story.user._id)).emit("new-message-notification", populated);
    }
    const reply = await StoryReply.create({ story: story._id, user: req.user._id, text, sentToDM: toDM, message: message?._id });
    const updated = await Story.findByIdAndUpdate(story._id, { $inc: { repliesCount: 1 } }, { new: true });
    await Notification.create({ user: story.user._id, type: "story_reply", key: "notif.storyReply", params: { username: req.user.username } });
    emitAnalytics(story.user._id, story._id, "reply", { user: { _id: req.user._id, username: req.user.username }, text, totals: pickTotals(updated) });
    res.status(201).json({ success: true, reply, messageId: message?._id });
  } catch (e) { err(res, e); }
};

export const deleteStory = async (req, res) => {
  const s = await Story.findOneAndUpdate({ _id: req.params.id, user: req.user._id, isDeleted: false }, { isDeleted: true, isArchived: true, archivedAt: now() }, { new: true });
  if (!s) return fail(res, 404, "NOT_FOUND", "Story not found");
  await Highlight.updateMany({ user: req.user._id }, { $pull: { stories: s._id } });
  res.json({ success: true });
};

export const storyAnalytics = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, "NOT_FOUND", "Story not found");
    const story = await Story.findOne({ _id: req.params.id, user: req.user._id }).lean();
    if (!story) return fail(res, 404, "NOT_FOUND", "Story not found");
    const page = Math.max(1, +req.query.page || 1), limit = Math.min(200, +req.query.limit || 50);
    const bucket = req.query.bucket === "minute" ? "%Y-%m-%dT%H:%M" : "%Y-%m-%dT%H:00";
    const [viewers, reactions, replies, timeline] = await Promise.all([
      StoryView.find({ story: story._id }).sort({ firstViewedAt: -1 }).skip((page - 1) * limit).limit(limit).populate("viewer", userFields).lean(),
      StoryReaction.find({ story: story._id }).sort({ updatedAt: -1 }).limit(500).populate("user", userFields).lean(),
      StoryReply.find({ story: story._id }).sort({ createdAt: -1 }).limit(500).populate("user", userFields).lean(),
      StoryView.aggregate([
        { $match: { story: story._id } },
        { $group: { _id: { $dateToString: { format: bucket, date: "$firstViewedAt", timezone: "Asia/Kolkata" } }, uniqueViews: { $sum: 1 }, totalViews: { $sum: "$viewCount" } } },
        { $sort: { _id: 1 } },
      ]),
    ]);
    res.json({
      success: true,
      story: { _id: story._id, media: story.media, caption: story.caption, privacy: story.privacy, createdAt: story.createdAt, expiresAt: story.expiresAt, isArchived: story.isArchived || story.expiresAt <= now(), isDeleted: story.isDeleted },
      totals: pickTotals(story), viewers, viewersPage: page, viewersPages: Math.ceil(story.uniqueViewers / limit),
      reactions, replies, timeline: timeline.map((t) => ({ time: t._id, uniqueViews: t.uniqueViews, totalViews: t.totalViews })),
    });
  } catch (e) { err(res, e); }
};

export const myStories = async (req, res) => {
  const scope = req.query.scope || "all"; // active | archived | all
  const q = { user: req.user._id, isDeleted: req.query.includeDeleted === "true" ? { $in: [true, false] } : false };
  if (scope === "active") Object.assign(q, activeFilter());
  if (scope === "archived") q.$or = [{ isArchived: true }, { expiresAt: { $lte: now() } }];
  const items = await Story.find(q).sort({ createdAt: -1 }).limit(200).lean();
  res.json({ success: true, items });
};

// Highlights
export const listHighlights = async (req, res) => {
  const items = await Highlight.find({ user: req.params.userId }).sort({ createdAt: -1 }).populate({ path: "stories", match: { isDeleted: false } }).lean();
  res.json({ success: true, items });
};
export const createHighlight = async (req, res) => {
  const { title, storyIds = [], cover } = req.body;
  if (!title) return fail(res, 400, "TITLE_REQUIRED", "Title is required");
  const stories = await Story.find({ _id: { $in: storyIds }, user: req.user._id, isDeleted: false }).select("_id media");
  if (!stories.length) return fail(res, 400, "STORIES_REQUIRED", "Select at least one of your stories");
  const h = await Highlight.create({ user: req.user._id, title, cover: cover || stories[0].media[0]?.url, stories: stories.map((s) => s._id) });
  res.status(201).json({ success: true, highlight: h });
};
export const updateHighlight = async (req, res) => {
  const h = await Highlight.findOne({ _id: req.params.id, user: req.user._id });
  if (!h) return fail(res, 404, "NOT_FOUND", "Highlight not found");
  if (req.body.title) h.title = req.body.title;
  if (req.body.cover) h.cover = req.body.cover;
  if (Array.isArray(req.body.storyIds)) h.stories = (await Story.find({ _id: { $in: req.body.storyIds }, user: req.user._id, isDeleted: false }).select("_id")).map((s) => s._id);
  await h.save();
  res.json({ success: true, highlight: h });
};
export const deleteHighlight = async (req, res) => {
  await Highlight.deleteOne({ _id: req.params.id, user: req.user._id });
  res.json({ success: true });
};

export async function archiveExpiredStories() {
  const r = await Story.updateMany({ isArchived: false, expiresAt: { $lte: now() } }, { $set: { isArchived: true, archivedAt: now() } });
  if (r.modifiedCount) console.log(`🗄️  Archived ${r.modifiedCount} expired stories (analytics retained)`);
  return r.modifiedCount;
}
