import type { ReportDTO } from '@fincontrol/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers/app';
import { newUser, type TestUser } from './helpers/auth';
import { resetDb } from './helpers/db';
import { categoryId, createAccount, createTransaction } from './helpers/factories';

const { app } = buildTestApp();

const report = async (user: TestUser, from: string, to: string) => {
  const res = await request(app).get(`/api/v1/reports?from=${from}&to=${to}`).set(user.auth);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body as ReportDTO;
};

/** Hoje é 2026-11-11. Outubro: R$ 4.000 de receita e R$ 2.000 de despesa; novembro: R$ 5.000 e R$ 3.000 (critério 1). */
async function scenario(user: TestUser) {
  const checking = await createAccount(app, user, { name: 'Corrente', initialBalance: 100000 });
  const savings = await createAccount(app, user, { name: 'Poupança', type: 'savings', initialBalance: 50000 });
  const salary = await categoryId(app, user, 'Salário', 'income');
  const food = await categoryId(app, user, 'Alimentação', 'expense');
  const home = await categoryId(app, user, 'Moradia', 'expense');
  const leisure = await categoryId(app, user, 'Lazer', 'expense');
  const paid = (type: 'income' | 'expense', amount: number, date: string, category: string, description: string) =>
    createTransaction(app, user, { type, amount, description, accountId: checking.id, categoryId: category, nature: 'variable', dueDate: date, status: 'paid', paidDate: date });

  await paid('income', 400000, '2026-10-01', salary, 'Salário outubro');
  await paid('expense', 150000, '2026-10-05', home, 'Aluguel');
  await paid('expense', 50000, '2026-10-12', food, 'Mercado outubro');
  await paid('income', 500000, '2026-11-01', salary, 'Salário novembro');
  await paid('expense', 200000, '2026-11-03', food, 'Mercado novembro');
  await paid('expense', 100000, '2026-11-08', leisure, 'Show');
  // Fora do relatório: pendente (R2) e transferência.
  await createTransaction(app, user, { type: 'expense', amount: 99900, description: 'Conta pendente', accountId: checking.id, categoryId: food, nature: 'variable', dueDate: '2026-11-20' });
  await createTransaction(app, user, {
    type: 'transfer', amount: 30000, description: 'Guardar', accountId: checking.id, destinationAccountId: savings.id,
    dueDate: '2026-11-09', status: 'paid', paidDate: '2026-11-09',
  });
  return { checking, savings, food };
}

