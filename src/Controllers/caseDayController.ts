import { Request, Response } from 'express'
import { format, subDays, addHours } from 'date-fns'
import caseDayModel from '../Models/caseDayModel'

const CaseDay = {
    async index(req: Request, res: Response) {

        const cases = await caseDayModel.find()
        return res.status(200).json(cases)
    },
    async totalCasesAndDeaths(req: Request, res: Response) {
        const cases = await caseDayModel.findOne().sort({ date: -1 })
        return res.status(200).json({ totalCases: cases?.total_cases, totalDeaths: cases?.deaths })
    },
    async lastSevenDays(req: Request, res: Response) {
        const lastCase = await caseDayModel.findOne().sort({ date: -1 })

        const dateLastCase = format(addHours(new Date(lastCase?.date ?? ''), 3), 'yyyy/MM/dd')

        const dateLastSevenDay = format(subDays(addHours(new Date(dateLastCase), 3), 7), 'yyyy/MM/dd')

        const cases = await caseDayModel.find({ date: { $gte: dateLastSevenDay, $lte: dateLastCase } })
        return res.status(200).json(cases)
    },
    async addCaseDay(req: Request, res: Response) {
        const {
            week_number,
            date,
            uf_state,
            city,
            ibge_id,
            new_deaths,
            deaths,
            new_cases,
            total_cases,
            deaths_per_100k_inhabitants,
            totalCases_per_100k_inhabitants,
            deaths_by_totalCases,
        } = req.body

        try {
            const caseDay = await caseDayModel.create(req.body)
            return res.status(201).json({ message: "Caso do dia adicionado com sucesso", data: caseDay })
        } catch (error) {
            res.status(500).json({ error: error })
        }
    },
}

export default CaseDay