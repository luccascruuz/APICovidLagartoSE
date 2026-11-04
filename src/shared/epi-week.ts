const DIA_MS = 24 * 60 * 60 * 1000

function paraData(iso: string): Date {
  const data = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(data.getTime())) throw new Error(`Data inválida: ${iso}`)
  return data
}

function paraIso(data: Date): string {
  return data.toISOString().slice(0, 10)
}

function domingoDaSemana(data: Date): Date {
  return new Date(data.getTime() - data.getUTCDay() * DIA_MS)
}

function inicioDoAnoEpidemiologico(ano: number): Date {
  return domingoDaSemana(new Date(Date.UTC(ano, 0, 4)))
}

export interface SemanaEpidemiologica {
  ano: number
  semana: number
}

export function semanaEpidemiologica(iso: string): SemanaEpidemiologica {
  const inicioSemana = domingoDaSemana(paraData(iso))
  const ano = new Date(inicioSemana.getTime() + 3 * DIA_MS).getUTCFullYear()
  const semana = Math.round((inicioSemana.getTime() - inicioDoAnoEpidemiologico(ano).getTime()) / (7 * DIA_MS)) + 1
  return { ano, semana }
}

export function intervaloDaSemana(ano: number, semana: number): { inicio: string; fim: string } {
  const inicio = new Date(inicioDoAnoEpidemiologico(ano).getTime() + (semana - 1) * 7 * DIA_MS)
  return { inicio: paraIso(inicio), fim: paraIso(new Date(inicio.getTime() + 6 * DIA_MS)) }
}

export function semanasNoAno(ano: number): number {
  const diff = inicioDoAnoEpidemiologico(ano + 1).getTime() - inicioDoAnoEpidemiologico(ano).getTime()
  return Math.round(diff / (7 * DIA_MS))
}
