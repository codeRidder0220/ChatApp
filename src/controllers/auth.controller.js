import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { db } from "../db/index.js"
import { emailVerificationTokenTable, passwordResetTokenTable, roleTable, sessionTable, usersTable } from "../db/schema.js";
import { generateAccessToken, generateRandomToken, generateRefreshToken, hashToken } from "../utils/token.js"
import { env } from "../config/env.js";
import { sendVerificationEmail, sendResetPasswordEmail } from "../utils/email.js";


// Registration => 
export const register = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        //validation =>
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Name , email and password are required"
            });
        }

        //check existing user =>
        const existingUser = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.email, email));

        if (existingUser.length > 0) {
            return res.status(409).json({
                success: false,
                message: "User already exists"
            });
        }

        //password hashing =>
        const hashedPassword = await bcrypt.hash(password, 12);

        const [userRole] = await db
            .select({id:roleTable.id})
            .from(roleTable)
            .where(eq(roleTable.name , "user"));

        //insertion in postgresSQL => 
        const [user] = await db
            .insert(usersTable)
            .values({
                name,
                email,
                password: hashedPassword,
                roleId: userRole.id
            }).returning({
                id: usersTable.id,
                name: usersTable.name,
                email: usersTable.email
            });

        // to be verified user 
        const verificationToken = generateRandomToken();
        const verificationTokenHash = hashToken(verificationToken);

        await db.insert(emailVerificationTokenTable).values({
            userId: user.id,
            tokenHash: verificationTokenHash,
            expiresAt: new Date(
                Date.now() + 15 * 60 * 1000
            )
        });

        const verificationUrl = `http://localhost:5000/api/auth/verify-email?token=${verificationToken}`;

        await sendVerificationEmail(email, verificationUrl);


        return res.status(201).json({
            success: true,
            message: "User registered successfully",
            user
        });

    } catch (error) {
        next(error)
    }
}

// login =>
export const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        //validation=>
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and Password are required!"
            });
        }

        const [user] = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.email, email));

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        //password comparing =>
        const isPasswordCorrect = await bcrypt.compare(
            password, user.password
        );

        if (!isPasswordCorrect) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or Password"
            });
        }

        //tokens generatings =>
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        //insert refresh token in session table =>
        const refreshTokenHash = hashToken(refreshToken);
        await db.insert(sessionTable).values({
            userId: user.id,
            refreshTokenHash,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });

        //browser pe cookiestore krne ko res bhjeta hai
        res.cookie("accessToken", accessToken, {
            httpOnly: true,                          //JS se cookie access prevent
            secure: env.NODE_ENV === "production",    //Production me HTTPS-only
            sameSite: "lax",                          //Cross-site cookie sending restrict karta hai
            maxAge: 15 * 60 * 1000
        });

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,                          //JS se cookie access prevent
            secure: env.NODE_ENV === "production",    //Production me HTTPS-only
            sameSite: "lax",                          //Cross-site cookie sending restrict karta hai
            maxAge: 7 * 24 * 60 * 60 * 1000
        });


        return res.status(200).json({
            success: true,
            message: "Loggin successful",
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                isEmailVerified: user.isEmailVerified
            }
        });
    } catch (error) {
        next(error);
    }

}

//Refresh Endpoint =>
export const refresh = async (req, res, next) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                message: "Refresh token required"
            });
        }

        const decoded = jwt.verify(
            refreshToken,
            env.REFRESH_TOKEN_SECRET
        );

        const tokenHash = hashToken(refreshToken);

        const [session] = await db
            .select()
            .from(sessionTable)
            .where(eq(sessionTable.refreshTokenHash, tokenHash));

        if (!session || session.revokedAt) {
            return res.status(401).json({
                success: false,
                message: "Invalid refresh token"
            });
        }

        if (new Date() > session.expiresAt) {
            return res.status(401).json({
                success: false,
                message: "Refresh token expired"
            });
        }

        const [user] = await db.select().from(usersTable).where(eq(usersTable.id, decoded.userId))

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not foound"
            });
        }

        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);

        const newRefreshTokenHash = hashToken(newRefreshToken);
        await db.update(sessionTable).set({ refreshTokenHash: newRefreshTokenHash }).where(eq(sessionTable.id, session.id))


        res.cookie("accessToken", newAccessToken, {
            httpOnly: true,
            secure: env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 15 * 60 * 1000
        });

        res.cookie("refreshToken", newRefreshToken, {
            httpOnly: true,
            secure: env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        return res.status(200).json({
            success: true,
            message: "Token refreshed successfully"
        });


    } catch (error) {

            console.error("REFRESH ERROR:", error);

        return res.status(401).json({
            success: false,
            message: "Invalid or expired refresh token"
        });
    }
}

