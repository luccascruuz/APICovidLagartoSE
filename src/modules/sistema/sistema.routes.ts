import { createHash, timingSafeEqual } from 'node:crypto'
import { Router, type RequestHandler } from 'express'
import type { Config } from '../../config/env'
import type { SyncService } from '../../ingestion/sync.service'
import type { Metricas } from '../../observability/metricas'
import type { Monitoramento } from '../../observability/monitoramento'
import { avaliarSaude } from '../../observability/saude'
import { renderizarStatus, type StatusApi } from '../../observability/status'
import { AppError } from '../../shared/errors'
import { sincronizarSchema } from '../srag/srag.schemas'
import type { SragService } from '../srag/srag.service'
import type { EstadoDados } from './estado-dados'

const HISTORICO_NO_STATUS = 10

function tokensIguais(recebido: string, esperado: string): boolean {
  const a = createHash('sha256').update(recebido).digest()
  const b = createHash('sha256').update(esperado).digest()
  return timingSafeEqual(a, b)
}

export interface SistemaDeps {
  config: Config
  estado: EstadoDados
  service: SragService
  metricas: Metricas
  monitoramento: Monitoramento
  inicioProcesso: Date
  sync?: SyncService
}

export function sistemaRoutes(deps: SistemaDeps): Router {
  const { config, estado, service, metricas, monitoramento, inicioProcesso, sync } = deps
  const router = Router()

  const saude = async () =>
    avaliarSaude({
      dadosCarregados: await estado.pronto(),
      sincronizacao: await estado.sincronizacao(),
      maxHorasSemSync: config.saudeMaxHorasSemSync,
      inicioProcesso,
    })

  const status = async (): Promise<StatusApi> => {
    const [resultadoSaude, dados, sincronizacao, historico] = await Promise.all([
      saude(),
      service.fontes(),
      estado.sincronizacao(),
      estado.historico(HISTORICO_NO_STATUS),
    ])
    return {
      geradoEm: new Date().toISOString(),
      municipio: config.municipio,
      armazenamento: config.mongoUri ? 'mongodb' : 'memoria',
      saude: resultadoSaude,
      dados,
      sincronizacao: {
        ...sincronizacao,
        nesteProcesso: estado.sincronizaNesteProcesso,
        intervaloHoras: estado.sincronizaNesteProcesso ? config.syncIntervaloHoras : 0,
      },
      historico,
      integracoes: monitoramento.integracoes,
      metricas: metricas.snapshot(),
    }
  }

  router.get('/health', async (_req, res) => {
    const resultado = await saude()
    res.setHeader('Cache-Control', 'no-store')
    res.status(resultado.status === 'indisponivel' ? 503 : 200).json(resultado)
  })

  router.get('/status.json', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.json(await status())
  })

  router.get('/status', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.type('html').send(renderizarStatus(await status()))
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
        anos: await service.fontes(),
        sincronizacao: await estado.sincronizacao(),
      },
    })
  })

  const exigirToken: RequestHandler = (req, _res, next) => {
    if (!config.adminToken || !sync) {
      return next(new AppError(404, 'ROTA_NAO_ENCONTRADA', 'Rota administrativa desativada'))
    }
    const [tipo, token] = (req.headers.authorization ?? '').split(' ')
    if (tipo !== 'Bearer' || !token || !tokensIguais(token, config.adminToken)) {
      return next(new AppError(401, 'NAO_AUTORIZADO', 'Token de administrador inválido ou ausente'))
    }
    next()
  }

  router.post('/v1/admin/sincronizar', exigirToken, (req, res) => {
    const { forcar } = sincronizarSchema.parse(req.body ?? {})
    const servico = sync!
    const jaEmAndamento = servico.emAndamento
    void servico.sincronizar({ forcar }).catch(() => undefined)
    res.status(202).json({
      mensagem: jaEmAndamento ? 'Já existe uma sincronização em andamento' : 'Sincronização iniciada',
      status: servico.status,
    })
  })

  return router
}
