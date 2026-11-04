import { randomUUID } from 'node:crypto'
import { MongoClient } from 'mongodb'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { mapearLinha } from '../src/modules/srag/srag.mapper'
import type { FonteAno } from '../src/modules/srag/srag.repository'
import type { CasoSrag } from '../src/modules/srag/srag.types'

export async function iniciarMongo() {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
  const uri = replSet.getUri()
  const client = await MongoClient.connect(uri)
  return {
    uri,
    client,
    novoBanco: () => client.db(`teste_${randomUUID().slice(0, 8)}`),
    async parar() {
      await client.close()
      await replSet.stop()
    },
  }
}

const CLASSIFICACOES = ['1', '2', '3', '4', '5', '']
const EVOLUCOES = ['1', '2', '3', '9', '']
const SEXOS = ['M', 'F', 'I']
const AGENTES = ['PCR_VSR', 'PCR_RINO', 'PCR_SARS2', 'PCR_ADENO']

export function gerarCasos(ano: number, quantidade: number, deslocamento = 0): CasoSrag[] {
  return Array.from({ length: quantidade }, (_, i) => {
    const n = i + deslocamento
    const dia = new Date(Date.UTC(ano, 0, 5 + ((n * 11) % 350)))
    const linha: Record<string, string> = {
      NU_NOTIFIC: String(ano * 100000 + n),
      DT_SIN_PRI: dia.toISOString(),
      CO_MUN_RES: '280350',
      ID_MN_RESI: 'LAGARTO',
      SG_UF: 'SE',
      CS_SEXO: SEXOS[n % SEXOS.length]!,
      NU_IDADE_N: String((n * 7) % 95),
      TP_IDADE: n % 9 === 0 ? '2' : '3',
      CLASSI_FIN: CLASSIFICACOES[n % CLASSIFICACOES.length]!,
      EVOLUCAO: EVOLUCOES[n % EVOLUCOES.length]!,
      HOSPITAL: n % 4 === 0 ? '' : '1',
      UTI: n % 3 === 0 ? '1' : '2',
      [AGENTES[n % AGENTES.length]!]: n % 2 === 0 ? '1' : '',
    }
    return mapearLinha(linha, ano)
  })
}

export function fonte(ano: number, totalCasos: number, arquivo = `INFLUD${String(ano).slice(2)}-02-11-2026.csv`): FonteAno {
  return {
    ano,
    arquivo,
    url: `https://exemplo/${arquivo}`,
    publicadoEm: '2026-11-02',
    importadoEm: new Date().toISOString(),
    linhasLidas: totalCasos * 1000,
    totalCasos,
    linhasDescartadas: 0,
  }
}
