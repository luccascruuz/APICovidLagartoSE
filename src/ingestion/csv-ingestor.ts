import { pipeline, type Readable } from 'node:stream'
import { parse } from 'csv-parse'
import { COLUNAS_OBRIGATORIAS, LinhaInvalidaError, mapearLinha } from '../modules/srag/srag.mapper'
import type { CasoSrag } from '../modules/srag/srag.types'

export interface ResultadoIngestao {
  casos: CasoSrag[]
  linhasLidas: number
  linhasDescartadas: number
}

export async function filtrarMunicipio(
  entrada: Readable,
  opcoes: { codigoIbge: string; anoArquivo: number; aoProgredir?: (linhasLidas: number) => void },
): Promise<ResultadoIngestao> {
  const parser = parse({
    delimiter: ';',
    bom: true,
    relax_column_count: true,
    relax_quotes: true,
    trim: true,
  })
  pipeline(entrada, parser, () => undefined)

  let cabecalho: string[] | null = null
  let indiceMunicipio = -1
  const casos: CasoSrag[] = []
  let linhasLidas = 0
  let linhasDescartadas = 0

  try {
    for await (const registro of parser as AsyncIterable<string[]>) {
      if (!cabecalho) {
        cabecalho = registro.map((c) => c.toUpperCase())
        const faltando = COLUNAS_OBRIGATORIAS.filter((c) => !cabecalho!.includes(c))
        if (faltando.length) throw new Error(`CSV sem as colunas obrigatórias: ${faltando.join(', ')}`)
        indiceMunicipio = cabecalho.indexOf('CO_MUN_RES')
        continue
      }

      linhasLidas++
      if (opcoes.aoProgredir && linhasLidas % 100_000 === 0) opcoes.aoProgredir(linhasLidas)

      if (registro[indiceMunicipio] !== opcoes.codigoIbge) continue

      const linha: Record<string, string> = {}
      cabecalho.forEach((coluna, i) => {
        linha[coluna] = registro[i] ?? ''
      })

      try {
        casos.push(mapearLinha(linha, opcoes.anoArquivo))
      } catch (erro) {
        if (!(erro instanceof LinhaInvalidaError)) throw erro
        linhasDescartadas++
      }
    }
  } finally {
    entrada.destroy()
  }

  if (!cabecalho) throw new Error('CSV vazio')
  return { casos, linhasLidas, linhasDescartadas }
}
