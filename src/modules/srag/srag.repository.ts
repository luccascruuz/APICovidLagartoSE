import type { Agente, Classificacao, Evolucao, FaixaEtaria, Sexo, SimNao } from './srag.codes'
import type { CasoSrag } from './srag.types'

export interface FiltroCasos {
  anos?: number[]
  semanaInicio?: number
  semanaFim?: number
  dataInicio?: string
  dataFim?: string
  classificacao?: Classificacao[]
  evolucao?: Evolucao[]
  sexo?: Sexo[]
  faixaEtaria?: FaixaEtaria[]
  hospitalizado?: SimNao
  uti?: SimNao
  agente?: Agente[]
}

export interface Paginacao {
  pagina: number
  limite: number
  ordem: 'asc' | 'desc'
}

export interface FonteAno {
  ano: number
  arquivo: string
  url: string
  publicadoEm: string | null
  importadoEm: string
  linhasLidas: number
  totalCasos: number
  linhasDescartadas: number
}

export interface ResultadoAno {
  ano: number
  situacao: 'atualizado' | 'sem_alteracao' | 'erro'
  arquivo?: string
  totalCasos?: number
  mensagem?: string
}

export interface ExecucaoSincronizacao {
  origem: string
  iniciadaEm: string
  finalizadaEm: string
  sucesso: boolean
  anos: ResultadoAno[]
}

export interface SragRepository {
  salvarAno(fonte: FonteAno, casos: CasoSrag[]): Promise<void>
  buscar(filtro: FiltroCasos, paginacao: Paginacao): Promise<{ itens: CasoSrag[]; total: number }>
  listar(filtro: FiltroCasos): Promise<CasoSrag[]>
  buscarPorId(id: string): Promise<CasoSrag | null>
  fontes(): Promise<FonteAno[]>
  registrarSincronizacao(execucao: ExecucaoSincronizacao): Promise<void>
  sincronizacoes(limite: number): Promise<ExecucaoSincronizacao[]>
  ultimoSucessoSincronizacao(): Promise<string | null>
}

export function correspondeAoFiltro(caso: CasoSrag, f: FiltroCasos): boolean {
  if (f.anos?.length && !f.anos.includes(caso.ano)) return false
  if (f.semanaInicio !== undefined && caso.semanaEpidemiologica < f.semanaInicio) return false
  if (f.semanaFim !== undefined && caso.semanaEpidemiologica > f.semanaFim) return false
  if (f.dataInicio && caso.dataInicioSintomas < f.dataInicio) return false
  if (f.dataFim && caso.dataInicioSintomas > f.dataFim) return false
  if (f.classificacao?.length && !f.classificacao.includes(caso.classificacao)) return false
  if (f.evolucao?.length && !f.evolucao.includes(caso.evolucao)) return false
  if (f.sexo?.length && !f.sexo.includes(caso.sexo)) return false
  if (f.faixaEtaria?.length && (!caso.faixaEtaria || !f.faixaEtaria.includes(caso.faixaEtaria))) return false
  if (f.hospitalizado && caso.hospitalizado !== f.hospitalizado) return false
  if (f.uti && caso.uti !== f.uti) return false
  if (f.agente?.length && !f.agente.some((a) => caso.agentes.includes(a))) return false
  return true
}

export function compararCasos(a: CasoSrag, b: CasoSrag): number {
  return a.ano - b.ano || a.dataInicioSintomas.localeCompare(b.dataInicioSintomas) || a.id.localeCompare(b.id)
}

export function removerDuplicados(casos: CasoSrag[]): CasoSrag[] {
  return [...new Map(casos.map((c) => [c.id, c])).values()].sort(compararCasos)
}

const LIMITE_HISTORICO = 200

export class InMemorySragRepository implements SragRepository {
  private readonly casosPorAno = new Map<number, CasoSrag[]>()
  private readonly fontesPorAno = new Map<number, FonteAno>()
  private readonly historico: ExecucaoSincronizacao[] = []

  async salvarAno(fonte: FonteAno, casos: CasoSrag[]): Promise<void> {
    const unicos = removerDuplicados(casos)
    this.casosPorAno.set(fonte.ano, unicos)
    this.fontesPorAno.set(fonte.ano, { ...fonte, totalCasos: unicos.length })
  }

  async listar(filtro: FiltroCasos): Promise<CasoSrag[]> {
    const anos = [...this.casosPorAno.keys()].sort((a, b) => a - b)
    return anos
      .filter((ano) => !filtro.anos?.length || filtro.anos.includes(ano))
      .flatMap((ano) => this.casosPorAno.get(ano) ?? [])
      .filter((caso) => correspondeAoFiltro(caso, filtro))
  }

  async buscar(filtro: FiltroCasos, { pagina, limite, ordem }: Paginacao) {
    const todos = await this.listar(filtro)
    if (ordem === 'desc') todos.reverse()
    const inicio = (pagina - 1) * limite
    return { itens: todos.slice(inicio, inicio + limite), total: todos.length }
  }

  async buscarPorId(id: string): Promise<CasoSrag | null> {
    const anos = [...this.casosPorAno.keys()].sort((a, b) => a - b)
    for (const ano of anos) {
      const caso = this.casosPorAno.get(ano)?.find((c) => c.id === id)
      if (caso) return caso
    }
    return null
  }

  async fontes(): Promise<FonteAno[]> {
    return [...this.fontesPorAno.values()].sort((a, b) => a.ano - b.ano)
  }

  async registrarSincronizacao(execucao: ExecucaoSincronizacao): Promise<void> {
    this.historico.unshift(structuredClone(execucao))
    this.historico.splice(LIMITE_HISTORICO)
  }

  async sincronizacoes(limite: number): Promise<ExecucaoSincronizacao[]> {
    return structuredClone(this.historico.slice(0, limite))
  }

  async ultimoSucessoSincronizacao(): Promise<string | null> {
    return this.historico.find((e) => e.sucesso)?.finalizadaEm ?? null
  }
}
