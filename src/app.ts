import cors from 'cors'
import express, { type Express } from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import type { Config } from './config/env'
import { criarOpenApi } from './docs/openapi'
import { swaggerUiRoutes } from './docs/swagger-ui'
import type { SyncService } from './ingestion/sync.service'
import type { EstadoDados } from './modules/sistema/estado-dados'
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
  estado: EstadoDados
  sync?: SyncService
  monitoramento?: Monitoramento
  metricas?: Metricas
  inicioProcesso?: Date
}

export function criarApp(deps: AppDeps): Express {
  const { config, logger, service, estado, sync } = deps
  const monitoramento = deps.monitoramento ?? monitoramentoNulo
  const inicioProcesso = deps.inicioProcesso ?? new Date()
  const metricas = deps.metricas ?? new Metricas(inicioProcesso)

  const app = express()
  app.disable('x-powered-by')
  if (config.trustProxy !== false) app.set('trust proxy', config.trustProxy)
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
  app.use('/docs', swaggerUiRoutes(`API SRAG ${config.municipio.nome}-${config.municipio.uf}`))
  app.get('/', (_req, res) => {
    res.redirect('/docs')
  })

  app.use(sistemaRoutes({ config, estado, sync, service, metricas, monitoramento, inicioProcesso }))
  app.use('/v1/srag', sragRoutes(new SragController(service), () => estado.pronto()))

  app.use(rotaNaoEncontrada)
  app.use(tratadorDeErros(logger, (erro, contexto) => monitoramento.erro(erro, contexto)))
  return app
}
