import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers/app';
import { newUser, type TestUser } from './helpers/auth';
import { resetDb } from './helpers/db';
import { categoryId, createAccount, createTransaction } from './helpers/factories';

const { app } = buildTestApp();

/** Usuário com corrente e as categorias de despesa Alimentação e Lazer, e de receita Salário. "Hoje" = 2026-11-11. */
async function scenario() {
  const user = await newUser();
  const checking = await createAccount(app, user, { name: 'Corrente', initialBalance: 500000 });
  const food = await categoryId(app, user, 'Alimentação', 'expense');
  const fun = await categoryId(app, user, 'Lazer', 'expense');
  const salary = await categoryId(app, user, 'Salário', 'income');
  return { user, checking, food, fun, salary };
}

const expense = (user: TestUser, accountId: string, categoryId: string, amount: number, dueDate: string, paid = true) =>
  createTransaction(app, user, {
    type: 'expense', amount, description: 'Gasto', accountId, categoryId, nature: 'variable', dueDate,
    ...(paid ? { status: 'paid', paidDate: dueDate } : {}),
  });

const setLimit = (user: TestUser, category: string, limit: number) => request(app).put(`/api/v1/budgets/${category}`).set(user.auth).send({ limit });
const month = async (user: TestUser, m = '2026-11') => (await request(app).get(`/api/v1/budgets?month=${m}`).set(user.auth)).body;
const itemOf = (body: { items: { categoryId: string }[] }, id: string) => body.items.find((i) => i.categoryId === id);

describe('orçamento por categoria', () => {
  beforeEach(resetDb);

  it('critério 1: pagas + pendentes do mês = 90%, "perto do limite"; critério 2: mais R$ 100 estoura', async () => {
    const { user, checking, food } = await scenario();
    expect((await setLimit(user, food, 50000)).status).toBe(200);
    await expense(user, checking.id, food, 30000, '2026-11-05');
    await expense(user, checking.id, food, 15000, '2026-11-20', false);
    expect(itemOf(await month(user), food)).toMatchObject({ limit: 50000, paid: 30000, pending: 15000, committed: 45000, percent: 90, status: 'near' });
    await expense(user, checking.id, food, 10000, '2026-11-08');
    expect(itemOf(await month(user), food)).toMatchObject({ committed: 55000, percent: 110, status: 'over' });
  });

  it('compra no cartão conta na data da compra; transferência e outro mês não contam', async () => {
    const { user, checking, food } = await scenario();
    const card = await createAccount(app, user, {
      name: 'Cartão', type: 'credit_card', color: '#7c3aed', creditLimit: 800000, closingDay: 26, dueDay: 5, paymentAccountId: checking.id,
    });
    const savings = await createAccount(app, user, { name: 'Poupança', type: 'savings' });
    await setLimit(user, food, 50000);
    await createTransaction(app, user, { type: 'expense', amount: 5000, description: 'Lanche', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-11-06' });
    await createTransaction(app, user, { type: 'transfer', amount: 20000, description: 'Guardar', accountId: checking.id, destinationAccountId: savings.id, dueDate: '2026-11-07', status: 'paid', paidDate: '2026-11-07' });
    await expense(user, checking.id, food, 7000, '2026-10-20');
    expect(itemOf(await month(user), food)).toMatchObject({ paid: 5000, pending: 0, committed: 5000 });
  });

  it('critério 3: sobra planejada = receitas do mês (pagas + previstas) − orçamento total', async () => {
    const { user, checking, food, fun, salary } = await scenario();
    await createTransaction(app, user, { type: 'income', amount: 500000, description: 'Salário', accountId: checking.id, categoryId: salary, nature: 'fixed', dueDate: '2026-11-05', status: 'paid', paidDate: '2026-11-05' });
    await createTransaction(app, user, { type: 'income', amount: 100000, description: 'Freela', accountId: checking.id, categoryId: salary, nature: 'variable', dueDate: '2026-11-25' });
    await setLimit(user, food, 50000);
    await setLimit(user, fun, 30000);
    const body = await month(user);
    expect(body).toMatchObject({ month: '2026-11', income: { paid: 500000, pending: 100000 }, totals: { limit: 80000, committed: 0 }, plannedLeftover: 520000 });
  });

  it('sugestão: média do gasto pago nos 3 meses anteriores com gasto, para cima em R$ 10', async () => {
    const { user, checking, fun } = await scenario();
    await expense(user, checking.id, fun, 45000, '2026-08-10');
    await expense(user, checking.id, fun, 52000, '2026-09-10');
    const body = await month(user);
    expect(body.categoriesWithoutBudget.find((c: { categoryId: string }) => c.categoryId === fun)).toMatchObject({ suggested: 49000 });
  });

  it('sem limites: tudo em categoriesWithoutBudget e totais zerados', async () => {
    const { user } = await scenario();
    const body = await month(user);
    expect(body.items).toEqual([]);
    expect(body.categoriesWithoutBudget.length).toBe(11); // as 11 categorias padrão de despesa
    expect(body.totals).toEqual({ limit: 0, committed: 0 });
  });

  it('regras: categoria de receita dá 422, de outra pessoa dá 404, limite 0 dá 400; DELETE remove', async () => {
    const { user, food, salary } = await scenario();
    expect((await setLimit(user, salary, 10000)).status).toBe(422);
    const other = await newUser();
    const theirFood = await categoryId(app, other, 'Alimentação', 'expense');
    expect((await setLimit(user, theirFood, 10000)).status).toBe(404);
    expect((await setLimit(user, food, 0)).status).toBe(400);
    await setLimit(user, food, 10000);
    expect((await request(app).delete(`/api/v1/budgets/${food}`).set(user.auth)).status).toBe(204);
    expect((await month(user)).items).toEqual([]);
  });

  it('excluir uma categoria apaga o limite dela (foco 4)', async () => {
    const { user } = await scenario();
    const created = await request(app).post('/api/v1/categories').set(user.auth).send({ name: 'Pets', type: 'expense', icon: 'dog', color: '#f97316' });
    await setLimit(user, created.body.id, 20000);
    expect((await request(app).delete(`/api/v1/categories/${created.body.id}`).set(user.auth)).status).toBe(204);
    expect((await month(user)).items).toEqual([]);
  });

  it('isolamento: a outra pessoa não vê os limites', async () => {
    const { user, food } = await scenario();
    await setLimit(user, food, 50000);
    const other = await newUser();
    expect((await month(other)).items).toEqual([]);
  });
});

describe('previsão dos próximos meses', () => {
  beforeEach(resetDb);

  it('traz o mês atual e os seguintes, com as recorrências materializadas', async () => {
    const { user, checking, fun } = await scenario();
    await createTransaction(app, user, {
      type: 'expense', amount: 10000, description: 'Streaming', accountId: checking.id, categoryId: fun, nature: 'fixed',
      dueDate: '2026-11-15', recurrence: { frequency: 'monthly', endDate: null },
    });
    const res = await request(app).get('/api/v1/planning/forecast?months=3').set(user.auth);
    expect(res.status).toBe(200);
    expect(res.body.map((m: { month: string }) => m.month)).toEqual(['2026-11', '2026-12', '2027-01']);
    for (const m of res.body as { expense: number }[]) expect(m.expense).toBeGreaterThanOrEqual(10000);
  });
});
