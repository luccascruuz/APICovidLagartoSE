import { config } from './config/env'
import { FileCache } from './ingestion/file-cache'
import { OpenDataSusClient } from './ingestion/opendatasus.client'
import { SyncService } from './ingestion/sync.service'
import { InMemorySragRepository, type SragRepository } from './modules/srag/srag.repository'
import { SragService } from './modules/srag/srag.service'
import { logger } from './shared/logger'

export function criarContainer(repository: SragRepository = new InMemorySragRepository()) {
  const sync = new SyncService(
    repository,
    new OpenDataSusClient(config.datasetUrl),
    new FileCache(config.dataDir),
    { anos: config.anos, municipioIbge: config.municipio.codigoIbge, intervaloHoras: config.syncIntervaloHoras },
    logger,
  )
  return { config, logger, repository, sync, service: new SragService(repository) }
}
