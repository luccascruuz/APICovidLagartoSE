import { parseAnos } from '../config/env'
import { criarContainer } from '../container'

function argumento(nome: string): string | undefined {
  const prefixo = `--${nome}=`
  return process.argv.find((a) => a.startsWith(prefixo))?.slice(prefixo.length)
}

async function main() {
  const anosArgumento = argumento('anos')
  const deps = criarContainer({
    origem: process.env.GITHUB_ACTIONS === 'true' ? 'github-actions' : 'cli',
    comSincronizacao: true,
    anos: anosArgumento ? parseAnos(anosArgumento) : undefined,
  })
  const { logger, armazenamento } = deps
  const sync = deps.sync!

  if (armazenamento === 'memoria') {
    logger.warn('MONGO_URI não configurada: os dados vão só para o cache local em DATA_DIR')
  }

  try {
    await sync.carregarCache()
    const resultados = await sync.sincronizar({ forcar: process.argv.includes('--forcar') })
    console.table(
      resultados.map((r) => ({ ano: r.ano, situacao: r.situacao, casos: r.totalCasos ?? '', arquivo: r.arquivo ?? '', erro: r.mensagem ?? '' })),
    )
    if (resultados.some((r) => r.situacao === 'erro')) {
      logger.error('Sincronização terminou com erros')
      process.exitCode = 1
    }
  } finally {
    await deps.encerrar()
  }
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
