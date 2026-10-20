import crypto from "crypto";
import Razorpay from "razorpay";
import User from "../models/User.model.js";
import { Subscription, Notification } from "../models/Misc.model.js";
import { PLAN_CONFIG, PLAN_DAYS, postQuota } from "../services/plans.js";
import { isPaymentWindowOpen, now } from "../services/time.js";
import { sendEmail } from "../services/mailer.js";
import { audit } from "../services/audit.js";

const MOCK_SECRET = "mock_razorpay_secret";
export const isMockMode = () => !(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
const secret = () => (isMockMode() ? MOCK_SECRET : process.env.RAZORPAY_KEY_SECRET);
let rzp = null;
const razorpay = () => (rzp ||= new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET }));
const fail = (res, status, code, message, extra = {}) => res.status(status).json({ success: false, code, message, ...extra });
const WINDOW_MSG = "Payments are currently unavailable. Payments are accepted only between 5:00 AM and 11:00 AM IST. Please try again during that window.";
const fmt = (d) => new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) + " IST";

export const getPlans = async (req, res) => {
  const active = await Subscription.findOne({ user: req.user._id, status: { $in: ["active", "cancelled"] }, endsAt: { $gt: now() } }).sort({ endsAt: -1 });
  res.json({
    success: true,
    plans: Object.entries(PLAN_CONFIG).map(([id, p]) => ({ id, ...p, postLimit: p.postLimit === Infinity ? null : p.postLimit })),
    current: { plan: req.user.effectivePlan(), expiresAt: req.user.planExpiresAt, subscription: active },
    quota: await postQuota(req.user),
    paymentWindow: { open: isPaymentWindowOpen(), start: "05:00", end: "11:00", timezone: "Asia/Kolkata", message: isPaymentWindowOpen() ? null : WINDOW_MSG },
    razorpayKeyId: isMockMode() ? null : process.env.RAZORPAY_KEY_ID,
    mockMode: isMockMode(),
  });
};

export const createOrder = async (req, res) => {
  try {
    const { plan } = req.body;
    if (!PLAN_CONFIG[plan] || plan === "free") return fail(res, 400, "INVALID_PLAN", "Choose a paid plan");
    if (!isPaymentWindowOpen()) return fail(res, 403, "PAYMENT_WINDOW_CLOSED", WINDOW_MSG);
    const amount = PLAN_CONFIG[plan].price;
    const current = req.user.effectivePlan();
    const isRenewal = current === plan;
    let orderId;
    if (isMockMode()) orderId = `order_mock_${crypto.randomBytes(8).toString("hex")}`;
    else {
      const order = await razorpay().orders.create({ amount: amount * 100, currency: "INR", receipt: `rcpt_${Date.now()}`, notes: { userId: String(req.user._id), plan } });
      orderId = order.id;
    }
    const sub = await Subscription.create({ user: req.user._id, plan, amount, razorpayOrderId: orderId, isRenewal });
    await audit(req, "subscription.order_created", { targetType: "subscription", targetId: sub._id, details: { plan, amount, orderId } });
    res.json({ success: true, orderId, amount: amount * 100, currency: "INR", plan, subscriptionId: sub._id, keyId: isMockMode() ? null : process.env.RAZORPAY_KEY_ID, mockMode: isMockMode(), user: { name: req.user.fullName, email: req.user.email, contact: req.user.phone } });
  } catch (e) { console.log(e); fail(res, 500, "PAYMENT_ERROR", e.error?.description || e.message); }
};

