import request from 'supertest'
import { afterEach, describe, expect, it } from 'vitest'
import { InMemorySragRepository } from '../src/modules/srag/srag.repository'
import { SragService } from '../src/modules/srag/srag.service'
import { criarAmbiente } from './helpers'
import { fonte, gerarCasos } from './mongo-helpers'

const limpezas: (() => Promise<void>)[] = []
afterEach(async () => {
  await Promise.all(limpezas.splice(0).map((f) => f()))
})

describe('comparativo anual', () => {
  it('compara anos fechados pelo total e o ano corrente pelas mesmas semanas do ano anterior', async () => {
    const repo = new InMemorySragRepository()
    await repo.salvarAno(fonte(2024, 40), gerarCasos(2024, 40))
    await repo.salvarAno(fonte(2025, 80), gerarCasos(2025, 80))
    await repo.salvarAno(fonte(2026, 30), gerarCasos(2026, 30))
    const service = new SragService(repo, () => new Date('2026-11-04T12:00:00Z'))

    const [a2024, a2025, a2026] = await service.comparativoAnual({})
    expect(a2024).toMatchObject({ ano: 2024, parcial: false, totalCasos: 40, semanasNoPeriodo: 52, comparacaoAnoAnterior: null })
    expect(a2025).toMatchObject({
      ano: 2025,
      parcial: false,
      totalCasos: 80,
      semanasNoPeriodo: 53,
      comparacaoAnoAnterior: { criterio: 'ano_inteiro', casosAnoAnterior: 40, casosNestePeriodo: 80, variacaoPercentual: 100 },
    })
    expect(a2026?.parcial).toBe(true)
    expect(a2026?.semanasNoPeriodo).toBe(44)
    const casos2025AteSe44 = (await repo.listar({ anos: [2025], semanaFim: 44 })).length
    expect(a2026?.comparacaoAnoAnterior).toMatchObject({
      criterio: 'mesmo_periodo',
      semanas: 44,
      casosAnoAnterior: casos2025AteSe44,
      casosNestePeriodo: (await repo.listar({ anos: [2026], semanaFim: 44 })).length,
    })
  })

  it('GET /v1/srag/anos aplica filtros e ignora parâmetro de ano', async () => {
    const repo = new InMemorySragRepository()
    await repo.salvarAno(fonte(2025, 80), gerarCasos(2025, 80))
    await repo.salvarAno(fonte(2026, 30), gerarCasos(2026, 30))
    const amb = await criarAmbiente({ repository: repo })
    limpezas.push(amb.limpar)

    const todos = await request(amb.app).get('/v1/srag/anos')
    expect(todos.status).toBe(200)
    expect(todos.body.dados.map((l: { ano: number }) => l.ano)).toEqual([2025, 2026])
    expect(todos.body.aviso).toContain('mesmo_periodo')

    const covid = await request(amb.app).get('/v1/srag/anos?classificacao=covid19')
    const totalCovid2025 = (await repo.listar({ anos: [2025], classificacao: ['covid19'] })).length
    expect(covid.body.dados[0].totalCasos).toBe(totalCovid2025)

    expect((await request(amb.app).get('/v1/srag/anos?classificacao=gripe')).status).toBe(400)
  })
})
