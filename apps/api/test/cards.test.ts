import { startOfMonth, type AccountDTO } from '@fincontrol/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { fromDateOnly } from '../src/infra/date-mapping';
import { buildTestApp } from './helpers/app';
import { newUser } from './helpers/auth';
import { resetDb, testDb } from './helpers/db';
import { categoryId, createAccount, createTransaction } from './helpers/factories';

const { app } = buildTestApp();

/** Usuário com corrente (500000), cartão (limite 800000, fecha 26, vence 5, pagadora = corrente) e categoria "Alimentação". */
async function cardScenario() {
  const user = await newUser();
  const checking = await createAccount(app, user, { name: 'Corrente', initialBalance: 500000 });
  const card = await createAccount(app, user, {
    name: 'Cartão', type: 'credit_card', color: '#7c3aed',
    creditLimit: 800000, closingDay: 26, dueDay: 5, paymentAccountId: checking.id,
  });
  const food = await categoryId(app, user, 'Alimentação', 'expense');
  return { user, card, checking, food };
}

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

describe('compras no cartão e parceladas', () => {
  beforeEach(resetDb);

  it('compra à vista no cartão: paga na data, cai na fatura certa e não mexe na conta corrente', async () => {
    const { user, card, checking, food } = await cardScenario();
    const tx = await createTransaction(app, user, {
      type: 'expense', amount: 30000, description: 'Mercado', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-11-01',
    });
    expect(tx).toMatchObject({ status: 'paid', paidDate: '2026-11-01', invoiceMonth: '2026-12', installmentNumber: null });
    const accounts = (await request(app).get('/api/v1/accounts').set(user.auth)).body;
    expect(accounts.find((a: { id: string }) => a.id === checking.id).balance).toBe(500000);
    expect(accounts.find((a: { id: string }) => a.id === card.id)).toMatchObject({ balance: -30000, card: { limitAvailable: 770000 } });
  });

  it('parcelada em 3x: soma exata, faturas consecutivas, 1ª leva o resto, limite consome o total', async () => {
    const { user, card, food } = await cardScenario();
    // Compra em 27/10 (depois do fechamento de 26/10) → 1ª parcela na fatura 2026-12. Parcelas 2 e 3 têm data futura: só o sistema pode gerá-las.
    const res = await request(app).post('/api/v1/transactions').set(user.auth).send({
      type: 'expense', amount: 100000, description: 'Celular', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-10-27', installments: 3,
    });
    expect(res.status).toBe(201);
    expect(
      res.body.installments.map((t: { amount: number; invoiceMonth: string; paidDate: string; installmentNumber: number }) => [
        t.amount, t.invoiceMonth, t.paidDate, t.installmentNumber,
      ]),
    ).toEqual([
      [33334, '2026-12', '2026-10-27', 1],
      [33333, '2027-01', '2026-11-27', 2],
      [33333, '2027-02', '2026-12-27', 3],
    ]);
    expect(res.body).toMatchObject(res.body.installments[0]);
    const accounts = (await request(app).get('/api/v1/accounts').set(user.auth)).body;
    expect(accounts.find((a: { id: string }) => a.id === card.id).card.limitAvailable).toBe(700000);

    // Decisão R10: as 3 parcelas compartilham installmentGroupId (não exposto no DTO) e installmentTotal.
    const rows = await testDb.transaction.findMany({ where: { accountId: card.id }, orderBy: { installmentNumber: 'asc' } });
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.installmentGroupId !== null)).toBe(true);
    expect(new Set(rows.map((r) => r.installmentGroupId)).size).toBe(1);
    expect(rows.every((r) => r.installmentTotal === 3)).toBe(true);
  });

  it('compra no cartão com data futura dá 422 (mesma regra dos lançamentos pagos)', async () => {
    const { user, card, food } = await cardScenario();
    const res = await request(app).post('/api/v1/transactions').set(user.auth).send({
      type: 'expense', amount: 1000, description: 'x', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-11-30',
    });
    expect(res.status).toBe(422);
    expect(res.body.detail).toBe('A data de pagamento não pode estar no futuro.');
  });

  it('receita em cartão dá 422 mesmo com categoria de receita válida (decisão R12)', async () => {
    const { user, card } = await cardScenario();
    const salary = await categoryId(app, user, 'Salário', 'income');
    const res = await request(app).post('/api/v1/transactions').set(user.auth).send({
      type: 'income', amount: 100, description: 'x', accountId: card.id, categoryId: salary, nature: 'variable', dueDate: '2026-11-01',
    });
    expect(res.status).toBe(422);
    expect(res.body.detail).toBe('Cartão de crédito não recebe receita.');
  });

  it('cartão com recorrência dá 422', async () => {
    const { user, card, food } = await cardScenario();
    const res = await request(app).post('/api/v1/transactions').set(user.auth).send({
      type: 'expense', amount: 1000, description: 'Netflix', accountId: card.id, categoryId: food, nature: 'fixed',
      dueDate: '2026-11-01', recurrence: { frequency: 'monthly' },
    });
    expect(res.status).toBe(422);
  });

  it('parcelamento em conta que não é cartão dá 422', async () => {
    const { user, checking, food } = await cardScenario();
    const res = await request(app).post('/api/v1/transactions').set(user.auth).send({
      type: 'expense', amount: 90000, description: 'TV', accountId: checking.id, categoryId: food, nature: 'variable',
      dueDate: '2026-11-01', installments: 3,
    });
    expect(res.status).toBe(422);
  });

  it('transferência comum com origem no cartão dá 422 e orienta usar "Pagar fatura"', async () => {
    const { user, card, checking } = await cardScenario();
    const res = await request(app).post('/api/v1/transactions').set(user.auth).send({
      type: 'transfer', amount: 1000, description: 'x', accountId: card.id, destinationAccountId: checking.id, dueDate: '2026-11-01',
    });
    expect(res.status).toBe(422);
    expect(res.body.detail).toMatch(/Pagar fatura/);
  });

  it('transferência comum com destino no cartão dá 422 e orienta usar "Pagar fatura"', async () => {
    const { user, card, checking } = await cardScenario();
    const res = await request(app).post('/api/v1/transactions').set(user.auth).send({
      type: 'transfer', amount: 1000, description: 'x', accountId: checking.id, destinationAccountId: card.id, dueDate: '2026-11-01',
    });
    expect(res.status).toBe(422);
    expect(res.body.detail).toMatch(/Pagar fatura/);
  });

  it('pagar ou desfazer pagamento de um lançamento de cartão dá 422', async () => {
    const { user, card, food } = await cardScenario();
    const tx = await createTransaction(app, user, {
      type: 'expense', amount: 5000, description: 'Compra', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-11-01',
    });
    const pay = await request(app).post(`/api/v1/transactions/${tx.id}/pay`).set(user.auth);
    expect(pay.status).toBe(422);
    expect(pay.body.detail).toBe('Lançamentos de cartão são sempre pagos.');
    const unpay = await request(app).post(`/api/v1/transactions/${tx.id}/unpay`).set(user.auth);
    expect(unpay.status).toBe(422);
    expect(unpay.body.detail).toBe('Lançamentos de cartão são sempre pagos.');
  });

  it('mover um lançamento comum para o cartão por PATCH dá 422', async () => {
    const { user, card, checking, food } = await cardScenario();
    const tx = await createTransaction(app, user, {
      type: 'expense', amount: 5000, description: 'Mercado', accountId: checking.id, categoryId: food, nature: 'variable', dueDate: '2026-11-01',
    });
    const res = await request(app).patch(`/api/v1/transactions/${tx.id}`).set(user.auth).send({ accountId: card.id });
    expect(res.status).toBe(422);
  });

  it('mover um lançamento do cartão para outra conta por PATCH dá 422', async () => {
    const { user, card, checking, food } = await cardScenario();
    const tx = await createTransaction(app, user, {
      type: 'expense', amount: 5000, description: 'Mercado', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-11-01',
    });
    const res = await request(app).patch(`/api/v1/transactions/${tx.id}`).set(user.auth).send({ accountId: checking.id });
    expect(res.status).toBe(422);
  });

  it('mudar a data de um lançamento de cartão por PATCH dá 422', async () => {
    const { user, card, food } = await cardScenario();
    const tx = await createTransaction(app, user, {
      type: 'expense', amount: 5000, description: 'Mercado', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-11-01',
    });
    const res = await request(app).patch(`/api/v1/transactions/${tx.id}`).set(user.auth).send({ dueDate: '2026-11-02' });
    expect(res.status).toBe(422);
  });

  it('reenviar a mesma data de um lançamento de cartão por PATCH é permitido', async () => {
    const { user, card, food } = await cardScenario();
    const tx = await createTransaction(app, user, {
      type: 'expense', amount: 5000, description: 'Mercado', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-11-01',
    });
    const res = await request(app).patch(`/api/v1/transactions/${tx.id}`).set(user.auth).send({ dueDate: '2026-11-01', description: 'Mercado 2' });
    expect(res.status).toBe(200);
  });

  it('reenviar o mesmo accountId e a mesma dueDate de uma compra no cartão (como o formulário da web sempre faz) é permitido', async () => {
    const { user, card, food } = await cardScenario();
    const tx = await createTransaction(app, user, {
      type: 'expense', amount: 5000, description: 'Mercado', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-11-01',
    });
    const res = await request(app).patch(`/api/v1/transactions/${tx.id}`).set(user.auth).send({
      accountId: card.id, dueDate: '2026-11-01', description: 'Mercado atualizado',
    });
    expect(res.status).toBe(200);
    expect(res.body.description).toBe('Mercado atualizado');
  });

  it('editar descrição, categoria, natureza e valor de um lançamento de cartão é permitido', async () => {
    const { user, card, food } = await cardScenario();
    const tx = await createTransaction(app, user, {
      type: 'expense', amount: 5000, description: 'Mercado', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-11-01',
    });
    const lazer = await categoryId(app, user, 'Lazer', 'expense');
    const res = await request(app).patch(`/api/v1/transactions/${tx.id}`).set(user.auth).send({
      description: 'Mercadinho', categoryId: lazer, nature: 'fixed', amount: 6000,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ description: 'Mercadinho', categoryId: lazer, nature: 'fixed', amount: 6000 });
  });

  it('PATCH com scope=future movendo uma recorrência comum para o cartão dá 422 antes de ramificar', async () => {
    const { user, card, checking, food } = await cardScenario();
    const created = await createTransaction(app, user, {
      type: 'expense', amount: 5000, description: 'Assinatura', accountId: checking.id, categoryId: food, nature: 'fixed',
      dueDate: '2026-11-01', recurrence: { frequency: 'monthly' },
    });
    const res = await request(app).patch(`/api/v1/transactions/${created.id}?scope=future`).set(user.auth).send({ accountId: card.id });
    expect(res.status).toBe(422);
  });
});

