import Redis from "ioredis";
import { promisify } from "util";

const keysRedisClient = {
    host: process.env.HOST_REDIS,
    username: process.env.USERNAME_REDIS ,
    port: Number(process.env.PORT_REDIS),
    password: process.env.PASSWORD_REDIS
}

const redisClient = new Redis(keysRedisClient);

function getRedis(value: string) {
    const syncRedisGet = promisify(redisClient.get).bind(redisClient);

    return syncRedisGet(value);
}

function setRedis(key: string, value: string) {
    const syncRedisSet = promisify(redisClient.set).bind(redisClient);

    return syncRedisSet(key, value)
}

async function deleteRedis(key: string[]) {
    await redisClient.del(key)
}

export { redisClient, getRedis, setRedis, deleteRedis };
