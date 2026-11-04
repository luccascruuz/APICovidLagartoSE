import { createReadStream } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PassThrough, Readable } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'
import { filtrarMunicipio } from '../src/ingestion/csv-ingestor'
import { DownloadInterrompidoError, OpenDataSusClient } from '../src/ingestion/opendatasus.client'

const FIXTURE = path.join(__dirname, 'fixtures', 'srag-amostra.csv')
const URL_CSV = 'https://exemplo/SRAG/2026/INFLUD26-02-11-2026.csv'
const ETAG = '"abc-123"'

function corpoQueCai(dados: Buffer, cortarEm: number): ReadableStream<Uint8Array> {
  let entregou = cortarEm === 0
  return new ReadableStream({
    pull(controle) {
      if (!entregou) {
        entregou = true
        controle.enqueue(new Uint8Array(dados.subarray(0, cortarEm)))
        return
      }
      controle.error(new TypeError('terminated'))
    },
  })
}

function servidor(dados: Buffer, opcoes: { quedas: number[]; aceitaRetomada?: boolean; etag?: string }) {
  const quedas = [...opcoes.quedas]
  const pedidos: { range?: string; ifRange?: string }[] = []
  const fetchFn = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>
    pedidos.push({ range: headers.range, ifRange: headers['if-range'] })
    const inicio = headers.range ? Number(headers.range.match(/bytes=(\d+)-/)![1]) : 0
    const retoma = inicio > 0 && opcoes.aceitaRetomada !== false && headers['if-range'] === (opcoes.etag ?? ETAG)
    const parte = retoma ? dados.subarray(inicio) : dados
    const corte = quedas.shift()
    const corpo = corte !== undefined ? corpoQueCai(parte, corte) : new Blob([new Uint8Array(parte)]).stream()
    return new Response(corpo, { status: retoma ? 206 : 200, headers: { etag: opcoes.etag ?? ETAG } })
  }) as unknown as typeof fetch
  return { fetchFn, pedidos }
}

const semEspera = { esperar: async () => undefined }

async function ler(stream: Readable): Promise<Buffer> {
  const partes: Buffer[] = []
  for await (const parte of stream) partes.push(parte as Buffer)
  return Buffer.concat(partes)
}

describe('download com retomada', () => {
  it('retoma de onde parou e entrega o arquivo idêntico', async () => {
    const dados = await readFile(FIXTURE)
    const { fetchFn, pedidos } = servidor(dados, { quedas: [700, 900] })
    const aoRetomar = vi.fn()
    const cliente = new OpenDataSusClient('https://exemplo', fetchFn, { ...semEspera, aoRetomar })

    const recebido = await ler(await cliente.abrirCsv(URL_CSV))

    expect(recebido.equals(dados)).toBe(true)
    expect(pedidos).toEqual([
      { range: undefined, ifRange: undefined },
      { range: 'bytes=700-', ifRange: ETAG },
      { range: 'bytes=1600-', ifRange: ETAG },
    ])
    expect(aoRetomar).toHaveBeenCalledTimes(2)
    expect(aoRetomar.mock.calls[1]![0]).toMatchObject({ bytesRecebidos: 1600, tentativa: 1 })
  })

  it('o CSV lido com quedas no meio dá o mesmo resultado que sem quedas', async () => {
    const dados = await readFile(FIXTURE)
    const opcoes = { codigoIbge: '280350', anoArquivo: 2026 }
    const esperado = await filtrarMunicipio(createReadStream(FIXTURE), opcoes)
    const { fetchFn } = servidor(dados, { quedas: [333, 1, 2048, 50] })
    const obtido = await filtrarMunicipio(await new OpenDataSusClient('https://x', fetchFn, semEspera).abrirCsv(URL_CSV), opcoes)
    expect(obtido).toEqual(esperado)
  })

  it('recusa juntar pedaços se o arquivo mudou no servidor durante o download', async () => {
    const dados = await readFile(FIXTURE)
    const { fetchFn } = servidor(dados, { quedas: [500], aceitaRetomada: false })
    const stream = await new OpenDataSusClient('https://x', fetchFn, semEspera).abrirCsv(URL_CSV)
    await expect(ler(stream)).rejects.toThrow(/O arquivo pode ter sido trocado/)
  })

  it('desiste depois de muitas quedas seguidas sem progresso', async () => {
    const dados = await readFile(FIXTURE)
    const { fetchFn } = servidor(dados, { quedas: [10, 0, 0, 0, 0] })
    const cliente = new OpenDataSusClient('https://x', fetchFn, { ...semEspera, tentativas: 3 })
    await expect(ler(await cliente.abrirCsv(URL_CSV))).rejects.toThrow(DownloadInterrompidoError)
  })

  it('espera cada vez mais entre quedas seguidas, até 30 s', async () => {
    const dados = await readFile(FIXTURE)
    const esperas: number[] = []
    const { fetchFn } = servidor(dados, { quedas: [5, 0, 0, 0, 0, 0, 0] })
    const cliente = new OpenDataSusClient('https://x', fetchFn, { esperar: async (ms) => void esperas.push(ms), tentativas: 10 })
    await ler(await cliente.abrirCsv(URL_CSV))
    expect(esperas).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000])
  })

  it('erro HTTP na primeira conexão falha na hora', async () => {
    const fetchFn = (async () => new Response('nao', { status: 404 })) as typeof fetch
    await expect(new OpenDataSusClient('https://x', fetchFn, semEspera).abrirCsv(URL_CSV)).rejects.toThrow(/HTTP 404/)
  })
})

describe('erros no meio da leitura', () => {
  it('viram rejeição da promessa, sem derrubar o processo', async () => {
    const entrada = new PassThrough()
    const leitura = filtrarMunicipio(entrada, { codigoIbge: '280350', anoArquivo: 2026 })
    entrada.write(await readFile(FIXTURE, 'utf8').then((t) => t.slice(0, 2000)))
    entrada.destroy(new TypeError('terminated'))
    await expect(leitura).rejects.toThrow('terminated')
  })
})
