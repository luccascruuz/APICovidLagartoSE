import request from 'supertest'
import { afterEach, describe, expect, it } from 'vitest'
import { criarAmbiente } from './helpers'

const limpezas: (() => Promise<void>)[] = []
afterEach(async () => {
  await Promise.all(limpezas.splice(0).map((f) => f()))
})

describe('atrás de proxy reverso', () => {
  it('com TRUST_PROXY=loopback, limita cada visitante pelo IP real', async () => {
    const amb = await criarAmbiente({ config: { trustProxy: 'loopback', rateLimitPorMinuto: 2 } })
    limpezas.push(amb.limpar)
    const pedir = (ip: string) => request(amb.app).get('/v1/srag/dicionario').set('X-Forwarded-For', ip)

    expect((await pedir('200.1.1.1')).status).toBe(200)
    expect((await pedir('200.1.1.1')).status).toBe(200)
    expect((await pedir('200.1.1.1')).status).toBe(429)
    expect((await pedir('200.2.2.2')).status).toBe(200)
  })

  it('sem TRUST_PROXY, ignora o X-Forwarded-For enviado pelo cliente', async () => {
    const amb = await criarAmbiente({ config: { trustProxy: false, rateLimitPorMinuto: 1 } })
    limpezas.push(amb.limpar)
    expect((await request(amb.app).get('/v1/srag/dicionario').set('X-Forwarded-For', '1.1.1.1')).status).toBe(200)
    const falsificado = await request(amb.app).get('/v1/srag/dicionario').set('X-Forwarded-For', '2.2.2.2')
    expect(falsificado.status).toBe(429)
    expect(falsificado.body.erro.codigo).toBe('LIMITE_EXCEDIDO')
  })
})
