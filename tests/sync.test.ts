import { afterEach, describe, expect, it } from 'vitest'
import { criarAmbiente, criarFetchFalso } from './helpers'

let limpar: (() => Promise<void>) | undefined
afterEach(async () => {
  await limpar?.()
  limpar = undefined
})

describe('SyncService', () => {
  it('importa o ano, salva cache e não baixa de novo se o arquivo não mudou', async () => {
    const amb = await criarAmbiente()
    limpar = amb.limpar

    const primeira = await amb.sync.sincronizar()
    expect(primeira).toEqual([{ ano: 2026, situacao: 'atualizado', arquivo: 'INFLUD26-02-11-2026.csv', totalCasos: 4 }])
    expect(await amb.estado.pronto()).toBe(true)

    const [fonte] = await amb.repository.fontes()
    expect(fonte).toMatchObject({ ano: 2026, publicadoEm: '2026-11-02', linhasLidas: 6, totalCasos: 4, linhasDescartadas: 1 })

    const segunda = await amb.sync.sincronizar()
    expect(segunda[0]?.situacao).toBe('sem_alteracao')
    expect(amb.fetchFn).toHaveBeenCalledTimes(3)

    const forcada = await amb.sync.sincronizar({ forcar: true })
    expect(forcada[0]?.situacao).toBe('atualizado')
  })

  it('reaproveita o cache em disco ao reiniciar', async () => {
    const amb = await criarAmbiente()
    limpar = amb.limpar
    await amb.sync.sincronizar()

    const reinicio = await criarAmbiente({ config: { dataDir: amb.config.dataDir } })
    expect(await reinicio.sync.carregarCache()).toBe(1)
    expect(await reinicio.estado.pronto()).toBe(true)
    expect((await reinicio.repository.listar({})).length).toBe(4)
  })

  it('ignora cache de outro município', async () => {
    const amb = await criarAmbiente()
    limpar = amb.limpar
    await amb.sync.sincronizar()

    const outro = await criarAmbiente({
      config: { dataDir: amb.config.dataDir, municipio: { codigoIbge: '280030', nome: 'Aracaju', uf: 'SE' } },
    })
    expect(await outro.sync.carregarCache()).toBe(0)
  })

  it('chamadas simultâneas compartilham a mesma execução', async () => {
    const amb = await criarAmbiente()
    limpar = amb.limpar
    const [a, b] = await Promise.all([amb.sync.sincronizar(), amb.sync.sincronizar()])
    expect(a).toBe(b)
    expect(amb.fetchFn).toHaveBeenCalledTimes(2)
  })

  it('registra erro sem derrubar a API quando o OpenDataSUS falha', async () => {
    const fetchQuebrado = (async () => new Response('fora do ar', { status: 503 })) as typeof fetch
    const amb = await criarAmbiente({ fetch: fetchQuebrado })
    limpar = amb.limpar
    const resultado = await amb.sync.sincronizar()
    expect(resultado[0]).toMatchObject({ ano: 2026, situacao: 'erro' })
    expect(amb.sync.status.ultimaExecucao?.sucesso).toBe(false)
    expect(await amb.estado.pronto()).toBe(false)
  })

  it('aponta ano ausente no OpenDataSUS', async () => {
    const amb = await criarAmbiente({ config: { anos: [2025, 2026] }, fetch: criarFetchFalso() })
    limpar = amb.limpar
    const resultado = await amb.sync.sincronizar()
    expect(resultado.find((r) => r.ano === 2025)).toMatchObject({ situacao: 'erro' })
    expect(resultado.find((r) => r.ano === 2026)).toMatchObject({ situacao: 'atualizado' })
  })
})
