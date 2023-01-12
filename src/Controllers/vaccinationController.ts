import { Request, Response } from "express";
import vaccinationModel from "../Models/vaccinationModel";

const Vaccination = {
    async index(req: Request, res: Response) {
        try {
            const page = req.query.page ? Number(req.query.page) : 1;
            const vaccinationsLength = await vaccinationModel.find().count()
            const limit = 100;
            const totalPages = Math.ceil(vaccinationsLength / limit);
            const skip = limit * (page - 1);
            const vaccinations = await vaccinationModel
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
        } catch (error) {
            return res.status(500).json({ error: error });
        }
    },

    async totalDosesApplied(req: Request, res: Response) {
        try {
            const vaccinationsFirstDoseLength = await vaccinationModel.find({ vacina_descricao_dose: "1ª Dose" }).count();
            const vaccinationsSecondDoseLength = await vaccinationModel.find({ vacina_descricao_dose: "2ª Dose" }).count();
            const vaccinationsThirdDoseLength = await vaccinationModel.find({ vacina_descricao_dose: "Reforço" }).count();
            const vaccinationsFourthDoseLength = await vaccinationModel.find({ vacina_descricao_dose: "2º Reforço" }).count();
            const vaccinationsFifthDoseLength = await vaccinationModel.find({ vacina_descricao_dose: "3º Reforço" }).count();
            const vaccinationsLength = await vaccinationModel.find().count()

            const totalDoses = {
                firstDose: vaccinationsFirstDoseLength,
                secondDose: vaccinationsSecondDoseLength,
                thirdDose: vaccinationsThirdDoseLength,
                fourthDose: vaccinationsFourthDoseLength,
                fifthDose: vaccinationsFifthDoseLength,
                totalDoses: vaccinationsLength
            }

            return res.status(200).json(totalDoses)
        } catch (error) {
            return res.status(500).json({ error: error });
        }
    },

    async addVaccination(req: Request, res: Response) {
        const {
            document_id,
            paciente_id,
            paciente_idade,
            paciente_dataNascimento,
            paciente_enumSexoBiologico,
            paciente_racaCor_codigo,
            paciente_racaCor_valor,
            paciente_endereco_coIbgeMunicipio,
            paciente_endereco_coPais,
            paciente_endereco_nmMunicipio,
            paciente_endereco_nmPais,
            paciente_endereco_uf,
            paciente_endereco_cep,
            paciente_nacionalidade_enumNacionalidade,
            estabelecimento_valor,
            estabelecimento_razaoSocial,
            estalecimento_noFantasia,
            estabelecimento_municipio_codigo,
            estabelecimento_municipio_nome,
            estabelecimento_uf,
            vacina_grupoAtendimento_codigo,
            vacina_grupoAtendimento_nome,
            vacina_categoria_codigo,
            vacina_categoria_nome,
            vacina_lote,
            vacina_fabricante_nome,
            vacina_fabricante_referencia,
            vacina_dataAplicacao,
            vacina_descricao_dose,
            vacina_codigo,
            vacina_nome,
            sistema_origem
        } = req.body;

        try {
            const vaccination = await vaccinationModel.create(req.body);
            return res
                .status(201)
                .json({ message: "Vacina adicionada com sucesso", data: vaccination });
        } catch (error) {
            return res.status(500).json({ error: error });
        }
    },
};

export default Vaccination;
