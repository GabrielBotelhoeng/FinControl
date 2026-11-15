import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { toDateOnly } from '../src/infra/date-mapping';
import { buildTestApp } from './helpers/app';
import { newUser } from './helpers/auth';
import { seedBankRatesFromFixture } from './helpers/bank-rates';
import { resetDb, testDb } from './helpers/db';
import { createAccount } from './helpers/factories';

const { app } = buildTestApp();

async function loanScenario(over: Record<string, unknown> = {}) {
  const user = await newUser();
  const checking = await createAccount(app, user, { name: 'Corrente', initialBalance: 500000 });
  const res = await request(app).post('/api/v1/loans').set(user.auth).send({
    name: 'Carro', kind: 'vehicle', bankName: 'BCO DO BRASIL S.A.', bankCnpj8: '00000000',
    principal: 3000000, installmentAmount: 95000, installmentsTotal: 48, installmentsPaidBefore: 12,
    firstDueDate: '2025-12-10', accountId: checking.id, ...over,
  });
  return { user, checking, res };
}

describe('empréstimos', () => {
  beforeEach(resetDb);

  it('"já paguei 12 de 48" gera só as 36 restantes como pendentes, na categoria de empréstimos (critério 5)', async () => {
    const { user, res } = await loanScenario();
    expect(res.status).toBe(201);
    const rows = await testDb.transaction.findMany({ where: { loanId: res.body.id }, orderBy: { dueDate: 'asc' } });
    expect(rows).toHaveLength(36);
    expect(rows.every((r) => r.status === 'pending' && r.type === 'expense' && r.amount === 95000n)).toBe(true);
    expect(rows[0]).toMatchObject({ installmentNumber: 13, installmentTotal: 48, description: 'Carro (13/48)' });
    expect(toDateOnly(rows[0]!.dueDate)).toBe('2026-12-10'); // 1ª parcela 2025-12-10 + 12 meses
    const cat = await testDb.category.findUnique({ where: { id: rows[0]!.categoryId! } });
    expect(cat!.name).toBe('Empréstimos e financiamentos');
    const detail = (await request(app).get(`/api/v1/loans/${res.body.id}`).set(user.auth)).body;
    expect(detail).toMatchObject({ installmentsPaid: 12, remainingCount: 36, outstanding: 2477608, payoffSavings: 942392, totalCost: 4560000, interest: 1560000 });
  });

  it('pagar uma parcela pelo fluxo normal atualiza o progresso', async () => {
    const { user, res } = await loanScenario();
    const first = await testDb.transaction.findFirst({ where: { loanId: res.body.id }, orderBy: { dueDate: 'asc' } });
    await request(app).post(`/api/v1/transactions/${first!.id}/pay`).set(user.auth).send({ paidDate: '2026-11-10' });
    const detail = (await request(app).get(`/api/v1/loans/${res.body.id}`).set(user.auth)).body;
    expect(detail).toMatchObject({ installmentsPaid: 13, remainingCount: 35 });
  });

  it('compara com o banco e com a mediana do mercado quando há taxas sincronizadas (critério 6)', async () => {
    await seedBankRatesFromFixture('bcb-veiculos-2026-10-23.json'); // helper novo em test/helpers/bank-rates.ts
    const { user, res } = await loanScenario();
    const detail = (await request(app).get(`/api/v1/loans/${res.body.id}`).set(user.auth)).body;
    expect(detail.comparison).toMatchObject({
      modality: 'Aquisição de veículos - Prefixado', periodStart: '2026-10-23', periodEnd: '2026-10-29', source: 'Banco Central do Brasil',
      bank: { name: 'BCO DO BRASIL S.A.', position: 7, of: 39 }, market: { monthlyRate: 0.017 },
    });
  });

  it('sem taxas sincronizadas, a comparação é null e o cálculo próprio continua', async () => {
    const { user, res } = await loanScenario();
    const detail = (await request(app).get(`/api/v1/loans/${res.body.id}`).set(user.auth)).body;
    expect(detail.comparison).toBeNull();
    expect(detail.monthlyRate).toBeCloseTo(0.0185795, 6);
  });

  it('taxa informada diferente avisa; já pagas ≥ total dá 400; já pagas = total − 1 gera 1 parcela', async () => {
    const a = await loanScenario({ informedMonthlyRate: 0.015 });
    expect((await request(app).get(`/api/v1/loans/${a.res.body.id}`).set(a.user.auth)).body.warnings).toEqual(['informed_rate_differs']);
    expect((await loanScenario({ installmentsPaidBefore: 48 })).res.status).toBe(400); // erro de forma (Zod), como os campos de cartão na Parte A
    const c = await loanScenario({ installmentsPaidBefore: 47 });
    expect(await testDb.transaction.count({ where: { loanId: c.res.body.id } })).toBe(1);
  });

  it('excluir apaga as pendentes e mantém as pagas sem o vínculo, sem mexer em outro empréstimo', async () => {
    const { user, checking, res } = await loanScenario();
    const other = await request(app).post('/api/v1/loans').set(user.auth).send({
      name: 'Outro', kind: 'personal', bankName: 'X', principal: 100000, installmentAmount: 10000, installmentsTotal: 12,
      firstDueDate: '2026-12-01', accountId: checking.id,
    });
    const first = await testDb.transaction.findFirst({ where: { loanId: res.body.id }, orderBy: { dueDate: 'asc' } });
    await request(app).post(`/api/v1/transactions/${first!.id}/pay`).set(user.auth).send({ paidDate: '2026-11-10' });
    expect((await request(app).delete(`/api/v1/loans/${res.body.id}`).set(user.auth)).status).toBe(204);
    expect(await testDb.transaction.count({ where: { loanId: res.body.id } })).toBe(0);
    expect(await testDb.transaction.findUnique({ where: { id: first!.id } })).toMatchObject({ status: 'paid', loanId: null });
    expect(await testDb.transaction.count({ where: { loanId: other.body.id } })).toBe(12);
  });

  it('isolamento: empréstimo de outro usuário dá 404 em GET, PATCH e DELETE; conta de outro usuário no POST dá 404', async () => {
    const { res } = await loanScenario();
    const intruder = await newUser();
    for (const call of [request(app).get(`/api/v1/loans/${res.body.id}`), request(app).patch(`/api/v1/loans/${res.body.id}`).send({ name: 'x' }), request(app).delete(`/api/v1/loans/${res.body.id}`)]) {
      expect((await call.set(intruder.auth)).status).toBe(404);
    }
    const theirs = await loanScenario();
    const mine = await newUser();
    const post = await request(app).post('/api/v1/loans').set(mine.auth).send({
      name: 'X', kind: 'personal', bankName: 'X', principal: 100000, installmentAmount: 10000, installmentsTotal: 12,
      firstDueDate: '2026-12-01', accountId: theirs.checking.id,
    });
    expect(post.status).toBe(404);
  });
});
