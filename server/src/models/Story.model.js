import mongoose from "mongoose";
const { ObjectId } = mongoose.Schema.Types;
const storySchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "User", required: true, index: true },
    media: [{
      url: { type: String, required: true },
      type: { type: String, enum: ["image", "video"], required: true },
      duration: { type: Number, default: 5 },
    }],
    caption: { type: String, default: "", maxlength: 500 },
    privacy: { type: String, enum: ["public", "followers", "close_friends"], default: "public" },
    expiresAt: { type: Date, required: true, index: true },
    isArchived: { type: Boolean, default: false, index: true },
    isDeleted: { type: Boolean, default: false },
    archivedAt: Date,
    viewsCount: { type: Number, default: 0 },
    uniqueViewers: { type: Number, default: 0 },
    completedViews: { type: Number, default: 0 },
    reactionsCount: { type: Number, default: 0 },
    repliesCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);
storySchema.index({ user: 1, isArchived: 1, expiresAt: -1 });
storySchema.index({ isArchived: 1, isDeleted: 1, expiresAt: 1 });
export const Story = mongoose.model("Story", storySchema);

// One record per (story, viewer) — unique index prevents duplicates
const viewSchema = new mongoose.Schema(
  {
    story: { type: ObjectId, ref: "Story", required: true },
    owner: { type: ObjectId, ref: "User", required: true },
    viewer: { type: ObjectId, ref: "User", required: true },
    viewCount: { type: Number, default: 1 },
    maxMediaIndex: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    firstViewedAt: { type: Date, default: Date.now },
    lastViewedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);
viewSchema.index({ story: 1, viewer: 1 }, { unique: true });
viewSchema.index({ story: 1, firstViewedAt: -1 });
viewSchema.index({ owner: 1, firstViewedAt: -1 });
export const StoryView = mongoose.model("StoryView", viewSchema);

const reactionSchema = new mongoose.Schema(
  {
    story: { type: ObjectId, ref: "Story", required: true },
    user: { type: ObjectId, ref: "User", required: true },
    emoji: { type: String, required: true, maxlength: 16 },
  },
  { timestamps: true },
);
reactionSchema.index({ story: 1, user: 1 }, { unique: true });
export const StoryReaction = mongoose.model("StoryReaction", reactionSchema);

const replySchema = new mongoose.Schema(
  {
    story: { type: ObjectId, ref: "Story", required: true, index: true },
    user: { type: ObjectId, ref: "User", required: true },
    text: { type: String, required: true, maxlength: 1000 },
    sentToDM: { type: Boolean, default: false },
    message: { type: ObjectId, ref: "Message" },
  },
  { timestamps: true },
);
replySchema.index({ story: 1, createdAt: -1 });
export const StoryReply = mongoose.model("StoryReply", replySchema);

const highlightSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, maxlength: 30 },
    cover: { type: String, default: "" },
    stories: [{ type: ObjectId, ref: "Story" }],
  },
  { timestamps: true },
);
export const Highlight = mongoose.model("Highlight", highlightSchema);
