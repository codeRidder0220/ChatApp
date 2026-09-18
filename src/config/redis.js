import Redis from "ioredis";
import { env } from "./env.js";

export const redis = new Redis(env.REDIS_URL);
export const redisPublisher = redis.duplicate();
export const redisSubscriber = redis.duplicate();

redis.on("connect" , ()=>{
    console.log("Redis connected");
});

redisPublisher.on("connect" , ()=>{
    console.log("Redis publisher connected");
});

redisSubscriber.on("connect" , ()=>{
    console.log("Redis Subscriber connected");
});

redis.on("error",(error)=>{
    console.error("Redis error: " , error)
});

redisPublisher.on("error" , (error)=>{
    console.error("Redis publisher error:" , error);
});

redisSubscriber.on("error" , (error)=>{
    console.error("Redis Subscriber error:" , error);
});
