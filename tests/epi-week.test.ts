import { describe, expect, it } from 'vitest'
import { intervaloDaSemana, semanaEpidemiologica, semanasNoAno } from '../src/shared/epi-week'

describe('semana epidemiológica', () => {
  it.each([
    ['2026-01-04', 2026, 1],
    ['2026-01-10', 2026, 1],
    ['2026-01-03', 2025, 53],
    ['2025-12-28', 2025, 53],
    ['2026-02-28', 2026, 8],
    ['2025-03-13', 2025, 11],
    ['2024-08-28', 2024, 35],
    ['2019-01-01', 2019, 1],
    ['2018-12-30', 2019, 1],
    ['2021-01-03', 2021, 1],
    ['2022-01-01', 2021, 52],
    ['2022-01-02', 2022, 1],
    ['2023-01-01', 2023, 1],
  ])('%s → SE %s/%s', (data, ano, semana) => {
    expect(semanaEpidemiologica(data)).toEqual({ ano, semana })
  })

  it('calcula o intervalo de domingo a sábado', () => {
    expect(intervaloDaSemana(2026, 1)).toEqual({ inicio: '2026-01-04', fim: '2026-01-10' })
    expect(intervaloDaSemana(2025, 53)).toEqual({ inicio: '2025-12-28', fim: '2026-01-03' })
  })

  it('sabe quantas semanas tem o ano', () => {
    expect(semanasNoAno(2025)).toBe(53)
    expect(semanasNoAno(2026)).toBe(52)
    expect(semanasNoAno(2020)).toBe(53)
  })

  it('rejeita data inválida', () => {
    expect(() => semanaEpidemiologica('2026-13-01')).toThrow()
  })
})
