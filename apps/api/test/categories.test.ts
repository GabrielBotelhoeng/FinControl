import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { fromDateOnly } from '../src/infra/date-mapping';
import { buildTestApp } from './helpers/app';
import { newUser, type TestUser } from './helpers/auth';
import { resetDb, testDb } from './helpers/db';
import { categoryId, createAccount, createSubcategory, createTransaction } from './helpers/factories';

const { app } = buildTestApp();

describe('categorias', () => {
  beforeEach(resetDb);

  it('lista as categorias padrão e filtra por tipo', async () => {
    const user = await newUser();
    expect((await request(app).get('/api/v1/categories').set(user.auth)).body).toHaveLength(15);
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

describe('subcategorias (sub-projeto 15)', () => {
  beforeEach(resetDb);

  type Cat = { id: string; name: string; type: string; icon: string; color: string; parentId: string | null };
  const list = async (user: TestUser): Promise<Cat[]> => (await request(app).get('/api/v1/categories').set(user.auth)).body;
  const expense = (user: TestUser, accountId: string, categoryId: string, description: string) =>
    createTransaction(app, user, { type: 'expense', amount: 1000, description, accountId, categoryId, nature: 'variable', dueDate: '2026-11-05' });

  it('U1–U3: herda tipo, ícone e cor; o nome é único entre categorias e subcategorias; subcategoria não tem subcategoria', async () => {
    const user = await newUser();
    const food = (await list(user)).find((c) => c.name === 'Alimentação')!;
    const created = await request(app).post(`/api/v1/categories/${food.id}/subcategories`).set(user.auth).send({ name: ' Restaurante ' });
    expect(created.status).toBe(201);
    expect(created.body).toEqual({ id: created.body.id, name: 'Restaurante', type: 'expense', icon: food.icon, color: food.color, parentId: food.id });
    expect((await list(user)).find((c) => c.name === 'Restaurante')).toMatchObject({ parentId: food.id });
    expect((await list(user)).find((c) => c.name === 'Alimentação')).toMatchObject({ parentId: null });

    const post = (parent: string, name: string) => request(app).post(`/api/v1/categories/${parent}/subcategories`).set(user.auth).send({ name });
    expect((await post(food.id, 'restaurante')).status).toBe(409);
    expect((await post(food.id, 'Moradia')).status).toBe(409);
    expect((await post(created.body.id, 'Pizzaria')).status).toBe(422);
    expect((await post(food.id, '')).status).toBe(400);
    // Uma categoria nova também não pode repetir o nome de uma subcategoria.
    expect((await request(app).post('/api/v1/categories').set(user.auth).send({ name: 'Restaurante', type: 'expense', icon: 'pizza', color: '#000000' })).status).toBe(409);

    const intruder = await newUser();
    expect((await request(app).post(`/api/v1/categories/${food.id}/subcategories`).set(intruder.auth).send({ name: 'X' })).status).toBe(404);
  });

  it('U2: o ícone e a cor da categoria mudam nas subcategorias; na subcategoria, só o nome muda', async () => {
    const user = await newUser();
    const food = await categoryId(app, user, 'Alimentação', 'expense');
    const restaurant = await createSubcategory(app, user, food, 'Restaurante');
    expect((await request(app).patch(`/api/v1/categories/${food}`).set(user.auth).send({ icon: 'pizza', color: '#123456' })).status).toBe(200);
    expect((await list(user)).find((c) => c.id === restaurant)).toMatchObject({ icon: 'pizza', color: '#123456' });
    expect((await request(app).patch(`/api/v1/categories/${restaurant}`).set(user.auth).send({ color: '#000000' })).status).toBe(422);
    const renamed = await request(app).patch(`/api/v1/categories/${restaurant}`).set(user.auth).send({ name: 'Restaurantes' });
    expect(renamed.body).toMatchObject({ name: 'Restaurantes', parentId: food, color: '#123456' });
  });

  it('U9: a subcategoria em uso pede o destino; os lançamentos vão para ele', async () => {
    const user = await newUser();
    const acc = await createAccount(app, user);
    const food = await categoryId(app, user, 'Alimentação', 'expense');
    const restaurant = await createSubcategory(app, user, food, 'Restaurante');
    const tx = await expense(user, acc.id, restaurant, 'Pizza');
    expect((await request(app).delete(`/api/v1/categories/${restaurant}`).set(user.auth)).status).toBe(409);
    expect((await request(app).delete(`/api/v1/categories/${restaurant}?reassignTo=${food}`).set(user.auth)).status).toBe(204);
    expect((await testDb.transaction.findUniqueOrThrow({ where: { id: tx.id } })).categoryId).toBe(food);
    expect((await list(user)).some((c) => c.id === restaurant)).toBe(false);
  });

  it('U9: excluir a categoria leva as subcategorias e move os lançamentos de todas; o destino não pode ser uma delas', async () => {
    const user = await newUser();
    const acc = await createAccount(app, user);
    const food = await categoryId(app, user, 'Alimentação', 'expense');
    const leisure = await categoryId(app, user, 'Lazer', 'expense');
    const restaurant = await createSubcategory(app, user, food, 'Restaurante');
    const market = await createSubcategory(app, user, food, 'Mercado');
    const bar = await createSubcategory(app, user, leisure, 'Bar');
    // Só a subcategoria tem lançamento: a categoria também está em uso.
    const pizza = await expense(user, acc.id, restaurant, 'Pizza');
    expect((await request(app).delete(`/api/v1/categories/${food}`).set(user.auth)).status).toBe(409);
    const direct = await expense(user, acc.id, food, 'Feira');
    await request(app).put(`/api/v1/budgets/${food}`).set(user.auth).send({ limit: 50000 });

    expect((await request(app).delete(`/api/v1/categories/${food}?reassignTo=${restaurant}`).set(user.auth)).status).toBe(422);
    // O destino pode ser uma subcategoria de outra categoria; o limite vai para a principal dela (R13 a).
    expect((await request(app).delete(`/api/v1/categories/${food}?reassignTo=${bar}`).set(user.auth)).status).toBe(204);
    for (const id of [pizza.id, direct.id]) expect((await testDb.transaction.findUniqueOrThrow({ where: { id } })).categoryId).toBe(bar);
    const ids = (await list(user)).map((c) => c.id);
    expect([food, restaurant, market].some((id) => ids.includes(id))).toBe(false);
    expect(await testDb.budget.findMany({ where: { userId: user.id }, select: { categoryId: true, limitAmount: true } })).toEqual([{ categoryId: leisure, limitAmount: 50000n }]);
  });

  it('excluir a categoria sem uso leva as subcategorias sem uso junto', async () => {
    const user = await newUser();
    const education = await categoryId(app, user, 'Educação', 'expense');
    const books = await createSubcategory(app, user, education, 'Livros');
    expect((await request(app).delete(`/api/v1/categories/${education}`).set(user.auth)).status).toBe(204);
    expect((await list(user)).some((c) => c.id === books)).toBe(false);
  });

  it('excluir a conta leva as categorias e as subcategorias (a chave da principal não trava a exclusão)', async () => {
    const user = await newUser();
    const acc = await createAccount(app, user);
    const food = await categoryId(app, user, 'Alimentação', 'expense');
    await expense(user, acc.id, await createSubcategory(app, user, food, 'Restaurante'), 'Pizza');
    expect((await request(app).delete('/api/v1/me').set(user.auth)).status).toBe(204);
    expect(await testDb.category.count({ where: { userId: user.id } })).toBe(0);
  });

  it('U10: o filtro de lançamentos por categoria inclui as subcategorias; o da subcategoria, só ela', async () => {
    const user = await newUser();
    const acc = await createAccount(app, user);
    const food = await categoryId(app, user, 'Alimentação', 'expense');
    const restaurant = await createSubcategory(app, user, food, 'Restaurante');
    await expense(user, acc.id, food, 'Feira');
    await expense(user, acc.id, restaurant, 'Pizza');
    await expense(user, acc.id, await categoryId(app, user, 'Lazer', 'expense'), 'Cinema');
    const names = async (categoryId: string) =>
      ((await request(app).get('/api/v1/transactions').query({ from: '2026-11-01', to: '2026-11-30', categoryId }).set(user.auth)).body.items as { description: string }[])
        .map((t) => t.description)
        .sort();
    expect(await names(food)).toEqual(['Feira', 'Pizza']);
    expect(await names(restaurant)).toEqual(['Pizza']);
  });
});