//Logout =>
export const logout = async (req, res, next) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (refreshToken) {
            const tokenHash = hashToken(refreshToken);

            await db
                .update(sessionTable)
                .set({
                    revokedAt: new Date()
                })
                .where(
                    eq(
                        sessionTable.refreshTokenHash,
                        tokenHash
                    )
                );
        }

        res.clearCookie("accessToken");
        res.clearCookie("refreshToken");

        return res.status(200).json({
            success: true,
            message: "Logout successful"
        });

    } catch (error) {
        next(error);
    }
}

//Verify-Email =>
export const verifyEmail = async (req, res, next) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: "Verification token is required"
            });
        }

        const tokenHash = hashToken(token);

        const [verificationToken] = await db
            .select()
            .from(emailVerificationTokenTable)
            .where(eq(emailVerificationTokenTable.tokenHash, tokenHash));

        if (!verificationToken) {
            return res.status(400).json({
                success: false,
                message: "Invalid verification token"
            });
        }

        if (new Date() > verificationToken.expiresAt) {
            return res.status(400).json({
                success: false,
                message: "verification token expired"
            });
        }

        await db.update(usersTable)
            .set({
                isEmailVerified: true,
                updatedAt: new Date()
            })
            .where(eq(usersTable.id, verificationToken.userId));

        await db
            .delete(emailVerificationTokenTable)
            .where(
                eq(
                    emailVerificationTokenTable.id,
                    verificationToken.id
                )
            );

        return res.status(200).json({
            success: true,
            message: "Email verified successfully"
        });

    } catch (error) {
        next(error);
    }
}

//forget-Password =>
export const forgetPassword = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const [user] = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.email, email));

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "if the user exists , a reset link has been sent"
            });
        }

        const resetPassword = generateRandomToken();
        const resetPasswordHash = hashToken(resetPassword);

        await db
            .delete(passwordResetTokenTable)
            .where(eq(passwordResetTokenTable.userId, user.id));

        await db
            .insert(passwordResetTokenTable)
            .values({
                userid: user.id,
                tokenHash: resetPasswordHash,
                expiresAt: new Date(Date.now() + 15 * 60 * 1000)
            });

        const resetUrl = `http://localhost:5173/reset-password?token=${resetToken}`;

        await sendResetPasswordEmail(email, resetUrl);

        return res.status(200).json({
            success: true,
            message: "a reset link has been sent"
        });
    } catch (error) {
        next(error);
    }

}

//reset-password =>
export const resetPassword = async (req, res, next) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({
                success: false,
                message: "Token and password are required"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters"
            });
        }

        // generate token hash =>
        const tokenHash = tokenHash(token);

        //db me token find kro =>
        const [resetToken] = await db
            .select()
            .from(passwordResetTokenTable)
            .where(eq(passwordResetTokenTable.tokenHash, tokenHash));

        if (!resetToken) {
            return res.status(400).json({
                success: false,
                message: "Invalid reset token"
            });
        }

        if (new Date() > resetToken.expiresAt) {
            return res.status(400).json({
                success: false,
                message: "Reset token expired"
            });
        }

        //new hash password bnao =>
        const hashedPassword = await bcrypt.hash(password, 12);

        //user ka password update kiya
        await db
            .update(usersTable)
            .set({
                password: hashedPassword,
                updatedAt: new Date()
            })
            .where(eq(
                usersTable.id, resetToken.userId
            ));

        //session table bhi update ki
        await db
            .update(sessionTable)
            .set({
                revokedAt: new Date()
            })
            .where(
                eq(
                    sessionTable.userId,
                    resetToken.userId
                )
            );

        //token deleted
        await db
            .delete(passwordResetTokenTable)
            .where(eq(
                passwordResetTokenTable.id, resetToken.id
            ));

        return res.status(200).json({
            success: true,
            message: "Password reset successfully"
        });

    } catch (error) {
        next(error);
    }
}