import { describe, expect, it } from 'vitest'
import { parseAnos } from '../src/config/env'

describe('parseAnos', () => {
  it('vazio = ano atual e anterior', () => {
    expect(parseAnos('', 2026)).toEqual([2025, 2026])
    expect(parseAnos(undefined, 2026)).toEqual([2025, 2026])
  })

  it('aceita lista e intervalos', () => {
    expect(parseAnos('2019-2021,2026', 2026)).toEqual([2019, 2020, 2021, 2026])
    expect(parseAnos(' 2025 , 2024 ', 2026)).toEqual([2024, 2025])
  })

  it('rejeita anos fora do SIVEP-Gripe ou mal formatados', () => {
    expect(() => parseAnos('2018', 2026)).toThrow()
    expect(() => parseAnos('2027', 2026)).toThrow()
    expect(() => parseAnos('2026-2024', 2026)).toThrow()
    expect(() => parseAnos('vinte', 2026)).toThrow()
  })
})
