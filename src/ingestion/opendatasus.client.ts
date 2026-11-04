import { Readable } from 'node:stream'

export type FetchFn = typeof fetch

export interface ArquivoRemoto {
  ano: number
  arquivo: string
  url: string
  publicadoEm: string | null
}

export interface OpcoesDownload {
  tentativas: number
  esperar: (ms: number) => Promise<void>
  aoRetomar?: (info: { url: string; bytesRecebidos: number; tentativa: number; erro: unknown }) => void
}

const REGEX_CSV = /https:\/\/[^"'\s<>]+\/SRAG\/(\d{4})\/(INFLUD\d{2}-(\d{2})-(\d{2})-(\d{4})\.csv)/g

const TIMEOUT_PAGINA_MS = 30_000
const TIMEOUT_CONEXAO_MS = 60_000

const opcoesPadrao: OpcoesDownload = {
  tentativas: 8,
  esperar: (ms) => new Promise((resolver) => setTimeout(resolver, ms)),
}

export class DownloadInterrompidoError extends Error {}

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

function comTimeoutDeConexao(): { signal: AbortSignal; conectou: () => void } {
  const controle = new AbortController()
  const timer = setTimeout(() => controle.abort(new Error('Tempo esgotado ao conectar')), TIMEOUT_CONEXAO_MS)
  return { signal: controle.signal, conectou: () => clearTimeout(timer) }
}

export class OpenDataSusClient {
  private readonly download: OpcoesDownload

  constructor(
    private readonly datasetUrl: string,
    private readonly fetchFn: FetchFn = fetch,
    download: Partial<OpcoesDownload> = {},
  ) {
    this.download = { ...opcoesPadrao, ...download }
  }

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
    const { tentativas, esperar, aoRetomar } = this.download
    const fetchFn = this.fetchFn
    let recebidos = 0
    let etag: string | null = null

    const conectar = async (): Promise<Response> => {
      const headers: Record<string, string> = {}
      if (recebidos > 0) {
        headers.range = `bytes=${recebidos}-`
        if (etag) headers['if-range'] = etag
      }
      const { signal, conectou } = comTimeoutDeConexao()
      try {
        const resposta = await fetchFn(url, { headers, signal })
        conectou()
        return resposta
      } catch (erro) {
        conectou()
        throw erro
      }
    }

    const validar = (resposta: Response) => {
      if (recebidos === 0) {
        if (!resposta.ok || !resposta.body) throw new Error(`Falha ao baixar ${url}: HTTP ${resposta.status}`)
        etag = resposta.headers.get('etag')
        return
      }
      if (resposta.status !== 206 || !resposta.body) {
        throw new DownloadInterrompidoError(
          `Não foi possível retomar o download de ${url} (HTTP ${resposta.status}). O arquivo pode ter sido trocado durante o download.`,
        )
      }
    }

    const primeira = await conectar()
    validar(primeira)

    async function* bytes(): AsyncGenerator<Buffer> {
      let resposta: Response | null = primeira
      let falhas = 0
      while (true) {
        try {
          if (!resposta) {
            resposta = await conectar()
            validar(resposta)
          }
          for await (const pedaco of resposta.body as unknown as AsyncIterable<Uint8Array>) {
            recebidos += pedaco.byteLength
            falhas = 0
            yield Buffer.from(pedaco.buffer, pedaco.byteOffset, pedaco.byteLength)
          }
          return
        } catch (erro) {
          if (erro instanceof DownloadInterrompidoError) throw erro
          falhas++
          if (falhas > tentativas) {
            throw new DownloadInterrompidoError(
              `Download de ${url} interrompido ${falhas} vezes seguidas (${recebidos} bytes recebidos): ${(erro as Error).message}`,
            )
          }
          aoRetomar?.({ url, bytesRecebidos: recebidos, tentativa: falhas, erro })
          resposta = null
          await esperar(Math.min(30_000, 1000 * 2 ** (falhas - 1)))
        }
      }
    }

    return Readable.from(bytes(), { objectMode: false })
  }
}
