import type { Collection, Db, Filter, MongoClient } from 'mongodb'
import {
  removerDuplicados,
  type ExecucaoSincronizacao,
  type FiltroCasos,
  type FonteAno,
  type Paginacao,
  type SragRepository,
} from './srag.repository'
import type { CasoSrag } from './srag.types'

type DocumentoFonte = FonteAno & { _id: number }

export const COLECOES = {
  casos: 'casos',
  fontes: 'fontes',
  sincronizacoes: 'sincronizacoes',
} as const

const SEM_ID = { projection: { _id: 0 } } as const

export function filtroMongo(f: FiltroCasos): Filter<CasoSrag> {
  const filtro: Filter<CasoSrag> = {}
  if (f.anos?.length) filtro.ano = { $in: f.anos }
  if (f.semanaInicio !== undefined || f.semanaFim !== undefined) {
    filtro.semanaEpidemiologica = {
      ...(f.semanaInicio !== undefined ? { $gte: f.semanaInicio } : {}),
      ...(f.semanaFim !== undefined ? { $lte: f.semanaFim } : {}),
    }
  }
  if (f.dataInicio || f.dataFim) {
    filtro.dataInicioSintomas = {
      ...(f.dataInicio ? { $gte: f.dataInicio } : {}),
      ...(f.dataFim ? { $lte: f.dataFim } : {}),
    }
  }
  if (f.classificacao?.length) filtro.classificacao = { $in: f.classificacao }
  if (f.evolucao?.length) filtro.evolucao = { $in: f.evolucao }
  if (f.sexo?.length) filtro.sexo = { $in: f.sexo }
  if (f.faixaEtaria?.length) filtro.faixaEtaria = { $in: f.faixaEtaria }
  if (f.hospitalizado) filtro.hospitalizado = f.hospitalizado
  if (f.uti) filtro.uti = f.uti
  if (f.agente?.length) filtro.agentes = { $in: f.agente }
  return filtro
}

export class MongoSragRepository implements SragRepository {
  private readonly casos: Collection<CasoSrag>
  private readonly colecaoFontes: Collection<DocumentoFonte>
  private readonly colecaoSincronizacoes: Collection<ExecucaoSincronizacao>
  private indices: Promise<void> | null = null

  constructor(
    private readonly client: MongoClient,
    db: Db,
  ) {
    this.casos = db.collection<CasoSrag>(COLECOES.casos)
    this.colecaoFontes = db.collection<DocumentoFonte>(COLECOES.fontes)
    this.colecaoSincronizacoes = db.collection<ExecucaoSincronizacao>(COLECOES.sincronizacoes)
  }

  garantirIndices(): Promise<void> {
    this.indices ??= (async () => {
      await this.casos.createIndexes([
        { key: { ano: 1, id: 1 }, name: 'ano_id', unique: true },
        { key: { id: 1 }, name: 'id' },
        { key: { ano: 1, dataInicioSintomas: 1, id: 1 }, name: 'ordem_padrao' },
        { key: { ano: 1, semanaEpidemiologica: 1 }, name: 'ano_semana' },
        { key: { classificacao: 1 }, name: 'classificacao' },
        { key: { evolucao: 1 }, name: 'evolucao' },
      ])
      await this.colecaoSincronizacoes.createIndex({ finalizadaEm: -1 }, { name: 'finalizada_em' })
    })().catch((erro: unknown) => {
      this.indices = null
      throw erro
    })
    return this.indices
  }

  async salvarAno(fonte: FonteAno, casos: CasoSrag[]): Promise<void> {
    await this.garantirIndices()
    const unicos = removerDuplicados(casos)
    const sessao = this.client.startSession()
    try {
      await sessao.withTransaction(async () => {
        await this.casos.deleteMany({ ano: fonte.ano }, { session: sessao })
        if (unicos.length) await this.casos.insertMany(unicos.map((c) => ({ ...c })), { session: sessao })
        await this.colecaoFontes.replaceOne(
          { _id: fonte.ano },
          { ...fonte, totalCasos: unicos.length },
          { upsert: true, session: sessao },
        )
      })
    } finally {
      await sessao.endSession()
    }
  }

  async listar(filtro: FiltroCasos): Promise<CasoSrag[]> {
    return this.casos.find(filtroMongo(filtro), SEM_ID).sort({ ano: 1, dataInicioSintomas: 1, id: 1 }).toArray()
  }

  async buscar(filtro: FiltroCasos, { pagina, limite, ordem }: Paginacao) {
    const consulta = filtroMongo(filtro)
    const direcao = ordem === 'asc' ? 1 : -1
    const [itens, total] = await Promise.all([
      this.casos
        .find(consulta, SEM_ID)
        .sort({ ano: direcao, dataInicioSintomas: direcao, id: direcao })
        .skip((pagina - 1) * limite)
        .limit(limite)
        .toArray(),
      this.casos.countDocuments(consulta),
    ])
    return { itens, total }
  }

  async buscarPorId(id: string): Promise<CasoSrag | null> {
    return this.casos.findOne({ id }, { ...SEM_ID, sort: { ano: 1 } })
  }

  async fontes(): Promise<FonteAno[]> {
    const documentos = await this.colecaoFontes.find({}, SEM_ID).sort({ ano: 1 }).toArray()
    return documentos as FonteAno[]
  }

  async registrarSincronizacao(execucao: ExecucaoSincronizacao): Promise<void> {
    await this.garantirIndices()
    await this.colecaoSincronizacoes.insertOne({ ...execucao })
  }

  async sincronizacoes(limite: number): Promise<ExecucaoSincronizacao[]> {
    return this.colecaoSincronizacoes.find({}, SEM_ID).sort({ finalizadaEm: -1 }).limit(limite).toArray()
  }

  async ultimoSucessoSincronizacao(): Promise<string | null> {
    const execucao = await this.colecaoSincronizacoes.findOne(
      { sucesso: true },
      { projection: { _id: 0, finalizadaEm: 1 }, sort: { finalizadaEm: -1 } },
    )
    return execucao?.finalizadaEm ?? null
  }
}
