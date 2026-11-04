import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'
import type { Logger } from './logger'

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
    message: string,
    public readonly detalhes?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const naoEncontrado = (mensagem = 'Recurso não encontrado') => new AppError(404, 'NAO_ENCONTRADO', mensagem)

export const rotaNaoEncontrada: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'ROTA_NAO_ENCONTRADA', `Rota ${req.method} ${req.path} não existe. Veja /docs.`))
}

export function tratadorDeErros(
  logger: Logger,
  aoErroInterno: (erro: unknown, contexto: Record<string, unknown>) => void = () => undefined,
): ErrorRequestHandler {
  return (err, req, res, _next) => {
    if (err instanceof ZodError) {
      res.status(400).json({
        erro: {
          codigo: 'PARAMETROS_INVALIDOS',
          mensagem: 'Parâmetros inválidos',
          detalhes: err.issues.map((i) => ({ campo: i.path.join('.'), mensagem: i.message })),
        },
      })
      return
    }

    if (err instanceof AppError) {
      res.status(err.status).json({
        erro: { codigo: err.codigo, mensagem: err.message, ...(err.detalhes ? { detalhes: err.detalhes } : {}) },
      })
      return
    }

    if (err?.type === 'entity.parse.failed') {
      res.status(400).json({ erro: { codigo: 'JSON_INVALIDO', mensagem: 'Corpo da requisição não é um JSON válido' } })
      return
    }

    logger.error({ err, metodo: req.method, rota: req.originalUrl }, 'Erro não tratado')
    aoErroInterno(err, { metodo: req.method, rota: req.originalUrl })
    res.status(500).json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Erro interno do servidor' } })
  }
}
