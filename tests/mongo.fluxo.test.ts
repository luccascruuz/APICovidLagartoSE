import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { config as configBase } from '../src/config/env'
import { criarContainer } from '../src/container'
import { CachedSragRepository } from '../src/modules/srag/srag.cached.repository'
import { MongoSragRepository } from '../src/modules/srag/srag.mongo.repository'
import { criarAmbiente, criarFetchFalso } from './helpers'
import { fonte, gerarCasos, iniciarMongo } from './mongo-helpers'

let mongo: Awaited<ReturnType<typeof iniciarMongo>>

beforeAll(async () => {
  mongo = await iniciarMongo()
}, 120_000)

afterAll(async () => {
  await mongo?.parar()
})

describe('sincronização gravando no MongoDB', () => {
  it('a próxima execução, em outra máquina e sem cache local, não baixa de novo o que não mudou', async () => {
    const db = mongo.novoBanco()

    const povoar = await criarAmbiente({ repository: new MongoSragRepository(mongo.client, db), semCacheEmArquivo: true })
    const primeira = await povoar.sync.sincronizar()
    expect(primeira[0]).toMatchObject({ ano: 2026, situacao: 'atualizado', totalCasos: 4 })
    await povoar.limpar()

    const fetchSemanal = criarFetchFalso()
    const semanal = await criarAmbiente({
      repository: new MongoSragRepository(mongo.client, db),
      semCacheEmArquivo: true,
      fetch: fetchSemanal,
    })
    const segunda = await semanal.sync.sincronizar()
    expect(segunda[0]?.situacao).toBe('sem_alteracao')
    expect(fetchSemanal).toHaveBeenCalledTimes(1)
    await semanal.limpar()

    const novoArquivo = 'https://s3.sa-east-1.amazonaws.com/ckan.saude.gov.br/SRAG/2026/INFLUD26-09-11-2026.csv'
    const atualizacao = await criarAmbiente({
      repository: new MongoSragRepository(mongo.client, db),
      semCacheEmArquivo: true,
      fetch: criarFetchFalso(novoArquivo),
    })
    const terceira = await atualizacao.sync.sincronizar()
    expect(terceira[0]).toMatchObject({ situacao: 'atualizado', arquivo: 'INFLUD26-09-11-2026.csv' })
    await atualizacao.limpar()

    expect(await db.collection('casos').countDocuments()).toBe(4)
    expect(await db.collection('fontes').findOne({ _id: 2026 as never })).toMatchObject({ arquivo: 'INFLUD26-09-11-2026.csv' })
    expect(await db.collection('sincronizacoes').countDocuments()).toBe(3)
    const indices = (await db.collection('casos').indexes()).map((i) => i.name)
    expect(indices).toEqual(expect.arrayContaining(['ano_id', 'ordem_padrao']))
  })
})

describe('API lendo do MongoDB, sem sincronizar (modo Vercel)', () => {
  it('serve os dados e o /health usa o histórico gravado no banco', async () => {
    const db = mongo.novoBanco()
    const banco = new MongoSragRepository(mongo.client, db)
    const leitura = new CachedSragRepository(banco, 60_000)
    const api = await criarAmbiente({ repository: leitura, semSincronizacao: true })

    expect((await request(api.app).get('/health')).status).toBe(503)
    expect((await request(api.app).get('/v1/srag/resumo')).status).toBe(503)

    const job = await criarAmbiente({ repository: new MongoSragRepository(mongo.client, db), semCacheEmArquivo: true })
    await job.sync.sincronizar()
    leitura.invalidar()

    const saude = await request(api.app).get('/health')
    expect(saude.status).toBe(200)
    expect(saude.body.ultimoSucessoSincronizacao).toBeTruthy()

    expect((await request(api.app).get('/v1/srag/casos/1002')).body.dados).toMatchObject({ id: '1002', classificacao: 'influenza' })
    expect((await request(api.app).get('/v1/srag/resumo')).body.dados.totalCasos).toBe(4)

    const status = await request(api.app).get('/status.json')
    expect(status.body.armazenamento).toBe('memoria')
    expect(status.body.sincronizacao.nesteProcesso).toBe(false)
    expect(status.body.historico[0]).toMatchObject({ origem: 'teste', sucesso: true })

    const html = await request(api.app).get('/status')
    expect(html.text).toContain('Agendada fora da API')
    expect(html.text).toContain('Histórico de sincronizações')

    expect((await request(api.app).post('/v1/admin/sincronizar').set('Authorization', 'Bearer x')).status).toBe(404)

    await api.limpar()
    await job.limpar()
  })
})

describe('container', () => {
  it('com MONGO_URI, usa o MongoDB com cache e grava pela sincronização', async () => {
    const config = { ...configBase, mongoUri: mongo.uri, mongoDb: `container_${Date.now()}`, anos: [2026] }
    const deps = criarContainer({ origem: 'cli', comSincronizacao: true, config })
    expect(deps.armazenamento).toBe('mongodb')
    expect(deps.repository).toBeInstanceOf(CachedSragRepository)
    await deps.repository.salvarAno(fonte(2026, 2), gerarCasos(2026, 2))
    expect(await deps.estado.pronto()).toBe(true)
    await deps.encerrar()
  })

  it('o modo serverless exige MONGO_URI', async () => {
    vi.resetModules()
    vi.doMock('../src/config/env', async (original) => {
      const modulo = await original<typeof import('../src/config/env')>()
      return { ...modulo, config: { ...modulo.config, mongoUri: undefined } }
    })
    await expect(import('../src/serverless.js')).rejects.toThrow(/MONGO_URI é obrigatória/)
    vi.doUnmock('../src/config/env')
    vi.resetModules()
  })

  it('o modo serverless sobe com MONGO_URI e não sincroniza', async () => {
    vi.resetModules()
    vi.doMock('../src/config/env', async (original) => {
      const modulo = await original<typeof import('../src/config/env')>()
      return { ...modulo, config: { ...modulo.config, mongoUri: mongo.uri, mongoDb: `serverless_${Date.now()}` } }
    })
    const { app } = await import('../src/serverless.js')
    const entrada: unknown = (await import('../index.js')).default
    expect([entrada, (entrada as { default?: unknown }).default]).toContain(app)
    const res = await request(app).get('/status.json')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ armazenamento: 'mongodb', sincronizacao: { nesteProcesso: false } })
    expect((await request(app).get('/health')).status).toBe(503)
    vi.doUnmock('../src/config/env')
    vi.resetModules()
  })
})
