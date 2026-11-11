import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers/app';
import { newUser, type TestUser } from './helpers/auth';
import { resetDb } from './helpers/db';
import { categoryId, createAccount, createTransaction } from './helpers/factories';

const { app } = buildTestApp();

async function setup(user: TestUser) {
  const acc = await createAccount(app, user, { name: 'Corrente', initialBalance: 100000 });
  const savings = await createAccount(app, user, { name: 'Poupança', type: 'savings' });
  const food = await categoryId(app, user, 'Alimentação', 'expense');
  const salary = await categoryId(app, user, 'Salário', 'income');
  const expense = (over: Record<string, unknown> = {}) => ({
    type: 'expense', amount: 5000, description: 'Mercado', accountId: acc.id, categoryId: food, nature: 'variable', dueDate: '2026-11-10', ...over,
  });
  return { acc, savings, food, salary, expense };
}

describe('lançamentos', () => {
  beforeEach(resetDb);

  it('cria despesa pendente com os padrões', async () => {
    const user = await newUser();
    const { expense } = await setup(user);
    const tx = await createTransaction(app, user, expense());
    expect(tx).toMatchObject({ status: 'pending', paidDate: null, recurrenceId: null, overdue: true });
  });

  it('pago sem data de pagamento usa hoje; data futura dá 422', async () => {
    const user = await newUser();
    const { expense } = await setup(user);
    const paid = await createTransaction(app, user, expense({ status: 'paid' }));
    expect(paid.paidDate).toBe('2026-11-11');
    const future = await request(app).post('/api/v1/transactions').set(user.auth).send(expense({ status: 'paid', paidDate: '2026-11-12' }));
    expect(future.status).toBe(422);
  });

  it('valida forma: transferência para a mesma conta, despesa sem categoria, descrição vazia e centavos fracionados', async () => {
    const user = await newUser();
    const { acc, expense } = await setup(user);
    const sameAccount = await request(app).post('/api/v1/transactions').set(user.auth)
      .send({ type: 'transfer', amount: 100, description: 'X', accountId: acc.id, destinationAccountId: acc.id, dueDate: '2026-11-10' });
    expect(sameAccount.status).toBe(400);
    const noCategory = await request(app).post('/api/v1/transactions').set(user.auth).send(expense({ categoryId: null }));
    expect(noCategory.body.errors.map((e: { path: string }) => e.path)).toContain('categoryId');
    const blank = await request(app).post('/api/v1/transactions').set(user.auth).send(expense({ description: '   ' }));
    expect(blank.body.errors.map((e: { path: string }) => e.path)).toContain('description');
    const fraction = await request(app).post('/api/v1/transactions').set(user.auth).send(expense({ amount: 10.5 }));
    expect(fraction.body.errors.map((e: { path: string }) => e.path)).toContain('amount');
  });

  it('categoria de outro tipo dá 422; categoria ou conta de outro usuário dá 404; conta arquivada dá 422', async () => {
    const user = await newUser();
    const { acc, salary, expense } = await setup(user);
    expect((await request(app).post('/api/v1/transactions').set(user.auth).send(expense({ categoryId: salary }))).status).toBe(422);

    const other = await newUser();
    const otherAcc = await createAccount(app, other);
    const otherCat = await categoryId(app, other, 'Lazer', 'expense');
    expect((await request(app).post('/api/v1/transactions').set(user.auth).send(expense({ categoryId: otherCat }))).status).toBe(404);
    expect((await request(app).post('/api/v1/transactions').set(user.auth).send(expense({ accountId: otherAcc.id }))).status).toBe(404);

    await request(app).post(`/api/v1/accounts/${acc.id}/archive`).set(user.auth);
    expect((await request(app).post('/api/v1/transactions').set(user.auth).send(expense())).status).toBe(422);
  });

  it('filtra por tipo, status, conta (inclusive destino), categoria, busca e período', async () => {
    const user = await newUser();
    const { acc, savings, salary, expense } = await setup(user);
    await createTransaction(app, user, expense({ description: 'Mercado do mês', dueDate: '2026-11-05' }));
    await createTransaction(app, user, expense({ description: 'Padaria', dueDate: '2026-10-20', status: 'paid', paidDate: '2026-10-20' }));
    await createTransaction(app, user, { type: 'income', amount: 500000, description: 'Salário', accountId: acc.id, categoryId: salary, nature: 'fixed', dueDate: '2026-11-05' });
    await createTransaction(app, user, { type: 'transfer', amount: 1000, description: 'Reserva', accountId: acc.id, destinationAccountId: savings.id, dueDate: '2026-11-06' });

    const list = (qs: string) => request(app).get(`/api/v1/transactions?${qs}`).set(user.auth).then((r) => r.body.items as { description: string }[]);
    expect(await list('type=income')).toHaveLength(1);
    expect(await list('status=paid')).toHaveLength(1);
    expect((await list(`accountId=${savings.id}`)).map((t) => t.description)).toEqual(['Reserva']);
    expect(await list('q=MERCADO')).toHaveLength(1);
    expect(await list('from=2026-11-01&to=2026-11-30')).toHaveLength(3);
    expect(await list('from=2026-11-01&type=expense')).toHaveLength(1);
  });

  it('pagina por cursor sem repetir nem pular', async () => {
    const user = await newUser();
    const { expense } = await setup(user);
    for (const day of ['01', '02', '02', '03', '04']) await createTransaction(app, user, expense({ dueDate: `2026-11-${day}` }));
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const qs: string = `limit=2${cursor ? `&cursor=${cursor}` : ''}`;
      const res = await request(app).get(`/api/v1/transactions?${qs}`).set(user.auth);
      seen.push(...res.body.items.map((t: { id: string }) => t.id));
      cursor = res.body.nextCursor;
    } while (cursor);
    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
  });

  it('cursor inválido dá 400', async () => {
    const user = await newUser();
    const res = await request(app).get('/api/v1/transactions?cursor=lixo').set(user.auth);
    expect(res.status).toBe(400);
    expect(res.body.errors[0].path).toBe('cursor');
  });

  it('pagar e desfazer atualizam o status e o saldo da conta', async () => {
    const user = await newUser();
    const { acc, expense } = await setup(user);
    const tx = await createTransaction(app, user, expense({ amount: 2500 }));
    const paid = await request(app).post(`/api/v1/transactions/${tx.id}/pay`).set(user.auth).send({ paidDate: '2026-11-09' });
    expect(paid.body).toMatchObject({ status: 'paid', paidDate: '2026-11-09', overdue: false });
    const balance = async () => (await request(app).get('/api/v1/accounts').set(user.auth)).body.find((a: { id: string }) => a.id === acc.id).balance;
    expect(await balance()).toBe(97500);
    const undone = await request(app).post(`/api/v1/transactions/${tx.id}/unpay`).set(user.auth);
    expect(undone.body).toMatchObject({ status: 'pending', paidDate: null });
    expect(await balance()).toBe(100000);
  });

  it('edita e exclui', async () => {
    const user = await newUser();
    const { expense } = await setup(user);
    const tx = await createTransaction(app, user, expense());
    const edited = await request(app).patch(`/api/v1/transactions/${tx.id}`).set(user.auth).send({ amount: 7000, description: 'Feira' });
    expect(edited.body).toMatchObject({ amount: 7000, description: 'Feira' });
    expect((await request(app).delete(`/api/v1/transactions/${tx.id}`).set(user.auth)).status).toBe(204);
    expect((await request(app).get('/api/v1/transactions').set(user.auth)).body.items).toHaveLength(0);
  });

  it('editar descrição de lançamento em conta arquivada é permitido (a conta não mudou)', async () => {
    const user = await newUser();
    const { acc, expense } = await setup(user);
    const tx = await createTransaction(app, user, expense());
    await request(app).post(`/api/v1/accounts/${acc.id}/archive`).set(user.auth);
    expect((await request(app).patch(`/api/v1/transactions/${tx.id}`).set(user.auth).send({ description: 'Ajuste' })).status).toBe(200);
  });

  it('isolamento: outro usuário recebe 404 ao editar, excluir ou pagar', async () => {
    const owner = await newUser();
    const intruder = await newUser();
    const { expense } = await setup(owner);
    const tx = await createTransaction(app, owner, expense());
    for (const call of [
      request(app).patch(`/api/v1/transactions/${tx.id}`).set(intruder.auth).send({ description: 'Hack' }),
      request(app).delete(`/api/v1/transactions/${tx.id}`).set(intruder.auth),
      request(app).post(`/api/v1/transactions/${tx.id}/pay`).set(intruder.auth),
      request(app).post(`/api/v1/transactions/${tx.id}/unpay`).set(intruder.auth),
    ]) {
      expect((await call).status).toBe(404);
    }
    expect((await request(app).get('/api/v1/transactions').set(intruder.auth)).body.items).toHaveLength(0);
  });
});
