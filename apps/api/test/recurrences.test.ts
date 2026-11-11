import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers/app';
import { newUser, type TestUser } from './helpers/auth';
import { resetDb, testDb } from './helpers/db';
import { categoryId, createAccount, createTransaction } from './helpers/factories';

const { app } = buildTestApp();

type Item = { id: string; dueDate: string; amount: number; status: string; recurrenceId: string | null; description: string };

async function range(user: TestUser, from: string, to: string, extra = ''): Promise<Item[]> {
  const res = await request(app).get(`/api/v1/transactions?from=${from}&to=${to}&limit=100${extra}`).set(user.auth);
  expect(res.status).toBe(200);
  return (res.body.items as Item[]).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

async function series(user: TestUser, over: Record<string, unknown> = {}) {
  const acc = await createAccount(app, user, { name: 'Corrente' });
  const cat = await categoryId(app, user, 'Contas', 'expense');
  const first = await createTransaction(app, user, {
    type: 'expense', amount: 5000, description: 'Internet', accountId: acc.id, categoryId: cat, nature: 'fixed',
    dueDate: '2026-09-10', recurrence: { frequency: 'monthly' }, ...over,
  });
  return { acc, cat, first };
}

describe('recorrências', () => {
  beforeEach(resetDb);

  it('gera as ocorrências do período sob demanda, sem duplicar ao recarregar', async () => {
    const user = await newUser();
    const { first } = await series(user);
    expect(first.recurrenceId).not.toBeNull();
    const items = await range(user, '2026-09-01', '2026-12-31');
    expect(items.map((i) => i.dueDate)).toEqual(['2026-09-10', '2026-10-10', '2026-11-10', '2026-12-10']);
    expect(new Set(items.map((i) => i.recurrenceId))).toEqual(new Set([first.recurrenceId]));
    expect(await range(user, '2026-09-01', '2026-12-31')).toHaveLength(4);
  });

  it('listagens simultâneas não duplicam ocorrências', async () => {
    const user = await newUser();
    const { first } = await series(user);
    await Promise.all([range(user, '2026-09-01', '2026-12-31'), range(user, '2026-09-01', '2026-12-31')]);
    expect(await testDb.transaction.count({ where: { recurrenceId: first.recurrenceId } })).toBe(4);
  });

  it('dia 31 cai no último dia dos meses curtos', async () => {
    const user = await newUser();
    await series(user, { dueDate: '2026-08-31' });
    const items = await range(user, '2026-08-01', '2027-02-28');
    expect(items.map((i) => i.dueDate)).toEqual([
      '2026-08-31', '2026-09-30', '2026-10-31', '2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28',
    ]);
  });

  it('respeita a data final', async () => {
    const user = await newUser();
    await series(user, { recurrence: { frequency: 'monthly', endDate: '2026-10-10' } });
    expect(await range(user, '2026-09-01', '2027-03-31')).toHaveLength(2);
  });

  it('não gera além de hoje + 366 dias', async () => {
    const user = await newUser();
    await series(user);
    const items = await range(user, '2026-09-01', '2030-12-31');
    expect(items.at(-1)?.dueDate).toBe('2027-11-10');
  });

  it('excluir "só esta" não recria a ocorrência', async () => {
    const user = await newUser();
    await series(user);
    const oct = (await range(user, '2026-10-01', '2026-10-31'))[0]!;
    expect((await request(app).delete(`/api/v1/transactions/${oct.id}`).set(user.auth)).status).toBe(204);
    expect((await range(user, '2026-09-01', '2026-12-31')).map((i) => i.dueDate)).toEqual(['2026-09-10', '2026-11-10', '2026-12-10']);
  });

  it('excluir "esta e as próximas" encerra a série e preserva as futuras já pagas', async () => {
    const user = await newUser();
    await series(user);
    const items = await range(user, '2026-09-01', '2026-12-31');
    const nov = items[2]!;
    const dec = items[3]!;
    await request(app).post(`/api/v1/transactions/${dec.id}/pay`).set(user.auth);
    expect((await request(app).delete(`/api/v1/transactions/${nov.id}?scope=future`).set(user.auth)).status).toBe(204);
    const after = await range(user, '2026-09-01', '2027-03-31');
    expect(after.map((i) => [i.dueDate, i.status])).toEqual([
      ['2026-09-10', 'pending'], ['2026-10-10', 'pending'], ['2026-12-10', 'paid'],
    ]);
  });

  it('editar "esta e as próximas" muda as futuras e mantém as anteriores e as pagas', async () => {
    const user = await newUser();
    await series(user);
    const items = await range(user, '2026-09-01', '2026-12-31');
    await request(app).post(`/api/v1/transactions/${items[1]!.id}/pay`).set(user.auth);
    const res = await request(app).patch(`/api/v1/transactions/${items[2]!.id}?scope=future`).set(user.auth).send({ amount: 9999 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ dueDate: '2026-11-10', amount: 9999 });
    const after = await range(user, '2026-09-01', '2027-01-31');
    expect(after.map((i) => [i.dueDate, i.amount, i.status])).toEqual([
      ['2026-09-10', 5000, 'pending'],
      ['2026-10-10', 5000, 'paid'],
      ['2026-11-10', 9999, 'pending'],
      ['2026-12-10', 9999, 'pending'],
      ['2027-01-10', 9999, 'pending'],
    ]);
  });

  it('editar "esta e as próximas" com nova data muda o dia das próximas', async () => {
    const user = await newUser();
    await series(user);
    const nov = (await range(user, '2026-11-01', '2026-11-30'))[0]!;
    const res = await request(app).patch(`/api/v1/transactions/${nov.id}?scope=future`).set(user.auth).send({ dueDate: '2026-11-15' });
    expect(res.body.dueDate).toBe('2026-11-15');
    expect((await range(user, '2026-09-01', '2026-12-31')).map((i) => i.dueDate)).toEqual([
      '2026-09-10', '2026-10-10', '2026-11-15', '2026-12-15',
    ]);
  });

  it('mover uma ocorrência paga para a data de outra paga da série dá 422 e não altera nada', async () => {
    const user = await newUser();
    await series(user);
    const [sep, oct] = await range(user, '2026-09-01', '2026-10-31');
    for (const item of [sep!, oct!]) {
      expect((await request(app).post(`/api/v1/transactions/${item.id}/pay`).set(user.auth).send({ paidDate: item.dueDate })).status).toBe(200);
    }
    const before = await range(user, '2026-09-01', '2026-12-31');

    const res = await request(app).patch(`/api/v1/transactions/${sep!.id}?scope=future`).set(user.auth).send({ dueDate: '2026-10-10' });
    expect(res.status).toBe(422);
    expect(res.body.detail).toMatch(/10\/10\/2026/);
    expect(await range(user, '2026-09-01', '2026-12-31')).toEqual(before);
  });

  it('editar "só esta" altera apenas a ocorrência e persiste após recarregar', async () => {
    const user = await newUser();
    await series(user);
    const oct = (await range(user, '2026-10-01', '2026-10-31'))[0]!;
    await request(app).patch(`/api/v1/transactions/${oct.id}`).set(user.auth).send({ amount: 6100, dueDate: '2026-10-12' });
    const after = await range(user, '2026-09-01', '2026-12-31');
    expect(after.map((i) => [i.dueDate, i.amount])).toEqual([
      ['2026-09-10', 5000], ['2026-10-12', 6100], ['2026-11-10', 5000], ['2026-12-10', 5000],
    ]);
  });

  it('conta arquivada não recebe novas ocorrências', async () => {
    const user = await newUser();
    const { acc } = await series(user);
    await range(user, '2026-09-01', '2026-11-30');
    await request(app).post(`/api/v1/accounts/${acc.id}/archive`).set(user.auth);
    expect(await range(user, '2026-09-01', '2027-02-28')).toHaveLength(3);
  });

  it('transferência recorrente aparece na conta de destino', async () => {
    const user = await newUser();
    const a = await createAccount(app, user);
    const b = await createAccount(app, user, { type: 'savings' });
    await createTransaction(app, user, {
      type: 'transfer', amount: 20000, description: 'Reserva', accountId: a.id, destinationAccountId: b.id,
      dueDate: '2026-10-06', recurrence: { frequency: 'monthly' },
    });
    expect(await range(user, '2026-10-01', '2026-12-31', `&accountId=${b.id}`)).toHaveLength(3);
  });
});
