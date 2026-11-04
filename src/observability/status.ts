import type { Config } from '../config/env'
import type { StatusSincronizacao } from '../ingestion/sync.service'
import type { FonteAno } from '../modules/srag/srag.repository'
import type { SnapshotMetricas } from './metricas'
import type { Monitoramento } from './monitoramento'
import type { Saude } from './saude'

export interface StatusApi {
  geradoEm: string
  municipio: Config['municipio']
  saude: Saude
  dados: FonteAno[]
  sincronizacao: StatusSincronizacao & { intervaloHoras: number }
  integracoes: Monitoramento['integracoes']
  metricas: SnapshotMetricas
}

const formatoData = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Maceio',
  dateStyle: 'short',
  timeStyle: 'medium',
})

const formatoNumero = new Intl.NumberFormat('pt-BR')

function esc(valor: unknown): string {
  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function data(iso: string | null | undefined): string {
  if (!iso) return '—'
  const valor = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso)
  if (Number.isNaN(valor.getTime())) return esc(iso)
  return esc(iso.length === 10 ? formatoData.format(valor).split(',')[0] : formatoData.format(valor))
}

function numero(valor: number): string {
  return esc(formatoNumero.format(valor))
}

function duracao(segundos: number): string {
  const d = Math.floor(segundos / 86400)
  const h = Math.floor((segundos % 86400) / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  if (d) return `${d} d ${h} h`
  if (h) return `${h} h ${m} min`
  if (m) return `${m} min`
  return `${segundos} s`
}

const ROTULO_SAUDE = { ok: 'Operacional', degradado: 'Degradado', indisponivel: 'Indisponível' } as const
const ROTULO_SITUACAO = { atualizado: 'Atualizado', sem_alteracao: 'Sem alteração', erro: 'Erro' } as const

function selo(texto: string, tipo: 'ok' | 'alerta' | 'erro' | 'neutro'): string {
  return `<span class="selo selo-${tipo}">${esc(texto)}</span>`
}

function tipoSaude(status: Saude['status']) {
  return status === 'ok' ? 'ok' : status === 'degradado' ? 'alerta' : 'erro'
}

function cartao(rotulo: string, valor: string, detalhe = ''): string {
  return `<div class="cartao"><div class="rotulo">${esc(rotulo)}</div><div class="valor">${valor}</div>${
    detalhe ? `<div class="detalhe">${detalhe}</div>` : ''
  }</div>`
}

export function renderizarStatus(s: StatusApi): string {
  const nome = `${s.municipio.nome}-${s.municipio.uf}`
  const ultima = s.sincronizacao.ultimaExecucao
  const t = s.metricas.totais

  const linhasDados = s.dados.length
    ? s.dados
        .map(
          (f) => `<tr>
            <td class="num">${esc(f.ano)}</td>
            <td><code>${esc(f.arquivo)}</code></td>
            <td>${data(f.publicadoEm)}</td>
            <td>${data(f.importadoEm)}</td>
            <td class="num">${numero(f.totalCasos)}</td>
            <td class="num">${numero(f.linhasLidas)}</td>
          </tr>`,
        )
        .join('')
    : '<tr><td colspan="6" class="vazio">Nenhum ano carregado ainda</td></tr>'

  const linhasSync = ultima
    ? ultima.anos
        .map(
          (a) => `<tr>
            <td class="num">${esc(a.ano)}</td>
            <td>${selo(ROTULO_SITUACAO[a.situacao], a.situacao === 'erro' ? 'erro' : a.situacao === 'atualizado' ? 'ok' : 'neutro')}</td>
            <td>${a.arquivo ? `<code>${esc(a.arquivo)}</code>` : '—'}</td>
            <td>${esc(a.mensagem ?? (a.totalCasos !== undefined ? `${a.totalCasos} casos` : ''))}</td>
          </tr>`,
        )
        .join('')
    : '<tr><td colspan="4" class="vazio">Nenhuma sincronização executada desde que o servidor iniciou</td></tr>'

  const linhasRotas = s.metricas.rotas.length
    ? s.metricas.rotas
        .map(
          (r) => `<tr>
            <td><code>${esc(r.rota)}</code></td>
            <td class="num">${numero(r.total)}</td>
            <td class="num">${numero(r.status2xx + r.status3xx)}</td>
            <td class="num">${numero(r.status4xx)}</td>
            <td class="num ${r.status5xx ? 'texto-erro' : ''}">${numero(r.status5xx)}</td>
            <td class="num">${esc(r.mediaMs)}</td>
            <td class="num">${esc(r.p95Ms)}</td>
          </tr>`,
        )
        .join('')
    : '<tr><td colspan="7" class="vazio">Nenhuma requisição registrada ainda</td></tr>'

  const motivos = s.saude.motivos.length
    ? `<ul class="motivos">${s.saude.motivos.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>`
    : ''

  const integracao = (ativo: boolean) => (ativo ? selo('Ativo', 'ok') : selo('Não configurado', 'neutro'))

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="30">
<title>Status · API SRAG ${esc(nome)}</title>
<style>
:root {
  --fundo: #f6f7f9; --superficie: #ffffff; --borda: #e3e6ea; --texto: #1c2024; --suave: #5f6872;
  --ok: #1a7f37; --ok-fundo: #e6f4ea; --alerta: #9a6700; --alerta-fundo: #fff4d6;
  --erro: #c62828; --erro-fundo: #fdecea; --neutro: #57606a; --neutro-fundo: #eef1f4;
}
@media (prefers-color-scheme: dark) {
  :root {
    --fundo: #0f1215; --superficie: #171b1f; --borda: #2a3037; --texto: #e6e9ec; --suave: #9aa4ae;
    --ok: #4ac26b; --ok-fundo: #12291a; --alerta: #e3b341; --alerta-fundo: #2e2410;
    --erro: #ff7b72; --erro-fundo: #321615; --neutro: #9aa4ae; --neutro-fundo: #22282e;
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--fundo); color: var(--texto); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { max-width: 1080px; margin: 0 auto; padding: 24px 16px 48px; }
header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 20px; }
h1 { font-size: 22px; margin: 0; }
h2 { font-size: 16px; margin: 0 0 12px; }
.sub { color: var(--suave); font-size: 13px; }
.painel { background: var(--superficie); border: 1px solid var(--borda); border-radius: 10px; padding: 16px; margin-bottom: 16px; }
.estado { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.estado .grande { font-size: 18px; font-weight: 600; }
.motivos { margin: 10px 0 0; padding-left: 20px; color: var(--suave); }
.cartoes { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 16px; }
.cartao { background: var(--superficie); border: 1px solid var(--borda); border-radius: 10px; padding: 14px; }
.rotulo { color: var(--suave); font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
.valor { font-size: 22px; font-weight: 600; margin-top: 4px; font-variant-numeric: tabular-nums; }
.detalhe { color: var(--suave); font-size: 12px; margin-top: 2px; }
.tabela { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--borda); white-space: nowrap; }
th { color: var(--suave); font-weight: 500; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
tr:last-child td { border-bottom: 0; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.vazio { color: var(--suave); text-align: center; padding: 16px; }
code { font: 13px ui-monospace, SFMono-Regular, Menlo, monospace; }
.selo { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 13px; font-weight: 500; }
.selo-ok { color: var(--ok); background: var(--ok-fundo); }
.selo-alerta { color: var(--alerta); background: var(--alerta-fundo); }
.selo-erro { color: var(--erro); background: var(--erro-fundo); }
.selo-neutro { color: var(--neutro); background: var(--neutro-fundo); }
.texto-erro { color: var(--erro); font-weight: 600; }
.grade { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 8px 24px; }
.grade div { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--borda); padding: 6px 0; }
.grade span:first-child { color: var(--suave); }
.espaco { margin-bottom: 12px; }
a { color: inherit; }
footer { color: var(--suave); font-size: 13px; margin-top: 8px; }
</style>
</head>
<body>
<main>
  <header>
    <div>
      <h1>API SRAG ${esc(nome)}</h1>
      <div class="sub">Atualizado em ${data(s.geradoEm)} · recarrega a cada 30 s</div>
    </div>
    <div class="sub"><a href="/docs">Documentação</a> · <a href="/status.json">JSON</a></div>
  </header>

  <section class="painel">
    <div class="estado">
      ${selo(ROTULO_SAUDE[s.saude.status], tipoSaude(s.saude.status))}
      <span class="grande">${s.saude.status === 'ok' ? 'Tudo funcionando' : 'Atenção necessária'}</span>
    </div>
    ${motivos}
  </section>

  <div class="cartoes">
    ${cartao('No ar há', esc(duracao(s.metricas.segundosNoAr)), `desde ${data(s.metricas.iniciadoEm)}`)}
    ${cartao('Requisições', numero(t.total), `${numero(t.status4xx)} com erro 4xx`)}
    ${cartao('Erros 5xx', `<span class="${t.status5xx ? 'texto-erro' : ''}">${numero(t.status5xx)}</span>`)}
    ${cartao('Tempo de resposta', `${esc(t.p95Ms)} ms`, `p95 · média ${esc(t.mediaMs)} ms`)}
    ${cartao('Memória', `${numero(s.metricas.memoriaMb.rss)} MB`, `heap ${numero(s.metricas.memoriaMb.heapUsado)} MB`)}
  </div>

  <section class="painel">
    <h2>Dados carregados</h2>
    <div class="tabela"><table>
      <thead><tr><th class="num">Ano</th><th>Arquivo do Ministério</th><th>Publicado em</th><th>Importado em</th><th class="num">Casos</th><th class="num">Linhas lidas</th></tr></thead>
      <tbody>${linhasDados}</tbody>
    </table></div>
  </section>

  <section class="painel">
    <h2>Sincronização com o OpenDataSUS</h2>
    <div class="grade espaco">
      <div><span>Situação</span><span>${s.sincronizacao.emAndamento ? selo('Em andamento', 'alerta') : ultima ? selo(ultima.sucesso ? 'Concluída' : 'Falhou', ultima.sucesso ? 'ok' : 'erro') : selo('Aguardando', 'neutro')}</span></div>
      <div><span>Última execução</span><span>${data(ultima?.finalizadaEm)}</span></div>
      <div><span>Último sucesso</span><span>${data(s.sincronizacao.ultimoSucessoEm)}</span></div>
      <div><span>Próxima verificação</span><span>${s.sincronizacao.intervaloHoras > 0 ? data(s.sincronizacao.proximaExecucao) : 'Desativada'}</span></div>
    </div>
    <div class="tabela"><table>
      <thead><tr><th class="num">Ano</th><th>Resultado</th><th>Arquivo</th><th>Detalhe</th></tr></thead>
      <tbody>${linhasSync}</tbody>
    </table></div>
  </section>

  <section class="painel">
    <h2>Requisições por rota</h2>
    <div class="tabela"><table>
      <thead><tr><th>Rota</th><th class="num">Total</th><th class="num">2xx/3xx</th><th class="num">4xx</th><th class="num">5xx</th><th class="num">Média (ms)</th><th class="num">p95 (ms)</th></tr></thead>
      <tbody>${linhasRotas}</tbody>
    </table></div>
  </section>

  <section class="painel">
    <h2>Monitoramento externo</h2>
    <div class="grade">
      <div><span>Healthchecks.io</span><span>${integracao(s.integracoes.healthchecks)}</span></div>
      <div><span>Sentry</span><span>${integracao(s.integracoes.sentry)}</span></div>
    </div>
  </section>

  <footer>Métricas em memória, contadas desde que o servidor iniciou. Fonte dos dados: SIVEP-Gripe / Ministério da Saúde.</footer>
</main>
</body>
</html>`
}
