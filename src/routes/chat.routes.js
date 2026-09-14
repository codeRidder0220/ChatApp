import express from "express";
import { createPrivateChat } from "../controllers/chat.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post(
    "/private",
    authenticate,
    createPrivateChat
);

export default router;