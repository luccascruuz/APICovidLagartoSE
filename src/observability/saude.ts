import type { StatusSincronizacao } from '../ingestion/sync.service'

export type EstadoSaude = 'ok' | 'degradado' | 'indisponivel'

export interface Saude {
  status: EstadoSaude
  motivos: string[]
  dadosCarregados: boolean
  sincronizacaoEmAndamento: boolean
  ultimoSucessoSincronizacao: string | null
}

export interface EntradaSaude {
  dadosCarregados: boolean
  sincronizacao: StatusSincronizacao
  maxHorasSemSync: number
  inicioProcesso: Date
  agora?: Date
}

const HORA_MS = 60 * 60 * 1000

export function avaliarSaude(e: EntradaSaude): Saude {
  const agora = e.agora ?? new Date()
  const motivos: string[] = []
  let status: EstadoSaude = 'ok'

  if (!e.dadosCarregados) {
    status = 'indisponivel'
    motivos.push(
      e.sincronizacao.emAndamento ? 'Primeira importação em andamento' : 'Nenhum dado carregado',
    )
  }

  if (e.maxHorasSemSync > 0) {
    const referencia = e.sincronizacao.ultimoSucessoEm ? new Date(e.sincronizacao.ultimoSucessoEm) : e.inicioProcesso
    const horas = (agora.getTime() - referencia.getTime()) / HORA_MS
    if (horas > e.maxHorasSemSync) {
      status = 'indisponivel'
      motivos.push(`Sem sincronização bem-sucedida há ${Math.floor(horas)} h (limite: ${e.maxHorasSemSync} h)`)
    }
  }

  const ultima = e.sincronizacao.ultimaExecucao
  if (ultima && !ultima.sucesso) {
    if (status === 'ok') status = 'degradado'
    const erros = ultima.anos.filter((a) => a.situacao === 'erro').map((a) => `${a.ano}: ${a.mensagem ?? 'erro'}`)
    motivos.push(`Última sincronização falhou (${erros.join('; ')})`)
  }

  return {
    status,
    motivos,
    dadosCarregados: e.dadosCarregados,
    sincronizacaoEmAndamento: e.sincronizacao.emAndamento,
    ultimoSucessoSincronizacao: e.sincronizacao.ultimoSucessoEm,
  }
}
