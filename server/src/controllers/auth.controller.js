import User, { LANGUAGES } from "../models/User.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { generateAccessToken, generateChallengeToken } from "../utils/generateToken.js";
import Post, { PUBLISHED } from "../models/Post.model.js";
import Like from "../models/Like.model.js";
import Follow from "../models/Follow.model.js";
import { LoginHistory, Session, SecurityLock } from "../models/Security.model.js";
import { parseUA, clientIp } from "../services/device.js";
import { issueOtp, verifyOtp, OtpError, checkLock } from "../services/otp.js";
import { isMobileLoginWindowOpen, now } from "../services/time.js";
import { audit } from "../services/audit.js";

const fail = (res, status, code, message, extra = {}) => res.status(status).json({ success: false, code, message, ...extra });
const handle = (res, error) => {
  if (error instanceof OtpError) return fail(res, error.status, error.code, error.message, error.extra);
  console.log(error);
  return fail(res, 500, "SERVER_ERROR", error.message);
};
const PHONE_RE = /^\+?[1-9]\d{7,14}$/;
const normPhone = (p = "") => String(p).replace(/[\s()-]/g, "");
const PASSWORD_MAX_FAILURES = Number(process.env.LOGIN_MAX_FAILURES || 5);
const PASSWORD_LOCK_MIN = Number(process.env.LOGIN_LOCK_MIN || 15);

async function createSession(req, user, device) {
  const s = await Session.create({ user: user._id, browser: device.browser, os: device.os, deviceType: device.deviceType, ip: clientIp(req), expiresAt: new Date(Date.now() + 86400000) });
  user.lastLoginAt = new Date(); await user.save();
  return { accessToken: generateAccessToken(user._id, { sid: s._id, tv: user.tokenVersion || 0 }), sessionId: s._id };
}
async function logAttempt(req, user, email, device, status, reason) {
  await LoginHistory.create({ user: user?._id, email, browser: device.browser, browserVersion: device.browserVersion, os: device.os, deviceType: device.deviceType, ip: clientIp(req), userAgent: req.headers["user-agent"] || "", status, reason });
}

export const register = async (req, res) => {
  try {
    const { username, fullName, email, password, profilePicture, phone, language } = req.body;
    if (!username || !fullName || !email || !password) return fail(res, 400, "FIELDS_REQUIRED", "All fields are required");
    if (!/^\S+@\S+\.\S+$/.test(email)) return fail(res, 400, "INVALID_EMAIL", "Enter a valid email address");
    if (String(password).length < 6) return fail(res, 400, "PASSWORD_SHORT", "Password must be at least 6 characters");
    if (phone && !PHONE_RE.test(normPhone(phone))) return fail(res, 400, "INVALID_PHONE", "Enter a valid mobile number with country code, e.g. +919876543210");
    const exists = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
    if (exists) return fail(res, 400, "USER_EXISTS", "User already exists");
    const user = await User.create({
      username, fullName, email, phone: phone ? normPhone(phone) : "",
      password: await bcrypt.hash(password, 10), profilePicture,
      language: LANGUAGES.includes(language) ? language : "en",
    });
    const device = parseUA(req.headers["user-agent"]);
    const { accessToken } = await createSession(req, user, device);
    await logAttempt(req, user, user.email, device, "success", "registration");
    res.status(201).json({ success: true, message: "User Created Successfully", accessToken, user });
  } catch (error) { handle(res, error); }
};

