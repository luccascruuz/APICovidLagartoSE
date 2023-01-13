import Redis from "ioredis";
declare const redisClient: Redis;
declare function getRedis(value: string): Promise<string | null | undefined>;
declare function setRedis(key: string, value: string): Promise<unknown>;
declare function deleteRedis(key: string[]): Promise<void>;
export { redisClient, getRedis, setRedis, deleteRedis };
