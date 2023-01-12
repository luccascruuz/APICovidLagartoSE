import { Router } from 'express'
import CaseDay from './Controllers/caseDayController'
import Vaccination from './Controllers/vaccinationController'

const router = Router()

const path_url_post = process.env.PATH_URL_POST || ''
const path_url_vaccination_post = process.env.PATH_URL_VACCINATION_POST || ''

router.get('/cases-day', CaseDay.index)
router.get('/last-seven-days', CaseDay.lastSevenDays)
router.get('/total-cases-and-deaths', CaseDay.totalCasesAndDeaths)
router.get('/moving-average-of-cases', CaseDay.movingAverageOfCases)
router.post(path_url_post, CaseDay.addCaseDay)

router.post(path_url_vaccination_post, Vaccination.addVaccination)
router.get('/vaccination', Vaccination.index)
router.get('/total-doses-applied', Vaccination.totalDosesApplied)

export default router