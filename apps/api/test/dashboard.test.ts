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
});
