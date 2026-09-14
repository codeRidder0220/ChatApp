import { eq ,  and , asc } from "drizzle-orm";
import { db } from "../db/index.js";
import { chatTable , chatMemberTable , usersTable , messageTable } from "../db/schema.js";


export const createPrivateChat = async(req,res,next)=>{
    try {
        const currentUserId = req.user.id;
        const otherUserId = Number(req.body.userId);

        if(!otherUserId){
            return res.status(400).json({
                success:false,
                message:"USer ID is required"
            });
        }

        if(currentUserId === otherUserId){
            return res.status(400).json({
                success:false,
                message:"you can not create a chat with yourself"
            });
        }

        //check whether other user exists..
        const [otherUser] = await db
            .select({
                id: usersTable.id
            })
            .from(usersTable)
            .where(eq(usersTable.id,otherUserId));

        if(!otherUser){
            return res.status(404).json({
                success:false,
                message:"User not found"
            });
        }

        //create unique key for both users..
        const directKey = `${Math.min(currentUserId,otherUserId)}:${Math.max(currentUserId,otherUserId)}`;

        //check existing private chats..
        const [existingChat] = await db
            .select()
            .from(chatTable)
            .where(eq(chatTable.directKey,directKey));
        
            if(existingChat){
                return res.status(200).json({
                    success:true,
                    message:"Private chat already exists",
                    chat: existingChat
                });
            }

        //create chat..
        const [chat] = await db 
            .insert(chatTable)
            .values({
                type:"private",
                directKey
            }).returning();

        //add both users to chat..
        await db.insert(chatMemberTable).values([
            {
                chatId:chat.id,
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

//message history..
export const getChatMessage = async (req,res,next) => {
    try {
        const currentUserId = req.user.id;
        const chatId = Number(req.params.chatId);

        if(!chatId){
            return res.status(400).json({
                success:false,
                message:"Valid chat ID is required"
            });
        }

        //check whether current user is a member of this chat..
        const [membership] = await db
            .select({
                id: chatMemberTable.id
            })
            .from(chatMemberTable)
            .where(and(
                eq(chatMemberTable.chatId , chatId),
                eq(chatMemberTable.userId , currentUserId)
            ));

            if(!membership){
                return res.status(403).json({
                    success:false,
                    message: "You are not a member of this chat"
                });
            }

            //get message...
            const message = await db 
                .select()
                .from(messageTable)
                .where(eq(messageTable.chatId , chatId))
                .orderBy(asc(messageTable.createdAt));
            
            return res.status(200).json({
                success:true,
                message
            });


    } catch (error) {
        next(error);
    }
}