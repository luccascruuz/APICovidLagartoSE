import type { Config } from '../config/env'
import { AGENTE, CLASSIFICACAO, EVOLUCAO, FAIXA_ETARIA, SEXO, SIM_NAO } from '../modules/srag/srag.codes'

const enumDe = (r: Record<string, string>) => Object.keys(r)
const descricaoDe = (r: Record<string, string>) =>
  Object.entries(r)
    .map(([k, v]) => `\`${k}\`: ${v}`)
    .join('; ')

const listaParam = (name: string, rotulos: Record<string, string>, extra = '') => ({
  name,
  in: 'query',
  required: false,
  description: `${extra}Um ou mais valores separados por vírgula. ${descricaoDe(rotulos)}`,
  schema: { type: 'string' },
  example: enumDe(rotulos)[0],
})

const filtros = [
  {
    name: 'ano',
    in: 'query',
    description: 'Ano epidemiológico (ano do arquivo do Ministério). Aceita lista: 2025,2026',
    schema: { type: 'string' },
    example: '2026',
  },
  { name: 'semanaInicio', in: 'query', description: 'Semana epidemiológica inicial (1-53)', schema: { type: 'integer', minimum: 1, maximum: 53 } },
  { name: 'semanaFim', in: 'query', description: 'Semana epidemiológica final (1-53)', schema: { type: 'integer', minimum: 1, maximum: 53 } },
  { name: 'dataInicio', in: 'query', description: 'Início dos sintomas a partir de (AAAA-MM-DD)', schema: { type: 'string', format: 'date' } },
  { name: 'dataFim', in: 'query', description: 'Início dos sintomas até (AAAA-MM-DD)', schema: { type: 'string', format: 'date' } },
  listaParam('classificacao', CLASSIFICACAO),
  listaParam('evolucao', EVOLUCAO),
  listaParam('sexo', SEXO),
  listaParam('faixaEtaria', FAIXA_ETARIA),
  listaParam('agente', AGENTE, 'Casos com pelo menos um destes agentes identificados. '),
  { name: 'hospitalizado', in: 'query', schema: { type: 'string', enum: enumDe(SIM_NAO) } },
  { name: 'uti', in: 'query', schema: { type: 'string', enum: enumDe(SIM_NAO) } },
]

const erro = {
  type: 'object',
  properties: {
    erro: {
      type: 'object',
      properties: {
        codigo: { type: 'string', example: 'PARAMETROS_INVALIDOS' },
        mensagem: { type: 'string' },
        detalhes: {},
      },
    },
  },
}

const respostasErro = {
  '400': { description: 'Parâmetros inválidos', content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } } },
  '503': { description: 'Dados ainda sendo importados', content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } } },
}

const contagem = (r: Record<string, string>, extra: string[] = []) => ({
  type: 'object',
  properties: Object.fromEntries([...enumDe(r), ...extra].map((k) => [k, { type: 'integer' }])),
})

const nullable = (schema: object) => ({ ...schema, nullable: true })
const municipio = { type: 'object', properties: { codigoIbge: { type: 'string' }, nome: { type: 'string' } } }

