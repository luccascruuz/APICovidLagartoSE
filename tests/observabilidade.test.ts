import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StatusSincronizacao } from '../src/ingestion/sync.service'
import { InMemorySragRepository } from '../src/modules/srag/srag.repository'
import { Metricas, nomeDaRota } from '../src/observability/metricas'
import { HealthchecksPinger, criarMonitoramento, type Reporter } from '../src/observability/monitoramento'
import { avaliarSaude } from '../src/observability/saude'
import { logger } from '../src/shared/logger'
import { criarAmbiente } from './helpers'

const limpezas: (() => Promise<void>)[] = []
afterEach(async () => {
  await Promise.all(limpezas.splice(0).map((f) => f()))
})

async function ambiente(...args: Parameters<typeof criarAmbiente>) {
  const amb = await criarAmbiente(...args)
  limpezas.push(amb.limpar)
  return amb
}

function statusSync(parcial: Partial<StatusSincronizacao> = {}): StatusSincronizacao {
  return { emAndamento: false, iniciadaEm: null, ultimaExecucao: null, ultimoSucessoEm: null, proximaExecucao: null, ...parcial }
}

function reporterFalso() {
  const capturados: { erro: unknown; contexto?: Record<string, unknown> }[] = []
  const reporter: Reporter = {
    capturar: (erro, contexto) => capturados.push({ erro, contexto }),
    encerrar: async () => undefined,
  }
  return { reporter, capturados }
}

describe('Metricas', () => {
  it('nomeia as rotas pelo padrão, não pela URL', () => {
    expect(nomeDaRota('GET', '/casos/:id', '/v1/srag/casos/123?x=1')).toBe('GET /v1/srag/casos/:id')
    expect(nomeDaRota('GET', '/resumo', '/v1/srag/resumo?ano=2026')).toBe('GET /v1/srag/resumo')
    expect(nomeDaRota('GET', '/health', '/health')).toBe('GET /health')
    expect(nomeDaRota('GET', '/', '/')).toBe('GET /')
    expect(nomeDaRota('GET', undefined, '/docs/swagger-ui.css')).toBe('GET /docs')
    expect(nomeDaRota('GET', undefined, '/qualquer-coisa')).toBe('rota inexistente')
  })

  it('conta status e calcula média e p95', () => {
    const metricas = new Metricas(new Date('2026-11-04T10:00:00Z'))
    for (let ms = 1; ms <= 100; ms++) metricas.registrar('GET /x', 200, ms)
    metricas.registrar('GET /x', 404, 1)
    metricas.registrar('GET /y', 500, 50)

    const snapshot = metricas.snapshot(new Date('2026-11-04T10:01:00Z'))
    expect(snapshot.segundosNoAr).toBe(60)
    expect(snapshot.totais).toMatchObject({ total: 102, status2xx: 100, status4xx: 1, status5xx: 1 })
    expect(snapshot.rotas[0]).toMatchObject({ rota: 'GET /x', total: 101, p95Ms: 95 })
    expect(snapshot.rotas[1]).toMatchObject({ rota: 'GET /y', status5xx: 1, mediaMs: 50 })
  })
})

