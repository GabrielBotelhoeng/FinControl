import { startOfMonth, type AccountDTO } from '@fincontrol/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { fromDateOnly } from '../src/infra/date-mapping';
import { buildTestApp } from './helpers/app';
import { newUser } from './helpers/auth';
import { resetDb, testDb } from './helpers/db';
import { createAccount } from './helpers/factories';

const { app } = buildTestApp();

describe('cartões (contas credit_card)', () => {
  beforeEach(resetDb);

  it('cria cartão (saldo 0), valida campos e mostra limite disponível', async () => {
    const user = await newUser();
    const checking = await createAccount(app, user, { name: 'Corrente', initialBalance: 500000 });
    const bad = await request(app)
      .post('/api/v1/accounts')
      .set(user.auth)
      .send({ name: 'Cartão', type: 'credit_card', color: '#7c3aed', initialBalance: 0 });
    // Campos de cartão ausentes são erro de forma (createAccountSchema/accountCardIssues, já validado desde a
    // Tarefa 3): 400, o mesmo padrão de accounts.test.ts "valida o corpo". 422 fica para as regras de negócio
    // validadas no service (decisão do controlador: saldo inicial e conta pagadora).
    expect(bad.status).toBe(400);

    const card = await createAccount(app, user, {
      name: 'Cartão', type: 'credit_card', color: '#7c3aed',
      creditLimit: 800000, closingDay: 26, dueDay: 5, paymentAccountId: checking.id,
    });
    expect(card).toMatchObject({
      type: 'credit_card', balance: 0, creditLimit: 800000,
      card: { limitAvailable: 800000, openInvoice: null },
    });
  });

  it('saldo inicial diferente de 0 em cartão dá 422', async () => {
    const user = await newUser();
    const checking = await createAccount(app, user);
    const res = await request(app)
      .post('/api/v1/accounts')
      .set(user.auth)
      .send({ name: 'C', type: 'credit_card', color: '#7c3aed', initialBalance: 100, creditLimit: 1, closingDay: 1, dueDay: 10, paymentAccountId: checking.id });
    expect(res.status).toBe(422);
  });

  it('conta pagadora de outro usuário dá 404', async () => {
    const [a, b] = [await newUser(), await newUser()];
    const other = await createAccount(app, b);
    const res = await request(app)
      .post('/api/v1/accounts')
      .set(a.auth)
      .send({ name: 'C', type: 'credit_card', color: '#7c3aed', initialBalance: 0, creditLimit: 1, closingDay: 1, dueDay: 10, paymentAccountId: other.id });
    expect(res.status).toBe(404);
  });

  it('conta pagadora arquivada dá 422', async () => {
    const user = await newUser();
    const checking = await createAccount(app, user);
    await request(app).post(`/api/v1/accounts/${checking.id}/archive`).set(user.auth);
    const res = await request(app)
      .post('/api/v1/accounts')
      .set(user.auth)
      .send({ name: 'Cartão', type: 'credit_card', color: '#7c3aed', creditLimit: 1, closingDay: 1, dueDay: 10, paymentAccountId: checking.id });
    expect(res.status).toBe(422);
  });

  it('conta pagadora que é cartão dá 422', async () => {
    const user = await newUser();
    const checking = await createAccount(app, user);
    const card1 = await createAccount(app, user, {
      name: 'Cartão 1', type: 'credit_card', color: '#7c3aed',
      creditLimit: 1, closingDay: 1, dueDay: 10, paymentAccountId: checking.id,
    });
    const res = await request(app)
      .post('/api/v1/accounts')
      .set(user.auth)
      .send({ name: 'Cartão 2', type: 'credit_card', color: '#7c3aed', creditLimit: 1, closingDay: 1, dueDay: 10, paymentAccountId: card1.id });
    expect(res.status).toBe(422);
  });

  it('openInvoice e nextDue vêm das despesas do cartão com invoiceMonth gravado', async () => {
    const user = await newUser();
    const checking = await createAccount(app, user, { name: 'Corrente' });
    const card = await createAccount(app, user, {
      name: 'Cartão', type: 'credit_card', color: '#7c3aed',
      creditLimit: 800000, closingDay: 26, dueDay: 5, paymentAccountId: checking.id,
    });
    // "Hoje" nos testes é 2026-11-11 (FIXED_NOW); fechamento 26, vencimento 5 ⇒ fatura aberta é 2026-12 (vence em 2026-12-05).
    await testDb.transaction.create({
      data: {
        userId: user.id, type: 'expense', amount: 15000n, description: 'Compra', accountId: card.id,
        status: 'paid', dueDate: fromDateOnly('2026-11-11'), paidDate: fromDateOnly('2026-11-11'),
        invoiceMonth: fromDateOnly(startOfMonth('2026-12')),
      },
    });

    const res = await request(app).get('/api/v1/accounts').set(user.auth);
    const dto = (res.body as AccountDTO[]).find((a) => a.id === card.id);
    expect(dto?.card).toMatchObject({
      limitAvailable: 785000,
      openInvoice: { month: '2026-12', amount: 15000 },
      nextDue: { date: '2026-12-05', amount: 15000 },
    });
  });

  it('fatura aberta já totalmente paga não aparece em nextDue', async () => {
    const user = await newUser();
    const checking = await createAccount(app, user, { name: 'Corrente' });
    const card = await createAccount(app, user, {
      name: 'Cartão', type: 'credit_card', color: '#7c3aed',
      creditLimit: 800000, closingDay: 26, dueDay: 5, paymentAccountId: checking.id,
    });
    const invoiceMonth = fromDateOnly(startOfMonth('2026-12'));
    await testDb.transaction.create({
      data: {
        userId: user.id, type: 'expense', amount: 15000n, description: 'Compra', accountId: card.id,
        status: 'paid', dueDate: fromDateOnly('2026-11-11'), paidDate: fromDateOnly('2026-11-11'), invoiceMonth,
      },
    });
    // Pagamento da fatura: transferência da conta pagadora para o cartão, com o mesmo invoiceMonth (spec C2/C3).
    await testDb.transaction.create({
      data: {
        userId: user.id, type: 'transfer', amount: 15000n, description: 'Pagamento fatura', accountId: checking.id,
        destinationAccountId: card.id, status: 'paid', dueDate: fromDateOnly('2026-11-11'), paidDate: fromDateOnly('2026-11-11'), invoiceMonth,
      },
    });

    const res = await request(app).get('/api/v1/accounts').set(user.auth);
    const dto = (res.body as AccountDTO[]).find((a) => a.id === card.id);
    // openInvoice é o valor da fatura (independente do pago); nextDue some quando o restante é 0.
    expect(dto?.card).toMatchObject({ openInvoice: { month: '2026-12', amount: 15000 }, nextDue: null });
  });

  it('mudar o tipo de um cartão dá 422', async () => {
    const user = await newUser();
    const checking = await createAccount(app, user);
    const card = await createAccount(app, user, {
      name: 'Cartão', type: 'credit_card', color: '#7c3aed',
      creditLimit: 1, closingDay: 1, dueDay: 10, paymentAccountId: checking.id,
    });
    const res = await request(app).patch(`/api/v1/accounts/${card.id}`).set(user.auth).send({ type: 'checking' });
    expect(res.status).toBe(422);
  });

  it('mudar o tipo de uma conta comum para cartão dá 422', async () => {
    const user = await newUser();
    const acc = await createAccount(app, user);
    const res = await request(app).patch(`/api/v1/accounts/${acc.id}`).set(user.auth).send({ type: 'credit_card' });
    expect(res.status).toBe(422);
  });

  it('campo de cartão em conta comum dá 422', async () => {
    const user = await newUser();
    const acc = await createAccount(app, user);
    const res = await request(app).patch(`/api/v1/accounts/${acc.id}`).set(user.auth).send({ creditLimit: 500000 });
    expect(res.status).toBe(422);
  });

  it('editar o limite de um cartão retorna limitAvailable novo', async () => {
    const user = await newUser();
    const checking = await createAccount(app, user);
    const card = await createAccount(app, user, {
      name: 'Cartão', type: 'credit_card', color: '#7c3aed',
      creditLimit: 800000, closingDay: 26, dueDay: 5, paymentAccountId: checking.id,
    });
    const res = await request(app).patch(`/api/v1/accounts/${card.id}`).set(user.auth).send({ creditLimit: 1000000 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ creditLimit: 1000000, card: { limitAvailable: 1000000 } });
  });

  it('arquivar e desarquivar um cartão mantêm o card preenchido', async () => {
    const user = await newUser();
    const checking = await createAccount(app, user, { name: 'Corrente' });
    const card = await createAccount(app, user, {
      name: 'Cartão', type: 'credit_card', color: '#7c3aed',
      creditLimit: 800000, closingDay: 26, dueDay: 5, paymentAccountId: checking.id,
    });
    const archived = await request(app).post(`/api/v1/accounts/${card.id}/archive`).set(user.auth);
    expect(archived.body.archivedAt).not.toBeNull();
    expect(archived.body.card).toMatchObject({ limitAvailable: 800000 });
    const restored = await request(app).post(`/api/v1/accounts/${card.id}/unarchive`).set(user.auth);
    expect(restored.body.archivedAt).toBeNull();
    expect(restored.body.card).toMatchObject({ limitAvailable: 800000 });
  });

  it('lista contas: cartão tem card preenchido e conta comum tem card nulo', async () => {
    const user = await newUser();
    const checking = await createAccount(app, user, { name: 'Corrente' });
    const card = await createAccount(app, user, {
      name: 'Cartão', type: 'credit_card', color: '#7c3aed',
      creditLimit: 800000, closingDay: 26, dueDay: 5, paymentAccountId: checking.id,
    });
    const res = await request(app).get('/api/v1/accounts').set(user.auth);
    const byId = Object.fromEntries((res.body as AccountDTO[]).map((a) => [a.id, a.card]));
    expect(byId[checking.id]).toBeNull();
    expect(byId[card.id]).toMatchObject({ limitAvailable: 800000 });
  });
});
