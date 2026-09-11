import jwt from "jsonwebtoken";
import { env } from "../config/env";

export const authenticate = (req, res, next) => {
    try {
        const token = req.cookies.accessToken;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }
        const decode = jwt.verify(
            token,
            env.ACCESS_TOKEN_SECRET
        );
        req.user = {
            id: decode.userId
        };
        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired access token"
        });
    }
}