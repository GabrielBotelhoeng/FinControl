import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { fromDateOnly } from '../src/infra/date-mapping';
import { buildTestApp } from './helpers/app';
import { newUser } from './helpers/auth';
import { resetDb, testDb } from './helpers/db';
import { createAccount } from './helpers/factories';

const { app } = buildTestApp();

async function insertPaid(userId: string, accountId: string, type: 'income' | 'expense', amount: bigint) {
  await testDb.transaction.create({
    data: {
      userId, type, amount, description: 'X', accountId, status: 'paid',
      dueDate: fromDateOnly('2026-11-01'), paidDate: fromDateOnly('2026-11-01'),
    },
  });
}

describe('contas', () => {
  beforeEach(resetDb);

  it('cria conta com saldo igual ao saldo inicial', async () => {
    const user = await newUser();
    const acc = await createAccount(app, user, { name: 'Nubank', initialBalance: 150000 });
    expect(acc).toMatchObject({ name: 'Nubank', type: 'checking', initialBalance: 150000, balance: 150000, archivedAt: null });
  });

  it('calcula o saldo só com lançamentos pagos, incluindo transferências', async () => {
    const user = await newUser();
    const a = await createAccount(app, user, { initialBalance: 10000 });
    const b = await createAccount(app, user, { initialBalance: 0 });
    await insertPaid(user.id, a.id, 'income', 5000n);
    await insertPaid(user.id, a.id, 'expense', 2000n);
    await testDb.transaction.create({
      data: { userId: user.id, type: 'expense', amount: 99999n, description: 'Pendente', accountId: a.id, dueDate: fromDateOnly('2026-11-20') },
    });
    await testDb.transaction.create({
      data: {
        userId: user.id, type: 'transfer', amount: 3000n, description: 'Reserva', accountId: a.id, destinationAccountId: b.id,
        status: 'paid', dueDate: fromDateOnly('2026-11-02'), paidDate: fromDateOnly('2026-11-02'),
      },
    });
    const res = await request(app).get('/api/v1/accounts').set(user.auth);
    const byId = Object.fromEntries((res.body as { id: string; balance: number }[]).map((x) => [x.id, x.balance]));
    expect(byId[a.id]).toBe(10000);
    expect(byId[b.id]).toBe(3000);
  });

  it('impede nome duplicado entre contas ativas (sem diferenciar maiúsculas)', async () => {
    const user = await newUser();
    await createAccount(app, user, { name: 'Carteira' });
    const res = await request(app).post('/api/v1/accounts').set(user.auth).send({ name: 'carteira', type: 'wallet', color: '#000000' });
    expect(res.status).toBe(409);
  });

  it('edita conta', async () => {
    const user = await newUser();
    const acc = await createAccount(app, user);
    const res = await request(app).patch(`/api/v1/accounts/${acc.id}`).set(user.auth).send({ name: 'Itaú', color: '#f97316' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Itaú', color: '#f97316' });
  });

  it('arquivar esconde da lista padrão e includeArchived mostra', async () => {
    const user = await newUser();
    const acc = await createAccount(app, user);
    const archived = await request(app).post(`/api/v1/accounts/${acc.id}/archive`).set(user.auth);
    expect(archived.body.archivedAt).not.toBeNull();
    expect((await request(app).get('/api/v1/accounts').set(user.auth)).body).toHaveLength(0);
    expect((await request(app).get('/api/v1/accounts?includeArchived=true').set(user.auth)).body).toHaveLength(1);
    const restored = await request(app).post(`/api/v1/accounts/${acc.id}/unarchive`).set(user.auth);
    expect(restored.body.archivedAt).toBeNull();
  });

  it('exclui conta sem lançamentos e bloqueia com lançamentos', async () => {
    const user = await newUser();
    const empty = await createAccount(app, user);
    expect((await request(app).delete(`/api/v1/accounts/${empty.id}`).set(user.auth)).status).toBe(204);
    const used = await createAccount(app, user);
    await insertPaid(user.id, used.id, 'expense', 100n);
    const res = await request(app).delete(`/api/v1/accounts/${used.id}`).set(user.auth);
    expect(res.status).toBe(409);
  });

  it('valida o corpo', async () => {
    const user = await newUser();
    const res = await request(app).post('/api/v1/accounts').set(user.auth).send({ name: 'X', type: 'checking', color: 'azul', initialBalance: 10.5 });
    expect(res.status).toBe(400);
    expect(res.body.errors.map((e: { path: string }) => e.path)).toEqual(expect.arrayContaining(['color', 'initialBalance']));
  });

  it('isolamento: outro usuário não vê nem altera a conta (404)', async () => {
    const owner = await newUser();
    const intruder = await newUser();
    const acc = await createAccount(app, owner);
    expect((await request(app).get('/api/v1/accounts').set(intruder.auth)).body).toHaveLength(0);
    for (const call of [
      request(app).patch(`/api/v1/accounts/${acc.id}`).set(intruder.auth).send({ name: 'Hack' }),
      request(app).delete(`/api/v1/accounts/${acc.id}`).set(intruder.auth),
      request(app).post(`/api/v1/accounts/${acc.id}/archive`).set(intruder.auth),
    ]) {
      expect((await call).status).toBe(404);
    }
  });
});
