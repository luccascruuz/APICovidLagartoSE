import type { StatusSincronizacao, SyncService } from '../../ingestion/sync.service'
import type { ExecucaoSincronizacao, SragRepository } from '../srag/srag.repository'

export class EstadoDados {
  constructor(
    private readonly repository: SragRepository,
    private readonly sync?: SyncService,
  ) {}

  get sincronizaNesteProcesso(): boolean {
    return this.sync !== undefined
  }

  async pronto(): Promise<boolean> {
    return (await this.repository.fontes()).length > 0
  }

  historico(limite: number): Promise<ExecucaoSincronizacao[]> {
    return this.repository.sincronizacoes(limite)
  }

  async sincronizacao(): Promise<StatusSincronizacao> {
    const [ultima, ultimoSucessoEm] = await Promise.all([
      this.repository.sincronizacoes(1),
      this.repository.ultimoSucessoSincronizacao(),
    ])
    const local = this.sync?.status
    return {
      emAndamento: local?.emAndamento ?? false,
      iniciadaEm: local?.iniciadaEm ?? null,
      proximaExecucao: local?.proximaExecucao ?? null,
      ultimaExecucao: ultima[0] ?? null,
      ultimoSucessoEm,
    }
  }
}
