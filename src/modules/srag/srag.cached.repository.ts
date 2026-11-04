import {
  InMemorySragRepository,
  type ExecucaoSincronizacao,
  type FiltroCasos,
  type FonteAno,
  type Paginacao,
  type SragRepository,
} from './srag.repository'
import type { CasoSrag } from './srag.types'

function assinatura(fontes: FonteAno[]): string {
  return JSON.stringify(fontes.map((f) => [f.ano, f.arquivo, f.importadoEm, f.totalCasos]))
}

export class CachedSragRepository implements SragRepository {
  private memoria = new InMemorySragRepository()
  private assinaturaAtual: string | null = null
  private verificadoEm = Number.NEGATIVE_INFINITY
  private atualizacao: Promise<void> | null = null

  constructor(
    private readonly origem: SragRepository,
    private readonly validadeMs: number,
    private readonly agora: () => number = Date.now,
  ) {}

  private atualizar(): Promise<void> {
    if (this.agora() - this.verificadoEm < this.validadeMs) return Promise.resolve()
    this.atualizacao ??= this.recarregarSeMudou().finally(() => {
      this.atualizacao = null
    })
    return this.atualizacao
  }

  private async recarregarSeMudou(): Promise<void> {
    const fontes = await this.origem.fontes()
    const nova = assinatura(fontes)
    if (nova !== this.assinaturaAtual) {
      const memoria = new InMemorySragRepository()
      const todos = await this.origem.listar({})
      for (const fonte of fontes) {
        await memoria.salvarAno(fonte, todos.filter((c) => c.ano === fonte.ano))
      }
      this.memoria = memoria
      this.assinaturaAtual = nova
    }
    this.verificadoEm = this.agora()
  }

  invalidar(): void {
    this.verificadoEm = Number.NEGATIVE_INFINITY
  }

  async salvarAno(fonte: FonteAno, casos: CasoSrag[]): Promise<void> {
    await this.origem.salvarAno(fonte, casos)
    this.invalidar()
  }

  async buscar(filtro: FiltroCasos, paginacao: Paginacao) {
    await this.atualizar()
    return this.memoria.buscar(filtro, paginacao)
  }

  async listar(filtro: FiltroCasos): Promise<CasoSrag[]> {
    await this.atualizar()
    return this.memoria.listar(filtro)
  }

  async buscarPorId(id: string): Promise<CasoSrag | null> {
    await this.atualizar()
    return this.memoria.buscarPorId(id)
  }

  async fontes(): Promise<FonteAno[]> {
    await this.atualizar()
    return this.memoria.fontes()
  }

  registrarSincronizacao(execucao: ExecucaoSincronizacao): Promise<void> {
    return this.origem.registrarSincronizacao(execucao)
  }

  sincronizacoes(limite: number): Promise<ExecucaoSincronizacao[]> {
    return this.origem.sincronizacoes(limite)
  }

  ultimoSucessoSincronizacao(): Promise<string | null> {
    return this.origem.ultimoSucessoSincronizacao()
  }
}
