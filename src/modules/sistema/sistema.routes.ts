import { createHash, timingSafeEqual } from 'node:crypto'
import { Router, type RequestHandler } from 'express'
import type { Config } from '../../config/env'
import type { SyncService } from '../../ingestion/sync.service'
import { AppError } from '../../shared/errors'
import { sincronizarSchema } from '../srag/srag.schemas'
import type { SragService } from '../srag/srag.service'

function tokensIguais(recebido: string, esperado: string): boolean {
  const a = createHash('sha256').update(recebido).digest()
  const b = createHash('sha256').update(esperado).digest()
  return timingSafeEqual(a, b)
}

export function sistemaRoutes(deps: { config: Config; sync: SyncService; service: SragService }): Router {
  const { config, sync, service } = deps
  const router = Router()

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', dadosCarregados: sync.pronto, sincronizacaoEmAndamento: sync.emAndamento })
  })

  router.get('/v1/fonte', async (_req, res) => {
    res.json({
      dados: {
        municipio: config.municipio,
        origem: {
          sistema: 'SIVEP-Gripe — Ministério da Saúde',
          conjuntoDeDados: config.datasetUrl,
          descricao:
            'Casos de Síndrome Respiratória Aguda Grave (SRAG) hospitalizados e óbitos por SRAG, filtrados pelo município de residência do paciente.',
        },
        anosConfigurados: config.anos,
        anos: await service.fontes(),
        sincronizacao: sync.status,
      },
    })
  })

  const exigirToken: RequestHandler = (req, _res, next) => {
    if (!config.adminToken) return next(new AppError(404, 'ROTA_NAO_ENCONTRADA', 'Rota administrativa desativada'))
    const [tipo, token] = (req.headers.authorization ?? '').split(' ')
    if (tipo !== 'Bearer' || !token || !tokensIguais(token, config.adminToken)) {
      return next(new AppError(401, 'NAO_AUTORIZADO', 'Token de administrador inválido ou ausente'))
    }
    next()
  }

  router.post('/v1/admin/sincronizar', exigirToken, (req, res) => {
    const { forcar } = sincronizarSchema.parse(req.body ?? {})
    const jaEmAndamento = sync.emAndamento
    void sync.sincronizar({ forcar }).catch(() => undefined)
    res.status(202).json({
      mensagem: jaEmAndamento ? 'Já existe uma sincronização em andamento' : 'Sincronização iniciada',
      status: sync.status,
    })
  })

  return router
}
