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
                const vaccinationsLength = yield vaccinationModel_1.default.find().count();
                const limit = 100;
                const totalPages = Math.ceil(vaccinationsLength / limit);
                const skip = limit * (page - 1);
                const vaccinations = yield vaccinationModel_1.default
                    .find()
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
                const vaccinationsFirstDoseLength = yield vaccinationModel_1.default.find({ vacina_descricao_dose: "1ª Dose" }).count();
                const vaccinationsSecondDoseLength = yield vaccinationModel_1.default.find({ vacina_descricao_dose: "2ª Dose" }).count();
                const vaccinationsThirdDoseLength = yield vaccinationModel_1.default.find({ vacina_descricao_dose: "Reforço" }).count();
                const vaccinationsFourthDoseLength = yield vaccinationModel_1.default.find({ vacina_descricao_dose: "2º Reforço" }).count();
                const vaccinationsFifthDoseLength = yield vaccinationModel_1.default.find({ vacina_descricao_dose: "3º Reforço" }).count();
                const vaccinationsLength = yield vaccinationModel_1.default.find().count();
                const totalDoses = {
                    firstDose: vaccinationsFirstDoseLength,
                    secondDose: vaccinationsSecondDoseLength,
                    thirdDose: vaccinationsThirdDoseLength,
                    fourthDose: vaccinationsFourthDoseLength,
                    fifthDose: vaccinationsFifthDoseLength,
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
            const { document_id, paciente_id, paciente_idade, paciente_dataNascimento, paciente_enumSexoBiologico, paciente_racaCor_codigo, paciente_racaCor_valor, paciente_endereco_coIbgeMunicipio, paciente_endereco_coPais, paciente_endereco_nmMunicipio, paciente_endereco_nmPais, paciente_endereco_uf, paciente_endereco_cep, paciente_nacionalidade_enumNacionalidade, estabelecimento_valor, estabelecimento_razaoSocial, estalecimento_noFantasia, estabelecimento_municipio_codigo, estabelecimento_municipio_nome, estabelecimento_uf, vacina_grupoAtendimento_codigo, vacina_grupoAtendimento_nome, vacina_categoria_codigo, vacina_categoria_nome, vacina_lote, vacina_fabricante_nome, vacina_fabricante_referencia, vacina_dataAplicacao, vacina_descricao_dose, vacina_codigo, vacina_nome, sistema_origem } = req.body;
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
