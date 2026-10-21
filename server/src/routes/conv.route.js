import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import {
  getMessages,
  sendMessage,
  markMessagesSeen,
  createConversation,
} from "../controllers/conv.controller.js";

const router = express.Router();
import Conversation from "../models/Conversation.model.js";
import Message from "../models/message.model.js";
// Unread DM count = conversations with an unseen message from someone else
router.get("/unread-count", protect, async (req, res) => {
  try {
    const convs = (await Conversation.find({ participants: req.user._id }).select("_id").lean()).map((c) => c._id);
    const ids = await Message.distinct("conversation", { conversation: { $in: convs }, sender: { $ne: req.user._id }, isSeen: false, isDeleted: { $ne: true } });
    res.json({ success: true, unread: ids.length });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get("/:conversationId/messages", protect, getMessages);
router.post("/:conversationId/message", protect, sendMessage);
router.post("/", protect, createConversation);
router.put("/:conversationId/seen", protect, markMessagesSeen);

export default router;
