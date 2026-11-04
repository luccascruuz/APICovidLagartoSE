import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { criarAmbiente } from './helpers'

type Ambiente = Awaited<ReturnType<typeof criarAmbiente>>
let amb: Ambiente

beforeAll(async () => {
  amb = await criarAmbiente({ config: { adminToken: 'token-de-teste-com-mais-de-24-caracteres' } })
  await amb.sync.sincronizar()
})
afterAll(() => amb.limpar())

describe('GET /v1/srag/casos', () => {
  it('lista paginada, mais recentes primeiro', async () => {
    const res = await request(amb.app).get('/v1/srag/casos?limite=2')
    expect(res.status).toBe(200)
    expect(res.body.paginacao).toEqual({ pagina: 1, limite: 2, ordem: 'desc', total: 4, totalPaginas: 2 })
    expect(res.body.dados.map((c: { id: string }) => c.id)).toEqual(['1003', '1005'])
    expect(res.headers['cache-control']).toContain('max-age')
  })

  it('filtra por classificação, evolução e agente', async () => {
    const porClassificacao = await request(amb.app).get('/v1/srag/casos?classificacao=influenza,covid19')
    expect(porClassificacao.body.dados.map((c: { id: string }) => c.id).sort()).toEqual(['1002', '1005'])

    const obitos = await request(amb.app).get('/v1/srag/casos?evolucao=obito')
    expect(obitos.body.paginacao.total).toBe(1)

    const vsr = await request(amb.app).get('/v1/srag/casos?agente=vsr')
    expect(vsr.body.dados[0].id).toBe('1001')

    const uti = await request(amb.app).get('/v1/srag/casos?uti=sim&faixaEtaria=menor_1')
    expect(uti.body.paginacao.total).toBe(1)
  })

  it('filtra por período e semana', async () => {
    const res = await request(amb.app).get('/v1/srag/casos?dataInicio=2026-03-01&dataFim=2026-05-31&ordem=asc')
    expect(res.body.dados.map((c: { id: string }) => c.id)).toEqual(['1002', '1005'])

    const semana1 = await request(amb.app).get('/v1/srag/casos?semanaInicio=1&semanaFim=1')
    expect(semana1.body.dados.map((c: { id: string }) => c.id)).toEqual(['1001'])
  })

  it('valida parâmetros', async () => {
    for (const query of ['classificacao=gripe', 'limite=1000', 'dataInicio=01/01/2026', 'semanaInicio=10&semanaFim=2', 'ano=26']) {
      const res = await request(amb.app).get(`/v1/srag/casos?${query}`)
      expect(res.status, query).toBe(400)
      expect(res.body.erro.codigo).toBe('PARAMETROS_INVALIDOS')
    }
  })
})

describe('GET /v1/srag/casos/:id', () => {
  it('retorna o caso', async () => {
    const res = await request(amb.app).get('/v1/srag/casos/1002')
    expect(res.status).toBe(200)
    expect(res.body.dados).toMatchObject({
      id: '1002',
      classificacao: 'influenza',
      agentes: ['influenza_a'],
      evolucao: 'obito',
      municipioInternacao: { codigoIbge: '280030', nome: 'ARACAJU' },
      comorbidades: ['cardiopatia', 'diabetes'],
    })
  })

  it('404 para notificação inexistente e 400 para id inválido', async () => {
    expect((await request(amb.app).get('/v1/srag/casos/999')).status).toBe(404)
    expect((await request(amb.app).get('/v1/srag/casos/abc')).status).toBe(400)
  })
})

describe('GET /v1/srag/resumo', () => {
  it('totaliza casos', async () => {
    const res = await request(amb.app).get('/v1/srag/resumo')
    expect(res.status).toBe(200)
    expect(res.body.dados).toMatchObject({
      totalCasos: 4,
      obitosSrag: 1,
      internadosUti: 1,
      casosEmAberto: 1,
      periodo: { primeiroInicioSintomas: '2026-01-04', ultimoInicioSintomas: '2026-10-14' },
    })
    expect(res.body.dados.porClassificacao).toEqual({
      influenza: 1,
      outro_virus: 1,
      outro_agente: 0,
      nao_especificado: 0,
      covid19: 1,
      em_investigacao: 1,
    })
    expect(res.body.aviso).toBeTruthy()
  })

  it('aplica filtros', async () => {
    const res = await request(amb.app).get('/v1/srag/resumo?sexo=feminino')
    expect(res.body.dados.totalCasos).toBe(2)
  })
})