async function activate(req, sub, paymentId, signature) {
  const user = await User.findById(sub.user);
  const base = user.plan === sub.plan && user.planExpiresAt && user.planExpiresAt > now() ? user.planExpiresAt : now();
  // a different plan replaces the previous one immediately
  if (user.plan !== sub.plan) await Subscription.updateMany({ user: user._id, status: "active", _id: { $ne: sub._id } }, { status: "cancelled", cancelledAt: now(), autoRenew: false, failureReason: "replaced_by_new_plan" });
  sub.status = "active"; sub.razorpayPaymentId = paymentId; sub.razorpaySignature = signature;
  sub.startsAt = now(); sub.endsAt = new Date(base.getTime() + PLAN_DAYS * 86400000);
  sub.isRenewal = user.plan === sub.plan && base > now();
  sub.invoiceNumber = `INV-${now().toISOString().slice(0, 10).replace(/-/g, "")}-${String(sub._id).slice(-6).toUpperCase()}`;
  user.plan = sub.plan; user.planExpiresAt = sub.endsAt;
  await user.save();
  const p = PLAN_CONFIG[sub.plan];
  await sendEmail({
    to: user.email,
    subject: `Invoice ${sub.invoiceNumber} – InstAI ${p.name} plan`,
    text: [
      `Hi ${user.fullName},`, ``, `Thank you for your payment. Here is your invoice.`, ``,
      `Invoice number : ${sub.invoiceNumber}`, `Plan           : ${p.name} (${p.postLimit === Infinity ? "unlimited" : p.postLimit} posts)`,
      `Amount paid    : ₹${sub.amount}.00 INR`, `Payment ID     : ${paymentId}`, `Order ID       : ${sub.razorpayOrderId}`,
      `Valid from     : ${fmt(sub.startsAt)}`, `Valid until    : ${fmt(sub.endsAt)}`, `Next renewal   : ${fmt(sub.endsAt)}`,
      ``, `— InstAI`,
    ].join("\n"),
  });
  sub.invoiceSentAt = new Date();
  await sub.save();
  await Notification.create({ user: user._id, type: "subscription", key: "notif.subscriptionActive", params: { plan: p.name, until: sub.endsAt } });
  await audit(req, "subscription.activated", { targetType: "subscription", targetId: sub._id, details: { plan: sub.plan, paymentId }, actor: user });
  return { user, sub };
}

export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const sub = await Subscription.findOne({ razorpayOrderId: razorpay_order_id, user: req.user._id });
    if (!sub) return fail(res, 404, "ORDER_NOT_FOUND", "Order not found");
    if (sub.status === "active") return res.json({ success: true, subscription: sub, alreadyProcessed: true });
    if (sub.status !== "created") return fail(res, 400, "ORDER_CLOSED", `Order is ${sub.status}`);
    const expected = crypto.createHmac("sha256", secret()).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
    const valid = razorpay_signature && expected.length === String(razorpay_signature).length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(razorpay_signature)));
    if (!valid) {
      sub.status = "failed"; sub.failureReason = "signature_verification_failed"; sub.razorpayPaymentId = razorpay_payment_id; await sub.save();
      await audit(req, "subscription.verification_failed", { targetType: "subscription", targetId: sub._id });
      return fail(res, 400, "PAYMENT_VERIFICATION_FAILED", "Payment verification failed. If money was deducted it will be refunded.");
    }
    const { user, sub: s } = await activate(req, sub, razorpay_payment_id, razorpay_signature);
    res.json({ success: true, message: "Subscription activated", subscription: s, user });
  } catch (e) { console.log(e); fail(res, 500, "PAYMENT_ERROR", e.message); }
};

export const paymentFailed = async (req, res) => {
  const { orderId, reason } = req.body;
  const sub = await Subscription.findOne({ razorpayOrderId: orderId, user: req.user._id, status: "created" });
  if (!sub) return fail(res, 404, "ORDER_NOT_FOUND", "Order not found");
  sub.status = "failed"; sub.failureReason = String(reason || "payment_failed").slice(0, 300); await sub.save();
  await audit(req, "subscription.payment_failed", { targetType: "subscription", targetId: sub._id, details: { reason } });
  res.json({ success: true, subscription: sub });
};