describe('avaliarSaude', () => {
  const base = {
    dadosCarregados: true,
    maxHorasSemSync: 36,
    inicioProcesso: new Date('2026-11-01T00:00:00Z'),
    agora: new Date('2026-11-04T12:00:00Z'),
  }

  it('ok com dados e sincronização recente', () => {
    const saude = avaliarSaude({ ...base, sincronizacao: statusSync({ ultimoSucessoEm: '2026-11-04T06:00:00Z' }) })
    expect(saude).toMatchObject({ status: 'ok', motivos: [] })
  })

  it('indisponível sem dados', () => {
    const saude = avaliarSaude({ ...base, dadosCarregados: false, sincronizacao: statusSync({ emAndamento: true, ultimoSucessoEm: '2026-11-04T06:00:00Z' }) })
    expect(saude.status).toBe('indisponivel')
    expect(saude.motivos).toEqual(['Primeira importação em andamento'])
  })

  it('degradado quando a última sincronização falhou, mas ainda dentro do limite', () => {
    const saude = avaliarSaude({
      ...base,
      sincronizacao: statusSync({
        ultimoSucessoEm: '2026-11-04T00:00:00Z',
        ultimaExecucao: {
          origem: 'teste',
          iniciadaEm: '2026-11-04T11:00:00Z',
          finalizadaEm: '2026-11-04T11:01:00Z',
          sucesso: false,
          anos: [{ ano: 2026, situacao: 'erro', mensagem: 'HTTP 503' }],
        },
      }),
    })
    expect(saude.status).toBe('degradado')
    expect(saude.motivos[0]).toContain('2026: HTTP 503')
  })

  it('indisponível quando passa do limite sem sucesso', () => {
    const saude = avaliarSaude({ ...base, sincronizacao: statusSync({ ultimoSucessoEm: '2026-11-02T12:00:00Z' }) })
    expect(saude.status).toBe('indisponivel')
    expect(saude.motivos[0]).toContain('48 h')
  })

  it('usa o início do processo como referência antes da primeira sincronização', () => {
    const recente = avaliarSaude({ ...base, inicioProcesso: new Date('2026-11-04T11:00:00Z'), sincronizacao: statusSync() })
    expect(recente.status).toBe('ok')
    expect(avaliarSaude({ ...base, sincronizacao: statusSync() }).status).toBe('indisponivel')
  })

  it('não cobra prazo de sincronização quando SAUDE_MAX_HORAS_SEM_SYNC=0', () => {
    expect(avaliarSaude({ ...base, maxHorasSemSync: 0, sincronizacao: statusSync() }).status).toBe('ok')
  })
})

describe('GET /health', () => {
  it('503 antes da primeira importação e 200 depois', async () => {
    const amb = await ambiente()
    const antes = await request(amb.app).get('/health')
    expect(antes.status).toBe(503)
    expect(antes.body).toMatchObject({ status: 'indisponivel', dadosCarregados: false })

    await amb.sync.sincronizar()
    const depois = await request(amb.app).get('/health')
    expect(depois.status).toBe(200)
    expect(depois.body).toMatchObject({ status: 'ok', dadosCarregados: true })
    expect(depois.body.ultimoSucessoSincronizacao).toBeTruthy()
    expect(depois.headers['cache-control']).toBe('no-store')
  })
})

describe('/status', () => {
  it('mostra saúde, dados, sincronização e métricas por rota', async () => {
    const amb = await ambiente()
    await amb.sync.sincronizar()
    await request(amb.app).get('/v1/srag/casos/1001')
    await request(amb.app).get('/v1/srag/casos/1002')
    await request(amb.app).get('/v1/srag/casos/abc')

    const json = await request(amb.app).get('/status.json')
    expect(json.status).toBe(200)
    expect(json.body.saude.status).toBe('ok')
    expect(json.body.dados[0]).toMatchObject({ ano: 2026, totalCasos: 4 })
    expect(json.body.integracoes).toEqual({ healthchecks: false, sentry: false })
    expect(json.body.metricas.rotas).toContainEqual(
      expect.objectContaining({ rota: 'GET /v1/srag/casos/:id', total: 3, status2xx: 2, status4xx: 1 }),
    )

    const html = await request(amb.app).get('/status')
    expect(html.status).toBe(200)
    expect(html.headers['content-type']).toContain('text/html')
    expect(html.text).toContain('Operacional')
    expect(html.text).toContain('INFLUD26-02-11-2026.csv')
    expect(html.text).toContain('GET /v1/srag/casos/:id')
  })

  it('escapa conteúdo vindo de fora', async () => {
    const fetchHostil = (async () => new Response('<script>alert(1)</script>', { status: 502 })) as typeof fetch
    const amb = await ambiente({ fetch: fetchHostil })
    await amb.sync.sincronizar()
    const html = await request(amb.app).get('/status')
    expect(html.text).not.toContain('<script>alert(1)</script>')
    expect(html.text).toContain('Indisponível')
  })
})