export const login = async (req, res) => {
  const device = parseUA(req.headers["user-agent"]);
  try {
    const { email, password } = req.body;
    if (!email || !password) return fail(res, 400, "FIELDS_REQUIRED", "All fields are required");
    const user = await User.findOne({ email: String(email).toLowerCase() }).select("+password");
    if (!user) { await logAttempt(req, null, email, device, "failed", "unknown_email"); return fail(res, 400, "INVALID_CREDENTIALS", "Invalid email or password."); }
    const key = `password:${user._id}`;
    const lock = await SecurityLock.findOne({ key });
    if (lock?.lockedUntil && lock.lockedUntil > now()) {
      await logAttempt(req, user, email, device, "locked", "too_many_failures");
      return fail(res, 429, "ACCOUNT_LOCKED", `Too many failed login attempts. Try again in ${Math.ceil((lock.lockedUntil - now()) / 60000)} minute(s).`);
    }
    if (!(await bcrypt.compare(password, user.password))) {
      const l = lock || new SecurityLock({ key });
      l.failures += 1;
      if (l.failures >= PASSWORD_MAX_FAILURES) { l.lockedUntil = new Date(now().getTime() + PASSWORD_LOCK_MIN * 60000); l.failures = 0; }
      await l.save();
      await logAttempt(req, user, email, device, "failed", "wrong_password");
      return fail(res, 400, "INVALID_CREDENTIALS", "Invalid email or password.");
    }
    await SecurityLock.updateOne({ key }, { failures: 0, lockedUntil: null });
    if (user.status !== "active") { await logAttempt(req, user, email, device, "denied", `account_${user.status}`); return fail(res, 403, "ACCOUNT_SUSPENDED", `Your account is ${user.status}.`); }
    if (device.isMobile && !isMobileLoginWindowOpen()) {
      await logAttempt(req, user, email, device, "denied", "mobile_outside_window");
      return fail(res, 403, "MOBILE_LOGIN_WINDOW", "Login from mobile devices is only allowed between 10:00 AM and 1:00 PM (server time). Please try again during that window.");
    }
    if (device.browser === "Chrome") {
      const info = await issueOtp({ user, purpose: "login", channel: "email", subject: "Your InstAI login code" });
      await logAttempt(req, user, email, device, "otp_required", "chrome_email_otp");
      const challengeToken = generateChallengeToken({ id: user._id, otpId: info.otpId, purpose: "login" });
      return res.status(200).json({ success: true, otpRequired: true, challengeToken, ...info, otpId: undefined, message: `We sent a verification code to ${info.destination}` });
    }
    const { accessToken } = await createSession(req, user, device);
    await logAttempt(req, user, email, device, "success", device.browser === "Microsoft Edge" ? "edge_no_verification" : "password");
    res.status(200).json({ success: true, message: "Login successful", user, accessToken });
  } catch (error) { handle(res, error); }
};

const readChallenge = (token) => {
  try { const d = jwt.verify(token, process.env.JWT_SECRET); if (d.typ !== "challenge") throw 0; return d; }
  catch { throw new OtpError("CHALLENGE_EXPIRED", "Your verification session expired. Please log in again.", 401); }
};
export const verifyLoginOtp = async (req, res) => {
  const device = parseUA(req.headers["user-agent"]);
  try {
    const { challengeToken, code } = req.body;
    const ch = readChallenge(challengeToken);
    const user = await User.findById(ch.id);
    if (!user) return fail(res, 400, "INVALID_CREDENTIALS", "Invalid session");
    try { await verifyOtp({ otpId: req.body.otpId || ch.otpId, userId: user._id, purpose: "login", code }); }
    catch (e) { await logAttempt(req, user, user.email, device, e.code === "OTP_LOCKED" ? "locked" : "failed", e.code?.toLowerCase()); throw e; }
    const { accessToken } = await createSession(req, user, device);
    await logAttempt(req, user, user.email, device, "success", "email_otp_verified");
    res.json({ success: true, message: "Login successful", user, accessToken });
  } catch (error) { handle(res, error); }
};
export const resendLoginOtp = async (req, res) => {
  try {
    const ch = readChallenge(req.body.challengeToken);
    const user = await User.findById(ch.id);
    const info = await issueOtp({ user, purpose: "login", channel: "email", subject: "Your InstAI login code" });
    res.json({ success: true, challengeToken: generateChallengeToken({ id: user._id, otpId: info.otpId, purpose: "login" }), ...info, otpId: undefined });
  } catch (error) { handle(res, error); }
};

export const logout = async (req, res) => {
  if (req.sessionId) await Session.updateOne({ _id: req.sessionId }, { revoked: true });
  res.json({ success: true });
};
export const me = async (req, res) => {
  const user = req.user.toJSON();
  user.effectivePlan = req.user.effectivePlan();
  res.status(200).json({ success: true, user });
};
export const loginHistory = async (req, res) => {
  try {
    const page = Math.max(1, +req.query.page || 1), limit = Math.min(100, +req.query.limit || 20);
    const q = { user: req.user._id };
    const [items, total] = await Promise.all([LoginHistory.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), LoginHistory.countDocuments(q)]);
    res.json({ success: true, items, total, page, pages: Math.ceil(total / limit) });
  } catch (e) { handle(res, e); }
};
export const listSessions = async (req, res) => {
  const items = await Session.find({ user: req.user._id, revoked: false }).sort({ lastSeenAt: -1 }).lean();
  res.json({ success: true, items: items.map((s) => ({ ...s, current: String(s._id) === String(req.sessionId) })) });
};
export const revokeSession = async (req, res) => {
  if (req.params.id === "all") {
    await Session.updateMany({ user: req.user._id, _id: { $ne: req.sessionId } }, { revoked: true });
  } else await Session.updateOne({ _id: req.params.id, user: req.user._id }, { revoked: true });
  await audit(req, "session.revoke", { targetType: "session", targetId: req.params.id });
  res.json({ success: true });
};

