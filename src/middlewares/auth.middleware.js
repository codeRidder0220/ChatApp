import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { db } from "../db/index.js";
import { permissionTable, rolePermissionTable, usersTable } from "../db/schema.js";
import { eq,and } from "drizzle-orm";

//authenticate=>
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
                roleId:usersTable.roleId
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
            roleId:user.roleId
        }

        next();

    } catch (error) {
    
        return res.status(401).json({
            success: false,
            message: "Invalid or expired access token"
        });
    }
}

//user is admin or normal user =>
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

//for permission => 
export const authorizePermission = (requiredPermission) => {
    return async(req,res,next) => {
        try {

            const [permission] = await db
                .select({id:permissionTable.id})
                .from(rolePermissionTable)
                .innerJoin(
                    permissionTable , 
                    eq(rolePermissionTable.permissionId , permissionTable.id)
                )
                .where(and(
                    eq(rolePermissionTable.roleId,req.user.roleId),
                    eq(permissionTable.name , requiredPermission)
                ));

                if(!permission){
                    return res.status(403).json({
                        success:false,
                        message:"You do not have permission to perform this action"
                    });
                }

                next();

        } catch (error) {
            next(error);
        }
    }
}