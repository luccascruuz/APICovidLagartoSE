import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CachedSragRepository } from '../src/modules/srag/srag.cached.repository'
import { MongoSragRepository } from '../src/modules/srag/srag.mongo.repository'
import { InMemorySragRepository, type FiltroCasos, type SragRepository } from '../src/modules/srag/srag.repository'
import { fonte, gerarCasos, iniciarMongo } from './mongo-helpers'

let mongo: Awaited<ReturnType<typeof iniciarMongo>>

beforeAll(async () => {
  mongo = await iniciarMongo()
}, 120_000)

afterAll(async () => {
  await mongo?.parar()
})

const implementacoes: [string, () => SragRepository][] = [
  ['memória', () => new InMemorySragRepository()],
  ['MongoDB', () => new MongoSragRepository(mongo.client, mongo.novoBanco())],
  ['MongoDB com cache', () => new CachedSragRepository(new MongoSragRepository(mongo.client, mongo.novoBanco()), 60_000)],
]

const filtros: FiltroCasos[] = [
  {},
  { anos: [2025] },
  { anos: [2024, 2026] },
  { semanaInicio: 10, semanaFim: 30 },
  { dataInicio: '2025-03-01', dataFim: '2025-09-30' },
  { classificacao: ['covid19', 'influenza'] },
  { classificacao: ['em_investigacao'] },
  { evolucao: ['obito'] },
  { sexo: ['feminino'] },
  { faixaEtaria: ['menor_1', '80_mais'] },
  { hospitalizado: 'sim', uti: 'sim' },
  { agente: ['vsr', 'covid19'] },
  { anos: [2026], classificacao: ['outro_virus'], uti: 'nao', semanaFim: 40 },
]

async function povoar(repo: SragRepository) {
  await repo.salvarAno(fonte(2024, 40), gerarCasos(2024, 40))
  await repo.salvarAno(fonte(2025, 70), gerarCasos(2025, 70))
  await repo.salvarAno(fonte(2026, 55), gerarCasos(2026, 55))
}

describe.each(implementacoes)('SragRepository: %s', (_nome, criar) => {
  it('salva, lista e conta por ano', async () => {
    const repo = criar()
    await povoar(repo)
    expect((await repo.fontes()).map((f) => [f.ano, f.totalCasos])).toEqual([
      [2024, 40],
      [2025, 70],
      [2026, 55],
    ])
    expect(await repo.listar({})).toHaveLength(165)
  })

  it('substitui o ano inteiro ao salvar de novo', async () => {
    const repo = criar()
    await povoar(repo)
    await repo.salvarAno(fonte(2025, 5, 'INFLUD25-09-11-2026.csv'), gerarCasos(2025, 5, 1000))
    const de2025 = await repo.listar({ anos: [2025] })
    expect(de2025).toHaveLength(5)
    expect(de2025.every((c) => Number(c.id) >= 2025 * 100000 + 1000)).toBe(true)
    expect((await repo.fontes()).find((f) => f.ano === 2025)?.arquivo).toBe('INFLUD25-09-11-2026.csv')
    expect(await repo.listar({ anos: [2024] })).toHaveLength(40)
  })

  it('remove notificações duplicadas dentro do ano', async () => {
    const repo = criar()
    const casos = gerarCasos(2026, 3)
    await repo.salvarAno(fonte(2026, 4), [...casos, casos[0]!])
    expect(await repo.listar({})).toHaveLength(3)
    expect((await repo.fontes())[0]?.totalCasos).toBe(3)
  })

  it('aceita ano sem nenhum caso', async () => {
    const repo = criar()
    await repo.salvarAno(fonte(2019, 0), [])
    expect(await repo.fontes()).toHaveLength(1)
    expect(await repo.listar({})).toEqual([])
  })

  it('busca por id', async () => {
    const repo = criar()
    await povoar(repo)
    expect((await repo.buscarPorId('202500003'))?.ano).toBe(2025)
    expect(await repo.buscarPorId('999')).toBeNull()
  })

  it('não expõe campos internos do banco', async () => {
    const repo = criar()
    await povoar(repo)
    const [caso] = await repo.listar({ anos: [2024] })
    const { itens } = await repo.buscar({}, { pagina: 1, limite: 1, ordem: 'asc' })
    for (const objeto of [caso, itens[0], await repo.buscarPorId('202400001'), (await repo.fontes())[0]]) {
      expect(objeto).not.toHaveProperty('_id')
    }
  })

  it('registra o histórico de sincronizações', async () => {
    const repo = criar()
    expect(await repo.ultimoSucessoSincronizacao()).toBeNull()
    const execucao = (finalizadaEm: string, sucesso: boolean) => ({
      origem: 'teste',
      iniciadaEm: finalizadaEm,
      finalizadaEm,
      sucesso,
      anos: [{ ano: 2026, situacao: sucesso ? ('sem_alteracao' as const) : ('erro' as const) }],
    })
    await repo.registrarSincronizacao(execucao('2026-11-01T10:00:00.000Z', true))
    await repo.registrarSincronizacao(execucao('2026-11-02T10:00:00.000Z', true))
    await repo.registrarSincronizacao(execucao('2026-11-03T10:00:00.000Z', false))
    const historico = await repo.sincronizacoes(2)
    expect(historico.map((h) => h.finalizadaEm)).toEqual(['2026-11-03T10:00:00.000Z', '2026-11-02T10:00:00.000Z'])
    expect(historico[0]).not.toHaveProperty('_id')
    expect(await repo.ultimoSucessoSincronizacao()).toBe('2026-11-02T10:00:00.000Z')
  })
})