// Dev-only stand-in for Razorpay Checkout when no keys are configured.
export const mockCheckout = async (req, res) => {
  if (!isMockMode()) return fail(res, 400, "NOT_MOCK", "Real Razorpay keys are configured");
  const { orderId, outcome = "success" } = req.body;
  const paymentId = `pay_mock_${crypto.randomBytes(6).toString("hex")}`;
  if (outcome !== "success") return res.json({ success: true, outcome: "failed", error: { description: "Payment declined (mock)" }, razorpay_order_id: orderId });
  const signature = crypto.createHmac("sha256", MOCK_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
  res.json({ success: true, outcome: "success", razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature });
};

export const cancelSubscription = async (req, res) => {
  const sub = await Subscription.findOne({ user: req.user._id, status: "active", endsAt: { $gt: now() } }).sort({ endsAt: -1 });
  if (!sub) return fail(res, 404, "NO_ACTIVE_SUBSCRIPTION", "No active subscription");
  // cancel every active period (e.g. original + renewal) so records stay consistent
  await Subscription.updateMany({ user: req.user._id, status: "active" }, { status: "cancelled", autoRenew: false, cancelledAt: now() });
  sub.status = "cancelled"; sub.autoRenew = false; sub.cancelledAt = now();
  await sendEmail({ to: req.user.email, subject: "Your InstAI subscription was cancelled", text: `Your ${PLAN_CONFIG[sub.plan].name} plan has been cancelled. You keep its benefits until ${fmt(sub.endsAt)}, after which your account returns to the Free plan.` });
  await audit(req, "subscription.cancelled", { targetType: "subscription", targetId: sub._id });
  res.json({ success: true, subscription: sub, message: `Cancelled. Benefits remain until ${fmt(sub.endsAt)}.` });
};

export const history = async (req, res) => {
  const items = await Subscription.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100);
  res.json({ success: true, items });
};

// Razorpay webhook (optional): payment.failed / payment.captured
export const webhook = async (req, res) => {
  const sig = req.headers["x-razorpay-signature"];
  const ws = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!ws) return res.status(400).json({ success: false });
  const expected = crypto.createHmac("sha256", ws).update(req.rawBody || "").digest("hex");
  if (expected !== sig) return res.status(400).json({ success: false });
  const ev = req.body.event, pay = req.body.payload?.payment?.entity;
  if (pay?.order_id) {
    const sub = await Subscription.findOne({ razorpayOrderId: pay.order_id });
    if (sub && sub.status === "created") {
      if (ev === "payment.failed") { sub.status = "failed"; sub.failureReason = pay.error_description || "payment_failed"; await sub.save(); }
      if (ev === "payment.captured") await activate(null, sub, pay.id, "webhook");
    }
  }
  res.json({ success: true });
};

// cron: expire subscriptions, send renewal reminders
export async function runSubscriptionMaintenance() {
  const t = now();
  const expired = await Subscription.find({ status: { $in: ["active", "cancelled"] }, endsAt: { $lte: t } });
  for (const s of expired) {
    s.status = "expired"; await s.save();
    const u = await User.findById(s.user);
    if (u && (!u.planExpiresAt || u.planExpiresAt <= t)) { u.plan = "free"; u.planExpiresAt = null; await u.save(); await sendEmail({ to: u.email, subject: "Your InstAI plan expired", text: `Your ${PLAN_CONFIG[s.plan].name} plan has expired. Renew any time between 5:00 AM and 11:00 AM IST from Settings → Subscription.` }); }
  }
  const soon = await Subscription.find({ status: "active", autoRenew: true, endsAt: { $gt: t, $lte: new Date(t.getTime() + 3 * 86400000) }, renewalReminderSent: { $ne: true } });
  for (const s of soon) {
    const u = await User.findById(s.user);
    if (u) await sendEmail({ to: u.email, subject: "Renew your InstAI plan", text: `Your ${PLAN_CONFIG[s.plan].name} plan renews on ${fmt(s.endsAt)}. Open Settings → Subscription and click Renew (payments accepted 5:00–11:00 AM IST).` });
    await Subscription.updateOne({ _id: s._id }, { $set: { renewalReminderSent: true } });
  }
  return { expired: expired.length, reminded: soon.length };
}
