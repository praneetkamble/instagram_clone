import crypto from "crypto";
import bcrypt from "bcrypt";
import { Otp, SecurityLock } from "../models/Security.model.js";
import { sendEmail } from "./mailer.js";
import { sendSMS } from "./sms.js";
import { now } from "./time.js";

export const OTP_TTL_MIN = Number(process.env.OTP_TTL_MIN || 5);
export const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 3);    // per code
export const OTP_MAX_FAILURES = Number(process.env.OTP_MAX_FAILURES || 5);    // before lockout
export const OTP_LOCK_MIN = Number(process.env.OTP_LOCK_MIN || 15);
export const OTP_MAX_SENDS_PER_HOUR = Number(process.env.OTP_MAX_SENDS_PER_HOUR || 5);
export const OTP_RESEND_COOLDOWN_SEC = Number(process.env.OTP_RESEND_COOLDOWN_SEC || 30);

export class OtpError extends Error { constructor(code, message, status = 400, extra = {}) { super(message); this.code = code; this.status = status; this.extra = extra; } }

const lockKey = (userId, purpose) => `${purpose}:${userId}`;
export async function checkLock(userId, purpose) {
  const l = await SecurityLock.findOne({ key: lockKey(userId, purpose) });
  if (l?.lockedUntil && l.lockedUntil > now()) {
    const mins = Math.ceil((l.lockedUntil - now()) / 60000);
    throw new OtpError("OTP_LOCKED", `Too many failed attempts. Try again in ${mins} minute(s).`, 429, { lockedUntil: l.lockedUntil });
  }
  return l;
}
export const mask = (s = "", channel) => channel === "email"
  ? s.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + "*".repeat(Math.max(1, b.length)) + c)
  : s.replace(/.(?=.{3})/g, "*");

export async function issueOtp({ user, purpose, channel, payload, subject = "Your verification code" }) {
  await checkLock(user._id, purpose);
  const key = lockKey(user._id, purpose);
  const lock = (await SecurityLock.findOne({ key })) || new SecurityLock({ key });
  const hourAgo = new Date(now().getTime() - 3600000);
  lock.sends = (lock.sends || []).filter((d) => d > hourAgo);
  const last = lock.sends[lock.sends.length - 1];
  if (last && now() - last < OTP_RESEND_COOLDOWN_SEC * 1000) throw new OtpError("OTP_COOLDOWN", `Please wait ${OTP_RESEND_COOLDOWN_SEC} seconds before requesting another code.`, 429);
  if (lock.sends.length >= OTP_MAX_SENDS_PER_HOUR) throw new OtpError("OTP_SEND_LIMIT", "Too many codes requested. Try again later.", 429);
  const destination = channel === "email" ? user.email : user.phone;
  if (!destination) throw new OtpError("PHONE_REQUIRED", "Add a mobile number to your profile first.", 400);
  const code = String(crypto.randomInt(100000, 1000000));
  await Otp.updateMany({ user: user._id, purpose, consumed: false }, { consumed: true });
  const otp = await Otp.create({ user: user._id, purpose, channel, payload, codeHash: await bcrypt.hash(code, 8), expiresAt: new Date(now().getTime() + OTP_TTL_MIN * 60000) });
  lock.sends.push(now()); await lock.save();
  const text = `Your InstAI verification code is ${code}. It expires in ${OTP_TTL_MIN} minutes. Do not share it with anyone.`;
  if (channel === "email") await sendEmail({ to: destination, subject, text });
  else await sendSMS(destination, text);
  return { otpId: otp._id, channel, destination: mask(destination, channel), expiresAt: otp.expiresAt, ttlMinutes: OTP_TTL_MIN, maxAttempts: OTP_MAX_ATTEMPTS };
}

export async function verifyOtp({ otpId, userId, purpose, code }) {
  await checkLock(userId, purpose);
  const otp = await Otp.findOne({ _id: otpId, user: userId, purpose });
  if (!otp || otp.consumed) throw new OtpError("OTP_INVALID", "This code is no longer valid. Request a new one.");
  if (otp.expiresAt < now()) { otp.consumed = true; await otp.save(); throw new OtpError("OTP_EXPIRED", "The code has expired. Request a new one."); }
  const ok = await bcrypt.compare(String(code || ""), otp.codeHash);
  const key = lockKey(userId, purpose);
  if (!ok) {
    otp.attempts += 1;
    if (otp.attempts >= OTP_MAX_ATTEMPTS) otp.consumed = true;
    await otp.save();
    const lock = (await SecurityLock.findOne({ key })) || new SecurityLock({ key });
    lock.failures += 1;
    if (lock.failures >= OTP_MAX_FAILURES) { lock.lockedUntil = new Date(now().getTime() + OTP_LOCK_MIN * 60000); lock.failures = 0; }
    await lock.save();
    if (lock.lockedUntil && lock.lockedUntil > now()) throw new OtpError("OTP_LOCKED", `Too many failed attempts. Try again in ${OTP_LOCK_MIN} minute(s).`, 429);
    const left = Math.max(0, OTP_MAX_ATTEMPTS - otp.attempts);
    throw new OtpError(left ? "OTP_WRONG" : "OTP_ATTEMPTS_EXCEEDED", left ? `Incorrect code. ${left} attempt(s) left.` : "Too many incorrect attempts. Request a new code.", 400, { attemptsLeft: left });
  }
  otp.consumed = true; await otp.save();
  await SecurityLock.updateOne({ key }, { failures: 0, lockedUntil: null });
  return otp;
}
