# Sub-projeto 3: planejamento e metas — plano de implementação

> **Para agentes:** sub-skill obrigatória: `superpowers:executing-plans` (execução direta, escolhida pelo usuário para a Parte B e mantida aqui). Os passos usam checkbox (`- [ ]`).

**Objetivo:** limites mensais por categoria com alertas, planejamento do mês (receitas, orçamento, sobra e previsão de 3 meses) e metas de economia com depósitos, progresso e aporte mensal.

**Arquitetura:**
- **Regras puras:** em `packages/shared/src/planning.ts`, como `loan.ts`. A web usa as mesmas regras na sugestão e no progresso.
- **API:** dois módulos novos, `budgets` (com a previsão) e `goals`.
- **Painel:** ganha `budget` no resumo.
- **Web:** ganha a página `/planejamento`, com as abas Orçamento e Metas.

**Stack:** Express 5, Prisma 7 (PostgreSQL), Zod 4, React 19 + TanStack Query, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-16-fincontrol-sp3-planejamento-metas-design.md` (decisões P1–P10).

## Restrições globais

- Dinheiro em centavos inteiros (`BigInt` no banco, `number` no TS). Datas como `DateOnly` e meses como `YearMonth`, com os helpers de `packages/shared/src/dates.ts`.
- Texto de interface em pt-BR. Situação sempre com ícone e texto.
- TDD: o teste falha primeiro. Testes de API rodam contra o Postgres real. O "hoje" dos testes de API é 2026-11-11 (`test/helpers/app.ts`).
- Toda rota filtra por `userId`, e recurso de outro usuário dá 404. Erro de forma (Zod) dá 400, e regra de negócio no serviço dá 422 (convenção das Partes A e B).
- Mutações da web usam `useFinanceMutation`, e as chaves `budgets`, `goals` e `planning` entram em `FINANCE_KEYS`.
- Commits convencionais em pt-BR, um por tarefa. Gates no fim de cada tarefa: `npm run lint`, `npm run typecheck` e `npm test`. E2E nas tarefas 7 e 11.

## Foco de revisão

1. **Categoria de receita no `PUT /budgets/:categoryId`:** dá 422. Categoria de outro usuário dá 404 (Tarefa 4).
2. **Retirada maior que o guardado:** dá 422, e o saldo da meta nunca fica negativo (Tarefa 5).
3. **Prazo no mês atual ou já vencido:** `monthsUntil` vale 1, e `monthlyNeeded` nunca divide por zero (Tarefa 1).
4. **Excluir uma categoria com limite:** o limite some, e a página não quebra (Tarefa 4, cascade).
5. **Barra do celular com Planejamento no lugar de Categorias:** cabe a 360 px, e Categorias continua acessível (Tarefas 8 e 11).

---

### Tarefa 1: regras de planejamento (shared)

**Arquivos:**
- Criar: `packages/shared/src/planning.ts` e `packages/shared/src/planning.test.ts`
- Modificar: `packages/shared/src/index.ts`

**Interfaces (produz):**
- `budgetStatus(committed: number, limit: number): { percent: number; status: 'ok' | 'near' | 'over' }`;
- `suggestedLimit(monthlyPaid: number[]): number | null`;
- `monthsUntil(today: DateOnly, targetDate: DateOnly): number`;
- `goalProgress(g: { target: number; saved: number; createdAt: DateOnly; targetDate: DateOnly; today: DateOnly }): { fraction: number; status: 'reached' | 'overdue' | 'on_track' | 'late'; monthlyNeeded: number; monthsLeft: number }`.

- [ ] **Passo 1: teste que falha**

```ts
import { describe, expect, it } from 'vitest';
import { budgetStatus, goalProgress, monthsUntil, suggestedLimit } from './planning';