describe('relatórios', () => {
  beforeEach(resetDb);

  it('critério 1: totais do mês e comparação com o mês anterior; pendentes e transferências ficam de fora', async () => {
    const user = await newUser();
    await scenario(user);
    const r = await report(user, '2026-11', '2026-11');
    expect(r.period).toEqual({ from: '2026-11', to: '2026-11', months: 1, previousFrom: '2026-10', previousTo: '2026-10' });
    expect(r.totals).toEqual({
      income: 500000, expense: 300000, net: 200000, savingsRate: 0.4,
      previousIncome: 400000, previousExpense: 200000, incomeChange: 0.25, expenseChange: 0.5,
    });
  });

  it('categorias com participação e variação; a que só existiu no período anterior entra com total 0', async () => {
    const user = await newUser();
    await scenario(user);
    const r = await report(user, '2026-11', '2026-11');
    expect(r.expenseByCategory.map((c) => [c.name, c.total, c.previous, c.change])).toEqual([
      ['Alimentação', 200000, 50000, 3],
      ['Lazer', 100000, 0, null],
      ['Moradia', 0, 150000, -1],
    ]);
    expect(r.expenseByCategory[0]!.share).toBeCloseTo(2 / 3);
    expect(r.incomeByCategory).toEqual([expect.objectContaining({ name: 'Salário', total: 500000, share: 1, previous: 400000, change: 0.25 })]);
  });

  it('séries de no mínimo 6 meses (R4), maiores despesas e saldos no fim do período sem cartões', async () => {
    const user = await newUser();
    const { checking } = await scenario(user);
    await createAccount(app, user, { name: 'Cartão', type: 'credit_card', color: '#7c3aed', creditLimit: 100000, closingDay: 26, dueDay: 5, paymentAccountId: checking.id });
    const r = await report(user, '2026-11', '2026-11');
    expect(r.monthly.map((m) => m.month)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
    expect(r.monthly.at(-2)).toEqual({ month: '2026-10', income: 400000, expense: 200000, net: 200000 });
    expect(r.monthly.at(-1)).toEqual({ month: '2026-11', income: 500000, expense: 300000, net: 200000 });
    expect(r.topExpenses.map((e) => [e.description, e.amount, e.category])).toEqual([['Mercado novembro', 200000, 'Alimentação'], ['Show', 100000, 'Lazer']]);
    // Corrente: 1.000 + 4.000 − 2.000 + 5.000 − 3.000 − 300 = 4.700; Poupança: 500 + 300 = 800.
    expect(r.balances).toEqual({
      date: '2026-11-30',
      items: [
        expect.objectContaining({ name: 'Corrente', type: 'checking', balance: 470000 }),
        expect.objectContaining({ name: 'Poupança', type: 'savings', balance: 80000 }),
      ],
      total: 550000,
    });
  });

  it('saldo no fim de um período passado ignora o que veio depois', async () => {
    const user = await newUser();
    await scenario(user);
    const r = await report(user, '2026-10', '2026-10');
    expect(r.balances.items.find((b) => b.name === 'Corrente')!.balance).toBe(300000);
    expect(r.totals.previousIncome).toBe(0);
    expect(r.totals.incomeChange).toBeNull();
  });

  it('critérios 2 e 3: evolução das dívidas com compra parcelada, pagamento de fatura e empréstimo', async () => {
    const user = await newUser();
    const checking = await createAccount(app, user, { initialBalance: 500000 });
    const card = await createAccount(app, user, { type: 'credit_card', color: '#7c3aed', creditLimit: 800000, closingDay: 26, dueDay: 5, paymentAccountId: checking.id });
    const food = await categoryId(app, user, 'Alimentação', 'expense');
    await createTransaction(app, user, { type: 'expense', amount: 120000, description: 'Notebook', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-10-27', installments: 12 });
    const pay = await request(app).post(`/api/v1/cards/${card.id}/invoices/2026-11/payments`).set(user.auth).send({ amount: 10000, accountId: checking.id, paidDate: '2026-11-10' });
    expect(pay.status).toBe(201);
    const loan = await request(app).post('/api/v1/loans').set(user.auth).send({
      name: 'Carro', kind: 'vehicle', bankName: 'BCO DO BRASIL S.A.', principal: 3000000, installmentAmount: 95000,
      installmentsTotal: 48, installmentsPaidBefore: 12, firstDueDate: '2025-12-10', accountId: checking.id,
    });
    const outstanding = (await request(app).get(`/api/v1/loans/${loan.body.id}`).set(user.auth)).body.outstanding as number;

    const r = await report(user, '2026-11', '2026-11');
    const at = (m: string) => r.debts.find((d) => d.month === m)!;
    expect(at('2026-09').cards).toBe(0);
    expect(at('2026-10').cards).toBe(120000);
    expect(at('2026-11')).toEqual({ month: '2026-11', cards: 110000, loans: outstanding, total: 110000 + outstanding });
    // Em junho, 7 das 12 parcelas pagas antes do cadastro já tinham vencido (dez/25 a jun/26): o saldo era maior.
    expect(at('2026-06').loans).toBeGreaterThan(outstanding);
  });

  it('um ano inteiro: 11 meses até o mês atual, comparado com o mesmo tamanho antes', async () => {
    const user = await newUser();
    await scenario(user);
    const r = await report(user, '2026-01', '2026-11');
    expect(r.period).toMatchObject({ months: 11, previousFrom: '2025-02', previousTo: '2025-12' });
    expect(r.monthly).toHaveLength(11);
    expect(r.totals).toMatchObject({ income: 900000, expense: 500000 });
  });

  it('valida o período: formato e ordem dão 400; depois do mês atual dá 422', async () => {
    const user = await newUser();
    const get = (q: string) => request(app).get(`/api/v1/reports${q}`).set(user.auth);
    expect((await get('')).status).toBe(400);
    expect((await get('?from=2026-11&to=2026-10')).status).toBe(400);
    expect((await get('?from=2024-01&to=2026-01')).status).toBe(400);
    const future = await get('?from=2026-11&to=2026-12');
    expect(future.status).toBe(422);
    expect(future.body.detail).toBe('O relatório vai só até o mês atual.');
  });

  it('isolamento: outro usuário não vê nada', async () => {
    const owner = await newUser();
    await scenario(owner);
    const other = await newUser();
    const r = await report(other, '2026-11', '2026-11');
    expect(r.totals).toMatchObject({ income: 0, expense: 0, previousIncome: 0 });
    expect(r.expenseByCategory).toEqual([]);
    expect(r.topExpenses).toEqual([]);
    expect(r.balances).toEqual({ date: '2026-11-30', items: [], total: 0 });
    expect(r.debts.every((d) => d.total === 0)).toBe(true);
    expect((await request(app).get('/api/v1/reports?from=2026-11&to=2026-11')).status).toBe(401);
  });
});
