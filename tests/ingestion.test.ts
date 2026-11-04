import { createReadStream } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { filtrarMunicipio } from '../src/ingestion/csv-ingestor'
import { OpenDataSusClient, extrairArquivos } from '../src/ingestion/opendatasus.client'

const fixture = (nome: string) => path.join(__dirname, 'fixtures', nome)

describe('filtrarMunicipio', () => {
  it('mantém só os residentes do município e descarta linhas inválidas', async () => {
    const r = await filtrarMunicipio(createReadStream(fixture('srag-amostra.csv')), { codigoIbge: '280350', anoArquivo: 2026 })
    expect(r.linhasLidas).toBe(6)
    expect(r.casos.map((c) => c.id).sort()).toEqual(['1001', '1002', '1003', '1005'])
    expect(r.linhasDescartadas).toBe(1)
    expect(r.casos.every((c) => c.municipioResidencia.codigoIbge === '280350')).toBe(true)
  })

  it('lida com ; e aspas dentro de campos de texto', async () => {
    const r = await filtrarMunicipio(createReadStream(fixture('srag-amostra.csv')), { codigoIbge: '280350', anoArquivo: 2026 })
    const caso = r.casos.find((c) => c.id === '1005')
    expect(caso?.classificacao).toBe('covid19')
    expect(caso?.agentes).toEqual(['covid19'])
  })

  it('falha se o CSV não tiver as colunas esperadas', async () => {
    await expect(
      filtrarMunicipio(Readable.from(['"A";"B"\n"1";"2"\n']), { codigoIbge: '280350', anoArquivo: 2026 }),
    ).rejects.toThrow(/colunas obrigatórias/)
  })
})

describe('OpenDataSUS', () => {
  it('extrai o CSV mais recente de cada ano', async () => {
    const arquivos = extrairArquivos(await readFile(fixture('dataset-page.html'), 'utf8'))
    expect([...arquivos.keys()].sort()).toEqual([2025, 2026])
    expect(arquivos.get(2025)).toEqual({
      ano: 2025,
      arquivo: 'INFLUD25-02-11-2026.csv',
      url: 'https://s3.sa-east-1.amazonaws.com/ckan.saude.gov.br/SRAG/2025/INFLUD25-02-11-2026.csv',
      publicadoEm: '2026-11-02',
    })
  })

  it('reporta erro claro quando a página muda de layout', async () => {
    const fetchFalso = (async () => new Response('<html>sem links</html>')) as typeof fetch
    await expect(new OpenDataSusClient('https://exemplo.gov.br', fetchFalso).descobrirArquivos()).rejects.toThrow(
      /layout da página/,
    )
  })

  it('reporta erro HTTP', async () => {
    const fetchFalso = (async () => new Response('erro', { status: 502 })) as typeof fetch
    await expect(new OpenDataSusClient('https://exemplo.gov.br', fetchFalso).descobrirArquivos()).rejects.toThrow(/502/)
  })
})
