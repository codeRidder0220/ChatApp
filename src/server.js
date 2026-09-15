import app from "./app.js"
import { env } from "./config/env.js";
import jwt from "jsonwebtoken";
import http from "node:http";
import { WebSocketServer } from 'ws'
import { db } from "./db/index.js";
import { usersTable , messageTable, chatMemberTable, messageReciptsTable } from "./db/schema.js"
import { and, eq } from "drizzle-orm"




const server = http.createServer(app);  //make http server where express app run in it

const wss = new WebSocketServer({ server });   //made websocket server and attach with http server

const clients = new Map(); //jitne bhi users connect krege (unka set bnta jayega)


//now on the connection of wss server =>
wss.on("connection", (socket, request) => {
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
                        eq(chatMemberTable.chatId , messageData.chatId),
                        eq(chatMemberTable.userId , socket.userId)
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


            // Save message

            const [newMessage] = await db
                .insert(messageTable)
                .values({
                    chatId: Number(chatId),
                    senderId: socket.userId,
                    type: "text",
                    content: content.trim()
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


            // Find receiver

            const receiverSocket = clients.get(
                Number(receiverId)
            );


            // Send message

            if (
                receiverSocket &&
                receiverSocket.readyState === 1
            ) {
                receiverSocket.send(
                    JSON.stringify({
                        type: "new_message",
                        message: newMessage
                    })
                );


                // Delivered

                await db
                    .update(messageReciptsTable)
                    .set({
                        status: "delivered",
                        deliveredAt: new Date()
                    })
                    .where(
                        eq(
                            messageReciptsTable.id,
                            receipt.id
                        )
                    );
            }

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


    socket.on("close", async() => {
        clients.delete(socket.userId);

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