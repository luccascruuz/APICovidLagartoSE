type Mapa = Readonly<Record<string, string>>

function rotulos<const T extends Record<string, string>>(r: T) {
  return r
}

export const CLASSIFICACAO = rotulos({
  influenza: 'SRAG por influenza',
  outro_virus: 'SRAG por outro vírus respiratório',
  outro_agente: 'SRAG por outro agente etiológico',
  nao_especificado: 'SRAG não especificado',
  covid19: 'SRAG por covid-19',
  em_investigacao: 'Em investigação (classificação final não preenchida)',
})
export const CLASSIFICACAO_CODIGOS: Mapa = {
  '1': 'influenza',
  '2': 'outro_virus',
  '3': 'outro_agente',
  '4': 'nao_especificado',
  '5': 'covid19',
}

export const EVOLUCAO = rotulos({
  cura: 'Cura',
  obito: 'Óbito por SRAG',
  obito_outras_causas: 'Óbito por outras causas',
  ignorado: 'Ignorado',
  em_aberto: 'Em aberto (evolução não preenchida)',
})
export const EVOLUCAO_CODIGOS: Mapa = { '1': 'cura', '2': 'obito', '3': 'obito_outras_causas', '9': 'ignorado' }

export const CRITERIO = rotulos({
  laboratorial: 'Laboratorial',
  clinico_epidemiologico: 'Clínico-epidemiológico',
  clinico: 'Clínico',
  clinico_imagem: 'Clínico-imagem',
})
export const CRITERIO_CODIGOS: Mapa = {
  '1': 'laboratorial',
  '2': 'clinico_epidemiologico',
  '3': 'clinico',
  '4': 'clinico_imagem',
}

export const SIM_NAO = rotulos({ sim: 'Sim', nao: 'Não', ignorado: 'Ignorado' })
export const SIM_NAO_CODIGOS: Mapa = { '1': 'sim', '2': 'nao', '9': 'ignorado' }

export const SUPORTE_VENTILATORIO = rotulos({
  invasivo: 'Sim, invasivo',
  nao_invasivo: 'Sim, não invasivo',
  nao: 'Não',
  ignorado: 'Ignorado',
})
export const SUPORTE_VENTILATORIO_CODIGOS: Mapa = { '1': 'invasivo', '2': 'nao_invasivo', '3': 'nao', '9': 'ignorado' }

export const RESULTADO_PCR = rotulos({
  detectavel: 'Detectável',
  nao_detectavel: 'Não detectável',
  inconclusivo: 'Inconclusivo',
  nao_realizado: 'Não realizado',
  aguardando: 'Aguardando resultado',
  ignorado: 'Ignorado',
})
export const RESULTADO_PCR_CODIGOS: Mapa = {
  '1': 'detectavel',
  '2': 'nao_detectavel',
  '3': 'inconclusivo',
  '4': 'nao_realizado',
  '5': 'aguardando',
  '9': 'ignorado',
}

export const SEXO = rotulos({ masculino: 'Masculino', feminino: 'Feminino', ignorado: 'Ignorado' })
export const SEXO_CODIGOS: Mapa = { M: 'masculino', F: 'feminino', I: 'ignorado', '1': 'masculino', '2': 'feminino', '9': 'ignorado' }

export const RACA_COR = rotulos({
  branca: 'Branca',
  preta: 'Preta',
  amarela: 'Amarela',
  parda: 'Parda',
  indigena: 'Indígena',
  ignorado: 'Ignorado',
})
export const RACA_COR_CODIGOS: Mapa = { '1': 'branca', '2': 'preta', '3': 'amarela', '4': 'parda', '5': 'indigena', '9': 'ignorado' }

export const ZONA = rotulos({ urbana: 'Urbana', rural: 'Rural', periurbana: 'Periurbana', ignorado: 'Ignorado' })
export const ZONA_CODIGOS: Mapa = { '1': 'urbana', '2': 'rural', '3': 'periurbana', '9': 'ignorado' }

export const UNIDADE_IDADE_CODIGOS: Mapa = { '1': 'dias', '2': 'meses', '3': 'anos' }

export const FAIXA_ETARIA = rotulos({
  menor_1: 'Menor de 1 ano',
  '1_4': '1 a 4 anos',
  '5_9': '5 a 9 anos',
  '10_19': '10 a 19 anos',
  '20_29': '20 a 29 anos',
  '30_39': '30 a 39 anos',
  '40_49': '40 a 49 anos',
  '50_59': '50 a 59 anos',
  '60_69': '60 a 69 anos',
  '70_79': '70 a 79 anos',
  '80_mais': '80 anos ou mais',
})

