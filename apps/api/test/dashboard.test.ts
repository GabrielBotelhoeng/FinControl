import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers/app';
import { newUser, type TestUser } from './helpers/auth';
import { resetDb } from './helpers/db';
import { categoryId, createAccount, createTransaction } from './helpers/factories';

const { app } = buildTestApp();

async function scenario(user: TestUser) {
  const a = await createAccount(app, user, { name: 'Corrente', initialBalance: 100000 });
  const b = await createAccount(app, user, { name: 'Poupança', type: 'savings' });
  const food = await categoryId(app, user, 'Alimentação', 'expense');
  const home = await categoryId(app, user, 'Moradia', 'expense');
  const salary = await categoryId(app, user, 'Salário', 'income');
  const freela = await categoryId(app, user, 'Freelance', 'income');
  const tx = (body: Record<string, unknown>) => createTransaction(app, user, { accountId: a.id, nature: 'variable', ...body });
  await tx({ type: 'income', amount: 500000, description: 'Salário', categoryId: salary, nature: 'fixed', dueDate: '2026-11-01', status: 'paid', paidDate: '2026-11-01' });
  await tx({ type: 'expense', amount: 20000, description: 'Mercado', categoryId: food, dueDate: '2026-11-05', status: 'paid', paidDate: '2026-11-05' });
  await tx({ type: 'expense', amount: 10000, description: 'Feira', categoryId: food, dueDate: '2026-10-10', status: 'paid', paidDate: '2026-10-10' });
  await tx({ type: 'expense', amount: 30000, description: 'Aluguel', categoryId: home, nature: 'fixed', dueDate: '2026-11-20' });
  await tx({ type: 'expense', amount: 5000, description: 'Seguro', categoryId: home, nature: 'fixed', dueDate: '2026-11-03' });
  await tx({ type: 'income', amount: 80000, description: 'Projeto', categoryId: freela, dueDate: '2026-12-05' });
  await createTransaction(app, user, {
    type: 'transfer', amount: 10000, description: 'Reserva', accountId: a.id, destinationAccountId: b.id,
    dueDate: '2026-11-02', status: 'paid', paidDate: '2026-11-02',
  });
  return { a, b };
}

/** Usuário com conta corrente, cartão (fecha 26, vence 5 por padrão) e categoria "Alimentação" (Tarefa 8). */
async function cardScenario(user: TestUser, cardOverrides: Record<string, unknown> = {}) {
  const checking = await createAccount(app, user, { initialBalance: 500000 });
  const card = await createAccount(app, user, {
    type: 'credit_card', color: '#7c3aed', creditLimit: 800000, closingDay: 26, dueDay: 5, paymentAccountId: checking.id, ...cardOverrides,
  });
  const food = await categoryId(app, user, 'Alimentação', 'expense');
  return { checking, card, food };
}

