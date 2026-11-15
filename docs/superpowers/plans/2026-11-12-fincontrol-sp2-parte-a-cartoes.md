# Sub-projeto 2, Parte A: cartões de crédito — plano de implementação

> **Para agentes:** sub-skill obrigatória: `superpowers:subagent-driven-development` (recomendada) ou `superpowers:executing-plans`. Os passos usam checkbox (`- [ ]`).

**Objetivo:** cartões de crédito integrados ao livro-caixa, com faturas, compras parceladas, limite disponível e o indicador "Comprometimento de renda" (parcelas de cartão + faturas vencidas).

**Arquitetura:** o cartão é uma conta `credit_card` (spec C2). Compras são despesas pagas na conta do cartão, com `invoiceMonth` gravado (C3/C4). Pagar a fatura é uma transferência para o cartão (C2). As regras ficam em funções puras em `apps/api/src/domain/card.ts`. A API reaproveita os módulos `accounts` e `transactions`, e as faturas ganham um módulo `cards`.

**Stack:** Express 5, Prisma 7 (PostgreSQL), Zod 4 (`packages/shared`), React 19 + TanStack Query, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-12-fincontrol-sp2-credito-design.md` (decisões C1–C7 e C13; seções 3 a 11, só a Parte A).

## Restrições globais

- Dinheiro sempre em centavos inteiros (`BigInt` no banco, `number` no TS).
- Datas como `DateOnly` (`AAAA-MM-DD`) e meses como `YearMonth` (`AAAA-MM`), com os helpers de `packages/shared/src/dates.ts` (`addMonthsToYm`, `dateInMonth`, `monthOf`, `daysInMonth`).
- Todo texto de interface em pt-BR. Status sempre com ícone e texto (padrão de `apps/web/src/features/dashboard/health-tiles.tsx`).
- TDD: o teste falha primeiro. Testes de API rodam contra o Postgres real (`npm run db:up`).
- Toda rota filtra por `userId`; recurso de outro usuário dá 404.
- Commits convencionais em pt-BR, um por tarefa.
- Gates no fim de cada tarefa: `npm run lint`, `npm run typecheck` e `npm test`. E2E nas tarefas 9 e 13.

## Foco de revisão

1. **Fechamento no dia 31 em fevereiro, e compra no próprio dia do fechamento.** A compra deve cair na fatura que fecha naquele dia (Tarefa 1).
2. **Parcelas que não dividem exato** (R$ 1.000 em 3x). A soma deve ser exatamente o total, e a 1ª parcela leva o resto (Tarefa 1).
3. **Pagar mais do que a fatura.** O excesso reduz a dívida do cartão, sem erro (Tarefa 7).
4. **Cartão arquivado com fatura em aberto.** Ele continua aparecendo em "A pagar" até a quitação (Tarefa 8).
5. **Usuário sem receita.** O indicador mostra "—", sem divisão por zero (Tarefas 2 e 12).

---

### Tarefa 1: regras de domínio do cartão

**Arquivos:**
- Criar: `apps/api/src/domain/card.ts`
- Teste: `apps/api/src/domain/card.test.ts`

**Interfaces:**
- Produz:
  - `invoiceFor(purchase: DateOnly, closingDay: number, dueDay: number): { invoiceMonth: YearMonth; closingDate: DateOnly; dueDate: DateOnly }`
  - `invoiceDates(invoiceMonth: YearMonth, closingDay: number, dueDay: number): { closingDate: DateOnly; dueDate: DateOnly }`
  - `splitInstallments(totalCents: number, n: number): number[]`
  - `installmentDate(purchase: DateOnly, k: number): DateOnly`
  - `invoiceStatus(i: { today: DateOnly; closingDate: DateOnly; dueDate: DateOnly; amount: number; paid: number }): 'open' | 'closed' | 'paid' | 'overdue'`

- [ ] **Passo 1: escrever o teste que falha**

```ts
import { describe, expect, it } from 'vitest';
import { installmentDate, invoiceDates, invoiceFor, invoiceStatus, splitInstallments } from './card';

