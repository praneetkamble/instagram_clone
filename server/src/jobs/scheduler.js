import cron from "node-cron";
import Post from "../models/Post.model.js";
import User from "../models/User.model.js";
import { Notification } from "../models/Misc.model.js";
import { sendEmail } from "../services/mailer.js";
import { now } from "../services/time.js";
import { archiveExpiredStories } from "../controllers/story.controller.js";
import { runSubscriptionMaintenance } from "../controllers/subscription.controller.js";

export const MAX_PUBLISH_ATTEMPTS = Number(process.env.MAX_PUBLISH_ATTEMPTS || 3);
let running = false;
export async function publishDuePosts() {
  if (running) return { skipped: true };
  running = true;
  let published = 0, failed = 0;
  try {
    const due = await Post.find({ status: "scheduled", isDeleted: false, scheduledAt: { $lte: now() } }).limit(100);
    for (const post of due) {
      // claim atomically so parallel workers don't double-publish
      const claimed = await Post.findOneAndUpdate({ _id: post._id, status: "scheduled" }, { $inc: { publishAttempts: 1 } }, { new: true });
      if (!claimed) continue;
      try {
        const user = await User.findById(claimed.user);
        if (!user) throw new Error("Owner account no longer exists");
        if (user.status !== "active") throw new Error(`Owner account is ${user.status}`);
        if (!claimed.media?.length || claimed.media.some((m) => !m.url)) throw new Error("Post has no valid media");
        claimed.status = "published"; claimed.publishedAt = now();
        await claimed.save();
        await User.updateOne({ _id: user._id }, { $inc: { PostCount: 1 } });
        await Notification.create({ user: user._id, type: "post_published", key: "notif.postPublished", params: { postId: claimed._id } });
        await sendEmail({ to: user.email, subject: "Your scheduled post is live", text: `Hi ${user.fullName},\n\nYour scheduled post "${(claimed.caption || "").slice(0, 80)}" was published at ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST.\n\n— InstAI` });
        published++;
      } catch (e) {
        const final = claimed.publishAttempts >= MAX_PUBLISH_ATTEMPTS;
        await Post.updateOne({ _id: claimed._id }, { $push: { publishErrors: { at: now(), message: e.message } }, ...(final ? { status: "failed" } : {}) });
        console.error(`⚠️  Publish failed for post ${claimed._id} (attempt ${claimed.publishAttempts}/${MAX_PUBLISH_ATTEMPTS}): ${e.message}`);
        if (final) {
          failed++;
          const user = await User.findById(claimed.user);
          if (user) await sendEmail({ to: user.email, subject: "Your scheduled post could not be published", text: `We tried ${MAX_PUBLISH_ATTEMPTS} times but could not publish your scheduled post. Reason: ${e.message}. You can edit and reschedule it from Scheduled posts.` });
        }
      }
    }
  } finally { running = false; }
  return { published, failed };
}

export function startJobs() {
  cron.schedule("* * * * *", () => publishDuePosts().catch((e) => console.error("scheduler", e)));
  cron.schedule("*/5 * * * *", () => archiveExpiredStories().catch((e) => console.error("archiver", e)));
  cron.schedule("15 * * * *", () => runSubscriptionMaintenance().catch((e) => console.error("subs", e)));
  archiveExpiredStories().catch(() => {});
  console.log("⏰ Background jobs started (publisher: every minute, story archiver: every 5 min, subscriptions: hourly)");
}
