import { Request, Response } from 'express'
import { format, subDays, addHours } from 'date-fns'
import caseDayModel from '../Models/caseDayModel'
import { deleteRedis, getRedis, setRedis } from '../redis-config'

const CaseDay = {

    async index(req: Request, res: Response) {

        try {
            const casesRedis = await getRedis('casesDay')

            if (casesRedis) return res.status(200).json(JSON.parse(casesRedis))

            const cases = await caseDayModel.find()

            await setRedis('casesDay', JSON.stringify(cases))

            return res.status(200).json(cases)
        }
        catch (error) {
            return res.status(500).json({ error: error })
        }
    },

    async totalCasesAndDeaths(req: Request, res: Response) {
        try {
            const totalCasesAndDeathsRedis = await getRedis('totalCasesAndDeaths')

            if (totalCasesAndDeathsRedis) return res.status(200).json(JSON.parse(totalCasesAndDeathsRedis))

            const cases = await caseDayModel.findOne().sort({ date: -1 })

            const objTotalCasesAndDeaths = {
                totalCases: cases?.total_cases,
                totalDeaths: cases?.deaths,
                casesToday: cases?.new_cases,
                deathsToday: cases?.new_deaths,
                date: cases?.date
            }

            await setRedis('totalCasesAndDeaths', JSON.stringify(objTotalCasesAndDeaths))

            return res.status(200).json(objTotalCasesAndDeaths)
        } catch (error) {
            return res.status(500).json({ error: error })
        }
    },

    async lastSevenDays(req: Request, res: Response) {
        try {
            const lastSevenDaysRedis = await getRedis('lastSevenDays')
            if (lastSevenDaysRedis) return res.status(200).json(JSON.parse(lastSevenDaysRedis))


            const lastCase = await caseDayModel.findOne().sort({ date: -1 })

            const dateLastCase = format(addHours(new Date(lastCase?.date ?? ''), 3), 'yyyy/MM/dd')

            const dateLastSevenDay = format(subDays(addHours(new Date(dateLastCase), 3), 7), 'yyyy/MM/dd')

            const cases = await caseDayModel.find({ date: { $gte: dateLastSevenDay, $lte: dateLastCase } })
            await setRedis('lastSevenDays', JSON.stringify(cases))

            return res.status(200).json(cases)
        }
        catch (error) {
            return res.status(500).json({ error: error })
        }
    },

    async movingAverageOfCases(req: Request, res: Response) {
        try {
            const movingAverageOfCasesRedis = await getRedis('movingAverageOfCases')
            if (movingAverageOfCasesRedis) return res.status(200).json(JSON.parse(movingAverageOfCasesRedis))

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

            await setRedis('movingAverageOfCases', JSON.stringify(movingAverage))

            return res.status(200).json(movingAverage)
        }
        catch (error) {
            return res.status(500).json({ error: error })
        }
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
            await deleteRedis(['casesDay', 'totalCasesAndDeaths', 'lastSevenDays', 'movingAverageOfCases'])
            return res.status(201).json({ message: "Caso do dia adicionado com sucesso", data: caseDay })
        } catch (error) {
            return res.status(500).json({ error: error })
        }
    },
}

export default CaseDay