import { Router } from 'express'
import CaseDay from './Controllers/caseDayController'

const router = Router()

const path_url_post = process.env.PATH_URL_POST || ''

router.get('/cases-day', CaseDay.index)
router.post(path_url_post, CaseDay.addCaseDay)

export default router