describe('budgetStatus (P3)', () => {
  it('critérios 1 e 2: 450 de 500 = 90% perto; 550 de 500 = 110% estourou', () => {
    expect(budgetStatus(45000, 50000)).toEqual({ percent: 90, status: 'near' });
    expect(budgetStatus(55000, 50000)).toEqual({ percent: 110, status: 'over' });
  });
  it('a faixa segue o número exibido: 79,5% aparece 80% e já está perto; 100% exato ainda é perto', () => {
    expect(budgetStatus(39750, 50000)).toEqual({ percent: 80, status: 'near' });
    expect(budgetStatus(39500, 50000)).toEqual({ percent: 79, status: 'ok' });
    expect(budgetStatus(50000, 50000)).toEqual({ percent: 100, status: 'near' });
    expect(budgetStatus(50250, 50000)).toEqual({ percent: 101, status: 'over' });
  });
  it('sem gasto é 0%, dentro', () => expect(budgetStatus(0, 50000)).toEqual({ percent: 0, status: 'ok' }));
});

describe('suggestedLimit (P4)', () => {
  it('média dos meses com gasto, para cima em R$ 10', () => {
    expect(suggestedLimit([45000, 52000, 0])).toBe(49000);
    expect(suggestedLimit([30000, 30000, 30000])).toBe(30000);
  });
  it('sem gasto não sugere', () => expect(suggestedLimit([0, 0, 0])).toBeNull());
});

describe('monthsUntil', () => {
  it('conta o mês atual e o do prazo, atravessando o ano', () => expect(monthsUntil('2026-11-16', '2027-04-30')).toBe(6));
  it('prazo no mês atual ou vencido vale 1', () => {
    expect(monthsUntil('2026-11-16', '2026-11-30')).toBe(1);
    expect(monthsUntil('2026-11-16', '2026-09-01')).toBe(1);
  });
});

describe('goalProgress (P7)', () => {
  const base = { target: 600000, createdAt: '2026-05-16', targetDate: '2027-05-16', today: '2026-11-16' };
  it('critério 4: R$ 1.500 de R$ 6.000 = 25%, atrasada (metade do prazo já passou), aporte de 7 meses', () => {
    expect(goalProgress({ ...base, saved: 150000 })).toEqual({ fraction: 0.25, status: 'late', monthlyNeeded: 64286, monthsLeft: 7 });
  });
  it('no ritmo quando o guardado acompanha o tempo decorrido', () => {
    expect(goalProgress({ ...base, saved: 320000 }).status).toBe('on_track');
  });
  it('concluída: fração limitada a 1 e nada mais a guardar', () => {
    expect(goalProgress({ ...base, saved: 700000 })).toEqual({ fraction: 1, status: 'reached', monthlyNeeded: 0, monthsLeft: 7 });
  });
  it('prazo vencido sem concluir: o restante inteiro, em 1 mês', () => {
    expect(goalProgress({ ...base, saved: 100000, today: '2027-06-01' })).toEqual({ fraction: 100000 / 600000, status: 'overdue', monthlyNeeded: 500000, monthsLeft: 1 });
  });
  it('meta criada hoje com prazo hoje não divide por zero', () => {
    expect(goalProgress({ target: 1000, saved: 0, createdAt: '2026-11-16', targetDate: '2026-11-16', today: '2026-11-16' }).monthlyNeeded).toBe(1000);
  });
});
```

- [ ] **Passo 2:** `npx vitest run src/planning.test.ts` em `packages/shared`. Esperado: FAIL ("Failed to resolve import ./planning").
- [ ] **Passo 3: implementar**

```ts
import type { DateOnly } from './dates';

/** Faixa do orçamento pela porcentagem exibida (P3): até 79% dentro, 80–100% perto, acima de 100% estourou. */
export function budgetStatus(committed: number, limit: number): { percent: number; status: 'ok' | 'near' | 'over' } {
  const percent = Math.round((committed / limit) * 100);
  return { percent, status: percent > 100 ? 'over' : percent >= 80 ? 'near' : 'ok' };
}

/** Média do gasto pago nos meses com gasto, para cima em R$ 10 (P4); sem gasto, sem sugestão. */
export function suggestedLimit(monthlyPaid: number[]): number | null {
  const withSpend = monthlyPaid.filter((v) => v > 0);
  if (withSpend.length === 0) return null;
  const average = withSpend.reduce((s, v) => s + v, 0) / withSpend.length;
  return Math.ceil(average / 1000) * 1000;
}