describe('todas as implementações respondem igual', () => {
  let repos: SragRepository[]

  beforeAll(async () => {
    repos = implementacoes.map(([, criar]) => criar())
    for (const repo of repos) await povoar(repo)
  })

  it.each(filtros.map((f) => [JSON.stringify(f), f] as const))('listar %s', async (_descricao, filtro) => {
    const [referencia, ...outros] = await Promise.all(repos.map((r) => r.listar(filtro)))
    expect(referencia!.length).toBeGreaterThan(0)
    for (const resultado of outros) expect(resultado).toEqual(referencia)
  })

  it.each([
    [1, 10, 'asc'],
    [2, 10, 'asc'],
    [1, 25, 'desc'],
    [7, 25, 'desc'],
    [99, 10, 'desc'],
  ] as const)('buscar página %s, limite %s, %s', async (pagina, limite, ordem) => {
    const [referencia, ...outros] = await Promise.all(
      repos.map((r) => r.buscar({ classificacao: ['outro_virus', 'nao_especificado', 'em_investigacao'] }, { pagina, limite, ordem })),
    )
    for (const resultado of outros) expect(resultado).toEqual(referencia)
  })
})

describe('CachedSragRepository', () => {
  it('só volta ao banco depois da validade e recarrega quando outro processo grava', async () => {
    const db = mongo.novoBanco()
    const escritor = new MongoSragRepository(mongo.client, db)
    const origem = new MongoSragRepository(mongo.client, db)
    let agora = 0
    const cache = new CachedSragRepository(origem, 60_000, () => agora)

    await escritor.salvarAno(fonte(2026, 10), gerarCasos(2026, 10))
    expect(await cache.listar({})).toHaveLength(10)

    await escritor.salvarAno(fonte(2026, 20, 'INFLUD26-09-11-2026.csv'), gerarCasos(2026, 20))
    agora = 30_000
    expect(await cache.listar({})).toHaveLength(10)

    agora = 61_000
    expect(await cache.listar({})).toHaveLength(20)
    expect((await cache.fontes())[0]?.arquivo).toBe('INFLUD26-09-11-2026.csv')
  })

  it('invalida na hora quando a gravação passa por ele', async () => {
    const cache = new CachedSragRepository(new MongoSragRepository(mongo.client, mongo.novoBanco()), 60_000, () => 0)
    await cache.salvarAno(fonte(2026, 3), gerarCasos(2026, 3))
    expect(await cache.listar({})).toHaveLength(3)
    await cache.salvarAno(fonte(2026, 8, 'novo.csv'), gerarCasos(2026, 8))
    expect(await cache.listar({})).toHaveLength(8)
  })

  it('consultas simultâneas fazem uma única recarga', async () => {
    const origem = new InMemorySragRepository()
    await origem.salvarAno(fonte(2026, 5), gerarCasos(2026, 5))
    let leituras = 0
    const listarOriginal = origem.listar.bind(origem)
    origem.listar = async (f) => {
      leituras++
      return listarOriginal(f)
    }
    const cache = new CachedSragRepository(origem, 60_000)
    await Promise.all([cache.listar({}), cache.fontes(), cache.buscarPorId('x')])
    expect(leituras).toBe(1)
  })
})
