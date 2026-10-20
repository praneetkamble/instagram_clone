import Post from "../models/Post.model.js";
export const PLAN_CONFIG = {
  free: { name: "Free", price: 0, postLimit: 1 },
  bronze: { name: "Bronze", price: 100, postLimit: 3 },
  silver: { name: "Silver", price: 300, postLimit: 5 },
  gold: { name: "Gold", price: 1000, postLimit: Infinity },
};
export const PLAN_DAYS = 30;
export const countUserPosts = (userId) =>
  Post.countDocuments({ user: userId, isDeleted: false, status: { $in: ["published", "scheduled", null] } });
export async function postQuota(user) {
  const plan = typeof user.effectivePlan === "function" ? user.effectivePlan() : user.plan || "free";
  const limit = PLAN_CONFIG[plan].postLimit;
  const used = await countUserPosts(user._id);
  return { plan, limit: limit === Infinity ? null : limit, used, remaining: limit === Infinity ? null : Math.max(0, limit - used), canPost: used < limit };
}
