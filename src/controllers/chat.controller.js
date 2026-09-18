import { eq, and, asc, gt ,ne , count} from "drizzle-orm";
import { db } from "../db/index.js";
import { chatTable, chatMemberTable, usersTable, messageTable } from "../db/schema.js";
import { redis } from "../config/redis.js";



// create private chats..
export const createPrivateChat = async (req, res, next) => {
    try {
        const currentUserId = req.user.id;
        const otherUserId = Number(req.body.userId);

        if (!otherUserId) {
            return res.status(400).json({
                success: false,
                message: "USer ID is required"
            });
        }

        if (currentUserId === otherUserId) {
            return res.status(400).json({
                success: false,
                message: "you can not create a chat with yourself"
            });
        }

        //check whether other user exists..
        const [otherUser] = await db
            .select({
                id: usersTable.id
            })
            .from(usersTable)
            .where(eq(usersTable.id, otherUserId));

        if (!otherUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        //create unique key for both users..
        const directKey = `${Math.min(currentUserId, otherUserId)}:${Math.max(currentUserId, otherUserId)}`;

        //check existing private chats..
        const [existingChat] = await db
            .select()
            .from(chatTable)
            .where(eq(chatTable.directKey, directKey));

        if (existingChat) {
            return res.status(200).json({
                success: true,
                message: "Private chat already exists",
                chat: existingChat
            });
        }

        //create chat..
        const [chat] = await db
            .insert(chatTable)
            .values({
                type: "private",
                directKey
            }).returning();

        //add both users to chat..
        await db.insert(chatMemberTable).values([
            {
                chatId: chat.id,
                userId: currentUserId,
                role: "member"
            },
            {
                chatId: chat.id,
                userId: otherUserId,
                role: "member"
            }
        ]);

        return res.status(201).json({
            success: true,
            message: "Private chat created  successfully",
            chat
        });


    } catch (error) {
        next(error);
    }
};

// message history..
export const getChatMessage = async (req, res, next) => {
    try {
        const currentUserId = req.user.id;
        const chatId = Number(req.params.chatId);

        if (!chatId) {
            return res.status(400).json({
                success: false,
                message: "Valid chat ID is required"
            });
        }

        //check whether current user is a member of this chat..
        const [membership] = await db
            .select({
                id: chatMemberTable.id
            })
            .from(chatMemberTable)
            .where(and(
                eq(chatMemberTable.chatId, chatId),
                eq(chatMemberTable.userId, currentUserId)
            ));

        if (!membership) {
            return res.status(403).json({
                success: false,
                message: "You are not a member of this chat"
            });
        }

        //get message...
        const message = await db
            .select()
            .from(messageTable)
            .where(eq(messageTable.chatId, chatId))
            .orderBy(asc(messageTable.createdAt));

        return res.status(200).json({
            success: true,
            message
        });


    } catch (error) {
        next(error);
    }
}

//unread count..
export const getUnreadCount = async (req, res, next) => {
    try {
        const currentUserId = req.user.id;
        const chatId = Number(req.params.chatId);

        if (!chatId) {
            return res.status(400).json({
                success: false,
                message: "Valid chat ID is required"
            });
        }

        const [membership] = await db
            .select({
                lastReadMessageId: chatMemberTable.lastReadMessageId
            })
            .from(chatMemberTable)
            .where(and(
                eq(chatMemberTable.chatId, chatId),
                eq(chatMemberTable.userId, currentUserId)
            ));

        if (!membership) {
            return res.status(403).json({
                success: false,
                message: "You are not a member of this chat"
            })
        }

        const conditions = [
            eq(messageTable.chatId, chatId),
            ne(messageTable.senderId, currentUserId)
        ];

        if (membership.lastReadMessageId) {
            conditions.push(
                gt(
                    messageTable.id,
                    membership.lastReadMessageId
                )
            );
        }

        const [result] = await db
            .select({
                unreadCount: count(messageTable.id)
            })
            .from(messageTable)
            .where(and(...conditions));

        return res.status(200).json({
            success: true,
            unreadCount: Number(result.unreadCount)
        });

    } catch (error) {

    }
}

//get chat by redis(chache)..
export const getChatById = async (req, res, next) => {
    try {
        const currentUserId = req.user.id;
        const chatId = Number(req.params.chatId);

        if (!chatId) {
            return res.status(400).json({
                success: false,
                message: "Valid chat ID is required"
            });
        }

        // 1. Check Redis
        const cacheKey = `chat:${chatId}`;

        const cachedChat = await redis.get(cacheKey);

        if (cachedChat) {
            return res.status(200).json({
                success: true,
                chat: JSON.parse(cachedChat),
                source: "redis"
            });
        }

        // 2. Check membership
        const [membership] = await db
            .select({
                id: chatMemberTable.id
            })
            .from(chatMemberTable)
            .where(
                and(
                    eq(chatMemberTable.chatId, chatId),
                    eq(chatMemberTable.userId, currentUserId)
                )
            );

        if (!membership) {
            return res.status(403).json({
                success: false,
                message: "You are not a member of this chat"
            });
        }

        // 3. Get chat from PostgreSQL
        const [chat] = await db
            .select()
            .from(chatTable)
            .where(
                eq(chatTable.id, chatId)
            );

        if (!chat) {
            return res.status(404).json({
                success: false,
                message: "Chat not found"
            });
        }

        // 4. Save in Redis for 60 seconds
        await redis.set(
            cacheKey,
            JSON.stringify(chat),
            "EX",
            60
        );

        return res.status(200).json({
            success: true,
            chat,
            source: "postgresql"
        });

    } catch (error) {
        next(error);
    }
};