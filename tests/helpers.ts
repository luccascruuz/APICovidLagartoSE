import { readFile } from 'node:fs/promises'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { vi } from 'vitest'
import { criarApp } from '../src/app'
import { config as configBase, type Config } from '../src/config/env'
import { FileCache } from '../src/ingestion/file-cache'
import { OpenDataSusClient } from '../src/ingestion/opendatasus.client'
import { SyncService } from '../src/ingestion/sync.service'
import { InMemorySragRepository, type SragRepository } from '../src/modules/srag/srag.repository'
import { SragService } from '../src/modules/srag/srag.service'
import type { Monitoramento } from '../src/observability/monitoramento'
import { logger } from '../src/shared/logger'

export const CSV_URL = 'https://s3.sa-east-1.amazonaws.com/ckan.saude.gov.br/SRAG/2026/INFLUD26-02-11-2026.csv'

export function criarFetchFalso(arquivoCsv = CSV_URL) {
  return vi.fn(async (entrada: string | URL | Request) => {
    const url = String(entrada)
    if (url.endsWith('.csv')) {
      return new Response(await readFile(path.join(__dirname, 'fixtures', 'srag-amostra.csv')))
    }
    return new Response(`<a href="${arquivoCsv}">CSV</a>`)
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>
}

export interface OpcoesAmbiente {
  config?: Partial<Config>
  fetch?: typeof fetch
  hoje?: Date
  repository?: SragRepository
  monitoramento?: Monitoramento
  inicioProcesso?: Date
}

export async function criarAmbiente(opcoes: OpcoesAmbiente = {}) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'srag-teste-'))
  const config: Config = { ...configBase, anos: [2026], dataDir, rateLimitPorMinuto: 0, ...opcoes.config }
  const fetchFn = opcoes.fetch ?? criarFetchFalso()
  const repository = opcoes.repository ?? new InMemorySragRepository()
  const cache = new FileCache(config.dataDir)
  const sync = new SyncService(
    repository,
    new OpenDataSusClient(config.datasetUrl, fetchFn),
    cache,
    { anos: config.anos, municipioIbge: config.municipio.codigoIbge, intervaloHoras: 0 },
    logger,
    opcoes.monitoramento,
  )
  const hoje = opcoes.hoje ?? new Date('2026-11-04T12:00:00Z')
  const service = new SragService(repository, () => hoje)
  const app = criarApp({
    config,
    logger,
    service,
    sync,
    monitoramento: opcoes.monitoramento,
    inicioProcesso: opcoes.inicioProcesso,
  })
  return {
    app,
    sync,
    repository,
    cache,
    fetchFn,
    config,
    limpar: () => rm(config.dataDir, { recursive: true, force: true }),
  }
}
