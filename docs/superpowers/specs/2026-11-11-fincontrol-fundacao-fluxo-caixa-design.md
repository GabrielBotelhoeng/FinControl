# FinControl — Sub-projeto 1: Fundação + Fluxo de Caixa

- **Data:** 2026-11-11
- **Status:** Aguardando revisão
- **Origem:** `Ideia Projeto.txt` (raiz do repositório) + sessão de brainstorming

---

## 1. Contexto

FinControl é uma plataforma de gestão financeira pessoal (web responsivo + PWA), em português do Brasil e em reais. É um **projeto de portfólio** com dois públicos:

- **Tech leads e recrutadores**: vão avaliar arquitetura, testes, CI/CD, deploy e legibilidade do código.
- **Clientes em potencial**: vão avaliar visual, experiência de uso e uma demo navegável.

Não há prazo. A prioridade é qualidade, um sub-projeto por vez.

### 1.1 Roadmap de sub-projetos

O documento de ideia tem 10 módulos. Eles foram divididos em 7 sub-projetos. Cada um tem sua própria spec, plano e implementação, e termina **no ar, testado e com dados na conta demo**.

| # | Sub-projeto | Módulos da ideia |
|---|---|---|
| **1** | **Fundação + fluxo de caixa** (este documento) | 01 (parcial), 02, 10 (parcial) |
| 2 | Cartões de crédito | 04 |
| 3 | Dívidas | 03 |
| 4 | Planejamento + metas | 05, 06 |
| 5 | Relatórios e exportação (PDF/CSV) + dashboard completo | 07, 01 |
| 6 | Notificações | 09 |
| 7 | Assistente financeiro com IA (por decisão do usuário, fica por último) | 08 |

### 1.2 Objetivo deste sub-projeto

Entregar um produto já demonstrável:

- autenticação;
- contas e categorias;
- receitas, despesas e transferências (fixas, variáveis e recorrentes);
- histórico com filtros;
- dashboard básico;
- conta demo isolada por visitante;
- PWA, CI e deploy.

É também a base técnica que todos os sub-projetos seguintes reutilizam: arquitetura, design system, autenticação, seed e pipeline.

---

## 2. Decisões e motivos

| # | Decisão | Alternativas descartadas | Motivo |
|---|---|---|---|
| D1 | API Express é a dona das regras de negócio. O Supabase entra só como infraestrutura (Postgres + Auth) | Supabase como backend principal com RLS; Next.js full-stack | Mostra arquitetura em camadas e testável, que é o que o tech lead avalia. As regras ficam em um só lugar. O usuário já domina o padrão |
| D2 | Várias contas (corrente, poupança, carteira, investimento) com transferências | Saldo único | É o modelo dos apps maduros. É pré-requisito para cartões (a fatura é paga a partir de uma conta) e para metas (o depósito sai de uma conta) |
| D3 | Supabase Auth. O front faz o login e a API valida o JWT | Autenticação própria no Express | É seguro e já pronto (e-mail, Google, recuperação de senha). Autenticação própria traria risco sem ganho visível |
| D4 | Demo isolada por visitante, via login anônimo do Supabase + seed gerado | Conta compartilhada com reset noturno; demo somente leitura | Um visitante não interfere no outro e a experiência é completa. Ainda demonstra engenharia (seed dinâmico + limpeza agendada) |
| D5 | Dinheiro em centavos inteiros (`BIGINT`) | `float`, `numeric` com casas decimais na aplicação | Evita erro de arredondamento. A aritmética fica exata em TypeScript (`number` até 2^53 cobre qualquer valor pessoal) |
| D6 | Monorepo com pnpm workspaces: `apps/web`, `apps/api`, `packages/shared` | Repositórios separados | Schemas Zod compartilhados entre front e back e um CI único |
| D7 | Prisma como ORM | Drizzle, SQL puro | Migrations maduras e tipagem forte. O usuário já tem experiência (StudyManager) |
| D8 | Deploy de web e API na Vercel; cron pelo Vercel Cron | Render/Railway para a API | A Vercel roda Express nativamente (Fluid Compute). Um provedor só, plano gratuito e preview por PR |
| D9 | Ocorrências de recorrência criadas sob demanda e de forma idempotente | Cron que pré-gera ocorrências; ocorrências virtuais (nunca persistidas) | Persistir permite marcar uma ocorrência como paga e editá-la. Gerar sob demanda dispensa job e não deixa buracos |

