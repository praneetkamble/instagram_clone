import mongoose from "mongoose";
const { ObjectId } = mongoose.Schema.Types;

const commentSchema = new mongoose.Schema(
  {
    post: { type: ObjectId, ref: "Post", required: true, index: true },
    user: { type: ObjectId, ref: "User", required: true, index: true },
    text: { type: String, required: true, maxlength: 2200 },
    isHidden: { type: Boolean, default: false },
  },
  { timestamps: true },
);
export const Comment = mongoose.model("Comment", commentSchema);

const reportSchema = new mongoose.Schema(
  {
    reporter: { type: ObjectId, ref: "User", required: true },
    targetType: { type: String, enum: ["user", "post", "story", "comment"], required: true },
    targetId: { type: ObjectId, required: true },
    reason: { type: String, required: true, maxlength: 1000 },
    status: { type: String, enum: ["open", "reviewing", "resolved", "dismissed"], default: "open", index: true },
    resolutionNote: String,
  },
  { timestamps: true },
);
export const Report = mongoose.model("Report", reportSchema);

const subscriptionSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "User", required: true, index: true },
    plan: { type: String, enum: ["bronze", "silver", "gold"], required: true },
    amount: { type: Number, required: true }, // in INR
    currency: { type: String, default: "INR" },
    status: { type: String, enum: ["created", "active", "failed", "cancelled", "expired"], default: "created", index: true },
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: String,
    razorpaySignature: String,
    startsAt: Date,
    endsAt: Date,
    isRenewal: { type: Boolean, default: false },
    autoRenew: { type: Boolean, default: true },
    failureReason: String,
    cancelledAt: Date,
    invoiceNumber: String,
    invoiceSentAt: Date,
    renewalReminderSent: { type: Boolean, default: false },
  },
  { timestamps: true },
);
export const Subscription = mongoose.model("Subscription", subscriptionSchema);

const notificationSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "User", required: true, index: true },
    type: String,
    key: String,          // i18n key, translated client side
    params: mongoose.Schema.Types.Mixed,
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);
export const Notification = mongoose.model("Notification", notificationSchema);