describe('invoiceFor', () => {
  it('compra até o fechamento cai na fatura que fecha no mês (vence no seguinte quando o vencimento é antes do fechamento)', () => {
    expect(invoiceFor('2026-11-01', 26, 5)).toEqual({ invoiceMonth: '2026-12', closingDate: '2026-11-26', dueDate: '2026-12-05' });
    expect(invoiceFor('2026-11-26', 26, 5)).toEqual({ invoiceMonth: '2026-12', closingDate: '2026-11-26', dueDate: '2026-12-05' });
  });
  it('compra depois do fechamento vai para a fatura seguinte', () => {
    expect(invoiceFor('2026-11-27', 26, 5)).toEqual({ invoiceMonth: '2027-01', closingDate: '2026-12-26', dueDate: '2027-01-05' });
  });
  it('fechamento no dia 31 em fevereiro vira o último dia do mês', () => {
    expect(invoiceFor('2026-02-28', 31, 10)).toEqual({ invoiceMonth: '2026-03', closingDate: '2026-02-28', dueDate: '2026-03-10' });
  });
  it('vencimento depois do fechamento vence no mesmo mês do fechamento', () => {
    expect(invoiceFor('2026-11-10', 3, 20)).toEqual({ invoiceMonth: '2026-12', closingDate: '2026-12-03', dueDate: '2026-12-20' });
  });
  it('invoiceDates reconstrói fechamento e vencimento de uma fatura', () => {
    expect(invoiceDates('2027-01', 26, 5)).toEqual({ closingDate: '2026-12-26', dueDate: '2027-01-05' });
    expect(invoiceDates('2026-12', 3, 20)).toEqual({ closingDate: '2026-12-03', dueDate: '2026-12-20' });
  });
});

describe('splitInstallments', () => {
  it('divide em centavos e a 1ª parcela leva o resto', () => {
    expect(splitInstallments(120000, 10)).toEqual(Array(10).fill(12000));
    expect(splitInstallments(100000, 3)).toEqual([33334, 33333, 33333]);
    expect(splitInstallments(100000, 3).reduce((a, b) => a + b, 0)).toBe(100000);
  });
});

describe('installmentDate', () => {
  it('parcela k conta na data da compra + (k−1) meses, limitada ao fim do mês', () => {
    expect(installmentDate('2026-01-31', 1)).toBe('2026-01-31');
    expect(installmentDate('2026-01-31', 2)).toBe('2026-02-28');
    expect(installmentDate('2026-11-15', 3)).toBe('2027-01-15');
  });
});

describe('invoiceStatus', () => {
  const base = { closingDate: '2026-11-26', dueDate: '2026-12-05', amount: 50000 };
  it('aberta antes do fechamento', () => expect(invoiceStatus({ ...base, today: '2026-11-25', paid: 0 })).toBe('open'));
  it('fechada entre fechamento e vencimento', () => expect(invoiceStatus({ ...base, today: '2026-11-26', paid: 0 })).toBe('closed'));
  it('paga quando os pagamentos cobrem o valor', () => expect(invoiceStatus({ ...base, today: '2026-11-30', paid: 50000 })).toBe('paid'));
  it('vencida depois do vencimento sem quitação', () => expect(invoiceStatus({ ...base, today: '2026-12-06', paid: 10000 })).toBe('overdue'));
});
```

- [ ] **Passo 2:** rodar `npx vitest run src/domain/card.test.ts` dentro de `apps/api`. Esperado: FAIL ("Failed to resolve import ./card").
- [ ] **Passo 3: implementar**

```ts
import { addMonthsToYm, dateInMonth, monthOf, type DateOnly, type YearMonth } from '@fincontrol/shared';

/** Fechamento e vencimento de uma fatura (spec C3). Vencimento antes do fechamento no calendário = mês seguinte ao fechamento. */
export function invoiceDates(invoiceMonth: YearMonth, closingDay: number, dueDay: number): { closingDate: DateOnly; dueDate: DateOnly } {
  const closingMonth = dueDay > closingDay ? invoiceMonth : addMonthsToYm(invoiceMonth, -1);
  return { closingDate: dateInMonth(closingMonth, closingDay), dueDate: dateInMonth(invoiceMonth, dueDay) };
}

/** Fatura em que a compra cai: até o fechamento (inclusive), a que fecha no mês da compra; depois, a seguinte. */
export function invoiceFor(purchase: DateOnly, closingDay: number, dueDay: number) {
  const purchaseMonth = monthOf(purchase);
  const closingMonth = purchase <= dateInMonth(purchaseMonth, closingDay) ? purchaseMonth : addMonthsToYm(purchaseMonth, 1);
  const invoiceMonth = dueDay > closingDay ? closingMonth : addMonthsToYm(closingMonth, 1);
  return { invoiceMonth, ...invoiceDates(invoiceMonth, closingDay, dueDay) };
}

