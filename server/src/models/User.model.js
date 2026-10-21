import mongoose from "mongoose";
export const LANGUAGES = ["en", "es", "hi", "pt", "zh", "fr"];
export const PLANS = ["free", "bronze", "silver", "gold"];
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, index: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    phone: { type: String, default: "", trim: true },
    password: { type: String, required: true, select: false },
    bio: { type: String, default: "" },
    website: { type: String, default: "" },
    profilePicture: { type: String, default: "" },
    accountType: { type: String, default: "public", enum: ["private", "public"] },
    gender: { type: String, default: "other", enum: ["male", "female", "other"] },
    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    PostCount: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    role: { type: String, enum: ["user", "admin"], default: "user", index: true },
    status: { type: String, enum: ["active", "suspended", "banned"], default: "active", index: true },
    language: { type: String, enum: LANGUAGES, default: "en" },
    closeFriends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    plan: { type: String, enum: PLANS, default: "free", index: true },
    planExpiresAt: { type: Date, default: null },
    lastActiveAt: { type: Date, default: Date.now, index: true },
    lastLoginAt: { type: Date, default: null },
    tokenVersion: { type: Number, default: 0 },
    refreshToken: { type: String, default: "", select: false },
  },
  { timestamps: true },
);
userSchema.index({ createdAt: -1 });
userSchema.methods.effectivePlan = function () {
  if (this.plan !== "free" && this.planExpiresAt && this.planExpiresAt < new Date()) return "free";
  return this.plan;
};
userSchema.set("toJSON", {
  transform: (_d, r) => { delete r.password; delete r.refreshToken; return r; },
});
export default mongoose.model("User", userSchema);
