# API SRAG Lagarto-SE

API com os casos de **Síndrome Respiratória Aguda Grave (SRAG)** de moradores de Lagarto-SE, de **2019 até hoje**. Ela permite comparar o período da pandemia com os anos seguintes. Os dados vêm dos microdados abertos do **SIVEP-Gripe**, que o Ministério da Saúde publica no [OpenDataSUS](https://dadosabertos.saude.gov.br/dataset/srag-2019-a-2026).

> Versão 1 (COVID-19 e vacinação, com MongoDB e Redis) está no histórico do git, até o commit `9dc3187`.

## Como funciona

```
                    ┌─────────────────────────────────────────┐
 OpenDataSUS  ────► │ npm run sync  (GitHub Actions, diário)  │
 CSV nacional       │  1. descobre o CSV mais recente do ano  │
 ~50 MB a 1,8 GB    │  2. lê em streaming, sem carregar tudo  │
 por ano            │  3. mantém só residentes de Lagarto     │
                    │  4. converte os códigos do dicionário   │
                    └───────────────────┬─────────────────────┘
                                        │ grava
                                        ▼
                         MongoDB Atlas M0 (grátis)
                         casos · fontes · sincronizacoes
                                        ▲
                                        │ lê (usuário só leitura)
                    ┌───────────────────┴─────────────────────┐
                    │ API Express na Vercel (grátis)          │
                    │ /v1/srag/... · /status · /docs          │
                    └─────────────────────────────────────────┘
```

- **Povoar (uma vez, na sua máquina):** `npm run povoar` importa 2019 até o ano atual para o MongoDB.
- **Verificação diária (GitHub Actions):** compara o nome do arquivo de cada ano com o que está registrado na coleção `fontes` e só baixa os anos que mudaram. Sem arquivo novo, a execução leva cerca de 1 segundo.
- **O ano inteiro é substituído** quando muda, numa **transação**. O Ministério revisa casos antigos (classificação final, evolução) e às vezes republica anos "congelados". A API nunca vê um ano pela metade.
- **A API só lê.** Ela guarda em memória o que leu do banco por `MONGO_CACHE_SEGUNDOS` (padrão: 60 s) e confere se algo mudou. Isso deixa as respostas rápidas e mantém o uso do Atlas bem abaixo do limite de 100 operações por segundo do plano gratuito.
- **Antes da primeira importação**, as rotas de dados respondem `503` com `Retry-After`, em vez de devolver listas vazias.
- **Sem `MONGO_URI`**, tudo funciona em memória, com cache em `./data`. É o modo usado nos testes e para desenvolver sem banco.

## Rodando localmente

Requer Node.js 20.12 ou superior.

```bash
npm install
cp .env.example .env     # coloque a MONGO_URI (ou deixe vazia para usar memória)
npm run dev              # servidor com recarga automática
```

Abra http://localhost:3333/docs para ver a documentação interativa (Swagger).

| Comando | O que faz |
|---|---|
| `npm run povoar` | Importa de 2019 até o ano atual. Só baixa os anos que ainda não estão no banco ou que mudaram |
| `npm run sync` | Sincroniza os anos de `ANOS` (`-- --forcar` reimporta mesmo sem arquivo novo; `-- --anos=2024,2025` escolhe os anos) |
| `npm test` | Roda os testes (vitest, com um MongoDB real em memória) |
| `npm run typecheck` | Checa os tipos do TypeScript |
| `npm run build` / `npm start` | Compila e roda o servidor de produção (fora da Vercel) |

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/v1/srag/casos` | Lista paginada de casos (`pagina`, `limite` ≤ 100, `ordem`) |
| GET | `/v1/srag/casos/:id` | Um caso, pelo número da notificação |
| GET | `/v1/srag/resumo` | Totais: casos, internações, UTI, óbitos e distribuições |
| GET | `/v1/srag/semanas` | Série por semana epidemiológica, com média móvel (`janela`) |
| GET | `/v1/srag/anos` | Uma linha por ano, com comparação ao ano anterior. O ano corrente é comparado com as mesmas semanas do ano anterior |
| GET | `/v1/srag/dicionario` | Significado de cada valor usado nas respostas |
| GET | `/v1/fonte` | Arquivo usado para cada ano, data de publicação e status da sincronização |
| GET | `/health` | Saúde da API: `200` se ok ou degradada, `503` se indisponível |
| GET | `/status` | Página de status (HTML) com dados, sincronização e métricas |
| GET | `/status.json` | As mesmas informações de `/status`, em JSON |
| POST | `/v1/admin/sincronizar` | Força a sincronização (requer `Authorization: Bearer <ADMIN_TOKEN>`). Só existe quando a API roda como servidor; na Vercel, use o botão *Run workflow* do GitHub Actions |

Filtros aceitos em `/casos` e `/resumo`. Em `/semanas` e `/anos`, valem todos menos os de período:

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

# Pandemia vs. hoje: casos por ano, só de covid-19
curl "localhost:3333/v1/srag/anos?classificacao=covid19"
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

O histórico de sincronizações fica gravado no banco. Por isso a API na Vercel enxerga as execuções feitas pelo GitHub Actions. O limite de 36 h, com sincronização diária, tolera uma falha do OpenDataSUS antes de acusar indisponibilidade. Se mudar o workflow para semanal, use `SAUDE_MAX_HORAS_SEM_SYNC=192`. Com `0`, o prazo não é cobrado.

Na Vercel, as métricas de requisições da página `/status` valem só para a instância que respondeu, porque podem existir várias e elas reiniciam. Dados, sincronização e saúde vêm do banco e são sempre os mesmos.

### Alertas externos (gratuitos e opcionais)

Todos são opcionais: sem as variáveis no `.env`, a API funciona igual.

**UptimeRobot ou Better Stack (API fora do ar).** Não exige código.
1. Crie um monitor HTTP para `https://<seu-domínio>/health`.
2. Configure o alerta para qualquer resposta diferente de 2xx.

O serviço precisa alcançar a API, então só funciona com ela hospedada num endereço público.

**Healthchecks.io (sincronização parou).**
1. Crie um check com *Period* de 1 dia e *Grace* de cerca de 2 h.
2. Cadastre a URL de ping como segredo `HEALTHCHECKS_URL` no GitHub.

A cada execução, o job avisa o início (`/start`), o sucesso ou a falha (`/fail`), com o resultado de cada ano no corpo. Você recebe alerta se a sincronização falhar ou se parar de rodar.

**Sentry (erros).**
1. Crie um projeto Node.js.
2. Copie o DSN para `SENTRY_DSN`, na Vercel e como segredo no GitHub.

São enviados os erros 500 (com método e rota) e as falhas de sincronização. Erros de validação (400) e de recurso inexistente (404) não são enviados.

## Publicando de graça: MongoDB Atlas + GitHub Actions + Vercel

Nada aqui exige cartão de crédito.

### 1. MongoDB Atlas

1. Crie uma conta em [mongodb.com/atlas](https://www.mongodb.com/atlas) e um cluster **M0 (Free)**.
2. Em **Database Access**, crie dois usuários com senhas fortes:
   - `srag-sync` com o papel **readWrite** no banco `srag_lagarto`, para o povoamento e o GitHub Actions;
   - `srag-api` com o papel **read** no banco `srag_lagarto`, para a Vercel.
3. Em **Network Access**, libere `0.0.0.0/0`. A Vercel e o GitHub Actions não têm IP fixo, por isso as senhas fortes e o usuário só de leitura importam.
4. Em **Connect → Drivers**, copie a string de conexão, `mongodb+srv://...`.

### 2. Povoar o banco (uma vez, na sua máquina)

No `.env`, coloque a string do usuário `srag-sync`:

```bash
MONGO_URI=mongodb+srv://srag-sync:<senha>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
MONGO_DB=srag_lagarto
```

```bash
npm run povoar
```

O script baixa os arquivos nacionais de 2019 até hoje, que somam alguns GB (só o de 2021 tem 1,8 GB), e grava apenas os casos de Lagarto. O tempo depende da sua internet: nos testes, 640 MB levaram de 2 a 8 minutos. Se cair no meio, rode de novo; os anos já importados são pulados. No fim, a tabela mostra quantos casos entraram por ano.

### 3. GitHub Actions (atualização diária)

Em **Settings → Secrets and variables → Actions** do repositório:

| Tipo | Nome | Valor |
|---|---|---|
| Secret | `MONGO_URI` | string do usuário `srag-sync` |
| Secret | `HEALTHCHECKS_URL` | (opcional) URL de ping do Healthchecks.io |
| Secret | `SENTRY_DSN` | (opcional) DSN do Sentry |
| Variable | `MONGO_DB` | (opcional) nome do banco, se não for `srag_lagarto` |

O workflow [.github/workflows/sincronizar.yml](.github/workflows/sincronizar.yml):
- **Roda todo dia às 06:00 (horário de Brasília).** Para mudar para semanal, troque o `cron` por `'0 9 * * 1'`.
- **Pode ser disparado à mão** em **Actions → Sincronizar dados SRAG → Run workflow**, com a opção de reimportar tudo.
- **Mantém o próprio agendamento ativo.** O GitHub desativa agendamentos de repositórios públicos após 60 dias sem commits, e o último passo do job reativa o workflow pela API a cada execução.

Em repositório público, os minutos do GitHub Actions são ilimitados.

### 4. Vercel (API)

1. Em [vercel.com](https://vercel.com), entre com o GitHub e importe este repositório. A Vercel detecta o Express sozinha pela entrada [index.ts](index.ts).
2. Em **Settings → Environment Variables**, cadastre:

| Nome | Valor |
|---|---|
| `MONGO_URI` | string do usuário **`srag-api`** (só leitura) |
| `MONGO_DB` | `srag_lagarto` |
| `NODE_ENV` | `production` |
| `TRUST_PROXY` | `1` |
| `SENTRY_DSN` | (opcional) |

3. Faça o deploy. A API fica em `https://<projeto>.vercel.app`, com HTTPS. A cada push na branch principal, ela é publicada de novo.

O plano Hobby da Vercel é gratuito para uso pessoal e não comercial. Na Vercel, a API não sincroniza nem grava nada; quem faz isso é o GitHub Actions.

### Rodando como servidor comum

Fora da Vercel, `npm run build && npm start` sobe a API como um processo normal, que também sincroniza sozinho a cada `SYNC_INTERVALO_HORAS`. Atrás de um proxy reverso na mesma máquina, use `HOST=127.0.0.1` e `TRUST_PROXY=loopback`.

## Configuração (`.env`)

Veja todas as opções comentadas em [.env.example](.env.example). As principais:

| Variável | Padrão | Descrição |
|---|---|---|
| `MONGO_URI` | vazio | String de conexão do MongoDB. Vazio = memória + cache em `./data` |
| `MONGO_DB` | `srag_lagarto` | Nome do banco |
| `MONGO_CACHE_SEGUNDOS` | `60` | Por quanto tempo a API reaproveita o que leu do banco (`0` = sem cache) |
| `ANOS` | ano atual e anterior | Anos sincronizados: `2019-atual`, `2024,2025`... (`npm run povoar` usa `2019-atual`) |
| `PORT` | `3333` | Porta HTTP |
| `HOST` | todas | Interface de rede |
| `TRUST_PROXY` | vazio | Proxies confiáveis para obter o IP real do visitante (Vercel: `1`; proxy local: `loopback`). `true` é recusado |
| `MUNICIPIO_IBGE` | `280350` | Código IBGE de 6 dígitos do município (dá para usar outra cidade) |
| `SYNC_INTERVALO_HORAS` | `12` | Só no modo servidor: intervalo para procurar arquivos novos (`0` desativa) |
| `ADMIN_TOKEN` | vazio | Só no modo servidor: habilita `POST /v1/admin/sincronizar` (mínimo de 24 caracteres) |
| `SAUDE_MAX_HORAS_SEM_SYNC` | `36` | Horas sem sincronização bem-sucedida até `/health` responder 503 (`0` = não cobrar) |
| `HEALTHCHECKS_URL` | vazio | URL de ping do Healthchecks.io |
| `SENTRY_DSN` | vazio | DSN do projeto no Sentry |

## Sobre os dados

- **O que conta como caso:** SRAG hospitalizado ou óbito por SRAG, notificado no SIVEP-Gripe, de pacientes que **moram** em Lagarto. O município de notificação ou de internação pode ser outro, como Aracaju.
- **O que é "ano":** o ano do arquivo do Ministério, que corresponde ao ano epidemiológico da data dos primeiros sintomas.
- **Comparando anos:** em `/v1/srag/anos`, os anos fechados são comparados pelo total. O ano corrente é comparado com **as mesmas semanas** do ano anterior, porque a SRAG é sazonal e comparar meio ano com um ano inteiro distorceria o resultado. Em 2020 e 2021, a maior parte dos casos é covid-19; use `classificacao=covid19` para isolar.
- **Semana epidemiológica:** a API calcula a semana a partir da data de início dos sintomas, pelo calendário oficial (domingo a sábado; a semana 1 é a que contém 4 de janeiro). A coluna `SEM_PRI` do arquivo de 2026 vem **adiantada em uma semana**: 04/01/2026 aparece como SE 02, mas pelo calendário oficial é a SE 01. Por isso a API não usa essa coluna.
- **Atraso de notificação:** as últimas semanas sempre aparecem com menos casos do que terão depois. Os casos `em_investigacao` (sem classificação final) e `em_aberto` (sem evolução) são atualizados nas semanas seguintes.
- **Privacidade:** data de nascimento, ocupação, lotes de vacina e campos de texto livre **não são importados**.
- **Fonte:** Ministério da Saúde, SIVEP-Gripe, via OpenDataSUS. O [dicionário de dados](https://s3.sa-east-1.amazonaws.com/ckan.saude.gov.br/SRAG/dicionario-de-dados-2019-a-2025.pdf) descreve cada variável original.

## Estrutura

```
index.ts                          # entrada da Vercel (modo serverless, só leitura)
src/
├── config/env.ts                 # variáveis de ambiente validadas (zod)
├── shared/                       # logger, erros, semana epidemiológica
├── modules/srag/
│   ├── srag.codes.ts             # códigos do dicionário de dados → valores da API
│   ├── srag.mapper.ts            # linha do CSV → CasoSrag
│   ├── srag.repository.ts        # interface SragRepository + implementação em memória
│   ├── srag.mongo.repository.ts  # implementação no MongoDB (transações e índices)
│   ├── srag.cached.repository.ts # cache de leitura na frente do MongoDB
│   ├── srag.service.ts           # consultas, resumo, série semanal e comparativo anual
│   ├── srag.schemas.ts           # validação dos parâmetros
│   ├── srag.controller.ts
│   └── srag.routes.ts
├── modules/sistema/              # /health, /status, /v1/fonte, /v1/admin e estado dos dados
├── observability/                # métricas, saúde, página de status, Healthchecks.io e Sentry
├── ingestion/
│   ├── opendatasus.client.ts     # descobre e baixa os CSVs
│   ├── csv-ingestor.ts           # leitura em streaming + filtro do município
│   ├── file-cache.ts             # cache local em ./data (modo sem MongoDB)
│   └── sync.service.ts           # orquestra a sincronização
├── docs/                         # especificação OpenAPI e página do Swagger UI
├── scripts/sync.ts               # npm run sync / npm run povoar
├── container.ts                  # escolhe o armazenamento e monta as dependências
├── serverless.ts                 # app sem sincronização (usado pela Vercel)
├── app.ts                        # aplicação Express
└── server.ts                     # modo servidor, com sincronização agendada
.github/workflows/sincronizar.yml # sincronização diária no GitHub Actions
```

Os testes ([tests/](tests/)) rodam as mesmas verificações na implementação em memória, no MongoDB e no MongoDB com cache, e conferem que as três respondem igual.
