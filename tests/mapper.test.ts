import { describe, expect, it } from 'vitest'
import { LinhaInvalidaError, faixaEtaria, mapearLinha, parseData } from '../src/modules/srag/srag.mapper'

describe('parseData', () => {
  it('aceita os formatos usados pelo SIVEP-Gripe', () => {
    expect(parseData('2026-01-09T00:00:00.000Z')).toBe('2026-01-09')
    expect(parseData('2026-01-09')).toBe('2026-01-09')
    expect(parseData('09/01/2026')).toBe('2026-01-09')
  })

  it('rejeita vazio e datas impossíveis', () => {
    expect(parseData('')).toBeNull()
    expect(parseData('2026-02-31')).toBeNull()
    expect(parseData('abc')).toBeNull()
  })
})

describe('faixaEtaria', () => {
  it.each([
    [0, 'menor_1'],
    [4, '1_4'],
    [5, '5_9'],
    [19, '10_19'],
    [79, '70_79'],
    [80, '80_mais'],
    [null, null],
  ] as const)('%s anos → %s', (idade, faixa) => {
    expect(faixaEtaria(idade)).toBe(faixa)
  })
})

describe('mapearLinha', () => {
  const base = {
    NU_NOTIFIC: '123',
    DT_SIN_PRI: '2026-06-22T00:00:00.000Z',
    SEM_PRI: '26',
    CO_MUN_RES: '280350',
    ID_MN_RESI: 'LAGARTO',
    SG_UF: 'SE',
  }

  it('converte códigos para valores legíveis', () => {
    const caso = mapearLinha(
      {
        ...base,
        CS_SEXO: 'F',
        NU_IDADE_N: '8',
        TP_IDADE: '2',
        CLASSI_FIN: '5',
        EVOLUCAO: '2',
        UTI: '1',
        SUPORT_VEN: '1',
        PCR_SARS2: '1',
        ASMA: '1',
        TOSSE: '1',
        CS_GESTANT: '5',
      },
      2026,
    )
    expect(caso).toMatchObject({
      id: '123',
      ano: 2026,
      dataInicioSintomas: '2026-06-22',
      sexo: 'feminino',
      idade: { valor: 8, unidade: 'meses' },
      idadeAnos: 0,
      faixaEtaria: 'menor_1',
      classificacao: 'covid19',
      evolucao: 'obito',
      uti: 'sim',
      suporteVentilatorio: 'invasivo',
      agentes: ['covid19'],
      comorbidades: ['asma'],
      sintomas: ['tosse'],
      gestante: false,
    })
  })

  it('calcula a semana pela data, ignorando o SEM_PRI adiantado do arquivo de 2026', () => {
    expect(mapearLinha(base, 2026).semanaEpidemiologica).toBe(25)
  })

  it('marca campos vazios como em investigação / em aberto / null', () => {
    const caso = mapearLinha(base, 2026)
    expect(caso.classificacao).toBe('em_investigacao')
    expect(caso.evolucao).toBe('em_aberto')
    expect(caso.uti).toBeNull()
    expect(caso.idade).toBeNull()
    expect(caso.sexo).toBe('ignorado')
    expect(caso.municipioInternacao).toBeNull()
  })

  it('entende os códigos gravados como decimal nos arquivos de 2019 e 2020', () => {
    const caso = mapearLinha({ ...base, CLASSI_FIN: '5.0', EVOLUCAO: '2.0', PCR_SARS2: '1.0', UTI: '1', CS_SEXO: 'F' }, 2020)
    expect(caso).toMatchObject({ classificacao: 'covid19', evolucao: 'obito', agentes: ['covid19'], uti: 'sim' })
    expect(mapearLinha({ ...base, EVOLUCAO: '1.0', AN_SARS2: '1.0', CLASSI_FIN: '4.00' }, 2019)).toMatchObject({
      evolucao: 'cura',
      agentes: ['covid19'],
      classificacao: 'nao_especificado',
    })
  })

  it('não altera textos e datas ao normalizar decimais', () => {
    const caso = mapearLinha({ ...base, ID_MN_RESI: 'LAGARTO', DT_NOTIFIC: '2020-05-01T00:00:00.000Z' }, 2020)
    expect(caso.municipioResidencia.nome).toBe('LAGARTO')
    expect(caso.dataNotificacao).toBe('2020-05-01')
  })

  it('identifica tipos de influenza por RT-PCR e antígeno', () => {
    expect(mapearLinha({ ...base, POS_PCRFLU: '1', TP_FLU_PCR: '2' }, 2026).agentes).toEqual(['influenza_b'])
    expect(mapearLinha({ ...base, POS_AN_FLU: '1', TP_FLU_AN: '1' }, 2026).agentes).toEqual(['influenza_a'])
    expect(mapearLinha({ ...base, POS_PCRFLU: '1' }, 2026).agentes).toEqual(['influenza_nao_tipado'])
  })

  it('não expõe dados que identificam o paciente', () => {
    const caso = mapearLinha({ ...base, DT_NASC: '01/01/1990', PAC_DSCBO: 'PROFESSOR', OUTRO_DES: 'texto livre' }, 2026)
    const json = JSON.stringify(caso)
    expect(json).not.toContain('1990')
    expect(json).not.toContain('PROFESSOR')
    expect(json).not.toContain('texto livre')
  })

  it('rejeita linha sem id ou sem data de sintomas', () => {
    expect(() => mapearLinha({ ...base, NU_NOTIFIC: '' }, 2026)).toThrow(LinhaInvalidaError)
    expect(() => mapearLinha({ ...base, DT_SIN_PRI: '' }, 2026)).toThrow(LinhaInvalidaError)
  })
})
