import { criarContainer } from '../container'

async function main() {
  const { sync, logger } = criarContainer()
  await sync.carregarCache()
  const resultados = await sync.sincronizar({ forcar: process.argv.includes('--forcar') })
  console.table(resultados)
  if (resultados.some((r) => r.situacao === 'erro')) {
    logger.error('Sincronização terminou com erros')
    process.exitCode = 1
  }
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