export const updateProfile = async (req, res) => {
  try {
    const allowed = ["fullName", "bio", "website", "profilePicture", "gender", "accountType"];
    const update = {};
    for (const k of allowed) if (req.body[k] !== undefined) update[k] = req.body[k];
    if (req.body.phone !== undefined) {
      const p = normPhone(req.body.phone);
      if (p && !PHONE_RE.test(p)) return fail(res, 400, "INVALID_PHONE", "Enter a valid mobile number with country code, e.g. +919876543210");
      update.phone = p;
    }
    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true, runValidators: true });
    res.json({ success: true, user });
  } catch (e) { handle(res, e); }
};

// ---- Language change with OTP ----
export const requestLanguageChange = async (req, res) => {
  try {
    const { language } = req.body;
    if (!LANGUAGES.includes(language)) return fail(res, 400, "INVALID_LANGUAGE", "Unsupported language");
    if (language === req.user.language) return res.json({ success: true, changed: false, user: req.user });
    const channel = language === "fr" ? "email" : "sms";
    if (channel === "sms" && !req.user.phone) return fail(res, 400, "PHONE_REQUIRED", "Add a mobile number to your profile first.");
    const info = await issueOtp({ user: req.user, purpose: "language", channel, payload: { language }, subject: "Confirm your language change" });
    res.json({ success: true, otpRequired: true, ...info });
  } catch (e) { handle(res, e); }
};
export const verifyLanguageChange = async (req, res) => {
  try {
    const { otpId, code } = req.body;
    const otp = await verifyOtp({ otpId, userId: req.user._id, purpose: "language", code });
    const user = await User.findByIdAndUpdate(req.user._id, { language: otp.payload.language }, { new: true });
    await audit(req, "user.language_change", { targetType: "user", targetId: user._id, details: { language: user.language } });
    res.json({ success: true, changed: true, user });
  } catch (e) { handle(res, e); }
};

// ---- close friends ----
export const getCloseFriends = async (req, res) => {
  const u = await User.findById(req.user._id).populate("closeFriends", "username fullName profilePicture");
  res.json({ success: true, closeFriends: u.closeFriends });
};
export const toggleCloseFriend = async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return fail(res, 404, "NOT_FOUND", "User not found");
    const has = req.user.closeFriends.some((id) => String(id) === String(target._id));
    await User.updateOne({ _id: req.user._id }, has ? { $pull: { closeFriends: target._id } } : { $addToSet: { closeFriends: target._id } });
    res.json({ success: true, isCloseFriend: !has });
  } catch (e) { handle(res, e); }
};
export const searchUsers = async (req, res) => {
  const q = String(req.query.q || "").trim();
  const filter = q ? { $or: [{ username: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }, { fullName: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }] } : {};
  const users = await User.find({ ...filter, _id: { $ne: req.user._id } }).select("username fullName profilePicture isVerified").limit(20);
  res.json({ success: true, users });
};

export const getProfileByUsername = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).select("-password");
    if (!user) return fail(res, 404, "NOT_FOUND", "User not found");
    const posts = await Post.find({ user: user._id, isDeleted: false, ...PUBLISHED }).sort({ createdAt: -1 }).lean();
    const likes = await Like.find({ post: { $in: posts.map((p) => p._id) } }).populate("user", "username fullName profilePicture");
    const likesMap = {};
    likes.forEach((l) => { (likesMap[l.post.toString()] ||= []).push(l); });
    const isFollowing = !!(await Follow.exists({ follower: req.user._id, following: user._id }));
    res.status(200).json({ success: true, user, isFollowing, posts: posts.map((p) => ({ ...p, likes: likesMap[p._id.toString()] || [] })) });
  } catch (error) { handle(res, error); }
};
