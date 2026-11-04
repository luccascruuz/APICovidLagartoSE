import { z } from 'zod'
import { AGENTE, CLASSIFICACAO, EVOLUCAO, FAIXA_ETARIA, SEXO, SIM_NAO, chaves } from './srag.codes'
import type { FiltroCasos } from './srag.repository'

function lista<T extends string>(valores: readonly [T, ...T[]]) {
  return z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) =>
      v === undefined
        ? undefined
        : (Array.isArray(v) ? v : [v]).flatMap((s) => s.split(',')).map((s) => s.trim()).filter(Boolean),
    )
    .pipe(z.array(z.enum(valores)).optional())
}

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD')
const ano = z.coerce.number().int().min(2019).max(2100)
const anoTexto = z
  .string()
  .regex(/^\d{4}$/, 'Ano deve ter 4 dígitos')
  .transform(Number)
  .pipe(z.number().int().min(2019).max(2100))
const semana = z.coerce.number().int().min(1).max(53)

const anos = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((v) =>
    v === undefined ? undefined : (Array.isArray(v) ? v : [v]).flatMap((s) => s.split(',')).filter(Boolean),
  )
  .pipe(z.array(anoTexto).optional())

const filtroBase = z.object({
  ano: anos,
  semanaInicio: semana.optional(),
  semanaFim: semana.optional(),
  dataInicio: data.optional(),
  dataFim: data.optional(),
  classificacao: lista(chaves(CLASSIFICACAO)),
  evolucao: lista(chaves(EVOLUCAO)),
  sexo: lista(chaves(SEXO)),
  faixaEtaria: lista(chaves(FAIXA_ETARIA)),
  hospitalizado: z.enum(chaves(SIM_NAO)).optional(),
  uti: z.enum(chaves(SIM_NAO)).optional(),
  agente: lista(chaves(AGENTE)),
})

type FiltroBruto = z.infer<typeof filtroBase>

function validarIntervalos(f: Partial<FiltroBruto>, ctx: z.RefinementCtx) {
  if (f.semanaInicio && f.semanaFim && f.semanaInicio > f.semanaFim) {
    ctx.addIssue({ code: 'custom', path: ['semanaInicio'], message: 'semanaInicio deve ser menor ou igual a semanaFim' })
  }
  if (f.dataInicio && f.dataFim && f.dataInicio > f.dataFim) {
    ctx.addIssue({ code: 'custom', path: ['dataInicio'], message: 'dataInicio deve ser menor ou igual a dataFim' })
  }
}

function paraFiltro({ ano, ...resto }: Partial<FiltroBruto>): FiltroCasos {
  const filtro: FiltroCasos = { anos: ano }
  for (const [chave, valor] of Object.entries(resto)) {
    if (valor !== undefined) (filtro as Record<string, unknown>)[chave] = valor
  }
  if (!filtro.anos) delete filtro.anos
  return filtro
}

export const consultaCasosSchema = filtroBase
  .extend({
    pagina: z.coerce.number().int().min(1).default(1),
    limite: z.coerce.number().int().min(1).max(100).default(50),
    ordem: z.enum(['asc', 'desc']).default('desc'),
  })
  .superRefine(validarIntervalos)
  .transform(({ pagina, limite, ordem, ...f }) => ({ filtro: paraFiltro(f), paginacao: { pagina, limite, ordem } }))

export const consultaResumoSchema = filtroBase.superRefine(validarIntervalos).transform(paraFiltro)

export const consultaSemanasSchema = filtroBase
  .omit({ ano: true, semanaInicio: true, semanaFim: true, dataInicio: true, dataFim: true })
  .extend({
    ano: ano.optional(),
    janela: z.coerce.number().int().min(1).max(12).default(3),
  })
  .transform(({ ano, janela, ...f }) => ({ ano, janela, filtro: paraFiltro(f) }))

export const consultaAnosSchema = filtroBase
  .omit({ ano: true, semanaInicio: true, semanaFim: true, dataInicio: true, dataFim: true })
  .transform((f) => {
    const { anos: _anos, ...filtro } = paraFiltro(f)
    return filtro
  })

export const idSchema = z.object({ id: z.string().regex(/^\d{1,20}$/, 'id deve ser o número da notificação') })

export const sincronizarSchema = z
  .object({ forcar: z.boolean().default(false) })
  .default({ forcar: false })
