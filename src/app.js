import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { errorMiddeleware } from "./middlewares/error.middlewares.js";
import authRoutes from "./routes/auth.routes.js"


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

app.use("/api/auth" , authRoutes)


app.use(errorMiddeleware);

export default app;