---

## 3. Arquitetura

```
FinControl/
├── apps/
│   ├── web/        React 19 + Vite + TS + Tailwind + shadcn/ui (PWA)
│   └── api/        Express 5 + TS + Prisma + Zod
├── packages/
│   └── shared/     Schemas Zod, tipos e utilitários de dinheiro/data
├── docs/
├── .github/workflows/
└── docker-compose.yml   Postgres local para dev e testes
```

### 3.1 `apps/api` — camadas

```
src/
├── http/           app.ts, rotas, middlewares (auth, error, request-id, rate-limit)
├── modules/
│   ├── accounts/       routes → controller → service → repository
│   ├── categories/
│   ├── transactions/
│   ├── recurrences/
│   ├── dashboard/
│   ├── profile/
│   └── demo/
├── domain/         Regras puras, sem I/O: saldo, recorrência, cálculo de período
├── infra/          Cliente Prisma, verificador de JWT, cliente admin do Supabase, logger
└── config/         Variáveis de ambiente validadas com Zod na inicialização
```

Regras da arquitetura:

- **Controllers** só traduzem HTTP para chamadas de service. Não contêm regra de negócio.
- **Services** orquestram e aplicam as regras de negócio.
- **Repositories** são o único lugar que fala com o Prisma. Todo método recebe `userId` e filtra por ele.
- **`domain/`** só tem funções puras, testáveis sem banco.
- A verificação do JWT é **injetável**. Em produção valida contra o JWKS do Supabase; nos testes usa um par de chaves local.

### 3.2 `apps/web`

```
src/
├── app/            Rotas (React Router), providers (Query, Theme, Auth), layout
├── features/       accounts, categories, transactions, dashboard, profile, auth, demo
│                   cada feature: components/, hooks/ (TanStack Query), api.ts
├── components/ui/  Componentes do shadcn/ui
└── lib/            Cliente HTTP (anexa o JWT), cliente Supabase, formatadores pt-BR
```

- Formulários com `react-hook-form` + `zodResolver`, usando os schemas de `packages/shared`.
- Campo de valor com máscara BRL. Internamente, sempre centavos.
- Gráficos com Recharts.
- PWA com `vite-plugin-pwa`: instalável, com manifest e shell offline. **Os dados não funcionam offline** neste sub-projeto.

### 3.3 `packages/shared`

- Schemas Zod de entrada e saída de cada endpoint, e os tipos inferidos a partir deles.
- `money.ts`: conversão de centavos para exibição em BRL e vice-versa.
- `dates.ts`: operações de data no fuso `America/Sao_Paulo`: hoje, início e fim de mês, último dia do mês.

---

## 4. Modelo de dados

Todas as tabelas ficam no schema `public` e têm `id uuid`, `created_at` e `updated_at`. Valores monetários são `BIGINT` em centavos e sempre **positivos**: o sinal é derivado do tipo. Datas de vencimento e pagamento são `DATE` (sem hora).

### `profiles`
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | Igual ao `sub` do JWT (id do usuário no Supabase Auth) |
| name | text | |
| is_demo | boolean | `true` para usuários anônimos |
| theme | enum `light \| dark \| system` | Padrão `system` |

### `accounts`
| Campo | Tipo | Notas |
|---|---|---|
| user_id | uuid FK → profiles | Índice |
| name | text | Único por usuário entre as contas não arquivadas |
| type | enum `checking \| savings \| wallet \| investment` | |
| color | text | Hex |
| initial_balance | bigint | Pode ser negativo (conta já no cheque especial) |
| archived_at | timestamptz null | |

