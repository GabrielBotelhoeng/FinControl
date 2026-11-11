# FinControl

[![CI](https://github.com/GabrielBotelhoeng/FinControl/actions/workflows/ci.yml/badge.svg)](https://github.com/GabrielBotelhoeng/FinControl/actions/workflows/ci.yml)

Gestão financeira pessoal: contas, receitas, despesas, transferências, recorrências e um painel do mês. Web responsivo e PWA instalável, em português e em reais. É um projeto de portfólio.

**[Abrir o app →](https://fincontrol-gb.vercel.app)** · Clique em **“Experimentar sem cadastro”** para entrar numa demo própria, com 6 meses de dados. Nada precisa ser preenchido.

![Painel do FinControl](docs/screenshots/painel.png)

<table>
  <tr>
    <td width="62%"><img src="docs/screenshots/lancamentos.png" alt="Lançamentos agrupados por dia, com filtros" /></td>
    <td><img src="docs/screenshots/celular-painel.png" alt="Painel no celular" /></td>
  </tr>
</table>

## O que dá para fazer

- **Várias contas**: corrente, poupança, carteira e investimento, cada uma com o próprio saldo, além de transferências entre elas.
- **Lançamentos**: receitas e despesas, fixas ou variáveis, pagas ou pendentes, com vencimento e categoria.
- **Recorrências**: o lançamento se repete (toda semana, todo mês ou todo ano) e cada mês ganha a sua ocorrência, que pode ser paga ou editada. Dá para editar “só esta” ou “esta e as próximas”, sem mexer no que já foi pago.
- **Histórico com filtros combinados**: período, conta, categoria, tipo, situação e busca, com paginação.
- **Painel**: saldo total, previsão para o fim do mês, receitas e despesas comparadas com o mês anterior, evolução de 6 meses, gastos por categoria e contas a pagar.
- **Demo isolada por visitante**: cada pessoa recebe uma conta anônima com dados próprios, apagada automaticamente após 7 dias.
- **Login** por e-mail e senha ou pelo Google. Em **Perfil → Excluir minha conta**, a pessoa apaga tudo, como prevê a LGPD ([política de privacidade](https://fincontrol-gb.vercel.app/privacidade)).

## Arquitetura

```mermaid
flowchart LR
  subgraph Vercel
    web["apps/web<br/>React 19 + Vite (PWA)"]
    api["apps/api<br/>Express 5 (Fluid Compute)"]
    cron["Vercel Cron<br/>limpeza diária das demos"]
  end
  subgraph Supabase["Supabase (São Paulo)"]
    auth["Auth<br/>e-mail, Google, anônimo"]
    db[("Postgres")]
  end
  web -- "login" --> auth
  web -- "REST + JWT" --> api
  api -- "valida o JWT via JWKS" --> auth
  api -- "Prisma 7" --> db
  cron --> api
```

- **A API é dona das regras de negócio.** O Supabase entra só como infraestrutura (Postgres e Auth). O front faz o login e a API valida o JWT pela chave pública (JWKS), sem chamar o Auth a cada requisição.
- **Dinheiro em centavos inteiros** (`BIGINT`), sem `float`, para não haver erro de arredondamento.
- **Recorrências materializadas sob demanda** e de forma idempotente. Não existe job pré-gerando ocorrências, e uma ocorrência persistida pode ser paga e editada.
- **Monorepo com npm workspaces.** Os schemas Zod de `packages/shared` validam os dados nos dois lados.

As decisões, com as alternativas descartadas e os motivos, estão na [spec do sub-projeto 1](docs/superpowers/specs/2026-11-11-fincontrol-fundacao-fluxo-caixa-design.md).

| Pasta | O que tem |
|---|---|
| `apps/web` | React 19, React Router 7, TanStack Query, React Hook Form, Tailwind 4, Recharts, PWA |
| `apps/api` | Express 5, Prisma 7 (PostgreSQL), Zod, jose (JWT), pino, helmet, rate limit |
| `packages/shared` | Schemas Zod, tipos e utilitários de datas e dinheiro compartilhados |
| `e2e` | Testes ponta a ponta com Playwright |
| `supabase` | Configuração versionada do Auth (`supabase config push`) |

## Testes

| Camada | Quantidade | Como roda |
|---|---|---|
| `packages/shared` | 39 | Unitários (Vitest) |
| `apps/api` | 96 | Integração contra **Postgres real**: rotas HTTP, regras de saldo, recorrência e isolamento entre usuários |
| `apps/web` | 47 | Componentes e fluxos (Testing Library), com o provedor de identidade simulado |
| `e2e` | 7 | Chromium contra a pilha inteira |

O E2E roda a **web buildada como em produção**, a **API real** e o **Postgres real**. A única peça simulada é o provedor de identidade: um servidor Auth mínimo ([`e2e/fake-auth.ts`](e2e/fake-auth.ts)) que fala o mesmo protocolo do Supabase e assina JWTs ES256 de verdade. Assim, a API valida os tokens pelo mesmo caminho de produção (JWKS, issuer e audience), sem segredos no CI e sem sujar o projeto real. Os cenários seguem os critérios de aceite da spec:

- demo em um clique;
- cadastro, conta e despesa paga, com o saldo da conta atualizado;
- recorrência mensal sem duplicar ao navegar e recarregar;
- “Excluir minha conta” apagando também o usuário no Auth;
- nenhuma rolagem horizontal a 360 px;
- política de privacidade pública;
- rota protegida sem sessão.

O CI ([`ci.yml`](.github/workflows/ci.yml)) roda lint, typecheck, os testes e o E2E em toda PR. Cada PR também ganha um deploy de preview da web e da API na Vercel.

## Rodando localmente

Pré-requisitos: Node 22 e Docker.

```bash
npm install
npm run db:up                                   # Postgres na porta 5435 (bancos de dev e de teste)
cp apps/api/.env.example apps/api/.env          # e preencha as variáveis do Supabase
cp apps/web/.env.example apps/web/.env.local
npm run db:migrate                              # migrations no banco de dev
npm run dev:api                                 # http://localhost:3333/api/v1/health
npm run dev -w @fincontrol/web                  # http://localhost:5173
```

## Qualidade

```bash
npm run lint
npm run typecheck
npm test                                        # unitários e integração (precisa do db:up)
npx playwright install chromium                 # só na primeira vez
npm run test:e2e                                # sobe auth falso, API e web buildada, e roda o Playwright
SCREENSHOTS=1 npm run test:e2e -- screenshots   # regenera as imagens deste README
```

## Deploy

Dois projetos na Vercel a partir deste monorepo: `fincontrol-web` (raiz `apps/web`) e `fincontrol-api` (raiz `apps/api`). Ambos estão ligados ao GitHub, com produção na `main` e preview em cada PR.

- A API usa `src/index.ts` como entrada (`export default app`) e precisa de `VERCEL_EXPERIMENTAL_BACKENDS=1`, por causa dos imports sem extensão e do pacote `shared` em TypeScript.
- O cron diário (`apps/api/vercel.json`) chama `/api/v1/internal/cron/cleanup-demo`, protegido por `CRON_SECRET`.
- A API aceita a origem de produção e, via `WEB_PREVIEW_ORIGIN_PATTERN` (regex ancorada), os previews da web.

## Roadmap

Este é o sub-projeto 1 de 7: fundação e fluxo de caixa. Os próximos são cartões de crédito, dívidas, planejamento e metas, relatórios e exportação, notificações e um assistente financeiro com IA. Cada um sai com spec, plano, testes e deploy.
