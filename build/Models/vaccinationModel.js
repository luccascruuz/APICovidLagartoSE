"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const Vaccination = new mongoose_1.Schema({
    document_id: String,
    paciente_id: String,
    paciente_idade: Number,
    paciente_dataNascimento: Date,
    paciente_enumSexoBiologico: String,
    paciente_racaCor_codigo: Number,
    paciente_racaCor_valor: String,
    paciente_endereco_coIbgeMunicipio: String,
    paciente_endereco_coPais: String,
    paciente_endereco_nmMunicipio: String,
    paciente_endereco_nmPais: String,
    paciente_endereco_uf: String,
    paciente_endereco_cep: String,
    paciente_nacionalidade_enumNacionalidade: String,
    estabelecimento_valor: Number,
    estabelecimento_razaoSocial: String,
    estalecimento_noFantasia: String,
    estabelecimento_municipio_codigo: Number,
    estabelecimento_municipio_nome: String,
    estabelecimento_uf: String,
    vacina_grupoAtendimento_codigo: Number,
    vacina_grupoAtendimento_nome: String,
    vacina_categoria_codigo: Number,
    vacina_categoria_nome: String,
    vacina_lote: String,
    vacina_fabricante_nome: String,
    vacina_fabricante_referencia: String,
    vacina_dataAplicacao: Date,
    vacina_descricao_dose: String,
    vacina_codigo: Number,
    vacina_nome: String,
    sistema_origem: String
}, { timestamps: true });
exports.default = mongoose_1.default.model('Vaccination', Vaccination);