### `categories`
| Campo | Tipo | Notas |
|---|---|---|
| user_id | uuid FK | |
| name | text | Único por (user_id, type) |
| type | enum `income \| expense` | |
| icon | text | Nome de ícone do Lucide |
| color | text | Hex |

### `recurrences`
| Campo | Tipo | Notas |
|---|---|---|
| user_id | uuid FK | |
| frequency | enum `weekly \| monthly \| yearly` | |
| start_date | date | Primeira ocorrência |
| end_date | date null | Inclusiva; `null` = sem fim |
| template | campos espelhados de transaction | type, amount, description, account_id, destination_account_id, category_id, nature |

### `transactions`
| Campo | Tipo | Notas |
|---|---|---|
| user_id | uuid FK | Índice (user_id, due_date) |
| type | enum `income \| expense \| transfer` | |
| amount | bigint | > 0 |
| description | text | 1 a 120 caracteres |
| account_id | uuid FK → accounts | Origem, no caso de transferência |
| destination_account_id | uuid FK null | Obrigatório só em `transfer`, e diferente de `account_id` |
| category_id | uuid FK null | Obrigatório em `income` e `expense` (com o mesmo tipo da categoria); `null` em `transfer` |
| nature | enum `fixed \| variable` null | Obrigatório em `income` e `expense`; `null` em `transfer` |
| status | enum `pending \| paid` | |
| due_date | date | |
| paid_date | date null | Obrigatório quando o status é `paid` |
| recurrence_id | uuid FK null | |
| occurrence_date | date null | Data "de origem" na série. Único (recurrence_id, occurrence_date) |

### `recurrence_skips`
| Campo | Tipo | Notas |
|---|---|---|
| recurrence_id | uuid FK → recurrences | `ON DELETE CASCADE` |
| occurrence_date | date | Único (recurrence_id, occurrence_date). Datas que a materialização não deve recriar (ver seção 5.3) |

### Segurança no banco

- **RLS ligado em todas as tabelas, sem nenhuma policy.** Assim os papéis `anon` e `authenticated` não conseguem acessar nada pela API REST automática do Supabase, cuja chave pública fica no front.
- A API conecta como o papel do banco usado pelo Prisma, que ignora o RLS. Por isso, o isolamento entre usuários é garantido nos repositories (ver seção 5.6).

---

## 5. Regras de negócio

### 5.1 Saldo
- `saldo(conta)` = `initial_balance` + receitas pagas − despesas pagas + transferências pagas recebidas − transferências pagas enviadas.
- **Saldo total** = soma dos saldos das contas não arquivadas.
- **Previsão de fim de mês** = saldo total + receitas pendentes − despesas pendentes com `due_date` até o fim do mês corrente, incluindo as vencidas. Transferências não alteram o total.
- Todo lançamento conta só na data de pagamento. Nada é contabilizado antes de ser pago.

### 5.2 Transações
- Criar com `status = paid` exige `paid_date`. O padrão é hoje, e a data não pode estar no futuro.
- "Marcar como pago" define `status = paid` e `paid_date = hoje`, editável. "Desmarcar" volta para `pending` e limpa `paid_date`.
- **Vencida**: `pending` com `due_date` < hoje.
- Não é permitido lançar em conta arquivada.

### 5.3 Recorrências
- Criar um lançamento com "repetir" cria uma `recurrence` e a primeira ocorrência.
- **Materialização sob demanda.** Toda leitura de período passa pelo `RecurrenceMaterializer`: listagem de transações, dashboard e evolução. Antes de consultar, ele cria as ocorrências que faltam de cada recorrência ativa do usuário, de `start_date` até `min(fim do período, end_date, hoje + 12 meses)`.
  - A gravação é idempotente: um `INSERT ... ON CONFLICT (recurrence_id, occurrence_date) DO NOTHING`.
