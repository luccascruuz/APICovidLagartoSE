import type {
  Agente,
  Classificacao,
  Comorbidade,
  Criterio,
  Evolucao,
  FaixaEtaria,
  RacaCor,
  ResultadoPcr,
  Sexo,
  SimNao,
  Sintoma,
  SuporteVentilatorio,
  Zona,
} from './srag.codes'

export interface Municipio {
  codigoIbge: string
  nome: string
}

export interface CasoSrag {
  id: string
  ano: number
  semanaEpidemiologica: number
  dataInicioSintomas: string
  dataNotificacao: string | null
  semanaNotificacao: number | null
  dataDigitacao: string | null

  municipioResidencia: Municipio & { uf: string }
  municipioNotificacao: Municipio | null
  municipioInternacao: Municipio | null
  zona: Zona | null

  sexo: Sexo
  idade: { valor: number; unidade: 'dias' | 'meses' | 'anos' } | null
  idadeAnos: number | null
  faixaEtaria: FaixaEtaria | null
  racaCor: RacaCor | null
  gestante: boolean | null

  sintomas: Sintoma[]
  fatorRisco: SimNao | null
  comorbidades: Comorbidade[]
  vacinaGripe: SimNao | null
  vacinaCovid: SimNao | null

  hospitalizado: SimNao | null
  dataInternacao: string | null
  uti: SimNao | null
  dataEntradaUti: string | null
  dataSaidaUti: string | null
  suporteVentilatorio: SuporteVentilatorio | null

  resultadoPcr: ResultadoPcr | null
  agentes: Agente[]
  classificacao: Classificacao
  criterio: Criterio | null
  evolucao: Evolucao
  dataEvolucao: string | null
  dataEncerramento: string | null
}
