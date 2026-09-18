import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { errorMiddeleware } from "./middlewares/error.middlewares.js";
import authRoutes from "./routes/auth.routes.js"
import chatRoutes from "./routes/chat.routes.js"
import { authenticate , authorize, authorizePermission } from "./middlewares/auth.middleware.js";
import {redis} from "./config/redis.js"

const app = express();

//frontend and backend ke bich cross origin req aloow krega..
app.use(cors({
    origin: "http://localhost:5173",
    credentials:true
}));


app.use(express.json());  //json body read krne ke liye
app.use(cookieParser());   //cookie ko req.cookie me available krega



app.get("/api/health", (req,res)=>{
    res.json({
        success: true,
        message: "chat backend is running"
    });
});


app.get("/api/redis-test" , async(req,res,next)=>{
    try {
        await redis.set("test:name" , "karthik");
        const val = await redis.get("test:name");

        return res.json({
            success: true,
            val
        });
    } catch (error) {
        next(error);
    }
})

app.use("/api/auth" , authRoutes);
app.use("/api/chats", chatRoutes);

app.use(errorMiddeleware);

export default app;
