import { Request, Response } from 'express'
import caseDayModel from '../Models/caseDayModel'

const CaseDay = {
    async index(req: Request, res: Response): Promise<Response>{

        let cases = await caseDayModel.find()
        return res.json(cases)
    },

    async addCaseDay(req: Request, res: Response): Promise<Response>{
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

        let cases = await caseDayModel.create(req.body)
        return res.json(cases)
    },
}

export default CaseDay