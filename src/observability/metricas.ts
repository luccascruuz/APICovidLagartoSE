import type { RequestHandler } from 'express'

const AMOSTRAS_POR_ROTA = 500

interface ContadorRota {
  total: number
  status2xx: number
  status3xx: number
  status4xx: number
  status5xx: number
  somaMs: number
  amostras: number[]
  proximaAmostra: number
}

export interface MetricaRota {
  rota: string
  total: number
  status2xx: number
  status3xx: number
  status4xx: number
  status5xx: number
  mediaMs: number
  p95Ms: number
}

export interface SnapshotMetricas {
  iniciadoEm: string
  segundosNoAr: number
  memoriaMb: { rss: number; heapUsado: number }
  totais: Omit<MetricaRota, 'rota'>
  rotas: MetricaRota[]
}

function percentil(valores: number[], p: number): number {
  if (valores.length === 0) return 0
  const ordenados = [...valores].sort((a, b) => a - b)
  const indice = Math.min(ordenados.length - 1, Math.ceil((p / 100) * ordenados.length) - 1)
  return ordenados[Math.max(0, indice)]!
}

function arredondar(valor: number): number {
  return Math.round(valor * 10) / 10
}

function novoContador(): ContadorRota {
  return { total: 0, status2xx: 0, status3xx: 0, status4xx: 0, status5xx: 0, somaMs: 0, amostras: [], proximaAmostra: 0 }
}

function registrar(contador: ContadorRota, status: number, ms: number) {
  contador.total++
  if (status >= 500) contador.status5xx++
  else if (status >= 400) contador.status4xx++
  else if (status >= 300) contador.status3xx++
  else contador.status2xx++
  contador.somaMs += ms
  if (contador.amostras.length < AMOSTRAS_POR_ROTA) contador.amostras.push(ms)
  else contador.amostras[contador.proximaAmostra] = ms
  contador.proximaAmostra = (contador.proximaAmostra + 1) % AMOSTRAS_POR_ROTA
}

function resumir(contador: ContadorRota): Omit<MetricaRota, 'rota'> {
  return {
    total: contador.total,
    status2xx: contador.status2xx,
    status3xx: contador.status3xx,
    status4xx: contador.status4xx,
    status5xx: contador.status5xx,
    mediaMs: contador.total ? arredondar(contador.somaMs / contador.total) : 0,
    p95Ms: arredondar(percentil(contador.amostras, 95)),
  }
}

function segmentos(caminho: string): string[] {
  return caminho.split('/').filter(Boolean)
}

export function nomeDaRota(metodo: string, caminhoRota: string | undefined, url: string): string {
  const caminho = url.split('?')[0] ?? ''
  if (caminho.startsWith('/docs')) return `${metodo} /docs`
  if (caminhoRota === undefined) return 'rota inexistente'
  const partesUrl = segmentos(caminho)
  const partesRota = segmentos(caminhoRota)
  const base = partesUrl.slice(0, Math.max(0, partesUrl.length - partesRota.length))
  return `${metodo} /${[...base, ...partesRota].join('/')}`
}

export class Metricas {
  private readonly porRota = new Map<string, ContadorRota>()
  private readonly geral = novoContador()

  constructor(private readonly inicio = new Date()) {}

  middleware(): RequestHandler {
    return (req, res, next) => {
      const comeco = process.hrtime.bigint()
      res.on('finish', () => {
        const ms = Number(process.hrtime.bigint() - comeco) / 1e6
        const caminhoRota = typeof req.route?.path === 'string' ? req.route.path : undefined
        this.registrar(nomeDaRota(req.method, caminhoRota, req.originalUrl), res.statusCode, ms)
      })
      next()
    }
  }

  registrar(rota: string, status: number, ms: number) {
    let contador = this.porRota.get(rota)
    if (!contador) {
      contador = novoContador()
      this.porRota.set(rota, contador)
    }
    registrar(contador, status, ms)
    registrar(this.geral, status, ms)
  }

  snapshot(agora = new Date()): SnapshotMetricas {
    const memoria = process.memoryUsage()
    return {
      iniciadoEm: this.inicio.toISOString(),
      segundosNoAr: Math.round((agora.getTime() - this.inicio.getTime()) / 1000),
      memoriaMb: { rss: Math.round(memoria.rss / 1e6), heapUsado: Math.round(memoria.heapUsed / 1e6) },
      totais: resumir(this.geral),
      rotas: [...this.porRota.entries()]
        .map(([rota, contador]) => ({ rota, ...resumir(contador) }))
        .sort((a, b) => b.total - a.total),
    }
  }
}
