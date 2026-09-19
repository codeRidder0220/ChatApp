import app from "./app.js"
import { env } from "./config/env.js";
import jwt from "jsonwebtoken";
import http from "node:http";
import { WebSocketServer } from 'ws'
import { db } from "./db/index.js";
import { usersTable, messageTable, chatMemberTable, messageReciptsTable, messageReactionTable } from "./db/schema.js"
import { and, eq } from "drizzle-orm"
import { redis, redisPublisher, redisSubscriber } from "./config/redis.js";



const server = http.createServer(app);  //make http server where express app run in it

const wss = new WebSocketServer({ server });   //made websocket server and attach with http server

const clients = new Map(); //jitne bhi users connect krege (unka set bnta jayega)

//redis Subscriber =>
const initializeRedis = async () => {
    await redisSubscriber.subscribe("chat-message");

    redisSubscriber.on("message", async (channel, message) => {
        if (channel !== "chat-message") {
            return;
        }

        const data = JSON.parse(message);

        const receiverSocket = clients.get(Number(data.receiverId));

        if (
            receiverSocket &&
            receiverSocket.readyState === 1
        ) {
            receiverSocket.send(
                JSON.stringify({
                    type: "new_message",
                    message: data.message
                })
            );

            await db
                .update(messageReciptsTable)
                .set({
                    status: "delivered",
                    deliveredAt: new Date()
                })
                .where(
                    eq(
                        messageReciptsTable.id,
                        data.receiptId
                    )
                );
        }

    })
};
initializeRedis();







