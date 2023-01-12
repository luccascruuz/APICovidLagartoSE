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
const vaccinationModel_1 = __importDefault(require("../Models/vaccinationModel"));
const Vaccination = {
    index(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const page = req.query.page ? Number(req.query.page) : 1;
                const dose = req.query.dose ? { dose: Number(req.query.dose) } : {};
                const vaccinationsLength = (yield vaccinationModel_1.default.find(dose)).length;
                const limit = 50;
                const totalPages = Math.ceil(vaccinationsLength / limit);
                const skip = limit * (page - 1);
                const vaccinations = yield vaccinationModel_1.default
                    .find(dose)
                    .skip(skip)
                    .limit(limit);
                return res
                    .status(200)
                    .json({
                    page: page,
                    totalPages: totalPages,
                    totalVaccinations: vaccinationsLength,
                    vaccinations: vaccinations,
                });
            }
            catch (error) {
                return res.status(500).json({ error: error });
            }
        });
    },
    totalDosesApplied(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const vaccinationsLength = (yield vaccinationModel_1.default.find()).length;
                const vaccinationsFirstDoseLength = (yield vaccinationModel_1.default.find({ dose: 1 })).length;
                const vaccinationsSecondDoseLength = (yield vaccinationModel_1.default.find({ dose: 2 })).length;
                const vaccinationsThirdDoseLength = (yield vaccinationModel_1.default.find({ dose: 3 })).length;
                const vaccinationsFourthDoseLength = (yield vaccinationModel_1.default.find({ dose: 4 })).length;
                const totalDoses = {
                    firstDose: vaccinationsFirstDoseLength,
                    secondDose: vaccinationsSecondDoseLength,
                    thirdDose: vaccinationsThirdDoseLength,
                    fourthDose: vaccinationsFourthDoseLength,
                    totalDoses: vaccinationsLength
                };
                return res.status(200).json(totalDoses);
            }
            catch (error) {
                return res.status(500).json({ error: error });
            }
        });
    },
    addVaccination(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { date, state, city, ibgeID, dose, vaccine, sex, age, count, pop2021, } = req.body;
            try {
                const vaccination = yield vaccinationModel_1.default.create(req.body);
                return res
                    .status(201)
                    .json({ message: "Vacina adicionada com sucesso", data: vaccination });
            }
            catch (error) {
                return res.status(500).json({ error: error });
            }
        });
    },
};
exports.default = Vaccination;