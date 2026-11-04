import { intervaloDaSemana, semanaEpidemiologica, semanasNoAno } from '../../shared/epi-week'
import {
  AGENTE,
  CLASSIFICACAO,
  EVOLUCAO,
  FAIXA_ETARIA,
  SEXO,
  SUPORTE_VENTILATORIO,
  type Agente,
  type Classificacao,
  type Evolucao,
  type FaixaEtaria,
  type Sexo,
  type SuporteVentilatorio,
} from './srag.codes'
import type { FiltroCasos, Paginacao, SragRepository } from './srag.repository'
import type { CasoSrag } from './srag.types'

function contar<K extends string>(chaves: Record<K, string>, valores: (K | null)[]): Record<K, number> {
  const resultado = Object.fromEntries(Object.keys(chaves).map((k) => [k, 0])) as Record<K, number>
  for (const valor of valores) if (valor !== null) resultado[valor]++
  return resultado
}

export interface Resumo {
  totalCasos: number
  periodo: { primeiroInicioSintomas: string | null; ultimoInicioSintomas: string | null }
  hospitalizados: number
  internadosUti: number
  obitosSrag: number
  obitosOutrasCausas: number
  casosEmAberto: number
  porClassificacao: Record<Classificacao, number>
  porEvolucao: Record<Evolucao, number>
  porSexo: Record<Sexo, number>
  porFaixaEtaria: Record<FaixaEtaria | 'nao_informada', number>
  suporteVentilatorio: Record<SuporteVentilatorio | 'nao_informado', number>
  agentesIdentificados: Record<Agente, number>
}

export interface PontoSemanal {
  semana: number
  inicio: string
  fim: string
  casos: number
  obitosSrag: number
  internadosUti: number
  mediaMovel: number | null
}

export interface ComparativoAno {
  ano: number
  parcial: boolean
  semanasNoPeriodo: number
  totalCasos: number
  mediaSemanal: number
  hospitalizados: number
  internadosUti: number
  obitosSrag: number
  casosEmAberto: number
  porClassificacao: Record<Classificacao, number>
  agentesIdentificados: Record<Agente, number>
  comparacaoAnoAnterior: {
    criterio: 'ano_inteiro' | 'mesmo_periodo'
    semanas: number
    casosAnoAnterior: number
    casosNestePeriodo: number
    variacaoPercentual: number | null
  } | null
}

function percentual(atual: number, anterior: number): number | null {
  if (anterior === 0) return null
  return Math.round(((atual - anterior) / anterior) * 1000) / 10
}

export class SragService {
  constructor(
    private readonly repository: SragRepository,
    private readonly hoje: () => Date = () => new Date(),
  ) {}

  buscarCasos(filtro: FiltroCasos, paginacao: Paginacao) {
    return this.repository.buscar(filtro, paginacao)
  }

  buscarCaso(id: string) {
    return this.repository.buscarPorId(id)
  }

  fontes() {
    return this.repository.fontes()
  }

  async resumo(filtro: FiltroCasos): Promise<Resumo> {
    const casos = await this.repository.listar(filtro)
    return resumir(casos)
  }

