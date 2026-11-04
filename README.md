# API SRAG Lagarto-SE

API com os casos de **Síndrome Respiratória Aguda Grave (SRAG)** de moradores de Lagarto-SE. Os dados vêm dos microdados abertos do **SIVEP-Gripe**, que o Ministério da Saúde publica no [OpenDataSUS](https://dadosabertos.saude.gov.br/dataset/srag-2019-a-2026).

A API baixa sozinha o arquivo mais recente publicado pelo Ministério e filtra os casos de Lagarto. Os casos podem ser consultados com filtros, totais e uma série por semana epidemiológica.

> Versão 1 (COVID-19 e vacinação, com MongoDB e Redis) está no histórico do git, até o commit `9dc3187`.

## Como funciona

```
OpenDataSUS (página do conjunto SRAG)
   │  1. descobre o CSV mais recente de cada ano (INFLUDaa-DD-MM-AAAA.csv)
   ▼
CSV nacional (~250 MB a 1,8 GB por ano)
   │  2. lê em streaming, sem carregar o arquivo inteiro na memória
   │  3. mantém só CO_MUN_RES = 280350 (residentes em Lagarto)
   │  4. converte os códigos do dicionário de dados em valores legíveis
   ▼
Repositório (hoje em memória) + cache em ./data/srag-<ano>.json
   ▼
API HTTP (Express) → /v1/srag/...
```

- **Ao iniciar:** a API carrega o cache local na hora, depois procura arquivos novos em segundo plano.
- **A cada `SYNC_INTERVALO_HORAS`:** confere se o Ministério publicou um arquivo novo. Quando o nome do arquivo não mudou, nada é baixado.
- **A cada atualização, o ano inteiro é substituído**, porque o Ministério republica o banco completo e os casos antigos mudam (classificação final, evolução etc.).
- **Antes da primeira importação**, as rotas de dados respondem `503` com `Retry-After`, em vez de devolver listas vazias.

## Rodando

Requer Node.js 20.12 ou superior.

```bash
npm install
cp .env.example .env     # ajuste se quiser
npm run dev              # desenvolvimento, com recarga automática
```

Abra http://localhost:3333/docs para ver a documentação interativa (Swagger).

A primeira sincronização leva cerca de 1 minuto por ano. Depois disso a API sobe em segundos, usando o cache.

Produção:

```bash
npm run build
npm start
```

Outros comandos:

| Comando | O que faz |
|---|---|
| `npm test` | Roda os testes (vitest) |
| `npm run typecheck` | Checa os tipos do TypeScript |
| `npm run sync` | Sincroniza sem subir o servidor (`-- --forcar` reimporta tudo) |

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/v1/srag/casos` | Lista paginada de casos (`pagina`, `limite` ≤ 100, `ordem`) |
| GET | `/v1/srag/casos/:id` | Um caso, pelo número da notificação |
| GET | `/v1/srag/resumo` | Totais: casos, internações, UTI, óbitos e distribuições |
| GET | `/v1/srag/semanas` | Série por semana epidemiológica, com média móvel (`janela`) |
| GET | `/v1/srag/dicionario` | Significado de cada valor usado nas respostas |
| GET | `/v1/fonte` | Arquivo usado para cada ano, data de publicação e status da sincronização |
| GET | `/health` | Saúde da API: `200` se ok ou degradada, `503` se indisponível |
| GET | `/status` | Página de status (HTML) com dados, sincronização e métricas |
| GET | `/status.json` | As mesmas informações de `/status`, em JSON |
| POST | `/v1/admin/sincronizar` | Força a sincronização (requer `Authorization: Bearer <ADMIN_TOKEN>`) |

Filtros aceitos em `/casos`, `/resumo` e, em parte, em `/semanas`:

- `ano`, `semanaInicio`, `semanaFim`
- `dataInicio`, `dataFim` (datas no formato AAAA-MM-DD)
- `classificacao`, `evolucao`, `sexo`, `faixaEtaria`, `agente`
- `hospitalizado`, `uti`

Filtros de lista aceitam vários valores separados por vírgula.

Exemplos:

```bash
# Óbitos por SRAG em 2026
curl "localhost:3333/v1/srag/casos?ano=2026&evolucao=obito"

# Crianças menores de 1 ano com VSR
curl "localhost:3333/v1/srag/casos?faixaEtaria=menor_1&agente=vsr"

# Resumo de 2025 e 2026 juntos
curl "localhost:3333/v1/srag/resumo?ano=2025,2026"

# Série semanal de 2026 com média móvel de 4 semanas
curl "localhost:3333/v1/srag/semanas?ano=2026&janela=4"
```

### Coleção do Insomnia

O arquivo [insomnia.json](insomnia.json) tem todas as rotas, organizadas em pastas e com exemplos de filtros. Para importar: **Insomnia → Import → From File → `insomnia.json`**.

No ambiente **Local**, ajuste as variáveis:

- `base_url`: endereço da API
- `admin_token`: o mesmo `ADMIN_TOKEN` do `.env`
- `ano`: ano usado nas requests de exemplo
- `caso_id`: id usado na request "Caso por id"

Erros seguem sempre o mesmo formato:

```json
{ "erro": { "codigo": "PARAMETROS_INVALIDOS", "mensagem": "...", "detalhes": [] } }
```

## Observabilidade

### Página de status

Abra **http://localhost:3333/status** no navegador. A página recarrega sozinha a cada 30 s e mostra:

- **Saúde:** *Operacional*, *Degradado* ou *Indisponível*, com o motivo.
- **Dados carregados:** arquivo do Ministério usado em cada ano, data de publicação, data de importação e número de casos.
- **Sincronização:** resultado da última execução por ano, último sucesso e próxima verificação.
- **Requisições por rota:** total, erros 4xx e 5xx, tempo médio e p95.
- **Processo:** tempo no ar e memória.
- **Monitoramento externo:** quais integrações estão ativas.

Para usar em scripts, as mesmas informações saem em JSON em `/status.json`.

As métricas ficam em memória e zeram quando o servidor reinicia. Para histórico, use os serviços abaixo.

### Regras do `/health`

| Status | HTTP | Quando |
|---|---|---|
| `ok` | 200 | Dados carregados e sincronização em dia |
| `degradado` | 200 | A última sincronização falhou, mas ainda há uma bem-sucedida dentro do limite. Os dados servidos continuam válidos |
| `indisponivel` | 503 | Nenhum dado carregado, ou nenhuma sincronização bem-sucedida há mais de `SAUDE_MAX_HORAS_SEM_SYNC` horas (padrão: 36) |

O limite padrão de 36 h, com sincronização a cada 12 h, tolera duas falhas seguidas do OpenDataSUS antes de acusar indisponibilidade. Com `SYNC_INTERVALO_HORAS=0`, o prazo de sincronização não é cobrado.

### Alertas externos (gratuitos e opcionais)

Todos são opcionais: sem as variáveis no `.env`, a API funciona igual.

**UptimeRobot ou Better Stack (API fora do ar).** Não exige código.
1. Crie um monitor HTTP para `https://<seu-domínio>/health`.
2. Configure o alerta para qualquer resposta diferente de 2xx.

O serviço precisa alcançar a API, então só funciona com ela hospedada num endereço público.

**Healthchecks.io (sincronização parou).**
1. Crie um check com *Period* igual a `SYNC_INTERVALO_HORAS` (ex.: 12 h) e *Grace* de cerca de 1 h.
2. Copie a URL de ping para `HEALTHCHECKS_URL`.

A cada sincronização, a API avisa o início (`/start`), o sucesso ou a falha (`/fail`), com o resultado de cada ano no corpo. Você recebe alerta se a sincronização falhar ou se parar de rodar. Funciona mesmo com a API rodando só localmente, porque é ela que chama o serviço.

**Sentry (erros).**
1. Crie um projeto Node.js.
2. Copie o DSN para `SENTRY_DSN`.

São enviados os erros 500 (com método e rota) e as falhas de sincronização. Erros de validação (400) e de recurso inexistente (404) não são enviados.

## Configuração (`.env`)

Veja todas as opções comentadas em [.env.example](.env.example). As principais:

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3333` | Porta HTTP |
| `MUNICIPIO_IBGE` | `280350` | Código IBGE de 6 dígitos do município (dá para usar outra cidade) |
| `ANOS` | ano atual e anterior | Ex.: `2019-2026` ou `2024,2025,2026` |
| `SYNC_INTERVALO_HORAS` | `12` | Intervalo para procurar arquivos novos (`0` desativa) |
| `ADMIN_TOKEN` | vazio | Habilita `POST /v1/admin/sincronizar` (mínimo de 24 caracteres) |
| `SAUDE_MAX_HORAS_SEM_SYNC` | `36` | Horas sem sincronização bem-sucedida até `/health` responder 503 |
| `HEALTHCHECKS_URL` | vazio | URL de ping do Healthchecks.io |
| `SENTRY_DSN` | vazio | DSN do projeto no Sentry |

## Sobre os dados

- **O que conta como caso:** SRAG hospitalizado ou óbito por SRAG, notificado no SIVEP-Gripe, de pacientes que **moram** em Lagarto. O município de notificação ou de internação pode ser outro, como Aracaju.
- **O que é "ano":** o ano do arquivo do Ministério, que corresponde ao ano epidemiológico da data dos primeiros sintomas.
- **Semana epidemiológica:** a API calcula a semana a partir da data de início dos sintomas, pelo calendário oficial (domingo a sábado; a semana 1 é a que contém 4 de janeiro). A coluna `SEM_PRI` do arquivo de 2026 vem **adiantada em uma semana**: 04/01/2026 aparece como SE 02, mas pelo calendário oficial é a SE 01. Por isso a API não usa essa coluna.
- **Atraso de notificação:** as últimas semanas sempre aparecem com menos casos do que terão depois. Os casos `em_investigacao` (sem classificação final) e `em_aberto` (sem evolução) são atualizados nas semanas seguintes.
- **Privacidade:** data de nascimento, ocupação, lotes de vacina e campos de texto livre **não são importados**.
- **Fonte:** Ministério da Saúde, SIVEP-Gripe, via OpenDataSUS. O [dicionário de dados](https://s3.sa-east-1.amazonaws.com/ckan.saude.gov.br/SRAG/dicionario-de-dados-2019-a-2025.pdf) descreve cada variável original.

## Estrutura

```
src/
├── config/env.ts                 # variáveis de ambiente validadas (zod)
├── shared/                       # logger, erros, semana epidemiológica
├── modules/srag/
│   ├── srag.codes.ts             # códigos do dicionário de dados → valores da API
│   ├── srag.mapper.ts            # linha do CSV → CasoSrag
│   ├── srag.repository.ts        # interface SragRepository + implementação em memória
│   ├── srag.service.ts           # consultas, resumo e série semanal
│   ├── srag.schemas.ts           # validação dos parâmetros
│   ├── srag.controller.ts
│   └── srag.routes.ts
├── modules/sistema/              # /health, /status, /v1/fonte, /v1/admin
├── observability/
│   ├── metricas.ts               # contadores e tempo de resposta por rota
│   ├── saude.ts                  # regras de ok / degradado / indisponível
│   ├── status.ts                 # página /status
│   ├── monitoramento.ts          # Healthchecks.io e envio de erros
│   └── sentry.ts                 # integração com o Sentry
├── ingestion/
│   ├── opendatasus.client.ts     # descobre e baixa os CSVs
│   ├── csv-ingestor.ts           # leitura em streaming + filtro do município
│   ├── file-cache.ts             # cache local em ./data
│   └── sync.service.ts           # orquestra a sincronização
├── docs/openapi.ts               # especificação OpenAPI (/docs e /openapi.json)
├── container.ts                  # monta as dependências
├── app.ts                        # aplicação Express
└── server.ts                     # inicialização e encerramento gracioso
```

## Próximo passo: MongoDB

Todo o acesso a dados passa pela interface `SragRepository` ([src/modules/srag/srag.repository.ts](src/modules/srag/srag.repository.ts)). Para usar o MongoDB:

1. Criar `MongoSragRepository`, que implementa a mesma interface.
2. Passar essa implementação em `criarContainer()` ([src/container.ts](src/container.ts)).

Nenhuma rota, serviço ou teste precisa mudar.
