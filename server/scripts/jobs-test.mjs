// Tests background jobs + time-window rules directly against an in-memory MongoDB.
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
process.env.JWT_SECRET = "x";
const mem = await MongoMemoryServer.create();
await mongoose.connect(mem.getUri());
const User = (await import("../src/models/User.model.js")).default;
const Post = (await import("../src/models/Post.model.js")).default;
const { Story, StoryView } = await import("../src/models/Story.model.js");
const { archiveExpiredStories } = await import("../src/controllers/story.controller.js");
const { publishDuePosts } = await import("../src/jobs/scheduler.js");
const { runSubscriptionMaintenance } = await import("../src/controllers/subscription.controller.js");
const { Subscription } = await import("../src/models/Misc.model.js");
const { isPaymentWindowOpen, isMobileLoginWindowOpen } = await import("../src/services/time.js");
const { parseUA } = await import("../src/services/device.js");
await mongoose.connection.syncIndexes();
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log(c ? "  ✔" : "  ✘", m); };

const u = await User.create({ username: "j", fullName: "J", email: "j@t.dev", password: "x" });
const v = await User.create({ username: "k", fullName: "K", email: "k@t.dev", password: "x" });
const s = await Story.create({ user: u._id, media: [{ url: "a", type: "image" }], expiresAt: new Date(Date.now() - 1000), viewsCount: 3, uniqueViewers: 1 });
await StoryView.create({ story: s._id, owner: u._id, viewer: v._id });
let dup = false; try { await StoryView.create({ story: s._id, owner: u._id, viewer: v._id }); } catch (e) { dup = e.code === 11000; }
ok(dup, "unique index rejects duplicate view record");
ok((await archiveExpiredStories()) === 1, "cron archives expired story");
const after = await Story.findById(s._id);
ok(after.isArchived && after.viewsCount === 3 && (await StoryView.countDocuments({ story: s._id })) === 1, "analytics retained after archive");
const idx = await StoryView.collection.indexes();
ok(idx.some((i) => i.unique && i.key.story === 1 && i.key.viewer === 1), "StoryView unique (story,viewer) index present");

// scheduler retry + failure
const good = await Post.create({ user: u._id, media: [{ url: "x", type: "image" }], status: "scheduled", scheduledAt: new Date(Date.now() - 1000) });
const banned = await User.create({ username: "b", fullName: "B", email: "b@t.dev", password: "x", status: "suspended" });
const bad = await Post.create({ user: banned._id, media: [{ url: "x", type: "image" }], status: "scheduled", scheduledAt: new Date(Date.now() - 1000) });
await publishDuePosts();
ok((await Post.findById(good._id)).status === "published", "due post published");
let b = await Post.findById(bad._id);
ok(b.status === "scheduled" && b.publishAttempts === 1 && b.publishErrors.length === 1, "failure logged and retried");
await publishDuePosts(); await publishDuePosts();
b = await Post.findById(bad._id);
ok(b.status === "failed" && b.publishAttempts === 3, "marked failed after max retries");

// subscription expiry
u.plan = "gold"; u.planExpiresAt = new Date(Date.now() - 1000); await u.save();
await Subscription.create({ user: u._id, plan: "gold", amount: 1000, status: "active", endsAt: new Date(Date.now() - 1000) });
await runSubscriptionMaintenance();
ok((await User.findById(u._id)).plan === "free", "expired subscription downgrades to free");

// time windows
const ist = (h, m = 0) => new Date(Date.UTC(2026, 9, 20, h, m) - 330 * 60000);
ok(isPaymentWindowOpen(ist(5, 0)) && isPaymentWindowOpen(ist(10, 59)) && !isPaymentWindowOpen(ist(11, 0)) && !isPaymentWindowOpen(ist(4, 59)), "payment window 05:00–11:00 IST");
const srv = (h) => { const d = new Date(); d.setHours(h, 0, 0, 0); return d; };
ok(isMobileLoginWindowOpen(srv(10)) && isMobileLoginWindowOpen(srv(12)) && !isMobileLoginWindowOpen(srv(13)) && !isMobileLoginWindowOpen(srv(9)), "mobile login window 10:00–13:00 server time");
ok(parseUA("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/130 Safari/537.36 Edg/130.0").browser === "Microsoft Edge", "Edge detected before Chrome");
ok(parseUA("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36").deviceType === "Mobile", "Android phone = Mobile");
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
await mongoose.disconnect(); await mem.stop(); process.exit(fail ? 1 : 0);
