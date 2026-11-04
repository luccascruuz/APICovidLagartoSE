import { monitoramentoNulo, type Monitoramento } from '../observability/monitoramento'
import type { Logger } from '../shared/logger'
import type { ExecucaoSincronizacao, FonteAno, ResultadoAno, SragRepository } from '../modules/srag/srag.repository'
import { filtrarMunicipio } from './csv-ingestor'
import type { FileCache } from './file-cache'
import type { OpenDataSusClient } from './opendatasus.client'

export type { ResultadoAno } from '../modules/srag/srag.repository'

export interface StatusSincronizacao {
  emAndamento: boolean
  iniciadaEm: string | null
  ultimaExecucao: ExecucaoSincronizacao | null
  ultimoSucessoEm: string | null
  proximaExecucao: string | null
}

export interface SyncOptions {
  anos: number[]
  municipioIbge: string
  intervaloHoras: number
  origem: string
}

const LINHAS_POR_AVISO = 500_000

export class SyncService {
  private execucaoAtual: Promise<ResultadoAno[]> | null = null
  private timer: NodeJS.Timeout | null = null
  private readonly estado: StatusSincronizacao = {
    emAndamento: false,
    iniciadaEm: null,
    ultimaExecucao: null,
    ultimoSucessoEm: null,
    proximaExecucao: null,
  }

  constructor(
    private readonly repository: SragRepository,
    private readonly client: OpenDataSusClient,
    private readonly cache: FileCache | null,
    private readonly opcoes: SyncOptions,
    private readonly logger: Logger,
    private readonly monitoramento: Monitoramento = monitoramentoNulo,
  ) {}

  get status(): StatusSincronizacao {
    return structuredClone(this.estado)
  }

  async carregarCache(): Promise<number> {
    if (!this.cache) return 0
    let carregados = 0
    for (const ano of this.opcoes.anos) {
      try {
        const conteudo = await this.cache.ler(ano, this.opcoes.municipioIbge)
        if (!conteudo) continue
        await this.repository.salvarAno(conteudo.fonte, conteudo.casos)
        carregados++
        this.logger.info({ ano, casos: conteudo.casos.length, arquivo: conteudo.fonte.arquivo }, 'Cache carregado')
      } catch (erro) {
        this.logger.warn({ ano, err: erro }, 'Cache local ilegível, será refeito na próxima sincronização')
      }
    }
    return carregados
  }

  sincronizar(opcoes: { forcar?: boolean } = {}): Promise<ResultadoAno[]> {
    if (this.execucaoAtual) return this.execucaoAtual
    this.execucaoAtual = this.executar(opcoes.forcar ?? false).finally(() => {
      this.execucaoAtual = null
    })
    return this.execucaoAtual
  }

  get emAndamento(): boolean {
    return this.execucaoAtual !== null
  }

  agendar(): void {
    const horas = this.opcoes.intervaloHoras
    if (horas <= 0) return
    const intervaloMs = horas * 60 * 60 * 1000
    this.estado.proximaExecucao = new Date(Date.now() + intervaloMs).toISOString()
    this.timer = setInterval(() => {
      this.estado.proximaExecucao = new Date(Date.now() + intervaloMs).toISOString()
      this.sincronizar().catch((erro) => this.logger.error({ err: erro }, 'Falha na sincronização agendada'))
    }, intervaloMs)
    this.timer.unref()
  }

  parar(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.estado.proximaExecucao = null
  }

  private async executar(forcar: boolean): Promise<ResultadoAno[]> {
    const iniciadaEm = new Date().toISOString()
    this.estado.emAndamento = true
    this.estado.iniciadaEm = iniciadaEm
    this.logger.info({ anos: this.opcoes.anos, forcar }, 'Sincronização iniciada')
    this.monitoramento.sincronizacaoIniciada()

    const resultados: ResultadoAno[] = []
    try {
      const remotos = await this.client.descobrirArquivos()
      const fontesAtuais = new Map((await this.repository.fontes()).map((f) => [f.ano, f]))

      for (const ano of this.opcoes.anos) {
        const remoto = remotos.get(ano)
        if (!remoto) {
          resultados.push({ ano, situacao: 'erro', mensagem: 'Arquivo do ano não encontrado no OpenDataSUS' })
          continue
        }
        if (!forcar && fontesAtuais.get(ano)?.arquivo === remoto.arquivo) {
          resultados.push({ ano, situacao: 'sem_alteracao', arquivo: remoto.arquivo })
          continue
        }

        try {
          const inicio = Date.now()
          this.logger.info({ ano, url: remoto.url }, 'Baixando e filtrando arquivo')
          const stream = await this.client.abrirCsv(remoto.url)
          const { casos, linhasLidas, linhasDescartadas } = await filtrarMunicipio(stream, {
            codigoIbge: this.opcoes.municipioIbge,
            anoArquivo: ano,
            aoProgredir: (linhas) => {
              if (linhas % LINHAS_POR_AVISO === 0) this.logger.info({ ano, linhas }, 'Lendo CSV nacional')
            },
          })

          const fonte: FonteAno = {
            ano,
            arquivo: remoto.arquivo,
            url: remoto.url,
            publicadoEm: remoto.publicadoEm,
            importadoEm: new Date().toISOString(),
            linhasLidas,
            totalCasos: casos.length,
            linhasDescartadas,
          }
          await this.repository.salvarAno(fonte, casos)
          await this.cache?.salvar(this.opcoes.municipioIbge, fonte, casos)

          resultados.push({ ano, situacao: 'atualizado', arquivo: remoto.arquivo, totalCasos: casos.length })
          this.logger.info(
            { ano, casos: casos.length, linhasLidas, linhasDescartadas, segundos: Math.round((Date.now() - inicio) / 1000) },
            'Ano importado',
          )
        } catch (erro) {
          this.logger.error({ ano, err: erro }, 'Falha ao importar ano')
          resultados.push({ ano, situacao: 'erro', arquivo: remoto.arquivo, mensagem: (erro as Error).message })
        }
      }
    } catch (erro) {
      this.logger.error({ err: erro }, 'Falha ao consultar o OpenDataSUS')
      for (const ano of this.opcoes.anos) {
        if (!resultados.some((r) => r.ano === ano)) {
          resultados.push({ ano, situacao: 'erro', mensagem: (erro as Error).message })
        }
      }
    } finally {
      this.estado.emAndamento = false
      this.estado.iniciadaEm = null
    }

    const finalizadaEm = new Date().toISOString()
    const sucesso = resultados.every((r) => r.situacao !== 'erro')
    const execucao: ExecucaoSincronizacao = { origem: this.opcoes.origem, iniciadaEm, finalizadaEm, sucesso, anos: resultados }
    this.estado.ultimaExecucao = execucao
    if (sucesso) this.estado.ultimoSucessoEm = finalizadaEm
    try {
      await this.repository.registrarSincronizacao(execucao)
    } catch (erro) {
      this.logger.error({ err: erro }, 'Falha ao registrar a sincronização no banco')
      this.monitoramento.erro(erro, { etapa: 'registrar_sincronizacao' })
    }
    this.logger.info({ resultados }, 'Sincronização finalizada')
    this.monitoramento.sincronizacaoFinalizada(resultados)
    return resultados
  }
}
