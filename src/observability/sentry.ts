import * as Sentry from '@sentry/node'
import type { Reporter } from './monitoramento'

export function criarSentryReporter(opcoes: { dsn: string; ambiente: string; versao: string }): Reporter {
  Sentry.init({
    dsn: opcoes.dsn,
    environment: opcoes.ambiente,
    release: `api-srag-lagarto-se@${opcoes.versao}`,
  })

  return {
    capturar(erro, contexto) {
      Sentry.captureException(erro, contexto ? { extra: contexto } : undefined)
    },
    async encerrar() {
      await Sentry.close(2000)
    },
  }
}
