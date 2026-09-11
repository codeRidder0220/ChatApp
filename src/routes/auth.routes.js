import {Router} from "express";
import { refresh ,register , login, logout, verifyEmail, forgetPassword , resetPassword} from "../controllers/auth.controller.js"

const router = Router();

router.post("/register" , register);
router.post("/login" , login);
router.post("/refresh" , refresh);
router.post("/logout" , logout);
router.post("/verify-email" , verifyEmail);
router.post("/forget-password" , forgetPassword);
router.post("/reset-Password" , resetPassword);

export default router;