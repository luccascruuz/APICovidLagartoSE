import type { ResultadoAno } from '../ingestion/sync.service'
import type { Logger } from '../shared/logger'

export interface Monitoramento {
  readonly integracoes: { healthchecks: boolean; sentry: boolean }
  erro(erro: unknown, contexto?: Record<string, unknown>): void
  sincronizacaoIniciada(): void
  sincronizacaoFinalizada(resultados: ResultadoAno[]): void
  encerrar(): Promise<void>
}

export const monitoramentoNulo: Monitoramento = {
  integracoes: { healthchecks: false, sentry: false },
  erro: () => undefined,
  sincronizacaoIniciada: () => undefined,
  sincronizacaoFinalizada: () => undefined,
  encerrar: async () => undefined,
}

export interface Reporter {
  capturar(erro: unknown, contexto?: Record<string, unknown>): void
  encerrar(): Promise<void>
}

const TIMEOUT_PING_MS = 10_000

export class HealthchecksPinger {
  constructor(
    private readonly url: string,
    private readonly logger: Logger,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async ping(sufixo: '' | '/start' | '/fail', corpo?: string): Promise<void> {
    try {
      const resposta = await this.fetchFn(`${this.url}${sufixo}`, {
        method: corpo ? 'POST' : 'GET',
        body: corpo,
        signal: AbortSignal.timeout(TIMEOUT_PING_MS),
      })
      if (!resposta.ok) this.logger.warn({ status: resposta.status }, 'Healthchecks.io recusou o ping')
    } catch (erro) {
      this.logger.warn({ err: erro }, 'Falha ao enviar ping ao Healthchecks.io')
    }
  }
}

export function descreverResultados(resultados: ResultadoAno[]): string {
  return resultados
    .map((r) => `${r.ano}: ${r.situacao}${r.arquivo ? ` (${r.arquivo})` : ''}${r.mensagem ? ` - ${r.mensagem}` : ''}`)
    .join('\n')
}

export function criarMonitoramento(opcoes: {
  logger: Logger
  healthchecks?: HealthchecksPinger
  reporter?: Reporter
}): Monitoramento {
  const { logger, healthchecks, reporter } = opcoes
  const pendentes = new Set<Promise<void>>()

  const enviar = (promessa: Promise<void>) => {
    pendentes.add(promessa)
    void promessa.finally(() => pendentes.delete(promessa))
  }

  const reportar = (erro: unknown, contexto?: Record<string, unknown>) => {
    try {
      reporter?.capturar(erro, contexto)
    } catch (falha) {
      logger.warn({ err: falha }, 'Falha ao reportar erro ao Sentry')
    }
  }

  return {
    integracoes: { healthchecks: Boolean(healthchecks), sentry: Boolean(reporter) },
    erro: reportar,

    sincronizacaoIniciada() {
      if (healthchecks) enviar(healthchecks.ping('/start'))
    },

    sincronizacaoFinalizada(resultados) {
      const falhas = resultados.filter((r) => r.situacao === 'erro')
      if (healthchecks) enviar(healthchecks.ping(falhas.length ? '/fail' : '', descreverResultados(resultados)))
      if (falhas.length) {
        reportar(new Error(`Sincronização com o OpenDataSUS falhou: ${descreverResultados(falhas)}`), { resultados })
      }
    },

    async encerrar() {
      await Promise.allSettled([...pendentes])
      await reporter?.encerrar()
    },
  }
}
