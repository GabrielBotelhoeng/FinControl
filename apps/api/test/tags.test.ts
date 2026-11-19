import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers/app';
import { newUser, type TestUser } from './helpers/auth';
import { resetDb } from './helpers/db';
import { categoryId, createAccount, createTransaction } from './helpers/factories';

// Hoje nos testes é 2026-11-11 (FIXED_NOW).
const { app } = buildTestApp();

type Item = { id: string; description: string; dueDate: string; tags: string[] };

async function setup() {
  const user = await newUser();
  const checking = await createAccount(app, user, { name: 'Corrente', initialBalance: 500000 });
  const food = await categoryId(app, user, 'Alimentação', 'expense');
  const expense = (description: string, tags: string[], over: Record<string, unknown> = {}) =>
    createTransaction(app, user, {
      type: 'expense', amount: 2000, description, accountId: checking.id, categoryId: food, nature: 'variable', dueDate: '2026-11-05', tags, ...over,
    });
  return { user, checking, food, expense };
}

const list = async (user: TestUser, query: Record<string, string>): Promise<Item[]> =>
  (await request(app).get('/api/v1/transactions').query(query).set(user.auth)).body.items;
const tagList = async (user: TestUser) => (await request(app).get('/api/v1/tags').set(user.auth)).body;
const monthly = { recurrence: { frequency: 'monthly', endDate: null } };

