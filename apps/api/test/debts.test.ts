import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers/app';
import { newUser } from './helpers/auth';
import { resetDb, testDb } from './helpers/db';
import { createAccount } from './helpers/factories';

// Hoje nos testes é 2026-11-11 (FIXED_NOW).
const { app } = buildTestApp();

async function debtScenario(over: Record<string, unknown> = {}) {
  const user = await newUser();
  const checking = await createAccount(app, user, { name: 'Corrente', initialBalance: 500000 });
  const res = await request(app).post('/api/v1/debts').set(user.auth).send({
    name: 'Crediário', creditor: 'Loja de Móveis', kind: 'store', originalAmount: 100000, since: '2026-03-10', currentAmount: 130000, ...over,
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return { user, checking, debt: res.body };
}

const agreementBody = (accountId: string, over: Record<string, unknown> = {}) => ({
  downPayment: 10000, installments: 4, installmentAmount: 20000, firstDueDate: '2026-12-05', accountId, ...over,
});

describe('dívidas com credores', () => {
  beforeEach(resetDb);

  it('cadastro com valor de hoje maior: juros e multas, saldo e situação em aberto (V4, V6)', async () => {
    const { debt } = await debtScenario();
    expect(debt).toMatchObject({
      name: 'Crediário', creditor: 'Loja de Móveis', kind: 'store', since: '2026-03-10',
      original: 100000, interest: 30000, discounts: 0, paid: 0, balance: 130000, status: 'open', agreement: null, lastAnchorDate: '2026-11-11',
    });
    expect(debt.timeline.map((i: { kind: string; delta: number | null }) => [i.kind, i.delta])).toEqual([['valuation', 30000], ['valuation', null]]);
  });

  it('sem valor de hoje, uma âncora só; "deve desde" no futuro dá 422', async () => {
    const { debt, user } = await debtScenario({ currentAmount: undefined });
    expect(debt).toMatchObject({ balance: 100000, interest: 0, lastAnchorDate: '2026-03-10' });
    const future = await request(app).post('/api/v1/debts').set(user.auth).send({
      name: 'X', creditor: 'Y', kind: 'other', originalAmount: 100, since: '2026-11-12',
    });
    expect(future.status).toBe(422);
  });

  it('pagamento avulso vira lançamento pago e desconta do saldo; maior que o saldo ou antes da última atualização dá 422 (V8)', async () => {
    const { user, checking, debt } = await debtScenario();
    const ok = await request(app).post(`/api/v1/debts/${debt.id}/payments`).set(user.auth).send({ amount: 30000, date: '2026-11-11', accountId: checking.id });
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
    expect(ok.body).toMatchObject({ paid: 30000, balance: 100000 });
    const tx = await testDb.transaction.findFirst({ where: { debtId: debt.id } });
    expect(tx).toMatchObject({ status: 'paid', type: 'expense', amount: 30000n, description: 'Pagamento Crediário' });
    const cat = await testDb.category.findUnique({ where: { id: tx!.categoryId! } });
    expect(cat!.name).toBe('Dívidas e acordos');

    const tooMuch = await request(app).post(`/api/v1/debts/${debt.id}/payments`).set(user.auth).send({ amount: 100001, date: '2026-11-11', accountId: checking.id });
    expect(tooMuch.status).toBe(422);
    const early = await request(app).post(`/api/v1/debts/${debt.id}/payments`).set(user.auth).send({ amount: 100, date: '2026-11-10', accountId: checking.id });
    expect(early.status).toBe(422);
  });

  it('apagar o pagamento em Lançamentos devolve o saldo (V3)', async () => {
    const { user, checking, debt } = await debtScenario();
    await request(app).post(`/api/v1/debts/${debt.id}/payments`).set(user.auth).send({ amount: 30000, date: '2026-11-11', accountId: checking.id });
    const tx = await testDb.transaction.findFirst({ where: { debtId: debt.id } });
    expect((await request(app).delete(`/api/v1/transactions/${tx!.id}`).set(user.auth)).status).toBe(204);
    expect((await request(app).get(`/api/v1/debts/${debt.id}`).set(user.auth)).body).toMatchObject({ paid: 0, balance: 130000 });
  });

  it('atualizar o valor para menos conta como desconto; negociação não mexe no saldo (V5, V6)', async () => {
    const { user, debt } = await debtScenario();
    const v = await request(app).post(`/api/v1/debts/${debt.id}/valuations`).set(user.auth).send({ amount: 120000, note: 'Boleto novo' });
    expect(v.status).toBe(201);
    expect(v.body).toMatchObject({ balance: 120000, interest: 30000, discounts: 10000 });
    const n = await request(app).post(`/api/v1/debts/${debt.id}/notes`).set(user.auth).send({ text: 'Ofereceram 50% à vista', amount: 60000 });
    expect(n.status).toBe(201);
    expect(n.body.balance).toBe(120000);
    expect(n.body.timeline[0]).toMatchObject({ kind: 'note', text: 'Ofereceram 50% à vista', amount: 60000 });
  });

  it('acordo: entrada paga, parcelas pendentes, desconto e situação em acordo (V7)', async () => {
    const { user, checking, debt } = await debtScenario();
    const res = await request(app).post(`/api/v1/debts/${debt.id}/agreement`).set(user.auth).send(agreementBody(checking.id));
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    // total 10.000 + 4 × 20.000 = 90.000 contra saldo 130.000 → desconto 40.000; entrada paga.
    expect(res.body).toMatchObject({ discounts: 40000, paid: 10000, balance: 80000, status: 'agreement', nextDue: { date: '2026-12-05', amount: 20000 } });
    expect(res.body.agreement).toMatchObject({ total: 90000, downPayment: 10000, installments: 4, installmentAmount: 20000 });
    expect(res.body.agreement.schedule.map((s: { dueDate: string }) => s.dueDate)).toEqual(['2026-12-05', '2027-01-05', '2027-02-05', '2027-03-05']);
    const rows = await testDb.transaction.findMany({ where: { debtId: debt.id, status: 'pending' }, orderBy: { dueDate: 'asc' } });
    expect(rows[0]).toMatchObject({ description: 'Acordo Crediário (1/4)', installmentNumber: 1, installmentTotal: 4, amount: 20000n });

    // Com acordo ativo: outro acordo, atualizar valor e pagar avulso dão 422.
    expect((await request(app).post(`/api/v1/debts/${debt.id}/agreement`).set(user.auth).send(agreementBody(checking.id))).status).toBe(422);
    expect((await request(app).post(`/api/v1/debts/${debt.id}/valuations`).set(user.auth).send({ amount: 1 })).status).toBe(422);
    expect((await request(app).post(`/api/v1/debts/${debt.id}/payments`).set(user.auth).send({ amount: 1, date: '2026-11-11', accountId: checking.id })).status).toBe(422);

    // Pagar parcelas pelo fluxo normal quita a dívida.
    for (const r of rows) await request(app).post(`/api/v1/transactions/${r.id}/pay`).set(user.auth).send({ paidDate: '2026-11-11' });
    expect((await request(app).get(`/api/v1/debts/${debt.id}`).set(user.auth)).body).toMatchObject({ balance: 0, paid: 90000, status: 'paid_off', fraction: 1 });
  });

  it('parcela de acordo não pode ser apagada nem mudar de valor em Lançamentos (V8)', async () => {
    const { user, checking, debt } = await debtScenario();
    await request(app).post(`/api/v1/debts/${debt.id}/agreement`).set(user.auth).send(agreementBody(checking.id));
    const row = await testDb.transaction.findFirst({ where: { debtId: debt.id, status: 'pending' } });
    expect((await request(app).delete(`/api/v1/transactions/${row!.id}`).set(user.auth)).status).toBe(422);
    expect((await request(app).patch(`/api/v1/transactions/${row!.id}`).set(user.auth).send({ amount: 1 })).status).toBe(422);
    // A conta que paga parcela pendente de acordo não pode ser arquivada.
    expect((await request(app).post(`/api/v1/accounts/${checking.id}/archive`).set(user.auth)).status).toBe(422);
  });

  it('parcela vencida deixa a situação em atraso', async () => {
    const { user, checking, debt } = await debtScenario();
    await request(app).post(`/api/v1/debts/${debt.id}/agreement`).set(user.auth).send(agreementBody(checking.id, { firstDueDate: '2026-11-11' }));
    await testDb.transaction.updateMany({ where: { debtId: debt.id, installmentNumber: 1 }, data: { dueDate: new Date('2026-11-01T00:00:00Z') } });
    expect((await request(app).get(`/api/v1/debts/${debt.id}`).set(user.auth)).body.status).toBe('late');
  });

  it('cancelar o acordo apaga as pendentes e ancora o saldo do momento', async () => {
    const { user, checking, debt } = await debtScenario();
    await request(app).post(`/api/v1/debts/${debt.id}/agreement`).set(user.auth).send(agreementBody(checking.id));
    const res = await request(app).delete(`/api/v1/debts/${debt.id}/agreement`).set(user.auth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ balance: 80000, status: 'open', agreement: null });
    expect(res.body.timeline[0]).toMatchObject({ kind: 'valuation', amount: 80000, note: 'Acordo cancelado', delta: 0 });
    expect(await testDb.transaction.count({ where: { debtId: debt.id, status: 'pending' } })).toBe(0);
    expect((await request(app).delete(`/api/v1/debts/${debt.id}/agreement`).set(user.auth)).status).toBe(422);
  });

  it('acordo com 1º vencimento no passado, conta cartão ou dívida quitada dá 422', async () => {
    const { user, checking, debt } = await debtScenario();
    expect((await request(app).post(`/api/v1/debts/${debt.id}/agreement`).set(user.auth).send(agreementBody(checking.id, { firstDueDate: '2026-11-10' }))).status).toBe(422);
    const card = await createAccount(app, user, { type: 'credit_card', creditLimit: 100000, closingDay: 1, dueDay: 10, paymentAccountId: checking.id });
    expect((await request(app).post(`/api/v1/debts/${debt.id}/agreement`).set(user.auth).send(agreementBody(card.id))).status).toBe(422);
    await request(app).post(`/api/v1/debts/${debt.id}/valuations`).set(user.auth).send({ amount: 0 });
    expect((await request(app).post(`/api/v1/debts/${debt.id}/agreement`).set(user.auth).send(agreementBody(checking.id))).status).toBe(422);
  });

  it('lista: não quitadas primeiro, do maior saldo ao menor; outro usuário não vê', async () => {
    const { user } = await debtScenario();
    const small = await request(app).post('/api/v1/debts').set(user.auth).send({ name: 'Luz', creditor: 'Energia', kind: 'utility', originalAmount: 20000, since: '2026-10-01' });
    const done = await request(app).post('/api/v1/debts').set(user.auth).send({ name: 'Amigo', creditor: 'João', kind: 'person', originalAmount: 500000, since: '2026-10-01' });
    await request(app).post(`/api/v1/debts/${done.body.id}/valuations`).set(user.auth).send({ amount: 0 });
    const list = (await request(app).get('/api/v1/debts').set(user.auth)).body as { name: string }[];
    expect(list.map((d) => d.name)).toEqual(['Crediário', small.body.name, 'Amigo']);
    const other = await newUser();
    expect((await request(app).get('/api/v1/debts').set(other.auth)).body).toEqual([]);
    expect((await request(app).get(`/api/v1/debts/${small.body.id}`).set(other.auth)).status).toBe(404);
  });

  it('editar só o nome, o credor e o tipo; excluir apaga as pendentes e mantém os pagamentos sem vínculo (V10)', async () => {
    const { user, checking, debt } = await debtScenario();
    const edited = await request(app).patch(`/api/v1/debts/${debt.id}`).set(user.auth).send({ name: 'Sofá', kind: 'other' });
    expect(edited.body).toMatchObject({ name: 'Sofá', kind: 'other', creditor: 'Loja de Móveis' });
    await request(app).post(`/api/v1/debts/${debt.id}/agreement`).set(user.auth).send(agreementBody(checking.id));
    expect((await request(app).delete(`/api/v1/debts/${debt.id}`).set(user.auth)).status).toBe(204);
    const left = await testDb.transaction.findMany({ where: { description: { startsWith: 'Entrada do acordo' } } });
    expect(left).toHaveLength(1);
    expect(left[0]!.debtId).toBeNull();
    expect(await testDb.transaction.count({ where: { status: 'pending', description: { startsWith: 'Acordo' } } })).toBe(0);
    expect(await testDb.debtEvent.count()).toBe(0);
  });

  it('entra no total de dívidas do painel e na evolução do relatório (V11)', async () => {
    const { user, checking, debt } = await debtScenario();
    await request(app).post(`/api/v1/debts/${debt.id}/payments`).set(user.auth).send({ amount: 30000, date: '2026-11-11', accountId: checking.id });
    expect((await request(app).get('/api/v1/dashboard/summary').set(user.auth)).body.debts).toEqual({ cards: 0, loans: 0, others: 100000, total: 100000 });
    const report = (await request(app).get('/api/v1/reports?from=2026-01&to=2026-11').set(user.auth)).body;
    const at = (m: string) => report.debts.find((d: { month: string }) => d.month === m);
    expect(at('2026-02')).toMatchObject({ others: 0 });
    expect(at('2026-03')).toMatchObject({ others: 100000, total: 100000 });
    expect(at('2026-11')).toMatchObject({ others: 100000 });
  });

  // ---------- Revisão final ----------

  it('pagamento já incluído numa atualização de valor não pode ser desmarcado nem pago de novo (contaria duas vezes)', async () => {
    const { user, checking, debt } = await debtScenario();
    await request(app).post(`/api/v1/debts/${debt.id}/payments`).set(user.auth).send({ amount: 30000, date: '2026-11-11', accountId: checking.id });
    await request(app).post(`/api/v1/debts/${debt.id}/valuations`).set(user.auth).send({ amount: 105000 });
    const tx = await testDb.transaction.findFirst({ where: { debtId: debt.id } });
    expect((await request(app).post(`/api/v1/transactions/${tx!.id}/unpay`).set(user.auth)).status).toBe(422);
    expect((await request(app).get(`/api/v1/debts/${debt.id}`).set(user.auth)).body).toMatchObject({ balance: 105000 });
  });

  it('pagamento depois da última atualização pode ser desmarcado e pago de novo, mas não com data anterior a ela', async () => {
    const { user, checking, debt } = await debtScenario();
    await request(app).post(`/api/v1/debts/${debt.id}/payments`).set(user.auth).send({ amount: 30000, date: '2026-11-11', accountId: checking.id });
    const tx = await testDb.transaction.findFirst({ where: { debtId: debt.id } });
    expect((await request(app).post(`/api/v1/transactions/${tx!.id}/unpay`).set(user.auth)).status).toBe(200);
    expect((await request(app).get(`/api/v1/debts/${debt.id}`).set(user.auth)).body).toMatchObject({ balance: 130000, nextDue: null });
    expect((await request(app).post(`/api/v1/transactions/${tx!.id}/pay`).set(user.auth).send({ paidDate: '2026-11-10' })).status).toBe(422);
    expect((await request(app).post(`/api/v1/transactions/${tx!.id}/pay`).set(user.auth).send({ paidDate: '2026-11-11' })).status).toBe(200);
    expect((await request(app).get(`/api/v1/debts/${debt.id}`).set(user.auth)).body).toMatchObject({ balance: 100000 });
  });

  it('a entrada do acordo tem as travas das parcelas; parcela paga de acordo cancelado não pode ser desmarcada', async () => {
    const { user, checking, debt } = await debtScenario();
    await request(app).post(`/api/v1/debts/${debt.id}/agreement`).set(user.auth).send(agreementBody(checking.id));
    const entrada = await testDb.transaction.findFirst({ where: { debtId: debt.id, description: { startsWith: 'Entrada' } } });
    expect(entrada!.installmentNumber).toBe(0);
    expect((await request(app).delete(`/api/v1/transactions/${entrada!.id}`).set(user.auth)).status).toBe(422);
    const first = await testDb.transaction.findFirst({ where: { debtId: debt.id, installmentNumber: 1 } });
    await request(app).post(`/api/v1/transactions/${first!.id}/pay`).set(user.auth).send({ paidDate: '2026-11-11' });
    await request(app).delete(`/api/v1/debts/${debt.id}/agreement`).set(user.auth);
    expect((await request(app).post(`/api/v1/transactions/${first!.id}/unpay`).set(user.auth)).status).toBe(422);
  });

  it('acordo todo pago não trava mais: dá para atualizar o valor', async () => {
    const { user, checking, debt } = await debtScenario();
    await request(app).post(`/api/v1/debts/${debt.id}/agreement`).set(user.auth).send(agreementBody(checking.id, { installments: 1, installmentAmount: 20000 }));
    const only = await testDb.transaction.findFirst({ where: { debtId: debt.id, status: 'pending' } });
    await request(app).post(`/api/v1/transactions/${only!.id}/pay`).set(user.auth).send({ paidDate: '2026-11-11' });
    expect((await request(app).get(`/api/v1/debts/${debt.id}`).set(user.auth)).body.status).toBe('paid_off');
    const v = await request(app).post(`/api/v1/debts/${debt.id}/valuations`).set(user.auth).send({ amount: 5000, note: 'Faltou a taxa' });
    expect(v.status).toBe(201);
    expect(v.body).toMatchObject({ status: 'open', balance: 5000 });
  });

  it('dois pagamentos do saldo inteiro ao mesmo tempo: só um passa', async () => {
    const { user, checking, debt } = await debtScenario();
    const send = () => request(app).post(`/api/v1/debts/${debt.id}/payments`).set(user.auth).send({ amount: 130000, date: '2026-11-11', accountId: checking.id });
    const statuses = (await Promise.all([send(), send()])).map((r) => r.status).sort();
    expect(statuses).toEqual([201, 422]);
    expect(await testDb.transaction.count({ where: { debtId: debt.id } })).toBe(1);
  });

  it('cancelar o acordo duas vezes ao mesmo tempo: só um "Acordo cancelado"', async () => {
    const { user, checking, debt } = await debtScenario();
    await request(app).post(`/api/v1/debts/${debt.id}/agreement`).set(user.auth).send(agreementBody(checking.id));
    const cancel = () => request(app).delete(`/api/v1/debts/${debt.id}/agreement`).set(user.auth);
    const statuses = (await Promise.all([cancel(), cancel()])).map((r) => r.status).sort();
    expect(statuses).toEqual([200, 422]);
    expect(await testDb.debtEvent.count({ where: { debtId: debt.id, note: 'Acordo cancelado' } })).toBe(1);
  });

  it('valores inválidos dão 400', async () => {
    const { user, debt } = await debtScenario();
    expect((await request(app).post('/api/v1/debts').set(user.auth).send({ name: '', creditor: 'x', kind: 'store', originalAmount: 1, since: '2026-01-01' })).status).toBe(400);
    expect((await request(app).post(`/api/v1/debts/${debt.id}/agreement`).set(user.auth).send({ installments: 0, installmentAmount: 1, firstDueDate: '2026-12-01', accountId: debt.id })).status).toBe(400);
    expect((await request(app).post(`/api/v1/debts/${debt.id}/notes`).set(user.auth).send({ text: '' })).status).toBe(400);
  });
});
