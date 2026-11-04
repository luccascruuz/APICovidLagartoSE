import { z } from 'zod'

z.config(z.locales.ptBR())

if (process.env.VITEST !== 'true') {
  try {
    process.loadEnvFile()
  } catch {}
}

const booleanString = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1')

function opcional<T extends z.ZodType>(schema: T) {
  return z.preprocess((v) => (v === '' ? undefined : v), schema.optional())
}

const trustProxy = z
  .string()
  .optional()
  .transform((v, ctx): false | number | string => {
    const valor = (v ?? '').trim()
    if (!valor || valor === 'false') return false
    if (valor === 'true') {
      ctx.addIssue({
        code: 'custom',
        message: 'TRUST_PROXY=true confia em qualquer origem e permite falsificar o IP. Use "loopback", um número de proxies ou uma lista de IPs.',
      })
      return z.NEVER
    }
    if (/^\d+$/.test(valor)) return Number(valor)
    return valor
  })

const anoAtual = new Date().getUTCFullYear()

export function parseAnos(valor: string | undefined, referencia = anoAtual): number[] {
  const texto = (valor ?? '').trim().toLowerCase().replace(/\batual\b/g, String(referencia))
  if (!texto) return [referencia - 1, referencia]

  const anos = new Set<number>()
  for (const parte of texto.split(',').map((p) => p.trim()).filter(Boolean)) {
    const intervalo = parte.match(/^(\d{4})\s*-\s*(\d{4})$/)
    if (intervalo) {
      const inicio = Number(intervalo[1])
      const fim = Number(intervalo[2])
      if (inicio > fim) throw new Error(`Intervalo de anos inválido: "${parte}"`)
      for (let ano = inicio; ano <= fim; ano++) anos.add(ano)
    } else if (/^\d{4}$/.test(parte)) {
      anos.add(Number(parte))
    } else {
      throw new Error(`Ano inválido em ANOS: "${parte}"`)
    }
  }

  const lista = [...anos].sort((a, b) => a - b)
  const invalido = lista.find((ano) => ano < 2019 || ano > referencia)
  if (invalido !== undefined) {
    throw new Error(`Ano ${invalido} fora do intervalo disponível no SIVEP-Gripe (2019-${referencia})`)
  }
  return lista
}

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  HOST: opcional(z.string().min(1)),
  TRUST_PROXY: trustProxy,
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  MUNICIPIO_IBGE: z
    .string()
    .regex(/^\d{6}$/, 'MUNICIPIO_IBGE deve ter 6 dígitos (código IBGE sem o dígito verificador)')
    .default('280350'),
  MUNICIPIO_NOME: z.string().min(1).default('Lagarto'),
  MUNICIPIO_UF: z.string().length(2).default('SE'),

  ANOS: z.string().optional(),
  SYNC_INTERVALO_HORAS: z.coerce.number().min(0).default(12),
  SYNC_AO_INICIAR: booleanString.default(true),
  DATA_DIR: z.string().min(1).default('./data'),
  OPENDATASUS_DATASET_URL: z.url().default('https://dadosabertos.saude.gov.br/dataset/srag-2019-a-2026'),

  ADMIN_TOKEN: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || v.length >= 24, 'ADMIN_TOKEN deve ter pelo menos 24 caracteres'),
  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_POR_MINUTO: z.coerce.number().int().min(0).default(120),

  MONGO_URI: opcional(
    z
      .string()
      .regex(/^mongodb(\+srv)?:\/\//, 'MONGO_URI deve começar com mongodb:// ou mongodb+srv://'),
  ),
  MONGO_DB: z.string().regex(/^[A-Za-z0-9_-]{1,38}$/, 'Nome de banco inválido').default('srag_lagarto'),
  MONGO_CACHE_SEGUNDOS: z.coerce.number().int().min(0).default(60),

  SAUDE_MAX_HORAS_SEM_SYNC: z.coerce.number().min(0).default(36),
  HEALTHCHECKS_URL: opcional(z.url({ protocol: /^https?$/ })),
  SENTRY_DSN: opcional(z.url()),
})

function carregar() {
  const resultado = schema.safeParse(process.env)
  if (!resultado.success) {
    const detalhes = resultado.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Configuração inválida:\n${detalhes}`)
  }
  const env = resultado.data
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    host: env.HOST,
    trustProxy: env.TRUST_PROXY,
    logLevel: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
    municipio: {
      codigoIbge: env.MUNICIPIO_IBGE,
      nome: env.MUNICIPIO_NOME,
      uf: env.MUNICIPIO_UF.toUpperCase(),
    },
    anos: parseAnos(env.ANOS),
    syncIntervaloHoras: env.SYNC_INTERVALO_HORAS,
    syncAoIniciar: env.SYNC_AO_INICIAR,
    dataDir: env.DATA_DIR,
    datasetUrl: env.OPENDATASUS_DATASET_URL,
    adminToken: env.ADMIN_TOKEN,
    corsOrigin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    rateLimitPorMinuto: env.RATE_LIMIT_POR_MINUTO,
    mongoUri: env.MONGO_URI,
    mongoDb: env.MONGO_DB,
    mongoCacheSegundos: env.MONGO_CACHE_SEGUNDOS,
    saudeMaxHorasSemSync: env.SAUDE_MAX_HORAS_SEM_SYNC,
    healthchecksUrl: env.HEALTHCHECKS_URL?.replace(/\/+$/, ''),
    sentryDsn: env.SENTRY_DSN,
  }
}

export type Config = ReturnType<typeof carregar>

export const config: Config = carregar()
