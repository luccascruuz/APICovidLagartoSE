import { Router } from 'express'
import CaseDay from './Controllers/caseDayController'

const router = Router()

router.get('/cases-day', CaseDay.index)
router.post('/case-day', CaseDay.addCaseDay)

export default router