"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const connectDatabase = () => {
    console.log("Wait connecting to the database...");
    const mongo_uri = process.env.MONGO_URI || '';
    mongoose_1.default.set('strictQuery', false);
    mongoose_1.default.connect(mongo_uri)
        .then(() => console.log('MongoDB Connected!'))
        .catch((err) => console.log(`Error connecting to MongoDB Atlas: ${err}`));
};
exports.default = connectDatabase;
