import { Request, Response } from "express";
import vaccinationModel from "../Models/vaccinationModel";

const Vaccination = {
    async index(req: Request, res: Response) {
        try {
            const page = req.query.page ? Number(req.query.page) : 1;
            const dose = req.query.dose ? { dose: Number(req.query.dose) } : {};
            const vaccinationsLength = (await vaccinationModel.find(dose)).length;
            const limit = 50;
            const totalPages = Math.ceil(vaccinationsLength / limit);
            const skip = limit * (page - 1);
            const vaccinations = await vaccinationModel
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
        } catch (error) {
            return res.status(500).json({ error: error });
        }
    },

    async totalDosesApplied(req: Request, res: Response) {
        try {
            const vaccinationsLength = (await vaccinationModel.find()).length;
            const vaccinationsFirstDoseLength = (await vaccinationModel.find({ dose: 1 })).length;
            const vaccinationsSecondDoseLength = (await vaccinationModel.find({ dose: 2 })).length;
            const vaccinationsThirdDoseLength = (await vaccinationModel.find({ dose: 3 })).length;
            const vaccinationsFourthDoseLength = (await vaccinationModel.find({ dose: 4 })).length;

            const totalDoses = {
                firstDose: vaccinationsFirstDoseLength,
                secondDose: vaccinationsSecondDoseLength,
                thirdDose: vaccinationsThirdDoseLength,
                fourthDose: vaccinationsFourthDoseLength,
                totalDoses: vaccinationsLength
            }

            return res.status(200).json(totalDoses)
        } catch (error) {
            return res.status(500).json({ error: error });
        }
    },

    async addVaccination(req: Request, res: Response) {
        const {
            date,
            state,
            city,
            ibgeID,
            dose,
            vaccine,
            sex,
            age,
            count,
            pop2021,
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
