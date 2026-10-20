import mongoose from "mongoose";
const { ObjectId } = mongoose.Schema.Types;

const otpSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "User", required: true },
    purpose: { type: String, required: true }, // login | language
    channel: { type: String, enum: ["email", "sms"], required: true },
    codeHash: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    consumed: { type: Boolean, default: false },
  },
  { timestamps: true },
);
otpSchema.index({ user: 1, purpose: 1, createdAt: -1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });
export const Otp = mongoose.model("Otp", otpSchema);

// Tracks failed attempts / lockouts per user + purpose
const lockSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  failures: { type: Number, default: 0 },
  sends: [{ type: Date }],
  lockedUntil: { type: Date, default: null },
});
export const SecurityLock = mongoose.model("SecurityLock", lockSchema);

const loginHistorySchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "User", index: true },
    email: String,
    browser: String,
    browserVersion: String,
    os: String,
    deviceType: { type: String, enum: ["Desktop", "Laptop", "Mobile", "Tablet", "Unknown"] },
    ip: String,
    userAgent: String,
    status: { type: String, enum: ["success", "failed", "otp_required", "denied", "locked"] },
    reason: String,
  },
  { timestamps: true },
);
loginHistorySchema.index({ user: 1, createdAt: -1 });
export const LoginHistory = mongoose.model("LoginHistory", loginHistorySchema);

const sessionSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "User", required: true, index: true },
    browser: String, os: String, deviceType: String, ip: String,
    lastSeenAt: { type: Date, default: Date.now },
    revoked: { type: Boolean, default: false },
    expiresAt: Date,
  },
  { timestamps: true },
);
export const Session = mongoose.model("Session", sessionSchema);

const auditSchema = new mongoose.Schema(
  {
    actor: { type: ObjectId, ref: "User", index: true },
    actorRole: String,
    action: { type: String, required: true, index: true },
    targetType: String,
    targetId: String,
    details: mongoose.Schema.Types.Mixed,
    ip: String,
  },
  { timestamps: true },
);
auditSchema.index({ createdAt: -1 });
export const AuditLog = mongoose.model("AuditLog", auditSchema);
