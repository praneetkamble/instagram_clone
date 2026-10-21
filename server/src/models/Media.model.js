import mongoose from "mongoose";
// Fallback media store (no third-party keys): small files kept in MongoDB, served from /api/media/:id.
const mediaSchema = new mongoose.Schema({ owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }, mime: String, size: Number, data: Buffer }, { timestamps: true });
export default mongoose.models.Media || mongoose.model("Media", mediaSchema);
