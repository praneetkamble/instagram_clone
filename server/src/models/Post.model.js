import mongoose from "mongoose";
const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    publicId: String,
    type: { type: String, enum: ["image", "video"], required: true },
    width: Number, height: Number, duration: Number,
  },
  { _id: false },
);
export const PUBLISHED = { status: { $in: ["published", null] } };
const postSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    media: { type: [mediaSchema], validate: [(a) => a.length > 0, "At least one media is required"] },
    caption: { type: String, maxlength: 2200, default: "" },
    hashtags: [{ type: String, lowercase: true, trim: true }],
    location: { type: String, default: "", trim: true },
    taggedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    visibility: { type: String, enum: ["public", "followers"], default: "public" },
    status: { type: String, enum: ["published", "scheduled", "cancelled", "failed"], default: "published", index: true },
    scheduledAt: { type: Date, default: null, index: true },
    publishedAt: { type: Date, default: null },
    publishAttempts: { type: Number, default: 0 },
    publishErrors: [{ at: Date, message: String }],
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    savesCount: { type: Number, default: 0 },
    sharesCount: { type: Number, default: 0 },
    isEdited: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);
postSchema.index({ user: 1, createdAt: -1 });
postSchema.index({ status: 1, scheduledAt: 1 });
export const extractHashtags = (caption = "", extra = []) => {
  const found = (caption.match(/#[\p{L}\p{N}_]+/gu) || []).map((h) => h.slice(1));
  return [...new Set([...found, ...(extra || []).map((h) => String(h).replace(/^#/, ""))].map((h) => h.toLowerCase()).filter(Boolean))];
};
export default mongoose.model("Post", postSchema);
