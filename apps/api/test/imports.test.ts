import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers/app';
import { newUser } from './helpers/auth';
import { resetDb, testDb } from './helpers/db';
import { categoryId, createAccount, createTransaction } from './helpers/factories';

const { app } = buildTestApp();

async function scenario() {
  const user = await newUser();
  const checking = await createAccount(app, user, { name: 'Corrente', initialBalance: 100000 });
  const food = await categoryId(app, user, 'Alimentação', 'expense');
  const leisure = await categoryId(app, user, 'Lazer', 'expense');
  const salary = await categoryId(app, user, 'Salário', 'income');
  return { user, checking, food, leisure, salary };
}

describe('importação de extrato', () => {
  beforeEach(resetDb);

  it('sugere a categoria pelo histórico, depois por palavra-chave, depois "Outros", e marca o repetido (I5, I7)', async () => {
    const { user, checking, leisure } = await scenario();
    // Histórico: "Bar do Zé" já foi Lazer (com número diferente na descrição).
    await createTransaction(app, user, { type: 'expense', amount: 5000, description: 'BAR DO ZE 123', accountId: checking.id, categoryId: leisure, nature: 'variable', dueDate: '2026-10-01', status: 'paid', paidDate: '2026-10-01' });
    // Já lançado à mão: o mesmo mercado do dia 05/11.
    await createTransaction(app, user, { type: 'expense', amount: 4590, description: 'Mercado', accountId: checking.id, categoryId: leisure, nature: 'variable', dueDate: '2026-11-05', status: 'paid', paidDate: '2026-11-05' });

    const res = await request(app).post('/api/v1/imports/preview').set(user.auth).send({
      accountId: checking.id,
      rows: [
        { date: '2026-11-03', description: 'Bar do Zé 999', amount: -3000 },
        { date: '2026-11-04', description: 'UBER *TRIP', amount: -2500 },
        { date: '2026-11-05', description: 'SUPERMERCADO X', amount: -4590 },
        { date: '2026-11-05', description: 'SUPERMERCADO X', amount: -4590 },
        { date: '2026-11-06', description: 'Coisa estranha', amount: -100 },
        { date: '2026-11-10', description: 'SALARIO EMPRESA', amount: 300000 },
      ],
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const cat = async (name: string, type: 'income' | 'expense') => categoryId(app, user, name, type);
    expect(res.body.rows.map((r: { suggestion: string }) => r.suggestion)).toEqual(['history', 'keyword', 'keyword', 'keyword', 'fallback', 'keyword']);
    expect(res.body.rows[0]).toMatchObject({ type: 'expense', amount: 3000, categoryId: leisure, duplicate: false });
    expect(res.body.rows[1].categoryId).toBe(await cat('Transporte', 'expense'));
    expect(res.body.rows[2]).toMatchObject({ duplicate: true });
    expect(res.body.rows[3]).toMatchObject({ duplicate: false });
    expect(res.body.rows[4].categoryId).toBe(await cat('Outros', 'expense'));
    expect(res.body.rows[5]).toMatchObject({ type: 'income', categoryId: await cat('Salário', 'income') });
  });

  it('pagamento de fatura feito no app (transferência) marca a linha do extrato como repetida e parecida com transferência', async () => {
    const { user, checking, food } = await scenario();
    const card = await createAccount(app, user, { name: 'Cartão', type: 'credit_card', creditLimit: 500000, closingDay: 5, dueDay: 15, paymentAccountId: checking.id });
    await createTransaction(app, user, { type: 'expense', amount: 150000, description: 'TV', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-10-01' });
    const invoices = (await request(app).get(`/api/v1/cards/${card.id}/invoices`).set(user.auth)).body as { month: string; amount: number }[];
    const due = invoices.find((i) => i.amount > 0)!;
    await request(app).post(`/api/v1/cards/${card.id}/invoices/${due.month}/payments`).set(user.auth).send({ amount: 150000, accountId: checking.id, paidDate: '2026-11-10' });
    const res = await request(app).post('/api/v1/imports/preview').set(user.auth).send({
      accountId: checking.id, rows: [{ date: '2026-11-10', description: 'PAGAMENTO DE FATURA', amount: -150000 }, { date: '2026-11-11', description: '99APP CORRIDA', amount: -2000 }],
    });
    expect(res.body.rows[0]).toMatchObject({ duplicate: true, transferLike: true });
    expect(res.body.rows[1]).toMatchObject({ transferLike: false, categoryId: await categoryId(app, user, 'Transporte', 'expense') });
  });

  it('confirmar cria os lançamentos pagos na data do extrato e o saldo da conta muda (I6)', async () => {
    const { user, checking, food, salary } = await scenario();
    const res = await request(app).post('/api/v1/imports/commit').set(user.auth).send({
      accountId: checking.id,
      rows: [
        { date: '2026-11-03', description: 'Padaria', amount: -1500, categoryId: food },
        { date: '2026-11-10', description: 'Salário', amount: 300000, categoryId: salary },
      ],
    });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body).toEqual({ created: 2 });
    const rows = await testDb.transaction.findMany({ where: { accountId: checking.id }, orderBy: { dueDate: 'asc' } });
    expect(rows.map((r) => [r.type, Number(r.amount), r.status])).toEqual([['expense', 1500, 'paid'], ['income', 300000, 'paid']]);
    const account = (await request(app).get('/api/v1/accounts').set(user.auth)).body.find((a: { id: string }) => a.id === checking.id);
    expect(account.balance).toBe(100000 - 1500 + 300000);
  });

  it('categoria do tipo errado, de outro usuário, conta de cartão ou arquivada: recusa sem gravar nada', async () => {
    const { user, checking, food, salary } = await scenario();
    const wrong = await request(app).post('/api/v1/imports/commit').set(user.auth).send({
      accountId: checking.id, rows: [{ date: '2026-11-03', description: 'Padaria', amount: -1500, categoryId: salary }],
    });
    expect(wrong.status).toBe(422);
    const other = await scenario();
    expect((await request(app).post('/api/v1/imports/commit').set(user.auth).send({
      accountId: checking.id, rows: [{ date: '2026-11-03', description: 'x', amount: -1, categoryId: other.food }],
    })).status).toBe(404);
    expect((await request(app).post('/api/v1/imports/preview').set(user.auth).send({ accountId: other.checking.id, rows: [{ date: '2026-11-03', description: 'x', amount: -1 }] })).status).toBe(404);
    const card = await createAccount(app, user, { type: 'credit_card', creditLimit: 100000, closingDay: 1, dueDay: 10, paymentAccountId: checking.id });
    expect((await request(app).post('/api/v1/imports/preview').set(user.auth).send({ accountId: card.id, rows: [{ date: '2026-11-03', description: 'x', amount: -1 }] })).status).toBe(422);
    expect(await testDb.transaction.count({ where: { accountId: checking.id } })).toBe(0);
    expect((await request(app).post('/api/v1/imports/commit').set(user.auth).send({ accountId: checking.id, rows: [{ date: '2026-11-03', description: 'x', amount: 0, categoryId: food }] })).status).toBe(400);
  });

  it('aceita 1.000 linhas (acima do limite comum de 100 KB do corpo)', async () => {
    const { user, checking } = await scenario();
    const rows = Array.from({ length: 1000 }, (_, i) => ({ date: '2026-11-03', description: `Compra número ${i} no estabelecimento comercial`, amount: -(i + 1) }));
    const res = await request(app).post('/api/v1/imports/preview').set(user.auth).send({ accountId: checking.id, rows });
    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(1000);
  });
});