const monthIndex = (d: DateOnly) => Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7)) - 1;
const dayNumber = (d: DateOnly) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) / 86_400_000;

/** Meses de calendário do mês atual ao mês do prazo, contando os dois; mínimo 1. */
export function monthsUntil(today: DateOnly, targetDate: DateOnly): number {
  return Math.max(monthIndex(targetDate) - monthIndex(today) + 1, 1);
}

/** Progresso da meta (P7). Sem rendimento nem inflação. */
export function goalProgress(g: { target: number; saved: number; createdAt: DateOnly; targetDate: DateOnly; today: DateOnly }) {
  const fraction = Math.min(Math.max(g.saved / g.target, 0), 1);
  const monthsLeft = monthsUntil(g.today, g.targetDate);
  const remaining = Math.max(g.target - g.saved, 0);
  if (remaining === 0) return { fraction, status: 'reached' as const, monthlyNeeded: 0, monthsLeft };
  if (g.today > g.targetDate) return { fraction, status: 'overdue' as const, monthlyNeeded: remaining, monthsLeft };
  const total = Math.max(dayNumber(g.targetDate) - dayNumber(g.createdAt), 1);
  const expected = Math.min(Math.max((dayNumber(g.today) - dayNumber(g.createdAt)) / total, 0), 1);
  const status = fraction >= expected - 0.01 ? ('on_track' as const) : ('late' as const);
  return { fraction, status, monthlyNeeded: Math.ceil(remaining / monthsLeft), monthsLeft };
}
```

- [ ] **Passo 4:** PASS. **Passo 5:** `git commit -m "feat(shared): regras de orçamento e de progresso de metas (domínio)"`

### Tarefa 2: contratos compartilhados

**Arquivos:** criar `packages/shared/src/schemas/planning.ts`; modificar `schemas/index.ts`, `schemas/dashboard.ts` e `schemas/schemas.test.ts`.

**Interfaces (produz):**
- `setBudgetSchema = z.object({ limit: centsSchema })`;
- `budgetQuerySchema = z.object({ month: yearMonthSchema.optional() })`;
- `forecastQuerySchema = z.object({ months: z.coerce.number().int().min(1).max(12).default(3) })`.
- `BudgetItemDTO`:
  - `categoryId`, `name`, `icon`, `color`;
  - `limit`, `paid`, `pending`, `committed`;
  - `percent`, `status: 'ok' | 'near' | 'over'`, `suggested: number | null`.
- `BudgetCategoryDTO = { categoryId; name; icon; color; suggested: number | null }`.
- `BudgetMonthDTO = { month; items: BudgetItemDTO[]; categoriesWithoutBudget: BudgetCategoryDTO[]; totals: { limit; committed }; income: { paid; pending }; plannedLeftover }`.
- `ForecastMonthDTO = { month; income; expense }`.
- `createGoalSchema`:
  - `name` (1–60);
  - `targetAmount` (`centsSchema`);
  - `targetDate` (`dateOnlySchema`).

  O "prazo não pode estar no passado" é validado no serviço (422), porque depende de hoje.
- `updateGoalSchema = createGoalSchema.partial()`, não vazio.
- `contributionSchema`:
  - `amount`: inteiro ≠ 0, com |amount| ≤ `MAX_CENTS`;
  - `date`: `dateOnlySchema`;
  - `note`: opcional, até 80.
- `GoalDTO`:
  - `id`, `name`, `targetAmount`, `targetDate`, `saved`, `createdAt` (DateOnly);
  - `fraction`, `status`, `monthlyNeeded`, `monthsLeft`.
- `GoalContributionDTO = { id; amount; date; note: string | null }` e `GoalDetailDTO = GoalDTO & { contributions: GoalContributionDTO[] }`.
- `DashboardSummaryDTO.budget: { limit; committed; nearCount; overCount } | null`.

- [ ] **Passo 1:** testes de schema que falham:
  - `setBudgetSchema` recusa 0;
  - `contributionSchema` recusa 0 e aceita −5000;
  - `createGoalSchema` recusa `targetAmount` 0.
- [ ] **Passos 2 a 4:** implementar e rodar `npm test -w @fincontrol/shared` até PASS. O `budget` do resumo do painel é preenchido como `null` na API até a Tarefa 6. Registre essa decisão no ledger, como foi feito com o `loanId` na Parte B.
- [ ] **Passo 5:** `git commit -m "feat(shared): contratos de orçamento, previsão e metas"`

### Tarefa 3: migration

**Arquivos:**
- Modificar: `apps/api/prisma/schema.prisma`
- Gerado: `apps/api/prisma/migrations/<ts>_planejamento/migration.sql`
- Modificar: `apps/api/test/helpers/db.ts` (o `TRUNCATE` inclui `budgets`, `goal_contributions` e `goals`)

**O que muda:**
- **`Budget` (`budgets`):** `id`, `userId` (FK `profiles`, cascade), `categoryId` (FK `categories`, cascade), `limitAmount` (BigInt), `createdAt`, `updatedAt`, `@@unique([userId, categoryId])`.
- **`Goal` (`goals`):** `id`, `userId` (cascade), `name`, `targetAmount` (BigInt), `targetDate` (`@db.Date`), `createdAt`, `updatedAt`, `contributions`, `@@index([userId])`.
- **`GoalContribution` (`goal_contributions`):** `id`, `goalId` (FK `goals`, cascade), `userId`, `amount` (BigInt), `date` (`@db.Date`), `note` (`String?`), `createdAt`, `@@index([goalId])`.
- **SQL à mão:**
  - `ENABLE ROW LEVEL SECURITY` nas três tabelas;
  - `CHECK` com `limit_amount > 0`, `target_amount > 0` e `amount <> 0`.

- [ ] **Passo 1:** `npm run db:migrate -w @fincontrol/api -- --name planejamento --create-only`, acrescentar o SQL e rodar `npx prisma migrate dev` e `npx prisma generate`.
- [ ] **Passo 2:** `npm test -w @fincontrol/api`. Esperado: PASS, sem regressão.
- [ ] **Passo 3:** `git commit -m "feat(db): orçamentos, metas e depósitos"`

### Tarefa 4: API de orçamento e previsão

**Arquivos:**
- Criar: `apps/api/src/modules/budgets/budgets.{repository,service,routes}.ts`
- Modificar: `apps/api/src/http/{container,routes}.ts`
- Teste: `apps/api/test/budgets.test.ts`

**Interfaces:**
- Consome: `budgetStatus` e `suggestedLimit` (Tarefa 1), os schemas da Tarefa 2 e `recurrences.materialize`.
- Produz: `budgetsService.summaryFor(userId, month): Promise<{ limit; committed; nearCount; overCount } | null>`, para a Tarefa 6.

- [ ] **Passo 1: testes que falham.** Use um usuário com corrente e o "hoje" de 2026-11-11.
  - **Critério 1:**
    - `PUT /budgets/<Alimentação>` com `{ limit: 50000 }`;
    - uma despesa paga de 30000 em 2026-11-05 e uma pendente de 15000 com vencimento em 2026-11-20;
    - esperado em `GET /budgets?month=2026-11`, no item de Alimentação: `{ limit: 50000, paid: 30000, pending: 15000, committed: 45000, percent: 90, status: 'near' }`.
  - **Critério 2:** mais uma despesa paga de 10000 → `status: 'over'`, `percent: 110`.
  - **Cartão e transferência:**
    - uma compra no cartão de 5000 em Alimentação em 2026-11-06 conta no comprometido;
    - uma transferência entre contas não conta;
    - uma despesa em outubro não conta em novembro.
  - **Critério 3:**
    - receita paga de 500000 e pendente de 100000 em novembro;
    - limites de 50000 (Alimentação) e 30000 (Lazer);
    - esperado: `income: { paid: 500000, pending: 100000 }`, `totals.limit: 80000` e `plannedLeftover: 520000`.
  - **Sugestão:**
    - Lazer com despesas pagas de 45000 em agosto e 52000 em setembro, e nada em outubro;
    - esperado: `categoriesWithoutBudget` traz Lazer com `suggested: 49000`.
  - **Regras:**
    - limite em categoria de receita (Salário) dá 422;
    - limite em categoria de outro usuário dá 404;
    - `limit: 0` dá 400;
    - `DELETE` remove;
    - excluir a categoria (`DELETE /categories/:id`, sem uso) apaga o limite;
    - `GET /budgets` sem limites traz tudo em `categoriesWithoutBudget`, com totais 0.
  - **Previsão:**
    - recorrência mensal de 10000 (despesa) a partir de 2026-11-15;
    - esperado em `GET /planning/forecast?months=3`: três meses (2026-11, 2026-12, 2027-01), cada um com `expense` ≥ 10000.
  - **Isolamento:** a outra pessoa não vê os limites.
- [ ] **Passos 2 a 4:**
  - **Repositório:**
    - `list(userId)`, `upsert(userId, categoryId, limit)` e `delete`;
    - `expenseByCategoryAndStatus(userId, from, to)`: `groupBy(['categoryId', 'status'])` de `type: 'expense'` por `dueDate`;
    - `paidExpenseByCategoryPerMonth(userId, months[])`, para a sugestão;
    - `incomeByStatus(userId, from, to)`.
  - **Serviço:**
    - materializar as recorrências até o fim do mês consultado (até o fim do 3º mês na previsão) antes de ler;
    - categorias de despesa via o repositório de categorias.
  - **Rotas:** `/budgets` e `/planning/forecast`.
  - Rodar até PASS.
- [ ] **Passo 5:** `git commit -m "feat(api): orçamento por categoria, sobra planejada e previsão de 3 meses"`

### Tarefa 5: API de metas

**Arquivos:**
- Criar: `apps/api/src/modules/goals/goals.{repository,service,routes}.ts`
- Modificar: `container.ts` e `routes.ts`
- Teste: `apps/api/test/goals.test.ts`

- [ ] **Passo 1: testes que falham** (hoje = 2026-11-11):
  - **Criar e progresso:**
    - `POST /goals` com `{ name: 'Viagem', targetAmount: 600000, targetDate: '2027-04-30' }` dá 201;
    - depósitos de 100000 e 50000;
    - esperado em `GET /goals/:id`: `{ saved: 150000, fraction: 0.25, monthsLeft: 6, monthlyNeeded: 75000 }`, com 2 depósitos.
  - **Retirada:**
    - retirada de −20000 → `saved` 130000;
    - retirada de −200000 dá 422, com a mensagem "Não dá para retirar mais do que está guardado".
  - **Datas e valores:**
    - prazo no passado (`2026-10-01`) ao criar dá 422;
    - depósito com data futura (`2026-12-01`) dá 422;
    - `amount: 0` dá 400.
  - **Edição e exclusão:**
    - `PATCH` muda o alvo e recalcula `fraction`;
    - `DELETE /goals/:id/contributions/:cid` remove o depósito;
    - `DELETE /goals/:id` remove a meta e os depósitos.
  - **Lista:** `GET /goals` traz o progresso, em ordem de prazo.
  - **Isolamento:** a meta de outra pessoa dá 404 em `GET`, `PATCH`, `DELETE` e nos depósitos.
- [ ] **Passos 2 a 4:**
  - **Lógica:** `saved` = soma dos depósitos; o progresso vem de `goalProgress` com `today` = `todayInSaoPaulo(clock())`.
  - **Retirada:** valida no serviço, com o `saved` atual, dentro de uma `$transaction`.
  - Rodar até PASS.
- [ ] **Passo 5:** `git commit -m "feat(api): metas com depósitos, retiradas e aporte mensal"`

### Tarefa 6: painel com o orçamento do mês

**Arquivos:** modificar `apps/api/src/modules/dashboard/dashboard.service.ts` e `apps/api/src/http/container.ts`; teste em `apps/api/test/dashboard.test.ts`.

- [ ] **Passo 1: teste que falha**
  - **Sem limites:** `summary.budget === null`.
  - **Com o cenário do critério 2** (Alimentação estourada e Lazer em 0 de 30000): `summary.budget` = `{ limit: 80000, committed: 55000, nearCount: 0, overCount: 1 }`.
- [ ] **Passos 2 a 4:** `budgets.summaryFor(userId, m)` entra no **mesmo** `Promise.all` do `getSummary`.
- [ ] **Passo 5:** `git commit -m "feat(api): orçamento do mês no resumo do painel"`

### Tarefa 7: demo

**Arquivos:**
- Modificar: `apps/api/src/domain/demo-data.ts`, `demo-data.test.ts`, `modules/demo/demo.{service,repository}.ts` e `test/demo.test.ts`

**O que muda (spec seção 7):**
- **Limites:**
  - Alimentação = 110% do gasto de Alimentação do mês atual no plano, arredondado em R$ 10, para ficar perto do limite;
  - Lazer = 80% do gasto de Lazer do mês atual, para estourar;
  - Compras e Moradia = 2× o gasto, para ficarem dentro.

  Os limites são calculados a partir do próprio plano, para valer em qualquer data.
- **Metas:**
  - "Reserva de emergência": alvo de 3000000, prazo em 18 meses, criada no 1º dia do histórico, com um depósito de 150000 em cada um dos 7 meses (dia 6). O resultado é 1050000 guardados, no ritmo;
  - "Viagem de férias": alvo de 800000, prazo em 8 meses, criada 4 meses atrás, com um depósito de 50000. Fica atrasada.
- **Gravação:** tudo no mesmo seed atômico. O `createdAt` das metas é gravado explicitamente.

- [ ] **Passo 1: testes que falham**
  - `demo-data.test`: o plano traz 4 limites e 2 metas, e continua determinístico;
  - `demo.test`: depois do seed, `GET /budgets` tem pelo menos 1 categoria `near` ou `over`, e `GET /goals` tem 2 metas, uma `on_track` e uma `late`.
- [ ] **Passos 2 a 4:** implementar. Rodar PASS e o E2E (`npm run test:e2e`).
- [ ] **Passo 5:** `git commit -m "feat(demo): orçamento com categorias perto e estouradas, e duas metas"`

### Tarefa 8: web — aba Orçamento, previsão e navegação

**Arquivos:**
- Criar: `apps/web/src/features/planning/{api.ts,planning-page.tsx,budget-tab.tsx,budget-form.tsx,forecast.tsx}`
- Modificar:
  - `apps/web/src/app/{router,nav,app-shell}.tsx`;
  - `apps/web/src/features/accounts/api.ts` (`FINANCE_KEYS`);
  - `apps/web/src/features/profile/profile-page.tsx` (link "Gerenciar categorias").
- Testes: `planning-page.test.tsx`, `budget-form.test.tsx` e `app-shell.test.tsx`

- [ ] **Passo 1: testes que falham**
  - **Item do orçamento:** mostra o nome, "R$ 450,00 de R$ 500,00", a barra (`role="progressbar"`, `aria-valuenow="90"`) e "Perto do limite" com ícone. O item estourado mostra "Estourou".
  - **Resumo:** "Receitas do mês", "Orçamento total", "Comprometido" e "Sobra planejada".
  - **Sem limite:** as categorias aparecem com "Definir limite". O formulário vem preenchido com a sugestão ("Sugestão: R$ 490,00, a média dos últimos 3 meses") e envia `PUT /budgets/:id` com `{ limit }`.
  - **Próximos 3 meses:** um item por mês, com receitas, despesas e saldo previsto.
  - **Abas:** "Orçamento" e "Metas" mudam `?aba=`.
  - **Navegação:**
    - o menu do computador tem "Planejamento" (`/planejamento`) e continua com "Categorias";
    - a barra do celular tem "Planejamento" e não tem "Categorias".

    Use um campo `mobile?: false` no `NavItem`.
  - **Perfil:** o link "Gerenciar categorias" aponta para `/categorias`.
- [ ] **Passos 2 a 4:** implementar com os componentes existentes. Rodar até PASS. Conferir visualmente a 360 px e no desktop.
- [ ] **Passo 5:** `git commit -m "feat(web): planejamento — orçamento por categoria, sobra e previsão"`

### Tarefa 9: web — aba Metas

**Arquivos:** criar `apps/web/src/features/planning/{goals-tab.tsx,goal-form.tsx,goal-dialog.tsx}`; teste em `goals-tab.test.tsx`.

- [ ] **Passo 1: testes que falham**
  - **Cartão da meta:** nome, "R$ 1.500,00 de R$ 6.000,00", barra com `aria-valuenow="25"`, situação ("Atrasada", "No ritmo", "Concluída" ou "Prazo vencido") com ícone, e "Guarde R$ 642,86 por mês até mai/2027". Uma meta concluída não mostra o aporte.
  - **Nova meta:** o `POST /goals` envia centavos e a data.
  - **Atalho da reserva:**
    - "Meta de reserva de emergência" abre o formulário com o nome "Reserva de emergência";
    - o alvo é 6 × `averageMonthlyExpense` do resumo do painel, e o prazo fica em 12 meses;
    - sem gasto médio, o alvo fica em branco.
  - **Detalhe:**
    - lista os depósitos;
    - "Registrar depósito" envia um valor positivo, e "Registrar retirada" envia um valor negativo;
    - o erro 422 da retirada aparece no diálogo;
    - "Excluir meta" pede confirmação.
  - **Texto fixo:** "Sem rendimento: o cálculo considera só o que você guardar."
- [ ] **Passos 2 a 4:** implementar e rodar até PASS.
- [ ] **Passo 5:** `git commit -m "feat(web): metas com depósitos, retiradas e atalho de reserva"`

### Tarefa 10: web — bloco no painel

**Arquivos:** criar `apps/web/src/features/dashboard/budget-card.tsx` e o teste; modificar `dashboard-page.tsx`.

- [ ] **Passo 1: testes que falham**
  - **Com orçamento:** "Orçamento do mês", "R$ 550,00 de R$ 800,00" e "1 categoria estourou". As contagens no plural são "2 categorias perto do limite". Tudo com ícone, e o link "Ver planejamento" vai para `/planejamento`.
  - **Sem orçamento (`null`):** "Defina limites por categoria para acompanhar o mês", com o mesmo link.
- [ ] **Passos 2 a 4:** implementar. Conferir o painel a 360 px.
- [ ] **Passo 5:** `git commit -m "feat(web): orçamento do mês no painel"`

### Tarefa 11: E2E, documentação e entrega

**Arquivos:**
- Criar: `e2e/tests/planejamento.spec.ts`
- Modificar:
  - `e2e/tests/mobile-e-publico.spec.ts` (inclui `/planejamento` e `/planejamento?aba=metas`);
  - `e2e/tests/screenshots.spec.ts` (`planejamento.png`);
  - `README.md` e `docs/HANDOFF.md`.

- [ ] **Passo 1: E2E**
  1. Cadastro → corrente de R$ 5.000.
  2. Em Planejamento, definir R$ 500 em Alimentação.
  3. Lançar R$ 450 pagos em Alimentação. A aba Orçamento mostra "R$ 450,00 de R$ 500,00" e "Perto do limite".
  4. Na aba Metas, criar "Notebook" com R$ 4.000 e prazo em 6 meses.
  5. Depositar R$ 1.000. O cartão mostra "R$ 1.000,00 de R$ 4.000,00".
- [ ] **Passo 2:** `npm run test:e2e` até PASS. Depois, `SCREENSHOTS=1 npm run test:e2e -- screenshots`.
- [ ] **Passo 3:** atualizar o README e o HANDOFF.
  - **README:** funcionalidades, contagem de testes e roadmap.
  - **HANDOFF:** a migration a aplicar antes do deploy.
- [ ] **Passo 4:** gates completos. **Passo 5:** commit, push e PR. Depois, a revisão final da branch, as correções, a migration em produção, o merge, o deploy e a conferência em produção.
