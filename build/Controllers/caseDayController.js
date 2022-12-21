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
const date_fns_1 = require("date-fns");
const caseDayModel_1 = __importDefault(require("../Models/caseDayModel"));
const CaseDay = {
    index(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const cases = yield caseDayModel_1.default.find();
            return res.status(200).json(cases);
        });
    },
    totalCasesAndDeaths(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const cases = yield caseDayModel_1.default.findOne().sort({ date: -1 });
            return res.status(200).json({
                totalCases: cases === null || cases === void 0 ? void 0 : cases.total_cases,
                totalDeaths: cases === null || cases === void 0 ? void 0 : cases.deaths,
                casesToday: cases === null || cases === void 0 ? void 0 : cases.new_cases,
                deathsToday: cases === null || cases === void 0 ? void 0 : cases.new_deaths,
                date: cases === null || cases === void 0 ? void 0 : cases.date
            });
        });
    },
    lastSevenDays(req, res) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const lastCase = yield caseDayModel_1.default.findOne().sort({ date: -1 });
            const dateLastCase = (0, date_fns_1.format)((0, date_fns_1.addHours)(new Date((_a = lastCase === null || lastCase === void 0 ? void 0 : lastCase.date) !== null && _a !== void 0 ? _a : ''), 3), 'yyyy/MM/dd');
            const dateLastSevenDay = (0, date_fns_1.format)((0, date_fns_1.subDays)((0, date_fns_1.addHours)(new Date(dateLastCase), 3), 7), 'yyyy/MM/dd');
            const cases = yield caseDayModel_1.default.find({ date: { $gte: dateLastSevenDay, $lte: dateLastCase } });
            return res.status(200).json(cases);
        });
    },
    addCaseDay(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { week_number, date, uf_state, city, ibge_id, new_deaths, deaths, new_cases, total_cases, deaths_per_100k_inhabitants, totalCases_per_100k_inhabitants, deaths_by_totalCases, } = req.body;
            try {
                const caseDay = yield caseDayModel_1.default.create(req.body);
                return res.status(201).json({ message: "Caso do dia adicionado com sucesso", data: caseDay });
            }
            catch (error) {
                res.status(500).json({ error: error });
            }
        });
    },
};
exports.default = CaseDay;