- **Dia inexistente no mês** (ex.: dia 31 em fevereiro): a ocorrência vai para o último dia do mês. A `occurrence_date` continua sendo calculada a partir do dia original.
- Ocorrências nascem `pending`, com `due_date = occurrence_date`.
- **Editar uma ocorrência**:
  - "Só esta": altera apenas a transação. Ela continua ligada à série, mas a materialização nunca a sobrescreve.
  - "Esta e as próximas": encerra a recorrência atual no dia anterior a essa ocorrência e cria uma nova recorrência com o novo template a partir dela. As ocorrências **pendentes** futuras da série antiga são removidas e regeneradas pela nova; as já **pagas** nunca são alteradas.
- **Excluir uma ocorrência**:
  - "Só esta": remove a transação e registra a data como **pulada**, para a materialização não recriá-la. A tabela `recurrence_skips (recurrence_id, occurrence_date)` tem uma chave única.
  - "Esta e as próximas": encerra a recorrência e remove as ocorrências pendentes a partir dela.

### 5.4 Transferências
- São um único registro com origem e destino. Aparecem nos dois extratos, com sinais opostos.
- Não entram em "receitas do mês", "despesas do mês" nem em "gastos por categoria".

### 5.5 Contas e categorias
- Uma conta com transações **não pode ser excluída**, só arquivada. Uma conta sem transações pode ser excluída.
- As contas arquivadas somem dos seletores e do saldo total, mas continuam no histórico.
- **Ao excluir uma categoria em uso**, é obrigatório informar `reassignTo`, uma categoria do mesmo tipo que recebe os lançamentos e o template das recorrências. Se a categoria não estiver em uso, a exclusão é direta.
- **Provisionamento:** na primeira requisição autenticada de um usuário, a API cria o `profile` e as categorias padrão. A operação é idempotente.
  - **Despesa:** Moradia, Alimentação, Transporte, Saúde, Educação, Lazer, Assinaturas, Compras, Contas, Outros.
  - **Receita:** Salário, Freelance, Rendimentos, Outros.

### 5.6 Isolamento entre usuários
- O `userId` vem **somente** do `sub` do JWT validado, nunca do body nem da query.
- Todo repository filtra por `user_id`. Quando um recurso existe mas pertence a outro usuário, a resposta é **404**, nunca 403, para não revelar que o recurso existe.
- IDs vindos do cliente (conta, categoria, destino) são validados como pertencentes ao usuário antes de gravar.

---

## 6. API REST

Base `/api/v1`. Todas as rotas exigem `Authorization: Bearer <jwt>`, exceto `/health` e `/internal/*`, que usam um segredo próprio.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Status e versão |
| GET / PATCH / DELETE | `/me` | Perfil. O DELETE apaga todos os dados e o usuário no Supabase Auth (LGPD) |
| GET / POST | `/accounts` | Lista as contas com o saldo calculado / cria uma conta |
| PATCH / DELETE | `/accounts/:id` | Edita / exclui (409 se houver transações) |
| POST | `/accounts/:id/archive`, `/accounts/:id/unarchive` | |
| GET / POST | `/categories` | |
| PATCH / DELETE | `/categories/:id` | DELETE aceita `?reassignTo=<id>` (409 se em uso e sem esse parâmetro) |
| GET | `/transactions` | Filtros: `from`, `to`, `accountId`, `categoryId`, `type`, `status`, `q`; paginação por cursor (`cursor`, `limit` ≤ 100), ordenado por `due_date desc, id desc` |
| POST | `/transactions` | Aceita o bloco opcional `recurrence: { frequency, endDate? }` |
| PATCH / DELETE | `/transactions/:id` | `?scope=single\|future`; o padrão é `single` |
| POST | `/transactions/:id/pay`, `/transactions/:id/unpay` | `pay` aceita `paidDate` opcional |
| GET | `/dashboard/summary?month=YYYY-MM` | Saldo total, previsão, receitas e despesas do mês com variação, pendentes e vencidas |
| GET | `/dashboard/evolution?months=6` | Receitas, despesas e saldo de fim de mês, mês a mês |
| GET | `/dashboard/by-category?month=YYYY-MM` | Despesas pagas por categoria |
| POST | `/demo/seed` | Só para JWT anônimo. Idempotente (não faz nada se o seed já existir) |
| POST | `/internal/cron/cleanup-demo` | Header `Authorization: Bearer $CRON_SECRET` |

