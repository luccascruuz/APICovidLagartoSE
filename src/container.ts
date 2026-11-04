import { readFileSync } from 'node:fs'
import path from 'node:path'
import { config } from './config/env'
import { FileCache } from './ingestion/file-cache'
import { OpenDataSusClient } from './ingestion/opendatasus.client'
import { SyncService } from './ingestion/sync.service'
import { InMemorySragRepository, type SragRepository } from './modules/srag/srag.repository'
import { SragService } from './modules/srag/srag.service'
import { Metricas } from './observability/metricas'
import { HealthchecksPinger, criarMonitoramento } from './observability/monitoramento'
import { criarSentryReporter } from './observability/sentry'
import { logger } from './shared/logger'

function versaoDoPacote(): string {
  const conteudo = readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
  return (JSON.parse(conteudo) as { version: string }).version
}

export function criarContainer(repository: SragRepository = new InMemorySragRepository()) {
  const inicioProcesso = new Date()

  const monitoramento = criarMonitoramento({
    logger,
    healthchecks: config.healthchecksUrl ? new HealthchecksPinger(config.healthchecksUrl, logger) : undefined,
    reporter: config.sentryDsn
      ? criarSentryReporter({ dsn: config.sentryDsn, ambiente: config.nodeEnv, versao: versaoDoPacote() })
      : undefined,
  })

  const sync = new SyncService(
    repository,
    new OpenDataSusClient(config.datasetUrl),
    new FileCache(config.dataDir),
    { anos: config.anos, municipioIbge: config.municipio.codigoIbge, intervaloHoras: config.syncIntervaloHoras },
    logger,
    monitoramento,
  )

  return {
    config,
    logger,
    repository,
    sync,
    monitoramento,
    inicioProcesso,
    metricas: new Metricas(inicioProcesso),
    service: new SragService(repository),
  }
}
