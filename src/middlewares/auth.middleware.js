import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { db } from "../db/index.js";
import { usersTable } from "../db/schema.js";
import { eq } from "drizzle-orm";

export const authenticate = async(req, res, next) => {
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
        
        const [user] = await db
            .select({
                id:usersTable.id,
                role:usersTable.role
            })
            .from(usersTable)
            .where(eq(usersTable.id , decode.userId));
        
        if(!user){
            return res.status(401).json({
                success:false,
                message:"User not found"
            })
        }

        req.user = {
            id:user.id,
            role:user.role
        }

        next();

    } catch (error) {
    
        return res.status(401).json({
            success: false,
            message: "Invalid or expired access token"
        });
    }
}

export const authorize = (...allowedRoles) => {

    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required"
            });
        }

        if(!allowedRoles.includes(req.user.role)){
            return res.status(403).json({
                success:false,
                message:"You are not authorize to perform this action"
            });
        }
        next();
    }
}