describe('dashboard', () => {
  beforeEach(resetDb);

  it('saúde financeira: taxa de poupança do mês e meses de reserva só com contas líquidas', async () => {
    const user = await newUser();
    const checking = await createAccount(app, user, { name: 'Corrente', initialBalance: 600000 });
    await createAccount(app, user, { name: 'Corretora', type: 'investment', initialBalance: 1000000 });
    const food = await categoryId(app, user, 'Alimentação', 'expense');
    const salary = await categoryId(app, user, 'Salário', 'income');
    const paid = (type: 'income' | 'expense', amount: number, date: string, categoryId: string) =>
      createTransaction(app, user, { type, amount, description: `${type} ${date}`, accountId: checking.id, categoryId, nature: 'variable', dueDate: date, status: 'paid', paidDate: date });
    for (const date of ['2026-08-10', '2026-09-10', '2026-10-10']) await paid('expense', 100000, date, food);
    await paid('income', 500000, '2026-11-01', salary);
    await paid('expense', 100000, '2026-11-05', food);

    const res = await request(app).get('/api/v1/dashboard/summary').set(user.auth);
    expect(res.status).toBe(200);
    // Líquido: 6.000 − 3.000 + 5.000 − 1.000 = 7.000 (a corretora fica de fora). Média de ago–out: 1.000.
    expect(res.body.health).toEqual({
      savingsRate: 0.8, reserveMonths: 7, liquidBalance: 700000, averageMonthlyExpense: 100000, debtCommitment: null, debtPayments: 0,
    });
  });

  it('saúde financeira de quem acabou de começar: sem histórico, sem receita', async () => {
    const user = await newUser();
    await createAccount(app, user, { name: 'Carteira', type: 'wallet', initialBalance: 5000 });
    const res = await request(app).get('/api/v1/dashboard/summary').set(user.auth);
    expect(res.body.health).toEqual({
      savingsRate: null, reserveMonths: null, liquidBalance: 5000, averageMonthlyExpense: null, debtCommitment: null, debtPayments: 0,
    });
  });

  it('resumo do mês: saldo, previsão, comparação, pendentes e vencidas', async () => {
    const user = await newUser();
    await scenario(user);
    const res = await request(app).get('/api/v1/dashboard/summary').set(user.auth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      month: '2026-11',
      totalBalance: 570000,
      forecastEndOfMonth: 535000,
      income: { current: 500000, previous: 0, changePercent: null },
      expense: { current: 20000, previous: 10000, changePercent: 100 },
      pendingCount: 2,
      overdueCount: 1,
    });
    expect(res.body.upcoming.map((t: { description: string; overdue: boolean }) => [t.description, t.overdue])).toEqual([
      ['Seguro', true], ['Aluguel', false],
    ]);
  });

  it('transferências não contam como receita nem despesa e conta arquivada sai do saldo total', async () => {
    const user = await newUser();
    const { b } = await scenario(user);
    await request(app).post(`/api/v1/accounts/${b.id}/archive`).set(user.auth);
    const res = await request(app).get('/api/v1/dashboard/summary').set(user.auth);
    expect(res.body.totalBalance).toBe(560000);
    expect(res.body.expense.current).toBe(20000);
  });

  it('evolução mês a mês com saldo de fim de mês', async () => {
    const user = await newUser();
    await scenario(user);
    const res = await request(app).get('/api/v1/dashboard/evolution?months=2').set(user.auth);
    expect(res.body).toEqual([
      { month: '2026-10', income: 0, expense: 10000, endBalance: 90000 },
      { month: '2026-11', income: 500000, expense: 20000, endBalance: 570000 },
    ]);
  });

  it('gastos por categoria só com despesas pagas do mês', async () => {
    const user = await newUser();
    await scenario(user);
    const res = await request(app).get('/api/v1/dashboard/by-category?month=2026-11').set(user.auth);
    expect(res.body).toEqual([expect.objectContaining({ name: 'Alimentação', total: 20000 })]);
  });

  it('o resumo materializa recorrências sem precisar listar antes', async () => {
    const user = await newUser();
    const a = await createAccount(app, user);
    const bills = await categoryId(app, user, 'Contas', 'expense');
    await createTransaction(app, user, {
      type: 'expense', amount: 11990, description: 'Internet', accountId: a.id, categoryId: bills, nature: 'fixed',
      dueDate: '2026-10-15', recurrence: { frequency: 'monthly' },
    });
    const res = await request(app).get('/api/v1/dashboard/summary').set(user.auth);
    expect(res.body.upcoming.map((t: { dueDate: string }) => t.dueDate)).toEqual(['2026-10-15', '2026-11-15']);
    expect(res.body.overdueCount).toBe(1);
  });

  it('valida os parâmetros', async () => {
    const user = await newUser();
    expect((await request(app).get('/api/v1/dashboard/summary?month=2026-13').set(user.auth)).status).toBe(400);
    expect((await request(app).get('/api/v1/dashboard/evolution?months=24').set(user.auth)).status).toBe(400);
  });

  describe('comprometimento de renda e faturas do cartão em "A pagar" (Tarefa 8)', () => {
    it('comprometimento de renda: parcela da fatura do mês corrente já vencida conta uma vez só (R15)', async () => {
      const user = await newUser();
      const { checking, card, food } = await cardScenario(user); // fecha 26, vence 5
      const salary = await categoryId(app, user, 'Salário', 'income');
      const paidIncome = (date: string) =>
        createTransaction(app, user, {
          type: 'income', amount: 500000, description: 'Salário', accountId: checking.id, categoryId: salary, nature: 'fixed',
          dueDate: date, status: 'paid', paidDate: date,
        });
      await paidIncome('2026-08-05');
      await paidIncome('2026-09-05');
      await paidIncome('2026-10-05');

      // Compra 3x de 90000 em 2026-10-05 → faturas 2026-11, 2026-12 e 2027-01 (30000 cada). A fatura 2026-11
      // (fecha 26/10, vence 05/11) já está vencida em 2026-11-11: pela fórmula literal, a parcela de 30000
      // entraria de novo (60000); a decisão R15 soma só o restante da fatura vencida (30000).
      const purchase = await request(app).post('/api/v1/transactions').set(user.auth).send({
        type: 'expense', amount: 90000, description: 'Notebook', accountId: card.id, categoryId: food, nature: 'variable',
        dueDate: '2026-10-05', installments: 3,
      });
      expect(purchase.status).toBe(201);

      const res = await request(app).get('/api/v1/dashboard/summary').set(user.auth);
      expect(res.body.health.debtPayments).toBe(30000);
      expect(res.body.health.debtCommitment).toBe(0.06);
    });

    it('"A pagar": fatura fechada e não paga aparece com kind \'invoice\', mesmo com o cartão arquivado (foco 4)', async () => {
      const user = await newUser();
      const { card, food } = await cardScenario(user, { closingDay: 5, dueDay: 20 });
      await createTransaction(app, user, {
        type: 'expense', amount: 30000, description: 'Compra', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-11-02',
      }); // fecha 05/11, vence 20/11 → fatura 2026-11 fechada (ainda não vencida em 2026-11-11)
      await request(app).post(`/api/v1/accounts/${card.id}/archive`).set(user.auth);

      const res = await request(app).get('/api/v1/dashboard/summary').set(user.auth);
      const invoiceItem = res.body.upcoming.find((i: { kind: string }) => i.kind === 'invoice');
      expect(invoiceItem).toMatchObject({
        kind: 'invoice', cardId: card.id, cardName: card.name, month: '2026-11', dueDate: '2026-11-20', remaining: 30000,
        status: 'closed', // situação vem do servidor (R26), não é recalculada pela web a partir de dueDate
      });
    });

    it('fatura do mês corrente ainda não vencida conta só as parcelas, não a compra à vista (fechamento 1, vencimento 20)', async () => {
      const user = await newUser();
      const { card, food } = await cardScenario(user, { closingDay: 1, dueDay: 20 });
      await createTransaction(app, user, {
        type: 'expense', amount: 20000, description: 'À vista', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-10-15',
      }); // fatura 2026-11 (fecha 01/11, vence 20/11 — ainda não vencida em 2026-11-11)
      const installment = await request(app).post('/api/v1/transactions').set(user.auth).send({
        type: 'expense', amount: 50000, description: 'Parcelada', accountId: card.id, categoryId: food, nature: 'variable',
        dueDate: '2026-10-10', installments: 2,
      }); // 1ª parcela (25000) cai também na fatura 2026-11; a 2ª cai em 2026-12
      expect(installment.status).toBe(201);

      const res = await request(app).get('/api/v1/dashboard/summary').set(user.auth);
      expect(res.body.health.debtPayments).toBe(25000);
    });

    it('fatura vencida de mês anterior com compra à vista conta o restante em debtPayments', async () => {
      const user = await newUser();
      const { card, food } = await cardScenario(user);
      await createTransaction(app, user, {
        type: 'expense', amount: 40000, description: 'TV', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-09-10',
      }); // fatura 2026-10 (fecha 26/09, vence 05/10) — vencida em 2026-11-11

      const res = await request(app).get('/api/v1/dashboard/summary').set(user.auth);
      expect(res.body.health.debtPayments).toBe(40000);
    });

    it('pagamento parcial de uma fatura vencida reduz o restante em debtPayments e em "A pagar"', async () => {
      const user = await newUser();
      const { checking, card, food } = await cardScenario(user);
      await createTransaction(app, user, {
        type: 'expense', amount: 40000, description: 'TV', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-09-10',
      }); // fatura 2026-10, vencida
      const pay = await request(app)
        .post(`/api/v1/cards/${card.id}/invoices/2026-10/payments`)
        .set(user.auth)
        .send({ amount: 15000, accountId: checking.id, paidDate: '2026-11-10' });
      expect(pay.status).toBe(201);

      const res = await request(app).get('/api/v1/dashboard/summary').set(user.auth);
      expect(res.body.health.debtPayments).toBe(25000); // 40000 − 15000
      const invoiceItem = res.body.upcoming.find((i: { kind: string; month?: string }) => i.kind === 'invoice' && i.month === '2026-10');
      expect(invoiceItem.remaining).toBe(25000);
      expect(invoiceItem.status).toBe('overdue'); // continua vencida mesmo paga em parte
    });

    it('sem receita nos últimos 3 meses: debtCommitment é null, mas debtPayments é calculado', async () => {
      const user = await newUser();
      const { card, food } = await cardScenario(user);
      await createTransaction(app, user, {
        type: 'expense', amount: 40000, description: 'TV', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-09-10',
      }); // fatura vencida 2026-10, sem nenhuma receita no cenário

      const res = await request(app).get('/api/v1/dashboard/summary').set(user.auth);
      expect(res.body.health.debtCommitment).toBeNull();
      expect(res.body.health.debtPayments).toBe(40000);
    });

    it('pendingCount e overdueCount somam as faturas fechadas/vencidas às transações pendentes', async () => {
      const user = await newUser();
      const checking = await createAccount(app, user);
      const home = await categoryId(app, user, 'Moradia', 'expense');
      await createTransaction(app, user, { type: 'expense', amount: 5000, description: 'Conta futura', accountId: checking.id, categoryId: home, nature: 'fixed', dueDate: '2026-11-20' });
      await createTransaction(app, user, { type: 'expense', amount: 3000, description: 'Conta vencida', accountId: checking.id, categoryId: home, nature: 'fixed', dueDate: '2026-11-03' });

      const { card: closedCard, food: food1 } = await cardScenario(user, { closingDay: 5, dueDay: 20 });
      await createTransaction(app, user, {
        type: 'expense', amount: 10000, description: 'Mercado', accountId: closedCard.id, categoryId: food1, nature: 'variable', dueDate: '2026-11-02',
      }); // fatura 2026-11 fechada (ainda não vencida)

      const { card: overdueCard, food: food2 } = await cardScenario(user);
      await createTransaction(app, user, {
        type: 'expense', amount: 20000, description: 'Celular', accountId: overdueCard.id, categoryId: food2, nature: 'variable', dueDate: '2026-09-10',
      }); // fatura vencida

      const res = await request(app).get('/api/v1/dashboard/summary').set(user.auth);
      expect(res.body.pendingCount).toBe(4); // 2 transações + fatura fechada + fatura vencida
      expect(res.body.overdueCount).toBe(2); // 1 transação vencida + 1 fatura vencida
    });
  });
});
