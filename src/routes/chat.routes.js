import express from "express";
import { createPrivateChat, getChatMessage } from "../controllers/chat.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post(
    "/private",
    authenticate,
    createPrivateChat
);

router.get("/:chatId/message" , authenticate , getChatMessage)

export default router;