**Variação em relação ao mês anterior:** quando o valor do mês anterior é 0, a API retorna `null`, e o front mostra "—".

---

## 7. Conta demo

1. O visitante clica em **"Experimentar sem cadastro"**. O front chama `supabase.auth.signInAnonymously()` e depois `POST /demo/seed`.
2. O seed é gerado **relativo à data de hoje**, então a demo nunca fica com dados velhos:
   - 3 contas: Conta corrente, Poupança e Carteira.
   - 6 meses de histórico pago e o mês corrente com alguns lançamentos pendentes, um deles vencido.
   - Recorrências: salário mensal, aluguel, internet, streaming e academia.
   - Despesas variáveis (mercado, transporte, delivery, lazer) com variação mensal realista, gerada com semente fixa para ser determinística nos testes.
   - Duas transferências por mês, da corrente para a poupança.
3. Um selo **"Modo demo"** fica fixo na interface, com o botão "Criar conta de verdade", que faz logout e leva ao cadastro.
4. **Limpeza:** um Vercel Cron diário chama `/internal/cron/cleanup-demo`, que apaga os dados e o usuário no Auth de todo profile `is_demo` com mais de 7 dias.
5. **Proteção contra abuso:** rate limit por IP em `/demo/seed` e o limite nativo de logins anônimos do Supabase.

---

## 8. Telas

Layout **mobile-first**: navegação inferior no celular e barra lateral no desktop. Tema claro e escuro, contraste WCAG AA e navegação por teclado.

1. **Entrar / Criar conta**: e-mail e senha, Google, "Esqueci a senha" e **"Experimentar sem cadastro"** em destaque.
2. **Dashboard**:
   - cards de saldo total, previsão de fim de mês, receitas do mês e despesas do mês (os dois últimos com a variação);
   - lista de pendentes e vencidas, com ação de pagar;
   - gráfico de evolução de 6 meses (barras de receitas e despesas e linha de saldo);
   - rosca de gastos por categoria;
   - seletor de mês.
3. **Lançamentos**: lista agrupada por dia, filtros, busca, "marcar como pago" com um clique e indicador de recorrente. O formulário abre como diálogo no desktop e em tela cheia no celular.
4. **Contas**: cards com saldo, criar, editar, arquivar e transferir.
5. **Categorias**: abas Receita e Despesa, CRUD com seletor de ícone e cor, e o diálogo de reatribuição ao excluir.
6. **Perfil**: nome, tema, sair e **Excluir minha conta**, com confirmação digitando "EXCLUIR".

Toda tela tem estado de carregamento (skeleton), de lista vazia (com chamada para a primeira ação) e de erro (com "tentar de novo").

**Direção visual:** a identidade detalhada (paleta, tipografia, tokens) é definida numa etapa de design dedicada, no início do plano de implementação e antes das telas. A referência é estilo de fintech moderna, limpa e confiável. Verde é reservado para receita e vermelho para despesa, nunca usados como decoração.

---

## 9. Erros e observabilidade

- **Formato de erro padronizado (`application/problem+json`)**: `{ type, title, status, detail, errors?: [{ path, message }] }`.
  - Validação Zod → 400.
  - Sem token ou token inválido → 401.
  - Recurso inexistente ou de outro usuário → 404.
  - Conflito (conta com transações, categoria em uso, nome duplicado) → 409.
  - Regra de domínio violada (ex.: `paid_date` no futuro) → 422.
