import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import Follow from "../models/Follow.model.js";
import User from "../models/User.model.js";
import { followUser, getFollowingUsers, unfollowUser } from "../controllers/follow.controller.js";

const router = express.Router();

router.post("/:id", protect, followUser);
router.delete("/:id", protect, unfollowUser);
// Suggested accounts: active users I don't follow, ranked by mutual connections then popularity
router.get("/suggestions", protect, async (req, res) => {
  try {
    const me = req.user._id, limit = Math.min(30, +req.query.limit || 5);
    const mine = (await Follow.find({ follower: me }).select("following").lean()).map((f) => f.following);
    const exclude = [me, ...mine];
    const mutual = await Follow.aggregate([
      { $match: { follower: { $in: mine }, following: { $nin: exclude } } },
      { $group: { _id: "$following", n: { $sum: 1 }, via: { $first: "$follower" } } },
      { $sort: { n: -1 } }, { $limit: limit * 4 },
    ]);
    let ids = mutual.map((m) => m._id);
    if (ids.length < limit) ids = ids.concat((await User.find({ _id: { $nin: [...exclude, ...ids] }, status: "active" }).sort({ followersCount: -1 }).limit(limit - ids.length).select("_id").lean()).map((u) => u._id));
    const users = await User.find({ _id: { $in: ids }, status: "active" }).select("username fullName profilePicture isVerified followersCount").lean();
    const viaUsers = await User.find({ _id: { $in: mutual.map((m) => m.via) } }).select("username").lean();
    const viaName = Object.fromEntries(viaUsers.map((u) => [String(u._id), u.username]));
    const mm = Object.fromEntries(mutual.map((m) => [String(m._id), m]));
    const out = users.map((u) => ({ ...u, mutualCount: mm[u._id]?.n || 0, mutualVia: mm[u._id] ? viaName[String(mm[u._id].via)] : null }))
      .sort((a, b) => b.mutualCount - a.mutualCount || b.followersCount - a.followersCount);
    // light shuffle within top results so the panel feels fresh
    const top = out.slice(0, limit * 2).sort(() => Math.random() - 0.5).slice(0, limit).sort((a, b) => b.mutualCount - a.mutualCount);
    res.json({ success: true, users: top });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});
router.get("/following", protect, getFollowingUsers);

export default router;
