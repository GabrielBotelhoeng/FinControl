# FinControl

[![CI](https://github.com/GabrielBotelhoeng/FinControl/actions/workflows/ci.yml/badge.svg)](https://github.com/GabrielBotelhoeng/FinControl/actions/workflows/ci.yml)

Gestão financeira pessoal: contas, cartões de crédito, receitas, despesas, transferências, recorrências e um painel do mês. Web responsivo e PWA instalável, em português e em reais. É um projeto de portfólio.

**[Abrir o app →](https://fincontrol-gb.vercel.app)** · Clique em **“Experimentar sem cadastro”** para entrar numa demo própria, com 6 meses de dados. Nada precisa ser preenchido.

![Painel do FinControl](docs/screenshots/painel.png)

<table>
  <tr>
    <td width="62%"><img src="docs/screenshots/lancamentos.png" alt="Lançamentos agrupados por dia, com filtros" /></td>
    <td><img src="docs/screenshots/celular-painel.png" alt="Painel no celular" /></td>
  </tr>
</table>

![Faturas do cartão, com a fatura aberta em destaque e o histórico](docs/screenshots/faturas.png)

## O que dá para fazer

- **Várias contas**: corrente, poupança, carteira e investimento, cada uma com o próprio saldo, além de transferências entre elas.
- **Cartões de crédito**: limite total e disponível, dia de fechamento e de vencimento, e a conta que paga a fatura. Cada compra cai na fatura certa, inclusive no dia do fechamento e em meses curtos. Compras parceladas (até 48x) espalham as parcelas pelas faturas seguintes, e a soma bate com o total ao centavo.
- **Faturas**: aberta, fechada, paga ou vencida, sempre com ícone e texto. Pagar a fatura é uma transferência da conta pagadora para o cartão, que devolve o limite. Pagar a mais reduz a dívida do cartão.
- **Lançamentos**: receitas e despesas, fixas ou variáveis, pagas ou pendentes, com vencimento e categoria.
- **Recorrências**: o lançamento se repete (toda semana, todo mês ou todo ano) e cada mês ganha a sua ocorrência, que pode ser paga ou editada. Dá para editar “só esta” ou “esta e as próximas”, sem mexer no que já foi pago.
- **Histórico com filtros combinados**: período, conta, categoria, tipo, situação e busca, com paginação.
- **Painel**: saldo total, previsão para o fim do mês, receitas e despesas comparadas com o mês anterior, evolução de 6 meses, gastos por categoria e contas a pagar, com as faturas de cartão em aberto.
- **Saúde financeira**: taxa de poupança (meta de 20%), reserva de emergência em meses de gasto (meta de 3 a 6) e comprometimento de renda com parcelas e faturas vencidas (meta de até 30%). Cada indicador mostra a situação por escrito e a conta que gerou o número.
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

As decisões, com as alternativas descartadas e os motivos, estão nas specs do [sub-projeto 1](docs/superpowers/specs/2026-11-11-fincontrol-fundacao-fluxo-caixa-design.md) e do [sub-projeto 2](docs/superpowers/specs/2026-11-12-fincontrol-sp2-credito-design.md).

- **O cartão é uma conta** do tipo `credit_card`. A compra é uma despesa nessa conta, com o mês da fatura gravado, e o pagamento é uma transferência. Assim, cartão, saldo e painel usam o mesmo livro-caixa.

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
| `packages/shared` | 60 | Unitários (Vitest) |
| `apps/api` | 171 | Integração contra **Postgres real**: rotas HTTP, regras de saldo, recorrência, cartão e fatura, e isolamento entre usuários |
| `apps/web` | 92 | Componentes e fluxos (Testing Library), com o provedor de identidade simulado |
| `e2e` | 9 | Chromium contra a pilha inteira |

O E2E roda a **web buildada como em produção**, a **API real** e o **Postgres real**. A única peça simulada é o provedor de identidade: um servidor Auth mínimo ([`e2e/fake-auth.ts`](e2e/fake-auth.ts)) que fala o mesmo protocolo do Supabase e assina JWTs ES256 de verdade. Assim, a API valida os tokens pelo mesmo caminho de produção (JWKS, issuer e audience), sem segredos no CI e sem sujar o projeto real. Os cenários seguem os critérios de aceite da spec:

- demo em um clique;
- cadastro, conta e despesa paga, com o saldo da conta atualizado;
- recorrência mensal sem duplicar ao navegar e recarregar;
- compra no cartão indo para a fatura, e o pagamento tirando da corrente e devolvendo o limite;
- “Excluir minha conta” apagando também o usuário no Auth;
- nenhuma rolagem horizontal a 360 px, inclusive na página de faturas;
- política de privacidade e termos de uso públicos;
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
- A conexão com o Postgres valida o certificado e o nome do host contra a CA do Supabase (`DATABASE_CA_CERT`), e não apenas cifra o tráfego.

## Roadmap

São 7 sub-projetos. O 1 (fundação e fluxo de caixa) está no ar. Do 2 (crédito), a Parte A (cartões) está pronta, e a Parte B traz empréstimos e financiamentos, com a taxa de juros real e a comparação com as taxas do Banco Central. Depois vêm planejamento e metas, relatórios e exportação, notificações e um assistente financeiro com IA. Cada um sai com spec, plano, testes e deploy.
