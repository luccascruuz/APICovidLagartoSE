"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRedis = exports.setRedis = exports.getRedis = exports.redisClient = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const util_1 = require("util");
const keysRedisClient = {
    host: process.env.HOST_REDIS,
    username: process.env.USERNAME_REDIS,
    port: Number(process.env.PORT_REDIS),
    password: process.env.PASSWORD_REDIS
};
const redisClient = new ioredis_1.default(keysRedisClient);
exports.redisClient = redisClient;
function getRedis(value) {
    const syncRedisGet = (0, util_1.promisify)(redisClient.get).bind(redisClient);
    return syncRedisGet(value);
}
exports.getRedis = getRedis;
function setRedis(key, value) {
    const syncRedisSet = (0, util_1.promisify)(redisClient.set).bind(redisClient);
    return syncRedisSet(key, value);
}
exports.setRedis = setRedis;
function deleteRedis(key) {
    return __awaiter(this, void 0, void 0, function* () {
        yield redisClient.del(key);
    });
}
exports.deleteRedis = deleteRedis;