export const AGENTE = rotulos({
  covid19: 'SARS-CoV-2 (covid-19)',
  influenza_a: 'Influenza A',
  influenza_b: 'Influenza B',
  influenza_nao_tipado: 'Influenza (tipo não informado)',
  vsr: 'Vírus sincicial respiratório (VSR)',
  rinovirus: 'Rinovírus',
  adenovirus: 'Adenovírus',
  metapneumovirus: 'Metapneumovírus',
  bocavirus: 'Bocavírus',
  parainfluenza_1: 'Parainfluenza 1',
  parainfluenza_2: 'Parainfluenza 2',
  parainfluenza_3: 'Parainfluenza 3',
  parainfluenza_4: 'Parainfluenza 4',
  outro: 'Outro vírus respiratório',
})

export const COMORBIDADE = rotulos({
  puerpera: 'Puérpera',
  cardiopatia: 'Doença cardiovascular crônica',
  hematologica: 'Doença hematológica crônica',
  sindrome_down: 'Síndrome de Down',
  hepatica: 'Doença hepática crônica',
  asma: 'Asma',
  diabetes: 'Diabetes mellitus',
  neurologica: 'Doença neurológica crônica',
  pneumopatia: 'Outra pneumopatia crônica',
  imunodeficiencia: 'Imunodeficiência/imunodepressão',
  renal: 'Doença renal crônica',
  obesidade: 'Obesidade',
})
export const COMORBIDADE_COLUNAS: Readonly<Record<string, keyof typeof COMORBIDADE>> = {
  PUERPERA: 'puerpera',
  CARDIOPATI: 'cardiopatia',
  HEMATOLOGI: 'hematologica',
  SIND_DOWN: 'sindrome_down',
  HEPATICA: 'hepatica',
  ASMA: 'asma',
  DIABETES: 'diabetes',
  NEUROLOGIC: 'neurologica',
  PNEUMOPATI: 'pneumopatia',
  IMUNODEPRE: 'imunodeficiencia',
  RENAL: 'renal',
  OBESIDADE: 'obesidade',
}

export const SINTOMA = rotulos({
  febre: 'Febre',
  tosse: 'Tosse',
  dor_garganta: 'Dor de garganta',
  dispneia: 'Dispneia',
  desconforto_respiratorio: 'Desconforto respiratório',
  saturacao_baixa: 'Saturação O2 < 95%',
  diarreia: 'Diarreia',
  vomito: 'Vômito',
  dor_abdominal: 'Dor abdominal',
  fadiga: 'Fadiga',
  perda_olfato: 'Perda do olfato',
  perda_paladar: 'Perda do paladar',
})
export const SINTOMA_COLUNAS: Readonly<Record<string, keyof typeof SINTOMA>> = {
  FEBRE: 'febre',
  TOSSE: 'tosse',
  GARGANTA: 'dor_garganta',
  DISPNEIA: 'dispneia',
  DESC_RESP: 'desconforto_respiratorio',
  SATURACAO: 'saturacao_baixa',
  DIARREIA: 'diarreia',
  VOMITO: 'vomito',
  DOR_ABD: 'dor_abdominal',
  FADIGA: 'fadiga',
  PERD_OLFT: 'perda_olfato',
  PERD_PALA: 'perda_paladar',
}

export const DICIONARIO = {
  classificacao: CLASSIFICACAO,
  evolucao: EVOLUCAO,
  criterio: CRITERIO,
  simNao: SIM_NAO,
  suporteVentilatorio: SUPORTE_VENTILATORIO,
  resultadoPcr: RESULTADO_PCR,
  sexo: SEXO,
  racaCor: RACA_COR,
  zona: ZONA,
  faixaEtaria: FAIXA_ETARIA,
  agente: AGENTE,
  comorbidade: COMORBIDADE,
  sintoma: SINTOMA,
} as const

export type Classificacao = keyof typeof CLASSIFICACAO
export type Evolucao = keyof typeof EVOLUCAO
export type Criterio = keyof typeof CRITERIO
export type SimNao = keyof typeof SIM_NAO
export type SuporteVentilatorio = keyof typeof SUPORTE_VENTILATORIO
export type ResultadoPcr = keyof typeof RESULTADO_PCR
export type Sexo = keyof typeof SEXO
export type RacaCor = keyof typeof RACA_COR
export type Zona = keyof typeof ZONA
export type FaixaEtaria = keyof typeof FAIXA_ETARIA
export type Agente = keyof typeof AGENTE
export type Comorbidade = keyof typeof COMORBIDADE
export type Sintoma = keyof typeof SINTOMA

export const chaves = <T extends Record<string, string>>(r: T) => Object.keys(r) as [keyof T & string, ...(keyof T & string)[]]
