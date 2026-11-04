import { Readable } from 'node:stream'

export type FetchFn = typeof fetch

export interface ArquivoRemoto {
  ano: number
  arquivo: string
  url: string
  publicadoEm: string | null
}

const REGEX_CSV = /https:\/\/[^"'\s<>]+\/SRAG\/(\d{4})\/(INFLUD\d{2}-(\d{2})-(\d{2})-(\d{4})\.csv)/g

const TIMEOUT_PAGINA_MS = 30_000
const TIMEOUT_DOWNLOAD_MS = 60 * 60_000

export function extrairArquivos(html: string): Map<number, ArquivoRemoto> {
  const porAno = new Map<number, ArquivoRemoto>()
  for (const [url, ano, arquivo, dia, mes, anoPublicacao] of html.matchAll(REGEX_CSV)) {
    const candidato: ArquivoRemoto = {
      ano: Number(ano),
      arquivo: arquivo!,
      url,
      publicadoEm: `${anoPublicacao}-${mes}-${dia}`,
    }
    const atual = porAno.get(candidato.ano)
    if (!atual || (candidato.publicadoEm ?? '') > (atual.publicadoEm ?? '')) porAno.set(candidato.ano, candidato)
  }
  return porAno
}

export class OpenDataSusClient {
  constructor(
    private readonly datasetUrl: string,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  async descobrirArquivos(): Promise<Map<number, ArquivoRemoto>> {
    const resposta = await this.fetchFn(this.datasetUrl, {
      signal: AbortSignal.timeout(TIMEOUT_PAGINA_MS),
      headers: { accept: 'text/html' },
    })
    if (!resposta.ok) throw new Error(`OpenDataSUS respondeu ${resposta.status} ao listar os arquivos de SRAG`)
    const arquivos = extrairArquivos(await resposta.text())
    if (arquivos.size === 0) {
      throw new Error('Nenhum CSV de SRAG encontrado na página do OpenDataSUS (o layout da página pode ter mudado)')
    }
    return arquivos
  }

  async abrirCsv(url: string): Promise<Readable> {
    const resposta = await this.fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_DOWNLOAD_MS) })
    if (!resposta.ok || !resposta.body) throw new Error(`Falha ao baixar ${url}: HTTP ${resposta.status}`)
    return Readable.fromWeb(resposta.body as import('node:stream/web').ReadableStream)
  }
}
