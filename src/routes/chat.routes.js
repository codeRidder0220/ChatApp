import express from "express";
import { createPrivateChat, getChatMessage, getUnreadCount } from "../controllers/chat.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post(
    "/private",
    authenticate,
    createPrivateChat
);

router.get("/:chatId/message" , authenticate , getChatMessage);

router.get("/:chatId/unread-count" , authenticate , getUnreadCount);

export default router;