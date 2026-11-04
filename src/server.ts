import { criarApp } from './app'
import { criarContainer } from './container'

async function main() {
  const deps = criarContainer({ origem: 'servidor', comSincronizacao: true })
  const { config, logger, monitoramento } = deps
  const sync = deps.sync!

  const carregados = await sync.carregarCache()
  logger.info({ armazenamento: deps.armazenamento, anos: config.anos, anosEmCache: carregados }, 'Iniciando')

  const app = criarApp(deps)
  const aoIniciar = () => {
    logger.info(
      `API SRAG ${config.municipio.nome}-${config.municipio.uf} em http://${config.host ?? 'localhost'}:${config.port} (docs em /docs)`,
    )
  }
  const server = config.host ? app.listen(config.port, config.host, aoIniciar) : app.listen(config.port, aoIniciar)

  if (config.syncAoIniciar) {
    sync.sincronizar().catch((erro) => logger.error({ err: erro }, 'Falha na sincronização inicial'))
  }
  sync.agendar()

  const encerrar = (sinal: string) => {
    logger.info({ sinal }, 'Encerrando servidor')
    server.close(() => {
      void deps.encerrar().finally(() => process.exit(0))
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
