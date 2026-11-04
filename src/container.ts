import { readFileSync } from 'node:fs'
import path from 'node:path'
import { MongoClient } from 'mongodb'
import { config as configPadrao, type Config } from './config/env'
import { FileCache } from './ingestion/file-cache'
import { OpenDataSusClient } from './ingestion/opendatasus.client'
import { SyncService } from './ingestion/sync.service'
import { EstadoDados } from './modules/sistema/estado-dados'
import { CachedSragRepository } from './modules/srag/srag.cached.repository'
import { MongoSragRepository } from './modules/srag/srag.mongo.repository'
import { InMemorySragRepository, type SragRepository } from './modules/srag/srag.repository'
import { SragService } from './modules/srag/srag.service'
import { Metricas } from './observability/metricas'
import { HealthchecksPinger, criarMonitoramento } from './observability/monitoramento'
import { criarSentryReporter } from './observability/sentry'
import { logger } from './shared/logger'

export interface OpcoesContainer {
  origem: string
  comSincronizacao: boolean
  anos?: number[]
  config?: Config
}

function versaoDoPacote(): string {
  try {
    const conteudo = readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
    return (JSON.parse(conteudo) as { version: string }).version
  } catch {
    return process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'desconhecida'
  }
}

export function criarClienteMongo(uri: string): MongoClient {
  return new MongoClient(uri, {
    appName: 'api-srag-lagarto-se',
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 10_000,
  })
}

export function criarContainer(opcoes: OpcoesContainer) {
  const config = opcoes.config ?? configPadrao
  const inicioProcesso = new Date()

  const monitoramento = criarMonitoramento({
    logger,
    healthchecks:
      opcoes.comSincronizacao && config.healthchecksUrl
        ? new HealthchecksPinger(config.healthchecksUrl, logger)
        : undefined,
    reporter: config.sentryDsn
      ? criarSentryReporter({ dsn: config.sentryDsn, ambiente: config.nodeEnv, versao: versaoDoPacote() })
      : undefined,
  })

  let cliente: MongoClient | null = null
  let escrita: SragRepository
  let leitura: SragRepository
  let cache: FileCache | null = null

  if (config.mongoUri) {
    cliente = criarClienteMongo(config.mongoUri)
    escrita = new MongoSragRepository(cliente, cliente.db(config.mongoDb))
    leitura =
      config.mongoCacheSegundos > 0 ? new CachedSragRepository(escrita, config.mongoCacheSegundos * 1000) : escrita
  } else {
    escrita = new InMemorySragRepository()
    leitura = escrita
    cache = new FileCache(config.dataDir)
  }

  const sync = opcoes.comSincronizacao
    ? new SyncService(
        leitura,
        new OpenDataSusClient(config.datasetUrl, fetch, {
          aoRetomar: ({ url, bytesRecebidos, tentativa, erro }) =>
            logger.warn(
              { arquivo: url.split('/').pop(), mbRecebidos: Math.round(bytesRecebidos / 1e6), tentativa, motivo: (erro as Error).message },
              'Conexão caiu durante o download; retomando de onde parou',
            ),
        }),
        cache,
        {
          anos: opcoes.anos ?? config.anos,
          municipioIbge: config.municipio.codigoIbge,
          intervaloHoras: config.syncIntervaloHoras,
          origem: opcoes.origem,
        },
        logger,
        monitoramento,
      )
    : undefined

  return {
    config,
    logger,
    repository: leitura,
    sync,
    estado: new EstadoDados(leitura, sync),
    monitoramento,
    inicioProcesso,
    metricas: new Metricas(inicioProcesso),
    service: new SragService(leitura),
    armazenamento: cliente ? ('mongodb' as const) : ('memoria' as const),
    async encerrar() {
      sync?.parar()
      await monitoramento.encerrar()
      await cliente?.close()
    },
  }
}

export type Container = ReturnType<typeof criarContainer>