  async comparativoAnual(filtro: Omit<FiltroCasos, 'anos'>): Promise<ComparativoAno[]> {
    const [fontes, casos] = await Promise.all([this.repository.fontes(), this.repository.listar(filtro)])
    const atual = semanaEpidemiologica(this.hoje().toISOString().slice(0, 10))

    const linhas: ComparativoAno[] = fontes.map(({ ano }) => {
      const doAno = casos.filter((c) => c.ano === ano)
      const resumo = resumir(doAno)
      const parcial = ano >= atual.ano
      const semanas = parcial ? Math.max(atual.semana, 1) : semanasNoAno(ano)
      return {
        ano,
        parcial,
        semanasNoPeriodo: semanas,
        totalCasos: resumo.totalCasos,
        mediaSemanal: Math.round((resumo.totalCasos / semanas) * 100) / 100,
        hospitalizados: resumo.hospitalizados,
        internadosUti: resumo.internadosUti,
        obitosSrag: resumo.obitosSrag,
        casosEmAberto: resumo.casosEmAberto,
        porClassificacao: resumo.porClassificacao,
        agentesIdentificados: resumo.agentesIdentificados,
        comparacaoAnoAnterior: null,
      }
    })

    const contarAteSemana = (ano: number, semana: number) =>
      casos.filter((c) => c.ano === ano && c.semanaEpidemiologica <= semana).length

    for (const linha of linhas) {
      const anterior = linhas.find((l) => l.ano === linha.ano - 1)
      if (!anterior) continue
      const semanas = linha.parcial ? linha.semanasNoPeriodo : semanasNoAno(linha.ano)
      const casosNestePeriodo = linha.parcial ? contarAteSemana(linha.ano, semanas) : linha.totalCasos
      const casosAnoAnterior = linha.parcial ? contarAteSemana(anterior.ano, semanas) : anterior.totalCasos
      linha.comparacaoAnoAnterior = {
        criterio: linha.parcial ? 'mesmo_periodo' : 'ano_inteiro',
        semanas,
        casosAnoAnterior,
        casosNestePeriodo,
        variacaoPercentual: percentual(casosNestePeriodo, casosAnoAnterior),
      }
    }

    return linhas
  }

  async serieSemanal(ano: number, filtro: FiltroCasos, janela: number): Promise<PontoSemanal[]> {
    const casos = await this.repository.listar({ ...filtro, anos: [ano] })

    const atual = semanaEpidemiologica(this.hoje().toISOString().slice(0, 10))
    const ultimaSemana = ano < atual.ano ? semanasNoAno(ano) : ano === atual.ano ? atual.semana : 0
    const maiorSemanaComDados = casos.reduce((max, c) => Math.max(max, c.semanaEpidemiologica), 0)
    const total = Math.max(ultimaSemana, maiorSemanaComDados)

    const pontos: PontoSemanal[] = Array.from({ length: total }, (_, i) => ({
      semana: i + 1,
      ...intervaloDaSemana(ano, i + 1),
      casos: 0,
      obitosSrag: 0,
      internadosUti: 0,
      mediaMovel: null,
    }))

    for (const caso of casos) {
      const ponto = pontos[caso.semanaEpidemiologica - 1]
      if (!ponto) continue
      ponto.casos++
      if (caso.evolucao === 'obito') ponto.obitosSrag++
      if (caso.uti === 'sim') ponto.internadosUti++
    }

    pontos.forEach((ponto, i) => {
      if (i + 1 < janela) return
      const soma = pontos.slice(i + 1 - janela, i + 1).reduce((s, p) => s + p.casos, 0)
      ponto.mediaMovel = Math.round((soma / janela) * 100) / 100
    })

    return pontos
  }
}

export function resumir(casos: CasoSrag[]): Resumo {
  const datas = casos.map((c) => c.dataInicioSintomas).sort()
  const porEvolucao = contar(EVOLUCAO, casos.map((c) => c.evolucao))

  const agentesIdentificados = contar<Agente>(AGENTE, [])
  for (const caso of casos) for (const agente of caso.agentes) agentesIdentificados[agente]++

  return {
    totalCasos: casos.length,
    periodo: { primeiroInicioSintomas: datas[0] ?? null, ultimoInicioSintomas: datas.at(-1) ?? null },
    hospitalizados: casos.filter((c) => c.hospitalizado === 'sim').length,
    internadosUti: casos.filter((c) => c.uti === 'sim').length,
    obitosSrag: porEvolucao.obito,
    obitosOutrasCausas: porEvolucao.obito_outras_causas,
    casosEmAberto: porEvolucao.em_aberto,
    porClassificacao: contar(CLASSIFICACAO, casos.map((c) => c.classificacao)),
    porEvolucao,
    porSexo: contar(SEXO, casos.map((c) => c.sexo)),
    porFaixaEtaria: contar({ ...FAIXA_ETARIA, nao_informada: '' }, casos.map((c) => c.faixaEtaria ?? 'nao_informada')),
    suporteVentilatorio: contar(
      { ...SUPORTE_VENTILATORIO, nao_informado: '' },
      casos.map((c) => c.suporteVentilatorio ?? 'nao_informado'),
    ),
    agentesIdentificados,
  }
}