describe('monitoramento', () => {
  function fetchHealthchecks() {
    return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response('OK')) as unknown as typeof fetch &
      ReturnType<typeof vi.fn>
  }

  it('pinga o Healthchecks.io no início e no sucesso da sincronização', async () => {
    const pingFetch = fetchHealthchecks()
    const monitoramento = criarMonitoramento({ logger, healthchecks: new HealthchecksPinger('https://hc-ping.com/abc', logger, pingFetch) })
    const amb = await ambiente({ monitoramento })
    await amb.sync.sincronizar()
    await monitoramento.encerrar()

    const chamadas = pingFetch.mock.calls.map(([url, init]) => `${init?.method} ${url}`)
    expect(chamadas).toEqual(['GET https://hc-ping.com/abc/start', 'POST https://hc-ping.com/abc'])
    expect(String(pingFetch.mock.calls[1]?.[1]?.body)).toContain('2026: atualizado')
  })

  it('avisa falha ao Healthchecks.io e ao Sentry', async () => {
    const pingFetch = fetchHealthchecks()
    const { reporter, capturados } = reporterFalso()
    const monitoramento = criarMonitoramento({
      logger,
      reporter,
      healthchecks: new HealthchecksPinger('https://hc-ping.com/abc', logger, pingFetch),
    })
    const fetchQuebrado = (async () => new Response('fora do ar', { status: 503 })) as typeof fetch
    const amb = await ambiente({ monitoramento, fetch: fetchQuebrado })
    await amb.sync.sincronizar()
    await monitoramento.encerrar()

    expect(pingFetch.mock.calls.at(-1)?.[0]).toBe('https://hc-ping.com/abc/fail')
    expect(capturados).toHaveLength(1)
    expect(String(capturados[0]?.erro)).toContain('Sincronização com o OpenDataSUS falhou')
  })

  it('não deixa uma falha no Healthchecks.io afetar a sincronização', async () => {
    const pingQuebrado = (async () => {
      throw new Error('sem rede')
    }) as typeof fetch
    const monitoramento = criarMonitoramento({ logger, healthchecks: new HealthchecksPinger('https://hc-ping.com/abc', logger, pingQuebrado) })
    const amb = await ambiente({ monitoramento })
    const resultado = await amb.sync.sincronizar()
    await monitoramento.encerrar()
    expect(resultado[0]?.situacao).toBe('atualizado')
  })

  it('envia ao Sentry só erros internos (500), não erros de validação', async () => {
    const { reporter, capturados } = reporterFalso()
    const monitoramento = criarMonitoramento({ logger, reporter })
    const repository = new InMemorySragRepository()
    const amb = await ambiente({ monitoramento, repository })
    await amb.sync.sincronizar()

    expect((await request(amb.app).get('/v1/srag/casos?limite=999')).status).toBe(400)
    expect((await request(amb.app).get('/v1/srag/casos/999')).status).toBe(404)
    expect(capturados).toHaveLength(0)

    vi.spyOn(repository, 'listar').mockRejectedValueOnce(new Error('banco fora do ar'))
    const res = await request(amb.app).get('/v1/srag/resumo')
    expect(res.status).toBe(500)
    expect(res.body.erro.mensagem).toBe('Erro interno do servidor')
    expect(capturados).toHaveLength(1)
    expect(capturados[0]?.contexto).toMatchObject({ metodo: 'GET', rota: '/v1/srag/resumo' })
  })

  it('mostra as integrações ativas no /status', async () => {
    const monitoramento = criarMonitoramento({
      logger,
      reporter: reporterFalso().reporter,
      healthchecks: new HealthchecksPinger('https://hc-ping.com/abc', logger, fetchHealthchecks()),
    })
    const amb = await ambiente({ monitoramento })
    const json = await request(amb.app).get('/status.json')
    expect(json.body.integracoes).toEqual({ healthchecks: true, sentry: true })
  })
})