describe('GET /v1/srag/semanas', () => {
  it('gera a série completa até a semana atual, com zeros e média móvel', async () => {
    const res = await request(amb.app).get('/v1/srag/semanas?ano=2026&janela=2')
    expect(res.status).toBe(200)
    const { semanas } = res.body.dados
    expect(semanas).toHaveLength(44)
    expect(semanas[0]).toEqual({
      semana: 1,
      inicio: '2026-01-04',
      fim: '2026-01-10',
      casos: 1,
      obitosSrag: 0,
      internadosUti: 1,
      mediaMovel: null,
    })
    expect(semanas[1].mediaMovel).toBe(0.5)
    expect(semanas.reduce((s: number, p: { casos: number }) => s + p.casos, 0)).toBe(4)
  })

  it('usa o ano mais recente por padrão e 404 para ano não carregado', async () => {
    expect((await request(amb.app).get('/v1/srag/semanas')).body.dados.ano).toBe(2026)
    expect((await request(amb.app).get('/v1/srag/semanas?ano=2020')).status).toBe(404)
  })
})

describe('rotas de sistema', () => {
  it('health, fonte, dicionário e docs', async () => {
    expect((await request(amb.app).get('/health')).body).toMatchObject({ status: 'ok', dadosCarregados: true })

    const fonte = await request(amb.app).get('/v1/fonte')
    expect(fonte.body.dados.anos[0]).toMatchObject({ ano: 2026, arquivo: 'INFLUD26-02-11-2026.csv', totalCasos: 4 })
    expect(fonte.body.dados.sincronizacao.ultimaExecucao.sucesso).toBe(true)

    expect((await request(amb.app).get('/v1/srag/dicionario')).body.dados.classificacao.covid19).toBe('SRAG por covid-19')
    expect((await request(amb.app).get('/openapi.json')).body.openapi).toBe('3.0.3')
    expect((await request(amb.app).get('/docs/')).status).toBe(200)
  })

  it('404 padronizado para rota inexistente', async () => {
    const res = await request(amb.app).get('/cases-day')
    expect(res.status).toBe(404)
    expect(res.body.erro.codigo).toBe('ROTA_NAO_ENCONTRADA')
  })
})

describe('POST /v1/admin/sincronizar', () => {
  it('exige token', async () => {
    expect((await request(amb.app).post('/v1/admin/sincronizar')).status).toBe(401)
    expect((await request(amb.app).post('/v1/admin/sincronizar').set('Authorization', 'Bearer errado')).status).toBe(401)
  })

  it('inicia a sincronização com token válido', async () => {
    const res = await request(amb.app)
      .post('/v1/admin/sincronizar')
      .set('Authorization', 'Bearer token-de-teste-com-mais-de-24-caracteres')
      .send({ forcar: true })
    expect(res.status).toBe(202)
    await amb.sync.sincronizar()
  })

  it('fica desativada sem ADMIN_TOKEN', async () => {
    const semToken = await criarAmbiente({ config: { adminToken: undefined } })
    try {
      expect((await request(semToken.app).post('/v1/admin/sincronizar')).status).toBe(404)
    } finally {
      await semToken.limpar()
    }
  })
})

describe('antes da primeira importação', () => {
  it('responde 503 em vez de lista vazia', async () => {
    const vazio = await criarAmbiente()
    try {
      const res = await request(vazio.app).get('/v1/srag/resumo')
      expect(res.status).toBe(503)
      expect(res.headers['retry-after']).toBe('60')
      expect((await request(vazio.app).get('/v1/srag/dicionario')).status).toBe(200)
    } finally {
      await vazio.limpar()
    }
  })
})
