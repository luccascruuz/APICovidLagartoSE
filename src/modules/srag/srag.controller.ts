import type { Request, Response } from 'express'
import { naoEncontrado } from '../../shared/errors'
import { DICIONARIO } from './srag.codes'
import { consultaAnosSchema, consultaCasosSchema, consultaResumoSchema, consultaSemanasSchema, idSchema } from './srag.schemas'
import type { SragService } from './srag.service'

const AVISO_ATRASO =
  'As últimas semanas costumam estar incompletas: há atraso entre o início dos sintomas, a notificação e a publicação ' +
  'pelo Ministério da Saúde. Casos "em_investigacao" e "em_aberto" ainda serão atualizados.'

export class SragController {
  constructor(private readonly service: SragService) {}

  casos = async (req: Request, res: Response) => {
    const { filtro, paginacao } = consultaCasosSchema.parse(req.query)
    const { itens, total } = await this.service.buscarCasos(filtro, paginacao)
    res.json({
      dados: itens,
      paginacao: { ...paginacao, total, totalPaginas: Math.ceil(total / paginacao.limite) },
    })
  }

  caso = async (req: Request, res: Response) => {
    const { id } = idSchema.parse(req.params)
    const caso = await this.service.buscarCaso(id)
    if (!caso) throw naoEncontrado(`Notificação ${id} não encontrada`)
    res.json({ dados: caso })
  }

  resumo = async (req: Request, res: Response) => {
    const filtro = consultaResumoSchema.parse(req.query)
    res.json({ dados: await this.service.resumo(filtro), filtros: filtro, aviso: AVISO_ATRASO })
  }

  semanas = async (req: Request, res: Response) => {
    const consulta = consultaSemanasSchema.parse(req.query)
    const fontes = await this.service.fontes()
    const ano = consulta.ano ?? fontes.at(-1)?.ano
    if (ano === undefined) throw naoEncontrado('Nenhum ano carregado')
    if (!fontes.some((f) => f.ano === ano)) throw naoEncontrado(`O ano ${ano} não está carregado nesta API`)

    const semanas = await this.service.serieSemanal(ano, consulta.filtro, consulta.janela)
    res.json({ dados: { ano, janelaMediaMovel: consulta.janela, semanas }, filtros: consulta.filtro, aviso: AVISO_ATRASO })
  }

  anos = async (req: Request, res: Response) => {
    const filtro = consultaAnosSchema.parse(req.query)
    res.json({
      dados: await this.service.comparativoAnual(filtro),
      filtros: filtro,
      aviso:
        'O ano corrente é parcial: ele é comparado com as mesmas semanas epidemiológicas do ano anterior (criterio "mesmo_periodo"). ' +
        AVISO_ATRASO,
    })
  }

  dicionario = (_req: Request, res: Response) => {
    res.json({ dados: DICIONARIO })
  }
}
