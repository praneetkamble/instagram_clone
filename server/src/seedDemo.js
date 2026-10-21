// Demo data so the app looks alive. Enabled with SEED_DEMO=true (idempotent: skips if demo users exist).
import bcrypt from "bcrypt";
import User from "./models/User.model.js";
import Post from "./models/Post.model.js";
import Follow from "./models/Follow.model.js";
import Like from "./models/Like.model.js";
import { Comment, Notification } from "./models/Misc.model.js";
import { Story, StoryView, StoryReaction, StoryReply } from "./models/Story.model.js";

const PEOPLE = [
  ["aanya.travels", "Aanya Mehta", "Chasing sunsets across 30 countries ✈️", 47],
  ["rohan.eats", "Rohan Desai", "Street food is my love language 🍜", 12],
  ["mira.studio", "Mira Kapoor", "Designer · Minimalism · Coffee", 32],
  ["kabir.lens", "Kabir Singh", "Shot on film 📷", 68],
  ["zoe.fit", "Zoe Fernandes", "Coach · 5am club", 45],
  ["arjun.codes", "Arjun Rao", "Building things on the internet", 15],
  ["isha.art", "Isha Nair", "Watercolours & stories 🎨", 26],
  ["leo.wild", "Leo Thomas", "Wildlife · Western Ghats 🐅", 53],
];
const CAPTIONS = [
  "Golden hour hits different here 🌅 #travel #sunset", "Found the best vada pav in Mumbai. Fight me. #food",
  "New studio corner ✨ less is more #design", "Monsoon mornings on film 🌧️ #35mm",
  "Leg day done. No excuses 💪 #fitness", "Shipped a side project this weekend 🚀 #buildinpublic",
  "Work in progress — what should I call it? #art", "Spotted this beauty at dawn 🐆 #wildlife",
  "Weekend escape to the hills 🏔️", "Coffee + sketchbook = perfect Sunday ☕",
];
const img = (s, w = 1080, h = 1080) => `https://picsum.photos/seed/${s}/${w}/${h}`;
const avatar = (n) => `https://i.pravatar.cc/300?img=${n}`;
const ago = (min) => new Date(Date.now() - min * 60000);

export async function seedDemo(admin) {
  if (await User.exists({ username: PEOPLE[0][0] })) return;
  const pw = await bcrypt.hash("Demo@12345", 10);
  const users = await User.insertMany(PEOPLE.map(([username, fullName, bio, a], i) => ({
    username, fullName, bio, email: `${username.replace(".", "_")}@demo.instai.dev`, password: pw, isVerified: true,
    profilePicture: avatar(a), phone: `+9198000000${i + 10}`, plan: ["free", "bronze", "silver", "gold"][i % 4],
    planExpiresAt: i % 4 ? new Date(Date.now() + 20 * 864e5) : null, createdAt: ago(60 * 24 * (i * 3 + 2)),
  })));
  if (admin && !admin.profilePicture) { admin.profilePicture = avatar(8); admin.bio = "Running InstAI ✨"; await admin.save(); }
  const all = [admin, ...users].filter(Boolean);
  // follow graph: admin follows everyone, everyone follows admin + neighbours
  const follows = [];
  for (const u of users) { follows.push({ follower: admin._id, following: u._id }, { follower: u._id, following: admin._id }); }
  users.forEach((u, i) => [1, 2, 3].forEach((d) => follows.push({ follower: u._id, following: users[(i + d) % users.length]._id })));
  await Follow.insertMany(follows, { ordered: false }).catch(() => {});
  for (const u of all) {
    u.followersCount = follows.filter((f) => String(f.following) === String(u._id)).length;
    u.followingCount = follows.filter((f) => String(f.follower) === String(u._id)).length;
    await u.save();
  }
  // posts
  const posts = [];
  users.forEach((u, i) => [0, 1, 2].forEach((k) => {
    const n = i * 3 + k, t = ago(40 + n * 95);
    posts.push({ user: u._id, media: [{ url: img(`ig${n}`, 1080, k === 1 ? 1350 : 1080), type: "image" }], caption: CAPTIONS[(i + k * 3) % CAPTIONS.length], location: ["Goa", "Mumbai", "Pune", "Munnar", "Jaipur"][n % 5], status: "published", publishedAt: t, createdAt: t, updatedAt: t });
  }));
  const created = await Post.insertMany(posts);
  const likes = [], comments = [];
  created.forEach((p, i) => {
    const likers = all.filter((u, j) => (i + j) % 3 !== 0 && String(u._id) !== String(p.user));
    likers.forEach((u) => likes.push({ post: p._id, user: u._id }));
    p.likesCount = likers.length;
    ["This is stunning 😍", "Need to go here!", "Wow 🔥", "Saving this"].slice(0, (i % 3) + 1).forEach((text, j) => comments.push({ post: p._id, user: all[(i + j + 1) % all.length]._id, text }));
    p.commentsCount = (i % 3) + 1;
  });
  await Like.insertMany(likes, { ordered: false }).catch(() => {});
  await Comment.insertMany(comments);
  await Promise.all(created.map((p) => Post.updateOne({ _id: p._id }, { likesCount: p.likesCount, commentsCount: p.commentsCount })));
  // stories for demo users + an admin story with rich analytics
  const expires = new Date(Date.now() + 20 * 3600e3);
  await Story.insertMany(users.slice(0, 7).map((u, i) => ({ user: u._id, media: [{ url: img(`st${i}`, 1080, 1920), type: "image", duration: 5 }], expiresAt: expires, createdAt: ago(30 + i * 40) })));
  if (admin) {
    const st = await Story.create({ user: admin._id, media: [{ url: img("adminstory1", 1080, 1920), type: "image", duration: 5 }, { url: img("adminstory2", 1080, 1920), type: "image", duration: 5 }], caption: "Launch day 🚀", expiresAt: new Date(Date.now() + 16 * 3600e3), createdAt: ago(8 * 60) });
    const views = users.map((u, i) => ({ story: st._id, owner: admin._id, viewer: u._id, viewCount: 1 + (i % 3), maxMediaIndex: i % 4 ? 1 : 0, completed: i % 4 !== 0, firstViewedAt: ago(8 * 60 - 20 - i * 52), lastViewedAt: ago(5) }));
    await StoryView.insertMany(views);
    const emojis = ["😍", "🔥", "👏", "😂", "🎉"];
    await StoryReaction.insertMany(users.slice(0, 5).map((u, i) => ({ story: st._id, user: u._id, emoji: emojis[i] })));
    await StoryReply.insertMany([["Congrats!! 🎉", 1], ["This looks amazing", 3], ["Can't wait to try it", 6]].map(([text, i]) => ({ story: st._id, user: users[i]._id, text })));
    await Story.updateOne({ _id: st._id }, { viewsCount: views.reduce((a, v) => a + v.viewCount, 0), uniqueViewers: views.length, completedViews: views.filter((v) => v.completed).length, reactionsCount: 5, repliesCount: 3 });
    await Notification.insertMany([
      ...users.slice(0, 5).map((u, i) => ({ user: admin._id, type: "story_reaction", key: "notif.storyReaction", params: { username: u.username, emoji: emojis[i] }, createdAt: ago(10 + i * 30) })),
      ...[1, 3, 6].map((i, k) => ({ user: admin._id, type: "story_reply", key: "notif.storyReply", params: { username: users[i].username }, read: k > 0, createdAt: ago(200 + k * 60) })),
    ]);
  }
  console.log(`✅ Demo data: ${users.length} users, ${created.length} posts, stories with views (password Demo@12345)`);
}
