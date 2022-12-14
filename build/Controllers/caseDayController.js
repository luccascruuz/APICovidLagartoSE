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
const caseDayModel_1 = __importDefault(require("../Models/caseDayModel"));
const CaseDay = {
    index(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            let cases = yield caseDayModel_1.default.find();
            return res.json(cases);
        });
    },
    addCaseDay(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { week_number, date, uf_state, city, ibge_id, new_deaths, deaths, new_cases, total_cases, deaths_per_100k_inhabitants, totalCases_per_100k_inhabitants, deaths_by_totalCases, } = req.body;
            let cases = yield caseDayModel_1.default.create(req.body);
            return res.json(cases);
        });
    },
};
exports.default = CaseDay;
