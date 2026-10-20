// End-to-end API test. Usage: BASE=http://localhost:5055 LOG=/tmp/server.log node scripts/e2e.mjs
import fs from "fs";
import { io } from "socket.io-client";
const BASE = process.env.BASE || "http://localhost:5000", LOG = process.env.LOG || "/tmp/server.log";
const UA = {
  chrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  edge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  mobile: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  firefox: "Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0",
};
let pass = 0, failN = 0;
const ok = (c, m, extra) => { if (c) { pass++; console.log("  ✔", m); } else { failN++; console.log("  ✘", m, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ""); } };
async function api(method, path, { token, body, ua = UA.edge } = {}) {
  const r = await fetch(BASE + path, { method, headers: { "content-type": "application/json", "user-agent": ua, ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch {}
  return { status: r.status, ...j };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lastCode = (to) => { const log = fs.readFileSync(LOG, "utf8"); const re = new RegExp(`to=${to.replace(/[+.]/g, "\\$&")}[\\s\\S]*?code is (\\d{6})`, "g"); let m, c; while ((m = re.exec(log))) c = m[1]; return c; };
const rnd = Math.random().toString(36).slice(2, 7);
const mk = async (n, phone) => { const r = await api("POST", "/api/auth/register", { body: { username: `${n}_${rnd}`, fullName: n, email: `${n}_${rnd}@test.dev`, password: "secret123", phone } }); return { ...r.user, token: r.accessToken }; };

console.log("\n== 4. Login security ==");
const alice = await mk("alice", "+919800000001"), bob = await mk("bob", "+919800000002"), carol = await mk("carol", "+919800000003");
ok(alice.token && bob.token, "register with phone");
let r = await api("POST", "/api/auth/register", { body: { username: "x" + rnd, fullName: "x", email: "bad", password: "secret123" } });
ok(r.code === "INVALID_EMAIL", "register validation");
r = await api("POST", "/api/auth/login", { ua: UA.edge, body: { email: alice.email, password: "secret123" } });
ok(r.success && r.accessToken && !r.otpRequired, "Edge login without OTP");
r = await api("POST", "/api/auth/login", { ua: UA.chrome, body: { email: alice.email, password: "secret123" } });
ok(r.otpRequired && r.challengeToken, "Chrome login requires email OTP", r);
await sleep(300);
const bad = await api("POST", "/api/auth/login/verify-otp", { ua: UA.chrome, body: { challengeToken: r.challengeToken, code: "000000" } });
ok(bad.code === "OTP_WRONG" && bad.attemptsLeft === 2, "wrong OTP rejected with attempts left", bad);
const code = lastCode(alice.email);
const good = await api("POST", "/api/auth/login/verify-otp", { ua: UA.chrome, body: { challengeToken: r.challengeToken, code } });
ok(good.success && good.accessToken, "Chrome OTP verify -> login", good);
const reuse = await api("POST", "/api/auth/login/verify-otp", { ua: UA.chrome, body: { challengeToken: r.challengeToken, code } });
ok(!reuse.success, "OTP cannot be reused");
r = await api("POST", "/api/auth/login", { ua: UA.mobile, body: { email: alice.email, password: "secret123" } });
const h = new Date().getHours();
ok(h >= 10 && h < 13 ? r.success : r.code === "MOBILE_LOGIN_WINDOW", `mobile login obeys 10-13 window (server hour ${h})`, r);
r = await api("POST", "/api/auth/login", { body: { email: alice.email, password: "wrong" } });
ok(r.code === "INVALID_CREDENTIALS", "wrong password logged");
// lockout via repeated OTP failures on carol
let lc = await api("POST", "/api/auth/login", { ua: UA.chrome, body: { email: carol.email, password: "secret123" } });
let lastErr;
for (let i = 0; i < 6; i++) { lastErr = await api("POST", "/api/auth/login/verify-otp", { ua: UA.chrome, body: { challengeToken: lc.challengeToken, code: "111111" } }); if (lastErr.code === "OTP_ATTEMPTS_EXCEEDED") lc = await api("POST", "/api/auth/login/resend-otp", { body: { challengeToken: lc.challengeToken } }); }
ok(lastErr.code === "OTP_LOCKED", "lockout after repeated OTP failures", lastErr);
r = await api("GET", "/api/auth/login-history", { token: alice.token });
const statuses = r.items.map((i) => i.status);
ok(statuses.includes("success") && statuses.includes("failed") && statuses.includes("otp_required"), "login history records success/failed/otp", statuses);
const edgeRow = r.items.find((i) => i.browser === "Microsoft Edge"), chromeRow = r.items.find((i) => i.browser === "Chrome");
ok(edgeRow && chromeRow && edgeRow.os === "Windows" && edgeRow.deviceType && edgeRow.ip, "browser/os/device/ip captured (Edge vs Chrome distinguished)");
r = await api("GET", "/api/auth/sessions", { token: alice.token });
ok(r.items?.length >= 1, "sessions listed");
const lo = await api("POST", "/api/auth/login", { body: { email: alice.email, password: "secret123" } });
await api("POST", "/api/auth/logout", { token: lo.accessToken });
r = await api("GET", "/api/auth/me", { token: lo.accessToken });
ok(r.status === 401, "logout revokes session");

console.log("\n== 2. Language with OTP ==");
r = await api("POST", "/api/auth/language/request", { token: alice.token, body: { language: "fr" } });
ok(r.otpRequired && r.channel === "email", "French -> email OTP", r);
let c2 = lastCode(alice.email);
r = await api("POST", "/api/auth/language/verify", { token: alice.token, body: { otpId: r.otpId, code: c2 } });
ok(r.user?.language === "fr", "language set to fr");
r = await api("POST", "/api/auth/language/request", { token: alice.token, body: { language: "hi" } });
ok(r.otpRequired && r.channel === "sms", "Hindi -> SMS OTP", r);
c2 = lastCode("+919800000001");
r = await api("POST", "/api/auth/language/verify", { token: alice.token, body: { otpId: r.otpId, code: c2 } });
ok(r.user?.language === "hi", "language set to hi");
const nophone = await mk("dave");
r = await api("POST", "/api/auth/language/request", { token: nophone.token, body: { language: "es" } });
ok(r.code === "PHONE_REQUIRED", "SMS language change needs phone");
r = await api("PUT", "/api/auth/profile", { token: nophone.token, body: { phone: "12" } });
ok(r.code === "INVALID_PHONE", "phone validation");
r = await api("POST", "/api/auth/login", { body: { email: alice.email, password: "secret123" } });
ok(r.user.language === "hi", "language persists across logins");

console.log("\n== 1. Stories + analytics ==");
await api("POST", `/api/follow/${alice._id}`, { token: bob.token });
await api("POST", `/api/auth/close-friends/${bob._id}`, { token: alice.token });
const mediaArr = [{ url: "https://picsum.photos/400/700", type: "image" }, { url: "https://www.w3schools.com/html/mov_bbb.mp4", type: "video", duration: 10 }];
const s1 = (await api("POST", "/api/stories", { token: alice.token, body: { media: mediaArr, privacy: "public", caption: "hi" } })).story;
const s2 = (await api("POST", "/api/stories", { token: alice.token, body: { media: [mediaArr[0]], privacy: "close_friends" } })).story;
const s3 = (await api("POST", "/api/stories", { token: alice.token, body: { media: [mediaArr[0]], privacy: "followers" } })).story;
ok(s1?.media.length === 2 && new Date(s1.expiresAt) - Date.now() > 23.9 * 3600e3, "story with multiple media, 24h expiry");
r = await api("GET", "/api/stories/feed", { token: bob.token });
ok(r.groups?.[0]?.stories.length === 3, "follower+close friend sees all 3", r.groups?.map((g) => g.stories.length));
r = await api("GET", `/api/stories/user/${alice._id}`, { token: carol.token });
ok(r.stories?.length === 1, "non-follower sees only public story");
r = await api("POST", `/api/stories/${s2._id}/view`, { token: carol.token, body: {} });
ok(r.status === 403, "close friends privacy enforced");
const events = [];
// Serverless (Vercel) mode has no Socket.io server: verify live analytics through polling instead.
const SERVERLESS = (await api("GET", "/api/health")).runtime === "vercel";
let sock = null, pollBefore = null;
if (SERVERLESS) pollBefore = (await api("GET", `/api/stories/${s1._id}/analytics`, { token: alice.token })).totals;
else {
  sock = io(BASE, { transports: ["websocket"] });
  await new Promise((res) => sock.on("connect", res));
  sock.emit("setup", alice._id);
  sock.on("story:analytics", (e) => events.push(e));
  await sleep(300);
}
await api("POST", `/api/stories/${s1._id}/view`, { token: bob.token, body: { mediaIndex: 0 } });
await api("POST", `/api/stories/${s1._id}/view`, { token: bob.token, body: { mediaIndex: 1, completed: true } });
await Promise.all([1, 2, 3].map(() => api("POST", `/api/stories/${s1._id}/view`, { token: carol.token, body: { mediaIndex: 0 } })));
await api("POST", `/api/stories/${s1._id}/view`, { token: alice.token, body: {} });
await api("POST", `/api/stories/${s1._id}/react`, { token: bob.token, body: { emoji: "🔥" } });
await api("POST", `/api/stories/${s1._id}/react`, { token: bob.token, body: { emoji: "😍" } });
r = await api("POST", `/api/stories/${s1._id}/reply`, { token: carol.token, body: { text: "nice!", toDM: true } });
ok(r.messageId, "story reply delivered into DM");
await api("POST", `/api/stories/${s1._id}/reply`, { token: bob.token, body: { text: "story-only reply", toDM: false } });
await sleep(400);
const an = await api("GET", `/api/stories/${s1._id}/analytics`, { token: alice.token });
ok(an.totals?.uniqueViewers === 2, "unique viewers counted once (concurrent views, owner excluded)", an.totals);
ok(an.totals?.viewsCount === 5, "total views counted", an.totals);
ok(an.totals?.reactionsCount === 1 && an.reactions?.[0]?.emoji === "😍", "reactions (one per user, updatable)");
ok(an.totals?.repliesCount === 2 && an.replies.length === 2, "replies counted");
ok(an.totals?.completionRate === 50, "completion rate 50%", an.totals);
ok(an.viewers?.length === 2 && an.timeline?.length >= 1, "viewer list + timeline");
if (SERVERLESS) ok(pollBefore && pollBefore.viewsCount === 0 && an.totals.viewsCount === 5 && an.totals.reactionsCount === 1 && an.totals.repliesCount === 2, "live analytics visible to polling clients (serverless mode)", { pollBefore, after: an.totals });
else ok(events.some((e) => e.type === "view") && events.some((e) => e.type === "reaction") && events.some((e) => e.type === "reply"), "real-time socket analytics events", events.map((e) => e.type));
r = await api("GET", `/api/stories/${s1._id}/analytics`, { token: bob.token });
ok(r.status === 404, "analytics owner-only");
r = await api("POST", "/api/stories/highlights", { token: alice.token, body: { title: "Trip", storyIds: [s1._id, s3._id] } });
ok(r.highlight?.stories.length === 2, "highlight created");
r = await api("GET", `/api/stories/highlights/${alice._id}`, { token: bob.token });
ok(r.items?.[0]?.stories?.length === 2, "highlights listed");
r = await api("DELETE", `/api/stories/${s3._id}`, { token: alice.token });
r = await api("GET", "/api/stories/feed", { token: bob.token });
ok(r.groups[0].stories.length === 2, "owner deleted story before expiry");
r = await api("GET", "/api/stories/mine?scope=archived&includeDeleted=true", { token: alice.token });
ok(r.items.some((s) => s._id === s3._id), "deleted story archived; analytics retained");
sock?.close();

console.log("\n== 3. Subscriptions ==");
const post = (t, extra = {}) => api("POST", "/api/posts", { token: t, body: { caption: "hello #sun", media: [{ url: "https://picsum.photos/600", type: "image" }], ...extra } });
r = await post(bob.token); ok(r.success, "free plan: 1st post ok");
r = await post(bob.token); ok(r.code === "POST_LIMIT_REACHED", "free plan: 2nd post blocked server-side");
r = await api("GET", "/api/subscriptions/plans", { token: bob.token });
ok(r.plans?.length === 4 && r.paymentWindow, "plans + payment window info", r.paymentWindow);
const windowOpen = r.paymentWindow.open;
const order = await api("POST", "/api/subscriptions/order", { token: bob.token, body: { plan: "bronze" } });
if (!windowOpen) ok(order.code === "PAYMENT_WINDOW_CLOSED", "payment outside 5-11 IST rejected", order);
else {
  ok(order.orderId, "order created", order);
  const badv = await api("POST", "/api/subscriptions/verify", { token: bob.token, body: { razorpay_order_id: order.orderId, razorpay_payment_id: "pay_x", razorpay_signature: "deadbeef" } });
  ok(badv.code === "PAYMENT_VERIFICATION_FAILED", "invalid signature rejected + recorded failed");
  const o2 = await api("POST", "/api/subscriptions/order", { token: bob.token, body: { plan: "bronze" } });
  const pay = await api("POST", "/api/subscriptions/mock-checkout", { token: bob.token, body: { orderId: o2.orderId } });
  const v = await api("POST", "/api/subscriptions/verify", { token: bob.token, body: pay });
  ok(v.success && v.user.plan === "bronze", "signature verified -> bronze active", v);
  await sleep(200);
  ok(fs.readFileSync(LOG, "utf8").includes("Invoice INV-"), "invoice email sent");
  r = await post(bob.token); ok(r.success, "bronze: 2nd post ok");
  r = await post(bob.token); ok(r.success, "bronze: 3rd post ok");
  r = await post(bob.token); ok(r.code === "POST_LIMIT_REACHED", "bronze: 4th blocked");
  const o3 = await api("POST", "/api/subscriptions/order", { token: bob.token, body: { plan: "bronze" } });
  const p3 = await api("POST", "/api/subscriptions/mock-checkout", { token: bob.token, body: { orderId: o3.orderId } });
  const v3 = await api("POST", "/api/subscriptions/verify", { token: bob.token, body: p3 });
  ok(v3.subscription?.isRenewal && new Date(v3.user.planExpiresAt) - Date.now() > 59 * 86400e3, "renewal extends validity", v3.subscription);
  const o4 = await api("POST", "/api/subscriptions/order", { token: bob.token, body: { plan: "gold" } });
  const f4 = await api("POST", "/api/subscriptions/failure", { token: bob.token, body: { orderId: o4.orderId, reason: "card declined" } });
  ok(f4.subscription?.status === "failed", "payment failure recorded");
  r = await api("POST", "/api/subscriptions/cancel", { token: bob.token });
  ok(r.subscription?.status === "cancelled", "cancellation");
  r = await api("GET", "/api/subscriptions/history", { token: bob.token });
  ok(r.items.length === 4 && r.items.filter((i) => i.status === "cancelled").length === 2 && r.items.filter((i) => i.status === "failed").length === 2, "accurate subscription records", r.items.map((i) => i.status));
}

console.log("\n== 6. Scheduling ==");
// give carol gold via admin to test scheduling without the payment window
const adminLogin = await api("POST", "/api/auth/login", { body: { email: "admin@instai.dev", password: "Admin@12345" } });
const at = adminLogin.accessToken;
ok(at && adminLogin.user.role === "admin", "admin login (seeded)");
await api("PUT", `/api/admin/users/${carol._id}`, { token: at, body: { plan: "gold", planExpiresAt: new Date(Date.now() + 30 * 86400e3) } });
const lockedCarolLogin = await api("POST", "/api/auth/login", { body: { email: carol.email, password: "secret123" } });
const ct = lockedCarolLogin.accessToken || carol.token;
const future = (min) => new Date(Date.now() + min * 60000).toISOString();
r = await post(ct, { scheduledAt: new Date(Date.now() - 60000).toISOString() }); ok(r.code === "SCHEDULE_PAST", "past date rejected");
const sp1 = (await post(ct, { scheduledAt: future(1), caption: "sched #one", taggedUsers: [bob.username], location: "Pune", hashtags: ["extra"] })).post;
const sp2 = (await post(ct, { scheduledAt: future(60) })).post;
ok(sp1?.status === "scheduled" && sp1.hashtags.includes("one") && sp1.hashtags.includes("extra") && sp1.taggedUsers.length === 1 && sp1.location === "Pune", "scheduled with hashtags/tags/location");
r = await post(ct, { scheduledAt: future(90) }); ok(r.code === "SCHEDULE_LIMIT", "max 2 scheduled");
r = await api("GET", "/api/posts", { token: bob.token }); ok(!r.posts.some((p) => p._id === sp1._id), "hidden until published");
r = await api("PUT", `/api/posts/scheduled/${sp2._id}`, { token: ct, body: { caption: "edited", scheduledAt: future(120) } }); ok(r.post?.caption === "edited", "edit + reschedule");
r = await api("POST", `/api/posts/scheduled/${sp2._id}/cancel`, { token: ct }); ok(r.post?.status === "cancelled", "cancel");
r = await api("GET", "/api/posts/scheduled", { token: ct }); ok(r.items.length === 2, "view my scheduled list");
console.log("  … waiting up to 130s for scheduler");
let published = false;
for (let i = 0; i < 26 && !published; i++) { await sleep(5000); r = await api("GET", "/api/posts", { token: bob.token }); published = r.posts.some((p) => p._id === sp1._id); }
ok(published, SERVERLESS ? "due post published lazily on read (no cron process)" : "background scheduler published the post");
if (SERVERLESS) {
  r = await api("GET", "/api/cron/tick"); ok(r.status === 401, "cron endpoint rejects missing secret");
  if (process.env.CRON_SECRET) { r = await api("GET", `/api/cron/tick?key=${process.env.CRON_SECRET}`); ok(r.success && r.posts?.ok && r.stories?.ok && r.subs?.ok, "cron tick runs all jobs", r); }
}
ok(fs.readFileSync(LOG, "utf8").includes("Your scheduled post is live"), "publish email sent");
r = await api("GET", "/api/admin/scheduled?status=published", { token: at }); ok(r.items.some((p) => p._id === sp1._id), "admin scheduled filter: Published");
r = await api("GET", "/api/admin/scheduled?status=cancelled&q=edited", { token: at }); ok(r.items.length === 1, "admin scheduled filter: Cancelled + search");

console.log("\n== 5. Admin ==");
r = await api("GET", "/api/admin/stats", { token: bob.token }); ok(r.status === 403, "non-admin blocked");
r = await api("GET", "/api/admin/stats", { token: at }); ok(r.stats?.users >= 5, "summary stats", r.stats);
r = await api("GET", `/api/admin/users?q=alice&sort=username&order=asc&page=1&limit=5`, { token: at }); ok(r.items.length === 1 && r.total === 1, "user keyword search");
r = await api("GET", `/api/admin/users?plan=gold`, { token: at }); ok(r.items.every((u) => u.plan === "gold") && r.items.length >= 1, "filter by plan");
r = await api("GET", `/api/admin/users?activity=active&verified=false&status=active&from=2020-01-01&to=2100-01-01`, { token: at }); ok(r.items.length >= 4, "filter activity/verification/status/date range");
r = await api("GET", `/api/admin/posts?visibility=public&status=published`, { token: at }); ok(r.total >= 1, "filter posts by visibility/status");
const pid = r.items[0]._id;
r = await api("POST", "/api/posts/" + pid + "/comments", { token: alice.token, body: { text: "great" } }); ok(r.comment, "comment created");
const cid = r.comment._id;
r = await api("POST", "/api/posts/reports", { token: alice.token, body: { targetType: "post", targetId: pid, reason: "spam" } }); ok(r.report, "report created");
const rid = r.report._id;
r = await api("PUT", `/api/admin/reports/${rid}`, { token: at, body: { status: "resolved", resolutionNote: "ok" } }); ok(r.item?.status === "resolved", "update report");
r = await api("GET", `/api/admin/reports?status=resolved`, { token: at }); ok(r.total === 1, "filter by report status");
r = await api("PUT", `/api/admin/comments/${cid}`, { token: at, body: { isHidden: true } }); ok(r.item?.isHidden, "update comment");
r = await api("DELETE", `/api/admin/comments/${cid}`, { token: at }); ok(r.success, "delete comment");
r = await api("GET", `/api/admin/stories?state=deleted`, { token: at }); ok(r.total >= 1, "stories filter");
r = await api("GET", `/api/admin/subscriptions?status=active`, { token: at }); ok(r.success, "subscriptions list");
const nu = await api("POST", `/api/admin/users`, { token: at, body: { username: "made_" + rnd, fullName: "Made", email: `made_${rnd}@t.dev`, password: "secret123" } }); ok(nu.item, "admin create user");
r = await api("PUT", `/api/admin/users/${nu.item._id}`, { token: at, body: { status: "suspended" } }); ok(r.item?.status === "suspended", "suspend user");
r = await api("DELETE", `/api/admin/users/${nu.item._id}`, { token: at }); ok(r.success, "delete user");
r = await api("DELETE", `/api/admin/posts/${pid}`, { token: at }); ok(r.success, "delete post");
r = await api("GET", `/api/admin/audit-logs?action=admin`, { token: at }); ok(r.items.length >= 8, "audit log records admin actions", r.items?.map((i) => i.action));
r = await api("GET", `/api/admin/login-history?status=failed`, { token: at }); ok(r.total >= 1, "admin login-history view");

console.log(`\nRESULT: ${pass} passed, ${failN} failed`);
process.exit(failN ? 1 : 0);
