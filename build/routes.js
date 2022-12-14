"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const caseDayController_1 = __importDefault(require("./Controllers/caseDayController"));
const router = (0, express_1.Router)();
const path_url_post = process.env.PATH_URL_POST || '';
router.get('/cases-day', caseDayController_1.default.index);
router.post(path_url_post, caseDayController_1.default.addCaseDay);
exports.default = router;
