import { criarApp } from './app'
import { criarContainer } from './container'

const deps = criarContainer({ origem: 'serverless', comSincronizacao: false })

if (deps.armazenamento !== 'mongodb') {
  throw new Error('MONGO_URI é obrigatória no modo serverless: sem ela não há de onde ler os dados.')
}

export const app = criarApp(deps)
