import jwt from "jsonwebtoken"
import { env } from "../config/env.js"
import crypto from "crypto"

//genrate access token
export const generateAccessToken = (user) => {
    return jwt.sign(
        {
            userId: user.id
        },
        env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: env.ACCESS_TOKEN_EXPIRES_IN
        }
    );
};

//generate refrsh token
export const generateRefreshToken = (user) => {
    return jwt.sign(
        {
            userId: user.id
        },
        env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: env.REFRESH_TOKEN_EXPIRES_IN
        }
    );
};

// token's hash
export const hashToken = (token) =>{
    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}

//Random token generate for email verificationapi 
export const generateRandomToken = () =>{
    return crypto.randomBytes(32).toString("hex");
};