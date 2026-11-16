import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers/app';
import { newUser, type TestUser } from './helpers/auth';
import { resetDb } from './helpers/db';

const { app } = buildTestApp();

/** "Hoje" = 2026-11-11 (test/helpers/app.ts). */
async function createGoal(user: TestUser, over: Record<string, unknown> = {}) {
  return request(app).post('/api/v1/goals').set(user.auth).send({ name: 'Viagem', targetAmount: 600000, targetDate: '2027-04-30', ...over });
}
const deposit = (user: TestUser, goalId: string, amount: number, date = '2026-11-10') =>
  request(app).post(`/api/v1/goals/${goalId}/contributions`).set(user.auth).send({ amount, date });

describe('metas', () => {
  beforeEach(resetDb);

  it('cria, deposita e calcula o progresso e o aporte mensal até o prazo', async () => {
    const user = await newUser();
    const goal = await createGoal(user);
    expect(goal.status).toBe(201);
    expect((await deposit(user, goal.body.id, 100000)).status).toBe(201);
    await deposit(user, goal.body.id, 50000, '2026-11-11');
    const detail = (await request(app).get(`/api/v1/goals/${goal.body.id}`).set(user.auth)).body;
    expect(detail).toMatchObject({ name: 'Viagem', saved: 150000, fraction: 0.25, monthsLeft: 6, monthlyNeeded: 75000, targetDate: '2027-04-30' });
    expect(detail.contributions).toHaveLength(2);
  });

  it('retirada diminui o guardado; retirada maior que o guardado dá 422 (critério 5)', async () => {
    const user = await newUser();
    const goal = await createGoal(user);
    await deposit(user, goal.body.id, 150000);
    expect((await deposit(user, goal.body.id, -20000)).status).toBe(201);
    expect((await request(app).get(`/api/v1/goals/${goal.body.id}`).set(user.auth)).body.saved).toBe(130000);
    const tooMuch = await deposit(user, goal.body.id, -200000);
    expect(tooMuch.status).toBe(422);
    expect(tooMuch.body.detail).toBe('Não dá para retirar mais do que está guardado.');
  });

  it('prazo no passado e depósito com data futura dão 422; valor zero dá 400', async () => {
    const user = await newUser();
    expect((await createGoal(user, { targetDate: '2026-10-01' })).status).toBe(422);
    const goal = await createGoal(user);
    expect((await deposit(user, goal.body.id, 1000, '2026-12-01')).status).toBe(422);
    expect((await deposit(user, goal.body.id, 0)).status).toBe(400);
  });

  it('editar o alvo recalcula; excluir depósito e meta', async () => {
    const user = await newUser();
    const goal = await createGoal(user);
    const dep = await deposit(user, goal.body.id, 150000);
    const patched = await request(app).patch(`/api/v1/goals/${goal.body.id}`).set(user.auth).send({ targetAmount: 300000 });
    expect(patched.body).toMatchObject({ targetAmount: 300000, fraction: 0.5 });
    expect((await request(app).delete(`/api/v1/goals/${goal.body.id}/contributions/${dep.body.id}`).set(user.auth)).status).toBe(204);
    expect((await request(app).get(`/api/v1/goals/${goal.body.id}`).set(user.auth)).body.saved).toBe(0);
    expect((await request(app).delete(`/api/v1/goals/${goal.body.id}`).set(user.auth)).status).toBe(204);
    expect((await request(app).get(`/api/v1/goals/${goal.body.id}`).set(user.auth)).status).toBe(404);
  });

  it('lista com o progresso, em ordem de prazo', async () => {
    const user = await newUser();
    await createGoal(user, { name: 'Carro', targetDate: '2028-01-31' });
    await createGoal(user, { name: 'Viagem', targetDate: '2027-04-30' });
    const list = (await request(app).get('/api/v1/goals').set(user.auth)).body;
    expect(list.map((g: { name: string }) => g.name)).toEqual(['Viagem', 'Carro']);
    expect(list[0]).toMatchObject({ saved: 0, status: 'on_track' });
  });

  it('isolamento: meta de outra pessoa dá 404 em todas as rotas', async () => {
    const owner = await newUser();
    const goal = await createGoal(owner);
    const dep = await deposit(owner, goal.body.id, 1000);
    const intruder = await newUser();
    const id = goal.body.id;
    for (const call of [
      request(app).get(`/api/v1/goals/${id}`),
      request(app).patch(`/api/v1/goals/${id}`).send({ name: 'x' }),
      request(app).delete(`/api/v1/goals/${id}`),
      request(app).post(`/api/v1/goals/${id}/contributions`).send({ amount: 1000, date: '2026-11-10' }),
      request(app).delete(`/api/v1/goals/${id}/contributions/${dep.body.id}`),
    ]) {
      expect((await call.set(intruder.auth)).status).toBe(404);
    }
    expect((await request(app).get('/api/v1/goals').set(intruder.auth)).body).toEqual([]);
  });
});