- Middleware central de erros. Erros inesperados viram 500 genérico, com o detalhe só no log.
- **Logs estruturados com `pino`**: `requestId` por requisição (devolvido no header `X-Request-Id`), `userId` quando autenticado, e nunca o token ou dados sensíveis.
- Hardening: `helmet`, CORS restrito à origem do web, limite de tamanho do body e rate limit geral.
- Variáveis de ambiente validadas com Zod na inicialização. A API não sobe se faltar alguma.
- No front: erros 4xx mostram a mensagem em português, erros de rede ou 5xx mostram um toast genérico com nova tentativa, e um 401 faz logout e redireciona para o login.

---

## 10. Testes e qualidade

| Camada | Ferramenta | Cobre |
|---|---|---|
| Domínio | Vitest | Saldo, previsão, materialização de recorrência (dia 31, fim de série, datas puladas, "esta e as próximas"), utilitários de dinheiro e data |
| API (integração) | Vitest + Supertest + Postgres real (Docker local, service container no CI) | Cada endpoint: caminho feliz, validação, 404 entre usuários, 409 e 422 |
| Front (componentes) | Vitest + Testing Library | Formulário de lançamento, máscara BRL, estados vazio e de erro |
| E2E | Playwright | Entrar na demo → ver o dashboard populado → criar despesa → marcar como paga → o dashboard atualiza; cadastro e login com e-mail |

- **CI (GitHub Actions)** em todo PR e push na `main`: install → lint (ESLint) → typecheck → testes unitários e de integração → build → E2E contra o build local.
- **Teste obrigatório de isolamento:** para cada recurso, o usuário B tenta ler, editar e excluir um recurso do usuário A e recebe 404.
- README de vitrine: prints, GIF da demo, diagrama da arquitetura, decisões (link para esta spec), link da demo e como rodar localmente.

---

## 11. Deploy e ambientes

- **Supabase**: um projeto com Postgres e Auth (e-mail com senha, Google e login anônimo habilitados). As migrations são aplicadas pelo Prisma (`DIRECT_URL` para as migrations e conexão via pooler em tempo de execução).
- **Vercel**: dois projetos a partir do monorepo, `apps/web` e `apps/api`, com deploy de preview por PR e produção na `main`.
- **Vercel Cron**: configurado no projeto da API para a limpeza diária das demos.
- **Pré-requisitos do usuário** (pedidos no momento em que forem necessários): conta e projeto no Supabase, conta na Vercel ligada ao GitHub e credenciais OAuth do Google.

---

## 12. Fora do escopo

- Cartões, dívidas, orçamentos, metas, relatórios e exportação, notificações e IA: cada um tem seu sub-projeto (seção 1.1).
- Importação de extrato (OFX/CSV) e integração bancária (Open Finance).
- Dados offline e sincronização.
- Múltiplas moedas, contas compartilhadas e anexos de comprovante.
- App nativo: o mobile é atendido pelo PWA.

---

## 13. Critérios de aceite

1. Um visitante entra pela demo em um clique e vê o dashboard com 6 meses de dados coerentes com a data de hoje.
2. Um usuário se cadastra (e-mail ou Google), recebe as categorias padrão, cria contas e lança receitas, despesas e transferências.
3. Uma despesa recorrente mensal aparece nos meses seguintes ao navegar, sem duplicar ao recarregar. Editar "esta e as próximas" não altera as ocorrências já pagas.
4. O saldo das contas e o saldo total batem com as regras da seção 5.1 em todos os testes de domínio.
5. Os filtros de lançamentos (período, conta, categoria, tipo, status e busca) funcionam combinados, com paginação.
6. Nenhum endpoint permite que um usuário acesse dados de outro (teste de isolamento verde).
7. "Excluir minha conta" remove todos os dados e o usuário no Auth.
8. O app é instalável como PWA e utilizável numa tela de 360 px sem rolagem horizontal.
9. O CI está verde (lint, typecheck, testes e E2E) e a aplicação está no ar na Vercel com a demo funcionando.
10. As demos com mais de 7 dias são apagadas pelo cron.
