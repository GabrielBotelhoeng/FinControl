import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers/app';
import { newUser } from './helpers/auth';
import { resetDb } from './helpers/db';
import { categoryId, createAccount, createTransaction } from './helpers/factories';

// Hoje nos testes é 2026-11-11.
const { app } = buildTestApp();

describe('gastos que se repetem', () => {
  beforeEach(resetDb);

  it('acha a assinatura paga em 3 meses e ignora parcela, pendente e outro usuário', async () => {
    const user = await newUser();
    const checking = await createAccount(app, user, { name: 'Corrente', initialBalance: 100000 });
    const subs = await categoryId(app, user, 'Assinaturas', 'expense');
    for (const d of ['2026-08-05', '2026-09-05', '2026-10-05']) {
      await createTransaction(app, user, { type: 'expense', amount: 3990, description: 'Netflix', accountId: checking.id, categoryId: subs, nature: 'fixed', dueDate: d, status: 'paid', paidDate: d });
    }
    await createTransaction(app, user, { type: 'expense', amount: 3990, description: 'Pendente', accountId: checking.id, categoryId: subs, nature: 'fixed', dueDate: '2026-11-20' });
    const res = await request(app).get('/api/v1/repeated').set(user.auth);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([expect.objectContaining({ description: 'Netflix', monthly: 3990, yearly: 47880, months: 3, recurring: false })]);
    const other = await newUser();
    expect((await request(app).get('/api/v1/repeated').set(other.auth)).body).toEqual([]);
  });
});
