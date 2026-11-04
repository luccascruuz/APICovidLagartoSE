import cors from 'cors'
import express, { type Express } from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import swaggerUi from 'swagger-ui-express'
import type { Config } from './config/env'
import { criarOpenApi } from './docs/openapi'
import type { SyncService } from './ingestion/sync.service'
import { Metricas } from './observability/metricas'
import { monitoramentoNulo, type Monitoramento } from './observability/monitoramento'
import { sistemaRoutes } from './modules/sistema/sistema.routes'
import { SragController } from './modules/srag/srag.controller'
import { sragRoutes } from './modules/srag/srag.routes'
import type { SragService } from './modules/srag/srag.service'
import { rotaNaoEncontrada, tratadorDeErros } from './shared/errors'
import type { Logger } from './shared/logger'

export interface AppDeps {
  config: Config
  logger: Logger
  service: SragService
  sync: SyncService
  monitoramento?: Monitoramento
  metricas?: Metricas
  inicioProcesso?: Date
}

export function criarApp(deps: AppDeps): Express {
  const { config, logger, service, sync } = deps
  const monitoramento = deps.monitoramento ?? monitoramentoNulo
  const inicioProcesso = deps.inicioProcesso ?? new Date()
  const metricas = deps.metricas ?? new Metricas(inicioProcesso)

  const app = express()
  app.disable('x-powered-by')
  app.set('query parser', 'extended')

  app.use(helmet())
  app.use(cors({ origin: config.corsOrigin, methods: ['GET', 'POST'] }))
  app.use(express.json({ limit: '10kb' }))
  app.use(metricas.middleware())

  app.use((req, res, next) => {
    const inicio = process.hrtime.bigint()
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - inicio) / 1e6
      logger.debug({ metodo: req.method, rota: req.originalUrl, status: res.statusCode, ms: Math.round(ms) }, 'requisição')
    })
    next()
  })

  if (config.rateLimitPorMinuto > 0) {
    app.use(
      rateLimit({
        windowMs: 60_000,
        limit: config.rateLimitPorMinuto,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        message: { erro: { codigo: 'LIMITE_EXCEDIDO', mensagem: 'Muitas requisições. Tente novamente em instantes.' } },
      }),
    )
  }

  app.use('/v1/srag', (_req, res, next) => {
    res.setHeader('Cache-Control', 'public, max-age=300')
    next()
  })

  const openApi = criarOpenApi(config)
  app.get('/openapi.json', (_req, res) => {
    res.json(openApi)
  })
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApi, { customSiteTitle: 'API SRAG Lagarto-SE' }))
  app.get('/', (_req, res) => {
    res.redirect('/docs')
  })

  app.use(sistemaRoutes({ config, sync, service, metricas, monitoramento, inicioProcesso }))
  app.use('/v1/srag', sragRoutes(new SragController(service), () => sync.pronto))

  app.use(rotaNaoEncontrada)
  app.use(tratadorDeErros(logger, (erro, contexto) => monitoramento.erro(erro, contexto)))
  return app
}
