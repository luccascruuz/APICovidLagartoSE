import { criarApp } from './app'
import { criarContainer } from './container'

async function main() {
  const deps = criarContainer()
  const { config, logger, sync, monitoramento } = deps

  const carregados = await sync.carregarCache()
  logger.info({ anos: config.anos, anosEmCache: carregados }, 'Dados locais carregados')

  const app = criarApp(deps)
  const server = app.listen(config.port, () => {
    logger.info(`API SRAG ${config.municipio.nome}-${config.municipio.uf} em http://localhost:${config.port} (docs em /docs)`)
  })

  if (config.syncAoIniciar) {
    sync.sincronizar().catch((erro) => logger.error({ err: erro }, 'Falha na sincronização inicial'))
  }
  sync.agendar()

  const encerrar = (sinal: string) => {
    logger.info({ sinal }, 'Encerrando servidor')
    sync.parar()
    server.close(() => {
      void monitoramento.encerrar().finally(() => process.exit(0))
    })
    setTimeout(() => process.exit(0), 10_000).unref()
  }
  process.on('SIGINT', () => encerrar('SIGINT'))
  process.on('SIGTERM', () => encerrar('SIGTERM'))
  process.on('unhandledRejection', (erro) => {
    logger.error({ err: erro }, 'Promise rejeitada sem tratamento')
    monitoramento.erro(erro, { origem: 'unhandledRejection' })
  })
}

main().catch((erro) => {
  console.error(erro)
  process.exit(1)
})
