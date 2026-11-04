import { semanaEpidemiologica } from '../../shared/epi-week'
import {
  CLASSIFICACAO_CODIGOS,
  COMORBIDADE_COLUNAS,
  CRITERIO_CODIGOS,
  EVOLUCAO_CODIGOS,
  RACA_COR_CODIGOS,
  RESULTADO_PCR_CODIGOS,
  SEXO_CODIGOS,
  SIM_NAO_CODIGOS,
  SINTOMA_COLUNAS,
  SUPORTE_VENTILATORIO_CODIGOS,
  UNIDADE_IDADE_CODIGOS,
  ZONA_CODIGOS,
  type Agente,
  type Classificacao,
  type Comorbidade,
  type Criterio,
  type Evolucao,
  type FaixaEtaria,
  type RacaCor,
  type ResultadoPcr,
  type Sexo,
  type SimNao,
  type Sintoma,
  type SuporteVentilatorio,
  type Zona,
} from './srag.codes'
import type { CasoSrag, Municipio } from './srag.types'

export type LinhaSivep = Readonly<Record<string, string | undefined>>

export const COLUNAS_OBRIGATORIAS = ['NU_NOTIFIC', 'DT_SIN_PRI', 'CO_MUN_RES'] as const

export class LinhaInvalidaError extends Error {}

function texto(linha: LinhaSivep, coluna: string): string {
  return (linha[coluna] ?? '').trim()
}

function codigo<T extends string>(mapa: Readonly<Record<string, string>>, valor: string): T | null {
  return (mapa[valor] as T | undefined) ?? null
}

export function parseData(valor: string): string | null {
  if (!valor) return null
  const iso = valor.match(/^(\d{4})-(\d{2})-(\d{2})/)
  const br = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  const [ano, mes, dia] = iso ? [iso[1], iso[2], iso[3]] : br ? [br[3], br[2], br[1]] : []
  if (!ano || !mes || !dia) return null

  const data = `${ano}-${mes}-${dia}`
  const conferencia = new Date(`${data}T00:00:00Z`)
  if (Number.isNaN(conferencia.getTime()) || conferencia.toISOString().slice(0, 10) !== data) return null
  return data
}

function inteiro(valor: string): number | null {
  if (!/^\d+$/.test(valor)) return null
  return Number(valor)
}

function municipio(linha: LinhaSivep, colunaCodigo: string, colunaNome: string): Municipio | null {
  const codigoIbge = texto(linha, colunaCodigo)
  if (!codigoIbge) return null
  return { codigoIbge, nome: texto(linha, colunaNome) }
}

function marcados<T extends string>(linha: LinhaSivep, colunas: Readonly<Record<string, T>>): T[] {
  return Object.entries(colunas)
    .filter(([coluna]) => texto(linha, coluna) === '1')
    .map(([, chave]) => chave)
}

export function faixaEtaria(idadeAnos: number | null): FaixaEtaria | null {
  if (idadeAnos === null) return null
  if (idadeAnos < 1) return 'menor_1'
  if (idadeAnos < 5) return '1_4'
  if (idadeAnos < 10) return '5_9'
  if (idadeAnos < 20) return '10_19'
  if (idadeAnos < 30) return '20_29'
  if (idadeAnos < 40) return '30_39'
  if (idadeAnos < 50) return '40_49'
  if (idadeAnos < 60) return '50_59'
  if (idadeAnos < 70) return '60_69'
  if (idadeAnos < 80) return '70_79'
  return '80_mais'
}

function idade(linha: LinhaSivep): CasoSrag['idade'] {
  const valor = inteiro(texto(linha, 'NU_IDADE_N'))
  const unidade = codigo<'dias' | 'meses' | 'anos'>(UNIDADE_IDADE_CODIGOS, texto(linha, 'TP_IDADE'))
  if (valor === null || unidade === null || valor > 150) return null
  return { valor, unidade }
}

function gestante(valor: string): boolean | null {
  if (['1', '2', '3', '4'].includes(valor)) return true
  if (['5', '6'].includes(valor)) return false
  return null
}

function agentes(linha: LinhaSivep): Agente[] {
  const positivo = (...colunas: string[]) => colunas.some((c) => texto(linha, c) === '1')
  const encontrados = new Set<Agente>()

  const fluPcr = texto(linha, 'POS_PCRFLU') === '1'
  const fluAntigeno = texto(linha, 'POS_AN_FLU') === '1'
  const tipos = [fluPcr ? texto(linha, 'TP_FLU_PCR') : '', fluAntigeno ? texto(linha, 'TP_FLU_AN') : '']
  if (tipos.includes('1')) encontrados.add('influenza_a')
  if (tipos.includes('2')) encontrados.add('influenza_b')
  if ((fluPcr || fluAntigeno) && !tipos.includes('1') && !tipos.includes('2')) encontrados.add('influenza_nao_tipado')

  if (positivo('PCR_SARS2', 'AN_SARS2')) encontrados.add('covid19')
  if (positivo('PCR_VSR', 'AN_VSR')) encontrados.add('vsr')
  if (positivo('PCR_RINO')) encontrados.add('rinovirus')
  if (positivo('PCR_ADENO', 'AN_ADENO')) encontrados.add('adenovirus')
  if (positivo('PCR_METAP')) encontrados.add('metapneumovirus')
  if (positivo('PCR_BOCA')) encontrados.add('bocavirus')
  if (positivo('PCR_PARA1', 'AN_PARA1')) encontrados.add('parainfluenza_1')
  if (positivo('PCR_PARA2', 'AN_PARA2')) encontrados.add('parainfluenza_2')
  if (positivo('PCR_PARA3', 'AN_PARA3')) encontrados.add('parainfluenza_3')
  if (positivo('PCR_PARA4')) encontrados.add('parainfluenza_4')
  if (positivo('PCR_OUTRO', 'AN_OUTRO')) encontrados.add('outro')

  return [...encontrados]
}