//now on the connection of wss server =>
wss.on("connection", async (socket, request) => {
    console.log("websocket client connected");

    const cookies = request.headers.cookie;
    console.log("cookies:", cookies);

    if (!cookies) {
        socket.close();   //Cookie hi nahi hai ,, user authenticate nahi hua ,,connection close.
        return;
    }

    const accessToken = cookies.split("; ").find((cookie) => cookie.startsWith("accessToken="))?.split("=")[1];

    if (!accessToken) {
        socket.close();
        return;
    }
    let decoded;

    try {
        decoded = jwt.verify(
            accessToken,
            env.ACCESS_TOKEN_SECRET
        );
    } catch (error) {
        socket.close();
        return;
    }

    socket.userId = decoded.userId;

    clients.set(socket.userId, socket);

    await redis.set(
        `user:${socket.userId}:presence`, "online" //redis me online set ...
    );

    console.log(`user ${socket.userId} connected`);



    // Notify all connected users
    for (const [userId, userSocket] of clients) {
        if (
            userSocket.readyState === 1 &&
            userId !== socket.userId
        ) {
            userSocket.send(
                JSON.stringify({
                    type: "user_online",
                    userId: socket.userId
                })
            );
        }
    }

    //client se msg recieve krna...
    socket.on("message", async (message) => {
        try {
            const data = JSON.parse(message.toString());

            // TYPING INDICATOR...

            if (
                data.type === "typing_start" ||
                data.type === "typing_stop"
            ) {
                const receiverId = Number(data.receiverId);
                const chatId = Number(data.chatId);

                if (!receiverId || !chatId) {
                    return;
                }

                const [senderMembership] = await db
                    .select({
                        id: chatMemberTable.id
                    })
                    .from(chatMemberTable)
                    .where(
                        and(
                            eq(chatMemberTable.chatId, chatId),
                            eq(chatMemberTable.userId, socket.userId)
                        )
                    );

                if (!senderMembership) {
                    return;
                }

                const receiverSocket = clients.get(receiverId);

                if (
                    receiverSocket &&
                    receiverSocket.readyState === 1
                ) {
                    receiverSocket.send(
                        JSON.stringify({
                            type: data.type,
                            chatId,
                            userId: socket.userId
                        })
                    );
                }

                return;
            }


            // MESSAGE READ

            if (data.type === "message_read") {
                const messageId = Number(data.messageId);

                if (!messageId) {
                    return;
                }

                const [messageData] = await db
                    .select({
                        senderId: messageTable.senderId,
                        chatId: messageTable.chatId
                    })
                    .from(messageTable)
                    .where(
                        eq(messageTable.id, Number(data.messageId))
                    );

                if (!messageData) {
                    return;
                }

                await db
                    .update(messageReciptsTable)
                    .set({
                        status: "read",
                        readAt: new Date()
                    })
                    .where(
                        and(
                            eq(
                                messageReciptsTable.messageId,
                                messageId
                            ),
                            eq(
                                messageReciptsTable.userId,
                                socket.userId
                            )
                        )
                    );

                await db
                    .update(chatMemberTable)
                    .set({
                        lastReadMessageId: Number(data.messageId),
                        lastReadAt: new Date()
                    })
                    .where(and(
                        eq(chatMemberTable.chatId, messageData.chatId),
                        eq(chatMemberTable.userId, socket.userId)
                    ))


                const senderSocket = clients.get(
                    messageData.senderId
                );

                if (
                    senderSocket &&
                    senderSocket.readyState === 1
                ) {
                    senderSocket.send(
                        JSON.stringify({
                            type: "message_read",
                            messageId
                        })
                    );
                }

                return;
            }

            //DELETE MESSAGE =>

            if (data.type === "delete_message") {
                const messageId = Number(data.messageId);

                if (!messageId) {
                    return;
                }

                const [messageData] = await db
                    .select({
                        id: messageTable.id,
                        chatId: messageTable.chatId,
                        senderId: messageTable.senderId
                    })
                    .from(messageTable)
                    .where(
                        eq(messageTable.id, messageId)
                    );

                if (!messageData) {
                    socket.send(JSON.stringify({
                        type: "error",
                        message: "Message not found"
                    }));
                    return;
                }

                // Only message owner can delete it
                if (messageData.senderId !== socket.userId) {
                    socket.send(JSON.stringify({
                        type: "error",
                        message: "You can only delete your own message"
                    }));
                    return;
                }

                await db
                    .update(messageTable)
                    .set({
                        deletedAt: new Date(),
                        deletedBy: socket.userId,
                        content: null,
                        mediaUrl: null
                    })
                    .where(
                        eq(messageTable.id, messageId)
                    );

                const receiverSocket = clients.get(
                    Number(data.receiverId)
                );

                if (
                    receiverSocket &&
                    receiverSocket.readyState === 1
                ) {
                    receiverSocket.send(JSON.stringify({
                        type: "message_deleted",
                        messageId,
                        chatId: messageData.chatId
                    }));
                }

                socket.send(JSON.stringify({
                    type: "message_deleted",
                    messageId,
                    chatId: messageData.chatId
                }));

                return;
            }


            // REACTIONS =>

            if (data.type === "add_reaction") {
                const messageId = Number(data.messageId);
                const reaction = data.reaction?.trim();

                if (!messageId || !reaction) {
                    return;
                }

                const [messageData] = await db
                    .select({
                        id: messageTable.id,
                        chatId: messageTable.chatId
                    })
                    .from(messageTable)
                    .where(
                        eq(messageTable.id, messageId)
                    );

                if (!messageData) {
                    socket.send(JSON.stringify({
                        type: "error",
                        message: "Message not found"
                    }));
                    return;
                }

                const [membership] = await db
                    .select({
                        id: chatMemberTable.id
                    })
                    .from(chatMemberTable)
                    .where(
                        and(
                            eq(
                                chatMemberTable.chatId,
                                messageData.chatId
                            ),
                            eq(
                                chatMemberTable.userId,
                                socket.userId
                            )
                        )
                    );

                if (!membership) {
                    socket.send(JSON.stringify({
                        type: "error",
                        message: "You are not a member of this chat"
                    }));
                    return;
                }

                const [existingReaction] = await db
                    .select({
                        id: messageReactionTable.id
                    })
                    .from(messageReactionTable)
                    .where(
                        and(
                            eq(
                                messageReactionTable.messageId,
                                messageId
                            ),
                            eq(
                                messageReactionTable.userId,
                                socket.userId
                            )
                        )
                    );

                let reactionData;

                if (existingReaction) {
                    [reactionData] = await db
                        .update(messageReactionTable)
                        .set({
                            reaction
                        })
                        .where(
                            eq(
                                messageReactionTable.id,
                                existingReaction.id
                            )
                        )
                        .returning();
                } else {
                    [reactionData] = await db
                        .insert(messageReactionTable)
                        .values({
                            messageId,
                            userId: socket.userId,
                            reaction
                        })
                        .returning();
                }

                for (const [userId, userSocket] of clients) {
                    if (
                        userId !== socket.userId &&
                        userSocket.readyState === 1
                    ) {
                        userSocket.send(JSON.stringify({
                            type: "reaction_added",
                            reaction: reactionData
                        }));
                    }
                }

                socket.send(JSON.stringify({
                    type: "reaction_added",
                    reaction: reactionData
                }));

                return;
            }

            //remove reaction =>
            if (data.type === "remove_reaction") {
                const messageId = Number(data.messageId);

                if (!messageId) {
                    return;
                }

                await db
                    .delete(messageReactionTable)
                    .where(
                        and(
                            eq(
                                messageReactionTable.messageId,
                                messageId
                            ),
                            eq(
                                messageReactionTable.userId,
                                socket.userId
                            )
                        )
                    );

                for (const [userId, userSocket] of clients) {
                    if (
                        userSocket.readyState === 1 &&
                        userId !== socket.userId
                    ) {
                        userSocket.send(JSON.stringify({
                            type: "reaction_removed",
                            messageId,
                            userId: socket.userId
                        }));
                    }
                }

                socket.send(JSON.stringify({
                    type: "reaction_removed",
                    messageId,
                    userId: socket.userId
                }));

                return;
            }
            
            // FILE MESSAGE
            if (data.type === "file") {
                const chatId = Number(data.chatId);
                const receiverId = Number(data.receiverId);

                if (
                    !chatId ||
                    !receiverId ||
                    !data.mediaUrl
                ) {
                    return;
                }

                // sender membership
                const [membership] = await db
                    .select({
                        id: chatMemberTable.id
                    })
                    .from(chatMemberTable)
                    .where(
                        and(
                            eq(chatMemberTable.chatId, chatId),
                            eq(chatMemberTable.userId, socket.userId)
                        )
                    );

                if (!membership) {
                    socket.send(JSON.stringify({
                        type: "error",
                        message: "You are not a member of this chat"
                    }));
                    return;
                }

                // receiver membership
                const [receiverMembership] = await db
                    .select({
                        id: chatMemberTable.id
                    })
                    .from(chatMemberTable)
                    .where(
                        and(
                            eq(chatMemberTable.chatId, chatId),
                            eq(chatMemberTable.userId, receiverId)
                        )
                    );

                if (!receiverMembership) {
                    return;
                }

                // save file message
                const [newMessage] = await db
                    .insert(messageTable)
                    .values({
                        chatId,
                        senderId: socket.userId,
                        type: "file",
                        content: null,
                        mediaUrl: data.mediaUrl,
                        mediaMimeType: data.mediaMimeType,
                        mediaSize: data.mediaSize
                            ? Number(data.mediaSize)
                            : null
                    })
                    .returning();

                // receipt
                const [receipt] = await db
                    .insert(messageReciptsTable)
                    .values({
                        messageId: newMessage.id,
                        userId: receiverId,
                        status: "sent"
                    })
                    .returning();

                // Redis Pub/Sub
                await redisPublisher.publish(
                    "chat-message",
                    JSON.stringify({
                        receiverId,
                        receiptId: receipt.id,
                        message: newMessage
                    })
                );

                return;
            }


            // NORMAL MESSAGE
            const {
                chatId,
                receiverId,
                content
            } = data;

            if (
                !chatId ||
                !receiverId ||
                !content?.trim()
            ) {
                socket.send(
                    JSON.stringify({
                        type: "error",
                        message:
                            "chatId, receiverId and content are required"
                    })
                );

                return;
            }


            // Check sender membership

            const [membership] = await db
                .select({
                    id: chatMemberTable.id
                })
                .from(chatMemberTable)
                .where(
                    and(
                        eq(
                            chatMemberTable.chatId,
                            Number(chatId)
                        ),
                        eq(
                            chatMemberTable.userId,
                            socket.userId
                        )
                    )
                );

            if (!membership) {
                socket.send(
                    JSON.stringify({
                        type: "error",
                        message:
                            "You are not a member of this chat"
                    })
                );

                return;
            }


            // Check receiver membership

            const [receiverMembership] = await db
                .select({
                    id: chatMemberTable.id
                })
                .from(chatMemberTable)
                .where(
                    and(
                        eq(
                            chatMemberTable.chatId,
                            Number(chatId)
                        ),
                        eq(
                            chatMemberTable.userId,
                            Number(receiverId)
                        )
                    )
                );

            if (!receiverMembership) {
                socket.send(
                    JSON.stringify({
                        type: "error",
                        message:
                            "Receiver is not a member of this chat"
                    })
                );

                return;
            }

            //replyToMessage..
            let replyToMessage = null;

            if (data.replyToMessageId) {
                const [message] = await db
                    .select({
                        id: messageTable.id,
                        chatId: messageTable.chatId
                    })
                    .from(messageTable)
                    .where(eq(messageTable.id, Number(data.replyToMessageId)));

                if (!message) {
                    return;
                }

                if (message.chatId !== Number(chatId)) {
                    return;
                }
                replyToMessage = message;
            }


            // Save message
            const [newMessage] = await db
                .insert(messageTable)
                .values({
                    chatId: Number(chatId),
                    senderId: socket.userId,
                    type: "text",
                    content: content.trim(),
                    replyToMessageId: replyToMessage ? replyToMessage.id : null

                })
                .returning();


            // Create receipt

            const [receipt] = await db
                .insert(messageReciptsTable)
                .values({
                    messageId: newMessage.id,
                    userId: Number(receiverId),
                    status: "sent"
                })
                .returning();


            //Redis publish => 

            await redisPublisher.publish(
                "chat-message",
                JSON.stringify({
                    receiverId: Number(receiverId),
                    receiptId: receipt.id,
                    message: newMessage
                })
            );



        } catch (error) {
            console.error(
                "WebSocket message error:",
                error
            );

            socket.send(
                JSON.stringify({
                    type: "error",
                    message: "Invalid message"
                })
            );
        }
    });


    socket.on("close", async () => {
        clients.delete(socket.userId);

        await redis.del(`user:${socket.userId}:presence`)

        await db
            .update(usersTable)
            .set({
                lastSeen: new Date()
            })
            .where(
                eq(usersTable.id, socket.userId)
            );

        // Notify remaining users
        for (const [userId, userSocket] of clients) {
            if (userSocket.readyState === 1) {
                userSocket.send(
                    JSON.stringify({
                        type: "user_offline",
                        userId: socket.userId
                    })
                );
            }
        }

        console.log(
            `User ${socket.userId} disconnected`
        );
    });
});


server.listen(env.PORT, () => {
    console.log(`server is running on port ${env.PORT}`)

});