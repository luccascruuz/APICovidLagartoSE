import { Router, type RequestHandler } from 'express'
import { AppError } from '../../shared/errors'
import type { SragController } from './srag.controller'

export function sragRoutes(controller: SragController, dadosProntos: () => Promise<boolean>): Router {
  const router = Router()

  const exigirDados: RequestHandler = async (_req, res, next) => {
    if (await dadosProntos()) return next()
    res.setHeader('Retry-After', '60')
    next(new AppError(503, 'DADOS_CARREGANDO', 'Os dados ainda estão sendo importados do OpenDataSUS. Tente novamente em instantes.'))
  }

  router.get('/dicionario', controller.dicionario)
  router.get('/casos', exigirDados, controller.casos)
  router.get('/casos/:id', exigirDados, controller.caso)
  router.get('/resumo', exigirDados, controller.resumo)
  router.get('/semanas', exigirDados, controller.semanas)
  router.get('/anos', exigirDados, controller.anos)

  return router
}