export function mapearLinha(linha: LinhaSivep, anoArquivo: number): CasoSrag {
  const id = texto(linha, 'NU_NOTIFIC')
  const dataInicioSintomas = parseData(texto(linha, 'DT_SIN_PRI'))
  if (!id) throw new LinhaInvalidaError('NU_NOTIFIC vazio')
  if (!dataInicioSintomas) throw new LinhaInvalidaError(`DT_SIN_PRI inválida na notificação ${id}`)

  const semana = semanaEpidemiologica(dataInicioSintomas).semana
  const dataNotificacao = parseData(texto(linha, 'DT_NOTIFIC'))

  const idade_ = idade(linha)
  const idadeAnos = idade_ === null ? null : idade_.unidade === 'anos' ? idade_.valor : 0

  return {
    id,
    ano: anoArquivo,
    semanaEpidemiologica: semana,
    dataInicioSintomas,
    dataNotificacao,
    semanaNotificacao: dataNotificacao ? semanaEpidemiologica(dataNotificacao).semana : null,
    dataDigitacao: parseData(texto(linha, 'DT_DIGITA')),

    municipioResidencia: {
      codigoIbge: texto(linha, 'CO_MUN_RES'),
      nome: texto(linha, 'ID_MN_RESI'),
      uf: texto(linha, 'SG_UF'),
    },
    municipioNotificacao: municipio(linha, 'CO_MUN_NOT', 'ID_MUNICIP'),
    municipioInternacao: municipio(linha, 'CO_MU_INTE', 'ID_MN_INTE'),
    zona: codigo<Zona>(ZONA_CODIGOS, texto(linha, 'CS_ZONA')),

    sexo: codigo<Sexo>(SEXO_CODIGOS, texto(linha, 'CS_SEXO')) ?? 'ignorado',
    idade: idade_,
    idadeAnos,
    faixaEtaria: faixaEtaria(idadeAnos),
    racaCor: codigo<RacaCor>(RACA_COR_CODIGOS, texto(linha, 'CS_RACA')),
    gestante: gestante(texto(linha, 'CS_GESTANT')),

    sintomas: marcados<Sintoma>(linha, SINTOMA_COLUNAS),
    fatorRisco: codigo<SimNao>(SIM_NAO_CODIGOS, texto(linha, 'FATOR_RISC')),
    comorbidades: marcados<Comorbidade>(linha, COMORBIDADE_COLUNAS),
    vacinaGripe: codigo<SimNao>(SIM_NAO_CODIGOS, texto(linha, 'VACINA')),
    vacinaCovid: codigo<SimNao>(SIM_NAO_CODIGOS, texto(linha, 'VACINA_COV')),

    hospitalizado: codigo<SimNao>(SIM_NAO_CODIGOS, texto(linha, 'HOSPITAL')),
    dataInternacao: parseData(texto(linha, 'DT_INTERNA')),
    uti: codigo<SimNao>(SIM_NAO_CODIGOS, texto(linha, 'UTI')),
    dataEntradaUti: parseData(texto(linha, 'DT_ENTUTI')),
    dataSaidaUti: parseData(texto(linha, 'DT_SAIDUTI')),
    suporteVentilatorio: codigo<SuporteVentilatorio>(SUPORTE_VENTILATORIO_CODIGOS, texto(linha, 'SUPORT_VEN')),

    resultadoPcr: codigo<ResultadoPcr>(RESULTADO_PCR_CODIGOS, texto(linha, 'PCR_RESUL')),
    agentes: agentes(linha),
    classificacao: codigo<Classificacao>(CLASSIFICACAO_CODIGOS, texto(linha, 'CLASSI_FIN')) ?? 'em_investigacao',
    criterio: codigo<Criterio>(CRITERIO_CODIGOS, texto(linha, 'CRITERIO')),
    evolucao: codigo<Evolucao>(EVOLUCAO_CODIGOS, texto(linha, 'EVOLUCAO')) ?? 'em_aberto',
    dataEvolucao: parseData(texto(linha, 'DT_EVOLUCA')),
    dataEncerramento: parseData(texto(linha, 'DT_ENCERRA')),
  }
}
