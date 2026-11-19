import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers/app';
import { newUser, type TestUser } from './helpers/auth';
import { resetDb } from './helpers/db';
import { categoryId, createAccount, createTransaction } from './helpers/factories';

// Hoje nos testes é 2026-11-11 (FIXED_NOW).
const { app } = buildTestApp();
const steps = async (user: TestUser) => (await request(app).get('/api/v1/onboarding').set(user.auth)).body;
const createGoal = (user: TestUser) =>
  request(app).post('/api/v1/goals').set(user.auth).send({ name: 'Viagem', targetAmount: 600000, targetDate: '2027-04-30' });

describe('primeiros passos (sub-projeto 12)', () => {
  beforeEach(resetDb);

  it('conta nova não tem nenhum passo feito, e cada passo vira feito com o próprio registro (G2)', async () => {
    const user = await newUser();
    expect(await steps(user)).toEqual({ account: false, transaction: false, budget: false, goal: false });
    const account = await createAccount(app, user, { name: 'Corrente' });
    expect(await steps(user)).toEqual({ account: true, transaction: false, budget: false, goal: false });
    const food = await categoryId(app, user, 'Alimentação', 'expense');
    // Um lançamento pendente já conta.
    await createTransaction(app, user, { type: 'expense', amount: 1000, description: 'Pão', accountId: account.id, categoryId: food, nature: 'variable', dueDate: '2026-11-20' });
    expect(await steps(user)).toEqual({ account: true, transaction: true, budget: false, goal: false });
    expect((await request(app).put(`/api/v1/budgets/${food}`).set(user.auth).send({ limit: 50000 })).status).toBeLessThan(300);
    expect((await createGoal(user)).status).toBe(201);
    expect(await steps(user)).toEqual({ account: true, transaction: true, budget: true, goal: true });
  });

  it('os dados de outra pessoa não contam', async () => {
    const owner = await newUser();
    const other = await newUser();
    await createAccount(app, owner, { name: 'Corrente' });
    await createGoal(owner);
    expect(await steps(other)).toEqual({ account: false, transaction: false, budget: false, goal: false });
  });
});