/** Divide em n parcelas inteiras; a 1ª leva o resto (spec C5). */
export function splitInstallments(totalCents: number, n: number): number[] {
  const base = Math.floor(totalCents / n);
  return Array.from({ length: n }, (_, i) => (i === 0 ? base + (totalCents - base * n) : base));
}

/** Data em que a parcela k conta como gasto (spec C1). */
export function installmentDate(purchase: DateOnly, k: number): DateOnly {
  return dateInMonth(addMonthsToYm(monthOf(purchase), k - 1), Number(purchase.slice(8, 10)));
}

/** Situação da fatura (spec C4). */
export function invoiceStatus(i: { today: DateOnly; closingDate: DateOnly; dueDate: DateOnly; amount: number; paid: number }) {
  if (i.today < i.closingDate) return 'open' as const;
  if (i.paid >= i.amount) return 'paid' as const;
  return i.today > i.dueDate ? ('overdue' as const) : ('closed' as const);
}
```

Antes de implementar, confirme em `packages/shared/src/dates.ts` que `dateInMonth` limita o dia ao fim do mês. Se não limitar, use `Math.min(day, daysInMonth(ano, mes))` dentro de um helper local.

- [ ] **Passo 4:** rodar o teste de novo. Esperado: PASS.
- [ ] **Passo 5:** `git commit -m "feat(api): regras de fatura, parcelas e situação do cartão (domínio)"`

### Tarefa 2: indicador de comprometimento (domínio)

**Arquivos:**
- Modificar: `apps/api/src/domain/health.ts`
- Teste: `apps/api/src/domain/health.test.ts`

**Interfaces:**
- Produz: `debtCommitment(debtPayments: number, monthlyIncomes: number[]): number | null` (fração com 3 casas).

- [ ] **Passo 1: teste que falha** (acrescentar ao arquivo de teste)

```ts
import { debtCommitment } from './health';
describe('debtCommitment', () => {
  it('é parcelas de dívida ÷ renda média dos meses com receita', () => {
    expect(debtCommitment(150000, [500000, 500000, 500000])).toBe(0.3);
    expect(debtCommitment(100000, [0, 300000, 300000])).toBe(0.333);
  });
  it('sem renda registrada, não há indicador', () => expect(debtCommitment(50000, [0, 0, 0])).toBeNull());
  it('sem dívida é 0', () => expect(debtCommitment(0, [400000])).toBe(0));
});
```

- [ ] **Passo 2:** `npx vitest run src/domain/health.test.ts`. Esperado: FAIL.
- [ ] **Passo 3: implementar**

```ts
/** Parte da renda média comprometida com parcelas de dívida (spec C13). Meses sem receita ficam fora da média. */
export function debtCommitment(debtPayments: number, monthlyIncomes: number[]): number | null {
  const withIncome = monthlyIncomes.filter((v) => v > 0);
  if (withIncome.length === 0) return null;
  const average = withIncome.reduce((s, v) => s + v, 0) / withIncome.length;
  return Math.round((debtPayments / average) * 1000) / 1000;
}
```

- [ ] **Passo 4:** PASS. **Passo 5:** `git commit -m "feat(api): indicador de comprometimento de renda (domínio)"`

### Tarefa 3: contratos compartilhados (Zod e DTOs)

**Arquivos:**
- Modificar: `packages/shared/src/schemas/accounts.ts`, `transactions.ts` e `dashboard.ts`
- Teste: `packages/shared/src/schemas/schemas.test.ts`

**Interfaces:**
- Produz:
  - `accountTypeSchema` com `'credit_card'`;
  - `createAccountSchema` com os opcionais `creditLimit`, `closingDay`, `dueDay` e `paymentAccountId`, obrigatórios via `superRefine` quando `type === 'credit_card'`;
  - `AccountDTO` com `creditLimit`, `closingDay`, `dueDay` e `paymentAccountId` (`null` fora de cartão) e `card: { limitAvailable: number; openInvoice: { month: string; amount: number } | null } | null`;
  - `createTransactionSchema` com `installments` opcional (inteiro de 2 a 48, só para `expense`);
  - `TransactionDTO` com `invoiceMonth: string | null`, `installmentNumber: number | null` e `installmentTotal: number | null`;
  - `InvoiceDTO = { month: string; closingDate: string; dueDate: string; amount: number; paid: number; status: 'open' | 'closed' | 'paid' | 'overdue' }`;
  - `payInvoiceSchema = z.object({ amount: z.int().positive(), accountId: idSchema, paidDate: dateOnlySchema })`;
  - `FinancialHealthDTO` com `debtCommitment: number | null` e `debtPayments: number`.

- [ ] **Passo 1: testes que falham**

```ts
it('cartão exige limite, fechamento, vencimento e conta pagadora', () => {
  const base = { name: 'Cartão', type: 'credit_card', color: '#7c3aed', initialBalance: 0 };
  expect(createAccountSchema.safeParse(base).success).toBe(false);
  expect(createAccountSchema.safeParse({ ...base, creditLimit: 800000, closingDay: 26, dueDay: 5, paymentAccountId: '00000000-0000-4000-8000-000000000000' }).success).toBe(true);
  expect(createAccountSchema.safeParse({ ...base, creditLimit: 800000, closingDay: 32, dueDay: 5, paymentAccountId: '00000000-0000-4000-8000-000000000000' }).success).toBe(false);
});
it('parcelamento só de 2 a 48', () => {
  const tx = { type: 'expense', amount: 120000, description: 'TV', accountId: '00000000-0000-4000-8000-000000000000', categoryId: '00000000-0000-4000-8000-000000000001', nature: 'variable', dueDate: '2026-11-10' };
  expect(createTransactionSchema.safeParse({ ...tx, installments: 10 }).success).toBe(true);
  expect(createTransactionSchema.safeParse({ ...tx, installments: 1 }).success).toBe(false);
  expect(createTransactionSchema.safeParse({ ...tx, installments: 49 }).success).toBe(false);
});
```

- [ ] **Passos 2 a 4:** implementar nos três arquivos, seguindo o estilo dos schemas atuais (`fields` + `z.object`). Rodar `npm test -w @fincontrol/shared` até PASS.
- [ ] **Passo 5:** `git commit -m "feat(shared): contratos de cartão, parcelas, faturas e comprometimento"`

### Tarefa 4: migration do Prisma

**Arquivos:**
- Modificar: `apps/api/prisma/schema.prisma`
- Criar: a migration gerada em `apps/api/prisma/migrations/<timestamp>_cartoes/`

**O que muda:**
- `enum AccountType` + `credit_card`;
- `Account` + `creditLimit BigInt?`, `closingDay Int?`, `dueDay Int?` e `paymentAccountId String? @db.Uuid` (relação self opcional, `onDelete: SetNull`);
- `Transaction` + `invoiceMonth DateTime? @db.Date`, `installmentGroupId String? @db.Uuid`, `installmentNumber Int?` e `installmentTotal Int?`;
- índice em (`accountId`, `invoiceMonth`);
- na migration SQL: um `CHECK` de que, quando `type = 'credit_card'`, os quatro campos não são nulos e os dias ficam entre 1 e 31.

- [ ] **Passo 1:** editar o schema e rodar `npm run db:migrate -w @fincontrol/api -- --name cartoes`.
- [ ] **Passo 2:** acrescentar o `CHECK` ao `migration.sql` gerado, aplicar no banco de teste (`npx prisma migrate deploy`) e rodar `npm test -w @fincontrol/api`. Esperado: tudo PASS, sem regressão.
- [ ] **Passo 3:** `git commit -m "feat(db): colunas de cartão, fatura e parcelas"`

### Tarefa 5: API de contas para cartões

**Arquivos:**
- Modificar: `apps/api/src/modules/accounts/accounts.{repository,service,routes}.ts`
- Teste: `apps/api/test/cards.test.ts` (novo)

**Interfaces:**
- Consome: `invoiceFor` (Tarefa 1) e os schemas da Tarefa 3.
- Produz: `AccountDTO.card` preenchido. O saldo do cartão usa a mesma regra de `balanceAt`.

- [ ] **Passo 1: teste de integração que falha**

```ts
it('cria cartão (saldo 0), valida campos e mostra limite disponível', async () => {
  const user = await newUser();
  const checking = await createAccount(app, user, { name: 'Corrente', initialBalance: 500000 });
  const bad = await request(app).post('/api/v1/accounts').set(user.auth).send({ name: 'Cartão', type: 'credit_card', color: '#7c3aed', initialBalance: 0 });
  expect(bad.status).toBe(422);
  const card = await createAccount(app, user, { name: 'Cartão', type: 'credit_card', color: '#7c3aed', creditLimit: 800000, closingDay: 26, dueDay: 5, paymentAccountId: checking.id });
  expect(card).toMatchObject({ type: 'credit_card', balance: 0, creditLimit: 800000, card: { limitAvailable: 800000, openInvoice: null } });
});
it('saldo inicial diferente de 0 em cartão dá 422', async () => {
  const user = await newUser();
  const checking = await createAccount(app, user);
  const res = await request(app).post('/api/v1/accounts').set(user.auth).send({ name: 'C', type: 'credit_card', color: '#7c3aed', initialBalance: 100, creditLimit: 1, closingDay: 1, dueDay: 10, paymentAccountId: checking.id });
  expect(res.status).toBe(422);
});
it('conta pagadora de outro usuário dá 404', async () => {
  const [a, b] = [await newUser(), await newUser()];
  const other = await createAccount(app, b);
  const res = await request(app).post('/api/v1/accounts').set(a.auth).send({ name: 'C', type: 'credit_card', color: '#7c3aed', initialBalance: 0, creditLimit: 1, closingDay: 1, dueDay: 10, paymentAccountId: other.id });
  expect(res.status).toBe(404);
});
```

- [ ] **Passos 2 a 4:**
  - validar no service: tipo cartão ⇒ `initialBalance === 0` e conta pagadora própria, não arquivada e que não é cartão;
  - mapear os campos no repositório;
  - calcular `card.limitAvailable = creditLimit + balance` (o saldo do cartão é ≤ 0);
  - calcular `openInvoice` com o mês de `invoiceFor(hoje, …)` e a soma das despesas com aquele `invoiceMonth`.

  Rodar até PASS.
- [ ] **Passo 5:** `git commit -m "feat(api): cartões como contas, com limite disponível e fatura aberta"`

### Tarefa 6: compras no cartão e parceladas

**Arquivos:**
- Modificar: `apps/api/src/modules/transactions/transactions.service.ts` e `transactions.repository.ts`
- Teste: `apps/api/test/cards.test.ts`

**Interfaces:**
- Consome: `invoiceFor`, `splitInstallments` e `installmentDate` (Tarefa 1).
- Produz: `POST /transactions` em cartão devolve `{ ...TransactionDTO, installments?: TransactionDTO[] }`.

- [ ] **Passo 1: testes que falham**

```ts
it('compra à vista no cartão: paga na data, cai na fatura certa e não mexe na conta corrente', async () => {
  const { user, card, checking, food } = await cardScenario(); // corrente 5.000, cartão fecha 26 e vence 5
  const tx = await createTransaction(app, user, { type: 'expense', amount: 30000, description: 'Mercado', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-11-01' });
  expect(tx).toMatchObject({ status: 'paid', paidDate: '2026-11-01', invoiceMonth: '2026-12', installmentNumber: null });
  const accounts = (await request(app).get('/api/v1/accounts').set(user.auth)).body;
  expect(accounts.find((a: { id: string }) => a.id === checking.id).balance).toBe(500000);
  expect(accounts.find((a: { id: string }) => a.id === card.id)).toMatchObject({ balance: -30000, card: { limitAvailable: 770000 } });
});
it('parcelada em 3x: soma exata, faturas consecutivas, 1ª leva o resto, limite consome o total', async () => {
  const { user, card, food } = await cardScenario();
  // Compra em 27/10 (depois do fechamento de 26/10) → 1ª parcela na fatura 2026-12. Parcelas 2 e 3 têm data futura: só o sistema pode gerá-las.
  const res = await request(app).post('/api/v1/transactions').set(user.auth).send({ type: 'expense', amount: 100000, description: 'Celular', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-10-27', installments: 3 });
  expect(res.status).toBe(201);
  expect(res.body.installments.map((t: { amount: number; invoiceMonth: string; paidDate: string; installmentNumber: number }) => [t.amount, t.invoiceMonth, t.paidDate, t.installmentNumber])).toEqual([
    [33334, '2026-12', '2026-10-27', 1], [33333, '2027-01', '2026-11-27', 2], [33333, '2027-02', '2026-12-27', 3],
  ]);
  const accounts = (await request(app).get('/api/v1/accounts').set(user.auth)).body;
  expect(accounts.find((a: { id: string }) => a.id === card.id).card.limitAvailable).toBe(700000);
});
it('compra no cartão com data futura dá 422 (mesma regra dos lançamentos pagos)', async () => {
  const { user, card, food } = await cardScenario();
  const res = await request(app).post('/api/v1/transactions').set(user.auth).send({ type: 'expense', amount: 1000, description: 'x', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-11-30' });
  expect(res.status).toBe(422);
});
it('receita em cartão dá 422', async () => {
  const { user, card } = await cardScenario();
  const res = await request(app).post('/api/v1/transactions').set(user.auth).send({ type: 'income', amount: 100, description: 'x', accountId: card.id, nature: 'variable', dueDate: '2026-11-01' });
  expect(res.status).toBe(422);
});
```

(`cardScenario` é um helper local do arquivo: cria o usuário, a corrente com 500000, o cartão com limite 800000, fechamento 26, vencimento 5 e pagadora = corrente, e a categoria "Alimentação".)

- [ ] **Passos 2 a 4:** no `create` do service, se a conta for cartão:
  - recusar `income` (422);
  - forçar `status: 'paid'`, com `paidDate` igual à data da compra (a compra não pode ser futura: 422; só as parcelas k ≥ 2, geradas pelo sistema, têm data futura);
  - calcular `invoiceFor` e, com `installments`, criar N lançamentos numa transação do banco, com o mesmo `installmentGroupId`, `paidDate = installmentDate(compra, k)` e `invoiceMonth` = fatura da 1ª + (k−1) meses.

  Rodar até PASS.
- [ ] **Passo 5:** `git commit -m "feat(api): compras no cartão e parceladas, com fatura gravada"`

### Tarefa 7: faturas e pagamento

**Arquivos:**
- Criar: `apps/api/src/modules/cards/cards.{repository,service,routes}.ts` (registrar em `http/routes.ts` como `/cards`)
- Teste: `apps/api/test/cards.test.ts`

**Interfaces:**
- Consome: `invoiceDates` e `invoiceStatus` (Tarefa 1) e `payInvoiceSchema` (Tarefa 3).
- Produz:
  - `GET /cards/:id/invoices?from&to` → `InvoiceDTO[]`;
  - `GET /cards/:id/invoices/:month` → `InvoiceDTO & { transactions: TransactionDTO[] }`;
  - `POST /cards/:id/invoices/:month/payments` → 201 com a transferência criada.

- [ ] **Passo 1: testes que falham**

```ts
it('fatura fechada aparece com valor e situação; pagar reduz a corrente, marca paga e devolve o limite', async () => {
  const { user, card, checking, food } = await cardScenario();
  await createTransaction(app, user, { type: 'expense', amount: 30000, description: 'Mercado', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-10-20' }); // fatura 2026-11 (fecha 26/10, vence 05/11)
  const inv = await request(app).get(`/api/v1/cards/${card.id}/invoices/2026-11`).set(user.auth);
  expect(inv.body).toMatchObject({ month: '2026-11', amount: 30000, paid: 0, status: 'overdue', closingDate: '2026-10-26', dueDate: '2026-11-05' });
  const pay = await request(app).post(`/api/v1/cards/${card.id}/invoices/2026-11/payments`).set(user.auth).send({ amount: 30000, accountId: checking.id, paidDate: '2026-11-10' });
  expect(pay.status).toBe(201);
  expect((await request(app).get(`/api/v1/cards/${card.id}/invoices/2026-11`).set(user.auth)).body.status).toBe('paid');
  const accounts = (await request(app).get('/api/v1/accounts').set(user.auth)).body;
  expect(accounts.find((a: { id: string }) => a.id === checking.id).balance).toBe(470000);
  expect(accounts.find((a: { id: string }) => a.id === card.id)).toMatchObject({ balance: 0, card: { limitAvailable: 800000 } });
  const summary = (await request(app).get('/api/v1/dashboard/summary').set(user.auth)).body;
  expect(summary.expense.current).toBe(0); // o pagamento não conta como gasto em novembro (a compra foi em outubro)
});
it('pagar mais do que a fatura reduz a dívida do cartão sem erro', async () => {
  const { user, card, checking } = await cardScenario();
  const pay = await request(app).post(`/api/v1/cards/${card.id}/invoices/2026-11/payments`).set(user.auth).send({ amount: 5000, accountId: checking.id, paidDate: '2026-11-10' });
  expect(pay.status).toBe(201);
});
it('isolamento: fatura de outro usuário dá 404', async () => {
  const { card } = await cardScenario();
  const intruder = await newUser();
  expect((await request(app).get(`/api/v1/cards/${card.id}/invoices/2026-11`).set(intruder.auth)).status).toBe(404);
  expect((await request(app).post(`/api/v1/cards/${card.id}/invoices/2026-11/payments`).set(intruder.auth).send({ amount: 1, accountId: card.id, paidDate: '2026-11-10' })).status).toBe(404);
});
```

- [ ] **Passos 2 a 4:**
  - **Valores da fatura:** valor = soma das despesas do cartão com o `invoiceMonth`; pago = soma das transferências com destino ao cartão e o mesmo `invoiceMonth`.
  - **Pagamento:** cria uma `transfer` paga da conta informada para o cartão, com `invoiceMonth`.
  - **Lista:** cobre do mês da compra mais antiga até a fatura aberta.

  Rodar até PASS.
- [ ] **Passo 5:** `git commit -m "feat(api): faturas do cartão e pagamento por transferência"`

### Tarefa 8: painel (comprometimento e faturas em "A pagar")

**Arquivos:**
- Modificar: `apps/api/src/modules/dashboard/dashboard.{repository,service}.ts`
- Teste: `apps/api/test/dashboard.test.ts`

**Interfaces:**
- Consome: `debtCommitment` (Tarefa 2) e o cálculo de fatura da Tarefa 7.
- Produz:
  - `health.debtCommitment` e `health.debtPayments`;
  - `upcoming` com itens de fatura `{ kind: 'invoice', cardId, cardName, month, dueDate, remaining }`, ao lado das transações, que ganham `kind: 'transaction'`.

- [ ] **Passo 1: testes que falham**
  - **Comprometimento:** um usuário com receitas pagas de 500000 em agosto, setembro e outubro e um cartão com compra 3x de 90000 em 2026-10-05 (faturas 2026-11, 2026-12 e 2027-01; a parcela de 30000 com fatura no mês corrente, 2026-11, entra no indicador) → `health.debtPayments === 30000` e `health.debtCommitment === 0.06`.
  - **"A pagar":** uma fatura fechada e não paga aparece em `upcoming` com `kind: 'invoice'`, mesmo com o cartão arquivado.
- [ ] **Passos 2 a 4:**
  - `debtPayments` = soma das parcelas (`installmentTotal ≥ 2`) com `invoiceMonth` no mês corrente, mais o restante das faturas vencidas.
  - Renda média = receitas pagas dos 3 meses completos anteriores (a mesma janela da reserva).
  - Rodar até PASS.
- [ ] **Passo 5:** `git commit -m "feat(api): comprometimento de renda e faturas em 'A pagar' no painel"`

### Tarefa 9: demo com cartão

**Arquivos:**
- Modificar: `apps/api/src/domain/demo-data.ts`, `apps/api/src/modules/demo/demo.service.ts` e `apps/api/test/demo.test.ts`

**O que muda:**
- **"Cartão principal"** (limite de 800000, fecha no dia 26, vence no dia 5, pagadora = Conta corrente);
- compras de 6 meses em Alimentação, Compras e Lazer, com 5 faturas pagas por transferência, uma fechada e a aberta;
- uma compra de 120000 em 10x em andamento.

- [ ] **Passo 1:**
  - **Teste que falha:** depois do seed há 4 contas, uma `credit_card` com `card.limitAvailable < 800000`, e `health.debtCommitment > 0`.
  - **Teste existente:** `demo-data.test` continua determinístico.
- [ ] **Passos 2 a 4:** gerar os dados no `buildDemoData` e gravá-los dentro do `inTransaction` do seed. Rodar o PASS e o E2E (`npm run test:e2e`).
- [ ] **Passo 5:** `git commit -m "feat(demo): cartão com faturas e compra parcelada"`

### Tarefa 10: web — cadastro e card do cartão em Contas

**Arquivos:**
- Modificar: `apps/web/src/features/accounts/{api.ts,account-form.tsx,accounts-page.tsx}`
- Teste: `apps/web/src/features/accounts/accounts-page.test.tsx`

- [ ] **Passo 1: teste que falha**
  - Escolher o tipo "Cartão de crédito" mostra os campos Limite, Dia de fechamento, Dia de vencimento e Conta para pagar a fatura, e esconde Saldo inicial.
  - O POST envia os campos.
  - A lista mostra "Disponível R$ 7.700,00 de R$ 8.000,00" e "Fatura aberta: R$ 300,00".
- [ ] **Passos 2 a 4:** implementar com os componentes existentes (`Field`, `Input`, `Select`, `MoneyInput`), mais um link "Ver faturas" para `/cartoes/:id`. Rodar até PASS.
- [ ] **Passo 5:** `git commit -m "feat(web): cadastro de cartão e limite disponível em Contas"`

### Tarefa 11: web — parcelamento no lançamento e página de faturas

**Arquivos:**
- Modificar: `apps/web/src/features/transactions/transaction-form.tsx` e `apps/web/src/app/router.tsx`
- Criar: `apps/web/src/features/cards/{api.ts,invoices-page.tsx,pay-invoice-dialog.tsx}`
- Testes: `transaction-form` e `invoices-page.test.tsx`

- [ ] **Passo 1: testes que falham**
  - **Lançamento:** com um cartão selecionado aparece "Parcelar em" (1x a 48x). Com R$ 1.200 em 10x, a prévia diz "10x de R$ 120,00".
  - **Faturas:** a página lista as faturas com situação escrita (Aberta, Fechada, Paga, Vencida), cada uma com ícone.
  - **Pagamento:** "Pagar fatura" abre um diálogo com o valor restante sugerido e a conta pagadora padrão, e envia o POST de pagamento.
- [ ] **Passos 2 a 4:** implementar. A rota `/cartoes/:id` fica dentro do `RequireAuth`; as mutações usam `useFinanceMutation`. Rodar até PASS.
- [ ] **Passo 5:** `git commit -m "feat(web): parcelamento no cartão e página de faturas com pagamento"`

### Tarefa 12: web — tile "Comprometimento de renda"

**Arquivos:**
- Modificar: `apps/web/src/features/dashboard/health-tiles.tsx` (e o teste)

- [ ] **Passo 1: teste que falha**
  - 0.06 → "6%" e "Na meta";
  - 0.35 → "Atenção";
  - 0.5 → "Alto";
  - `null` → "—" e "Sem receitas nos últimos 3 meses.";
  - o texto da meta diz "Meta: até 30% da renda".
  - **O status segue o número exibido:** 0.305 aparece como "31%" e cai em "Atenção" (`Math.round(rate * 100) > 30`), na mesma regra de arredondamento da taxa de poupança.
- [ ] **Passos 2 a 4:**
  - o grid passa para `sm:grid-cols-3`;
  - os tons reutilizam `TONE` (`good`, `warning`, `critical`);
  - conferir visualmente em 360 px e no desktop.
- [ ] **Passo 5:** `git commit -m "feat(web): tile de comprometimento de renda"`

### Tarefa 13: E2E, documentação e entrega

**Arquivos:**
- Criar: `e2e/tests/cartao.spec.ts`
- Modificar: `README.md` e `docs/HANDOFF.md`

- [ ] **Passo 1: E2E que falha**
  1. Cadastro → corrente de R$ 5.000 e cartão (fecha no dia 26, vence no dia 5).
  2. Lançar R$ 300 no cartão em Alimentação.
  3. Conferir na tela Faturas: valor de R$ 300,00 e situação escrita.
  4. Pagar a fatura.
  5. A corrente mostra R$ 4.700,00, e o cartão mostra disponível = limite.
- [ ] **Passo 2:** rodar `npm run test:e2e` até PASS e regenerar os screenshots (`SCREENSHOTS=1 npm run test:e2e -- screenshots`).
- [ ] **Passo 3:** atualizar o README (funcionalidades, testes) e o HANDOFF (o que foi entregue e o que vem na Parte B).
- [ ] **Passo 4:** gates completos (`lint`, `typecheck`, `npm test` e E2E).
- [ ] **Passo 5:** `git commit -m "test(e2e): fluxo de compra e pagamento de fatura; docs da Parte A"`, push e PR (via @devops), aguardando o CI e o CodeRabbit.