describe('tags (sub-projeto 13)', () => {
  beforeEach(resetDb);

  it('o lançamento guarda as tags normalizadas, sem repetidas e em ordem; editar troca a lista (T1, T2)', async () => {
    const { user, expense } = await setup();
    const tx = await expense('Cerveja', ['#Bebida', 'Bar', 'bebida']);
    expect(tx.tags).toEqual(['bar', 'bebida']);
    const patched = await request(app).patch(`/api/v1/transactions/${tx.id}`).set(user.auth).send({ tags: [] });
    expect(patched.body.tags).toEqual([]);
  });

  it('filtro por tag em Lançamentos, com "#" e maiúsculas normalizados (T5)', async () => {
    const { user, expense } = await setup();
    await expense('Cerveja no mercado', ['bebida']);
    await expense('Pão', []);
    await expense('Chopp no bar', ['bar', 'bebida']);
    const items = await list(user, { from: '2026-11-01', to: '2026-11-30', tag: '#Bebida' });
    expect(items.map((t) => t.description).sort()).toEqual(['Cerveja no mercado', 'Chopp no bar']);
  });

  it('a compra parcelada no cartão leva as tags a todas as parcelas (T4)', async () => {
    const { user, checking, food } = await setup();
    const card = await createAccount(app, user, {
      name: 'Cartão', type: 'credit_card', color: '#7c3aed', creditLimit: 800000, closingDay: 26, dueDay: 5, paymentAccountId: checking.id,
    });
    const res = (await createTransaction(app, user, {
      type: 'expense', amount: 30000, description: 'Geladeira de cerveja', accountId: card.id, categoryId: food, nature: 'variable',
      dueDate: '2026-11-05', installments: 3, tags: ['bebida'],
    })) as unknown as { installments: { tags: string[] }[] };
    expect(res.installments.map((i) => i.tags)).toEqual([['bebida'], ['bebida'], ['bebida']]);
  });

  it('a recorrência leva as tags às próximas; "só esta" muda uma e "esta e as próximas" muda o modelo (T4)', async () => {
    const { user, expense } = await setup();
    await expense('Streaming', ['assinatura'], { dueDate: '2026-11-20', ...monthly });
    const months = async () =>
      (await list(user, { from: '2026-11-01', to: '2027-02-28', q: 'Streaming' })).map((t) => [t.dueDate, t.tags]).sort();
    expect(await months()).toEqual([
      ['2026-11-20', ['assinatura']], ['2026-12-20', ['assinatura']], ['2027-01-20', ['assinatura']], ['2027-02-20', ['assinatura']],
    ]);
    const [december] = await list(user, { from: '2026-12-01', to: '2026-12-31', q: 'Streaming' });
    expect((await request(app).patch(`/api/v1/transactions/${december!.id}?scope=single`).set(user.auth).send({ tags: ['assinatura', 'presente'] })).status).toBe(200);
    const [january] = await list(user, { from: '2027-01-01', to: '2027-01-31', q: 'Streaming' });
    expect((await request(app).patch(`/api/v1/transactions/${january!.id}?scope=future`).set(user.auth).send({ tags: ['lazer'] })).status).toBe(200);
    expect(await months()).toEqual([
      ['2026-11-20', ['assinatura']], ['2026-12-20', ['assinatura', 'presente']], ['2027-01-20', ['lazer']], ['2027-02-20', ['lazer']],
    ]);
  });

  it('GET /tags: cada tag com quantos lançamentos a usam, em ordem alfabética (T6)', async () => {
    const { user, expense } = await setup();
    await expense('Cerveja', ['bebida']);
    await expense('Chopp', ['bar', 'bebida']);
    await expense('Pão', []);
    expect(await tagList(user)).toEqual([{ name: 'bar', count: 1 }, { name: 'bebida', count: 2 }]);
  });

  it('renomear para uma tag que já existe junta as duas, também no modelo da recorrência (T6)', async () => {
    const { user, expense } = await setup();
    await expense('Cerveja', ['cerva']);
    await expense('Chopp', ['bebida', 'cerva']);
    await expense('Clube do vinho', ['cerva'], { dueDate: '2026-11-25', ...monthly });
    const renamed = await request(app).patch('/api/v1/tags/cerva').set(user.auth).send({ name: 'Bebida' });
    expect(renamed.status).toBe(200);
    expect(renamed.body).toEqual({ name: 'bebida', count: 3 });
    expect(await tagList(user)).toEqual([{ name: 'bebida', count: 3 }]);
    // A ocorrência de dezembro nasce depois da troca, já com o nome novo.
    const [december] = await list(user, { from: '2026-12-01', to: '2026-12-31', q: 'Clube' });
    expect(december!.tags).toEqual(['bebida']);
  });

  it('excluir tira a tag dos lançamentos e do modelo da recorrência; os lançamentos continuam (T6)', async () => {
    const { user, expense } = await setup();
    await expense('Cerveja', ['bebida', 'mercado']);
    await expense('Clube do vinho', ['bebida'], { dueDate: '2026-11-25', ...monthly });
    expect((await request(app).delete('/api/v1/tags/bebida').set(user.auth)).status).toBe(204);
    expect(await tagList(user)).toEqual([{ name: 'mercado', count: 1 }]);
    const items = await list(user, { from: '2026-11-01', to: '2027-01-31' });
    expect(items).toHaveLength(4);
    expect(items.filter((t) => t.tags.includes('bebida'))).toEqual([]);
  });

  it('tag sem uso dá 404; nome inválido e mais de 10 tags dão 400', async () => {
    const { user, expense } = await setup();
    await expense('Cerveja', ['bebida']);
    expect((await request(app).patch('/api/v1/tags/inexistente').set(user.auth).send({ name: 'outra' })).status).toBe(404);
    expect((await request(app).delete('/api/v1/tags/inexistente').set(user.auth)).status).toBe(404);
    expect((await request(app).patch('/api/v1/tags/bebida').set(user.auth).send({ name: 'bar/balada' })).status).toBe(400);
    const tooMany = await request(app).post('/api/v1/transactions').set(user.auth).send({
      type: 'expense', amount: 100, description: 'X', accountId: (await createAccount(app, user, { name: 'Outra' })).id,
      categoryId: await categoryId(app, user, 'Alimentação', 'expense'), nature: 'variable', dueDate: '2026-11-05',
      tags: Array.from({ length: 11 }, (_, i) => `t${i}`),
    });
    expect(tooMany.status).toBe(400);
  });

  it('as tags de outra pessoa não aparecem nem mudam', async () => {
    const { user: owner, expense } = await setup();
    await expense('Cerveja', ['bebida']);
    const other = await newUser();
    expect(await tagList(other)).toEqual([]);
    expect((await request(app).patch('/api/v1/tags/bebida').set(other.auth).send({ name: 'x' })).status).toBe(404);
    expect((await request(app).delete('/api/v1/tags/bebida').set(other.auth)).status).toBe(404);
    expect(await tagList(owner)).toEqual([{ name: 'bebida', count: 1 }]);
  });
});
