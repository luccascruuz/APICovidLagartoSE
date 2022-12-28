import { Request, Response } from 'express'
import { format, subDays, addDays, addHours } from 'date-fns'
import caseDayModel from '../Models/caseDayModel'

const CaseDay = {
    async index(req: Request, res: Response) {

        const cases = await caseDayModel.find()
        return res.status(200).json(cases)
    },
    async totalCasesAndDeaths(req: Request, res: Response) {
        const cases = await caseDayModel.findOne().sort({ date: -1 })
        return res.status(200).json({
            totalCases: cases?.total_cases,
            totalDeaths: cases?.deaths,
            casesToday: cases?.new_cases,
            deathsToday: cases?.new_deaths,
            date: cases?.date
        })
    },
    async lastSevenDays(req: Request, res: Response) {
        const lastCase = await caseDayModel.findOne().sort({ date: -1 })

        const dateLastCase = format(addHours(new Date(lastCase?.date ?? ''), 3), 'yyyy/MM/dd')

        const dateLastSevenDay = format(subDays(addHours(new Date(dateLastCase), 3), 7), 'yyyy/MM/dd')

        const cases = await caseDayModel.find({ date: { $gte: dateLastSevenDay, $lte: dateLastCase } })
        return res.status(200).json(cases)
    },
    async movingAverageOfCases(req: Request, res: Response) {
        const lastCase = await caseDayModel.findOne().sort({ date: -1 })

        const lastWeekNumber = lastCase?.week_number ?? 0
        const arrayCasesForWeek = new Array(lastWeekNumber).fill(null)

        let movingAverage: { movingAverage: number; date: Date }[] = []

        const arrayMovitest = arrayCasesForWeek.map(async (value, index) => {
            const casesForWeek = await caseDayModel.find({ week_number: index + 1 })

            if (casesForWeek.length > 0) {
                const somaCasos = casesForWeek.reduce(function (totalSum, caseDay) {
                    const numberCaseDay = caseDay.new_cases ?? 0

                    return totalSum + numberCaseDay
                }, 0)

                movingAverage.push({
                    movingAverage: Math.round(somaCasos / casesForWeek.length),
                    date: casesForWeek[casesForWeek.length - 1].date ?? new Date()
                })
            }
        })

        await Promise.all(arrayMovitest)

        movingAverage.sort(function (a, b) {
            return a.date?.getTime() - b.date?.getTime()
        })

        return res.status(200).json(movingAverage)

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