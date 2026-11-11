import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { fromDateOnly } from '../src/infra/date-mapping';
import { buildTestApp } from './helpers/app';
import { newUser } from './helpers/auth';
import { resetDb, testDb } from './helpers/db';
import { categoryId, createAccount } from './helpers/factories';

const { app } = buildTestApp();

describe('categorias', () => {
  beforeEach(resetDb);

  it('lista as categorias padrão e filtra por tipo', async () => {
    const user = await newUser();
    expect((await request(app).get('/api/v1/categories').set(user.auth)).body).toHaveLength(14);
    const income = await request(app).get('/api/v1/categories?type=income').set(user.auth);
    expect(income.body.map((c: { name: string }) => c.name).sort()).toEqual(['Freelance', 'Outros', 'Rendimentos', 'Salário']);
  });

  it('cria, edita e impede nome duplicado no mesmo tipo', async () => {
    const user = await newUser();
    const created = await request(app).post('/api/v1/categories').set(user.auth).send({ name: 'Pets', type: 'expense', icon: 'dog', color: '#a855f7' });
    expect(created.status).toBe(201);
    const dup = await request(app).post('/api/v1/categories').set(user.auth).send({ name: 'pets', type: 'expense', icon: 'dog', color: '#a855f7' });
    expect(dup.status).toBe(409);
    const sameNameOtherType = await request(app).post('/api/v1/categories').set(user.auth).send({ name: 'Pets', type: 'income', icon: 'dog', color: '#a855f7' });
    expect(sameNameOtherType.status).toBe(201);
    const edited = await request(app).patch(`/api/v1/categories/${created.body.id}`).set(user.auth).send({ name: 'Animais' });
    expect(edited.body).toMatchObject({ name: 'Animais', type: 'expense' });
  });

  it('exclui categoria sem uso diretamente', async () => {
    const user = await newUser();
    const id = await categoryId(app, user, 'Educação', 'expense');
    expect((await request(app).delete(`/api/v1/categories/${id}`).set(user.auth)).status).toBe(204);
  });

  it('categoria em uso exige reassignTo e move os lançamentos', async () => {
    const user = await newUser();
    const acc = await createAccount(app, user);
    const lazer = await categoryId(app, user, 'Lazer', 'expense');
    const outros = await categoryId(app, user, 'Outros', 'expense');
    const tx = await testDb.transaction.create({
      data: { userId: user.id, type: 'expense', amount: 100n, description: 'Cinema', accountId: acc.id, categoryId: lazer, nature: 'variable', dueDate: fromDateOnly('2026-11-01') },
    });
    expect((await request(app).delete(`/api/v1/categories/${lazer}`).set(user.auth)).status).toBe(409);
    const res = await request(app).delete(`/api/v1/categories/${lazer}?reassignTo=${outros}`).set(user.auth);
    expect(res.status).toBe(204);
    expect((await testDb.transaction.findUniqueOrThrow({ where: { id: tx.id } })).categoryId).toBe(outros);
  });

  it('categoria usada só pelo template de uma recorrência também está em uso (409, não 500)', async () => {
    const user = await newUser();
    const acc = await createAccount(app, user);
    const assinaturas = await categoryId(app, user, 'Assinaturas', 'expense');
    await testDb.recurrence.create({
      data: {
        userId: user.id, frequency: 'monthly', startDate: fromDateOnly('2026-11-20'), type: 'expense', amount: 5590n,
        description: 'Streaming', accountId: acc.id, categoryId: assinaturas, nature: 'fixed',
      },
    });
    expect((await request(app).delete(`/api/v1/categories/${assinaturas}`).set(user.auth)).status).toBe(409);
  });

  it('reassignTo de outro tipo ou a própria categoria dá 422', async () => {
    const user = await newUser();
    const acc = await createAccount(app, user);
    const lazer = await categoryId(app, user, 'Lazer', 'expense');
    const salario = await categoryId(app, user, 'Salário', 'income');
    await testDb.transaction.create({
      data: { userId: user.id, type: 'expense', amount: 100n, description: 'X', accountId: acc.id, categoryId: lazer, nature: 'variable', dueDate: fromDateOnly('2026-11-01') },
    });
    expect((await request(app).delete(`/api/v1/categories/${lazer}?reassignTo=${salario}`).set(user.auth)).status).toBe(422);
    expect((await request(app).delete(`/api/v1/categories/${lazer}?reassignTo=${lazer}`).set(user.auth)).status).toBe(422);
  });

  it('isolamento: categoria de outro usuário dá 404', async () => {
    const owner = await newUser();
    const intruder = await newUser();
    const id = await categoryId(app, owner, 'Lazer', 'expense');
    await request(app).get('/api/v1/me').set(intruder.auth);
    expect((await request(app).patch(`/api/v1/categories/${id}`).set(intruder.auth).send({ name: 'X' })).status).toBe(404);
    expect((await request(app).delete(`/api/v1/categories/${id}`).set(intruder.auth)).status).toBe(404);
    const intruderOutros = await categoryId(app, intruder, 'Outros', 'expense');
    expect((await request(app).delete(`/api/v1/categories/${intruderOutros}?reassignTo=${id}`).set(intruder.auth)).status).toBe(204);
  });
});
