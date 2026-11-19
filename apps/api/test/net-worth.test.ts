import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers/app';
import { newUser, type TestUser } from './helpers/auth';
import { resetDb, testDb } from './helpers/db';
import { categoryId, createAccount, createTransaction } from './helpers/factories';

// Hoje nos testes é 2026-11-11 (FIXED_NOW).
const { app } = buildTestApp();

/** Contas com movimento em outubro e novembro, conta arquivada, cartão parcelado com uma fatura paga, dívida com credor e um bem. */
async function scenario(user: TestUser) {
  const checking = await createAccount(app, user, { name: 'Corrente', initialBalance: 500000 });
  await createAccount(app, user, { name: 'Poupança', type: 'savings', initialBalance: 100000 });
  const old = await createAccount(app, user, { name: 'Antiga', initialBalance: 0 });
  expect((await request(app).post(`/api/v1/accounts/${old.id}/archive`).set(user.auth)).status).toBe(200);
  const salary = await categoryId(app, user, 'Salário', 'income');
  const food = await categoryId(app, user, 'Alimentação', 'expense');
  await createTransaction(app, user, { type: 'income', amount: 300000, description: 'Salário', accountId: checking.id, categoryId: salary, nature: 'fixed', dueDate: '2026-10-05', status: 'paid', paidDate: '2026-10-05' });
  await createTransaction(app, user, { type: 'expense', amount: 50000, description: 'Mercado', accountId: checking.id, categoryId: food, nature: 'variable', dueDate: '2026-11-02', status: 'paid', paidDate: '2026-11-02' });
  const card = await createAccount(app, user, { name: 'Cartão', type: 'credit_card', color: '#7c3aed', creditLimit: 800000, closingDay: 26, dueDay: 5, paymentAccountId: checking.id });
  await createTransaction(app, user, { type: 'expense', amount: 120000, description: 'Notebook', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-10-27', installments: 12 });
  const pay = await request(app).post(`/api/v1/cards/${card.id}/invoices/2026-11/payments`).set(user.auth).send({ amount: 10000, accountId: checking.id, paidDate: '2026-11-10' });
  expect(pay.status).toBe(201);
  const debt = await request(app).post('/api/v1/debts').set(user.auth).send({
    name: 'Crediário', creditor: 'Loja', kind: 'store', originalAmount: 100000, since: '2026-03-10', currentAmount: 130000,
  });
  expect(debt.status).toBe(201);
  const asset = await request(app).post('/api/v1/assets').set(user.auth).send({ name: 'Carro', kind: 'vehicle', value: 4000000, since: '2025-06-01', purchaseValue: 4500000 });
  expect(asset.status).toBe(201);
}

describe('patrimônio líquido (sub-projeto 11)', () => {
  beforeEach(resetDb);

  it('hoje: contas sem cartão nem arquivada, bens e dívidas (B1)', async () => {
    const user = await newUser();
    await scenario(user);
    const res = await request(app).get('/api/v1/net-worth').set(user.auth);
    expect(res.status).toBe(200);
    // Corrente: 5.000 + 3.000 − 500 − 100 (fatura) = 7.400. A fatura paga baixa a conta e a dívida do cartão juntas.
    expect(res.body.date).toBe('2026-11-11');
    expect(res.body.accounts).toEqual({
      items: [
        expect.objectContaining({ name: 'Corrente', type: 'checking', balance: 740000 }),
        expect.objectContaining({ name: 'Poupança', type: 'savings', balance: 100000 }),
      ],
      cardCredit: 0,
      total: 840000,
    });
    expect(res.body.assets.total).toBe(4000000);
    expect(res.body.assets.items.map((a: { name: string }) => a.name)).toEqual(['Carro']);
    expect(res.body.debts).toEqual({ cards: 110000, loans: 0, others: 130000, total: 240000 });
    expect(res.body.total).toBe(840000 + 4000000 - 240000);
  });

  it('série dos 12 meses: fim de cada mês e hoje no mês atual (B8)', async () => {
    const user = await newUser();
    await scenario(user);
    const { series } = (await request(app).get('/api/v1/net-worth').set(user.auth)).body;
    expect(series).toHaveLength(12);
    const at = (month: string) => series.find((p: { month: string }) => p.month === month);
    // Dez/25: só os saldos iniciais e o carro pelo valor da compra (o crediário é de março e o notebook de outubro).
    expect(series[0]).toEqual({ month: '2025-12', date: '2025-12-31', accounts: 600000, assets: 4500000, debts: 0, total: 5100000 });
    expect(at('2026-03')).toMatchObject({ accounts: 600000, assets: 4500000, debts: 100000, total: 5000000 });
    expect(at('2026-10')).toEqual({ month: '2026-10', date: '2026-10-31', accounts: 900000, assets: 4500000, debts: 220000, total: 5180000 });
    expect(series[11]).toEqual({ month: '2026-11', date: '2026-11-11', accounts: 840000, assets: 4000000, debts: 240000, total: 4600000 });
  });

  it('o painel mostra o mesmo patrimônio de hoje (B9)', async () => {
    const user = await newUser();
    await scenario(user);
    const summary = await request(app).get('/api/v1/dashboard/summary').set(user.auth);
    expect(summary.body.netWorth).toBe(4600000);
  });

  it('revisão: conta arquivada continua nos meses antes do arquivamento, e o passado não muda (B1)', async () => {
    const user = await newUser();
    const old = await createAccount(app, user, { name: 'Antiga', initialBalance: 1000000 });
    const fresh = await createAccount(app, user, { name: 'Nova', initialBalance: 0 });
    const closed = await createAccount(app, user, { name: 'Fechada', initialBalance: 50000 });
    await createTransaction(app, user, { type: 'transfer', amount: 1000000, description: 'Mudança de banco', accountId: old.id, destinationAccountId: fresh.id, dueDate: '2026-09-15', status: 'paid', paidDate: '2026-09-15' });
    // A Antiga foi arquivada já zerada e a Fechada com saldo, em 20/10 (meio-dia em São Paulo).
    await testDb.account.updateMany({ where: { id: { in: [old.id, closed.id] } }, data: { archivedAt: new Date('2026-10-20T15:00:00Z') } });
    const res = (await request(app).get('/api/v1/net-worth').set(user.auth)).body;
    const accounts = (month: string) => res.series.find((p: { month: string }) => p.month === month).accounts;
    // A transferência entre contas comuns não muda nada; a Fechada sai a partir do fim de outubro.
    expect(accounts('2025-12')).toBe(1050000);
    expect(accounts('2026-09')).toBe(1050000);
    expect(accounts('2026-10')).toBe(1000000);
    expect(accounts('2026-11')).toBe(1000000);
    expect(res.accounts.items.map((a: { name: string }) => a.name)).toEqual(['Nova']);
  });

  it('revisão: o crédito do cartão pago a mais continua no patrimônio, também no painel (B1)', async () => {
    const user = await newUser();
    const checking = await createAccount(app, user, { name: 'Corrente', initialBalance: 500000 });
    const food = await categoryId(app, user, 'Alimentação', 'expense');
    const card = await createAccount(app, user, { name: 'Cartão', type: 'credit_card', color: '#7c3aed', creditLimit: 800000, closingDay: 26, dueDay: 5, paymentAccountId: checking.id });
    await createTransaction(app, user, { type: 'expense', amount: 100000, description: 'Compra', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-11-05' });
    const pay = await request(app).post(`/api/v1/cards/${card.id}/invoices/2026-11/payments`).set(user.auth).send({ amount: 150000, accountId: checking.id, paidDate: '2026-11-10' });
    expect(pay.status).toBe(201);
    const res = (await request(app).get('/api/v1/net-worth').set(user.auth)).body;
    // Corrente: 5.000 − 1.500 = 3.500, mais R$ 500 de crédito no cartão; a dívida do cartão é zero.
    expect(res.debts.cards).toBe(0);
    expect(res.accounts).toMatchObject({ cardCredit: 50000, total: 400000 });
    expect(res.total).toBe(400000);
    expect(res.series[11]).toMatchObject({ accounts: 400000, total: 400000 });
    expect(res.series[10]).toMatchObject({ accounts: 500000, total: 500000 });
    expect((await request(app).get('/api/v1/dashboard/summary').set(user.auth)).body.netWorth).toBe(400000);
  });

  it('quem não tem nada: tudo zero, e o bem de outra pessoa não entra', async () => {
    const user = await newUser();
    const other = await newUser();
    await request(app).post('/api/v1/assets').set(other.auth).send({ name: 'Casa', kind: 'property', value: 30000000 });
    const res = await request(app).get('/api/v1/net-worth').set(user.auth);
    expect(res.body).toMatchObject({ accounts: { items: [], cardCredit: 0, total: 0 }, assets: { items: [], total: 0 }, debts: { total: 0 }, total: 0 });
    expect(res.body.series.every((p: { total: number }) => p.total === 0)).toBe(true);
    expect((await request(app).get('/api/v1/dashboard/summary').set(user.auth)).body.netWorth).toBe(0);
  });
});
