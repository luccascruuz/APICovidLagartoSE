import { Router } from 'express'
import CaseDay from './Controllers/caseDayController'

const router = Router()

const path_url_post = process.env.PATH_URL_POST || ''

router.get('/cases-day', CaseDay.index)
router.get('/last-seven-days', CaseDay.lastSevenDays)
router.get('/total-cases-and-deaths', CaseDay.totalCasesAndDeaths)
router.get('/moving-average-o-cases', CaseDay.movingAverageOfCases)
router.post(path_url_post, CaseDay.addCaseDay)

export default router