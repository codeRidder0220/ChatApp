import app from "./app.js"
import { env } from "./config/env.js";
import jwt from "jsonwebtoken";
import http from "node:http";
import { WebSocketServer } from 'ws'

const server = http.createServer(app);  //make http server where express app run in it

const wss = new WebSocketServer({ server });   //made websocket server and attach with http server

const clients = new Set(); //jitne bhi users connect krege (unka set bnta jayega)


//now on the connection of wss server =>
wss.on("connection", (socket , request) => {
    console.log("websocket client connected");

    const cookies = request.headers.cookie;
    console.log("cookies:" , cookies);

    if(!cookies){
        socket.close();
        return;
    }

    const accessToken = cookies.split("; ").find((cookie)=>cookie.startsWith("accessToken="))?.split("=")[1];

    if(!accessToken){
        socket.close();
        return;
    }
    let decoded;

    try{
        decoded = jwt.verify(
            accessToken,
            env.ACCESS_TOKEN_SECRET
        );
    }catch(error){
        socket.close();
        return;
    }

    socket.userId = decoded.userId;

    console.log(`user ${socket.userId} connected`);
    


    clients.add(socket);

    //client se msg recieve krna...
    socket.on("message", (message) => {
        console.log("recieved", message.toString());

        //hr connected clients ko check krta hai
        for(const client of clients){
            if(client !== socket && client.readyState === 1){   //jisne msg bheja hai usi ko wapas mt bhejo && sirf connected clients ko msg bhejna hai 
                client.send(message.toString());
            }
        }
    });
    
    socket.on("close", () => {
        clients.delete(socket);  //jb user ka connection set se remove hojaye

        console.log(`user ${socket.userId} disconnected`);
    });
});


server.listen(env.PORT, () => {
    console.log(`server is running on port ${env.PORT}`)

});