describe('faturas do cartão e pagamento por transferência', () => {
  beforeEach(resetDb);

  it('fatura fechada aparece com valor e situação; pagar reduz a corrente, marca paga e devolve o limite', async () => {
    const { user, card, checking, food } = await cardScenario();
    await createTransaction(app, user, { type: 'expense', amount: 30000, description: 'Mercado', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-10-20' }); // fatura 2026-11 (fecha 26/10, vence 05/11)
    const inv = await request(app).get(`/api/v1/cards/${card.id}/invoices/2026-11`).set(user.auth);
    expect(inv.body).toMatchObject({ month: '2026-11', amount: 30000, paid: 0, status: 'overdue', closingDate: '2026-10-26', dueDate: '2026-11-05' });
    const pay = await request(app).post(`/api/v1/cards/${card.id}/invoices/2026-11/payments`).set(user.auth).send({ amount: 30000, accountId: checking.id, paidDate: '2026-11-10' });
    expect(pay.status).toBe(201);
    expect((await request(app).get(`/api/v1/cards/${card.id}/invoices/2026-11`).set(user.auth)).body.status).toBe('paid');
    const accounts = (await request(app).get('/api/v1/accounts').set(user.auth)).body;
    expect(accounts.find((a: { id: string }) => a.id === checking.id).balance).toBe(470000);
    expect(accounts.find((a: { id: string }) => a.id === card.id)).toMatchObject({ balance: 0, card: { limitAvailable: 800000 } });
    const summary = (await request(app).get('/api/v1/dashboard/summary').set(user.auth)).body;
    expect(summary.expense.current).toBe(0); // o pagamento não conta como gasto em novembro (a compra foi em outubro)
  });

  it('a fatura aberta continua na lista quando só sobram parcelas em faturas futuras', async () => {
    const { user, card, food } = await cardScenario();
    // Compra em 05/11 em 3x: parcelas nas faturas 2026-12 (a aberta), 2027-01 e 2027-02.
    await request(app).post('/api/v1/transactions').set(user.auth).send({
      type: 'expense', amount: 90000, description: 'Fone', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-11-05', installments: 3,
    });
    await testDb.transaction.deleteMany({ where: { accountId: card.id, installmentNumber: 1 } });
    const res = await request(app).get(`/api/v1/cards/${card.id}/invoices`).set(user.auth);
    expect(res.status).toBe(200);
    expect(res.body.map((i: { month: string; status: string }) => [i.month, i.status])).toEqual([['2026-12', 'open']]);
  });

  it('pagar mais do que a fatura reduz a dívida do cartão sem erro', async () => {
    const { user, card, checking } = await cardScenario();
    const pay = await request(app).post(`/api/v1/cards/${card.id}/invoices/2026-11/payments`).set(user.auth).send({ amount: 5000, accountId: checking.id, paidDate: '2026-11-10' });
    expect(pay.status).toBe(201);
  });

  it('pagamento é uma transferência paga, sem categoria/natureza, com dueDate=paidDate=data enviada e invoiceMonth da fatura', async () => {
    const { user, card, checking } = await cardScenario();
    const res = await request(app).post(`/api/v1/cards/${card.id}/invoices/2026-11/payments`).set(user.auth).send({ amount: 12345, accountId: checking.id, paidDate: '2026-11-10' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      type: 'transfer', amount: 12345, accountId: checking.id, destinationAccountId: card.id,
      categoryId: null, nature: null, status: 'paid', dueDate: '2026-11-10', paidDate: '2026-11-10', invoiceMonth: '2026-11',
    });
    expect(res.body.description).toMatch(/fatura/i); // descrição em pt-BR que identifica a fatura (decisão do controlador)
  });

  it('isolamento: fatura de outro usuário dá 404', async () => {
    const { card } = await cardScenario();
    const intruder = await newUser();
    expect((await request(app).get(`/api/v1/cards/${card.id}/invoices/2026-11`).set(intruder.auth)).status).toBe(404);
    expect((await request(app).post(`/api/v1/cards/${card.id}/invoices/2026-11/payments`).set(intruder.auth).send({ amount: 1, accountId: card.id, paidDate: '2026-11-10' })).status).toBe(404);
  });

  it('isolamento: lista de faturas de outro usuário dá 404', async () => {
    const { card } = await cardScenario();
    const intruder = await newUser();
    expect((await request(app).get(`/api/v1/cards/${card.id}/invoices`).set(intruder.auth)).status).toBe(404);
  });

  it(':id que não é cartão (conta comum) dá 404 nas três rotas', async () => {
    const { user, checking } = await cardScenario();
    expect((await request(app).get(`/api/v1/cards/${checking.id}/invoices`).set(user.auth)).status).toBe(404);
    expect((await request(app).get(`/api/v1/cards/${checking.id}/invoices/2026-11`).set(user.auth)).status).toBe(404);
    expect((await request(app).post(`/api/v1/cards/${checking.id}/invoices/2026-11/payments`).set(user.auth).send({ amount: 1, accountId: checking.id, paidDate: '2026-11-10' })).status).toBe(404);
  });

  it('mês inválido no path dá 400 (GET detalhe e POST pagamento)', async () => {
    const { user, card, checking } = await cardScenario();
    expect((await request(app).get(`/api/v1/cards/${card.id}/invoices/2026-13`).set(user.auth)).status).toBe(400);
    expect((await request(app).post(`/api/v1/cards/${card.id}/invoices/2026-13/payments`).set(user.auth).send({ amount: 1, accountId: checking.id, paidDate: '2026-11-10' })).status).toBe(400);
  });

  it('pagar a fatura de um cartão arquivado é permitido (ele continua em "a pagar" até quitar)', async () => {
    const { user, card, checking } = await cardScenario();
    await request(app).post(`/api/v1/accounts/${card.id}/archive`).set(user.auth);
    const res = await request(app).post(`/api/v1/cards/${card.id}/invoices/2026-11/payments`).set(user.auth).send({ amount: 100, accountId: checking.id, paidDate: '2026-11-10' });
    expect(res.status).toBe(201);
  });

  it('pagar a fatura a partir de uma conta que é cartão dá 422', async () => {
    const { user, card, checking } = await cardScenario();
    const card2 = await createAccount(app, user, {
      name: 'Cartão 2', type: 'credit_card', color: '#111111', creditLimit: 1000, closingDay: 10, dueDay: 20, paymentAccountId: checking.id,
    });
    const res = await request(app).post(`/api/v1/cards/${card.id}/invoices/2026-11/payments`).set(user.auth).send({ amount: 100, accountId: card2.id, paidDate: '2026-11-10' });
    expect(res.status).toBe(422);
  });

  it('pagar a fatura com conta pagadora arquivada dá 422', async () => {
    const { user, card, checking } = await cardScenario();
    await request(app).post(`/api/v1/accounts/${checking.id}/archive`).set(user.auth);
    const res = await request(app).post(`/api/v1/cards/${card.id}/invoices/2026-11/payments`).set(user.auth).send({ amount: 100, accountId: checking.id, paidDate: '2026-11-10' });
    expect(res.status).toBe(422);
  });

  it('pagar a fatura com paidDate no futuro dá 422 (mesma mensagem da regra de pagamento futuro)', async () => {
    const { user, card, checking } = await cardScenario();
    const res = await request(app).post(`/api/v1/cards/${card.id}/invoices/2026-11/payments`).set(user.auth).send({ amount: 100, accountId: checking.id, paidDate: '2026-11-12' });
    expect(res.status).toBe(422);
    expect(res.body.detail).toBe('A data de pagamento não pode estar no futuro.');
  });

  it('lista faturas do mês mais antigo com compra até a fatura aberta, mais recente primeiro; from/to recortam', async () => {
    const { user, card, food } = await cardScenario();
    await createTransaction(app, user, { type: 'expense', amount: 10000, description: 'A', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-09-01' }); // fatura 2026-10
    await createTransaction(app, user, { type: 'expense', amount: 20000, description: 'B', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-10-01' }); // fatura 2026-11

    const all = await request(app).get(`/api/v1/cards/${card.id}/invoices`).set(user.auth);
    expect(all.body.map((i: { month: string }) => i.month)).toEqual(['2026-12', '2026-11', '2026-10']);
    expect(all.body.map((i: { amount: number }) => i.amount)).toEqual([0, 20000, 10000]);

    const narrowed = await request(app).get(`/api/v1/cards/${card.id}/invoices?from=2026-11&to=2026-11`).set(user.auth);
    expect(narrowed.body.map((i: { month: string }) => i.month)).toEqual(['2026-11']);
  });

  it('sem compras no cartão, a lista de faturas tem só a fatura aberta com valor 0', async () => {
    const { user, card } = await cardScenario();
    const res = await request(app).get(`/api/v1/cards/${card.id}/invoices`).set(user.auth);
    expect(res.body).toEqual([expect.objectContaining({ month: '2026-12', amount: 0, paid: 0 })]);
  });

  it('detalhe da fatura traz as despesas do cartão e os pagamentos dessa fatura', async () => {
    const { user, card, checking, food } = await cardScenario();
    const purchase = await createTransaction(app, user, { type: 'expense', amount: 30000, description: 'Mercado', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-10-20' }); // fatura 2026-11
    const pay = await request(app).post(`/api/v1/cards/${card.id}/invoices/2026-11/payments`).set(user.auth).send({ amount: 10000, accountId: checking.id, paidDate: '2026-11-10' });
    expect(pay.status).toBe(201);
    const detail = await request(app).get(`/api/v1/cards/${card.id}/invoices/2026-11`).set(user.auth);
    expect(detail.body).toMatchObject({ month: '2026-11', amount: 30000, paid: 10000 });
    expect(detail.body.transactions.map((t: { id: string }) => t.id).sort()).toEqual([purchase.id, pay.body.id].sort());
  });

  it('nextDue cobre a fatura anterior à aberta (fechada, ainda não vencida, com saldo); some após pagar (teste herdado da revisão da Tarefa 5)', async () => {
    const user = await newUser();
    const checking = await createAccount(app, user, { name: 'Corrente' });
    const card = await createAccount(app, user, {
      name: 'Cartão', type: 'credit_card', color: '#7c3aed',
      creditLimit: 800000, closingDay: 5, dueDay: 20, paymentAccountId: checking.id,
    });
    const food = await categoryId(app, user, 'Alimentação', 'expense');
    await createTransaction(app, user, {
      type: 'expense', amount: 30000, description: 'Compra', accountId: card.id, categoryId: food, nature: 'variable', dueDate: '2026-11-02',
    }); // fecha 05/11, vence 20/11 -> fatura 2026-11 (fechada, ainda não vencida, em 2026-11-11)

    const before = (await request(app).get('/api/v1/accounts').set(user.auth)).body;
    expect(before.find((a: { id: string }) => a.id === card.id).card).toMatchObject({ nextDue: { date: '2026-11-20', amount: 30000 } });

    const pay = await request(app).post(`/api/v1/cards/${card.id}/invoices/2026-11/payments`).set(user.auth).send({ amount: 30000, accountId: checking.id, paidDate: '2026-11-10' });
    expect(pay.status).toBe(201);

    const after = (await request(app).get('/api/v1/accounts').set(user.auth)).body;
    expect(after.find((a: { id: string }) => a.id === card.id).card.nextDue).toBeNull();
  });
});