export function criarOpenApi(config: Config) {
  const nome = `${config.municipio.nome}-${config.municipio.uf}`
  return {
    openapi: '3.0.3',
    info: {
      title: `API SRAG ${nome}`,
      version: '2.0.0',
      description:
        `Casos de **Síndrome Respiratória Aguda Grave (SRAG)** de residentes em ${nome}, ` +
        'a partir dos microdados abertos do SIVEP-Gripe publicados pelo Ministério da Saúde no ' +
        `[OpenDataSUS](${config.datasetUrl}).\n\n` +
        '- O Ministério atualiza o banco do ano corrente semanalmente; a API verifica periodicamente se há arquivo novo.\n' +
        '- As últimas semanas são sempre parciais por causa do atraso de notificação.\n' +
        '- Campos que poderiam identificar o paciente (data de nascimento, ocupação, textos livres) não são importados.',
      contact: { name: 'Luccas Ribeiro Cruz', email: 'luccasribe@gmail.com' },
    },
    tags: [
      { name: 'SRAG', description: 'Casos, resumo e série semanal' },
      { name: 'Sistema', description: 'Saúde da API e origem dos dados' },
    ],
    paths: {
      '/v1/srag/casos': {
        get: {
          tags: ['SRAG'],
          summary: 'Lista paginada de casos',
          description: 'Ordenada pela data de início dos sintomas.',
          parameters: [
            ...filtros,
            { name: 'pagina', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
            { name: 'limite', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
            { name: 'ordem', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
          ],
          responses: {
            '200': {
              description: 'Casos encontrados',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      dados: { type: 'array', items: { $ref: '#/components/schemas/CasoSrag' } },
                      paginacao: {
                        type: 'object',
                        properties: {
                          pagina: { type: 'integer' },
                          limite: { type: 'integer' },
                          ordem: { type: 'string' },
                          total: { type: 'integer' },
                          totalPaginas: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
            ...respostasErro,
          },
        },
      },
      '/v1/srag/casos/{id}': {
        get: {
          tags: ['SRAG'],
          summary: 'Um caso pelo número da notificação',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            '200': {
              description: 'Caso',
              content: { 'application/json': { schema: { type: 'object', properties: { dados: { $ref: '#/components/schemas/CasoSrag' } } } } },
            },
            '404': { description: 'Não encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } } },
            ...respostasErro,
          },
        },
      },
      '/v1/srag/resumo': {
        get: {
          tags: ['SRAG'],
          summary: 'Totais e distribuições',
          description: 'Totais de casos, internações, UTI e óbitos, com distribuição por classificação, evolução, sexo, faixa etária e agente.',
          parameters: filtros,
          responses: {
            '200': {
              description: 'Resumo',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { dados: { $ref: '#/components/schemas/Resumo' }, filtros: { type: 'object' }, aviso: { type: 'string' } },
                  },
                },
              },
            },
            ...respostasErro,
          },
        },
      },
      '/v1/srag/semanas': {
        get: {
          tags: ['SRAG'],
          summary: 'Série por semana epidemiológica',
          description: 'Casos, óbitos por SRAG e internações em UTI por semana de início dos sintomas, com média móvel. Semanas sem casos aparecem com zero.',
          parameters: [
            { name: 'ano', in: 'query', description: 'Padrão: ano mais recente carregado', schema: { type: 'integer' } },
            { name: 'janela', in: 'query', description: 'Semanas da média móvel', schema: { type: 'integer', minimum: 1, maximum: 12, default: 3 } },
            ...filtros.filter((f) => !['ano', 'semanaInicio', 'semanaFim', 'dataInicio', 'dataFim'].includes(f.name)),
          ],
          responses: {
            '200': {
              description: 'Série semanal',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      dados: {
                        type: 'object',
                        properties: {
                          ano: { type: 'integer' },
                          janelaMediaMovel: { type: 'integer' },
                          semanas: { type: 'array', items: { $ref: '#/components/schemas/PontoSemanal' } },
                        },
                      },
                      aviso: { type: 'string' },
                    },
                  },
                },
              },
            },
            '404': { description: 'Ano não carregado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } } },
            ...respostasErro,
          },
        },
      },
      '/v1/srag/anos': {
        get: {
          tags: ['SRAG'],
          summary: 'Comparativo por ano (pandemia vs. hoje)',
          description:
            'Uma linha por ano carregado, com totais e comparação com o ano anterior. Anos fechados são comparados pelo total; ' +
            'o ano corrente (`parcial: true`) é comparado com as mesmas semanas epidemiológicas do ano anterior (`criterio: mesmo_periodo`).',
          parameters: filtros.filter((f) => !['ano', 'semanaInicio', 'semanaFim', 'dataInicio', 'dataFim'].includes(f.name)),
          responses: {
            '200': {
              description: 'Comparativo anual',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      dados: { type: 'array', items: { $ref: '#/components/schemas/ComparativoAno' } },
                      aviso: { type: 'string' },
                    },
                  },
                },
              },
            },
            ...respostasErro,
          },
        },
      },
      '/v1/srag/dicionario': {
        get: {
          tags: ['SRAG'],
          summary: 'Significado de cada valor usado pela API',
          responses: { '200': { description: 'Tabelas de rótulos' } },
        },
      },
      '/v1/fonte': {
        get: {
          tags: ['Sistema'],
          summary: 'Origem dos dados e status da sincronização',
          description: 'Arquivo do Ministério usado para cada ano, data de publicação, quando foi importado e quantos casos foram encontrados.',
          responses: { '200': { description: 'Metadados' } },
        },
      },
      '/health': {
        get: {
          tags: ['Sistema'],
          summary: 'Verificação de saúde (para monitores de uptime)',
          description:
            '`ok`: tudo certo. `degradado`: a última sincronização falhou, mas os dados ainda estão dentro do prazo. ' +
            '`indisponivel` (HTTP 503): sem dados carregados ou sem sincronização bem-sucedida há mais de `SAUDE_MAX_HORAS_SEM_SYNC` horas.',
          responses: {
            '200': { description: 'ok ou degradado' },
            '503': { description: 'indisponível' },
          },
        },
      },
      '/status': {
        get: {
          tags: ['Sistema'],
          summary: 'Página de status (HTML)',
          description: 'Saúde, dados carregados, sincronização, requisições por rota, tempo de resposta e memória. Recarrega a cada 30 s.',
          responses: { '200': { description: 'Página HTML', content: { 'text/html': {} } } },
        },
      },
      '/status.json': {
        get: {
          tags: ['Sistema'],
          summary: 'Mesmas informações da página de status, em JSON',
          responses: { '200': { description: 'Status e métricas' } },
        },
      },
      '/v1/admin/sincronizar': {
        post: {
          tags: ['Sistema'],
          summary: 'Dispara a sincronização com o OpenDataSUS',
          description:
            'Só no modo servidor e com `ADMIN_TOKEN` configurado. Executa em segundo plano; acompanhe em `/status`. ' +
            'Na Vercel esta rota não existe: dispare o workflow "Sincronizar dados SRAG" no GitHub Actions.',
          security: [{ bearer: [] }],
          requestBody: {
            required: false,
            content: { 'application/json': { schema: { type: 'object', properties: { forcar: { type: 'boolean', default: false } } } } },
          },
          responses: {
            '202': { description: 'Sincronização iniciada' },
            '401': { description: 'Token inválido', content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } } },
          },
        },
      },
    },
    components: {
      securitySchemes: { bearer: { type: 'http', scheme: 'bearer' } },
      schemas: {
        Erro: erro,
        CasoSrag: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Número da notificação (NU_NOTIFIC)' },
            ano: { type: 'integer' },
            semanaEpidemiologica: { type: 'integer' },
            dataInicioSintomas: { type: 'string', format: 'date' },
            dataNotificacao: nullable({ type: 'string', format: 'date' }),
            semanaNotificacao: nullable({ type: 'integer' }),
            dataDigitacao: nullable({ type: 'string', format: 'date' }),
            municipioResidencia: { ...municipio, properties: { ...municipio.properties, uf: { type: 'string' } } },
            municipioNotificacao: nullable(municipio),
            municipioInternacao: nullable(municipio),
            zona: nullable({ type: 'string' }),
            sexo: { type: 'string', enum: enumDe(SEXO) },
            idade: nullable({ type: 'object', properties: { valor: { type: 'integer' }, unidade: { type: 'string', enum: ['dias', 'meses', 'anos'] } } }),
            idadeAnos: nullable({ type: 'integer' }),
            faixaEtaria: nullable({ type: 'string', enum: enumDe(FAIXA_ETARIA) }),
            racaCor: nullable({ type: 'string' }),
            gestante: nullable({ type: 'boolean' }),
            sintomas: { type: 'array', items: { type: 'string' } },
            fatorRisco: nullable({ type: 'string', enum: enumDe(SIM_NAO) }),
            comorbidades: { type: 'array', items: { type: 'string' } },
            vacinaGripe: nullable({ type: 'string', enum: enumDe(SIM_NAO) }),
            vacinaCovid: nullable({ type: 'string', enum: enumDe(SIM_NAO) }),
            hospitalizado: nullable({ type: 'string', enum: enumDe(SIM_NAO) }),
            dataInternacao: nullable({ type: 'string', format: 'date' }),
            uti: nullable({ type: 'string', enum: enumDe(SIM_NAO) }),
            dataEntradaUti: nullable({ type: 'string', format: 'date' }),
            dataSaidaUti: nullable({ type: 'string', format: 'date' }),
            suporteVentilatorio: nullable({ type: 'string' }),
            resultadoPcr: nullable({ type: 'string' }),
            agentes: { type: 'array', items: { type: 'string', enum: enumDe(AGENTE) } },
            classificacao: { type: 'string', enum: enumDe(CLASSIFICACAO) },
            criterio: nullable({ type: 'string' }),
            evolucao: { type: 'string', enum: enumDe(EVOLUCAO) },
            dataEvolucao: nullable({ type: 'string', format: 'date' }),
            dataEncerramento: nullable({ type: 'string', format: 'date' }),
          },
        },
        Resumo: {
          type: 'object',
          properties: {
            totalCasos: { type: 'integer' },
            periodo: {
              type: 'object',
              properties: {
                primeiroInicioSintomas: nullable({ type: 'string', format: 'date' }),
                ultimoInicioSintomas: nullable({ type: 'string', format: 'date' }),
              },
            },
            hospitalizados: { type: 'integer' },
            internadosUti: { type: 'integer' },
            obitosSrag: { type: 'integer' },
            obitosOutrasCausas: { type: 'integer' },
            casosEmAberto: { type: 'integer' },
            porClassificacao: contagem(CLASSIFICACAO),
            porEvolucao: contagem(EVOLUCAO),
            porSexo: contagem(SEXO),
            porFaixaEtaria: contagem(FAIXA_ETARIA, ['nao_informada']),
            suporteVentilatorio: { type: 'object', additionalProperties: { type: 'integer' } },
            agentesIdentificados: contagem(AGENTE),
          },
        },
        ComparativoAno: {
          type: 'object',
          properties: {
            ano: { type: 'integer' },
            parcial: { type: 'boolean' },
            semanasNoPeriodo: { type: 'integer' },
            totalCasos: { type: 'integer' },
            mediaSemanal: { type: 'number' },
            hospitalizados: { type: 'integer' },
            internadosUti: { type: 'integer' },
            obitosSrag: { type: 'integer' },
            casosEmAberto: { type: 'integer' },
            porClassificacao: contagem(CLASSIFICACAO),
            agentesIdentificados: contagem(AGENTE),
            comparacaoAnoAnterior: nullable({
              type: 'object',
              properties: {
                criterio: { type: 'string', enum: ['ano_inteiro', 'mesmo_periodo'] },
                semanas: { type: 'integer' },
                casosAnoAnterior: { type: 'integer' },
                casosNestePeriodo: { type: 'integer' },
                variacaoPercentual: nullable({ type: 'number' }),
              },
            }),
          },
        },
        PontoSemanal: {
          type: 'object',
          properties: {
            semana: { type: 'integer' },
            inicio: { type: 'string', format: 'date' },
            fim: { type: 'string', format: 'date' },
            casos: { type: 'integer' },
            obitosSrag: { type: 'integer' },
            internadosUti: { type: 'integer' },
            mediaMovel: nullable({ type: 'number' }),
          },
        },
      },
    },
  }
}
